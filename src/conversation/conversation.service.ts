// import { Injectable } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service';

// @Injectable()
// export class ConversationService {
//   constructor(private prisma: PrismaService) {}

//   async getState(userPhone: string, businessId: number) {
//     return this.prisma.conversationState.findFirst({
//       where: { userPhone, businessId },
//     });
//   }

//   async setState(userPhone: string, businessId: number, step: string, data: any) {
//     const existing = await this.getState(userPhone, businessId);

//     if (existing) {
//       return this.prisma.conversationState.update({
//         where: { id: existing.id },
//         data: { step, data },
//       });
//     }

//     return this.prisma.conversationState.create({
//       data: { userPhone, businessId, step, data },
//     });
//   }

//   async clearState(userPhone: string, businessId: number) {
//     return this.prisma.conversationState.deleteMany({
//       where: { userPhone, businessId },
//     });
//   }
// }