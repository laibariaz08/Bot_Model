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

export interface MediaPayload {
  type: 'image' | 'document' | 'video' | 'audio';
  url: string;
  caption?: string;
  filename?: string;
}

export interface CatalogProductItem {
  productRetailerId: string;
}

export interface CatalogSection {
  title: string;
  productItems: CatalogProductItem[];
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

  sendMediaMessage(
    to: string,
    media: MediaPayload,
    credentials: BusinessCredentials,
  ): Promise<SendResult>;

  sendCatalogMessage(
    to: string,
    body: string,
    credentials: BusinessCredentials,
    footer?: string,
    thumbnailProductId?: string,
  ): Promise<SendResult>;

  sendProductListMessage(
    to: string,
    body: string,
    catalogId: string,
    sections: CatalogSection[],
    credentials: BusinessCredentials,
    header?: string,
    footer?: string,
  ): Promise<SendResult>;

  sendSingleProductMessage(
    to: string,
    body: string,
    catalogId: string,
    productRetailerId: string,
    credentials: BusinessCredentials,
    footer?: string,
  ): Promise<SendResult>;
}
