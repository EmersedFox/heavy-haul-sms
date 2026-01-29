'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

// ... (Keep your Job type definition) ...
type Job = {
  id: string
  status: string
  created_at: string
  customer_complaint: string
  vehicles: {
    year: number
    make: string
    model: string
    unit_number: string | null
    customers: {
      first_name: string
      last_name: string
    }
  }
}

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [role, setRole] = useState('')

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (profile) setRole(profile.role)

      // UPDATED QUERY: Filter out archived jobs
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id, status, created_at, customer_complaint,
          vehicles (year, make, model, unit_number, customers (first_name, last_name))
        `)
        .eq('is_archived', false) // <--- HIDES ARCHIVED JOBS
        .order('created_at', { ascending: false })

      if (data) setJobs(data as any)
      setLoading(false)
    }
    fetchData()
  }, [router])

  // ... (Keep getStatusColor helper) ...
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'in_shop': return 'bg-amber-500/20 text-amber-400 border-amber-500/50'
      case 'waiting_parts': return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
      case 'ready': return 'bg-green-500/20 text-green-400 border-green-500/50'
      case 'invoiced': return 'bg-slate-700 text-slate-300 border-slate-600'
      default: return 'bg-slate-800 text-slate-400 border-slate-700'
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading Shop Floor...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Bar */}
      <nav className="border-b border-slate-800 bg-slate-900 px-6 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="relative h-12 w-48 md:w-64"> 
          <Image src="/cover.png" alt="Heavy Haul Auto Service" fill className="object-contain object-left" priority />
        </div>

        <div className="flex gap-4 items-center">
          {/* ARCHIVE LINK - Only for Admins/Advisors */}
          {(role === 'admin' || role === 'advisor') && (
            <Link href="/jobs/archive" className="text-sm text-slate-400 hover:text-white border-r border-slate-700 pr-4">
              🗄️ Archives
            </Link>
          )}

          {role === 'admin' && (
            <Link href="/admin" className="text-sm text-amber-500 hover:text-amber-400 font-bold border border-amber-500/30 px-3 py-1 rounded bg-amber-500/10">
              Admin Console
            </Link>
          )}

          <Link href="/account" className="text-sm text-slate-400 hover:text-white">Settings</Link>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="text-sm text-slate-400 hover:text-white border border-slate-700 px-3 py-1 rounded">Sign Out</button>
        </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto">
        {/* ... (Keep the rest of your dashboard code exactly the same) ... */}
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-100">Active Jobs ({jobs.length})</h2>
          <Link href="/jobs/new">
            <button className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-2 rounded font-bold shadow-lg transition-colors flex items-center gap-2">
              <span>+</span> New Ticket
            </button>
          </Link>
        </div>

        {/* JOB LIST */}
        {jobs.length === 0 ? (
          <div className="border-2 border-dashed border-slate-800 rounded-lg h-64 flex flex-col items-center justify-center text-slate-500 bg-slate-900/50">
            <p className="mb-2">No active repair orders.</p>
            <span className="text-sm">Start a job to see it here.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-slate-600 transition-colors shadow-sm flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-white">{job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</h3>
                    {job.vehicles.unit_number && <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400 mt-1 inline-block">Unit #{job.vehicles.unit_number}</span>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border font-medium uppercase tracking-wide ${getStatusColor(job.status)}`}>{job.status.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                  <span className="text-xs">👤</span> {job.vehicles.customers.first_name} {job.vehicles.customers.last_name}
                </div>
                <div className="bg-slate-950 p-3 rounded text-sm text-slate-300 border border-slate-800/50 flex-grow mb-4">
                  <span className="text-slate-500 text-xs block mb-1 uppercase font-bold">Issue:</span>
                  <p className="line-clamp-3">{job.customer_complaint}</p>
                </div>
                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <Link href={`/jobs/${job.id}`}>
                    <button className="text-sm text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 group">Open Ticket →</button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}