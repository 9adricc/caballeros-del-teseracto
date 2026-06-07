import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRealtimeMessages } from '../hooks/useRealtimeMessages'

export default function ChatPage() {
  const { usuario } = useAuth()
  const { messages, loading, sendMessage } = useRealtimeMessages()
  const [text, setText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!text.trim() || !usuario) return
    await sendMessage(text, usuario.id)
    setText('')
  }

  if (!usuario) return null

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 bg-gray-900 p-3 text-center">
        <h2 className="text-lg font-bold text-blue-400">💬 Chat Global</h2>
      </div>

      {/* Mensajes - scrollable */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-pulse text-sm text-gray-400">Cargando mensajes...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <div className="text-4xl">📭</div>
            <p className="mt-2 text-sm">No hay mensajes todavía</p>
            <p className="text-xs">¡Sé el primero en escribir!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2 ${msg.usuario_id === usuario.id ? 'flex-row-reverse' : ''}`}
            >
              <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-gray-700">
                {msg.usuarios?.avatar_url ? (
                  <img src={msg.usuarios.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm">👤</div>
                )}
              </div>

              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                  msg.usuario_id === usuario.id
                    ? 'rounded-br-sm bg-blue-600 text-white'
                    : 'rounded-bl-sm bg-gray-800 text-gray-200'
                }`}
              >
                {msg.usuario_id !== usuario.id && (
                  <p className="mb-0.5 text-[10px] font-bold text-blue-400">
                    {msg.usuarios?.username || 'Desconocido'}
                  </p>
                )}
                <p className="text-sm leading-relaxed">{msg.texto}</p>
                <p className="mt-0.5 text-right text-[10px] opacity-60">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - fijo abajo pero sobre el nav */}
      <div className="flex-shrink-0 border-t border-gray-800 bg-gray-900 p-3 pb-[72px]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Escribe un mensaje..."
            className="flex-1 rounded-full border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            maxLength={500}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="rounded-full bg-blue-600 p-2 text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}