/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
import { ValidateIapReceiptDto } from './dto/validate-iap-receipt.dto';
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
  @ApiOperation({ summary: 'Get subscription plans (IAP metadata)' })
  plans() {
    return this.subscriptionService.getPlans();
  }

  @Get('me')
  @ApiBearerAuth('firebaseauth')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Get current user subscription and usage' })
  me(@CurrentUser() user: { id: string }) {
    return this.subscriptionService.getMySubscription(user.id);
  }

  @Post('iap/record')
  @ApiBearerAuth('firebaseauth')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Save frontend subscription purchase data' })
  recordIap(
    @CurrentUser() user: { id: string },
    @Body() dto: ValidateIapReceiptDto,
  ) {
    return this.subscriptionService.validateIapReceipt(user.id, dto);
  }
}
