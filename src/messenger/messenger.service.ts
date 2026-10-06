import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface MessengerCredentials {
  pageId: string;
  accessToken: string;
}

@Injectable()
export class MessengerService {
  private readonly logger = new Logger(MessengerService.name);
  private readonly baseURL = 'https://graph.facebook.com/v18.0';

  processIncomingMessage(webhookData: any) {
    try {
      if (webhookData.object !== 'page') return null;

      const entry = webhookData.entry?.[0];
      if (!entry) return null;

      const messagingEvent = entry.messaging?.[0];
      if (!messagingEvent) return null;

      const senderId = messagingEvent.sender?.id;
      const recipientId = messagingEvent.recipient?.id;
      const timestamp = messagingEvent.timestamp;

      if (messagingEvent.message) {
        const msg = messagingEvent.message;

        if (msg.quick_reply) {
          return {
            senderId,
            recipientId,
            messageId: msg.mid,
            timestamp,
            type: 'quick_reply',
            text: msg.text || '',
            quickReplyPayload: msg.quick_reply.payload,
          };
        }

        if (msg.attachments && msg.attachments.length > 0) {
          const attachment = msg.attachments[0];
          return {
            senderId,
            recipientId,
            messageId: msg.mid,
            timestamp,
            type: attachment.type,
            text: msg.text || '',
            attachmentUrl: attachment.payload?.url,
          };
        }

        return {
          senderId,
          recipientId,
          messageId: msg.mid,
          timestamp,
          type: 'text',
          text: msg.text || '',
        };
      }

      if (messagingEvent.postback) {
        return {
          senderId,
          recipientId,
          messageId: null,
          timestamp,
          type: 'postback',
          text: messagingEvent.postback.title || '',
          quickReplyPayload: messagingEvent.postback.payload,
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Error processing Messenger webhook: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  async sendMessage(recipientId: string, message: string, credentials: MessengerCredentials) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${credentials.pageId}/messages`,
        {
          recipient: { id: recipientId },
          message: { text: message },
        },
        {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        },
      );
      this.logger.log(`Messenger message sent to ${recipientId}: ${response.data?.message_id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Error sending Messenger message: ${JSON.stringify(error.response?.data || error.message)}`);
      } else {
        this.logger.error(`Error sending Messenger message: ${error instanceof Error ? error.message : error}`);
      }
      throw error;
    }
  }

  async sendQuickReplies(
    recipientId: string,
    text: string,
    quickReplies: Array<{ id: string; title: string }>,
    credentials: MessengerCredentials,
  ) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${credentials.pageId}/messages`,
        {
          recipient: { id: recipientId },
          message: {
            text,
            quick_replies: quickReplies.map((qr) => ({
              content_type: 'text',
              title: qr.title.slice(0, 20),
              payload: qr.id,
            })),
          },
        },
        {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        },
      );
      this.logger.log(`Messenger quick replies sent to ${recipientId}: ${response.data?.message_id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Error sending quick replies: ${JSON.stringify(error.response?.data || error.message)}`);
      } else {
        this.logger.error(`Error sending quick replies: ${error instanceof Error ? error.message : error}`);
      }
      throw error;
    }
  }

  async sendGenericTemplate(
    recipientId: string,
    elements: Array<{ title: string; subtitle?: string }>,
    credentials: MessengerCredentials,
  ) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${credentials.pageId}/messages`,
        {
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'generic',
                elements: elements.map((el) => ({
                  title: el.title,
                  subtitle: el.subtitle || '',
                })),
              },
            },
          },
        },
        {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        },
      );
      this.logger.log(`Messenger generic template sent to ${recipientId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Error sending template: ${JSON.stringify(error.response?.data || error.message)}`);
      } else {
        this.logger.error(`Error sending template: ${error instanceof Error ? error.message : error}`);
      }
      throw error;
    }
  }

  async sendAttachment(
    recipientId: string,
    type: string,
    url: string,
    credentials: MessengerCredentials,
  ) {
    try {
      const response = await axios.post(
        `${this.baseURL}/${credentials.pageId}/messages`,
        {
          recipient: { id: recipientId },
          message: {
            attachment: {
              type,
              payload: { url, is_reusable: true },
            },
          },
        },
        {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        },
      );
      this.logger.log(`Messenger attachment (${type}) sent to ${recipientId}: ${response.data?.message_id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Error sending attachment: ${JSON.stringify(error.response?.data || error.message)}`);
      } else {
        this.logger.error(`Error sending attachment: ${error instanceof Error ? error.message : error}`);
      }
      throw error;
    }
  }

  async markAsSeen(recipientId: string, credentials: MessengerCredentials) {
    try {
      await axios.post(
        `${this.baseURL}/${credentials.pageId}/messages`,
        {
          recipient: { id: recipientId },
          sender_action: 'mark_seen',
        },
        {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        },
      );
    } catch (error) {
      this.logger.warn(`Failed to mark as seen: ${error instanceof Error ? error.message : error}`);
    }
  }
}
