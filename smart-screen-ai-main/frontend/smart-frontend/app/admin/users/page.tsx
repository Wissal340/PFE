'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  approveUser,
  getDevices,
  getMe,
  getUsers,
  getViewerAssignedDevices,
  removeViewerDeviceAccess,
} from '@/lib/api'

type Me = {
  id: number
  full_name: string
  email: string
  role: 'admin' | 'technicien' | 'viewer'
  is_active: boolean
  is_approved: boolean
}

type UserItem = {
  id: number
  full_name: string
  email: string
  role: 'admin' | 'technicien' | 'viewer'
  is_active: boolean
  is_approved: boolean
  approved_at?: string | null
  approved_by?: number | null
}

type Device = {
  id: string
  name: string
  location?: string | null
  status?: string
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

async function updateUserRole(userId: number, newRole: string) {
  const token = getToken()

  const res = await fetch(
    `${API}/admin/users/${userId}/role?new_role=${encodeURIComponent(newRole)}`,
    {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  )

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(data?.detail || 'Erreur changement rôle')
  }

  return data
}

async function assignDeviceToViewer(userId: number, deviceId: string) {
  const token = getToken()

  const res = await fetch(`${API}/admin/viewer/${userId}/devices/${deviceId}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(data?.detail || 'Erreur attribution screen')
  }

  return data
}

function StatCard({
  label,
  value,
  valueClassName = 'text-white',
}: {
  label: string
  value: string | number
  valueClassName?: string
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-[0_20px_50px_rgba(37,99,235,0.12)]">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className={`mt-3 text-4xl font-bold tracking-tight ${valueClassName}`}>
        {value}
      </p>
      <div className="mt-4 h-1 w-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 opacity-70" />
    </div>
  )
}

export default function AdminUsersPage() {
  const [allowed, setAllowed] = useState(false)
  const [checking, setChecking] = useState(true)

  const [users, setUsers] = useState<UserItem[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [query, setQuery] = useState('')
  const [processingApprove, setProcessingApprove] = useState<number | null>(null)
  const [processingRole, setProcessingRole] = useState<number | null>(null)
  const [assigningUserId, setAssigningUserId] = useState<number | null>(null)
  const [removingAccessKey, setRemovingAccessKey] = useState<string | null>(null)

  const [selectedDeviceId, setSelectedDeviceId] = useState<Record<number, string>>({})
  const [assignedDevices, setAssignedDevices] = useState<Record<number, Device[]>>({})

  async function checkPermission() {
    try {
      const me = (await getMe()) as Me | null

      if (!me) {
        setAllowed(false)
        return
      }

      setAllowed(me.role === 'admin')
    } catch (err) {
      console.error(err)
      setAllowed(false)
    } finally {
      setChecking(false)
    }
  }

  async function loadAssignedDevices(viewerUsers: UserItem[]) {
    const entries = await Promise.all(
      viewerUsers
        .filter((u) => u.role === 'viewer')
        .map(async (viewer) => {
          try {
            const data = await getViewerAssignedDevices(viewer.id)
            return [viewer.id, Array.isArray(data) ? data : []] as const
          } catch {
            return [viewer.id, []] as const
          }
        })
    )

    const map: Record<number, Device[]> = {}
    for (const [userId, devices] of entries) {
      map[userId] = devices
    }
    setAssignedDevices(map)
  }

  async function loadData() {
    try {
      setError('')
      const [usersData, devicesData] = await Promise.all([
        getUsers(),
        getDevices(),
      ])

      const usersArray = Array.isArray(usersData) ? usersData : []
      setUsers(usersArray)
      setDevices(Array.isArray(devicesData) ? devicesData : [])

      await loadAssignedDevices(usersArray)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Erreur chargement users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkPermission()
  }, [])

  useEffect(() => {
    if (!checking && allowed) {
      loadData()
    }
  }, [checking, allowed])

  async function handleApprove(userId: number) {
    try {
      setProcessingApprove(userId)
      await approveUser(userId)
      await loadData()
    } catch (err: any) {
      console.error(err)
      alert(err?.message || 'Erreur approval')
    } finally {
      setProcessingApprove(null)
    }
  }

  async function handleRoleChange(userId: number, newRole: string) {
    try {
      setProcessingRole(userId)
      await updateUserRole(userId, newRole)
      await loadData()
    } catch (err: any) {
      console.error(err)
      alert(err?.message || 'Erreur changement rôle')
    } finally {
      setProcessingRole(null)
    }
  }

  async function handleAssignDevice(userId: number) {
    const deviceId = selectedDeviceId[userId]
    if (!deviceId) {
      alert('Choisis un screen')
      return
    }

    try {
      setAssigningUserId(userId)
      await assignDeviceToViewer(userId, deviceId)
      await loadData()
      alert('Screen attribué avec succès')
    } catch (err: any) {
      console.error(err)
      alert(err?.message || 'Erreur attribution')
    } finally {
      setAssigningUserId(null)
    }
  }

  async function handleRemoveAccess(userId: number, deviceId: string) {
    try {
      const key = `${userId}-${deviceId}`
      setRemovingAccessKey(key)
      await removeViewerDeviceAccess(userId, deviceId)
      await loadData()
    } catch (err: any) {
      console.error(err)
      alert(err?.message || 'Erreur suppression accès')
    } finally {
      setRemovingAccessKey(null)
    }
  }

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return users
    const q = query.toLowerCase()
    return users.filter((user) =>
      `${user.full_name} ${user.email} ${user.role}`.toLowerCase().includes(q)
    )
  }, [users, query])

  const pendingCount = users.filter((u) => !u.is_approved).length
  const adminCount = users.filter((u) => u.role === 'admin').length
  const viewerCount = users.filter((u) => u.role === 'viewer').length

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1020] text-white">
        Vérification des permissions...
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1020] text-white">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <h2 className="text-xl font-semibold text-red-300">Accès refusé</h2>
          <p className="mt-2 text-slate-300">
            Seul un administrateur peut gérer les utilisateurs.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1020] px-4 py-8 text-slate-100 md:px-6">
        <div className="mx-auto max-w-[1600px] rounded-3xl border border-slate-800 bg-[#111827] p-6 shadow-xl">
          Chargement des utilisateurs...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[28px] border border-blue-900/30 bg-gradient-to-r from-[#0f172a] via-[#111c44] to-[#0b1020] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 ring-1 ring-blue-400/30">
                  <span className="text-lg font-bold text-blue-300">U</span>
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-50">
                    User Management
                  </div>
                  <div className="text-xs text-slate-400">
                    Gestion des comptes, rôles et accès viewers
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-8">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Admin control center
                  </p>
                  <h1 className="mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
                    Utilisateurs
                  </h1>
                  <p className="mt-3 max-w-2xl text-base text-slate-300">
                    Approuver les comptes, modifier les rôles et attribuer
                    ou retirer des screens aux viewers.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
                  <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
                    <div className="text-xs uppercase tracking-wide text-orange-300">
                      En attente
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {pendingCount}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Total users
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {users.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 shadow-lg">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Total Users" value={users.length} />
            <StatCard label="Admins" value={adminCount} valueClassName="text-blue-400" />
            <StatCard label="Viewers" value={viewerCount} valueClassName="text-cyan-400" />
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
            <input
              type="text"
              placeholder="Rechercher par nom, email ou rôle"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500/50"
            />
          </div>

          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-[#111827] p-8 text-center text-slate-500">
                Aucun utilisateur trouvé.
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-lg font-semibold text-white">
                          {user.full_name}
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            user.is_approved
                              ? 'border border-green-500/30 bg-green-500/15 text-green-300'
                              : 'border border-orange-500/30 bg-orange-500/15 text-orange-300'
                          }`}
                        >
                          {user.is_approved ? 'Approved' : 'Pending'}
                        </span>

                        <span className="rounded-full border border-slate-700 bg-slate-800/70 px-3 py-1 text-xs text-slate-300">
                          {user.role}
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-slate-400">
                        {user.email}
                      </div>

                      <div className="mt-2 text-xs text-slate-500">
                        ID: {user.id}
                      </div>

                      {user.role === 'viewer' && (
                        <div className="mt-4">
                          <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                            Screens attribués
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(assignedDevices[user.id] || []).length === 0 ? (
                              <span className="rounded-full border border-slate-700 bg-slate-800/70 px-3 py-1 text-xs text-slate-400">
                                Aucun screen attribué
                              </span>
                            ) : (
                              assignedDevices[user.id].map((device) => {
                                const removeKey = `${user.id}-${device.id}`

                                return (
                                  <div
                                    key={device.id}
                                    className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200"
                                  >
                                    <span>
                                      {device.name}
                                      {device.location ? ` - ${device.location}` : ''}
                                    </span>

                                    <button
                                      onClick={() => handleRemoveAccess(user.id, device.id)}
                                      disabled={removingAccessKey === removeKey}
                                      className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                                    >
                                      {removingAccessKey === removeKey ? '...' : 'Remove'}
                                    </button>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:w-[520px]">
                      {!user.is_approved && (
                        <button
                          onClick={() => handleApprove(user.id)}
                          disabled={processingApprove === user.id}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700 disabled:opacity-50"
                        >
                          {processingApprove === user.id ? 'Approval...' : 'Approve'}
                        </button>
                      )}

                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={processingRole === user.id}
                        className="rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-2 text-sm text-slate-100"
                      >
                        <option value="admin">admin</option>
                        <option value="technicien">technicien</option>
                        <option value="viewer">viewer</option>
                      </select>

                      {user.role === 'viewer' && (
                        <>
                          <select
                            value={selectedDeviceId[user.id] || ''}
                            onChange={(e) =>
                              setSelectedDeviceId((prev) => ({
                                ...prev,
                                [user.id]: e.target.value,
                              }))
                            }
                            className="rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-2 text-sm text-slate-100 sm:col-span-2"
                          >
                            <option value="">Choisir un screen à attribuer</option>
                            {devices.map((device) => (
                              <option key={device.id} value={device.id}>
                                {device.name} {device.location ? `- ${device.location}` : ''}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => handleAssignDevice(user.id)}
                            disabled={assigningUserId === user.id}
                            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 transition hover:bg-cyan-500/15 disabled:opacity-50 sm:col-span-2"
                          >
                            {assigningUserId === user.id
                              ? 'Assignation...'
                              : 'Attribuer ce screen au viewer'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}