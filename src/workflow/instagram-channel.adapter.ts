import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InstagramService } from '../instagram/instagram.service';
import type {
  ChannelAdapter,
  SendResult,
  BusinessCredentials,
  ButtonPayload,
  ListSection,
} from './channel-adapter.interface';

/**
 * InstagramChannelAdapter
 *
 * Implements ChannelAdapter for Instagram Messaging API.
 * Maps WhatsApp-style buttons to Instagram quick replies,
 * and list messages to formatted text (Instagram doesn't support list-style interactive messages).
 */
@Injectable()
export class InstagramChannelAdapter implements ChannelAdapter {
  private readonly logger = new Logger(InstagramChannelAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly instagram: InstagramService,
  ) {}

  private currentChatId: string | null = null;

  setChatId(chatId: string | null) {
    this.currentChatId = chatId;
  }

  private async saveOutgoingMessage(
    content: string,
    messageType: string,
    metadata: any,
    externalMessageId?: string,
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
          whatsappMessageId: externalMessageId,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to save outgoing message: ${err}`);
    }
  }

  private toInstagramCredentials(credentials: BusinessCredentials) {
    return {
      pageId: credentials.phoneNumberId,
      accessToken: credentials.accessToken,
    };
  }

  // ─── Text Message ──────────────────────────────────────

  async sendTextMessage(
    to: string,
    text: string,
    credentials: BusinessCredentials,
  ): Promise<SendResult> {
    try {
      const igCreds = this.toInstagramCredentials(credentials);
      const response = await this.instagram.sendMessage(to, text, igCreds);
      const messageId = response?.message_id;
      await this.saveOutgoingMessage(text, 'text', null, messageId);
      return { success: true, messageId };
    } catch (error) {
      return this.handleError('sendTextMessage', error);
    }
  }

  // ─── Button Message → Quick Replies ────────────────────

  async sendButtonMessage(
    to: string,
    body: string,
    buttons: ButtonPayload[],
    credentials: BusinessCredentials,
    footer?: string,
  ): Promise<SendResult> {
    try {
      const igCreds = this.toInstagramCredentials(credentials);
      // Instagram supports up to 13 quick replies
      const quickReplies = buttons.slice(0, 13);
      const response = await this.instagram.sendQuickReplies(to, body, quickReplies, igCreds);
      const messageId = response?.message_id;
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

  // ─── List Message → Numbered Text (Instagram has no list UI) ───

  async sendListMessage(
    to: string,
    body: string,
    buttonText: string,
    sections: ListSection[],
    credentials: BusinessCredentials,
    footer?: string,
  ): Promise<SendResult> {
    try {
      const igCreds = this.toInstagramCredentials(credentials);

      // Build a numbered text representation since Instagram doesn't have list messages.
      // Then send quick replies for the options so user can tap to select.
      const allRows = sections.flatMap((s) => s.rows);
      const lines = [body, ''];
      allRows.forEach((row, i) => {
        const desc = row.description ? ` — ${row.description}` : '';
        lines.push(`${i + 1}. ${row.title}${desc}`);
      });
      const textMessage = lines.join('\n');

      // Use quick replies for the first 13 items so the user can tap
      const quickReplies = allRows.slice(0, 13).map((row) => ({
        id: row.id,
        title: row.title.slice(0, 20),
      }));

      const response = await this.instagram.sendQuickReplies(to, textMessage, quickReplies, igCreds);
      const messageId = response?.message_id;
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
    const msg = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(`${method} failed: ${msg}`);
    return { success: false, error: msg };
  }
}
