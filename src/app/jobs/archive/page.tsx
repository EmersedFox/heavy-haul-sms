'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ArchivePage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      // CHECK PERMISSION
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (profile?.role === 'technician') {
        router.push('/dashboard') // Techs shouldn't be digging in archives
        return
      }

      // FETCH ARCHIVED JOBS
      const { data } = await supabase
        .from('jobs')
        .select(`
          id, status, created_at, customer_complaint,
          vehicles (year, make, model, unit_number, customers (first_name, last_name))
        `)
        .eq('is_archived', true) // <--- SHOWS ONLY ARCHIVED
        .order('created_at', { ascending: false })

      if (data) setJobs(data)
      setLoading(false)
    }
    fetchData()
  }, [router])

  if (loading) return <div className="p-10 bg-slate-950 text-white">Loading Archives...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-500">Job Archives</h1>
            <p className="text-slate-400">Closed and historical repair orders</p>
          </div>
          <Link href="/dashboard" className="px-4 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800">
            ← Back to Shop Floor
          </Link>
        </div>

        {jobs.length === 0 ? (
          <p className="text-slate-500 text-center mt-20">No archived jobs found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-lg p-5 opacity-75 hover:opacity-100 transition-opacity">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-white">
                    {job.vehicles.year} {job.vehicles.make} {job.vehicles.model}
                  </h3>
                  <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-500 uppercase font-bold">
                    {job.status}
                  </span>
                </div>
                <div className="text-sm text-slate-400 mb-4">
                   Owner: {job.vehicles.customers.first_name} {job.vehicles.customers.last_name}
                </div>
                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <Link href={`/jobs/${job.id}`}>
                    <button className="text-sm text-amber-500 hover:text-amber-400 font-bold">View History</button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}