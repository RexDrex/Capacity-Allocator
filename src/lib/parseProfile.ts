import { Profile, UserSettings } from '@/types/messaging';

export const parseProfile = (data: any): Profile => {
  const settings = data.settings as Record<string, any> | null;
  return {
    ...data,
    settings: {
      notifications: settings?.notifications ?? true,
      show_last_seen: settings?.show_last_seen ?? true,
      show_read_receipts: settings?.show_read_receipts ?? true,
    } as UserSettings,
  };
};

export const parseProfiles = (data: any[]): Profile[] => {
  return data.map(parseProfile);
};
