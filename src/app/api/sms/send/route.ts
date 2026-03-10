import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import twilio from 'twilio'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  try {
    // 1. Verify session token from Authorization header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Role check — only advisors and admins may send
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, first_name, last_name')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'advisor'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 })
    }

    // 3. Parse body
    const { to, body, customerName, jobId } = await request.json()
    if (!to || !body?.trim()) {
      return NextResponse.json({ error: 'Missing required fields: to, body' }, { status: 400 })
    }

    // Normalize to E.164 (+1XXXXXXXXXX)
    const digits = to.replace(/\D/g, '')
    const e164 = digits.startsWith('1') ? `+${digits}` : `+1${digits.slice(-10)}`
    if (e164.length < 12) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    // 4. Send via Twilio
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
    const msg = await client.messages.create({
      body: body.trim(),
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: e164,
    })

    const senderName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()

    // 5. Log to sms_messages table
    const { error: insertError } = await supabaseAdmin.from('sms_messages').insert({
      twilio_sid:    msg.sid,
      direction:     'outbound',
      from_number:   process.env.TWILIO_PHONE_NUMBER!,
      to_number:     e164,
      body:          body.trim(),
      status:        msg.status,
      customer_name: customerName || null,
      job_id:        jobId || null,
      sent_by_id:    user.id,
      sent_by_name:  senderName,
    })
    if (insertError) console.error('DB log error:', insertError)

    return NextResponse.json({ success: true, sid: msg.sid, status: msg.status })

  } catch (err: any) {
    console.error('SMS send error:', err)
    return NextResponse.json({ error: err.message || 'Failed to send SMS' }, { status: 500 })
  }
}