import { Controller, Post, Get, Body, Query, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AiService } from '../ai/ai.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private chatService: ChatService,
    private aiService: AiService,
    private whatsappService: WhatsappService,
    private workflowEngine: WorkflowEngineService,
    private prisma: PrismaService,
  ) {}

  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') token: string,
  ) {
    const verifyToken = process.env.VERIFY_TOKEN;
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified successfully');
      return challenge;
    }
    this.logger.warn('Webhook verification failed');
    return null;
  }

  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    this.logger.log('Webhook received');

    try {
      const incomingData = this.whatsappService.processIncomingMessage(body);
      if (!incomingData) return { status: 'ok' };

      const { from, messageId, text, phoneNumberId, type, buttonId, listRowId } = incomingData;
      this.logger.log(`Message from ${from}: ${text || buttonId || listRowId}`);

      const business = await this.chatService.findBusinessByWhatsappId(phoneNumberId);
      if (!business) {
        this.logger.warn(`Business not found for phoneNumberId ${phoneNumberId}`);
        return { status: 'ok', message: 'No business found for this phone' };
      }

      const credentials = {
        phoneNumberId: business.whatsappPhoneNumberId!,
        accessToken: business.whatsappAccessToken!,
      };

      await this.whatsappService.markAsRead(messageId, credentials);

      const chat = await this.chatService.findOrCreateChat(from, business.id);
      await this.chatService.saveMessage(chat.id, 'user', text || buttonId || '[interactive]', messageId);

      // Workflow engine check
      const handledByWorkflow = await this.workflowEngine.processMessage(
        chat.id,
        business.id,
        { from, text, type, buttonId, listRowId, messageId },
      );

      if (handledByWorkflow) {
        this.logger.log('Message handled by workflow engine');
        return { status: 'ok', message: 'Handled by workflow' };
      }

      // AI fallback
      const history = await this.chatService.getChatHistory(chat.id);
      const knowledge = await this.chatService.getKnowledge(business.id);
      const aiResponse = await this.aiService.getResponse(text || '', history, knowledge);

      if (aiResponse) {
        const sendResult = await this.whatsappService.sendMessage(from, aiResponse, credentials);
        const sentId = sendResult?.messages?.[0]?.id || sendResult?.id;
        await this.chatService.saveMessage(chat.id, 'assistant', aiResponse, sentId);
        this.logger.log(`AI reply sent to ${from}`);
      }

      return { status: 'ok', message: 'Processed by AI' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error handling webhook: ${errorMessage}`);
      return { status: 'error', message: errorMessage };
    }
  }

  // Agent reply — called by the web app backend when a business owner replies to a customer
  @Post('agent-reply')
  async agentReply(@Body() body: { chatId: string; content: string }) {
    if (!body.chatId || !body.content) {
      throw new BadRequestException('chatId and content are required');
    }

    const chat = await this.prisma.chat.findUnique({
      where: { id: body.chatId },
      include: {
        business: {
          select: {
            whatsappPhoneNumberId: true,
            whatsappAccessToken: true,
            whatsappIsActive: true,
          },
        },
      },
    });

    if (!chat) throw new NotFoundException('Chat not found');

    if (!chat.business.whatsappIsActive || !chat.business.whatsappPhoneNumberId || !chat.business.whatsappAccessToken) {
      throw new BadRequestException('WhatsApp is not configured or inactive for this business');
    }

    const credentials = {
      phoneNumberId: chat.business.whatsappPhoneNumberId,
      accessToken: chat.business.whatsappAccessToken,
    };

    const sendResult = await this.whatsappService.sendMessage(chat.userPhone, body.content, credentials);
    const whatsappMessageId = sendResult?.messages?.[0]?.id;

    const message = await this.chatService.saveMessage(
      body.chatId,
      'agent',
      body.content,
      whatsappMessageId,
    );

    this.logger.log(`Agent reply sent to ${chat.userPhone} for chat ${body.chatId}`);
    return { success: true, message, whatsappMessageId };
  }

  // Test endpoint
  @Post('send-message')
  async sendMessage(@Body() body: { to: string; message: string; businessId: string }) {
    const business = await this.prisma.business.findUnique({
      where: { id: body.businessId },
      select: { whatsappPhoneNumberId: true, whatsappAccessToken: true },
    });

    if (!business?.whatsappPhoneNumberId || !business?.whatsappAccessToken) {
      throw new BadRequestException('Business WhatsApp credentials not found');
    }

    const result = await this.whatsappService.sendMessage(body.to, body.message, {
      phoneNumberId: business.whatsappPhoneNumberId,
      accessToken: business.whatsappAccessToken,
    });
    return result;
  }
}
