'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatPhone = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(-10)
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
  return raw
}

const normalizePhone = (raw: string) => {
  const d = raw.replace(/\D/g, '')
  return d.startsWith('1') ? `+${d}` : `+1${d.slice(-10)}`
}

const timeLabel = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ─── Templates ───────────────────────────────────────────────────────────────
const TEMPLATES = [
  { icon: '✅', label: 'Vehicle Ready',       text: 'Hi {name}! Your vehicle is ready for pickup at Heavy Haul Auto Service. Give us a call at 463-777-4429 if you have any questions. We look forward to seeing you!' },
  { icon: '🔍', label: 'Inspection Complete', text: 'Hi {name}! We\'ve completed your vehicle inspection. Please check your inspection report link or call us at 463-777-4429 to go over our findings.' },
  { icon: '⏳', label: 'Waiting on Approval', text: 'Hi {name}! We\'ve inspected your vehicle and have some repair recommendations ready for your review. Please call us at 463-777-4429 or check your inspection report to approve or decline.' },
  { icon: '🔩', label: 'Waiting on Parts',    text: 'Hi {name}! We have your vehicle in the shop and are currently waiting on parts to arrive. We\'ll reach out as soon as they\'re in. Thank you for your patience!' },
  { icon: '🧾', label: 'Invoice Ready',        text: 'Hi {name}! Your repair invoice is ready. Please call us at 463-777-4429 to arrange payment and vehicle pickup. Thank you for choosing Heavy Haul Auto Service!' },
  { icon: '📅', label: 'Appointment Reminder', text: 'Hi {name}! This is a friendly reminder about your upcoming service appointment at Heavy Haul Auto Service. Call us at 463-777-4429 if you need to make any changes.' },
  { icon: '💰', label: 'Work Approved',        text: 'Hi {name}! We received your approval and our technicians are getting started right away. We\'ll keep you updated on the progress!' },
]

const STATUS_COLORS: Record<string, string> = {
  scheduled:        'bg-blue-500',
  in_shop:          'bg-amber-500',
  waiting_approval: 'bg-pink-500',
  waiting_parts:    'bg-purple-500',
  ready:            'bg-green-500',
  invoiced:         'bg-slate-500',
}

