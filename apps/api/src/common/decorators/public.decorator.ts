import { SetMetadata } from '@nestjs/common';

/**
 * Every route is protected by default (JwtAuthGuard is registered globally
 * via APP_GUARD) — opting out of auth requires this explicit decorator
 * instead of a route just forgetting to attach a guard.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
