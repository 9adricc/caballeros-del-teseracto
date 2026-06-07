export interface Choice {
  texto: string
  tipo: 'ataque_agresivo' | 'ataque_defensivo' | 'habilidad' | 'arriesgado' | 'trampa'
  dado_bonus: number
  defensa_bonus: number
}

export interface BattleRound {
  atacante_card: string
  defensor_card: string
  dado_atacante: number
  dado_defensor: number
  narracion: string
  dano_round: number
  ganador_round: 'atacante' | 'defensor' | 'empate'
  choices?: Choice[]
  eleccion_jugador?: number
}

export interface BattleRequest {
  carta_atacante: {
    nombre: string
    ataque: number
    defensa: number
  }
  carta_defensora: {
    nombre: string
    ataque: number
    defensa: number
  }
  seed: number
}

export interface BattleResult {
  historia: string
  ganador_id: string
  dano_infligido: number
}

export interface HistorialCombate {
  id: string
  atacante_id: string
  defensor_id: string | null
  carta_atacante_id: string
  carta_defensora_id: string
  ganador_id: string | null
  dano_infligido: number
  historia: string
  tipo: 'pvp' | 'pve'
  created_at: string
}
