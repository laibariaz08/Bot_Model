import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { NodeHandler, WorkflowNode, ExecutionContext, IncomingMessage, NodeResult } from '../node-handler.interface';
import { VariableResolver } from '../variable-resolver.service';

@Injectable()
export class SendCatalogHandler implements NodeHandler {
  private readonly logger = new Logger(SendCatalogHandler.name);

  constructor(
    private readonly variables: VariableResolver,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    node: WorkflowNode,
    ctx: ExecutionContext,
    _input?: IncomingMessage,
  ): Promise<NodeResult> {
    const config = node.config || {};
    const mode: string = config.catalogMode || 'view_catalog';

    const resolveCtx = this.variables.buildContext(
      ctx.session.variables,
      { phone: ctx.customerPhone },
      {},
      ctx.businessName,
    );

    const body = this.variables.resolveText(config.body || '', resolveCtx);
    const footer = config.footer ? this.variables.resolveText(config.footer, resolveCtx) : undefined;

    if (!body) {
      return { status: 'CONTINUE', outputHandle: '__default', output: { skipped: 'no body text' } };
    }

    const business = await this.prisma.business.findUnique({
      where: { id: ctx.session.businessId },
      select: { whatsappCatalogId: true },
    });

    const catalogId = business?.whatsappCatalogId;

    if (mode === 'view_catalog') {
      const thumbnailProductId = config.thumbnailUrl || undefined;
      const result = await ctx.channel.sendCatalogMessage(
        ctx.customerPhone,
        body,
        ctx.credentials,
        footer,
        thumbnailProductId,
      );

      if (!result.success) {
        return { status: 'ERROR', error: result.error, output: { mode } };
      }
      return { status: 'CONTINUE', outputHandle: '__default', output: { mode, messageId: result.messageId } };
    }

    if (!catalogId) {
      this.logger.warn(`Business ${ctx.session.businessId} has no whatsappCatalogId configured`);
      return { status: 'ERROR', error: 'No catalog ID configured for this business', output: { mode } };
    }

    if (mode === 'single_product') {
      const productRetailerId = config.productRetailerId || '';
      if (!productRetailerId) {
        return { status: 'CONTINUE', outputHandle: '__default', output: { skipped: 'no product ID' } };
      }

      const result = await ctx.channel.sendSingleProductMessage(
        ctx.customerPhone,
        body,
        catalogId,
        productRetailerId,
        ctx.credentials,
        footer,
      );

      if (!result.success) {
        return { status: 'ERROR', error: result.error, output: { mode, productRetailerId } };
      }
      return { status: 'CONTINUE', outputHandle: '__default', output: { mode, productRetailerId, messageId: result.messageId } };
    }

    if (mode === 'product_list') {
      const sections = config.sections || [];
      if (sections.length === 0) {
        return { status: 'CONTINUE', outputHandle: '__default', output: { skipped: 'no product sections' } };
      }

      const result = await ctx.channel.sendProductListMessage(
        ctx.customerPhone,
        body,
        catalogId,
        sections,
        ctx.credentials,
        undefined,
        footer,
      );

      if (!result.success) {
        return { status: 'ERROR', error: result.error, output: { mode } };
      }
      return { status: 'CONTINUE', outputHandle: '__default', output: { mode, messageId: result.messageId } };
    }

    return { status: 'ERROR', error: `Unknown catalog mode: ${mode}`, output: { mode } };
  }
}
