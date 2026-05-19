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

  // 2. Find or create chat
  async findOrCreateChat(userPhone: string, businessId: number) {
    let chat = await this.prisma.chat.findFirst({
      where: {
        userPhone,
        businessId,
      },
    });

    if (!chat) {
      chat = await this.prisma.chat.create({
        data: {
          userPhone,
          businessId,
        },
      });
    }

    return chat;
  }

  // 3. Save message
  async saveMessage(chatId: number, sender: string, content: string) {
    return this.prisma.message.create({
      data: {
        chatId,
        sender,
        content,
      },
    });
  }

  // 4. Get last messages (context for AI)
  async getChatHistory(chatId: number) {
    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  // 5. Get business knowledge
  async getKnowledge(businessId: number) {
    return this.prisma.knowledgeBase.findMany({
      where: { businessId },
    });
  }
}