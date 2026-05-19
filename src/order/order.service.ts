// import { Injectable } from '@nestjs/common';
// import { ConversationService } from '../conversation/conversation.service';

// @Injectable()
// export class OrderService {
//   constructor(private convo: ConversationService) {}

//   async handle(userPhone: string, businessId: number, message: string) {
//     const state = await this.convo.getState(userPhone, businessId);

//     // STEP 1 → Start flow
//     if (!state) {
//       await this.convo.setState(userPhone, businessId, 'SELECT_CATEGORY', {});
//       return "What would you like to order?\n1. Pizza\n2. Burger\n3. Drinks";
//     }

//     // STEP 2 → Category selected
//     if (state.step === 'SELECT_CATEGORY') {
//       const category = message.toLowerCase();

//       await this.convo.setState(userPhone, businessId, 'SELECT_PRODUCT', { category });

//       return `Select ${category}:\n1. Fajita\n2. BBQ\n3. Pepperoni`;
//     }

//     // STEP 3 → Product selected
//     if (state.step === 'SELECT_PRODUCT') {
//       const product = message;

//       await this.convo.setState(userPhone, businessId, 'SELECT_SIZE', {
//         ...(state.data as Record<string, any>),
//         product,
//       });

//       return "Select size:\n1. Small\n2. Medium\n3. Large";
//     }

//     // STEP 4 → Size selected
//     if (state.step === 'SELECT_SIZE') {
//       const size = message;

//       await this.convo.setState(userPhone, businessId, 'ASK_LOCATION', {
//         ...(state.data as Record<string, any>),
//         size,
//       });

//       return "Please enter delivery location:";
//     }

//     // STEP 5 → Location
//     if (state.step === 'ASK_LOCATION') {
//       const location = message;

//       const order = {
//         ...(state.data as Record<string, any>),
//         location,
//       };

//       await this.convo.clearState(userPhone, businessId);

//       return `Order Confirmed:\n${order.product} (${order.size})\nLocation: ${location}`;
//     }

//     return "Something went wrong.";
//   }
// }