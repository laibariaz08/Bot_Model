import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ChannelAdapter,
  SendResult,
  BusinessCredentials,
  ButtonPayload,
  ListSection,
} from './channel-adapter.interface';

/**
 * WhatsAppChannelAdapter
 *
 * Implements ChannelAdapter for WhatsApp Cloud API.
 * Uses per-business credentials (from Business table) instead of global env vars.
 * Supports text, interactive button, and interactive list messages.
 * Saves outgoing messages to the Message table for chat history.
 */
@Injectable()
export class WhatsAppChannelAdapter implements ChannelAdapter {
  private readonly logger = new Logger(WhatsAppChannelAdapter.name);
  private readonly baseURL = 'https://graph.facebook.com/v18.0';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Set the chatId for the current execution context.
   * When set, all outgoing messages are automatically saved to the Message table.
   */
  private currentChatId: string | null = null;

  setChatId(chatId: string | null) {
    this.currentChatId = chatId;
  }

  private async saveOutgoingMessage(
    content: string,
    messageType: string,
    metadata: any,
    whatsappMessageId?: string,
  ) {
    if (!this.currentChatId) return;
    try {
      await this.prisma.message.create({
        data: {
          chatId: this.currentChatId,
          sender: 'assistant',
          content,
          messageType,
          metadata: metadata || undefined,
          whatsappMessageId,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to save outgoing message: ${err}`);
    }
  }

  // ─── Text Message ──────────────────────────────────────

  async sendTextMessage(
    to: string,
    text: string,
    credentials: BusinessCredentials,
  ): Promise<SendResult> {
    try {
      const response = await axios.post(
        `${this.baseURL}/${credentials.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body: text },
        },
        { headers: { Authorization: `Bearer ${credentials.accessToken}` } },
      );

      const messageId = response.data?.messages?.[0]?.id;
      this.logger.log(`Text message sent to ${to}: ${messageId}`);
      await this.saveOutgoingMessage(text, 'text', null, messageId);
      return { success: true, messageId };
    } catch (error) {
      return this.handleError('sendTextMessage', error);
    }
  }

  // ─── Button Message ────────────────────────────────────

  async sendButtonMessage(
    to: string,
    body: string,
    buttons: ButtonPayload[],
    credentials: BusinessCredentials,
    footer?: string,
  ): Promise<SendResult> {
    // WhatsApp validation
    if (buttons.length === 0 || buttons.length > 3) {
      return { success: false, error: `Button count must be 1-3, got ${buttons.length}` };
    }
    for (const btn of buttons) {
      if (btn.title.length > 20) {
        return { success: false, error: `Button title "${btn.title}" exceeds 20 chars` };
      }
    }
    if (body.length > 1024) {
      return { success: false, error: 'Button message body exceeds 1024 chars' };
    }

    try {
      const interactive: any = {
        type: 'button',
        body: { text: body },
        action: {
          buttons: buttons.map((btn) => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title },
          })),
        },
      };

      if (footer) {
        interactive.footer = { text: footer.slice(0, 60) };
      }

      const response = await axios.post(
        `${this.baseURL}/${credentials.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'interactive',
          interactive,
        },
        { headers: { Authorization: `Bearer ${credentials.accessToken}` } },
      );

      const messageId = response.data?.messages?.[0]?.id;
      this.logger.log(`Button message sent to ${to}: ${messageId}`);
      await this.saveOutgoingMessage(
        body,
        'interactive_button',
        { buttons: buttons.map((b) => ({ id: b.id, title: b.title })), footer },
        messageId,
      );
      return { success: true, messageId };
    } catch (error) {
      return this.handleError('sendButtonMessage', error);
    }
  }

  // ─── List Message ──────────────────────────────────────

  async sendListMessage(
    to: string,
    body: string,
    buttonText: string,
    sections: ListSection[],
    credentials: BusinessCredentials,
    footer?: string,
  ): Promise<SendResult> {
    // WhatsApp validation
    const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);
    if (totalRows > 10) {
      return { success: false, error: `Total list rows ${totalRows} exceeds max 10` };
    }
    if (buttonText.length > 20) {
      return { success: false, error: 'List button text exceeds 20 chars' };
    }
    for (const section of sections) {
      for (const row of section.rows) {
        if (row.title.length > 24) {
          return { success: false, error: `Row title "${row.title}" exceeds 24 chars` };
        }
        if (row.description && row.description.length > 72) {
          return { success: false, error: `Row description exceeds 72 chars` };
        }
      }
    }

    try {
      const interactive: any = {
        type: 'list',
        body: { text: body },
        action: {
          button: buttonText,
          sections: sections.map((s) => ({
            title: s.title,
            rows: s.rows.map((r) => ({
              id: r.id,
              title: r.title,
              ...(r.description ? { description: r.description } : {}),
            })),
          })),
        },
      };

      if (footer) {
        interactive.footer = { text: footer.slice(0, 60) };
      }

      const response = await axios.post(
        `${this.baseURL}/${credentials.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'interactive',
          interactive,
        },
        { headers: { Authorization: `Bearer ${credentials.accessToken}` } },
      );

      const messageId = response.data?.messages?.[0]?.id;
      this.logger.log(`List message sent to ${to}: ${messageId}`);
      await this.saveOutgoingMessage(
        body,
        'interactive_list',
        { buttonText, sections },
        messageId,
      );
      return { success: true, messageId };
    } catch (error) {
      return this.handleError('sendListMessage', error);
    }
  }

  // ─── Helpers ───────────────────────────────────────────

  private handleError(method: string, error: any): SendResult {
    const msg = axios.isAxiosError(error)
      ? JSON.stringify(error.response?.data || error.message)
      : error instanceof Error
        ? error.message
        : 'Unknown error';

    this.logger.error(`${method} failed: ${msg}`);
    return { success: false, error: msg };
  }
}
