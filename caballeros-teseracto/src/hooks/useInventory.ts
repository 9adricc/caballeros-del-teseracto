import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import type { InventarioCarta } from '../types/card'

export function useInventory(usuarioId: string | undefined) {
  const [inventory, setInventory] = useState<InventarioCarta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!usuarioId) return
    loadInventory()
  }, [usuarioId])

  const loadInventory = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('inventario_usuarios')
      .select('*, cartas(*)')
      .eq('usuario_id', usuarioId)
    if (data) {
      setInventory(
        data.map((item: any) => ({
          id: item.id,
          usuario_id: item.usuario_id,
          carta_id: item.carta_id,
          durabilidad_carta: item.durabilidad_carta,
          acquired_at: item.acquired_at,
          carta: item.cartas,
        }))
      )
    }
    setLoading(false)
  }

  const setDefensiveCard = async (inventarioId: string) => {
    if (!usuarioId) return
    await supabase
      .from('usuarios')
      .update({ carta_defensiva_id: inventarioId })
      .eq('id', usuarioId)
  }

  return { inventory, loading, setDefensiveCard, refresh: loadInventory }
}