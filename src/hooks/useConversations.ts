import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Conversation, Message, Profile, ConversationParticipant } from '@/types/messaging';

// Helper to parse conversation data
const parseConversation = (data: any, currentUserId: string): Conversation => {
  const participants = data.conversation_participants?.map((p: any) => ({
    ...p,
    profile: p.profiles,
  })) || [];

  // For direct conversations, use the other participant's info
  let displayName = data.name;
  let displayAvatar = data.avatar_url;

  if (data.type === 'direct' && participants.length > 0) {
    const otherParticipant = participants.find((p: ConversationParticipant) => p.user_id !== currentUserId);
    if (otherParticipant?.profile) {
      displayName = otherParticipant.profile.display_name || otherParticipant.profile.username;
      displayAvatar = otherParticipant.profile.avatar_url;
    }
  }

  return {
    id: data.id,
    type: data.type,
    name: displayName,
    avatar_url: displayAvatar,
    description: data.description,
    created_by: data.created_by,
    last_message_at: data.last_message_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
    participants,
    last_message: data.messages?.[0] ? {
      ...data.messages[0],
      sender: data.messages[0].profiles,
    } : undefined,
  };
};

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchConversations = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // Get all conversations the user is part of
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      const conversationIds = participantData?.map(p => p.conversation_id) || [];

      if (conversationIds.length === 0) {
        setConversations([]);
        setIsLoading(false);
        return;
      }

      // Fetch conversations with participants and last message
      const { data, error: convError } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants (
            *,
            profiles (*)
          ),
          messages (
            *,
            profiles (*)
          )
        `)
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false })
        .limit(1, { referencedTable: 'messages' });

      if (convError) throw convError;

      const parsed = data?.map(c => parseConversation(c, user.id)) || [];
      setConversations(parsed);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new direct conversation
  const createDirectConversation = async (otherUserId: string): Promise<Conversation | null> => {
    if (!user) return null;

    try {
      // Check if conversation already exists
      const { data: existingParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      const { data: otherParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', otherUserId);

      const userConvIds = existingParticipants?.map(p => p.conversation_id) || [];
      const otherConvIds = otherParticipants?.map(p => p.conversation_id) || [];
      const commonConvIds = userConvIds.filter(id => otherConvIds.includes(id));

      // Check if any common conversation is direct
      if (commonConvIds.length > 0) {
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('*')
          .in('id', commonConvIds)
          .eq('type', 'direct')
          .single();

        if (existingConv) {
          return existingConv as Conversation;
        }
      }

      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'direct',
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add participants
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConv.id, user_id: user.id, role: 'admin' },
          { conversation_id: newConv.id, user_id: otherUserId, role: 'admin' },
        ]);

      if (partError) throw partError;

      await fetchConversations();
      return newConv as Conversation;
    } catch (err) {
      console.error('Error creating conversation:', err);
      return null;
    }
  };

  // Create a group conversation
  const createGroupConversation = async (name: string, participantIds: string[]): Promise<Conversation | null> => {
    if (!user) return null;

    try {
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'group',
          name,
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add participants including creator
      const participants = [user.id, ...participantIds].map((id, index) => ({
        conversation_id: newConv.id,
        user_id: id,
        role: id === user.id ? 'admin' : 'member',
      }));

      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participants);

      if (partError) throw partError;

      await fetchConversations();
      return newConv as Conversation;
    } catch (err) {
      console.error('Error creating group:', err);
      return null;
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    conversations,
    isLoading,
    error,
    refetch: fetchConversations,
    createDirectConversation,
    createGroupConversation,
  };
};
