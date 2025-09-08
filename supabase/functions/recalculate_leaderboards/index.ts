// deno deploy target for Supabase Edge Functions
// Computes simple difficulty-weighted points per user
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url)
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Simple example: compute total points per user
  const { data: logs, error } = await supabase
    .from('climb_logs')
    .select('user_id, attempt_type, climb:climbs(grade, type)')

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const scores = new Map<string, number>()
  for (const row of logs ?? []) {
    const key = row.user_id as string
    const grade = (row as any).climb?.grade ?? 1
    const type = ((row as any).climb?.type ?? 'boulder') as string
    const base = grade
    const typeMult = type === 'lead' ? 1.3 : type === 'top_rope' ? 1.1 : 1
    const styleBonus = (row.attempt_type === 'flashed') ? 1.2 : (row.attempt_type === 'sent') ? 1 : 0.7
    const pts = Math.round(base * typeMult * styleBonus)
    scores.set(key, (scores.get(key) ?? 0) + pts)
  }

  return new Response(JSON.stringify({ updated: scores.size }), { headers: { 'content-type': 'application/json' } })
})

