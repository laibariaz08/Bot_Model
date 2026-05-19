import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [ChatController],
  providers: [ChatService, WhatsappService],
  exports: [ChatService, WhatsappService],
})
export class ChatModule {}