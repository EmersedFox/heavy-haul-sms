import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Use service role so we can delete auth users
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // 1. Delete the auth user (this cascades — Supabase will also remove the profile
    //    row if you have ON DELETE CASCADE set up on the profiles table foreign key,
    //    otherwise the profile row is cleaned up in step 2)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authError) throw authError

    // 2. Explicitly delete the profile row in case CASCADE isn't configured
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    // A "row not found" error here is fine — it just means CASCADE already handled it
    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}