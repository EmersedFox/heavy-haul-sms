'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AccountPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  // User Data State
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  
  // Password State
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setEmail(user.email || '')
        // Supabase stores names in "user_metadata"
        setFirstName(user.user_metadata?.first_name || '')
        setLastName(user.user_metadata?.last_name || '')
        setLoading(false)
      }
    }
    getUser()
  }, [router])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpdating(true)
    setMessage({ type: '', text: '' })

    // 1. Validation: Check passwords match if user is trying to change it
    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' })
      setUpdating(false)
      return
    }

    if (newPassword && newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' })
      setUpdating(false)
      return
    }

    try {
      // 2. Prepare the update object
      const updates: any = {
        data: { first_name: firstName, last_name: lastName } // Update Metadata
      }

      // Only add password to update if the user typed one in
      if (newPassword) {
        updates.password = newPassword
      }

      // 3. Send to Supabase
      const { error } = await supabase.auth.updateUser(updates)

      if (error) throw error

      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      setNewPassword('')
      setConfirmPassword('')
      
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 text-white p-10">Loading Settings...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex justify-center">
      <div className="w-full max-w-lg space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-bold text-amber-500">Account Settings</h1>
          <Link href="/dashboard" className="text-slate-400 hover:text-white">Close</Link>
        </div>

        {/* Current Login Display */}
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex justify-between items-center">
          <div>
            <div className="text-xs text-slate-500 uppercase font-bold">Logged in as</div>
            <div className="text-slate-300 font-mono">{email}</div>
          </div>
          <span className="text-green-500 text-xs font-bold border border-green-500/30 bg-green-500/10 px-2 py-1 rounded">ADMIN</span>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-6">
          
          {/* SECTION 1: PERSONAL DETAILS */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
              <span>👤</span> Personal Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">First Name</label>
                <input 
                  type="text" 
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-amber-500 outline-none"
                  placeholder="Colin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Last Name</label>
                <input 
                  type="text" 
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-amber-500 outline-none"
                  placeholder="Harleman"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: SECURITY */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-2 text-white flex items-center gap-2">
              <span>🔒</span> Change Password
            </h2>
            <p className="text-xs text-slate-500 mb-4">Leave these blank if you don't want to change your password.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">New Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-amber-500 outline-none"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Confirm New Password</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-amber-500 outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {/* STATUS MESSAGE */}
          {message.text && (
            <div className={`p-3 rounded text-center font-bold ${message.type === 'error' ? 'bg-red-900/20 text-red-400' : 'bg-green-900/20 text-green-400'}`}>
              {message.text}
            </div>
          )}

          {/* SAVE BUTTON */}
          <button 
            type="submit" 
            disabled={updating}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-4 rounded-lg transition-colors text-lg shadow-lg"
          >
            {updating ? 'Saving Profile...' : 'Save Changes'}
          </button>
        </form>

      </div>
    </div>
  )
}