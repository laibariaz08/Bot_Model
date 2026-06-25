import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WhatsappService {
  // Use Meta Graph API for WhatsApp Cloud API (not Instagram Graph)
  private readonly baseURL = 'https://graph.facebook.com/v18.0';
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
      // Log axios response body when available for easier debugging
      if (axios.isAxiosError(error)) {
        console.error('❌ Error sending message:', error.response?.data || error.message);
      } else {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Error sending message:', errorMsg);
      }
      throw error;
    }
  }

  // Handle incoming webhook
  processIncomingMessage(webhookData: any) {
    try {
      const messages = webhookData.entry?.[0]?.changes?.[0]?.value?.messages;
      const phoneNumberId = webhookData.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

      if (!messages) return null;

      const incomingMessage = messages[0];

      return {
        from: incomingMessage.from,
        messageId: incomingMessage.id,
        phoneNumberId: phoneNumberId,
        timestamp: incomingMessage.timestamp,
        type: incomingMessage.type,
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
        `${this.baseURL}/${this.phoneNumberId}/messages`,
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
      if (axios.isAxiosError(error)) {
        console.error('❌ Error marking message as read:', error.response?.data || error.message);
      } else {
        console.error('❌ Error marking message as read:', error);
      }
    }
  }
}
