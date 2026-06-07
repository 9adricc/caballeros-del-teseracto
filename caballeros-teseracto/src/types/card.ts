export interface Carta {
  id: string
  nombre: string
  descripcion: string
  url_imagen: string | null
  rareza: 'comun' | 'rara' | 'epica' | 'legendaria'
  creado_por: string
  created_at: string
}

export interface InventarioCarta {
  id: string
  usuario_id: string
  carta_id: string
  durabilidad_carta: number
  acquired_at: string
  carta?: Carta
}