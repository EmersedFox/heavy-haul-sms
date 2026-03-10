'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

// ── VIN decoder via NHTSA vPIC (free, no API key needed) ─────────────────────
async function decodeVin(vin: string): Promise<{
  year: string; make: string; model: string
  trim: string; engineSize: string; vehicleType: string; error: string | null
}> {
  const res = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin.trim()}?format=json`
  )
  if (!res.ok) throw new Error('NHTSA API unreachable')
  const json = await res.json()
  const r = json?.Results?.[0]
  if (!r) throw new Error('No results returned')

  if (r.ErrorCode !== '0' && !r.Make) {
    throw new Error(r.AdditionalErrorText || 'VIN not found in NHTSA database')
  }

  const bodyClass = (r.BodyClass || '').toLowerCase()
  const gvwr = (r.GrossVehicleWeightRating || '')
  let vehicleType = 'car'
  if (
    bodyClass.includes('truck') || bodyClass.includes('semi') ||
    bodyClass.includes('tractor') || bodyClass.includes('bus') ||
    gvwr.includes('Class 6') || gvwr.includes('Class 7') || gvwr.includes('Class 8')
  ) {
    vehicleType = 'heavy_truck'
  } else if (bodyClass.includes('trailer')) {
    vehicleType = 'trailer'
  }

  const displacement = r.DisplacementL ? `${parseFloat(r.DisplacementL).toFixed(1)}L` : ''
  const cylinders    = r.EngineCylinders ? `${r.EngineCylinders}-cyl` : ''
  const engineSize   = [displacement, cylinders].filter(Boolean).join(' ')

  return {
    year: r.ModelYear || '', make: r.Make || '', model: r.Model || '',
    trim: r.Trim || '', engineSize, vehicleType, error: null,
  }
}

export default function NewJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [custSearchTerm, setCustSearchTerm] = useState('')
  const [custResults,    setCustResults]    = useState<any[]>([])
  const [vehSearchTerm,  setVehSearchTerm]  = useState('')
  const [vehResults,     setVehResults]     = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedVehicleId,  setSelectedVehicleId]  = useState<string | null>(null)

  const [vinDecoding, setVinDecoding] = useState(false)
  const [vinDecoded,  setVinDecoded]  = useState(false)
  const [vinError,    setVinError]    = useState('')
  const [vinExtra,    setVinExtra]    = useState({ trim: '', engineSize: '' })

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', companyName: '', phone: '', email: '', address: '',
    year: '', make: '', model: '', vin: '', unit_number: '', type: 'car', complaint: '',
  })

  useEffect(() => {
    const search = async () => {
      if (custSearchTerm.length < 2) { setCustResults([]); return }
      const { data } = await supabase.from('customers').select('*')
        .or(`first_name.ilike.%${custSearchTerm}%,last_name.ilike.%${custSearchTerm}%,company_name.ilike.%${custSearchTerm}%,phone.ilike.%${custSearchTerm}%`)
        .limit(5)
      if (data) setCustResults(data)
    }
    const t = setTimeout(search, 300)
    return () => clearTimeout(t)
  }, [custSearchTerm])

  useEffect(() => {
    const search = async () => {
      if (vehSearchTerm.length < 2) { setVehResults([]); return }
      const { data } = await supabase.from('vehicles').select('*, customers(*)')
        .or(`vin.ilike.%${vehSearchTerm}%,unit_number.ilike.%${vehSearchTerm}%`).limit(5)
      if (data) setVehResults(data)
    }
    const t = setTimeout(search, 300)
    return () => clearTimeout(t)
  }, [vehSearchTerm])

  const runVinDecode = useCallback(async (vin: string) => {
    setVinDecoding(true)
    setVinDecoded(false)
    setVinError('')
    setVinExtra({ trim: '', engineSize: '' })
    try {
      const result = await decodeVin(vin)
      setFormData(prev => ({ ...prev, year: result.year, make: result.make, model: result.model, type: result.vehicleType }))
      setVinExtra({ trim: result.trim, engineSize: result.engineSize })
      setVinDecoded(true)
    } catch (err: any) {
      setVinError(err.message || 'Could not decode VIN')
    } finally {
      setVinDecoding(false)
    }
  }, [])

  useEffect(() => {
    const vin = formData.vin.trim()
    if (vin.length === 17) {
      runVinDecode(vin)
    } else {
      if (vinDecoded) { setVinDecoded(false); setVinExtra({ trim: '', engineSize: '' }) }
      setVinError('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.vin])

  const selectCustomer = (cust: any) => {
    setSelectedCustomerId(cust.id)
    setFormData(prev => ({ ...prev, firstName: cust.first_name, lastName: cust.last_name,
      companyName: cust.company_name || '', phone: cust.phone || '', email: cust.email || '', address: cust.billing_address || '' }))
    setCustResults([]); setCustSearchTerm('')
  }

  const selectVehicle = (veh: any) => {
    setSelectedVehicleId(veh.id)
    if (veh.customers) {
      setSelectedCustomerId(veh.customers.id)
      setFormData(prev => ({ ...prev,
        year: String(veh.year), make: veh.make, model: veh.model,
        vin: veh.vin || '', unit_number: veh.unit_number || '', type: veh.vehicle_type || 'car',
        firstName: veh.customers.first_name, lastName: veh.customers.last_name,
        companyName: veh.customers.company_name || '', phone: veh.customers.phone || '',
        email: veh.customers.email || '', address: veh.customers.billing_address || '' }))
    }
    setVehResults([]); setVehSearchTerm('')
  }

  const handleChange = (e: any) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      let customerId = selectedCustomerId
      let vehicleId  = selectedVehicleId
      if (!customerId) {
        const { data: customer, error: custError } = await supabase.from('customers')
          .insert([{ first_name: formData.firstName, last_name: formData.lastName,
            company_name: formData.companyName, phone: formData.phone,
            email: formData.email, billing_address: formData.address }])
          .select().single()
        if (custError) throw custError
        customerId = customer.id
      } else {
        await supabase.from('customers').update({ company_name: formData.companyName,
          billing_address: formData.address, phone: formData.phone }).eq('id', customerId)
      }
      if (!vehicleId) {
        const { data: vehicle, error: vehError } = await supabase.from('vehicles')
          .insert([{ customer_id: customerId, year: parseInt(formData.year) || 0,
            make: formData.make, model: formData.model, vin: formData.vin,
            unit_number: formData.unit_number, vehicle_type: formData.type }])
          .select().single()
        if (vehError) throw vehError
        vehicleId = vehicle.id
      } else {
        await supabase.from('vehicles').update({ year: parseInt(formData.year) || 0,
          unit_number: formData.unit_number, vin: formData.vin, vehicle_type: formData.type })
          .eq('id', vehicleId)
      }
      const { error: jobError } = await supabase.from('jobs')
        .insert([{ vehicle_id: vehicleId, customer_complaint: formData.complaint, status: 'scheduled' }])
      if (jobError) throw jobError
      router.push('/dashboard')
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const vinLength = formData.vin.trim().length
  const vinBorderColor = vinDecoding ? 'border-amber-500' : vinDecoded ? 'border-green-500' : vinError ? 'border-red-500' : 'border-slate-700'

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex justify-center">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-8 text-amber-500">New Intake</h1>

        {/* SEARCH AREA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="relative bg-slate-900 p-4 rounded border border-slate-700">
            <label className="block text-xs font-bold mb-2 text-indigo-400 uppercase">Find Customer</label>
            <input type="text" placeholder="Name, Phone, Company..."
              className="w-full bg-slate-950 border border-slate-600 rounded p-3 text-white focus:border-indigo-500 outline-none"
              value={custSearchTerm} onChange={e => setCustSearchTerm(e.target.value)} />
            {custResults.length > 0 && (
              <div className="absolute z-20 w-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded shadow-xl max-h-60 overflow-y-auto">
                {custResults.map(cust => (
                  <div key={cust.id} onClick={() => selectCustomer(cust)} className="p-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700 last:border-0">
                    <div className="font-bold text-white">{cust.first_name} {cust.last_name}</div>
                    <div className="text-xs text-slate-400">{cust.company_name} • {cust.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="relative bg-slate-900 p-4 rounded border border-slate-700">
            <label className="block text-xs font-bold mb-2 text-amber-500 uppercase">Find Vehicle</label>
            <input type="text" placeholder="VIN (last 4) or Unit #..."
              className="w-full bg-slate-950 border border-slate-600 rounded p-3 text-white focus:border-amber-500 outline-none"
              value={vehSearchTerm} onChange={e => setVehSearchTerm(e.target.value)} />
            {vehResults.length > 0 && (
              <div className="absolute z-20 w-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded shadow-xl max-h-60 overflow-y-auto">
                {vehResults.map(veh => (
                  <div key={veh.id} onClick={() => selectVehicle(veh)} className="p-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700 last:border-0">
                    <div className="font-bold text-white">Unit #{veh.unit_number || 'N/A'} • {veh.year} {veh.model}</div>
                    <div className="text-xs text-slate-400">VIN: {veh.vin}</div>
                    <div className="text-xs text-indigo-300">Owner: {veh.customers?.first_name} {veh.customers?.last_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Customer */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300 flex justify-between">
              Customer Info
              {selectedCustomerId && <span className="text-green-400 text-sm font-bold border border-green-500/50 px-2 py-1 rounded bg-green-500/10">✓ LINKED</span>}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <input name="firstName"   placeholder="First Name"         value={formData.firstName}   onChange={handleChange} required className="bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="lastName"    placeholder="Last Name"          value={formData.lastName}    onChange={handleChange} required className="bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="companyName" placeholder="Company (Optional)" value={formData.companyName} onChange={handleChange} className="col-span-2 bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="phone"       placeholder="Phone"              value={formData.phone}       onChange={handleChange} required className="bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="email"       placeholder="Email"              value={formData.email}       onChange={handleChange} className="bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="address"     placeholder="Billing Address"    value={formData.address}     onChange={handleChange} className="col-span-2 bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
            </div>
          </div>

          {/* Vehicle */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300 flex justify-between items-center">
              Vehicle Details
              {selectedVehicleId && <span className="text-amber-400 text-sm font-bold border border-amber-500/50 px-2 py-1 rounded bg-amber-500/10">✓ EXISTING</span>}
            </h2>

            {/* VIN field with live decoder */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">VIN</label>
                <span className={`text-xs font-bold flex items-center gap-1.5 ${
                  vinDecoding ? 'text-amber-400' : vinDecoded ? 'text-green-400' : vinError ? 'text-red-400' : 'text-slate-600'
                }`}>
                  {vinDecoding && <span className="inline-block animate-spin">⟳</span>}
                  {vinDecoding ? 'Decoding VIN...' :
                   vinDecoded  ? '✓ VIN Decoded' :
                   vinError    ? '' :
                   vinLength > 0 ? `${vinLength} / 17` : 'Enter 17-char VIN to auto-decode'}
                </span>
              </div>
              <input
                name="vin"
                placeholder="17-character VIN"
                value={formData.vin}
                onChange={handleChange}
                maxLength={17}
                className={`w-full bg-slate-950 border-2 ${vinBorderColor} rounded p-3 text-white font-mono tracking-widest uppercase outline-none focus:border-indigo-500 transition-colors`}
              />

              {/* Success banner */}
              {vinDecoded && (vinExtra.trim || vinExtra.engineSize) && (
                <div className="mt-2 px-3 py-2 bg-green-900/20 border border-green-500/30 rounded-lg flex items-center gap-3 flex-wrap">
                  <span className="text-green-400 text-xs font-black uppercase tracking-wider">Decoded</span>
                  {vinExtra.engineSize && (
                    <span className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded font-mono">🔧 {vinExtra.engineSize}</span>
                  )}
                  {vinExtra.trim && (
                    <span className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded">✦ {vinExtra.trim} trim</span>
                  )}
                  <button type="button" onClick={() => runVinDecode(formData.vin)}
                    className="ml-auto text-xs text-indigo-400 hover:text-white underline">Re-decode</button>
                </div>
              )}

              {/* Error banner */}
              {vinError && (
                <div className="mt-2 px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center justify-between">
                  <span className="text-xs text-red-400">⚠️ {vinError}</span>
                  <button type="button" onClick={() => runVinDecode(formData.vin)}
                    className="text-xs text-indigo-400 hover:text-white underline ml-4">Retry</button>
                </div>
              )}
            </div>

            {/* Vehicle Type */}
            <div className="mb-5">
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Vehicle Type</label>
              <div className="flex gap-4">
                {['car', 'heavy_truck', 'trailer'].map(type => (
                  <label key={type} className={`flex-1 cursor-pointer border rounded p-3 text-center uppercase font-bold text-sm transition-colors ${
                    formData.type === type ? 'bg-amber-500 text-slate-900 border-amber-500' : 'bg-slate-950 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}>
                    <input type="radio" name="type" value={type} checked={formData.type === type} onChange={handleChange} className="hidden" />
                    {type.replace('_', ' ')}
                  </label>
                ))}
              </div>
              {vinDecoded && <p className="text-[11px] text-slate-500 mt-1.5">↑ Auto-set from VIN — adjust if needed.</p>}
            </div>

            {/* Year / Make / Model / Unit */}
            <div className="grid grid-cols-3 gap-4">
              <input name="year"        placeholder="Year"  type="number" value={formData.year}        onChange={handleChange} className="bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="make"        placeholder="Make"               value={formData.make}        onChange={handleChange} className="bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="model"       placeholder="Model"              value={formData.model}       onChange={handleChange} className="bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              <input name="unit_number" placeholder="Unit #"             value={formData.unit_number} onChange={handleChange} className="col-span-3 bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
            </div>
          </div>

          {/* Complaint */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300">Issue</h2>
            <textarea name="complaint" placeholder="Customer Complaint..." value={formData.complaint}
              onChange={handleChange} rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-4 rounded-lg text-lg transition-colors">
            {loading ? 'Processing...' : 'Start Job'}
          </button>
        </form>
      </div>
    </div>
  )
}