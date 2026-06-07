export interface Usuario {
  id: string
  username: string
  avatar_url: string | null
  monedas: number
  puntos_vida: number
  carta_defensiva_id: string | null
  pin_acceso?: string
  fecha_registro: string
  trofeos?: number
}

export interface AuthSession {
  usuario: Usuario
}