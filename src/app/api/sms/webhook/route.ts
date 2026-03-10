import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  try {
    // Must read raw body first — before any other consumption
    const rawBody = await request.text()
    const params: Record<string, string> = {}
    new URLSearchParams(rawBody).forEach((v, k) => { params[k] = v })

    // ── Signature Validation ────────────────────────────────────────────────
    //
    // OPTION A (recommended for local dev): Add to .env.local:
    //   BYPASS_TWILIO_VALIDATION=true
    // This skips the check entirely so ngrok just works.
    //
    // OPTION B: Leave BYPASS_TWILIO_VALIDATION unset.
    // We derive the URL from request headers instead of a hardcoded env var,
    // which eliminates the most common mismatch (trailing slashes, wrong
    // protocol, etc.). Make sure your ngrok URL in the Twilio console
    // matches exactly what ngrok reports.
    //
    const bypassValidation = process.env.BYPASS_TWILIO_VALIDATION === 'false'

    if (!bypassValidation) {
      const twilioSignature = request.headers.get('x-twilio-signature') || ''

      // Prefer an explicit env override; otherwise reconstruct from headers.
      // ngrok sets x-forwarded-proto and x-forwarded-host correctly.
      const proto      = request.headers.get('x-forwarded-proto') || 'https'
      const host       = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
      const webhookUrl = process.env.TWILIO_WEBHOOK_URL || `${proto}://${host}/api/sms/webhook`

      const isValid = twilio.validateRequest(
        process.env.TWILIO_AUTH_TOKEN!,
        twilioSignature,
        webhookUrl,
        params
      )

      if (!isValid) {
        console.warn('[SMS Webhook] Invalid Twilio signature.')
        console.warn('[SMS Webhook] Validated against URL:', webhookUrl)
        console.warn('[SMS Webhook] Tip: set BYPASS_TWILIO_VALIDATION=true in .env.local for local dev.')
        return new Response('Forbidden', { status: 403 })
      }
    }

    // ── Extract Twilio fields ───────────────────────────────────────────────
    const from = params['From']       || ''
    const to   = params['To']         || ''
    const body = params['Body']       || ''
    const sid  = params['MessageSid'] || ''

    // Silently accept but do nothing if fields are missing (Twilio status callbacks)
    if (!from || !body) {
      return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
    }

    // ── Look up customer name ───────────────────────────────────────────────
    const digits = from.replace(/\D/g, '').slice(-10)
    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('first_name, last_name')
      .ilike('phone', `%${digits}%`)
      .limit(1)

    const customerName = customers?.[0]
      ? `${customers[0].first_name} ${customers[0].last_name}`.trim()
      : null

    // ── Store inbound message ───────────────────────────────────────────────
    const { error } = await supabaseAdmin.from('sms_messages').insert({
      twilio_sid:    sid,
      direction:     'inbound',
      from_number:   from,
      to_number:     to,
      body:          body,
      status:        'received',
      customer_name: customerName,
      job_id:        null,
      sent_by_id:    null,
      sent_by_name:  null,
    })

    if (error) console.error('[SMS Webhook] DB insert error:', error)

    // ── Empty TwiML response (no auto-reply) ───────────────────────────────
    return new Response('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })

  } catch (err: any) {
    console.error('[SMS Webhook] Unhandled error:', err)
    // Always return valid TwiML so Twilio doesn't retry endlessly
    return new Response('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}