export interface Mensaje {
  id: string
  usuario_id: string
  texto: string
  created_at: string
  usuarios?: {
    username: string
    avatar_url: string | null
  }
}