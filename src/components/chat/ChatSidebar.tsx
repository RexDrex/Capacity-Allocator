import React, { useState } from 'react';
import { useConversations } from '@/hooks/useConversations';
import { useAuth } from '@/contexts/AuthContext';
import { Conversation } from '@/types/messaging';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Settings,
  MessageSquarePlus,
  Users,
  LogOut,
  User,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onSettings: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  selectedConversation,
  onSelectConversation,
  onNewChat,
  onNewGroup,
  onSettings,
}) => {
  const { conversations, isLoading } = useConversations();
  const { profile, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter((conv) =>
    conv.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: false });
    } catch {
      return '';
    }
  };

  const truncateMessage = (message: string | null, maxLength: number = 35) => {
    if (!message) return 'No messages yet';
    if (message.length <= maxLength) return message;
    return message.slice(0, maxLength) + '...';
  };

  return (
    <div className="w-80 border-r border-border bg-sidebar flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(profile?.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sidebar-foreground truncate">
                {profile?.display_name || 'User'}
              </p>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                <Settings className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onNewChat}>
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                New Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onNewGroup}>
                <Users className="h-4 w-4 mr-2" />
                New Group
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSettings}>
                <User className="h-4 w-4 mr-2" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-sidebar-accent border-sidebar-border"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquarePlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No conversations yet</p>
              <p className="text-sm">Start a new chat to get started</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={onNewChat}
              >
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={selectedConversation === conv.id}
                onClick={() => onSelectConversation(conv.id)}
                getInitials={getInitials}
                formatTime={formatTime}
                truncateMessage={truncateMessage}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  getInitials: (name: string | null) => string;
  formatTime: (date: string) => string;
  truncateMessage: (message: string | null, maxLength?: number) => string;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isSelected,
  onClick,
  getInitials,
  formatTime,
  truncateMessage,
}) => {
  const otherParticipant = conversation.participants?.find(
    (p) => p.profile && p.user_id !== conversation.created_by
  );
  const status = otherParticipant?.profile?.status || 'offline';

  return (
    <div
      className={cn(
        'chat-list-item',
        isSelected && 'active bg-sidebar-accent'
      )}
      onClick={onClick}
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={conversation.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {conversation.type === 'group' ? (
              <Users className="h-5 w-5" />
            ) : (
              getInitials(conversation.name)
            )}
          </AvatarFallback>
        </Avatar>
        {conversation.type === 'direct' && (
          <span
            className={cn(
              'status-indicator',
              status === 'online' && 'status-online',
              status === 'away' && 'status-away',
              status === 'busy' && 'status-busy',
              status === 'offline' && 'status-offline'
            )}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-sidebar-foreground truncate">
            {conversation.name || 'Unknown'}
          </p>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatTime(conversation.last_message_at)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {truncateMessage(conversation.last_message?.content)}
        </p>
      </div>
    </div>
  );
};

export default ChatSidebar;
