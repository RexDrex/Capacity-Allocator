import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Message, MessageType, Profile } from '@/types/messaging';
import { parseProfiles } from '@/lib/parseProfile';

// Helper to parse message data
const parseMessage = (data: any): Message => ({
  ...data,
  sender: data.profiles || data.sender,
  reactions: data.message_reactions?.map((r: any) => ({
    ...r,
    user: r.profiles,
  })) || [],
  attachments: data.attachments || [],
});

export const useMessages = (conversationId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [typingUsers, setTypingUsers] = useState<Profile[]>([]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) return;

    try {
      setIsLoading(true);

      const { data, error: msgError } = await supabase
        .from('messages')
        .select(`
          *,
          profiles (*),
          message_reactions (
            *,
            profiles (*)
          ),
          attachments (*)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;

      const parsed = data?.map(parseMessage) || [];
      setMessages(parsed);

      // Mark messages as read
      await markAsRead();
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, user]);

  // Send a message
  const sendMessage = async (
    content: string,
    messageType: MessageType = 'text',
    metadata: Record<string, any> = {},
    replyTo?: string
  ): Promise<Message | null> => {
    if (!conversationId || !user) return null;

    try {
      const { data, error: sendError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content,
          message_type: messageType,
          metadata,
          reply_to: replyTo || null,
        })
        .select(`
          *,
          profiles (*)
        `)
        .single();

      if (sendError) throw sendError;

      const parsed = parseMessage(data);
      setMessages((prev) => [...prev, parsed]);

      // Clear typing indicator
      await clearTypingIndicator();

      return parsed;
    } catch (err) {
      console.error('Error sending message:', err);
      return null;
    }
  };

  // Edit a message
  const editMessage = async (messageId: string, newContent: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error: editError } = await supabase
        .from('messages')
        .update({
          content: newContent,
          is_edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (editError) throw editError;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: newContent, is_edited: true, edited_at: new Date().toISOString() }
            : m
        )
      );

      return true;
    } catch (err) {
      console.error('Error editing message:', err);
      return false;
    }
  };

  // Delete a message
  const deleteMessage = async (messageId: string, deleteForEveryone: boolean = false): Promise<boolean> => {
    if (!user) return false;

    try {
      if (deleteForEveryone) {
        const { error: delError } = await supabase
          .from('messages')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            content: null,
          })
          .eq('id', messageId)
          .eq('sender_id', user.id);

        if (delError) throw delError;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, is_deleted: true, deleted_at: new Date().toISOString(), content: null }
              : m
          )
        );
      } else {
        // For "delete for me" - we'd need a separate table to track this
        // For now, just remove from local state
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }

      return true;
    } catch (err) {
      console.error('Error deleting message:', err);
      return false;
    }
  };

  // Add reaction
  const addReaction = async (messageId: string, emoji: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error: reactError } = await supabase
        .from('message_reactions')
        .upsert({
          message_id: messageId,
          user_id: user.id,
          emoji,
        });

      if (reactError) throw reactError;
      return true;
    } catch (err) {
      console.error('Error adding reaction:', err);
      return false;
    }
  };

  // Remove reaction
  const removeReaction = async (messageId: string, emoji: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error: removeError } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);

      if (removeError) throw removeError;
      return true;
    } catch (err) {
      console.error('Error removing reaction:', err);
      return false;
    }
  };

  // Mark messages as read
  const markAsRead = async () => {
    if (!conversationId || !user) return;

    try {
      // Update participant's last_read_at
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  // Set typing indicator
  const setTypingIndicator = async () => {
    if (!conversationId || !user) return;

    try {
      await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: conversationId,
          user_id: user.id,
          started_at: new Date().toISOString(),
        });
    } catch (err) {
      console.error('Error setting typing indicator:', err);
    }
  };

  // Clear typing indicator
  const clearTypingIndicator = async () => {
    if (!conversationId || !user) return;

    try {
      await supabase
        .from('typing_indicators')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    } catch (err) {
      console.error('Error clearing typing indicator:', err);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!conversationId || !user) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch the full message with profile
          const { data } = await supabase
            .from('messages')
            .select(`
              *,
              profiles (*)
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            const parsed = parseMessage(data);
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.find((m) => m.id === parsed.id)) return prev;
              return [...prev, parsed];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
          );
        }
      )
      .subscribe();

    // Typing indicator channel
    const typingChannel = supabase
      .channel(`typing-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async () => {
          // Fetch current typing users
          const { data: typingData } = await supabase
            .from('typing_indicators')
            .select('*')
            .eq('conversation_id', conversationId)
            .neq('user_id', user.id);

          if (!typingData || typingData.length === 0) {
            setTypingUsers([]);
            return;
          }

          // Filter by recent typing
          const recentTyping = typingData.filter((t) => {
            const startedAt = new Date(t.started_at).getTime();
            return Date.now() - startedAt < 5000;
          });

          if (recentTyping.length === 0) {
            setTypingUsers([]);
            return;
          }

          // Fetch profiles for typing users
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', recentTyping.map(t => t.user_id));

          setTypingUsers(parseProfiles(profiles || []));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
    };
  }, [conversationId, user]);

  return {
    messages,
    isLoading,
    error,
    typingUsers,
    refetch: fetchMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    setTypingIndicator,
    clearTypingIndicator,
  };
};
