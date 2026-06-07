import { supabase } from '../config/supabase'
import type { Carta } from '../types/card'
import type { Subasta } from '../types/auction'
import type { Usuario } from '../types/user'

// ---- Cartas ----
export async function getAllCards(): Promise<Carta[]> {
  const { data } = await supabase.from('cartas').select('*').order('created_at', { ascending: false })
  return (data as Carta[]) || []
}

export async function createCard(card: Omit<Carta, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('cartas').insert(card).select().single()
  if (error) throw error
  return data as Carta
}

// ---- Subastas ----
export async function getActiveAuctions(): Promise<Subasta[]> {
  const { data } = await supabase
    .from('subastas')
    .select('*, inventario:inventario_id(*, carta:cartas(*)), vendedor:vendedor_id(username, avatar_url), comprador_actual:comprador_actual_id(username)')
    .eq('activa', true)
    .order('fecha_fin', { ascending: true })
  return (data as Subasta[]) || []
}

export async function createAuction(vendedorId: string, inventarioId: string, precioSalida: number, duracionHoras: number = 24) {
  const fechaFin = new Date()
  fechaFin.setHours(fechaFin.getHours() + duracionHoras)
  const { error } = await supabase.from('subastas').insert({
    vendedor_id: vendedorId,
    inventario_id: inventarioId,
    precio_salida: precioSalida,
    fecha_fin: fechaFin.toISOString(),
  })
  if (error) throw error
}

export async function placeBid(subastaId: string, userId: string, cantidad: number) {
  const { data: subasta } = await supabase.from('subastas').select('*').eq('id', subastaId).single()
  if (!subasta) throw new Error('Subasta no encontrada')

  const pujaMinima = subasta.puja_actual ? subasta.puja_actual + 10 : subasta.precio_salida
  if (cantidad < pujaMinima) throw new Error(`La puja mínima es ${pujaMinima}`)

  const { data: usuario } = await supabase.from('usuarios').select('monedas').eq('id', userId).single()
  if (!usuario || usuario.monedas < cantidad) throw new Error('No tienes suficientes monedas')

  // Devolver monedas al comprador anterior si existe
  if (subasta.comprador_actual_id) {
    await supabase.rpc('devolver_monedas', {
      usuario_id: subasta.comprador_actual_id,
      cantidad: subasta.puja_actual,
    })
  }

  // Congelar monedas del nuevo postor
  await supabase.rpc('congelar_monedas', {
    usuario_id: userId,
    cantidad: cantidad,
  })

  const { error } = await supabase
    .from('subastas')
    .update({ puja_actual: cantidad, comprador_actual_id: userId })
    .eq('id', subastaId)
  if (error) throw error
}

// ---- Usuarios ----
export async function getUsuarios(): Promise<Usuario[]> {
  const { data } = await supabase.from('usuarios').select('*')
  return (data as Usuario[]) || []
}

export async function getUsuario(id: string): Promise<Usuario | null> {
  const { data } = await supabase.from('usuarios').select('*').eq('id', id).single()
  return data as Usuario | null
}

// Inversiones - precios que fluctúan
export async function getInversiones(usuarioId: string) {
  const { data } = await supabase.from('inversiones').select('*').eq('usuario_id', usuarioId)
  return data || []
}

export async function invertir(usuarioId: string, nombreActivo: string, cantidad: number) {
  const { error } = await supabase.from('inversiones').insert({
    usuario_id: usuarioId,
    nombre_activo: nombreActivo,
    cantidad_invertida: cantidad,
    valor_actual: cantidad,
  })
  if (error) throw error
}