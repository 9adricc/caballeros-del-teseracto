import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import type { Mensaje } from '../types/message'

export function useRealtimeMessages() {
  const [messages, setMessages] = useState<Mensaje[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMessages()
    const subscription = supabase
      .channel('mensajes_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes' },
        (payload) => {
          const newMsg = payload.new as Mensaje
          fetchUserForMessage(newMsg).then((msg) => {
            setMessages((prev) => [...prev, msg])
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [])

  const fetchUserForMessage = async (msg: Mensaje): Promise<Mensaje> => {
    const { data } = await supabase
      .from('usuarios')
      .select('username, avatar_url')
      .eq('id', msg.usuario_id)
      .single()
    return { ...msg, usuarios: data || undefined }
  }

  const loadMessages = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('mensajes')
      .select('*, usuarios(username, avatar_url)')
      .order('created_at', { ascending: true })
      .limit(100)
    if (data) setMessages(data as Mensaje[])
    setLoading(false)
  }

  const sendMessage = useCallback(async (texto: string, usuarioId: string) => {
    if (!texto.trim()) return
    await supabase.from('mensajes').insert({ usuario_id: usuarioId, texto: texto.trim() })
  }, [])

  return { messages, loading, sendMessage }
}