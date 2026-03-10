'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

const STATUS_META: Record<string,{label:string,dot:string,pill:string}> = {
  scheduled:        { label:'Scheduled',        dot:'bg-blue-400',   pill:'bg-blue-500/10 text-blue-300 border-blue-500/30' },
  in_shop:          { label:'In Shop',          dot:'bg-amber-400',  pill:'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  waiting_approval: { label:'Awaiting Approval',dot:'bg-pink-400',   pill:'bg-pink-500/10 text-pink-300 border-pink-500/30' },
  waiting_parts:    { label:'Waiting Parts',    dot:'bg-purple-400', pill:'bg-purple-500/10 text-purple-300 border-purple-500/30' },
  ready:            { label:'Ready',            dot:'bg-green-400',  pill:'bg-green-500/10 text-green-300 border-green-500/30' },
  invoiced:         { label:'Invoiced',         dot:'bg-slate-500',  pill:'bg-slate-700 text-slate-400 border-slate-600' },
  draft:            { label:'Draft',            dot:'bg-slate-600',  pill:'bg-slate-800 text-slate-500 border-slate-700' },
}

export default function Dashboard() {
  const router  = useRouter()
  const [loading, setLoading] = useState(true)
  const [jobs,    setJobs]    = useState<any[]>([])
  const [role,    setRole]    = useState('')
  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState<string[]>([])
  const [payFilter,     setPayFilter]     = useState('all')
  const [sortBy,        setSortBy]        = useState<'newest'|'oldest'|'customer'>('newest')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (profile) setRole(profile.role)
      const { data } = await supabase.from('jobs').select('*, vehicles(*, customers(*)), inspections(recommendations)').eq('is_archived', false).order('created_at', { ascending: false })
      if (data) setJobs(data)
      setLoading(false)
    }
    load()
  }, [router])

  const hasApproved = (job: any) => {
    const insp = job.inspections
    const recs = Array.isArray(insp) ? insp[0]?.recommendations : insp?.recommendations
    if (!recs) return false
    return Object.values(recs).some((r:any) => r?.decision === 'approved')
  }

  const smsLink = (job: any) => {
    const phone = job.vehicles?.customers?.phone
    const name  = `${job.vehicles?.customers?.first_name||''} ${job.vehicles?.customers?.last_name||''}`.trim()
    return phone ? `/sms?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}&jobId=${job.id}` : null
  }

  const filtered = useMemo(() => {
    let r = [...jobs]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const qd = q.replace(/\D/g,'')
      r = r.filter(job => {
        const c = job.vehicles?.customers
        const name = `${c?.first_name||''} ${c?.last_name||''}`.toLowerCase()
        const phone = (c?.phone||'').replace(/\D/g,'')
        const vin = (job.vehicles?.vin||'').toLowerCase()
        return name.includes(q) || (c?.company_name||'').toLowerCase().includes(q) || vin.includes(q) || vin.slice(-4).includes(q) || (qd.length>=4&&phone.includes(qd)) || (job.vehicles?.unit_number||'').toLowerCase().includes(q)
      })
    }
    if (statusFilter.length) r = r.filter(j => statusFilter.includes(j.status))
    if (payFilter !== 'all') r = r.filter(j => (j.payment_status||'unpaid') === payFilter)
    if (sortBy==='oldest') r.sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime())
    else if (sortBy==='customer') r.sort((a,b)=>{const na=`${a.vehicles?.customers?.last_name||''}`.toLowerCase();const nb=`${b.vehicles?.customers?.last_name||''}`.toLowerCase();return na.localeCompare(nb)})
    return r
  }, [jobs, search, statusFilter, payFilter, sortBy])

  const statusCounts = useMemo(()=>{ const c:Record<string,number>={}; jobs.forEach(j=>{c[j.status]=(c[j.status]||0)+1}); return c },[jobs])
  const canMsg = role==='admin'||role==='advisor'
  const canAdmin = role==='admin'||role==='advisor'
  const activeFilters = (statusFilter.length?1:0)+(payFilter!=='all'?1:0)+(search?1:0)
  const clearFilters = () => { setSearch(''); setStatusFilter([]); setPayFilter('all'); setSortBy('newest') }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-bold text-xl">Loading Shop...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      {/* NAV */}
      <nav className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex justify-between items-center sticky top-0 z-30 shadow-lg">
        <div className="relative h-11 w-56">
          <Image src="/cover.png" alt="Heavy Haul" fill className="object-contain object-left" priority />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {canMsg && (
            <Link href="/sms" className="hidden sm:flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300 font-bold border border-green-500/30 px-3 py-1.5 rounded-lg bg-green-500/5 transition-colors">
              💬 <span>Messenger</span>
            </Link>
          )}
          {canAdmin && <Link href="/jobs/archive" className="text-sm text-slate-500 hover:text-slate-300 transition-colors hidden sm:block">Archives</Link>}
          {canAdmin && <Link href="/pos" className="text-sm text-slate-500 hover:text-slate-300 transition-colors hidden sm:block">📦 POs</Link>}
          {role==='admin' && (
            <Link href="/admin" className="text-sm text-amber-500 hover:text-amber-400 font-bold border border-amber-500/30 px-3 py-1.5 rounded-lg bg-amber-500/5 transition-colors">
              Admin
            </Link>
          )}
          <button onClick={async()=>{await supabase.auth.signOut();router.push('/login')}} className="text-sm text-slate-500 hover:text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Status pills */}
        <div className="flex gap-2 flex-wrap mb-5">
          {Object.keys(STATUS_META).filter(s=>statusCounts[s]>0).map(s=>{
            const m = STATUS_META[s]
            const active = statusFilter.includes(s)
            return (
              <button key={s} onClick={()=>setStatusFilter(prev=>active?prev.filter(x=>x!==s):[...prev,s])}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${active?m.pill:'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                {m.label}
                <span className="ml-0.5 opacity-60">{statusCounts[s]}</span>
              </button>
            )
          })}
        </div>

        {/* Search + sort bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-2.5 text-slate-500 pointer-events-none">🔍</span>
            <input type="text" placeholder="Name, phone (4+ digits), VIN, unit #..." value={search} onChange={e=>setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors" />
            {search && <button onClick={()=>setSearch('')} className="absolute right-3 top-2.5 text-slate-500 hover:text-white text-xs">✕</button>}
          </div>
          <select value={payFilter} onChange={e=>setPayFilter(e.target.value)} className="bg-slate-950 border border-slate-700 text-sm text-slate-300 px-3 py-2 rounded-lg outline-none focus:border-indigo-500">
            <option value="all">All Payments</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} className="bg-slate-950 border border-slate-700 text-sm text-slate-300 px-3 py-2 rounded-lg outline-none focus:border-indigo-500">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="customer">By Customer</option>
          </select>
          {activeFilters>0 && <button onClick={clearFilters} className="text-xs text-red-400 border border-red-500/30 px-3 py-2 rounded-lg bg-red-500/5 font-bold hover:bg-red-500/10">Clear {activeFilters}</button>}
        </div>

        {/* Header row */}
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-200">
            {activeFilters ? <>{filtered.length} <span className="text-slate-500 font-normal text-sm">of {jobs.length} jobs</span></> : <>Active Orders <span className="text-slate-600 font-normal text-sm">({jobs.length})</span></>}
          </h2>
          <Link href="/jobs/new">
            <button className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-5 py-2 rounded-lg font-bold text-sm shadow-lg shadow-amber-500/20 transition-all hover:-translate-y-px">
              + New Ticket
            </button>
          </Link>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">{activeFilters?'🔍':'🔧'}</div>
            <p className="text-slate-400 font-bold">{activeFilters?'No jobs match your filters':'No active jobs'}</p>
            {activeFilters>0 && <button onClick={clearFilters} className="mt-3 text-indigo-400 hover:text-white text-sm underline">Clear filters</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(job => {
              const sm = STATUS_META[job.status] || STATUS_META.draft
              const ps = job.payment_status || 'unpaid'
              const link = smsLink(job)
              const approved = hasApproved(job)
              return (
                <div key={job.id} className="group bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all hover:shadow-lg hover:shadow-black/30 flex flex-col">
                  {/* Card top */}
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-bold text-white group-hover:text-amber-400 transition-colors leading-tight truncate">
                          {job.vehicles?.year} {job.vehicles?.make} {job.vehicles?.model}
                        </p>
                        <p className="text-slate-400 text-sm mt-0.5">
                          {job.vehicles?.customers?.first_name} {job.vehicles?.customers?.last_name}
                        </p>
                        {job.vehicles?.customers?.company_name && <p className="text-slate-600 text-xs truncate">{job.vehicles.customers.company_name}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`flex items-center gap-1 text-[11px] font-bold border px-2 py-0.5 rounded-full ${sm.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`}/>
                          {sm.label}
                        </span>
                        {ps !== 'unpaid' && <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded-full uppercase ${ps==='paid'?'bg-green-500/10 text-green-400 border-green-500/30':'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>{ps}</span>}
                      </div>
                    </div>

                    {job.vehicles?.unit_number && (
                      <p className="text-xs font-mono text-slate-600 mb-2">Unit #{job.vehicles.unit_number}</p>
                    )}

                    <p className="text-slate-500 text-sm italic leading-relaxed line-clamp-2">"{job.customer_complaint}"</p>

                    {approved && (
                      <div className="mt-3 flex items-center gap-1.5 text-green-400 text-xs font-bold">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        Work Approved
                      </div>
                    )}
                  </div>

                  {/* Card footer */}
                  <div className="border-t border-slate-800 px-5 py-3 flex gap-2">
                    <Link href={`/jobs/${job.id}`} className="flex-1">
                      <button className="w-full py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg text-sm font-bold transition-colors">
                        Open →
                      </button>
                    </Link>
                    <Link href={`/jobs/${job.id}/history`} title="Vehicle History">
                      <button className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-white rounded-lg text-sm transition-colors">🕒</button>
                    </Link>
                    {canMsg && link && (
                      <Link href={link} title="Send SMS">
                        <button className="py-1.5 px-2.5 bg-slate-800 hover:bg-green-700 text-slate-500 hover:text-white rounded-lg text-sm transition-colors">💬</button>
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
