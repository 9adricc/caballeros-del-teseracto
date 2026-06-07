import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../config/supabase'
import type { Usuario } from '../types/user'
import type { InventarioCarta } from '../types/card'
import type { HistorialCombate } from '../types/battle'

interface Arena {
  id: string
  nombre: string
  descripcion: string
  emoji: string
  trofeos_min: number
  trofeos_max: number
}

interface RoundChoice {
  texto: string
  tipo: string
  bonus?: number
}

interface BattleRound {
  situacion: string
  choices: RoundChoice[]
  outcome: string
  dado_atacante: number
  dado_defensor: number
  ganador_id: string
  atacante_card?: string
  defensor_card?: string
}

interface BattleData {
  rounds: BattleRound[]
  ganador_id: string
  ganador_nombre: string
  perdedor_nombre: string
  rondas_ganadas_atacante: number
  rondas_ganadas_defensor: number
  trofeos_cambiados?: number
  arena: string
  cartas_ronda?: { atacante: string; defensor: string }[]
}

const ARENAS_LOCAL: Arena[] = [
  { id: '1', nombre: 'Sótano de Ceballos', descripcion: 'Todos empiezan aquí, no te rayes', emoji: '🕳️', trofeos_min: 0, trofeos_max: 99 },
  { id: '2', nombre: 'Prostíbulo de Molero', descripcion: 'Polvo, sudor y criptomineros', emoji: '🍆', trofeos_min: 100, trofeos_max: 199 },
  { id: '3', nombre: 'Logia Masónica de Kanete', descripcion: 'Las reglas son confusas pero divertidas', emoji: '🧙', trofeos_min: 200, trofeos_max: 299 },
  { id: '4', nombre: 'Casa de Javi en Bari', descripcion: 'Todo el mundo está de resaca. Incluso los árboles.', emoji: '🏠', trofeos_min: 300, trofeos_max: 399 },
  { id: '5', nombre: 'Jowke', descripcion: 'Aquí los sueños vienen a morir... o a cobrar', emoji: '🎮', trofeos_min: 400, trofeos_max: 499 },
  { id: '6', nombre: 'Parque Oeste', descripcion: 'Nadie sabe cómo llegaste aquí, pero todos te deben dinero', emoji: '🌳', trofeos_min: 500, trofeos_max: 599 },
  { id: '7', nombre: 'Renfe Cercanías', descripcion: 'Los antiguos programadores lloran al entrar', emoji: '🚂', trofeos_min: 600, trofeos_max: 699 },
  { id: '8', nombre: 'Fiestas de Arroyomolinos', descripcion: 'Solo los legendarios sobreviven aquí. Y los bots.', emoji: '🎉', trofeos_min: 700, trofeos_max: 799 },
  { id: '9', nombre: 'La Pirámide del Alquimista', descripcion: 'Los antiguos programadores lloran al entrar', emoji: '🔺', trofeos_min: 800, trofeos_max: 899 },
  { id: '10', nombre: 'Minas del Escandinavo', descripcion: 'Solo los legendarios sobreviven aquí. Y los bots.', emoji: '⛏️', trofeos_min: 900, trofeos_max: 999 },
]

