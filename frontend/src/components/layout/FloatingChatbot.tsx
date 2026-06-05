import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'

export default function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<{role: 'user' | 'bot', text: string}[]>([
    { role: 'bot', text: 'Hello! I am Drake. How can I assist you with your petroleum data today?' }
  ])
  const [input, setInput] = useState('')
  const { theme } = useStore()
  const isLight = theme === 'light'
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleSend = () => {
    if (!input.trim()) return
    setMessages(prev => [...prev, { role: 'user', text: input }])
    setInput('')
    
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'bot', text: "I'm currently running in offline interactive mode. API integration is pending!" }])
    }, 1000)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  return (
    <>
      {isOpen && (
        <div style={{
          position: 'fixed', right: 24, bottom: 90, width: 320, height: 400, zIndex: 250,
          background: isLight ? '#FFFFFF' : '#0B111A', borderRadius: 12,
          border: `1px solid ${isLight ? '#CBD5E1' : '#1F2A3A'}`,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', fontFamily: 'DM Sans,sans-serif'
        }}>
          <div style={{ background: 'linear-gradient(135deg,#9B1B1B,#DA2626)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <img src="/drake%20bot.png" alt="Drake Bot" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: '50%' }} />
              Drake Assistant
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <div style={{
                  background: msg.role === 'user' ? (isLight ? '#E2E8F0' : '#1E293B') : (isLight ? '#FFEBEE' : '#172554'),
                  color: isLight ? '#0F172A' : '#F8FAFC',
                  padding: '10px 14px', borderRadius: 12,
                  borderBottomRightRadius: msg.role === 'user' ? 2 : 12,
                  borderBottomLeftRadius: msg.role === 'bot' ? 2 : 12,
                  fontSize: 14, lineHeight: 1.4
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: 12, borderTop: `1px solid ${isLight ? '#E2E8F0' : '#1F2A3A'}`, display: 'flex', gap: 8 }}>
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything..." 
              style={{ flex: 1, padding: '10px 14px', borderRadius: 20, border: `1px solid ${isLight ? '#CBD5E1' : '#334155'}`, background: isLight ? '#F8FAFC' : '#0F172A', color: isLight ? '#0F172A' : '#F8FAFC', outline: 'none' }}
            />
            <button onClick={handleSend} style={{ width: 40, height: 40, borderRadius: '50%', background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Drake Chatbot"
        style={{
          position: 'fixed', right: 24, bottom: 24, zIndex: 250, width: 50, height: 50,
          borderRadius: '50%', border: 'none',
          background: '#000', color: '#F8FAFC',
          boxShadow: '0 18px 42px rgba(0,0,0,.34), 0 0 0 4px rgba(0,0,0,.05)',
          display: 'grid', placeItems: 'center', cursor: 'pointer', overflow: 'hidden', padding: 0
        }}
      >
        <img src="/drake%20bot.png" alt="Drake Bot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </button>
    </>
  )
}
