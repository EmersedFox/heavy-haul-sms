'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
    } else {
      // Success! Redirect to the dashboard
      router.push('/dashboard')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-8 rounded-lg border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            HEAVY HAUL
          </h2>
          <p className="mt-2 text-sm text-slate-400">System Access</p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="-space-y-px rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                className="relative block w-full rounded-t-md border-0 bg-slate-800 py-3 text-white ring-1 ring-inset ring-slate-700 placeholder:text-slate-500 focus:z-10 focus:ring-2 focus:ring-indigo-500 sm:text-sm sm:leading-6 pl-3"
                placeholder="Technician Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="relative block w-full rounded-b-md border-0 bg-slate-800 py-3 text-white ring-1 ring-inset ring-slate-700 placeholder:text-slate-500 focus:z-10 focus:ring-2 focus:ring-indigo-500 sm:text-sm sm:leading-6 pl-3"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {errorMsg && (
            <div className="text-red-500 text-sm text-center bg-red-900/20 p-2 rounded">
              {errorMsg}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              {loading ? 'Accessing Server...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}