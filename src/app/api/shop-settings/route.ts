import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function getCallerProfile(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role, first_name, last_name').eq('id', user.id).single()
  return profile ? { user, profile } : null
}

export async function GET(request: Request) {
  try {
    const auth = await getCallerProfile(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('shop_settings').select('*').eq('id', 1).single()
    if (error) throw error
    return NextResponse.json({ settings: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getCallerProfile(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (auth.profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const allowed = ['labor_rate','parts_markup_retail','parts_markup_commercial','tax_rate','shop_name','shop_phone','shop_address']
    const updates: any = { updated_at: new Date().toISOString() }
    allowed.forEach(k => { if (body[k] !== undefined) updates[k] = body[k] })

    const { data, error } = await supabaseAdmin
      .from('shop_settings').update(updates).eq('id', 1).select().single()
    if (error) throw error
    return NextResponse.json({ settings: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}