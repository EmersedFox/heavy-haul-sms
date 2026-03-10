import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function verifyAdvisor(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'advisor'].includes(profile.role)) return null
  return user
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const user = await verifyAdvisor(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Next.js 15: params is a Promise and must be awaited
    const { phone: rawParam } = await params
    const raw = decodeURIComponent(rawParam)
    const last10 = raw.replace(/\D/g, '').slice(-10)

    console.log('[SMS API] decoded raw:', raw, '→ last10:', last10)

    if (last10.length < 10) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const { data: allMessages, error } = await supabaseAdmin
      .from('sms_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw error

    console.log('[SMS API] total rows in DB:', allMessages?.length ?? 0)

    const messages = (allMessages || [])
      .filter((msg: any) => {
        if (msg.direction === 'outbound') {
          return (msg.to_number || '').replace(/\D/g, '').slice(-10) === last10
        } else {
          return (msg.from_number || '').replace(/\D/g, '').slice(-10) === last10
        }
      })
      .reverse()

    console.log('[SMS API] messages matching thread:', messages.length)

    // Mark inbound messages from this customer as read
    const unreadIds = messages
      .filter((m: any) => m.direction === 'inbound' && !m.read_at)
      .map((m: any) => m.id)

    if (unreadIds.length > 0) {
      await supabaseAdmin
        .from('sms_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds)
    }

    return NextResponse.json({ messages })
  } catch (err: any) {
    console.error('[SMS API] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}