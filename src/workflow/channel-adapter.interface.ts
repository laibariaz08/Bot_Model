/**
 * ChannelAdapter interface
 *
 * Decouples the workflow engine from any specific messaging platform.
 * Each channel (WhatsApp, Instagram, Telegram, etc.) implements this interface.
 */

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BusinessCredentials {
  phoneNumberId: string;
  accessToken: string;
}

export interface ButtonPayload {
  id: string;
  title: string;
}

export interface ListSection {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

export interface ChannelAdapter {
  sendTextMessage(
    to: string,
    text: string,
    credentials: BusinessCredentials,
  ): Promise<SendResult>;

  sendButtonMessage(
    to: string,
    body: string,
    buttons: ButtonPayload[],
    credentials: BusinessCredentials,
    footer?: string,
  ): Promise<SendResult>;

  sendListMessage(
    to: string,
    body: string,
    buttonText: string,
    sections: ListSection[],
    credentials: BusinessCredentials,
    footer?: string,
  ): Promise<SendResult>;
}
