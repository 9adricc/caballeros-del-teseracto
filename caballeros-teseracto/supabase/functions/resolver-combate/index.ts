import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CartaData {
  nombre: string
  descripcion?: string
}

interface BuildData { cartas: CartaData[] }

interface Choice { texto: string; tipo: string; bonus: number }

interface BattleRound {
  situacion: string
  choices: Choice[]
  outcome: string
  dado_atacante: number
  dado_defensor: number
  ganador_id: string
  atacante_card?: string
  defensor_card?: string
}

interface BattleRequest {
  build_atacante: BuildData; build_defensor: BuildData; seed: number
  atacante_id: string; defensor_id: string | null
  username_atacante: string; username_defensor: string
  tipo: 'pvp' | 'pve'; arena_actual?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body: BattleRequest = await req.json()
    const { build_atacante, build_defensor, seed, atacante_id, defensor_id, username_atacante, username_defensor, tipo, arena_actual } = body
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')

    const rounds: BattleRound[] = []
    let ganadasAtacante = 0, ganadasDefensor = 0
    let currentSeed = seed
    const numRondas = Math.min(build_atacante.cartas.length, build_defensor.cartas.length, 3)

    for (let i = 0; i < numRondas; i++) {
      currentSeed = Math.abs((currentSeed * 9301 + 49297) % 233280)
      const cartaAtk = build_atacante.cartas[i] || build_atacante.cartas[0]
      const cartaDef = build_defensor.cartas[i] || build_defensor.cartas[0]
      // Solo dados D20, sin stats
      const dadoAtk = (currentSeed % 20) + 1
      const dadoDef = (Math.abs(currentSeed * 7) % 20) + 1
      const ganadorRound = dadoAtk > dadoDef ? 'atacante' : 'defensor'
      if (ganadorRound === 'atacante') ganadasAtacante++
      else ganadasDefensor++

      let situacion = ''
      let choices: Choice[] = []
      let outcome = ''

      if (deepseekApiKey) {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 8000)
          const arena = arena_actual || 'El Sótano de la Vergüenza'
          const descAtk = cartaAtk.descripcion || ''
          const descDef = cartaDef.descripcion || ''

          const prompt = `Seed:${currentSeed}. Ronda ${i+1}/${numRondas} en ${arena}.

Atacante: ${username_atacante}
Carta: "${cartaAtk.nombre}" ${descAtk ? `(descripción: "${descAtk.substring(0, 100)}")` : ''}

Defensor: ${username_defensor}
Carta: "${cartaDef.nombre}" ${descDef ? `(descripción: "${descDef.substring(0, 100)}")` : ''}

Dados: ${username_atacante}=${dadoAtk} vs ${username_defensor}=${dadoDef}
Ganador de la ronda: ${ganadorRound === 'atacante' ? username_atacante : username_defensor}

RESPONDE SOLO JSON SIN EXPLICACIONES:
{"situacion":"Narración surrealista y única de la ronda usando las descripciones de las cartas (máx 300 chars)","choices":[{"texto":"Opción creativa","tipo":"heroico|astuto|absurdo|arriesgado|tramposo","bonus":0},{"texto":"Opción creativa","tipo":"...","bonus":0},{"texto":"Opción creativa","tipo":"...","bonus":0}],"outcome":"Narración del resultado basado en los dados (máx 300 chars)"}`

          const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
            signal: controller.signal,
            method: 'POST',
            headers: { 'Authorization': `Bearer ${deepseekApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 1.5, max_tokens: 600 }),
          })
          clearTimeout(timeout)
          if (res.ok) {
            const data = await res.json()
            try {
              const parsed = JSON.parse(data.choices[0].message.content)
              if (parsed.situacion && parsed.choices && parsed.outcome) {
                situacion = parsed.situacion
                choices = parsed.choices.slice(0, 3)
                outcome = parsed.outcome
              }
            } catch {}
          }
        } catch (e) { console.error('DeepSeek error:', e) }
      }

      if (!situacion) {
        situacion = `${arena_actual || 'El Sótano de la Vergüenza'}. ${username_atacante} saca su carta "${cartaAtk.nombre}" mientras ${username_defensor} responde con "${cartaDef.nombre}". Los dados ruedan: ${dadoAtk} contra ${dadoDef}.`
      }
      if (choices.length === 0) {
        choices = [
          { texto: `Atacar con decisión usando ${cartaAtk.nombre}`, tipo: 'heroico', bonus: 3 },
          { texto: `Esperar el momento oportuno`, tipo: 'astuto', bonus: 1 },
          { texto: `Hacer algo totalmente inesperado`, tipo: 'absurdo', bonus: 0 },
        ]
      }
      if (!outcome) {
        outcome = `Dados: ${dadoAtk} para ${username_atacante}, ${dadoDef} para ${username_defensor}. ¡${ganadorRound === 'atacante' ? username_atacante : username_defensor} gana la ronda!`
      }

      rounds.push({ situacion, choices, outcome, dado_atacante: dadoAtk, dado_defensor: dadoDef, ganador_id: ganadorRound, atacante_card: cartaAtk.nombre, defensor_card: cartaDef.nombre })
    }

    const ganadorGlobal = ganadasAtacante > ganadasDefensor ? 'atacante' : 'defensor'
    const ganadorId = ganadorGlobal === 'atacante' ? atacante_id : (defensor_id || atacante_id)
    const perdedorId = ganadorGlobal === 'atacante' ? defensor_id : atacante_id

    let trofeosCambiadosGlobal = 0
    if (tipo === 'pvp' && ganadorId && perdedorId) {
      trofeosCambiadosGlobal = 20
      const { data: gData } = await supabaseClient.from('usuarios').select('trofeos').eq('id', ganadorId).single()
      if (gData) await supabaseClient.from('usuarios').update({ trofeos: (gData.trofeos || 0) + 20 }).eq('id', ganadorId)
      const { data: pData } = await supabaseClient.from('usuarios').select('trofeos').eq('id', perdedorId).single()
      if (pData) await supabaseClient.from('usuarios').update({ trofeos: Math.max(0, (pData.trofeos || 0) - 10) }).eq('id', perdedorId)
    }

    await supabaseClient.rpc('devolver_monedas', { usuario_id: ganadorId, cantidad: tipo === 'pvp' ? 50 : 25 })
    if (tipo === 'pvp' && perdedorId) {
      const { data: inv } = await supabaseClient.from('inventario_usuarios').select('id').eq('usuario_id', perdedorId)
      if (inv) for (const item of inv.slice(0, 3)) await supabaseClient.rpc('reducir_durabilidad', { inventario_id: item.id, dano: Math.ceil(50 / 3) })
    }
    await supabaseClient.from('historial_combates').insert({
      atacante_id, defensor_id: tipo === 'pvp' ? defensor_id : null, ganador_id: ganadorId, dano_infligido: 50,
      historia: `${username_atacante} vs ${username_defensor} en ${arena_actual || 'el Sótano'}!`, tipo,
    })
    return new Response(JSON.stringify({
      rounds, ganador_id: ganadorId,
      ganador_nombre: ganadorGlobal === 'atacante' ? username_atacante : username_defensor,
      perdedor_nombre: ganadorGlobal === 'atacante' ? username_defensor : username_atacante,
      rondas_ganadas_atacante: ganadasAtacante, rondas_ganadas_defensor: ganadasDefensor,
      trofeos_cambiados: trofeosCambiadosGlobal, arena: arena_actual || 'El Sótano de la Vergüenza',
      cartas_ronda: rounds.map(r => ({ atacante: r.atacante_card, defensor: r.defensor_card })),
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  }
})