import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

// Phase 1 — Foundation
import { VariableResolver } from './variable-resolver.service';
import { WhatsAppChannelAdapter } from './whatsapp-channel.adapter';
import { InstagramChannelAdapter } from './instagram-channel.adapter';
import { MessengerChannelAdapter } from './messenger-channel.adapter';
import { InstagramService } from '../instagram/instagram.service';
import { MessengerService } from '../messenger/messenger.service';
import { WorkflowSessionService } from './workflow-session.service';

// Phase 2 — Engine + Handlers
import { NodeHandlerRegistry } from './node-handler.registry';
import { WorkflowEngineService } from './workflow-engine.service';
import {
  StartHandler,
  SendMessageHandler,
  SendButtonsHandler,
  SendListHandler,
  SendMediaHandler,
  AskQuestionHandler,
  ConditionHandler,
  AiResponseHandler,
  SetVariableHandler,
  WaitHandler,
  HumanHandoverHandler,
  EndHandler,
} from './handlers';

@Module({
  imports: [PrismaModule, AiModule],
  providers: [
    // Foundation
    VariableResolver,
    WhatsAppChannelAdapter,
    InstagramChannelAdapter,
    MessengerChannelAdapter,
    InstagramService,
    MessengerService,
    WorkflowSessionService,

    // Registry + Engine
    NodeHandlerRegistry,
    WorkflowEngineService,

    // Node Handlers
    StartHandler,
    SendMessageHandler,
    SendButtonsHandler,
    SendListHandler,
    SendMediaHandler,
    AskQuestionHandler,
    ConditionHandler,
    AiResponseHandler,
    SetVariableHandler,
    WaitHandler,
    HumanHandoverHandler,
    EndHandler,
  ],
  exports: [
    WorkflowEngineService,
    WorkflowSessionService,
  ],
})
export class WorkflowModule {}
