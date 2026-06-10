import type { ChatMessage } from './types'

const STORAGE_KEY = import.meta.env.VITE_CHAT_SESSION_STORAGE_KEY || 'stockops.client.chat.messages'
const DEFAULT_LIMIT = Number(import.meta.env.VITE_CHAT_CONTEXT_MESSAGE_LIMIT || 12)

export function loadChatMessages(): ChatMessage[] {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isChatMessage)
  } catch {
    return []
  }
}

export function saveChatMessages(messages: ChatMessage[], limit = DEFAULT_LIMIT): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-limit)))
}

export function appendChatMessage(message: ChatMessage, limit = DEFAULT_LIMIT): ChatMessage[] {
  const next = [...loadChatMessages(), message].slice(-limit)
  saveChatMessages(next, limit)
  return next
}

export function clearChatMessages(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ChatMessage>
  return typeof candidate.messageId === 'string'
    && (candidate.role === 'user' || candidate.role === 'assistant' || candidate.role === 'system')
    && typeof candidate.content === 'string'
    && typeof candidate.createdAt === 'string'
}
