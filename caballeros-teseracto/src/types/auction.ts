export interface Subasta {
  id: string
  vendedor_id: string
  inventario_id: string
  precio_salida: number
  puja_actual: number | null
  comprador_actual_id: string | null
  fecha_fin: string
  activa: boolean
  created_at: string
  inventario?: {
    durabilidad_carta: number
    carta?: {
      id: string
      nombre: string
      url_imagen: string | null
      rareza: string
      ataque: number
      defensa: number
    }
  }
  vendedor?: {
    username: string
    avatar_url: string | null
  }
  comprador_actual?: {
    username: string
  }
}