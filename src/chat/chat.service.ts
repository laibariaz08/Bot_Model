import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // 1. Find business using WhatsApp number
  async findBusinessByPhone(phoneNumber: string) {
    return this.prisma.business.findUnique({
      where: { phoneNumber },
    });
  }

  // Find business by WhatsApp phone number id (metadata.phone_number_id)
  async findBusinessByWhatsappId(phoneNumberId: string) {
    return this.prisma.business.findFirst({
      where: { whatsappPhoneNumberId: phoneNumberId },
    });
  }

  // 2. Find or create chat — reuse the latest non-resolved chat for this phone
  async findOrCreateChat(userPhone: string, businessId: string) {
    let chat = await this.prisma.chat.findFirst({
      where: { userPhone, businessId, isResolved: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!chat) {
      chat = await this.prisma.chat.create({
        data: { userPhone, businessId },
      });
    }

    return chat;
  }

  // 3. Save message
  async saveMessage(
    chatId: string,
    sender: string,
    content: string,
    whatsappMessageId?: string,
  ) {
    return this.prisma.message.create({
      data: {
        chatId,
        sender,
        content,
        whatsappMessageId,
      },
    });
  }

  // 4. Get last messages (context for AI)
  async getChatHistory(chatId: string) {
    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  // 5. Get business knowledge
  async getKnowledge(businessId: string) {
    return this.prisma.knowledgeBase.findMany({
      where: { businessId },
    });
  }
}