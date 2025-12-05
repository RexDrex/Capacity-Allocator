export type MessageStatus = 'sent' | 'delivered' | 'read';
export type ConversationType = 'direct' | 'group';
export type UserStatus = 'online' | 'offline' | 'away' | 'busy';
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'gif' | 'system';

export interface UserSettings {
  notifications: boolean;
  show_last_seen: boolean;
  show_read_receipts: boolean;
}

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  status: UserStatus;
  last_seen: string;
  is_verified: boolean;
  settings: UserSettings;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  avatar_url: string | null;
  description: string | null;
  created_by: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  // Joined data
  participants?: ConversationParticipant[];
  last_message?: Message;
  unread_count?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  nickname: string | null;
  is_muted: boolean;
  muted_until: string | null;
  last_read_at: string;
  joined_at: string;
  // Joined data
  profile?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string | null;
  message_type: MessageType;
  status: MessageStatus;
  reply_to: string | null;
  forwarded_from: string | null;
  metadata: Record<string, any>;
  is_edited: boolean;
  edited_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  // Joined data
  sender?: Profile;
  reply_message?: Message;
  reactions?: MessageReaction[];
  attachments?: Attachment[];
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  // Joined data
  user?: Profile;
}

export interface Attachment {
  id: string;
  message_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  created_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  contact_user_id: string;
  nickname: string | null;
  is_blocked: boolean;
  is_favorite: boolean;
  created_at: string;
  // Joined data
  contact_profile?: Profile;
}

export interface TypingIndicator {
  id: string;
  conversation_id: string;
  user_id: string;
  started_at: string;
  // Joined data
  user?: Profile;
}

// Smart reply suggestion
export interface SmartReply {
  id: string;
  text: string;
  confidence: number;
}

// Message category for AI categorization
export type MessageCategory = 'personal' | 'work' | 'promotional' | 'spam';
