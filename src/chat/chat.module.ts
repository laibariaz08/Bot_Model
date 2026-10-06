import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { InstagramService } from '../instagram/instagram.service';
import { MessengerService } from '../messenger/messenger.service';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [PrismaModule, AiModule, WorkflowModule],
  controllers: [ChatController],
  providers: [ChatService, WhatsappService, InstagramService, MessengerService],
  exports: [ChatService, WhatsappService, InstagramService, MessengerService],
})
export class ChatModule {}