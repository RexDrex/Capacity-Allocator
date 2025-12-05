import React, { useState, useRef, useEffect } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/contexts/AuthContext';
import { Conversation, Message } from '@/types/messaging';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Phone,
  Video,
  MoreVertical,
  Send,
  Paperclip,
  Smile,
  Mic,
  Image,
  Reply,
  Copy,
  Trash2,
  Edit2,
  Check,
  CheckCheck,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';

interface ChatWindowProps {
  conversation: Conversation | null;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ conversation }) => {
  const { user, profile } = useAuth();
  const {
    messages,
    isLoading,
    typingUsers,
    sendMessage,
    editMessage,
    deleteMessage,
    setTypingIndicator,
    clearTypingIndicator,
  } = useMessages(conversation?.id || null);

  const [inputValue, setInputValue] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editValue, setEditValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const content = inputValue.trim();
    setInputValue('');
    setReplyTo(null);

    const result = await sendMessage(content, 'text', {}, replyTo?.id);
    if (!result) {
      toast.error('Failed to send message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);

    // Set typing indicator
    setTypingIndicator();

    // Clear typing after 2 seconds of no input
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      clearTypingIndicator();
    }, 2000);
  };

  const handleEdit = async (message: Message) => {
    setEditingMessage(message);
    setEditValue(message.content || '');
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editValue.trim()) return;

    const success = await editMessage(editingMessage.id, editValue.trim());
    if (success) {
      toast.success('Message edited');
      setEditingMessage(null);
      setEditValue('');
    } else {
      toast.error('Failed to edit message');
    }
  };

  const handleDelete = async (message: Message, forEveryone: boolean = false) => {
    const success = await deleteMessage(message.id, forEveryone);
    if (success) {
      toast.success('Message deleted');
    } else {
      toast.error('Failed to delete message');
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  };

  const formatMessageTime = (date: string) => {
    return format(new Date(date), 'HH:mm');
  };

  const formatDateSeparator = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMMM d, yyyy');
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = format(new Date(message.created_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Select a conversation
          </h2>
          <p className="text-muted-foreground">
            Choose a chat from the sidebar to start messaging
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="h-16 px-4 border-b border-border flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={conversation.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(conversation.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-foreground">{conversation.name}</h3>
            {typingUsers.length > 0 ? (
              <p className="text-xs text-primary">
                {typingUsers.map((u) => u.display_name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {conversation.type === 'group'
                  ? `${conversation.participants?.length || 0} members`
                  : 'Online'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Video className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>View Profile</DropdownMenuItem>
              <DropdownMenuItem>Search Messages</DropdownMenuItem>
              <DropdownMenuItem>Mute Notifications</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Delete Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn('flex', i % 2 === 0 ? 'justify-end' : 'justify-start')}
              >
                <Skeleton className="h-12 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 text-xs text-muted-foreground bg-muted rounded-full">
                    {formatDateSeparator(msgs[0].created_at)}
                  </span>
                </div>

                {/* Messages */}
                {msgs.map((message, index) => {
                  const isSent = message.sender_id === user?.id;
                  const showAvatar =
                    !isSent &&
                    (index === 0 || msgs[index - 1]?.sender_id !== message.sender_id);

                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isSent={isSent}
                      showAvatar={showAvatar}
                      isEditing={editingMessage?.id === message.id}
                      editValue={editValue}
                      setEditValue={setEditValue}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={() => {
                        setEditingMessage(null);
                        setEditValue('');
                      }}
                      onReply={() => setReplyTo(message)}
                      onEdit={() => handleEdit(message)}
                      onDelete={() => handleDelete(message, true)}
                      onCopy={() => handleCopy(message.content || '')}
                      getInitials={getInitials}
                      formatTime={formatMessageTime}
                    />
                  );
                })}
              </div>
            ))}

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div className="flex items-end gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={typingUsers[0]?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(typingUsers[0]?.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="message-bubble message-received">
                  <div className="typing-indicator">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Reply Preview */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-border bg-muted/50 flex items-center gap-2">
          <Reply className="h-4 w-4 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">
              Reply to {replyTo.sender?.display_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyTo.content}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReplyTo(null)}
            className="text-muted-foreground"
          >
            ✕
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Image className="h-5 w-5" />
          </Button>
          
          <div className="flex-1 relative">
            <Input
              placeholder="Type a message..."
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="pr-10"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            >
              <Smile className="h-5 w-5" />
            </Button>
          </div>

          {inputValue.trim() ? (
            <Button size="icon" onClick={handleSend}>
              <Send className="h-5 w-5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon">
              <Mic className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
  isSent: boolean;
  showAvatar: boolean;
  isEditing: boolean;
  editValue: string;
  setEditValue: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  getInitials: (name: string | null) => string;
  formatTime: (date: string) => string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSent,
  showAvatar,
  isEditing,
  editValue,
  setEditValue,
  onSaveEdit,
  onCancelEdit,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  getInitials,
  formatTime,
}) => {
  if (message.is_deleted) {
    return (
      <div className={cn('flex', isSent ? 'justify-end' : 'justify-start', 'mb-1')}>
        <div className="message-bubble bg-muted text-muted-foreground italic">
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-end gap-2 mb-1',
        isSent ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {!isSent && showAvatar ? (
        <Avatar className="h-8 w-8">
          <AvatarImage src={message.sender?.avatar_url || undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(message.sender?.display_name)}
          </AvatarFallback>
        </Avatar>
      ) : (
        !isSent && <div className="w-8" />
      )}

      <ContextMenu>
        <ContextMenuTrigger>
          <div className={cn('message-bubble', isSent ? 'message-sent' : 'message-received')}>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="min-w-[200px] bg-transparent border-none p-0 h-auto focus-visible:ring-0"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSaveEdit();
                    if (e.key === 'Escape') onCancelEdit();
                  }}
                />
                <Button size="sm" variant="ghost" onClick={onSaveEdit}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap">{message.content}</p>
                <div
                  className={cn(
                    'flex items-center gap-1 mt-1',
                    isSent ? 'justify-end' : 'justify-start'
                  )}
                >
                  <span className="text-xs opacity-70">{formatTime(message.created_at)}</span>
                  {message.is_edited && (
                    <span className="text-xs opacity-50">edited</span>
                  )}
                  {isSent && (
                    <span className="opacity-70">
                      {message.status === 'read' ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : message.status === 'delivered' ? (
                        <CheckCheck className="h-3 w-3 opacity-50" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onReply}>
            <Reply className="h-4 w-4 mr-2" />
            Reply
          </ContextMenuItem>
          <ContextMenuItem onClick={onCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </ContextMenuItem>
          {isSent && (
            <>
              <ContextMenuItem onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </ContextMenuItem>
              <ContextMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
};

export default ChatWindow;
