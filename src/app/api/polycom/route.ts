import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// FIX #3: Use service role key for server-side queries so RLS doesn't block counts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET() {
  // Count Active Invoices
  const { count: invoiceCount } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'invoiced')

  // Count Jobs Ready for Pickup
  const { count: readyCount } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'ready')
    
  // Count Waiting on Approval
  const { count: approvalCount } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'waiting_approval')

  const logoUrl = `http://178.156.174.10:3000/logo-small.jpg` 

  const xml = `
    <PolycomIPPhone>
      <Title>Heavy Haul Dash</Title>
      <Image x="0" y="0" width="100" height="50" url="${logoUrl}"/>
      
      <Data>
        <item>
            <label>Ready for Pickup:</label>
            <value>${readyCount || 0}</value>
        </item>
        <item>
            <label>Awaiting Approval:</label>
            <value>${approvalCount || 0}</value>
        </item>
        <item>
            <label>Invoiced Total:</label>
            <value>${invoiceCount || 0}</value>
        </item>
      </Data>
    </PolycomIPPhone>
  `

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}