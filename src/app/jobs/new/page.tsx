'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function NewJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // Search State
  const [custSearchTerm, setCustSearchTerm] = useState('')
  const [custResults, setCustResults] = useState<any[]>([])
  
  const [vehSearchTerm, setVehSearchTerm] = useState('')
  const [vehResults, setVehResults] = useState<any[]>([])

  // Selection State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null) // <--- NEW

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
    year: '',
    make: '',
    model: '',
    vin: '',
    unit_number: '',
    type: 'car',
    complaint: ''
  })

  // 1. CUSTOMER SEARCH
  useEffect(() => {
    const searchCustomers = async () => {
      if (custSearchTerm.length < 2) { setCustResults([]); return }
      const { data } = await supabase
        .from('customers')
        .select('*')
        .or(`first_name.ilike.%${custSearchTerm}%,last_name.ilike.%${custSearchTerm}%,company_name.ilike.%${custSearchTerm}%,phone.ilike.%${custSearchTerm}%`)
        .limit(5)
      if (data) setCustResults(data)
    }
    const timer = setTimeout(searchCustomers, 300)
    return () => clearTimeout(timer)
  }, [custSearchTerm])

  // 2. VEHICLE SEARCH (NEW)
  useEffect(() => {
    const searchVehicles = async () => {
      if (vehSearchTerm.length < 2) { setVehResults([]); return }
      // We need to fetch the vehicle AND the owner info
      const { data } = await supabase
        .from('vehicles')
        .select('*, customers(*)') 
        .or(`vin.ilike.%${vehSearchTerm}%,unit_number.ilike.%${vehSearchTerm}%`)
        .limit(5)
      if (data) setVehResults(data)
    }
    const timer = setTimeout(searchVehicles, 300)
    return () => clearTimeout(timer)
  }, [vehSearchTerm])

  // Handlers
  const selectCustomer = (cust: any) => {
    setSelectedCustomerId(cust.id)
    setFormData(prev => ({
      ...prev,
      firstName: cust.first_name,
      lastName: cust.last_name,
      phone: cust.phone || '',
      email: cust.email || '',
      address: cust.billing_address || ''
    }))
    setCustResults([]) 
    setCustSearchTerm('') 
  }

  const selectVehicle = (veh: any) => {
    // 1. Set Vehicle Data
    setSelectedVehicleId(veh.id)
    
    // 2. Set Customer Data (from the linked owner)
    if (veh.customers) {
      setSelectedCustomerId(veh.customers.id)
      setFormData(prev => ({
        ...prev,
        // Vehicle Info
        year: veh.year,
        make: veh.make,
        model: veh.model,
        vin: veh.vin || '',
        unit_number: veh.unit_number || '',
        type: veh.vehicle_type || 'car',
        // Customer Info
        firstName: veh.customers.first_name,
        lastName: veh.customers.last_name,
        phone: veh.customers.phone || '',
        email: veh.customers.email || '',
        address: veh.customers.billing_address || ''
      }))
    }
    setVehResults([])
    setVehSearchTerm('')
  }

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let customerId = selectedCustomerId
      let vehicleId = selectedVehicleId

      // 1. Handle Customer
      if (!customerId) {
        // Create New Customer
        const { data: customer, error: custError } = await supabase
          .from('customers')
          .insert([{ 
            first_name: formData.firstName, 
            last_name: formData.lastName,
            phone: formData.phone,
            email: formData.email,
            billing_address: formData.address
          }])
          .select()
          .single()
        if (custError) throw custError
        customerId = customer.id
      } else {
        // Update Existing Customer
        await supabase
          .from('customers')
          .update({ billing_address: formData.address, phone: formData.phone })
          .eq('id', customerId)
      }

      // 2. Handle Vehicle
      if (!vehicleId) {
        // Create New Vehicle
        const { data: vehicle, error: vehError } = await supabase
          .from('vehicles')
          .insert([{
            customer_id: customerId,
            year: parseInt(formData.year) || 0,
            make: formData.make,
            model: formData.model,
            vin: formData.vin,
            unit_number: formData.unit_number,
            vehicle_type: formData.type
          }])
          .select()
          .single()
        if (vehError) throw vehError
        vehicleId = vehicle.id
      } else {
        // Update Existing Vehicle (In case they fixed a VIN typo)
        await supabase
          .from('vehicles')
          .update({
             year: parseInt(formData.year) || 0,
             unit_number: formData.unit_number,
             vin: formData.vin,
             vehicle_type: formData.type
          })
          .eq('id', vehicleId)
      }

      // 3. Create Job
      const { error: jobError } = await supabase
        .from('jobs')
        .insert([{
          vehicle_id: vehicleId,
          customer_complaint: formData.complaint,
          status: 'scheduled'
        }])

      if (jobError) throw jobError

      router.push('/dashboard')

    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex justify-center">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-8 text-amber-500">New Intake</h1>
        
        {/* SEARCH AREA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            
            {/* 1. CUSTOMER SEARCH */}
            <div className="relative bg-slate-900 p-4 rounded border border-slate-700">
              <label className="block text-xs font-bold mb-2 text-indigo-400 uppercase">Find Customer</label>
              <input 
                type="text"
                placeholder="Name, Phone, Company..."
                className="w-full bg-slate-950 border border-slate-600 rounded p-3 text-white focus:border-indigo-500 outline-none"
                value={custSearchTerm}
                onChange={(e) => setCustSearchTerm(e.target.value)}
              />
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

            {/* 2. VEHICLE SEARCH */}
            <div className="relative bg-slate-900 p-4 rounded border border-slate-700">
              <label className="block text-xs font-bold mb-2 text-amber-500 uppercase">Find Vehicle</label>
              <input 
                type="text"
                placeholder="VIN (last 4) or Unit #..."
                className="w-full bg-slate-950 border border-slate-600 rounded p-3 text-white focus:border-amber-500 outline-none"
                value={vehSearchTerm}
                onChange={(e) => setVehSearchTerm(e.target.value)}
              />
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
          
          {/* Section 1: Customer */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300 flex justify-between">
               Customer Info 
               {selectedCustomerId && <span className="text-green-400 text-sm font-bold border border-green-500/50 px-2 py-1 rounded bg-green-500/10">✓ LINKED</span>}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <input name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} required className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} required className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="phone" placeholder="Phone" value={formData.phone} onChange={handleChange} required className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="email" placeholder="Email" value={formData.email} onChange={handleChange} className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="address" placeholder="Billing Address" value={formData.address} onChange={handleChange} className="col-span-2 bg-slate-800 border-slate-700 rounded p-3 text-white" />
            </div>
          </div>

          {/* Section 2: Vehicle */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300 flex justify-between">
                Vehicle Details
                {selectedVehicleId && <span className="text-amber-400 text-sm font-bold border border-amber-500/50 px-2 py-1 rounded bg-amber-500/10">✓ EXISTING</span>}
            </h2>
            
            {/* TYPE SELECTOR */}
            <div className="mb-6">
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Vehicle Type</label>
              <div className="flex gap-4">
                {['car', 'heavy_truck', 'trailer'].map((type) => (
                  <label key={type} className={`flex-1 cursor-pointer border rounded p-3 text-center uppercase font-bold text-sm transition-colors ${
                     formData.type === type 
                       ? 'bg-amber-500 text-slate-900 border-amber-500' 
                       : 'bg-slate-950 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}>
                    <input type="radio" name="type" value={type} checked={formData.type === type} onChange={handleChange} className="hidden" />
                    {type.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <input name="year" placeholder="Year" type="number" value={formData.year} onChange={handleChange} className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="make" placeholder="Make" value={formData.make} onChange={handleChange} className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="model" placeholder="Model" value={formData.model} onChange={handleChange} className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="vin" placeholder="VIN" value={formData.vin} onChange={handleChange} className="col-span-2 bg-slate-800 border-slate-700 rounded p-3 text-white font-mono" />
              <input name="unit_number" placeholder="Unit #" value={formData.unit_number} onChange={handleChange} className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
            </div>
          </div>

          {/* Section 3: Complaint */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300">Issue</h2>
            <textarea name="complaint" placeholder="Customer Complaint..." value={formData.complaint} onChange={handleChange} rows={3} className="w-full bg-slate-800 border-slate-700 rounded p-3 text-white" />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-4 rounded-lg text-lg">
            {loading ? 'Processing...' : 'Start Job'}
          </button>
        </form>
      </div>
    </div>
  )
}