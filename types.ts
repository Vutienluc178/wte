export enum MessageRole {
  User = 'user',
  Model = 'model',
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  isError?: boolean;
}

export interface EditorState {
  content: string;
  isProcessing: boolean;
}

export type MathMode = 'inline' | 'display';

export interface TextSegment {
  type: 'text' | 'math';
  content: string;
  displayMode?: boolean; // true if $$...$$ or \[...\]
}

export type ExportStyle = 
  | 'standard' 
  | 'minimal' 
  | 'worksheet' 
  | 'notes'
  | 'two-column'   // New: Đề thi 2 cột
  | 'landscape'    // New: Khổ ngang
  | 'large-print'  // New: Cỡ chữ lớn
  | 'draft'        // New: Bản nháp
  | 'flashcards';  // New: Thẻ học tập