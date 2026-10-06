import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessengerService } from '../messenger/messenger.service';
import type {
  ChannelAdapter,
  SendResult,
  BusinessCredentials,
  ButtonPayload,
  ListSection,
  MediaPayload,
} from './channel-adapter.interface';

@Injectable()
export class MessengerChannelAdapter implements ChannelAdapter {
  private readonly logger = new Logger(MessengerChannelAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messenger: MessengerService,
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

  private toMessengerCredentials(credentials: BusinessCredentials) {
    return {
      pageId: credentials.phoneNumberId,
      accessToken: credentials.accessToken,
    };
  }

  async sendTextMessage(
    to: string,
    text: string,
    credentials: BusinessCredentials,
  ): Promise<SendResult> {
    try {
      const msgCreds = this.toMessengerCredentials(credentials);
      const response = await this.messenger.sendMessage(to, text, msgCreds);
      const messageId = response?.message_id;
      await this.saveOutgoingMessage(text, 'text', null, messageId);
      return { success: true, messageId };
    } catch (error) {
      return this.handleError('sendTextMessage', error);
    }
  }

  async sendButtonMessage(
    to: string,
    body: string,
    buttons: ButtonPayload[],
    credentials: BusinessCredentials,
    footer?: string,
  ): Promise<SendResult> {
    try {
      const msgCreds = this.toMessengerCredentials(credentials);
      const quickReplies = buttons.slice(0, 13);
      const response = await this.messenger.sendQuickReplies(to, body, quickReplies, msgCreds);
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

  async sendListMessage(
    to: string,
    body: string,
    buttonText: string,
    sections: ListSection[],
    credentials: BusinessCredentials,
    footer?: string,
  ): Promise<SendResult> {
    try {
      const msgCreds = this.toMessengerCredentials(credentials);

      const allRows = sections.flatMap((s) => s.rows);
      const lines = [body, ''];
      allRows.forEach((row, i) => {
        const desc = row.description ? ` — ${row.description}` : '';
        lines.push(`${i + 1}. ${row.title}${desc}`);
      });
      const textMessage = lines.join('\n');

      const quickReplies = allRows.slice(0, 13).map((row) => ({
        id: row.id,
        title: row.title.slice(0, 20),
      }));

      const response = await this.messenger.sendQuickReplies(to, textMessage, quickReplies, msgCreds);
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

  async sendMediaMessage(
    to: string,
    media: MediaPayload,
    credentials: BusinessCredentials,
  ): Promise<SendResult> {
    try {
      const msgCreds = this.toMessengerCredentials(credentials);
      const msgType = media.type === 'document' ? 'file' : media.type;
      const response = await this.messenger.sendAttachment(to, msgType, media.url, msgCreds);
      const messageId = response?.message_id;
      await this.saveOutgoingMessage(
        media.caption || `[${media.type}]`,
        media.type,
        { url: media.url, filename: media.filename },
        messageId,
      );
      if (media.caption) {
        await this.messenger.sendMessage(to, media.caption, msgCreds);
      }
      return { success: true, messageId };
    } catch (error) {
      return this.handleError('sendMediaMessage', error);
    }
  }

  private handleError(method: string, error: any): SendResult {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(`${method} failed: ${msg}`);
    return { success: false, error: msg };
  }
}
