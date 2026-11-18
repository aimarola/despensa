import { supabase } from './supabase'

export async function addToList(productId: string, quantity = 1, note?: string) {
  const { error } = await supabase.rpc('add_to_list', { p_product: productId, p_quantity: quantity, p_note: note ?? null })
  if (error) throw error
}

export async function setQuantity(listItemId: string, quantity: number) {
  const { error } = await supabase.from('list_items').update({ quantity }).eq('id', listItemId)
  if (error) throw error
}

export async function removeFromList(listItemId: string) {
  const { error } = await supabase
    .from('list_items')
    .update({ status: 'removed', resolved_at: new Date().toISOString() })
    .eq('id', listItemId)
  if (error) throw error
}

export async function findProductByBarcode(householdId: string, barcode: string) {
  const { data } = await supabase
    .from('products')
    .select('id, name')
    .eq('household_id', householdId)
    .eq('barcode', barcode)
    .maybeSingle()
  return data as { id: string; name: string } | null
}
