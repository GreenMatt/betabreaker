// lib/connectionManager.ts
// Keep this tiny: a single place to import the shared supabase client if other modules expect a "manager".
import { supabase } from '@/lib/supabaseClient'

export function getSupabase() {
  return supabase
}
