import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Initialize Supabase (Use your actual environment variables here)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET() {
  // 1. Get the Data
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

  // 2. Define your Logo URL (Replace YOUR_IP with your computer's local IP, e.g., 192.168.1.50)
  // The phone cannot see "localhost". It must be an IP address.
  // Make sure 'logo-small.jpg' exists in your 'public' folder.
  // Polycom VVX screens are small, keep the image around 150px wide.
  const logoUrl = `http://178.156.174.10:3000/logo-small.jpg` 

  // 3. Build the XML Response
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

  // 4. Return XML with correct headers
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}