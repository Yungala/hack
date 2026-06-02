import { create } from 'zustand';

const COLORS = [
  '#FFFFFF', '#111111', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#38BDF8', '#3B82F6',
  '#A855F7', '#EC4899', '#6B7280', '#D4B896',
] as const;

export const PALETTE = COLORS;
export const THICKNESSES = [2, 6, 14] as const;
export type Thickness = number;

export type Tool = 'brush' | 'eraser' | 'text' | null;

export const FONT_FAMILIES = [
  { value: 'sans-serif',              label: '고딕',   sample: 'A' },
  { value: 'serif',                   label: '명조',   sample: 'A' },
  { value: 'Impact, fantasy',         label: '임팩트', sample: 'A' },
  { value: "'Comic Sans MS', cursive", label: '손글씨', sample: 'A' },
] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number]['value'];

interface DrawingStore {
  color: string;
  thickness: Thickness;
  tool: Tool;
  fontFamily: FontFamily;
  isConnected: boolean;
  presenceCount: number;
  isUploadMode: boolean;
  pendingImageFile: File | null;
  setColor: (color: string) => void;
  setThickness: (thickness: Thickness) => void;
  setTool: (tool: Tool) => void;
  clearTool: () => void;
  setFontFamily: (f: FontFamily) => void;
  setConnected: (connected: boolean) => void;
  setPresenceCount: (count: number) => void;
  setUploadMode: (mode: boolean) => void;
  setPendingImageFile: (file: File | null) => void;
}

export const useDrawingStore = create<DrawingStore>((set) => ({
  color: '#111111',
  thickness: 6,
  tool: null,
  fontFamily: 'sans-serif',
  isConnected: true,
  presenceCount: 1,
  isUploadMode: false,
  pendingImageFile: null,
  setColor: (color) => set({ color }),
  setThickness: (thickness) => set({ thickness }),
  setTool: (tool) => set({ tool }),
  clearTool: () => set({ tool: null }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setConnected: (isConnected) => set({ isConnected }),
  setPresenceCount: (presenceCount) => set({ presenceCount }),
  setUploadMode: (isUploadMode) => set({ isUploadMode }),
  setPendingImageFile: (pendingImageFile) => set({ pendingImageFile }),
}));
