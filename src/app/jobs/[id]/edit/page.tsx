'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

async function decodeVin(vin: string) {
  const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin.trim()}?format=json`)
  if (!res.ok) throw new Error('NHTSA unreachable')
  const json = await res.json()
  const r = json?.Results?.[0]
  if (!r || (r.ErrorCode !== '0' && !r.Make)) throw new Error(r?.AdditionalErrorText || 'VIN not found')
  const bodyClass = (r.BodyClass||'').toLowerCase()
  const gvwr = r.GrossVehicleWeightRating||''
  let vehicleType = 'car'
  if (bodyClass.includes('truck')||bodyClass.includes('semi')||bodyClass.includes('tractor')||gvwr.includes('Class 6')||gvwr.includes('Class 7')||gvwr.includes('Class 8')) vehicleType = 'heavy_truck'
  else if (bodyClass.includes('trailer')) vehicleType = 'trailer'
  return { year: r.ModelYear||'', make: r.Make||'', model: r.Model||'', trim: r.Trim||'', engineSize: r.DisplacementL?`${parseFloat(r.DisplacementL).toFixed(1)}L`:'', vehicleType }
}

export default function EditJobPage() {
  const { id } = useParams()
  const router  = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [customerId,  setCustomerId]  = useState('')
  const [vehicleId,   setVehicleId]   = useState('')
  const [vinDecoding, setVinDecoding] = useState(false)
  const [vinDecoded,  setVinDecoded]  = useState(false)
  const [vinError,    setVinError]    = useState('')
  const [form, setForm] = useState({
    firstName:'', lastName:'', companyName:'', phone:'', email:'', address:'',
    customer_type: 'retail',
    year:'', make:'', model:'', vin:'', unit_number:'', type:'car', complaint:'',
  })

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: job } = await supabase.from('jobs').select('*, vehicles(*, customers(*))').eq('id', id).single()
      if (!job) { router.push('/dashboard'); return }
      const c = job.vehicles.customers
      const v = job.vehicles
      setCustomerId(c.id); setVehicleId(v.id)
      setForm({
        firstName: c.first_name||'', lastName: c.last_name||'', companyName: c.company_name||'',
        phone: c.phone||'', email: c.email||'', address: c.billing_address||'',
        customer_type: c.customer_type || 'retail',
        year: String(v.year||''), make: v.make||'', model: v.model||'',
        vin: v.vin||'', unit_number: v.unit_number||'', type: v.vehicle_type||'car',
        complaint: job.customer_complaint||'',
      })
      setLoading(false)
    }
    load()
  }, [id, router])

  const runVinDecode = useCallback(async (vin: string) => {
    setVinDecoding(true); setVinDecoded(false); setVinError('')
    try {
      const r = await decodeVin(vin)
      setForm(prev => ({ ...prev, year: r.year, make: r.make, model: r.model, type: r.vehicleType }))
      setVinDecoded(true)
    } catch (err: any) { setVinError(err.message) }
    finally { setVinDecoding(false) }
  }, [])

  const handleChange = (e: any) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      await supabase.from('customers').update({
        first_name: form.firstName, last_name: form.lastName, company_name: form.companyName,
        phone: form.phone, email: form.email, billing_address: form.address,
        customer_type: form.customer_type,
      }).eq('id', customerId)
      await supabase.from('vehicles').update({
        year: parseInt(form.year)||0, make: form.make, model: form.model,
        vin: form.vin, unit_number: form.unit_number, vehicle_type: form.type,
      }).eq('id', vehicleId)
      await supabase.from('jobs').update({ customer_complaint: form.complaint }).eq('id', id)
      router.push(`/jobs/${id}`)
    } catch (err: any) { alert('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  const vinBorder = vinDecoding ? 'border-amber-500' : vinDecoded ? 'border-green-500' : vinError ? 'border-red-500' : 'border-slate-700'

  if (loading) return <div className="p-10 bg-slate-950 text-white">Loading...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex justify-center">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/jobs/${id}`} className="text-slate-400 hover:text-white text-sm">← Back to Ticket</Link>
          <h1 className="text-3xl font-bold text-amber-500">Edit Job Info</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300">Customer Info</h2>
            <div className="grid grid-cols-2 gap-4">
              <input name="firstName"   placeholder="First Name"  value={form.firstName}   onChange={handleChange} required className="bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="lastName"    placeholder="Last Name"   value={form.lastName}    onChange={handleChange} required className="bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="companyName" placeholder="Company"     value={form.companyName} onChange={handleChange} className="col-span-2 bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Customer Type</label>
                <div className="flex gap-3">
                  {(['retail','commercial'] as const).map(t => (
                    <label key={t} className={`flex-1 cursor-pointer border rounded p-3 text-center font-bold text-sm uppercase transition-colors ${form.customer_type===t?t==='commercial'?'bg-blue-600 text-white border-blue-500':'bg-amber-500 text-slate-900 border-amber-500':'bg-slate-950 text-slate-400 border-slate-700 hover:border-slate-500'}`}>
                      <input type="radio" name="customer_type" value={t} checked={form.customer_type===t} onChange={handleChange} className="hidden" />
                      {t==='commercial'?'🏢 Commercial / Fleet':'🧑 Retail Customer'}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">Controls parts markup rate applied to this customer's invoices.</p>
              </div>
              <input name="phone"   placeholder="Phone"           value={form.phone}   onChange={handleChange} required className="bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="email"   placeholder="Email"           value={form.email}   onChange={handleChange} className="bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="address" placeholder="Billing Address" value={form.address} onChange={handleChange} className="col-span-2 bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
            </div>
          </div>

          {/* Vehicle */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300">Vehicle Details</h2>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-500 uppercase">VIN</label>
                <span className={`text-xs font-bold ${vinDecoding?'text-amber-400':vinDecoded?'text-green-400':vinError?'text-red-400':'text-slate-600'}`}>
                  {vinDecoding?'Decoding...':vinDecoded?'✓ Decoded':vinError?'⚠️ Error':'17-char VIN'}
                </span>
              </div>
              <input name="vin" placeholder="17-character VIN" value={form.vin} onChange={handleChange} maxLength={17}
                className={`w-full bg-slate-950 border-2 ${vinBorder} rounded p-3 text-white font-mono tracking-widest uppercase outline-none transition-colors`} />
              {vinError && <p className="text-red-400 text-xs mt-1">{vinError}</p>}
              {form.vin.length===17 && !vinDecoded && <button type="button" onClick={()=>runVinDecode(form.vin)} className="text-xs text-indigo-400 underline mt-1">Decode VIN</button>}
            </div>
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Vehicle Type</label>
              <div className="flex gap-3">
                {['car','heavy_truck','trailer'].map(t => (
                  <label key={t} className={`flex-1 cursor-pointer border rounded p-3 text-center font-bold text-sm uppercase transition-colors ${form.type===t?'bg-amber-500 text-slate-900 border-amber-500':'bg-slate-950 text-slate-400 border-slate-700 hover:border-slate-500'}`}>
                    <input type="radio" name="type" value={t} checked={form.type===t} onChange={handleChange} className="hidden" />
                    {t.replace('_',' ')}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <input name="year"        placeholder="Year"   type="number" value={form.year}        onChange={handleChange} className="bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="make"        placeholder="Make"                 value={form.make}        onChange={handleChange} className="bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="model"       placeholder="Model"                value={form.model}       onChange={handleChange} className="bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="unit_number" placeholder="Unit #"               value={form.unit_number} onChange={handleChange} className="col-span-3 bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
            </div>
          </div>

          {/* Complaint */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300">Customer Complaint</h2>
            <textarea name="complaint" placeholder="Customer Complaint..." value={form.complaint} onChange={handleChange} rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
          </div>

          <button type="submit" disabled={saving}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-bold py-4 rounded-lg text-lg transition-colors">
            {saving ? 'Saving...' : '✓ Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
