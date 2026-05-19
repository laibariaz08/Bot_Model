import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [ChatModule, AiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
