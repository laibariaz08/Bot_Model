import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  async getResponse(message: string, history: any[] = [], knowledge: any[] = []) {
    // Build system prompt with business instructions and knowledge base
    const kbText = knowledge && knowledge.length
      ? knowledge.map((k, i) => `KB${i + 1}: ${k.content}`).join('\n')
      : '';

    const systemMessages: any[] = [
      { role: 'system', content: 'You are a helpful business assistant. Answer politely and concisely.' },
    ];

    if (kbText) {
      systemMessages.push({ role: 'system', content: `Business knowledge:\n${kbText}` });
    }

    // Convert chat history (assumed newest-first) to chronological messages
    const historyMessages = (history || [])
      .slice()
      .reverse()
      .map(h => ({ role: h.sender === 'assistant' ? 'assistant' : 'user', content: h.content }));

    const messages = [
      ...systemMessages,
      ...historyMessages,
      { role: 'user', content: message },
    ];

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
    });

    return completion.choices[0].message.content;
  }
}




// import { Injectable } from '@nestjs/common';
// import axios from 'axios';

// @Injectable()
// export class AiService {
//   async getResponse(message: string, knowledge: any[]) {
//     const context = knowledge.map(k => k.content).join('\n');

//     const prompt = `
// You are a helpful assistant for a business.

// Use the following business information to answer the user:

// ${context}

// User Question:
// ${message}

// Answer clearly:
// `;

//     try {
//       const response = await axios.post('http://localhost:11434/api/generate', {
//         model: 'llama3',
//         prompt: prompt,
//         stream: false,
//       });

//       return response.data.response;
//     } catch (error) {
//       console.error(error);
//       return "Error connecting to AI";
//     }
//   }


//   async detectIntent(message: string) {
//   const prompt = `
// You are an AI that detects user intent.

// Return ONLY JSON:

// {
//   "intent": ""
// }

// Possible intents:
// - faq
// - order_food
// - book_appointment

// Rules:
// - If user wants to buy/order → order_food
// - If asking general question → faq
// - If booking → book_appointment

// User: "${message}"
// `;

//   const res = await axios.post('http://localhost:11434/api/generate', {
//     model: 'llama3',
//     prompt,
//     stream: false,
//   });

//   try {
//     return JSON.parse(res.data.response);
//   } catch {
//     return { intent: 'faq' };
//   }
// }



// }











//HARDCODED

// // import { Injectable, NotFoundException } from '@nestjs/common';

// // @Injectable()
// // export class AiService {
// //   async getResponse(message: string, knowledge: any[], aiinput: string) {
// //     const lowerMsg = message.toLowerCase();

// //     // Try to match keywords from knowledge
// //     for (const item of knowledge) {
// //       const content = item.content.toLowerCase();

// //       // simple keyword match
// //       if (lowerMsg.includes('deal') && content.includes('deal')) {
// //         return item.content;
// //       }

// //       if (lowerMsg.includes('deliver') && content.includes('deliver')) {
// //         return item.content;
// //       }

// //       if (lowerMsg.includes('timings') && content.includes('open')) {
// //         return item.content;
// //       }
// //     }
// //     throw new NotFoundException('No relevant response found');
// //   }
// // }