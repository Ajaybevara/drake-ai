import { MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function FloatingChatbot() {
  return (
    <button
      onClick={() => toast('Drake chatbot UI shell')}
      title="Drake Chatbot"
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 250,
        width: 58,
        height: 58,
        borderRadius: '50%',
        border: '1px solid rgba(56,189,248,.45)',
        background: 'linear-gradient(135deg,#1D4ED8,#38BDF8)',
        color: '#F8FAFC',
        boxShadow: '0 18px 42px rgba(37,99,235,.34), 0 0 0 6px rgba(56,189,248,.08)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
      }}
    >
      <MessageCircle size={25} />
    </button>
  )
}
