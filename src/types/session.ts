export interface IdeSession {
  sessionId: string
  title: string
  sessionType: 'vibe' | 'spec'
  workspaceDirectory: string
  history: HistoryItem[]
  conversationSummary?: string
  // V1SessionFileSchema additional fields
  modelId?: string
  selectedModel?: string
  autonomyMode?: string
}

export interface SessionSummary {
  sessionId: string
  title: string
  sessionType: 'vibe' | 'spec'
  workspaceDirectory: string
  workspaceHash: string
  messageCount: number
  fileSize: number
  createdAt?: number
  modifiedAt?: number
}

export interface HistoryItem {
  message: Message
  contextItems: any[]
  editorState: any
  promptLogs: PromptLog[]
  // V1HistoryItemSchema additional field
  executionId?: string
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: ContentItem[]
  id: string
}

export interface ContentItem {
  type: string
  text: string
}

export interface PromptLog {
  modelTitle: string
  prompt: string
  completion: string
  completionOptions: any
}
