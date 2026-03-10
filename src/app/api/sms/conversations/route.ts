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

export async function GET(request: Request) {
  try {
    const user = await verifyAdvisor(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: messages, error } = await supabaseAdmin
      .from('sms_messages')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Group into threads keyed by the customer's last-10-digit number.
    //
    // Direction-aware: the customer's number lives on different columns
    // depending on which way the message was sent.
    //   outbound → customer is the recipient  → to_number
    //   inbound  → customer is the sender     → from_number
    //
    // We normalise to last-10 digits so +13175550199 and 3175550199
    // and (317)555-0199 all collapse to the same thread key.
    const threadMap = new Map<string, any>()

    ;(messages || []).forEach((msg: any) => {
      const rawCustomerPhone =
        msg.direction === 'outbound' ? msg.to_number : msg.from_number

      if (!rawCustomerPhone) return

      const threadKey = rawCustomerPhone.replace(/\D/g, '').slice(-10)
      if (!threadKey || threadKey.length < 10) return

      if (!threadMap.has(threadKey)) {
        threadMap.set(threadKey, {
          // Store the raw phone as Twilio gave it so we can pass it back
          // to the single-thread route correctly
          phone: rawCustomerPhone,
          customerName: msg.customer_name || null,
          lastMessage: msg.body,
          lastMessageAt: msg.created_at,
          lastDirection: msg.direction,
          unread: 0,
        })
      }

      if (msg.direction === 'inbound' && !msg.read_at) {
        threadMap.get(threadKey).unread++
      }
    })

    const threads = Array.from(threadMap.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    )

    return NextResponse.json({ threads })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}