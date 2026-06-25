import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AiService } from '../ai/ai.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Controller('chat')
export class ChatController {
  constructor(
    private chatService: ChatService,
    private aiService: AiService,
    private whatsappService: WhatsappService,
  ) {}

  // Webhook verification (GET request from Meta)
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') token: string,
  ) {
    const verifyToken = process.env.VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook verified successfully');
      return challenge;
    } else {
      console.log('❌ Webhook verification failed');
      return null;
    }
  }

  // Receive incoming messages (POST request from Meta)
  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    console.log('📨 Webhook received:', JSON.stringify(body, null, 2));

    try {
      // Extract incoming message
      const incomingData = this.whatsappService.processIncomingMessage(body);

      if (!incomingData) {
        return { status: 'ok' };
      }

      const { from, messageId, text, phoneNumberId, type } = incomingData;

      console.log(`📱 Message from ${from}: ${text}`);

      // Mark message as read
      await this.whatsappService.markAsRead(messageId);

      // Find business by the phone_number_id in webhook metadata
      const business = await this.chatService.findBusinessByWhatsappId(
        phoneNumberId,
      );

      if (!business) {
        console.warn('⚠️ Business not found for phoneNumberId', phoneNumberId);
        return { status: 'ok', message: 'No business found for this phone' };
      }

      // Find or create chat for this user and business
      const chat = await this.chatService.findOrCreateChat(from, business.id);

      const history = await this.chatService.getChatHistory(chat.id);
      const knowledge = await this.chatService.getKnowledge(business.id);

      // Persist incoming user message
await this.chatService.saveMessage(chat.id, 'user', `${text} [busineess_id:${business.id}]`, messageId);


      // Get AI response with chat history and business knowledge
      const aiResponse = await this.aiService.getResponse(text, history, knowledge);

      // Send response back to user and save assistant message
      if (aiResponse) {
        const sendResult = await this.whatsappService.sendMessage(from, aiResponse);
        // try to extract whatsapp message id from provider response
        const sentId = sendResult?.messages?.[0]?.id || sendResult?.id;
        await this.chatService.saveMessage(chat.id, 'assistant', aiResponse, sentId);
        console.log(`✅ Reply sent to ${from}`);
      }

      return { status: 'ok', message: 'Processed' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error handling webhook:', errorMessage, error instanceof Error ? error.stack : '');
      return { status: 'error', message: errorMessage };
    }
  }

  // Test endpoint - Send message directly
  @Post('send-message')
  async sendMessage(@Body() body: { to: string; message: string }) {
    const result = await this.whatsappService.sendMessage(
      body.to,
      body.message,
    );
    return result;
  }
}

















// import { Controller, Post, Body } from '@nestjs/common';
// import { ChatService } from './chat.service';
// import { AiService } from '../ai/ai.service';
// import { OrderService } from '../order/order.service';
// import { PrismaService } from '../prisma/prisma.service';
// import { ConversationService } from '../conversation/conversation.service';


// @Controller('chat')
// export class ChatController {
//   constructor(
//     private chatService: ChatService,
//     private aiService: AiService,
//     private orderService: OrderService,
//     private prisma: PrismaService,
//     private convo: ConversationService
//   ) {}

// @Post('webhook')
// async handleMessage(@Body() body: any) {
//   const { message, userPhone, businessPhone } = body;

//   const business = await this.prisma.business.findFirst({
//     where: { phoneNumber: businessPhone },
//   });
//   if (!business) {
//   throw new Error("Business not found");
// }

//   // 1. Check existing funnel
//   const state = await this.convo.getState(userPhone, business.id);

//   if (state) {
//     return {
//       reply: await this.orderService.handle(userPhone, business.id, message),
//     };
//   }

//   // 2. Detect intent
//   const aiResult = await this.aiService.detectIntent(message);

//   // 3. Route
//   if (aiResult.intent === 'order_food') {
//     return {
//       reply: await this.orderService.handle(userPhone, business.id, message),
//     };
//   }

//   // 4. FAQ
//   const knowledge = await this.prisma.knowledgeBase.findMany({
//     where: { businessId: business.id },
//   });

//   const reply = await this.aiService.getResponse(message, knowledge);

//   return { reply };
// }



// }