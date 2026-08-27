import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly baseURL = 'https://graph.facebook.com/v18.0';

  async sendMessage(recipientPhone: string, message: string, credentials: WhatsAppCredentials) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${credentials.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'text',
          text: { body: message },
        },
        {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        },
      );
      this.logger.log(`Message sent to ${recipientPhone}: ${response.data?.messages?.[0]?.id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Error sending message: ${JSON.stringify(error.response?.data || error.message)}`);
      } else {
        this.logger.error(`Error sending message: ${error instanceof Error ? error.message : error}`);
      }
      throw error;
    }
  }

  processIncomingMessage(webhookData: any) {
    try {
      const messages = webhookData.entry?.[0]?.changes?.[0]?.value?.messages;
      const phoneNumberId = webhookData.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

      if (!messages) return null;

      const incomingMessage = messages[0];

      let text = incomingMessage.text?.body;
      let buttonId: string | undefined;
      let listRowId: string | undefined;

      if (incomingMessage.type === 'interactive') {
        const interactive = incomingMessage.interactive;
        if (interactive?.type === 'button_reply') {
          buttonId = interactive.button_reply?.id;
          text = interactive.button_reply?.title || buttonId;
        } else if (interactive?.type === 'list_reply') {
          listRowId = interactive.list_reply?.id;
          text = interactive.list_reply?.title || listRowId;
        }
      }

      return {
        from: incomingMessage.from,
        messageId: incomingMessage.id,
        phoneNumberId,
        timestamp: incomingMessage.timestamp,
        type: incomingMessage.type,
        text,
        buttonId,
        listRowId,
        interactiveType: incomingMessage.interactive?.type,
      };
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  async markAsRead(messageId: string, credentials: WhatsAppCredentials) {
    try {
      await axios.post(
        `${this.baseURL}/${credentials.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
        {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        },
      );
      this.logger.log(`Message ${messageId} marked as read`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Error marking as read: ${error.response?.data || error.message}`);
      } else {
        this.logger.error(`Error marking as read: ${error}`);
      }
    }
  }
}
