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

  // Find business by Instagram page ID
  async findBusinessByInstagramId(pageId: string) {
    return this.prisma.business.findFirst({
      where: { instagramPageId: pageId },
    });
  }

  // Find business by Messenger page ID
  async findBusinessByMessengerId(pageId: string) {
    return this.prisma.business.findFirst({
      where: { messengerPageId: pageId },
    });
  }

  // 2. Find or create chat — reuse the latest non-resolved chat for this phone
  async findOrCreateChat(userPhone: string, businessId: string) {
    let chat = await this.prisma.chat.findFirst({
      where: { userPhone, businessId, isResolved: false, channel: 'whatsapp' },
      orderBy: { createdAt: 'desc' },
    });

    if (!chat) {
      chat = await this.prisma.chat.create({
        data: { userPhone, businessId, channel: 'whatsapp' },
      });
    }

    return chat;
  }

  // Find or create Instagram chat — keyed by IGSID (Instagram-scoped user ID)
  async findOrCreateInstagramChat(igsid: string, businessId: string) {
    let chat = await this.prisma.chat.findFirst({
      where: { userIdentifier: igsid, businessId, isResolved: false, channel: 'instagram' },
      orderBy: { createdAt: 'desc' },
    });

    if (!chat) {
      chat = await this.prisma.chat.create({
        data: {
          userPhone: igsid,
          userIdentifier: igsid,
          businessId,
          channel: 'instagram',
        },
      });
    }

    return chat;
  }

  // Find or create Messenger chat — keyed by page-scoped sender ID
  async findOrCreateMessengerChat(senderId: string, businessId: string) {
    let chat = await this.prisma.chat.findFirst({
      where: { userIdentifier: senderId, businessId, isResolved: false, channel: 'messenger' },
      orderBy: { createdAt: 'desc' },
    });

    if (!chat) {
      chat = await this.prisma.chat.create({
        data: {
          userPhone: senderId,
          userIdentifier: senderId,
          businessId,
          channel: 'messenger',
        },
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