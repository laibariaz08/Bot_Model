import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { AiModule } from './ai/ai.module';
import { WorkflowModule } from './workflow/workflow.module';

@Module({
  imports: [ChatModule, AiModule, WorkflowModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
