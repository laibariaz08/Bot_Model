import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WhatsappService {
  private readonly baseURL = 'https://graph.instagram.com/v18.0';
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  private readonly accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  // Send a text message
  async sendMessage(recipientPhone: string, message: string) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'text',
          text: {
            body: message,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );
      console.log('✅ Message sent successfully:', response.data);
      return response.data;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error sending message:', errorMsg);
      throw error;
    }
  }

  // Handle incoming webhook
  processIncomingMessage(webhookData: any) {
    try {
      const messages = webhookData.entry?.[0]?.changes?.[0]?.value?.messages;

      if (!messages) return null;

      const incomingMessage = messages[0];

      return {
        from: incomingMessage.from,
        messageId: incomingMessage.id,
        timestamp: incomingMessage.timestamp,
        type: incomingMessage.type, // 'text', 'image', etc.
        text: incomingMessage.text?.body,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error processing webhook:', errorMsg);
      return null;
    }
  }

  // Mark message as read
  async markAsRead(messageId: string) {
    try {
      await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/mark_message_read`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );
      console.log('✅ Message marked as read');
    } catch (error) {
      console.error('❌ Error marking message as read:', error);
    }
  }
}
