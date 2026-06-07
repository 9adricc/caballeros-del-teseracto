import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useInventory } from '../hooks/useInventory'
import { supabase } from '../config/supabase'
import type { Carta } from '../types/card'
import type { Subasta } from '../types/auction'

const ACTIVOS_BOLSA = [
  { nombre: 'Gold Futures', emoji: '☕', volatilidad: 0.3 },
  { nombre: 'SP&500', emoji: '💎', volatilidad: 0.2 },
  { nombre: 'IBEX35', emoji: '🐟', volatilidad: 0.5 },
  { nombre: 'Brent Oil', emoji: '📜', volatilidad: 0.8 },
  { nombre: 'El Congo Treasury Bond', emoji: '⚡', volatilidad: 5.0 },
]

export default function MarketPage() {
  const { usuario, refreshUser } = useAuth()
  const { inventory, refresh: refreshInventory } = useInventory(usuario?.id)
  const tendenciasRef = useRef<Record<string, number>>({})
  const [subastas, setSubastas] = useState<Subasta[]>([])
  const [dailyCards, setDailyCards] = useState<(Carta & { precio: number })[]>([])
  const [showCreateAuction, setShowCreateAuction] = useState(false)
  const [selectedInventoryId, setSelectedInventoryId] = useState('')
  const [price, setPrice] = useState(100)
  const [inversiones, setInversiones] = useState<any[]>([])
  const [selectedActivo, setSelectedActivo] = useState(ACTIVOS_BOLSA[0].nombre)
  const [invertAmount, setInvertAmount] = useState(100)
  const [error, setError] = useState('')
  const [bidError, setBidError] = useState('')
  const [bidAmount, setBidAmount] = useState<Record<string, number>>({})
  const [cofreDisponible, setCofreDisponible] = useState(false)
  const [mensajeCofre, setMensajeCofre] = useState('')
  const [pygRealizada, setPygRealizada] = useState(0)
  const [selectedCard, setSelectedCard] = useState<(Carta & { precio: number }) | null>(null)
  const [chestCard, setChestCard] = useState<Carta | null>(null)
  const [resetting, setResetting] = useState(false)

  const resetSaldoTodos = async () => {
    if (!usuario || usuario.username !== 'kanete9') return
    if (!confirm('¿Resetear el saldo de TODOS los usuarios a 1000 monedas?')) return
    setResetting(true)
    const { error } = await supabase.from('usuarios').update({ monedas: 1000 }).neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) setError('Error al resetear: ' + error.message)
    else setError('')
    refreshUser()
    setResetting(false)
  }

  const REEL_SYMBOLS = ['🍒', '🍋', '⭐', '💎', '👑']
  const [slotReels, setSlotReels] = useState<string[]>([REEL_SYMBOLS[0], REEL_SYMBOLS[1], REEL_SYMBOLS[2]])
  const [slotSpinning, setSlotSpinning] = useState(false)
  const [slotResult, setSlotResult] = useState<{ ganancia: number; carta?: string } | null>(null)
  const [showSlotInfo, setShowSlotInfo] = useState(false)

  const spinSlot = async () => {
    if (!usuario || slotSpinning) return
    const { error: debitErr } = await supabase.from('usuarios').update({ monedas: usuario.monedas - 25 }).eq('id', usuario.id)
    if (debitErr) return
    setSlotSpinning(true)
    setSlotResult(null)
    refreshUser()
    const interval = setInterval(() => { setSlotReels(REEL_SYMBOLS.map(() => REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)])) }, 100)
    setTimeout(async () => {
      clearInterval(interval)
      const finalReels = REEL_SYMBOLS.map(() => { const p = Math.random(); if (p < 0.01) return '👑'; if (p < 0.04) return '💎'; if (p < 0.12) return '⭐'; if (p < 0.35) return '🍋'; return '🍒' })
      setSlotReels(finalReels)
      let ganancia = 0
      let cartaGanada: string | undefined
      const counts: Record<string, number> = {}
      finalReels.forEach(s => { counts[s] = (counts[s] || 0) + 1 })
      const maxCount = Math.max(...Object.values(counts))
      const bestSymbol = Object.keys(counts).find(s => counts[s] === maxCount) || finalReels[0]
      if (maxCount === 3) {
        if (bestSymbol === '👑') { ganancia = 50; const { data: c } = await supabase.from('cartas').select('id'); if (c && c.length > 0) { const r = c[Math.floor(Math.random() * c.length)]; const { data: cardData } = await supabase.from('cartas').select('*').eq('id', r.id).single(); if (cardData) setChestCard(cardData); await supabase.from('inventario_usuarios').insert({ usuario_id: usuario.id, carta_id: r.id, durabilidad_carta: 100 }); cartaGanada = '🎴'; refreshInventory() } }
        else if (bestSymbol === '💎') ganancia = 200
        else if (bestSymbol === '⭐') ganancia = 100
        else if (bestSymbol === '🍋') ganancia = 50
        else ganancia = 30
      } else if (maxCount === 2) {
        if (bestSymbol === '👑') ganancia = 100
        else if (bestSymbol === '💎') ganancia = 30
        else if (bestSymbol === '⭐') ganancia = 10
        else ganancia = 5
      }
      if (ganancia > 0) await supabase.rpc('devolver_monedas', { usuario_id: usuario.id, cantidad: ganancia })
      setSlotResult({ ganancia, carta: cartaGanada })
      setSlotSpinning(false)
      refreshUser()
    }, 2000)
  }

  useEffect(() => {
    if (!usuario) return
    const saved = localStorage.getItem(`tcg_pyg_${usuario.id}`)
    if (saved) setPygRealizada(Number(saved))
    loadSubastas()
    loadInversiones()
    loadDailyCards()
    checkDailyChest()
    if (Object.keys(tendenciasRef.current).length === 0) { ACTIVOS_BOLSA.forEach(a => { tendenciasRef.current[a.nombre] = Math.random() > 0.5 ? 1 : -1 }) }
    const interval = setInterval(() => {
      setInversiones(prev => prev.map(inv => {
        if (Math.random() < 0.3) tendenciasRef.current[inv.nombre_activo] = Math.random() > 0.5 ? 1 : -1
        const salto = Math.random() < 0.25 ? 2 : 1
        const cambio = tendenciasRef.current[inv.nombre_activo] * salto
        const nuevoValor = Math.max(1, Math.round(inv.valor_actual + cambio))
        return { ...inv, valor_actual: nuevoValor }
      }))
    }, 1000)
    return () => clearInterval(interval)
  }, [usuario])

  const loadDailyCards = async () => {
    const { data: allCards } = await supabase.from('cartas').select('*').order('created_at', { ascending: false })
    if (!allCards || allCards.length === 0) return
    const today = new Date().toDateString()
    let seed = 0
    for (let i = 0; i < today.length; i++) { seed = ((seed << 5) - seed) + today.charCodeAt(i); seed |= 0 }
    const shuffled = [...allCards].sort(() => { seed = (seed * 9301 + 49297) % 233280; return seed - Math.floor(seed / 2) * 2 })
    const selected = shuffled.filter((c: Carta) => c.rareza !== 'legendaria').slice(0, 3).map((c: Carta) => ({ ...c, precio: c.rareza === 'epica' ? 900 : c.rareza === 'rara' ? 500 : 350 }))
    setDailyCards(selected)
  }

  const checkDailyChest = () => {
    if (!usuario) return
    const key = `tcg_daily_chest_${usuario.id}`
    const lastClaim = localStorage.getItem(key)
    if (!lastClaim) { setCofreDisponible(true); return }
    setCofreDisponible(new Date().toDateString() !== lastClaim)
  }

  const claimDailyChest = async () => {
    if (!usuario) return
    setMensajeCofre('')
    const { data: allCards } = await supabase.from('cartas').select('*')
    if (!allCards || allCards.length === 0) { setMensajeCofre('No hay cartas'); return }
    const randomCard = allCards[Math.floor(Math.random() * allCards.length)]
    const { error: invError } = await supabase.from('inventario_usuarios').insert({ usuario_id: usuario.id, carta_id: randomCard.id, durabilidad_carta: 100 })
    if (invError) { setMensajeCofre('Error'); return }
    localStorage.setItem(`tcg_daily_chest_${usuario.id}`, new Date().toDateString())
    setCofreDisponible(false)
    setChestCard(randomCard)
    refreshInventory()
    refreshUser()
  }

  const buyDailyCard = async (card: Carta & { precio: number }) => {
    if (!usuario) return
    if (usuario.monedas < card.precio) { setError('No tienes suficientes monedas'); return }
    const { error: updErr } = await supabase.from('usuarios').update({ monedas: usuario.monedas - card.precio }).eq('id', usuario.id)
    if (updErr) { setError('Error al comprar'); return }
    const { error: invErr } = await supabase.from('inventario_usuarios').insert({ usuario_id: usuario.id, carta_id: card.id, durabilidad_carta: 100 })
    if (invErr) { await supabase.from('usuarios').update({ monedas: usuario.monedas }).eq('id', usuario.id); setError('Error'); return }
    setError(''); refreshUser(); refreshInventory()
    setDailyCards(prev => prev.filter(c => c.id !== card.id))
  }

  const loadSubastas = async () => {
    const { data } = await supabase.from('subastas').select('*, inventario:inventario_id(*, carta:cartas(*)), vendedor:vendedor_id(username, avatar_url), comprador_actual:comprador_actual_id(username)').eq('activa', true).order('fecha_fin', { ascending: true })
    if (data) setSubastas(data as unknown as Subasta[])
  }

  const loadInversiones = async () => {
    if (!usuario) return
    const { data } = await supabase.from('inversiones').select('*').eq('usuario_id', usuario.id)
    if (data) setInversiones(data)
  }

  const createAuction = async () => {
    if (!usuario || !selectedInventoryId || price <= 0) return
    setError('')
    const fechaFin = new Date()
    fechaFin.setHours(fechaFin.getHours() + 2) // 2 horas de duración
    const { error: err } = await supabase.from('subastas').insert({
      vendedor_id: usuario.id, inventario_id: selectedInventoryId, precio_salida: price, fecha_fin: fechaFin.toISOString(),
    })
    if (err) setError(err.message)
    else { setShowCreateAuction(false); loadSubastas() }
  }

  const placeBid = async (subastaId: string) => {
    if (!usuario) return
    const cantidad = bidAmount[subastaId] || 0
    setBidError('')
    try {
      const { data: subasta } = await supabase.from('subastas').select('*').eq('id', subastaId).single()
      if (!subasta) throw new Error('Subasta no encontrada')
      const pujaMinima = subasta.puja_actual ? subasta.puja_actual + 10 : subasta.precio_salida
      if (cantidad < pujaMinima) throw new Error(`Puja mínima: ${pujaMinima}`)
      const { data: user } = await supabase.from('usuarios').select('monedas').eq('id', usuario.id).single()
      if (!user || user.monedas < cantidad) throw new Error('No tienes suficientes monedas')
      if (subasta.comprador_actual_id && subasta.puja_actual) {
        await supabase.rpc('devolver_monedas', { usuario_id: subasta.comprador_actual_id, cantidad: subasta.puja_actual })
      }
      await supabase.rpc('congelar_monedas', { usuario_id: usuario.id, cantidad })
      const { error: bidErr } = await supabase.from('subastas').update({ puja_actual: cantidad, comprador_actual_id: usuario.id }).eq('id', subastaId)
      if (bidErr) throw bidErr
      loadSubastas(); refreshUser()
    } catch (err: any) { setBidError(err.message) }
  }

  const invest = async () => {
    if (!usuario || invertAmount <= 0) return
    setError('')
    const totalConComision = invertAmount + Math.ceil(invertAmount * 0.01)
    if (usuario.monedas < totalConComision) { setError(`Necesitas ${totalConComision} monedas (incluye 1% comisión)`); return }
    const { error: updErr } = await supabase.from('usuarios').update({ monedas: usuario.monedas - totalConComision }).eq('id', usuario.id)
    if (updErr) { setError('Error'); return }
    const { error: err } = await supabase.from('inversiones').insert({ usuario_id: usuario.id, nombre_activo: selectedActivo, cantidad_invertida: invertAmount, valor_actual: invertAmount })
    if (err) { await supabase.from('usuarios').update({ monedas: usuario.monedas }).eq('id', usuario.id); setError(err.message); return }
    refreshUser(); loadInversiones()
  }

  const sellInvestment = async (inversion: any) => {
    if (!usuario) return; setError('')
    const comision = Math.ceil(inversion.valor_actual * 0.01)
    const ganancia = inversion.valor_actual - comision
    const pygOperacion = ganancia - inversion.cantidad_invertida - Math.ceil(inversion.cantidad_invertida * 0.01)
    await supabase.rpc('devolver_monedas', { usuario_id: usuario.id, cantidad: ganancia })
    const { error: delErr } = await supabase.from('inversiones').delete().eq('id', inversion.id)
    if (delErr) { setError('Error al vender'); return }
    const nuevaPyg = pygRealizada + pygOperacion; setPygRealizada(nuevaPyg)
    localStorage.setItem(`tcg_pyg_${usuario.id}`, String(nuevaPyg))
    refreshUser(); loadInversiones()
  }

  if (!usuario) return null

  return (
    <div className="flex-1 space-y-4 p-4 pb-36">
      <div className="text-center">
        <h2 className="text-xl font-bold text-purple-400">🏪 Mercado</h2>
        <p className="text-sm text-gray-400">🪙 {usuario.monedas} monedas</p>
        {!isNaN(pygRealizada) && (
          <p className={`text-xs ${pygRealizada >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            PyG Realizada: {pygRealizada >= 0 ? '+' : ''}{pygRealizada.toFixed(1)}
          </p>
        )}
        {usuario.username === 'kanete9' && (
          <button onClick={resetSaldoTodos} disabled={resetting}
            className="mt-2 rounded bg-red-700 px-3 py-1 text-[10px] font-bold text-white hover:bg-red-600 disabled:opacity-50">
            {resetting ? '🔄 Reseteando...' : '🔄 Resetear saldos a 1000 (admin)'}
          </button>
        )}
      </div>

      {cofreDisponible && (
        <button onClick={claimDailyChest} className="w-full rounded-xl border border-yellow-600 bg-gradient-to-r from-yellow-900/50 to-orange-900/50 p-4 text-center transition-transform hover:scale-[1.02]">
          <div className="text-3xl">🎁</div>
          <p className="font-bold text-yellow-400">¡Cofre Diario!</p>
          <p className="text-xs text-yellow-300/70">Toca para recibir una carta gratis</p>
        </button>
      )}
      {mensajeCofre && <p className="text-center text-sm text-green-400">{mensajeCofre}</p>}

      {/* Modal cofre - carta obtenida */}
      {chestCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setChestCard(null)}>
          <div className="w-full max-w-xs rounded-2xl border-2 border-yellow-600 bg-gray-900 p-6 shadow-2xl text-center animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-2">🎁</div>
            <p className="text-sm font-bold text-yellow-400 mb-3">¡Has recibido una carta!</p>
            <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded inline-block mb-3 ${chestCard.rareza === 'legendaria' ? 'bg-orange-900/50 text-orange-400' : chestCard.rareza === 'epica' ? 'bg-purple-900/50 text-purple-400' : chestCard.rareza === 'rara' ? 'bg-blue-900/50 text-blue-400' : 'bg-gray-800 text-gray-400'}`}>
              {chestCard.rareza}
            </div>
            <div className="aspect-[3/4] w-full bg-gradient-to-b from-gray-700 to-gray-900 rounded-lg flex items-center justify-center mb-3">
              {chestCard.url_imagen ? <img src={chestCard.url_imagen} alt={chestCard.nombre} className="h-full w-full object-cover rounded-lg" /> : <span className="text-6xl">🃏</span>}
            </div>
            <p className="text-lg font-bold text-white">{chestCard.nombre}</p>
            {chestCard.descripcion && <p className="text-xs text-gray-400 mt-2 italic">{chestCard.descripcion}</p>}
            <button onClick={() => setChestCard(null)} className="mt-3 w-full rounded-lg bg-yellow-500 py-2 font-bold text-black hover:bg-yellow-400">¡Genial!</button>
          </div>
        </div>
      )}

      {dailyCards.length > 0 && (
        <div className="rounded-lg bg-gray-900 p-3">
          <h3 className="mb-2 text-sm font-bold text-green-400">🃏 Mercado del Día</h3>
          <p className="mb-2 text-[10px] text-gray-500">Estas cartas cambian cada día. ¡Cómpralas antes de que se agoten!</p>
          <div className="grid grid-cols-3 gap-2">
            {dailyCards.map(card => (
              <div key={card.id} className="rounded-lg border border-gray-700 bg-gray-800 p-2 text-center">
                <button onClick={() => setSelectedCard(card)} className="w-full text-center">
                  <div className="mb-1 text-2xl">🃏</div>
                  <p className="truncate text-xs font-bold">{card.nombre}</p>
                  <div className="mt-1 text-[10px] text-gray-400">
                    <span className={`text-[10px] uppercase ${card.rareza === 'legendaria' ? 'text-orange-400' : card.rareza === 'epica' ? 'text-purple-400' : card.rareza === 'rara' ? 'text-blue-400' : 'text-gray-500'}`}>{card.rareza}</span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-yellow-400">{card.precio} 🪙</p>
                </button>
                <button onClick={() => buyDailyCard(card)} disabled={usuario.monedas < card.precio} className="mt-1 w-full rounded bg-green-600 py-1 text-[10px] font-bold disabled:opacity-50">Comprar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg bg-gray-900 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-blue-400">📢 Subastas de Jugadores</h3>
          <button onClick={() => setShowCreateAuction(true)} className="rounded bg-blue-600 px-3 py-1 text-xs font-bold">+ Subastar</button>
        </div>
        {bidError && <p className="mb-2 text-xs text-red-400">{bidError}</p>}
        {subastas.length === 0 ? (
          <p className="text-center text-xs text-gray-500">No hay subastas activas</p>
        ) : (
          <div className="space-y-2">
            {subastas.map(subasta => (
              <div key={subasta.id} className="rounded-lg border border-gray-700 bg-gray-800 p-2">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-8 flex-shrink-0 rounded bg-gray-700 flex items-center justify-center text-xs">
                    {subasta.inventario?.carta?.url_imagen ? <img src={subasta.inventario.carta.url_imagen} alt="" className="h-full w-full object-cover rounded" /> : '🃏'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{subasta.inventario?.carta?.nombre || 'Carta'}</p>
                    <p className="text-[10px] text-gray-400">Por: {subasta.vendedor?.username} · {subasta.puja_actual ? `💰 ${subasta.puja_actual}` : `Salida: ${subasta.precio_salida}`}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="number" placeholder="Puja" value={bidAmount[subasta.id] || ''} onChange={e => setBidAmount({ ...bidAmount, [subasta.id]: Number(e.target.value) })} className="w-16 rounded border border-gray-700 bg-gray-900 p-1 text-xs text-white" />
                    <button onClick={() => placeBid(subasta.id)} className="rounded bg-green-600 px-2 py-1 text-[10px] font-bold">Pujar</button>
                  </div>
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-gray-500">
                  <span>❤️ {subasta.inventario?.durabilidad_carta}</span>
                  <span>⏱️ {new Date(subasta.fecha_fin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg bg-gray-900 p-3">
        <h3 className="mb-2 text-sm font-bold text-yellow-400">📈 Bolsa de Valores</h3>
        {inversiones.length > 0 && (
          <div className="mb-3 space-y-2">
            {(() => {
              const totalInvertido = inversiones.reduce((s, i) => s + i.cantidad_invertida, 0)
              const totalComisionCompra = inversiones.reduce((s, i) => s + Math.ceil(i.cantidad_invertida * 0.01), 0)
              const totalActual = inversiones.reduce((s, i) => s + i.valor_actual, 0)
              const totalComisionVenta = inversiones.reduce((s, i) => s + Math.ceil(i.valor_actual * 0.01), 0)
              const totalGastado = totalInvertido + totalComisionCompra
              const totalRecibido = totalActual - totalComisionVenta
              const pygTotal = totalRecibido - totalGastado
              const pct = totalGastado > 0 ? ((pygTotal / totalGastado) * 100) : 0
              return (
                <div className="flex justify-between rounded bg-gray-800/50 p-2 text-xs">
                  <span className="text-gray-400">PyG Real (con comisiones):</span>
                  <span className={pygTotal >= 0 ? 'text-green-400' : 'text-red-400'}>{pygTotal >= 0 ? '+' : ''}{pygTotal.toFixed(1)} ({pygTotal >= 0 ? '+' : ''}{pct.toFixed(1)}%)</span>
                </div>
              )
            })()}
            {inversiones.map(inv => {
              const comisionCompra = Math.ceil(inv.cantidad_invertida * 0.01)
              const comisionVenta = Math.ceil(inv.valor_actual * 0.01)
              const gastado = inv.cantidad_invertida + comisionCompra
              const recibido = inv.valor_actual - comisionVenta
              const diff = recibido - gastado
              return (
                <div key={inv.id} className="flex items-center justify-between rounded bg-gray-800 p-2 text-xs">
                  <div>
                    <p className="font-bold">{inv.nombre_activo}</p>
                    <p className="text-gray-500">Invertido: {inv.cantidad_invertida} + 1% ({comisionCompra})</p>
                    <p className={diff >= 0 ? 'text-green-400' : 'text-red-400'}>Neto si vendes: {recibido.toFixed(1)} ({diff >= 0 ? '+' : ''}{((diff / gastado) * 100).toFixed(1)}% real)</p>
                  </div>
                  <button onClick={() => sellInvestment(inv)} className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold">Vender</button>
                </div>
              )
            })}
          </div>
        )}
        <div className="flex items-center gap-2">
          <select value={selectedActivo} onChange={e => setSelectedActivo(e.target.value)} className="flex-1 rounded border border-gray-700 bg-gray-800 p-2 text-xs text-white">
            {ACTIVOS_BOLSA.map(a => <option key={a.nombre} value={a.nombre}>{a.emoji} {a.nombre}</option>)}
          </select>
          <input type="number" value={invertAmount} onChange={e => setInvertAmount(Number(e.target.value))} className="w-16 rounded border border-gray-700 bg-gray-800 p-2 text-xs text-white" min={10} />
          <button onClick={invest} className="rounded bg-yellow-600 px-3 py-2 text-xs font-bold">Invertir</button>
        </div>
        <p className="mt-2 text-[10px] text-gray-600 text-center">💰 Comisión del 1% por compra y 1% por venta</p>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>

      <div className="rounded-lg bg-gray-900 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-red-400">🎰 Tragaperras Mágicas</h3>
          <button onClick={() => setShowSlotInfo(!showSlotInfo)} className="rounded-full bg-gray-800 px-2 py-1 text-[10px] text-gray-400 hover:text-white transition-colors">{showSlotInfo ? '✕ Cerrar' : 'ℹ️ Premios'}</button>
        </div>
        <p className="text-[10px] text-gray-500 mb-3">¡Gasta 25 🪙 y prueba tu suerte!</p>
        {slotResult && (
          <div className="mb-3 text-center">
            <p className={`text-sm font-bold ${slotResult.ganancia > 0 ? 'text-green-400' : 'text-gray-500'}`}>
              {slotResult.ganancia > 0 ? `🎉 ¡Ganaste ${slotResult.ganancia} 🪙${slotResult.carta ? ' + una carta!' : ''}!` : '😢 No ganaste nada... ¡intenta de nuevo!'}
            </p>
          </div>
        )}
        {showSlotInfo && (
          <div className="mb-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-[10px]">
            <p className="font-bold text-yellow-400 mb-2">🏆 Tabla de Premios</p>
            <div className="space-y-1">
              <div className="flex justify-between"><span>👑👑👑</span><span className="text-green-400">50 🪙 + carta</span></div>
              <div className="flex justify-between"><span>💎💎💎</span><span className="text-green-400">200 🪙</span></div>
              <div className="flex justify-between"><span>⭐⭐⭐</span><span className="text-green-400">100 🪙</span></div>
              <div className="flex justify-between"><span>🍋🍋🍋</span><span className="text-green-400">50 🪙</span></div>
              <div className="flex justify-between"><span>🍒🍒🍒</span><span className="text-green-400">30 🪙</span></div>
              <div className="border-t border-gray-700 my-1" />
              <div className="flex justify-between"><span>2 👑</span><span className="text-blue-400">100 🪙</span></div>
              <div className="flex justify-between"><span>2 💎</span><span className="text-blue-400">30 🪙</span></div>
              <div className="flex justify-between"><span>2 ⭐</span><span className="text-blue-400">10 🪙</span></div>
              <div className="flex justify-between"><span>2 🍒/🍋</span><span className="text-blue-400">5 🪙</span></div>
            </div>
          </div>
        )}
        <div className="flex justify-center gap-3 mb-4">
          {slotReels.map((s, i) => (
            <div key={i} className={`flex h-20 w-20 items-center justify-center rounded-xl border-2 bg-gray-800 text-4xl transition-all duration-200 ${slotSpinning ? 'border-yellow-500 animate-pulse' : slotResult?.ganancia ? 'border-green-500' : 'border-gray-600'}`}>
              {slotSpinning ? <div className="animate-spin text-2xl">🎰</div> : s}
            </div>
          ))}
        </div>
        <button onClick={spinSlot} disabled={slotSpinning || (usuario?.monedas ?? 0) < 25}
          className="w-full rounded-lg bg-gradient-to-r from-red-600 to-yellow-600 py-3 text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100">
          {slotSpinning ? '🎰 Girando...' : usuario && usuario.monedas < 25 ? '❌ No tienes 25 🪙' : '🎰 ¡Girar! (25 🪙)'}
        </button>
      </div>

      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedCard(null)}>
          <div className="w-full max-w-xs rounded-2xl border-2 border-yellow-600 bg-gray-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${selectedCard.rareza === 'legendaria' ? 'bg-orange-900/50 text-orange-400' : selectedCard.rareza === 'epica' ? 'bg-purple-900/50 text-purple-400' : selectedCard.rareza === 'rara' ? 'bg-blue-900/50 text-blue-400' : 'bg-gray-800 text-gray-400'}`}>{selectedCard.rareza}</div>
              <button onClick={() => setSelectedCard(null)} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>
            <div className="aspect-[3/4] w-full bg-gradient-to-b from-gray-700 to-gray-900 rounded-lg flex items-center justify-center mb-3">
              {selectedCard.url_imagen ? <img src={selectedCard.url_imagen} alt={selectedCard.nombre} className="h-full w-full object-cover rounded-lg" /> : <span className="text-6xl">🃏</span>}
            </div>
            <p className="text-lg font-bold text-white text-center">{selectedCard.nombre}</p>
            {selectedCard.descripcion && <p className="text-xs text-gray-400 mt-2 text-center italic">{selectedCard.descripcion}</p>}
            <p className="text-sm font-bold text-yellow-400 text-center mt-2">{selectedCard.precio} 🪙</p>
            <button onClick={() => { buyDailyCard(selectedCard); setSelectedCard(null) }} disabled={usuario.monedas < selectedCard.precio}
              className="mt-3 w-full rounded-lg bg-green-600 py-2 text-sm font-bold disabled:opacity-50 hover:bg-green-500">
              {usuario.monedas < selectedCard.precio ? '❌ No tienes suficiente' : '🛒 Comprar'}
            </button>
          </div>
        </div>
      )}

      {showCreateAuction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-xl border border-gray-700 bg-gray-900 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-blue-400">📢 Crear Subasta</h3>
              <button onClick={() => setShowCreateAuction(false)} className="text-gray-400">✕</button>
            </div>
            <select value={selectedInventoryId} onChange={e => setSelectedInventoryId(e.target.value)} className="w-full rounded border border-gray-700 bg-gray-800 p-2 text-sm text-white">
              <option value="">Selecciona una carta</option>
              {inventory.map(item => <option key={item.id} value={item.id}>{item.carta?.nombre} (❤️ {item.durabilidad_carta})</option>)}
            </select>
            <p className="text-[10px] text-gray-500">Duración: 2 horas</p>
            <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full rounded border border-gray-700 bg-gray-800 p-2 text-sm text-white" placeholder="Precio de salida" min={10} />
            <button onClick={createAuction} className="w-full rounded-lg bg-blue-600 py-2 font-bold text-white">Publicar Subasta</button>
          </div>
        </div>
      )}
    </div>
  )
}