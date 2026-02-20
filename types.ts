
export interface BibleVerse {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  textEn: string;
  textZh: string;
}

export interface Annotation {
  id: string;
  verseId: string;
  dataUrl: string; // Base64 canvas data
}

export interface UserSettings {
  language: 'en' | 'zh' | 'both';
  fontSize: number;
  theme: string;
  vibeStyles: string; // Dynamic CSS/Tailwind classes
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  groundingLinks?: { title: string; uri: string }[];
  isThinking?: boolean;
}

export enum AppTab {
  READER = 'reader',
  STUDY = 'study',
  MEDIA = 'media',
  LIVE = 'live',
  VIBE = 'vibe'
}
