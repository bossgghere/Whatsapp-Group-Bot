export type MediaType = 'text' | 'image' | 'audio' | 'document' | 'unknown';

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  text: string;
  mediaType?: MediaType;
  mediaMimeType?: string;
  mediaBuffer?: Buffer;
  quotedMessageId?: string;
  quotedText?: string;
  timestamp: number; // Unix timestamp in ms
}
