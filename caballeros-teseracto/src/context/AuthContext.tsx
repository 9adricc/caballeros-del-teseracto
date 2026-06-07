import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Usuario } from '../types/user'
import { supabase } from '../config/supabase'

interface AuthContextType {
  usuario: Usuario | null
  loading: boolean
  register: (username: string, pin: string, avatarFile?: File | null) => Promise<void>
  login: (username: string, pin: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  error: string | null
}

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  loading: true,
  register: async () => {},
  login: async () => {},
  logout: () => {},
  refreshUser: async () => {},
  error: null,
})

const ADMIN_USERNAME = 'kanete9'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshUser = async () => {
    const stored = localStorage.getItem('tcg_user')
    if (!stored) {
      setUsuario(null)
      setLoading(false)
      return
    }
    try {
      const { id, pin } = JSON.parse(stored)
      const { data } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', id)
        .single()
      if (data) {
        setUsuario(data as Usuario)
        localStorage.setItem('tcg_user', JSON.stringify({ id: data.id, username: data.username, pin }))
      } else {
        // Usuario no existe en BD, limpiar
        localStorage.removeItem('tcg_user')
        setUsuario(null)
      }
    } catch {
      localStorage.removeItem('tcg_user')
      setUsuario(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  const register = async (username: string, pin: string, avatarFile?: File | null) => {
    setError(null)
    
    // Verificar si el username ya existe
    const { data: existing } = await supabase
      .from('usuarios')
      .select('id')
      .eq('username', username.trim())
      .maybeSingle()

    if (existing) {
      throw new Error('Ese nombre ya está en uso. Haz login con tu PIN.')
    }

    let avatarUrl: string | null = null
    if (avatarFile) {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
      if (cloudName && uploadPreset) {
        const formData = new FormData()
        formData.append('file', avatarFile)
        formData.append('upload_preset', uploadPreset)
        formData.append('folder', 'caballeros-teseracto/avatars')
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: 'POST', body: formData }
        )
        if (res.ok) {
          const data = await res.json()
          avatarUrl = data.secure_url
        }
      }
    }

    const { data, error: insertError } = await supabase
      .from('usuarios')
      .insert({
        username: username.trim(),
        avatar_url: avatarUrl,
        monedas: 1000,
        puntos_vida: 100,
        pin_acceso: pin,
      })
      .select()
      .single()

    if (insertError) throw new Error(insertError.message)

    const newUser = data as Usuario

    // 🎁 Cofre inicial: 3 cartas comunes o raras aleatorias
    const { data: cartasDisponibles } = await supabase
      .from('cartas')
      .select('id, rareza')
      .in('rareza', ['comun', 'rara'])
    if (cartasDisponibles && cartasDisponibles.length > 0) {
      // Barajar y seleccionar 3
      const shuffled = [...cartasDisponibles].sort(() => Math.random() - 0.5)
      const seleccionadas = shuffled.slice(0, Math.min(3, shuffled.length))
      for (const carta of seleccionadas) {
        await supabase.from('inventario_usuarios').insert({
          usuario_id: newUser.id,
          carta_id: carta.id,
          durabilidad_carta: 100,
        })
      }
    }

    localStorage.setItem('tcg_user', JSON.stringify({ id: newUser.id, username: newUser.username, pin }))
    setUsuario(newUser)
  }

  const login = async (username: string, pin: string) => {
    setError(null)
    
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('username', username.trim())
      .eq('pin_acceso', pin)
      .single()

    if (!data) {
      throw new Error('Nombre o PIN incorrecto')
    }

    localStorage.setItem('tcg_user', JSON.stringify({ id: data.id, username: data.username, pin }))
    setUsuario(data as Usuario)
  }

  const logout = () => {
    localStorage.removeItem('tcg_user')
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, register, login, logout, refreshUser, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export function isAdmin(username: string | undefined | null): boolean {
  return username === ADMIN_USERNAME
}