export default function SmsPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const bottomRef    = useRef<HTMLDivElement>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [sessionToken, setSessionToken] = useState('')
  const [senderName,   setSenderName]   = useState('')
  const [loading,      setLoading]      = useState(true)

  // ── Contacts (built from active jobs) ────────────────────────────────────
  const [contacts,       setContacts]       = useState<any[]>([])
  const [contactSearch,  setContactSearch]  = useState('')

  // ── Thread state ──────────────────────────────────────────────────────────
  const [threads,       setThreads]       = useState<any[]>([])
  const [activePhone,   setActivePhone]   = useState<string | null>(null)
  const [activeContact, setActiveContact] = useState<any | null>(null)
  const [messages,      setMessages]      = useState<any[]>([])
  const [convLoading,   setConvLoading]   = useState(false)

  // ── Compose ───────────────────────────────────────────────────────────────
  const [draft,        setDraft]        = useState('')
  const [sending,      setSending]      = useState(false)
  const [sendError,    setSendError]    = useState('')

  // ── New-message form (for numbers not in contacts) ────────────────────────
  const [newPhone, setNewPhone] = useState('')
  const [newName,  setNewName]  = useState('')
  const [showNew,  setShowNew]  = useState(false)

  // ── UI ────────────────────────────────────────────────────────────────────
  const [showTemplates,   setShowTemplates]   = useState(false)
  const [mobileShowConvo, setMobileShowConvo] = useState(false)

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Auth + initial load
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, first_name, last_name')
        .eq('id', session.user.id)
        .single()

      if (!profile || !['admin', 'advisor'].includes(profile.role)) {
        router.push('/dashboard')
        return
      }

      setSessionToken(session.access_token)
      setSenderName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim())

      // Build contact list from active jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, status, vehicles(year, make, model, customers(first_name, last_name, phone))')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })

      if (jobs) {
        const seen = new Set<string>()
        const list: any[] = []
        jobs.forEach((job: any) => {
          const phone = job.vehicles?.customers?.phone
          if (!phone) return
          const key = phone.replace(/\D/g, '').slice(-10)
          if (seen.has(key)) return
          seen.add(key)
          list.push({
            phone,
            name: `${job.vehicles.customers.first_name} ${job.vehicles.customers.last_name}`.trim(),
            vehicle: `${job.vehicles.year} ${job.vehicles.make} ${job.vehicles.model}`,
            jobId: job.id,
            status: job.status,
          })
        })
        setContacts(list)

        // Handle ?phone= or ?jobId= deep-link from dashboard
        const qPhone = searchParams.get('phone')
        const qJobId = searchParams.get('jobId')
        const qName  = searchParams.get('name')

        if (qPhone) {
          const match = list.find(c => c.phone.replace(/\D/g,'').slice(-10) === qPhone.replace(/\D/g,'').slice(-10))
          if (match) {
            openThread(match, session.access_token)
          } else {
            setNewPhone(qPhone)
            setNewName(qName || '')
            setShowNew(true)
            setMobileShowConvo(true)
          }
        } else if (qJobId) {
          const match = list.find(c => c.jobId === qJobId)
          if (match) openThread(match, session.access_token)
        }
      }

      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Load conversation threads list
  // ─────────────────────────────────────────────────────────────────────────
  const loadThreads = useCallback(async (token: string) => {
    if (!token) return
    const res = await fetch('/api/sms/conversations', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setThreads(data.threads || [])
    }
  }, [])

  useEffect(() => {
    if (sessionToken) loadThreads(sessionToken)
  }, [sessionToken, loadThreads])

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Open a thread + subscribe to real-time inbound
  // ─────────────────────────────────────────────────────────────────────────
  const openThread = useCallback(async (contact: any, token?: string) => {
    const t = token || sessionToken
    setActiveContact(contact)
    setActivePhone(contact.phone)
    setShowNew(false)
    setDraft('')
    setSendError('')
    setMobileShowConvo(true)
    setConvLoading(true)

    const encoded = encodeURIComponent(normalizePhone(contact.phone))
    const url = `/api/sms/conversations/${encoded}`
    console.log('[SMS] Opening thread for:', contact.phone)
    console.log('[SMS] Fetching URL:', url)

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${t}` },
    })

    console.log('[SMS] Response status:', res.status)

    if (res.ok) {
      const data = await res.json()
      console.log('[SMS] Messages returned:', data.messages?.length ?? 0, data.messages)
      setMessages(data.messages || [])
      loadThreads(t)
    } else {
      const err = await res.json().catch(() => ({}))
      console.error('[SMS] Fetch failed:', res.status, err)
    }
    setConvLoading(false)
  }, [sessionToken, loadThreads])

  // Supabase Realtime — listen for ALL new sms_messages, filter client-side.
  //
  // We avoid Realtime column filters because they require an exact string match
  // against whatever format Twilio stored the number in. Instead we subscribe
  // to every INSERT and check client-side if the message belongs to the open
  // thread. This works regardless of phone number formatting (+1XXXXXXXXXX vs
  // XXXXXXXXXX vs (XXX) XXX-XXXX).
  useEffect(() => {
    if (!sessionToken) return

    const channel = supabase
      .channel('sms-all-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sms_messages' },
        (payload) => {
          const msg = payload.new as any

          // Always refresh the sidebar so thread previews + unread badges update
          loadThreads(sessionToken)

          // Only append to the message box if this message belongs to the
          // currently open thread. Compare last 10 digits so +1/formatting
          // differences never cause a mismatch.
          setActivePhone(currentPhone => {
            if (!currentPhone) return currentPhone

            const activeLast10 = currentPhone.replace(/\D/g, '').slice(-10)
            const fromLast10   = (msg.from_number || '').replace(/\D/g, '').slice(-10)
            const toLast10     = (msg.to_number   || '').replace(/\D/g, '').slice(-10)

            if (fromLast10 === activeLast10 || toLast10 === activeLast10) {
              setMessages(prev => {
                // Deduplicate: optimistic outbound messages use twilio_sid as id
                if (prev.some(m => m.id === msg.id || m.id === msg.twilio_sid)) return prev
                return [...prev, msg]
              })
            }

            return currentPhone // don't actually change activePhone
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionToken, loadThreads])

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Send message
  // ─────────────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    setSendError('')
    const toPhone = showNew ? newPhone : activeContact?.phone
    const toName  = showNew ? newName  : activeContact?.name

    if (!toPhone?.trim())  { setSendError('Enter a phone number first.'); return }
    if (!draft.trim())     { setSendError('Message cannot be empty.');    return }

    setSending(true)
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          to: toPhone,
          body: draft.trim(),
          customerName: toName || null,
          jobId: activeContact?.jobId || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Optimistic message
      const optimistic = {
        id: data.sid,
        direction: 'outbound',
        body: draft.trim(),
        sent_by_name: senderName,
        created_at: new Date().toISOString(),
        status: 'sent',
      }
      setMessages(prev => [...prev, optimistic])
      setDraft('')
      textareaRef.current?.focus()

      // If this was a new-number message, switch to a real thread
      if (showNew) {
        const syntheticContact = {
          phone: toPhone,
          name: toName || toPhone,
          vehicle: '',
          jobId: null,
          status: null,
        }
        setActiveContact(syntheticContact)
        setActivePhone(toPhone)
        setShowNew(false)
        setContacts(prev => {
          // Don't duplicate if already in list
          if (prev.some(c => c.phone.replace(/\D/g,'').slice(-10) === toPhone.replace(/\D/g,'').slice(-10))) return prev
          return [syntheticContact, ...prev]
        })
      }

      // Refresh thread list
      loadThreads(sessionToken)

    } catch (err: any) {
      setSendError(err.message || 'Failed to send. Check Twilio credentials in .env.')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    const firstName = (showNew ? newName : activeContact?.name)?.split(' ')[0] || 'there'
    setDraft(tpl.text.replace('{name}', firstName))
    setShowTemplates(false)
    textareaRef.current?.focus()
  }

  const startNew = () => {
    setActiveContact(null)
    setActivePhone(null)
    setMessages([])
    setNewPhone('')
    setNewName('')
    setShowNew(true)
    setMobileShowConvo(true)
    setSendError('')
    setDraft('')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Derived
  // ─────────────────────────────────────────────────────────────────────────

  // Merge threads with contact info for the sidebar
  const enrichedThreads = threads.map(thread => {
    const match = contacts.find(
      c => c.phone.replace(/\D/g,'').slice(-10) === thread.phone.replace(/\D/g,'').slice(-10)
    )
    return {
      ...thread,
      displayName: thread.customerName || match?.name || formatPhone(thread.phone),
      vehicle: match?.vehicle || '',
      status:  match?.status  || null,
    }
  })

  const filteredThreads = enrichedThreads.filter(t =>
    t.displayName.toLowerCase().includes(contactSearch.toLowerCase()) ||
    t.phone.includes(contactSearch)
  )

  // Contacts that haven't texted yet (for "New Message" dropdown)
  const untextedContacts = contacts.filter(
    c => !threads.some(t => t.phone.replace(/\D/g,'').slice(-10) === c.phone.replace(/\D/g,'').slice(-10))
  ).filter(c =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.vehicle.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.phone.includes(contactSearch)
  )

  const totalUnread = threads.reduce((sum, t) => sum + (t.unread || 0), 0)

  if (loading) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-slate-400 animate-pulse font-mono text-sm">Connecting to messenger...</div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden font-sans">

      {/* ── NAV ── */}
      <nav className="border-b border-slate-800 bg-slate-900 px-5 py-3 flex justify-between items-center shrink-0 shadow-lg z-30">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <div className="relative h-10 w-36 md:w-44 shrink-0">
              <Image src="/cover.png" alt="Heavy Haul" fill className="object-contain object-left" priority />
            </div>
          </Link>
          <div className="h-5 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="text-base">💬</span>
            <span className="font-bold text-white text-sm">SMS Messenger</span>
            {totalUnread > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 hidden md:block">
            Logged in as <span className="text-slate-300 font-semibold">{senderName}</span>
          </span>
          <Link href="/dashboard" className="text-sm text-slate-400 border border-slate-700 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            ← Dashboard
          </Link>
        </div>
      </nav>

      {/* ── BODY: sidebar + conversation ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ══════════════════ LEFT SIDEBAR ══════════════════ */}
        <div className={`
          ${mobileShowConvo ? 'hidden' : 'flex'} md:flex
          flex-col w-full md:w-72 lg:w-80 shrink-0
          border-r border-slate-800 bg-slate-900
        `}>

          {/* Search + New button */}
          <div className="p-3 border-b border-slate-800 space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 text-xs pointer-events-none">🔍</span>
              <input
                type="text"
                placeholder="Search..."
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <button
              onClick={startNew}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              ✏️ New Message
            </button>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto">

            {/* Existing threads */}
            {filteredThreads.length > 0 && (
              <div>
                <p className="px-3 pt-3 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Conversations</p>
                {filteredThreads.map(thread => {
                  const isActive = thread.phone.replace(/\D/g,'').slice(-10) === activePhone?.replace(/\D/g,'').slice(-10)
                  return (
                    <button
                      key={thread.phone}
                      onClick={() => openThread({
                        phone: thread.phone,
                        name: thread.displayName,
                        vehicle: thread.vehicle,
                        jobId: contacts.find(c => c.phone.replace(/\D/g,'').slice(-10) === thread.phone.replace(/\D/g,'').slice(-10))?.jobId || null,
                        status: thread.status,
                      })}
                      className={`w-full text-left px-3 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${
                        isActive ? 'bg-indigo-600/15 border-l-2 border-l-indigo-500' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Avatar */}
                          <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-black text-slate-300 shrink-0">
                            {thread.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-white truncate">{thread.displayName}</p>
                            <p className="text-[11px] text-slate-500 truncate">{thread.lastMessage}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] text-slate-600">{timeLabel(thread.lastMessageAt)}</span>
                          <div className="flex items-center gap-1">
                            {thread.status && (
                              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[thread.status] || 'bg-slate-600'}`} />
                            )}
                            {thread.unread > 0 && (
                              <span className="bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                                {thread.unread}
                              </span>
                            )}
                            {thread.lastDirection === 'inbound' && thread.unread === 0 && (
                              <span className="text-[9px] text-slate-600">↩</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Contacts without threads yet */}
            {untextedContacts.length > 0 && (
              <div>
                <p className="px-3 pt-3 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Jobs</p>
                {untextedContacts.map(contact => (
                  <button
                    key={contact.phone}
                    onClick={() => openThread(contact)}
                    className={`w-full text-left px-3 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${
                      activePhone?.replace(/\D/g,'').slice(-10) === contact.phone.replace(/\D/g,'').slice(-10)
                        ? 'bg-indigo-600/15 border-l-2 border-l-indigo-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-slate-500 shrink-0">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-300 truncate">{contact.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{contact.vehicle}</p>
                      </div>
                      <span className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLORS[contact.status] || 'bg-slate-700'}`} />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {filteredThreads.length === 0 && untextedContacts.length === 0 && (
              <div className="p-6 text-center text-slate-600 text-sm">
                {contactSearch ? 'No results.' : 'No contacts found.'}
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════ CONVERSATION PANE ══════════════════ */}
        <div className={`
          ${!mobileShowConvo ? 'hidden' : 'flex'} md:flex
          flex-col flex-1 min-w-0
        `}>

          {/* Conversation header */}
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/70 backdrop-blur flex items-center gap-3 shrink-0">
            <button onClick={() => setMobileShowConvo(false)} className="md:hidden text-indigo-400 text-sm font-bold mr-1">←</button>

            {(activeContact || showNew) ? (
              <>
                {activeContact && (
                  <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-black text-indigo-300 text-sm shrink-0">
                    {activeContact.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {showNew ? (
                    <p className="font-bold text-white">New Message</p>
                  ) : (
                    <>
                      <p className="font-bold text-white">{activeContact?.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{formatPhone(activeContact?.phone || '')}</p>
                    </>
                  )}
                </div>
                {activeContact?.jobId && (
                  <Link
                    href={`/jobs/${activeContact.jobId}`}
                    className="text-xs text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors hidden sm:flex items-center gap-1 shrink-0"
                  >
                    Open Ticket →
                  </Link>
                )}
              </>
            ) : (
              <p className="text-slate-500 text-sm">Select a conversation</p>
            )}
          </div>

          {/* ── Messages ── */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">

            {/* Empty state */}
            {!activeContact && !showNew && (
              <div className="h-full flex flex-col items-center justify-center text-center pb-20">
                <div className="text-5xl mb-4 opacity-30">💬</div>
                <p className="text-slate-500 font-bold">SMS Messenger</p>
                <p className="text-slate-600 text-sm mt-1 max-w-xs">Select a conversation from the sidebar, or click <span className="text-indigo-400">✏️ New Message</span> to start one.</p>
              </div>
            )}

            {/* New message form */}
            {showNew && (
              <div className="max-w-md mx-auto mt-8 bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-4">
                <h3 className="font-bold text-white text-lg">New Message</h3>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Customer Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Smith"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. (317) 555-0199"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <p className="text-xs text-slate-500">Type your message in the box below and hit Send.</p>
              </div>
            )}

            {/* Loading */}
            {convLoading && (
              <div className="flex justify-center pt-12">
                <p className="text-slate-500 text-sm animate-pulse">Loading messages...</p>
              </div>
            )}

            {/* Empty thread */}
            {!convLoading && activeContact && !showNew && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full pb-20 text-center">
                <div className="text-4xl mb-3 opacity-30">📭</div>
                <p className="text-slate-500 text-sm">No messages yet with {activeContact.name}.</p>
                <p className="text-slate-600 text-xs mt-1">Use a template or type below to send the first one.</p>
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((msg, i) => {
              const isOut = msg.direction === 'outbound'
              const showDateSep = i === 0 || (
                new Date(msg.created_at).toDateString() !==
                new Date(messages[i - 1].created_at).toDateString()
              )
              return (
                <div key={msg.id || i}>
                  {/* Date separator */}
                  {showDateSep && (
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-slate-800" />
                      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                        {new Date(msg.created_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <div className="flex-1 h-px bg-slate-800" />
                    </div>
                  )}

                  <div className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[72%] lg:max-w-[60%]`}>
                      {/* Name above bubble */}
                      <p className={`text-[10px] font-bold mb-1 ${isOut ? 'text-right text-indigo-400' : 'text-left text-slate-500'}`}>
                        {isOut ? (msg.sent_by_name || 'Staff') : (activeContact?.name || 'Customer')}
                      </p>
                      {/* Bubble */}
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        isOut
                          ? 'bg-indigo-600 text-white rounded-br-sm'
                          : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-sm'
                      }`}>
                        {msg.body}
                      </div>
                      {/* Timestamp */}
                      <p className={`text-[10px] text-slate-600 mt-1 ${isOut ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isOut && msg.status && (
                          <span className="ml-1">
                            {msg.status === 'delivered' ? ' · ✓✓' : msg.status === 'sent' ? ' · ✓' : ''}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* ── Compose bar ── */}
          {(activeContact || showNew) && (
            <div className="border-t border-slate-800 bg-slate-900 px-4 pt-3 pb-4 shrink-0">

              {/* Templates row */}
              <div className="mb-2 flex items-center gap-2">
                <button
                  onClick={() => setShowTemplates(p => !p)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                    showTemplates
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  ⚡ Templates
                </button>
                {showTemplates && (
                  <div className="flex gap-1.5 flex-wrap">
                    {TEMPLATES.map(tpl => (
                      <button
                        key={tpl.label}
                        onClick={() => applyTemplate(tpl)}
                        className="text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                      >
                        {tpl.icon} {tpl.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Error banner */}
              {sendError && (
                <div className="mb-2 px-3 py-2 bg-red-900/30 border border-red-500/40 rounded-lg text-red-400 text-xs font-bold">
                  ⚠️ {sendError}
                </div>
              )}

              {/* Textarea + Send */}
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 resize-none transition-colors leading-relaxed"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !draft.trim()}
                  className="shrink-0 w-11 h-11 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors shadow-lg"
                  title="Send (Enter)"
                >
                  {sending ? (
                    <span className="text-white text-xs animate-spin">⟳</span>
                  ) : (
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-700 mt-1.5 text-right">{draft.length} chars · Enter to send</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}