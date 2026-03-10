import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function verifyStaff(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role, first_name, last_name').eq('id', user.id).single()
  if (!profile) return null
  return { user, profile }
}

// POST — write a single event
export async function POST(request: Request) {
  try {
    const auth = await verifyStaff(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { jobId, eventType, title, detail, oldValue, newValue } = body

    if (!jobId || !eventType || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('job_events').insert({
      job_id:     jobId,
      user_id:    auth.user.id,
      user_name:  `${auth.profile.first_name} ${auth.profile.last_name}`.trim(),
      event_type: eventType,
      title,
      detail:     detail     || null,
      old_value:  oldValue   || null,
      new_value:  newValue   || null,
    })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET — fetch events for a job
export async function GET(request: Request) {
  try {
    const auth = await verifyStaff(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('job_events')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ events: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}