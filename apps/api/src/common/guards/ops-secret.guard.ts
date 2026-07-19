import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * The single "is this ops, not a customer" check for the small set of
 * operator-triggered endpoints this app has (currently just refund) — a
 * shared secret header, not a real admin role/session. Deliberately minimal:
 * see TASKS.md Phase 7. Revisit with a real ops auth model only if this app
 * gets enough real usage to justify one.
 */
@Injectable()
export class OpsSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('OPS_SECRET');
    if (!expected) {
      throw new UnauthorizedException('Ops endpoints are not configured');
    }

    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-ops-secret'];
    if (provided !== expected) {
      throw new UnauthorizedException('Invalid ops secret');
    }
    return true;
  }
}
