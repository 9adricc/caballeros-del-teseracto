import { useState, useRef, useEffect } from 'react'
import { useAuth, isAdmin } from '../context/AuthContext'
import { useInventory } from '../hooks/useInventory'
import { uploadToCloudinary } from '../config/cloudinary'
import { supabase } from '../config/supabase'
import type { Carta, InventarioCarta } from '../types/card'

export default function CollectionPage() {
  const { usuario, refreshUser } = useAuth()
  const { inventory, loading, setDefensiveCard, refresh } = useInventory(usuario?.id)
  const [showCreator, setShowCreator] = useState(false)
  const [selectedForBuild, setSelectedForBuild] = useState<string[]>([])
  const [showBuildPanel, setShowBuildPanel] = useState(false)
  const [selectedCardDetail, setSelectedCardDetail] = useState<InventarioCarta | null>(null)

  useEffect(() => {
    if (usuario) {
      const saved = localStorage.getItem(`tcg_build_${usuario.id}`)
      if (saved) {
        try { const ids = JSON.parse(saved); setSelectedForBuild(ids) } catch {}
      }
    }
  }, [usuario])

  const toggleBuildCard = (id: string) => {
    setSelectedForBuild((prev) => {
      let nuevo
      if (prev.includes(id)) { nuevo = prev.filter((x) => x !== id) }
      else if (prev.length >= 3) { return prev }
      else { nuevo = [...prev, id] }
      if (usuario) { localStorage.setItem(`tcg_build_${usuario.id}`, JSON.stringify(nuevo)) }
      return nuevo
    })
  }

  const buildCards = inventory.filter((item) => selectedForBuild.includes(item.id))
  if (!usuario) return null

  return (
    <div className="space-y-4 p-4 pb-24">
      <div className="text-center">
        <h2 className="text-xl font-bold text-green-400">📚 Colección</h2>
        <p className="text-sm text-gray-400">{usuario.username}, tienes {inventory.length} cartas</p>
      </div>

      <div className="rounded-lg border border-purple-700 bg-purple-950/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-purple-400">⚔️ Tu Build</h3>
          <button onClick={() => setShowBuildPanel(!showBuildPanel)} className="rounded bg-purple-600 px-3 py-1 text-xs font-bold">
            {showBuildPanel ? 'Cerrar' : 'Seleccionar'}
          </button>
        </div>
        {buildCards.length === 0 ? (
          <p className="text-xs text-gray-500">Selecciona hasta 3 cartas para tu build de combate</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {buildCards.map((item) => (
              <div key={item.id} className="rounded-lg border border-purple-600 bg-gray-800 p-1 text-center">
                <div className="text-lg">🃏</div>
                <p className="truncate text-[10px] font-bold">{item.carta?.nombre}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showBuildPanel && (
        <div className="rounded-lg border border-purple-800 bg-gray-900 p-3">
          <h3 className="mb-2 text-xs font-bold text-purple-400">Selecciona hasta 3 cartas ({selectedForBuild.length}/3)</h3>
          <div className="grid grid-cols-3 gap-2">
            {inventory.map((item) => (
              <button key={item.id} onClick={() => toggleBuildCard(item.id)}
                disabled={!selectedForBuild.includes(item.id) && selectedForBuild.length >= 3}
                className={`rounded-lg border p-1 text-center transition-colors ${selectedForBuild.includes(item.id) ? 'border-purple-500 bg-purple-900/50 ring-1 ring-purple-500' : 'border-gray-700 bg-gray-800'} disabled:opacity-40`}>
                <div className="text-lg">🃏</div>
                <p className="truncate text-[10px] font-bold">{item.carta?.nombre || '?'}</p>
              </button>
            ))}
          </div>
          {selectedForBuild.length > 0 && (
            <p className="mt-2 text-[10px] text-purple-300">✅ Build guardada.</p>
          )}
        </div>
      )}

      {isAdmin(usuario.username) && (
        <div className="fixed right-4 top-4 z-40">
          <button onClick={() => setShowCreator(!showCreator)} className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500 text-2xl shadow-lg transition-transform hover:scale-110" title="Creador de Cartas">✨</button>
        </div>
      )}

      {showCreator && isAdmin(usuario.username) && (
        <CardCreatorPanel onCreated={() => { setShowCreator(false); refresh() }} onClose={() => setShowCreator(false)} />
      )}

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-pulse text-gray-400">Cargando tus cartas...</div></div>
      ) : inventory.length === 0 ? (
        <div className="rounded-lg bg-gray-800 p-8 text-center">
          <div className="text-4xl">📭</div>
          <p className="mt-2 text-gray-400">No tienes cartas todavía</p>
          <p className="text-xs text-gray-500">Consigue cartas en el Mercado o gana combates</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {inventory.map((item) => (
            <div key={item.id} className={`group relative overflow-hidden rounded-xl border ${usuario.carta_defensiva_id === item.id ? 'border-yellow-500 ring-2 ring-yellow-500/50' : selectedForBuild.includes(item.id) ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-700'} bg-gray-800 transition-all hover:border-blue-500`}>
              <button onClick={() => setSelectedCardDetail(item)} className="aspect-[3/4] w-full bg-gradient-to-b from-gray-700 to-gray-900">
                {item.carta?.url_imagen ? (
                  <img src={item.carta.url_imagen} alt={item.carta.nombre} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl">🃏</div>
                )}
              </button>
              <div className="p-2">
                <p className="truncate text-sm font-bold">{item.carta?.nombre || 'Carta desconocida'}</p>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                  <span className={`text-[10px] uppercase ${item.carta?.rareza === 'legendaria' ? 'text-orange-400' : item.carta?.rareza === 'epica' ? 'text-purple-400' : item.carta?.rareza === 'rara' ? 'text-blue-400' : 'text-gray-500'}`}>{item.carta?.rareza}</span>
                  <span className="text-yellow-400">❤️ {item.durabilidad_carta}</span>
                </div>
                <div className="mt-1 flex items-center justify-end">
                  <div className="flex gap-1">
                    <button onClick={() => { setDefensiveCard(item.id); refreshUser() }}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors ${usuario.carta_defensiva_id === item.id ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-blue-600'}`}>
                      {usuario.carta_defensiva_id === item.id ? '🛡️' : 'Asig'}
                    </button>
                    <button onClick={() => toggleBuildCard(item.id)}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors ${selectedForBuild.includes(item.id) ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-purple-600'}`}>
                      {selectedForBuild.includes(item.id) ? '⚔️' : '+Build'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal detalle de carta */}
      {selectedCardDetail && selectedCardDetail.carta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedCardDetail(null)}>
          <div className="w-full max-w-xs rounded-2xl border-2 border-yellow-600 bg-gray-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${selectedCardDetail.carta.rareza === 'legendaria' ? 'bg-orange-900/50 text-orange-400' : selectedCardDetail.carta.rareza === 'epica' ? 'bg-purple-900/50 text-purple-400' : selectedCardDetail.carta.rareza === 'rara' ? 'bg-blue-900/50 text-blue-400' : 'bg-gray-800 text-gray-400'}`}>
                {selectedCardDetail.carta.rareza}
              </div>
              <button onClick={() => setSelectedCardDetail(null)} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>
            <div className="aspect-[3/4] w-full bg-gradient-to-b from-gray-700 to-gray-900 rounded-lg flex items-center justify-center mb-3">
              {selectedCardDetail.carta.url_imagen ? (
                <img src={selectedCardDetail.carta.url_imagen} alt={selectedCardDetail.carta.nombre} className="h-full w-full object-cover rounded-lg" />
              ) : (
                <span className="text-6xl">🃏</span>
              )}
            </div>
            <p className="text-lg font-bold text-white text-center">{selectedCardDetail.carta.nombre}</p>
            {selectedCardDetail.carta.descripcion && (
              <p className="text-xs text-gray-400 mt-2 text-center italic">{selectedCardDetail.carta.descripcion}</p>
            )}
            <div className="flex items-center justify-center gap-3 mt-3 text-xs text-gray-400">
              <span className="text-yellow-400">❤️ {selectedCardDetail.durabilidad_carta}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CardCreatorPanel({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [rareza, setRareza] = useState<Carta['rareza']>('comun')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const { usuario } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setError('')
    setSubmitting(true)
    try {
      let url_imagen: string | null = null
      if (file) url_imagen = await uploadToCloudinary(file)
      const { error: insertError } = await supabase.from('cartas').insert({
        nombre: nombre.trim(), descripcion: descripcion.trim(), url_imagen, rareza,
        creado_por: usuario?.username || 'kanete9',
      })
      if (insertError) throw insertError
      onCreated()
    } catch (err: any) { setError(err.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3 rounded-xl border border-yellow-600 bg-gray-900 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-yellow-400">✨ Crear Carta</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <label className="flex cursor-pointer justify-center">
          <div className="flex h-32 w-24 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-600 bg-gray-800">
            {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span className="text-3xl text-gray-500">📸</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)) }
          }} />
        </label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded border border-gray-700 bg-gray-800 p-2 text-sm text-white" placeholder="Nombre de la carta" />
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="w-full rounded border border-gray-700 bg-gray-800 p-2 text-sm text-white" placeholder="Descripción (la IA la usará en los combates)" rows={3} />
        <div>
          <label className="text-xs text-gray-400 mb-1 block">⭐ Rareza</label>
          <select value={rareza} onChange={(e) => setRareza(e.target.value as Carta['rareza'])} className="w-full rounded border border-gray-700 bg-gray-800 p-2 text-sm text-white">
            <option value="comun">Común</option>
            <option value="rara">Rara</option>
            <option value="epica">Épica</option>
            <option value="legendaria">Legendaria</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={submitting} className="w-full rounded-lg bg-yellow-500 py-2 font-bold text-black disabled:opacity-50">
          {submitting ? 'Creando...' : '🎴 ¡Crear Carta!'}
        </button>
      </form>
    </div>
  )
}