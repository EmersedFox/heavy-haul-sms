import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Initialize the "Master" client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, firstName, lastName, role } = body

    // 1. Create the Auth User (Login)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm so they can login immediately
      user_metadata: { first_name: firstName, last_name: lastName }
    })

    if (authError) throw authError

    // 2. The Trigger we wrote earlier will create the 'profile' row automatically.
    // However, the trigger sets the role to 'technician' by default.
    // We need to update it if the admin selected 'admin'.
    
    if (authData.user && role) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ role: role, first_name: firstName, last_name: lastName })
        .eq('id', authData.user.id)
      
      if (profileError) throw profileError
    }

    return NextResponse.json({ success: true, user: authData.user })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}