export default function ArenaPage() {
  const { usuario, refreshUser } = useAuth()
  const [amigos, setAmigos] = useState<Usuario[]>([])
  const [selectedFriend, setSelectedFriend] = useState<Usuario | null>(null)
  const [battleData, setBattleData] = useState<BattleData | null>(null)
  const [showBattle, setShowBattle] = useState(false)
  const [loading, setLoading] = useState(false)
  const [historial, setHistorial] = useState<HistorialCombate[]>([])
  const [buildAtacante, setBuildAtacante] = useState<InventarioCarta[]>([])
  const [buildDefensor, setBuildDefensor] = useState<InventarioCarta[]>([])
  const [arenaActual, setArenaActual] = useState<Arena>(ARENAS_LOCAL[0])
  const [showArenaSelector, setShowArenaSelector] = useState(false)
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0)
  const [battleFinished, setBattleFinished] = useState(false)
  const [choiceMade, setChoiceMade] = useState<Record<number, number>>({})

  useEffect(() => {
    if (!usuario) return
    loadFriends()
    loadHistorial()
    loadBuild()
  }, [usuario])

  const getArenaForTrofeos = (trofeos: number): Arena => {
    return ARENAS_LOCAL.find(a => trofeos >= a.trofeos_min && trofeos <= a.trofeos_max) || ARENAS_LOCAL[0]
  }

  useEffect(() => {
    if (usuario) setArenaActual(getArenaForTrofeos(usuario.trofeos || 0))
  }, [usuario?.trofeos])

  const loadBuild = async () => {
    if (!usuario) return
    const saved = localStorage.getItem(`tcg_build_${usuario.id}`)
    if (saved) {
      const ids: string[] = JSON.parse(saved)
      if (ids.length > 0) {
        const { data } = await supabase.from('inventario_usuarios').select('*, cartas(*)').in('id', ids)
        if (data) setBuildAtacante(data.map((item: any) => ({ id: item.id, usuario_id: item.usuario_id, carta_id: item.carta_id, durabilidad_carta: item.durabilidad_carta, acquired_at: item.acquired_at, carta: item.cartas })))
      }
    }
  }

  const loadFriends = async () => {
    const { data } = await supabase.from('usuarios').select('*').neq('id', usuario?.id)
    if (data) setAmigos(data as Usuario[])
  }

  const loadHistorial = async () => {
    const { data } = await supabase.from('historial_combates').select('*').or(`atacante_id.eq.${usuario?.id},defensor_id.eq.${usuario?.id}`).order('created_at', { ascending: false }).limit(10)
    if (data) setHistorial(data as HistorialCombate[])
  }

  const selectFriend = async (friend: Usuario) => {
    setSelectedFriend(friend)
    const { data } = await supabase.from('inventario_usuarios').select('*, cartas(*)').eq('usuario_id', friend.id).limit(3)
    if (data) setBuildDefensor(data.map((item: any) => ({ id: item.id, usuario_id: item.usuario_id, carta_id: item.carta_id, durabilidad_carta: item.durabilidad_carta, acquired_at: item.acquired_at, carta: item.cartas })))
  }

  const [ataquesHoy, setAtaquesHoy] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!usuario) return
    const saved = localStorage.getItem(`tcg_attacks_${usuario?.id}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.date === new Date().toDateString()) {
          setAtaquesHoy(parsed.attacks || {})
        }
      } catch {}
    }
  }, [usuario])

  const getAtaquesRestantes = (amigoId: string): number => {
    return 3 - (ataquesHoy[amigoId] || 0)
  }

  const startBattle = async () => {
    if (!usuario || buildAtacante.length === 0 || !selectedFriend || buildDefensor.length === 0) return
    if (getAtaquesRestantes(selectedFriend.id) <= 0) {
      alert('¡Ya has atacado 3 veces a este jugador hoy! Vuelve mañana.')
      return
    }
    setLoading(true)
    setShowBattle(false)
    setBattleFinished(false)
    setCurrentRoundIndex(0)
    setChoiceMade({})

    const { data, error } = await supabase.functions.invoke('resolver-combate', {
      body: {
        build_atacante: { cartas: buildAtacante.map(item => ({ nombre: item.carta?.nombre || '?', descripcion: item.carta?.descripcion || '' })) },
        build_defensor: { cartas: buildDefensor.map(item => ({ nombre: item.carta?.nombre || '?', descripcion: item.carta?.descripcion || '' })) },
        seed: Math.floor(Math.random() * 1000000),
        atacante_id: usuario.id,
        defensor_id: selectedFriend.id,
        username_atacante: usuario.username,
        username_defensor: selectedFriend.username,
        tipo: 'pvp',
        arena_actual: arenaActual.nombre,
      },
    })

    if (error || !data) { console.error('Battle error:', error); setLoading(false); return }
    const result = data as BattleData & { error?: string }
    if (!result.error && result.rounds) {
      setBattleData(result); setShowBattle(true); setLoading(false); setCurrentRoundIndex(0); setBattleFinished(false)
      if (result.trofeos_cambiados) refreshUser()
    }
    loadHistorial()
  }

  if (!usuario) return null

  const currentArenaIndex = ARENAS_LOCAL.findIndex(a => a.id === arenaActual.id)
  const nextArena = currentArenaIndex < ARENAS_LOCAL.length - 1 ? ARENAS_LOCAL[currentArenaIndex + 1] : null
  const trofeosParaSubir = nextArena ? nextArena.trofeos_min - (usuario.trofeos || 0) : 0

  // --- PANTALLA DE ROL ---
  if (showBattle && battleData) {
    const round = battleData.rounds[currentRoundIndex]
    const soyAtacante = battleData.ganador_id === usuario.id
    const ganadasYo = soyAtacante ? battleData.rondas_ganadas_atacante : battleData.rondas_ganadas_defensor
    const ganadasRival = soyAtacante ? battleData.rondas_ganadas_defensor : battleData.rondas_ganadas_atacante
    const miNombre = usuario.username
    const rivalNombre = soyAtacante ? battleData.perdedor_nombre : battleData.ganador_nombre
    const esUltimaRonda = currentRoundIndex >= battleData.rounds.length - 1
    const yaElegido = choiceMade[currentRoundIndex] !== undefined
    const ganadorRonda = (round.ganador_id === 'atacante' && soyAtacante) || (round.ganador_id === 'defensor' && !soyAtacante)

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-gray-950 via-purple-950/20 to-gray-950">
        {/* Header con cartas activas */}
        <div className="flex items-center justify-center px-4 py-2 bg-gray-900/80 border-b border-amber-800/50 flex-shrink-0">
          <div className="text-center w-full max-w-lg">
            <p className="text-[10px] text-amber-500 font-semibold tracking-[0.2em] uppercase">{battleData.arena}</p>
            <p className="text-xs text-gray-500 mt-0.5">Ronda {currentRoundIndex + 1}/{battleData.rounds.length}</p>
            <div className="flex items-center justify-between mt-1 gap-2">
              {/* Mi lado */}
              <div className="flex-1 text-right">
                <p className="text-xs font-bold text-green-400 truncate">{miNombre}</p>
                <p className="text-[9px] text-green-300/70 truncate">
                  🃏 {battleData.cartas_ronda?.[currentRoundIndex]?.atacante || round.atacante_card || '?'}
                </p>
                <p className="text-xs text-green-300 font-bold">{ganadasYo}</p>
              </div>
              
              <div className="flex-shrink-0">
                <p className="text-[10px] font-black text-yellow-500 animate-vs">VS</p>
              </div>
              
              {/* Lado rival */}
              <div className="flex-1 text-left">
                <p className="text-xs font-bold text-red-400 truncate">{rivalNombre}</p>
                <p className="text-[9px] text-red-300/70 truncate">
                  🃏 {battleData.cartas_ronda?.[currentRoundIndex]?.defensor || round.defensor_card || '?'}
                </p>
                <p className="text-xs text-red-300 font-bold">{ganadasRival}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Zona de rol */}
        <div className="flex-1 overflow-y-auto px-6 py-6 pb-28">
          <div className="w-full max-w-lg mx-auto space-y-6">
            {!yaElegido ? (
              <>
                {/* Situación - El DM narra */}
                <div className="rounded-xl border border-amber-700/40 bg-gradient-to-br from-amber-950/30 to-yellow-950/20 p-5 backdrop-blur">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🎲</span>
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.2em]">Dungeon Master</p>
                  </div>
                  <p className="text-sm leading-relaxed text-amber-100/90 italic">
                    {round.situacion}
                  </p>
                </div>

                {/* Opciones de rol */}
                <div>
                  <p className="text-[11px] font-bold text-blue-400 mb-3 tracking-wider uppercase">🎯 ¿Qué haces?</p>
                  <div className="space-y-2">
                    {round.choices.map((choice, ci) => (
                      <button
                        key={ci}
                        onClick={() => setChoiceMade(prev => ({ ...prev, [currentRoundIndex]: ci }))}
                        className="w-full rounded-xl border border-gray-700/60 bg-gray-800/60 p-3.5 text-left transition-all hover:border-blue-500/60 hover:bg-blue-900/15 hover:shadow-lg hover:shadow-blue-500/5"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-lg ${choice.tipo === 'heroico' ? 'text-red-400' : choice.tipo === 'astuto' ? 'text-green-400' : choice.tipo === 'absurdo' ? 'text-yellow-400' : choice.tipo === 'arriesgado' ? 'text-orange-400' : 'text-purple-400'}`}>
                            {choice.tipo === 'heroico' ? '⚔️' : choice.tipo === 'astuto' ? '🦊' : choice.tipo === 'absurdo' ? '🤪' : choice.tipo === 'arriesgado' ? '💀' : '🪤'}
                          </span>
                          <span className="text-sm font-medium text-gray-200">{choice.texto}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Tirada de dados */}
                <div className="flex items-center justify-center gap-6 py-2">
                  <div className="text-center">
                    <p className="text-[10px] text-green-400 mb-1">{miNombre}</p>
                    <div className={`inline-block rounded-xl border-2 p-3 ${round.dado_atacante >= 15 ? 'border-green-500 bg-green-950/30' : round.dado_atacante >= 10 ? 'border-yellow-500 bg-yellow-950/30' : 'border-red-500 bg-red-950/30'}`}>
                      <span className="text-3xl">🎲</span>
                      <p className={`text-2xl font-bold mt-1 ${round.dado_atacante >= 15 ? 'text-green-400' : round.dado_atacante >= 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {round.dado_atacante}
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-yellow-500">VS</p>
                    <p className="text-xs text-gray-600 mt-2">D20</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-red-400 mb-1">{rivalNombre}</p>
                    <div className={`inline-block rounded-xl border-2 p-3 ${round.dado_defensor >= 15 ? 'border-green-500 bg-green-950/30' : round.dado_defensor >= 10 ? 'border-yellow-500 bg-yellow-950/30' : 'border-red-500 bg-red-950/30'}`}>
                      <span className="text-3xl">🎲</span>
                      <p className={`text-2xl font-bold mt-1 ${round.dado_defensor >= 15 ? 'text-green-400' : round.dado_defensor >= 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {round.dado_defensor}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Desenlace narrado por el DM */}
                <div className="rounded-xl border border-purple-700/40 bg-gradient-to-br from-purple-950/30 to-indigo-950/20 p-5 backdrop-blur">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">📜</span>
                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.2em]">Dungeon Master</p>
                  </div>
                  <p className="text-sm leading-relaxed text-purple-100/90 italic">
                    {round.outcome}
                  </p>
                  <div className="mt-3 text-center">
                    <span className={`inline-block rounded-full px-5 py-1.5 text-xs font-bold tracking-wider ${ganadorRonda ? 'bg-green-900/50 text-green-300 border border-green-500/30' : 'bg-red-900/50 text-red-300 border border-red-500/30'}`}>
                      {ganadorRonda ? '🏆 Victoria en esta ronda' : '💀 Derrota en esta ronda'}
                    </span>
                  </div>
                </div>

                {/* Botón de siguiente dentro del scroll */}
                {!battleFinished && (
                  <button
                    onClick={() => {
                      if (esUltimaRonda) setBattleFinished(true)
                      else setCurrentRoundIndex(prev => prev + 1)
                    }}
                    className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-3 font-bold text-white hover:from-purple-500 hover:to-blue-500 transition-all animate-pulse"
                  >
                    {esUltimaRonda ? '🏆 Ver resultado final' : '🎲 Continuar la historia'}
                  </button>
                )}
              </>
            )}

            {/* Botón final cuando battleFinished */}
            {battleFinished && (
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-4xl mb-1">{battleData.ganador_id === usuario.id ? '🏆' : '💀'}</div>
                  <p className={`text-xl font-bold ${battleData.ganador_id === usuario.id ? 'text-green-400' : 'text-red-400'}`}>
                    {battleData.ganador_id === usuario.id ? '¡HAS GANADO EL DUELO!' : 'HAS PERDIDO EL DUELO'}
                  </p>
                  <div className="flex items-center justify-center gap-6 mt-2">
                    <span className="text-sm text-green-400">{miNombre} {ganadasYo}</span>
                    <span className="text-xs text-gray-600">-</span>
                    <span className="text-sm text-red-400">{rivalNombre} {ganadasRival}</span>
                  </div>
                  {battleData.trofeos_cambiados && battleData.ganador_id === usuario.id && (
                    <p className="text-sm text-yellow-400 mt-1">+{battleData.trofeos_cambiados} 🏆 Trofeos</p>
                  )}
                </div>
                <button onClick={() => { setShowBattle(false); setBattleData(null); setChoiceMade({}) }} className="w-full rounded-xl bg-yellow-500 py-3 font-bold text-black hover:bg-yellow-400 transition-all">
                  Volver a la Arena
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // --- PANTALLA PRINCIPAL ---
  return (
    <div className="flex-1 space-y-4 p-4 pb-36">
      <div className="text-center">
        <h2 className="text-xl font-bold text-red-400">⚔️ Arena de Combate</h2>
        <p className="text-sm text-gray-400">Partida de rol por rondas</p>
      </div>

      <div className="rounded-lg bg-gray-900 p-3 text-center cursor-pointer transition-colors hover:bg-gray-800" onClick={() => setShowArenaSelector(!showArenaSelector)}>
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">{arenaActual.emoji}</span>
          <div>
            <p className="font-bold text-yellow-400">{arenaActual.nombre}</p>
            <p className="text-xs text-gray-400">🏆 {usuario.trofeos || 0} trofeos</p>
          </div>
        </div>
        {nextArena && trofeosParaSubir > 0 && <p className="mt-1 text-[10px] text-purple-400">Te faltan {trofeosParaSubir} 🏆 para {nextArena.emoji} {nextArena.nombre}</p>}
        <p className="mt-1 text-[9px] text-gray-600">{arenaActual.descripcion}</p>
      </div>

      {showArenaSelector && (
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
          <p className="text-xs font-bold text-gray-400 mb-2">🏟️ Selecciona Arena</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {ARENAS_LOCAL.map((arena) => {
              const unlocked = (usuario.trofeos || 0) >= arena.trofeos_min
              return (
                <button key={arena.id} onClick={() => { if (unlocked) { setArenaActual(arena); setShowArenaSelector(false) } }} disabled={!unlocked}
                  className={`w-full rounded p-2 text-left text-xs transition-colors ${arena.id === arenaActual.id ? 'bg-yellow-900/30 border border-yellow-600' : unlocked ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-800/50 opacity-40'}`}
                >
                  <span className="mr-1">{arena.emoji}</span>
                  <span className={unlocked ? 'text-gray-200' : 'text-gray-500'}>{arena.nombre}</span>
                  {!unlocked && <span className="text-gray-600 ml-1">🔒</span>}
                  <span className="text-gray-500 ml-1">({arena.trofeos_min}-{arena.trofeos_max})</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-purple-700 bg-purple-950/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-purple-400">⚔️ Tu Build</h3>
        </div>
        {buildAtacante.length === 0 ? (
          <p className="text-xs text-yellow-400">⚠️ No tienes build. Ve a Colección y selecciona 3 cartas.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {buildAtacante.map((item) => (
              <div key={item.id} className="rounded-lg border border-purple-600 bg-gray-800 p-1 text-center">
                <div className="text-lg">🃏</div>
                <p className="truncate text-[10px] font-bold">{item.carta?.nombre}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-orange-400">👥 Retar Amigos</h3>
        <p className="mb-2 text-[10px] text-gray-500">Combate de rol: gana 30🏆 y 50🪙</p>
        <div className="space-y-2">
          {amigos.map((amigo) => (
            <div key={amigo.id} className={`rounded-lg border p-3 transition-colors ${selectedFriend?.id === amigo.id ? 'border-blue-500 bg-blue-950/50' : 'border-gray-700 bg-gray-800'}`}>
              <button onClick={() => selectFriend(amigo)} className="w-full text-left">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-700 flex-shrink-0">
                    {amigo.avatar_url ? <img src={amigo.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-lg">👤</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{amigo.username}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <span>🏆 {amigo.trofeos || 0}</span>
                      <span>🪙 {amigo.monedas}</span>
                    </div>
                  </div>
                </div>
              </button>
              {selectedFriend?.id === amigo.id && (
                <div className="mt-2">
                  {buildDefensor.length > 0 ? (
                    <div className="mb-2">
                      <p className="text-[10px] text-gray-500 mb-1">Cartas de {amigo.username}:</p>
                      <div className="flex gap-1">
                        {buildDefensor.map((item) => (
                          <div key={item.id} className="flex-1 rounded bg-gray-700/50 p-1 text-center">
                            <p className="truncate text-[9px]">{item.carta?.nombre || '?'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <p className="text-xs text-yellow-400 mb-2">⚠️ Sin cartas</p>}
                  <button onClick={startBattle} disabled={loading || buildDefensor.length === 0 || buildAtacante.length === 0}
                    className="w-full rounded bg-red-600 py-2 text-xs font-bold disabled:opacity-50 hover:bg-red-500">
                    {loading ? '🎲 Preparando partida...' : '🎲 ¡Iniciar partida de rol!'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {historial.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-gray-400">📜 Historial</h3>
          <div className="space-y-1">
            {historial.map((h) => (
              <div key={h.id} className="rounded bg-gray-800/50 p-2 text-xs text-gray-400">
                <span className={h.ganador_id === usuario.id ? 'text-green-400' : 'text-red-400'}>⚔️ {h.historia.substring(0, 80)}...</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="animate-pulse text-center">
            <div className="text-3xl mb-2">📖</div>
            <div className="text-lg font-bold text-yellow-400">El Dungeon Master prepara la historia...</div>
            <p className="text-sm text-gray-400 mt-1">Una aventura épica te espera</p>
          </div>
        </div>
      )}
    </div>
  )
}