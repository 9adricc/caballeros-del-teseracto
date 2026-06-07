import { useState, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'

export default function RegisterForm() {
  const { register, login } = useAuth()
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      setError('El nombre de usuario es obligatorio')
      return
    }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('El PIN debe ser de 4 dígitos')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      if (isRegistering) {
        await register(username.trim(), pin, avatarFile)
      } else {
        await login(username.trim(), pin)
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-950 p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-yellow-400">
            🏰 Los Caballeros
          </h1>
          <h2 className="text-3xl font-bold text-yellow-400">del Teseracto</h2>
          <p className="mt-2 text-sm text-gray-400">
            {isRegistering ? 'Crea tu personaje' : 'Inicia sesión'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {(isRegistering) && (
            <div className="flex justify-center">
              <label className="cursor-pointer">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-gray-600 bg-gray-800 hover:border-blue-400">
                  {preview ? (
                    <img src={preview} alt="Preview" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                <p className="mt-1 text-center text-xs text-gray-500">Foto de perfil</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-gray-400">Nombre de Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              placeholder="Ej: MiNombreEpico"
              maxLength={30}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">PIN de acceso (4 dígitos)</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-center text-2xl tracking-widest text-white focus:border-blue-500 focus:outline-none"
              placeholder="****"
              maxLength={4}
              inputMode="numeric"
              autoComplete="off"
            />
          </div>

          {error && (
            <p className="text-center text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-yellow-500 py-3 font-bold text-black transition-colors hover:bg-yellow-400 disabled:opacity-50"
          >
            {submitting ? 'Entrando...' : isRegistering ? '🎮 ¡Crear Personaje!' : '⚔️ Entrar'}
          </button>

          <p className="text-center">
            <button
              type="button"
              onClick={() => { setIsRegistering(!isRegistering); setError('') }}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿Eres nuevo? Crea tu personaje'}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}