export interface JwtAccessPayload {
  sub: string;
  walletAddress: string;
}

export interface AuthenticatedUser {
  userId: string;
  walletAddress: string;
}
