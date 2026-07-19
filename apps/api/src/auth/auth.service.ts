import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { generateNonce, SiweMessage, type SiweResponse } from 'siwe';
import { normalizePhoneNumber } from '../common/lib/phone';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateOpaqueToken, hashSecret } from './lib/tokens';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** Long enough to approve a signature in a wallet UI, short enough to bound the replay window. */
const NONCE_TTL_MS = 5 * 60 * 1000;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SanitizedUser {
  id: string;
  walletAddress: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
}

function sanitizeUser(user: User): SanitizedUser {
  return {
    id: user.id,
    walletAddress: user.walletAddress,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class AuthService {
  /**
   * In-memory, single-instance nonce store. Fine for one API process; a
   * horizontally-scaled deployment would need this shared (e.g. Redis)
   * instead — not needed at this app's current scale.
   */
  private readonly nonces = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  createNonce(): string {
    this.sweepExpiredNonces();
    const nonce = generateNonce();
    this.nonces.set(nonce, Date.now() + NONCE_TTL_MS);
    return nonce;
  }

  /**
   * Verifies a signed Sign-In-With-Ethereum message (EIP-4361) and upserts a
   * User by wallet address — this *is* signup/login, there is no separate
   * account-creation step. See TASKS.md Phase 1 for why: MiniPay users
   * already have a wallet connected, so the wallet address is the identity.
   */
  async verifySiwe(
    rawMessage: string,
    signature: string,
  ): Promise<{ user: SanitizedUser } & AuthTokens> {
    let siweMessage: SiweMessage;
    try {
      siweMessage = new SiweMessage(rawMessage);
    } catch {
      throw new UnauthorizedException('Malformed sign-in message');
    }

    if (!this.consumeNonce(siweMessage.nonce)) {
      throw new UnauthorizedException(
        'Invalid or expired nonce — request a new one and sign in again',
      );
    }

    const expectedDomain = this.config.get<string>('SIWE_DOMAIN');
    let result: SiweResponse;
    try {
      result = await siweMessage.verify({ signature, domain: expectedDomain });
    } catch {
      throw new UnauthorizedException('Signature verification failed');
    }
    if (!result.success) {
      throw new UnauthorizedException(
        result.error?.type ?? 'Signature verification failed',
      );
    }

    const walletAddress = result.data.address.toLowerCase();
    const user = await this.prisma.user.upsert({
      where: { walletAddress },
      create: { walletAddress },
      update: {},
    });

    const tokens = await this.issueTokenPair(user);
    return { user: sanitizeUser(user), ...tokens };
  }

  async refresh(
    rawRefreshToken: string,
  ): Promise<{ user: SanitizedUser } & AuthTokens> {
    const tokenHash = hashSecret(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt) {
      // A refresh token that's already been rotated out is being reused —
      // treat this as possible theft and kill every session for the user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Refresh token already used — all sessions revoked',
      );
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // The revoke IS the concurrency guard — a conditional updateMany, not a
    // separate check-then-write. Two concurrent refreshes racing on the same
    // token can now only ever have one winner; the loser's count is 0, which
    // is exactly the reuse case and revokes the whole session family.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Refresh token already used — all sessions revoked',
      );
    }

    const tokens = await this.issueTokenPair(existing.user);
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { replacedByTokenHash: hashSecret(tokens.refreshToken) },
    });

    return { user: sanitizeUser(existing.user), ...tokens };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashSecret(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<SanitizedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return sanitizeUser(user);
  }

  async updateProfile(
    userId: string,
    input: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
    },
  ): Promise<SanitizedUser> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!current) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.firstName !== undefined
          ? { firstName: input.firstName }
          : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.phone !== undefined
          ? { phone: normalizePhoneNumber(input.phone) }
          : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
      },
    });
    return sanitizeUser(user);
  }

  private consumeNonce(nonce: string): boolean {
    const expiresAt = this.nonces.get(nonce);
    this.nonces.delete(nonce);
    return typeof expiresAt === 'number' && expiresAt > Date.now();
  }

  private sweepExpiredNonces(): void {
    const now = Date.now();
    for (const [nonce, expiresAt] of this.nonces) {
      if (expiresAt <= now) this.nonces.delete(nonce);
    }
  }

  private async issueTokenPair(user: User): Promise<AuthTokens> {
    const accessToken = this.jwtService.sign(
      { sub: user.id, walletAddress: user.walletAddress },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const rawRefreshToken = generateOpaqueToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashSecret(rawRefreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
