'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<any[]>([])
  const [role, setRole] = useState('')

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (profile) setRole(profile.role)

      // Fetch jobs with nested vehicle, customer, and inspection data
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          vehicles (*, customers (*)),
          inspections ( recommendations )
        `)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })

      if (error) {
        console.error("Supabase Error:", error)
      }

      if (data) {
        setJobs(data)
      }
      setLoading(false)
    }
    fetchData()
  }, [router])

  // --- LOGIC: Checking for Approved Recommendations ---
  const hasApprovedWork = (job: any) => {
    // FIX: Handle both object and array structures for the 'inspections' join
    const insp = job.inspections
    const recommendations = insp?.recommendations || insp?.[0]?.recommendations

    if (!recommendations || typeof recommendations !== 'object') return false

    // Check if any item inside the recommendations object has 'approved' decision
    return Object.values(recommendations).some((item: any) => 
      item?.decision === 'approved'
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'in_shop': return 'bg-amber-500/20 text-amber-400 border-amber-500/50'
      case 'waiting_approval': return 'bg-pink-500/20 text-pink-400 border-pink-500/50'
      case 'waiting_parts': return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
      case 'ready': return 'bg-green-500/20 text-green-400 border-green-500/50'
      case 'invoiced': return 'bg-slate-700 text-slate-300 border-slate-600'
      default: return 'bg-slate-800 text-slate-400 border-slate-700'
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold">Loading Shop...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      
      {/* Top Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900 px-6 py-3 flex justify-between items-center sticky top-0 z-30 shadow-lg">
        <div className="relative h-12 w-48 md:w-64"> 
          <Image src="/cover.png" alt="Heavy Haul" fill className="object-contain object-left" priority />
        </div>
        <div className="flex gap-4 items-center">
          
          {/* ARCHIVE LINK (Admins & Advisors) */}
          {(role === 'admin' || role === 'advisor') && (
            <Link href="/jobs/archive" className="text-sm text-slate-400 hover:text-white border-r border-slate-700 pr-4">
              🗄️ Archives
            </Link>
          )}

          {/* ADMIN CONSOLE (Admins Only) - RESTORED */}
          {role === 'admin' && (
            <Link href="/admin" className="text-sm text-amber-500 hover:text-amber-400 font-bold border border-amber-500/30 px-3 py-1 rounded bg-amber-500/10">
              Admin Console
            </Link>
          )}

          <Link href="/account" className="text-sm text-slate-400 hover:text-white">Settings</Link>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="text-sm text-slate-400 border border-slate-700 px-3 py-1 rounded">Sign Out</button>
        </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Active Repair Orders ({jobs.length})</h2>
          <Link href="/jobs/new">
            <button className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-6 py-2 rounded-lg font-bold shadow-lg transition-all">+ New Ticket</button>
          </Link>
        </div>

        {/* JOB CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition-all relative flex flex-col h-full group">
              
              {/* THE BADGE: 💰 WORK APPROVED */}
              {hasApprovedWork(job) && (
                <div className="absolute -top-3 -right-2 bg-green-500 text-slate-950 text-[10px] font-black px-3 py-1.5 rounded-full shadow-xl border-2 border-slate-950 z-20 animate-pulse">
                  💰 WORK APPROVED
                </div>
              )}

              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-white group-hover:text-amber-500 transition-colors">
                    {job.vehicles?.year} {job.vehicles?.make} {job.vehicles?.model}
                  </h3>
                  {job.vehicles?.unit_number && (
                    <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700 mt-1 inline-block">Unit #{job.vehicles.unit_number}</span>
                  )}
                </div>
                <span className={`text-[10px] px-2 py-1 rounded border font-bold uppercase tracking-wider ${getStatusColor(job.status)}`}>
                  {job.status?.replace('_', ' ')}
                </span>
              </div>
              
              <div className="text-slate-400 text-sm mb-4">
                <span className="opacity-50 text-xs uppercase font-bold">Customer: </span>
                <span className="font-medium text-slate-200">{job.vehicles?.customers?.first_name} {job.vehicles?.customers?.last_name}</span>
              </div>
              
              <div className="bg-slate-950/50 p-4 rounded-lg text-sm text-slate-400 border border-slate-800/50 flex-grow mb-6 italic min-h-[80px]">
                "{job.customer_complaint}"
              </div>
              
              <div className="pt-4 border-t border-slate-800">
                <Link href={`/jobs/${job.id}`} className="w-full">
                  <button className="w-full py-2 bg-slate-800 hover:bg-indigo-600 text-white rounded font-bold text-sm transition-colors flex justify-center items-center gap-2">
                    Open Ticket <span>→</span>
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}