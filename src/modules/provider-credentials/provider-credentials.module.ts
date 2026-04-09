import { Module } from '@nestjs/common';
import { ProviderCredentialsService } from './provider-credentials.service';

@Module({
  providers: [ProviderCredentialsService],
  exports: [ProviderCredentialsService],
})
export class ProviderCredentialsModule {}
