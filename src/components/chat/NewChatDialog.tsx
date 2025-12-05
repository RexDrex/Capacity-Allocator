import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Profile } from '@/types/messaging';
import { parseProfiles } from '@/lib/parseProfile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Loader2, Users, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateConversation: (
    userId: string | null,
    groupName?: string,
    memberIds?: string[]
  ) => Promise<void>;
  mode: 'direct' | 'group';
}

const NewChatDialog: React.FC<NewChatDialogProps> = ({
  open,
  onOpenChange,
  onCreateConversation,
  mode,
}) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (open) {
      fetchUsers();
    } else {
      setSearchQuery('');
      setSelectedUsers([]);
      setGroupName('');
    }
  }, [open]);

  const fetchUsers = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .order('display_name');

      if (error) throw error;
      setUsers(parseProfiles(data || []));
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone?.includes(searchQuery)
  );

  const handleSelectUser = async (userId: string) => {
    if (mode === 'direct') {
      setIsCreating(true);
      try {
        await onCreateConversation(userId);
        onOpenChange(false);
      } catch (err) {
        toast.error('Failed to create conversation');
      } finally {
        setIsCreating(false);
      }
    } else {
      setSelectedUsers((prev) =>
        prev.includes(userId)
          ? prev.filter((id) => id !== userId)
          : [...prev, userId]
      );
    }
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2) {
      toast.error('Select at least 2 members for a group');
      return;
    }
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    setIsCreating(true);
    try {
      await onCreateConversation(null, groupName.trim(), selectedUsers);
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to create group');
    } finally {
      setIsCreating(false);
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'direct' ? (
              <>
                <MessageSquare className="h-5 w-5" />
                New Chat
              </>
            ) : (
              <>
                <Users className="h-5 w-5" />
                Create Group
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'direct'
              ? 'Select a user to start a conversation'
              : 'Select members and create a group chat'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'group' && (
          <div className="mb-4">
            <Input
              placeholder="Group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="mb-2"
            />
            {selectedUsers.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedUsers.length} member{selectedUsers.length !== 1 && 's'} selected
              </p>
            )}
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px] -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No users found</p>
              <p className="text-sm">Try a different search</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map((profile) => (
                <div
                  key={profile.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedUsers.includes(profile.id)
                      ? 'bg-primary/10'
                      : 'hover:bg-accent'
                  }`}
                  onClick={() => handleSelectUser(profile.id)}
                >
                  {mode === 'group' && (
                    <Checkbox
                      checked={selectedUsers.includes(profile.id)}
                      onCheckedChange={() => handleSelectUser(profile.id)}
                    />
                  )}
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(profile.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {profile.display_name || 'Unknown'}
                    </p>
                    {profile.username && (
                      <p className="text-sm text-muted-foreground truncate">
                        @{profile.username}
                      </p>
                    )}
                  </div>
                  {mode === 'direct' && isCreating && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {mode === 'group' && (
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={selectedUsers.length < 2 || !groupName.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Group'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewChatDialog;
