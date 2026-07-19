import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { OpsSecretGuard } from '../common/guards/ops-secret.guard';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('bookings/:id/initiate')
  initiate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
  ) {
    return this.paymentsService.initiate(bookingId, user.userId);
  }

  @Post('bookings/:id/confirm')
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.paymentsService.confirm(bookingId, user.userId, dto.txHash);
  }

  /** Ops-only — see OpsSecretGuard. Not customer-facing (this app has no admin panel; see TASKS.md Phase 7). */
  @Public()
  @UseGuards(OpsSecretGuard)
  @Post('bookings/:id/refund')
  refund(@Param('id') bookingId: string) {
    return this.paymentsService.refund(bookingId);
  }
}
