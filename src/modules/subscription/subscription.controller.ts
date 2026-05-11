import {
  Get,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { SaveSubscriptionDto } from './dto/validate-iap-receipt.dto';
import { SubscriptionService } from './subscription.service';

@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Get('plans')
  @ApiBearerAuth('firebaseauth')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Get all subscription plans with product IDs, limits and billing period' })
  plans() {
    return this.subscriptionService.getPlans();
  }

  @Get('me')
  @ApiBearerAuth('firebaseauth')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Get current user subscription status and usage' })
  me(@CurrentUser() user: { id: string }) {
    return this.subscriptionService.getMySubscription(user.id);
  }

  @Post('iap/save')
  @ApiBearerAuth('firebaseauth')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({
    summary: 'Save or sync IAP subscription',
    description:
      'Call after every purchase and on every app open (splash screen). ' +
      'Send platform + productId when Apple/Google confirms an active subscription. ' +
      'Send empty body (or omit productId) when there is no active subscription — backend downgrades user to free plan.',
  })
  saveSubscription(
    @CurrentUser() user: { id: string },
    @Body() dto: SaveSubscriptionDto,
  ) {
    return this.subscriptionService.saveSubscription(user.id, dto);
  }
}
