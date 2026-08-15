import { Injectable } from '@nestjs/common';
import type { NodeHandler, WorkflowNode, ExecutionContext, IncomingMessage, NodeResult } from '../node-handler.interface';
import { VariableResolver } from '../variable-resolver.service';
import { WhatsAppChannelAdapter } from '../whatsapp-channel.adapter';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * HumanHandoverHandler
 *
 * Stops automated workflow execution and transfers the conversation
 * to a human agent. Sends an optional message to the customer,
 * sets Chat.isRequesting = true for the dashboard to pick up.
 *
 * Config: { message?: string, assignTo?: string, priority?: 'low'|'medium'|'high' }
 * Outputs: None (terminal node)
 */
@Injectable()
export class HumanHandoverHandler implements NodeHandler {
  constructor(
    private readonly variables: VariableResolver,
    private readonly channel: WhatsAppChannelAdapter,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    node: WorkflowNode,
    ctx: ExecutionContext,
    _input?: IncomingMessage,
  ): Promise<NodeResult> {
    const config = node.config || {};

    // Send optional handover message to customer
    if (config.message) {
      const resolveCtx = this.variables.buildContext(
        ctx.session.variables,
        { phone: ctx.customerPhone },
        {},
        ctx.businessName,
      );
      const message = this.variables.resolveText(config.message, resolveCtx);

      await this.channel.sendTextMessage(
        ctx.customerPhone,
        message,
        ctx.credentials,
      );
    }

    // Mark the chat as requesting human agent
    await this.prisma.chat.update({
      where: { id: ctx.session.chatId },
      data: { isRequesting: true },
    });

    return {
      status: 'HANDOVER',
      output: {
        assignTo: config.assignTo || null,
        priority: config.priority || 'medium',
      },
    };
  }
}
