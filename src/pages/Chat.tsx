import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/hooks/useConversations';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';
import NewChatDialog from '@/components/chat/NewChatDialog';
import { Loader2 } from 'lucide-react';

const Chat = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { conversations, createDirectConversation, createGroupConversation } = useConversations();
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) || null;

  const handleCreateConversation = async (
    userId: string | null,
    groupName?: string,
    memberIds?: string[]
  ) => {
    if (userId) {
      const conv = await createDirectConversation(userId);
      if (conv) {
        setSelectedConversationId(conv.id);
      }
    } else if (groupName && memberIds) {
      const conv = await createGroupConversation(groupName, memberIds);
      if (conv) {
        setSelectedConversationId(conv.id);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <ChatSidebar
        selectedConversation={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        onNewChat={() => setNewChatOpen(true)}
        onNewGroup={() => setNewGroupOpen(true)}
        onSettings={() => {}}
      />
      
      <ChatWindow conversation={selectedConversation} />

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onCreateConversation={handleCreateConversation}
        mode="direct"
      />

      <NewChatDialog
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        onCreateConversation={handleCreateConversation}
        mode="group"
      />
    </div>
  );
};

export default Chat;
