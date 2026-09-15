import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface InstagramCredentials {
  pageId: string;
  accessToken: string;
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);
  private readonly baseURL = 'https://graph.facebook.com/v18.0';

  /**
   * Parse an incoming Instagram webhook payload.
   * Instagram Messaging API format:
   * { object: "instagram", entry: [{ id, time, messaging: [{ sender, recipient, timestamp, message }] }] }
   */
  processIncomingMessage(webhookData: any) {
    try {
      if (webhookData.object !== 'instagram') return null;

      const entry = webhookData.entry?.[0];
      if (!entry) return null;

      const messagingEvent = entry.messaging?.[0];
      if (!messagingEvent) return null;

      const senderId = messagingEvent.sender?.id;
      const recipientId = messagingEvent.recipient?.id; // This is the Instagram page/account ID
      const timestamp = messagingEvent.timestamp;

      // Regular text message
      if (messagingEvent.message) {
        const msg = messagingEvent.message;

        // Quick reply (button tap)
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

        // Attachments (image, video, audio, file)
        if (msg.attachments && msg.attachments.length > 0) {
          const attachment = msg.attachments[0];
          return {
            senderId,
            recipientId,
            messageId: msg.mid,
            timestamp,
            type: attachment.type, // "image", "video", "audio", "file"
            text: msg.text || '',
            attachmentUrl: attachment.payload?.url,
          };
        }

        // Plain text
        return {
          senderId,
          recipientId,
          messageId: msg.mid,
          timestamp,
          type: 'text',
          text: msg.text || '',
        };
      }

      // Postback (e.g. ice-breaker tap, persistent menu)
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
      this.logger.error(`Error processing Instagram webhook: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  /**
   * Send a text message via the Instagram Send API.
   */
  async sendMessage(recipientId: string, message: string, credentials: InstagramCredentials) {
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
      this.logger.log(`Instagram message sent to ${recipientId}: ${response.data?.message_id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Error sending Instagram message: ${JSON.stringify(error.response?.data || error.message)}`);
      } else {
        this.logger.error(`Error sending Instagram message: ${error instanceof Error ? error.message : error}`);
      }
      throw error;
    }
  }

  /**
   * Send a message with quick reply buttons (Instagram's equivalent of interactive buttons).
   * Max 13 quick replies, each title max 20 chars.
   */
  async sendQuickReplies(
    recipientId: string,
    text: string,
    quickReplies: Array<{ id: string; title: string }>,
    credentials: InstagramCredentials,
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
      this.logger.log(`Instagram quick replies sent to ${recipientId}: ${response.data?.message_id}`);
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

  /**
   * Send a generic template (carousel-style) — Instagram's closest equivalent to a list message.
   */
  async sendGenericTemplate(
    recipientId: string,
    elements: Array<{ title: string; subtitle?: string }>,
    credentials: InstagramCredentials,
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
      this.logger.log(`Instagram generic template sent to ${recipientId}`);
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

  /**
   * Send a media attachment (image, video, audio, file).
   */
  async sendAttachment(
    recipientId: string,
    type: string,
    url: string,
    credentials: InstagramCredentials,
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
      this.logger.log(`Instagram attachment (${type}) sent to ${recipientId}: ${response.data?.message_id}`);
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

  /**
   * Mark a message as seen (read receipt).
   */
  async markAsSeen(recipientId: string, credentials: InstagramCredentials) {
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
