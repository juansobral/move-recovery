import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { DiagController } from './diag.controller';
import { DiagService } from './diag.service';

@Module({
  imports: [MailModule, AuthModule],
  controllers: [DiagController],
  providers: [DiagService],
})
export class DiagModule {}
