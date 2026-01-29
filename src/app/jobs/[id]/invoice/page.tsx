'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function InvoicePage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Data State
  const [job, setJob] = useState<any>(null)
  
  // UPDATED: Items now use 'category' instead of 'taxable'
  const [items, setItems] = useState<any[]>([
    { category: 'labor', description: 'Diagnostic Labor', qty: 1, price: 125.00 },
    { category: 'part', description: 'Oil Filter', qty: 1, price: 25.00 }
  ])
  const [invoiceNotes, setInvoiceNotes] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      // 1. SECURITY
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (profile?.role === 'technician') {
        alert('Access Denied: Financial data is restricted.')
        router.push(`/jobs/${id}`)
        return
      }

      // 2. FETCH JOB
      const { data: jobData } = await supabase
        .from('jobs')
        .select(`*, vehicles (*, customers (*))`)
        .eq('id', id)
        .single()
      
      if (!jobData) { router.push('/dashboard'); return }
      setJob(jobData)

      // 3. FETCH INVOICE
      const { data: invData } = await supabase
        .from('invoices')
        .select('*')
        .eq('job_id', id)
        .single()

      if (invData) {
        // MIGRATION: Convert old 'taxable' boolean to new 'category' string if needed
        const loadedItems = invData.items?.map((i: any) => {
           if (i.category) return i // Already has category
           // Fallback for old data
           return { ...i, category: i.taxable ? 'part' : 'labor' }
        }) || []
        
        setItems(loadedItems)
        setInvoiceNotes(invData.notes || '')
      }

      setLoading(false)
    }
    fetchData()
  }, [id, router])

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('invoices').upsert(
      { 
        job_id: id, 
        items: items, 
        notes: invoiceNotes,
        updated_at: new Date() 
      }, 
      { onConflict: 'job_id' }
    )
    if (job.status !== 'invoiced') {
       await supabase.from('jobs').update({ status: 'invoiced' }).eq('id', id)
    }
    if (error) alert('Error saving invoice')
    setSaving(false)
  }

  // --- ITEM HELPERS ---

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { category: 'part', description: '', qty: 1, price: 0 }])
  }

  const removeItem = (index: number) => {
    if (confirm('Remove this line item?')) {
      const newItems = items.filter((_, i) => i !== index)
      setItems(newItems)
    }
  }

  // --- SMART CALCULATIONS ---
  const subtotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0)
  
  // LOGIC: Only 'part' category gets taxed
  const taxableSubtotal = items.reduce((sum, item) => {
    return item.category === 'part' ? sum + (item.qty * item.price) : sum
  }, 0)

  const taxRate = 0.07 // 7% Indiana Tax
  const tax = taxableSubtotal * taxRate
  const total = subtotal + tax

  // HELPER: Get badge color for dropdown
  const getCatColor = (cat: string) => {
    switch(cat) {
      case 'part': return 'text-indigo-600 font-bold'
      case 'labor': return 'text-slate-500 font-medium'
      case 'fee': return 'text-slate-500 italic'
      default: return 'text-slate-900'
    }
  }

  if (loading) return <div className="p-10 bg-white text-slate-900">Loading Invoice...</div>

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-8 print:p-0 print:bg-white flex flex-col">
      
      {/* NO-PRINT TOOLBAR */}
      <div className="print:hidden flex justify-between items-center mb-8 bg-slate-900 text-white p-4 rounded shadow-lg">
        <div className="font-bold text-amber-500 flex items-center gap-2">
          <span>💰</span> INVOICE EDITOR
        </div>
        <div className="flex gap-4">
          <Link href={`/jobs/${id}`} className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 rounded transition-colors">
            ← Back to Ticket
          </Link>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded shadow transition-colors">
            {saving ? 'Saving...' : '💾 Save Changes'}
          </button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded shadow transition-colors">
            🖨️ Print
          </button>
        </div>
      </div>

      {/* INVOICE DOCUMENT */}
      <div className="flex-grow bg-white p-8 shadow-sm print:shadow-none max-w-5xl mx-auto w-full">
        
        {/* HEADER */}
        <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-8">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">
              Heavy Haul <span className="text-amber-600">Auto Service</span> LLC
            </h1>
            <div className="mt-4 text-sm font-bold text-slate-700">
              <p>P.O. Box 4742</p>
              <p>Carmel, IN 46082</p>
              <p className="mt-1 text-amber-600">463-777-4429</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-bold text-slate-200 uppercase tracking-widest">Invoice</h2>
            <div className="mt-4 text-sm text-slate-600 font-medium">
              <p>Date: {new Date().toLocaleDateString()}</p>
              <p>Invoice #: {job.id.slice(0, 6).toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* BILL TO & VEHICLE */}
        <div className="grid grid-cols-2 gap-12 mb-12">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2 border-b border-slate-200 pb-1">Bill To</h3>
            <p className="font-bold text-lg text-slate-900">{job.vehicles.customers.first_name} {job.vehicles.customers.last_name}</p>
            <p className="text-slate-600">{job.vehicles.customers.company_name}</p>
            <p className="text-slate-600 whitespace-pre-wrap">{job.vehicles.customers.billing_address}</p>
            <p className="text-slate-600 mt-1">{job.vehicles.customers.phone}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2 border-b border-slate-200 pb-1">Vehicle</h3>
            <p className="font-bold text-lg text-slate-900">{job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</p>
            <p className="font-mono text-sm text-slate-600">VIN: {job.vehicles.vin || 'N/A'}</p>
            <p className="text-sm text-slate-600">Unit #: {job.vehicles.unit_number || 'N/A'}</p>
          </div>
        </div>

        {/* LINE ITEMS */}
        <div className="mb-8">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900 text-white text-xs uppercase text-left">
                <th className="p-3 w-28 rounded-tl">Type</th>
                <th className="p-3">Description</th>
                <th className="p-3 w-20 text-center">Qty</th>
                <th className="p-3 w-32 text-right">Price</th>
                <th className="p-3 w-32 text-right rounded-tr">Total</th>
                <th className="p-3 w-10 print:hidden"></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {items.map((item, index) => (
                <tr key={index} className="border-b border-slate-100 last:border-0 group">
                  
                  {/* TYPE SELECTOR */}
                  <td className="p-2">
                    <select
                      value={item.category}
                      onChange={(e) => updateItem(index, 'category', e.target.value)}
                      className={`w-full bg-transparent outline-none uppercase text-xs tracking-wider cursor-pointer ${getCatColor(item.category)}`}
                    >
                      <option value="part">Part (Tax)</option>
                      <option value="labor">Labor</option>
                      <option value="fee">Fee</option>
                    </select>
                  </td>

                  <td className="p-2">
                    <input 
                      type="text" 
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="Item Description"
                      className="w-full bg-transparent outline-none placeholder-slate-300 font-medium text-slate-800"
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      type="number" 
                      value={item.qty}
                      onChange={(e) => updateItem(index, 'qty', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent outline-none text-center text-slate-600"
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      type="number" 
                      value={item.price}
                      onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent outline-none text-right text-slate-600"
                    />
                  </td>
                  <td className="p-2 text-right font-bold text-slate-800">
                    ${(item.qty * item.price).toFixed(2)}
                  </td>
                  <td className="p-2 text-center print:hidden">
                    <button 
                      onClick={() => removeItem(index)}
                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <button onClick={addItem} className="mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 print:hidden">
            + Add Line Item
          </button>
        </div>

        {/* TOTALS & NOTES */}
        <div className="flex flex-col md:flex-row gap-12 items-start">
          
          {/* Notes Area */}
          <div className="flex-1 w-full">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Notes / Warranty Info</h3>
            <textarea 
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              className="w-full h-32 bg-slate-50 border border-slate-200 rounded p-3 text-sm outline-none focus:border-indigo-300 print:bg-transparent print:border-0 print:resize-none print:p-0"
              placeholder="Enter warranty info, payment terms, or thank you note here..."
            />
          </div>

          {/* Totals Box */}
          <div className="w-full md:w-72 space-y-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax (7.0% on Parts)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="border-t-2 border-slate-900 pt-3 flex justify-between items-center text-xl font-bold text-slate-900">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* SIGNATURE */}
        <div className="mt-16 pt-8 border-t border-slate-200 print:mt-24">
          <div className="flex justify-between items-end">
            <div className="text-xs text-slate-400">
              <p className="font-bold text-slate-700">Payment Due Upon Receipt</p>
              <p>Thank you for your business!</p>
            </div>
            <div className="text-center w-64">
              <div className="border-b border-slate-400 h-8"></div>
              <p className="text-xs text-slate-500 mt-1 uppercase">Customer Signature</p>
            </div>
          </div>
        </div>

      </div>

      {/* FOOTER */}
      <div className="text-center text-slate-400 text-xs mt-8 pb-8 print:fixed print:bottom-0 print:w-full print:bg-white">
        <p>Heavy Haul Auto Service LLC • P.O. Box 4742, Carmel, IN 46082</p>
      </div>

    </div>
  )
}