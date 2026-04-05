import { useState, useRef, useEffect } from 'react'
import './ChatPanel.css'

export default function ChatPanel({ messages, username, onSend, onClose }) {
  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-panel fade-in">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-title">
          <IconChat />
          <span>Live Chat</span>
          <span className="chat-count">{messages.length}</span>
        </div>
        <button id="close-chat-btn" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} title="Close">
          <IconX />
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <span>💬</span>
            <p>No messages yet.<br />Say hello!</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`chat-msg ${msg.name === username ? 'own' : ''}`}>
              {msg.name !== username && (
                <div className="msg-avatar" style={{ background: msg.color }}>
                  {msg.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="msg-bubble-wrap">
                {msg.name !== username && (
                  <span className="msg-name" style={{ color: msg.color }}>{msg.name}</span>
                )}
                <div className="msg-bubble">
                  <span className="msg-text">{msg.text}</span>
                  <span className="msg-time">{msg.time}</span>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-row">
        <textarea
          id="chat-input"
          className="chat-textarea"
          placeholder="Type a message… (Enter to send)"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          maxLength={500}
        />
        <button
          id="send-chat-btn"
          className="btn btn-primary btn-icon"
          onClick={handleSend}
          disabled={!text.trim()}
          title="Send"
        >
          <IconSend />
        </button>
      </div>
    </div>
  )
}

function IconChat() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function IconX() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function IconSend() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
}
