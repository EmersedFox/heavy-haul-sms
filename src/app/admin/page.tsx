'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState('')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [editingId, setEditingId] = useState('')
  
  // Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '', // Only for new users
    firstName: '',
    lastName: '',
    role: 'technician'
  })
  const [formLoading, setFormLoading] = useState(false)

  // 1. Initial Load
  useEffect(() => {
    const checkAccessAndFetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      
      setCurrentUserId(user.id)

      // Verify Admin
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      fetchTeam()
    }
    checkAccessAndFetch()
  }, [router])

  const fetchTeam = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
    if (data) setEmployees(data)
    setLoading(false)
  }

  // 2. Handlers
  const openAddModal = () => {
    setModalMode('add')
    setFormData({ email: '', password: '', firstName: '', lastName: '', role: 'technician' })
    setIsModalOpen(true)
  }

  const openEditModal = (emp: any) => {
    setModalMode('edit')
    setEditingId(emp.id)
    setFormData({
      email: emp.email || '',
      password: '', // No password edit here for security
      firstName: emp.first_name || '',
      lastName: emp.last_name || '',
      role: emp.role || 'technician'
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      if (modalMode === 'add') {
        // CALL THE API ROUTE
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        
      } else {
        // DIRECT DATABASE UPDATE (Edit)
        const { error } = await supabase
          .from('profiles')
          .update({
            first_name: formData.firstName,
            last_name: formData.lastName,
            role: formData.role
          })
          .eq('id', editingId)
        if (error) throw error
      }

      // Success
      setIsModalOpen(false)
      fetchTeam() // Refresh list
      
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setFormLoading(false)
    }
  }

  if (loading) return <div className="p-10 bg-slate-950 text-white">Loading Admin...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex justify-center">
      <div className="w-full max-w-5xl">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-3xl font-bold text-amber-500">Admin Console</h1>
            <p className="text-slate-400">Team Management</p>
          </div>
          <div className="flex gap-4">
             <button onClick={openAddModal} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-bold rounded shadow-lg transition-colors">
               + Add User
             </button>
             <Link href="/dashboard" className="px-4 py-2 border border-slate-700 rounded text-slate-300 hover:text-white">
               Exit
             </Link>
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-500 text-sm uppercase bg-slate-900/50">
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-800/50">
                  <td className="p-4 font-bold">
                    {emp.first_name} {emp.last_name}
                    {emp.id === currentUserId && <span className="ml-2 text-xs text-green-500 bg-green-500/10 px-1 rounded">(YOU)</span>}
                  </td>
                  <td className="p-4 text-slate-400 font-mono text-sm">{emp.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${emp.role === 'admin' ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-700 text-slate-300'}`}>
                      {emp.role}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {/* THE SAFETY CHECK: Do not show Edit button for yourself */}
                    {emp.id !== currentUserId && (
                      <button 
                        onClick={() => openEditModal(emp)}
                        className="text-sm text-indigo-400 hover:text-white font-bold border border-indigo-500/30 px-3 py-1 rounded hover:bg-indigo-600 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* MODAL OVERLAY */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">
              {modalMode === 'add' ? 'Add New User' : 'Edit User'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input 
                   placeholder="First Name" 
                   value={formData.firstName}
                   onChange={e => setFormData({...formData, firstName: e.target.value})}
                   className="bg-slate-950 border border-slate-700 rounded p-3 text-white w-full"
                />
                <input 
                   placeholder="Last Name" 
                   value={formData.lastName}
                   onChange={e => setFormData({...formData, lastName: e.target.value})}
                   className="bg-slate-950 border border-slate-700 rounded p-3 text-white w-full"
                />
              </div>

              {/* Email/Pass only for ADD mode */}
              {modalMode === 'add' && (
                <>
                  <input 
                    type="email" placeholder="Email Address" required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="bg-slate-950 border border-slate-700 rounded p-3 text-white w-full"
                  />
                  <input 
                    type="password" placeholder="Temporary Password" required
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="bg-slate-950 border border-slate-700 rounded p-3 text-white w-full"
                  />
                </>
              )}

              {/* Role Selector */}
              <div>
                <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Role</label>
                <select 
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                  className="bg-slate-950 border border-slate-700 rounded p-3 text-white w-full"
                >
                  <option value="technician">Technician</option>
				  <option value="advisor">Service Advisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-slate-700 rounded text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={formLoading}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded"
                >
                  {formLoading ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}