import { describe, expect, it, beforeEach } from 'vitest'
import { appendChatMessage, clearChatMessages, loadChatMessages } from './chatSessionStorage'
import type { ChatMessage } from './types'

function message(id: string, content: string): ChatMessage {
  return { messageId: id, role: 'user', content, createdAt: '2026-06-10T00:00:00.000Z' }
}

describe('chatSessionStorage', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('stores messages in sessionStorage only', () => {
    appendChatMessage(message('m1', 'hello'))

    expect(loadChatMessages()).toEqual([message('m1', 'hello')])
    expect(localStorage.length).toBe(0)
  })

  it('keeps the newest messages within the limit', () => {
    for (let index = 0; index < 15; index += 1) {
      appendChatMessage(message(`m${index}`, `message ${index}`), 12)
    }

    const loaded = loadChatMessages()

    expect(loaded).toHaveLength(12)
    expect(loaded[0].messageId).toBe('m3')
    expect(loaded[11].messageId).toBe('m14')
  })

  it('clears messages', () => {
    appendChatMessage(message('m1', 'hello'))

    clearChatMessages()

    expect(loadChatMessages()).toEqual([])
  })
})
