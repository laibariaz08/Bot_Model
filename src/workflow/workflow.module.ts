import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

// Phase 1 — Foundation
import { VariableResolver } from './variable-resolver.service';
import { WhatsAppChannelAdapter } from './whatsapp-channel.adapter';
import { WorkflowSessionService } from './workflow-session.service';

// Phase 2 — Engine + Handlers
import { NodeHandlerRegistry } from './node-handler.registry';
import { WorkflowEngineService } from './workflow-engine.service';
import {
  StartHandler,
  SendMessageHandler,
  SendButtonsHandler,
  SendListHandler,
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
    WorkflowSessionService,

    // Registry + Engine
    NodeHandlerRegistry,
    WorkflowEngineService,

    // Node Handlers
    StartHandler,
    SendMessageHandler,
    SendButtonsHandler,
    SendListHandler,
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
