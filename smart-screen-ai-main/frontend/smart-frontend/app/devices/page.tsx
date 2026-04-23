'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  deleteDevice,
  getDevices,
  getToken,
  updateDevice,
} from '../../lib/api'

type Device = {
  id: string
  name: string
  location?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: string
}

function DeviceCard({
  device,
  onOpen,
  onEdit,
  onDelete,
}: {
  device: Device
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const isOnline = device.status === 'online'

  return (
    <div
      onClick={onOpen}
      className="cursor-pointer rounded-3xl border border-slate-800 bg-[#111827]/95 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-[0_20px_50px_rgba(37,99,235,0.12)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">
            {device.name}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {device.location || 'Sans localisation'}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isOnline
              ? 'border border-green-500/30 bg-green-500/15 text-green-300'
              : 'border border-red-500/30 bg-red-500/15 text-red-300'
          }`}
        >
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-300">
        <div>
          <span className="font-medium text-slate-400">Latitude :</span>{' '}
          {device.latitude ?? '-'}
        </div>
        <div className="mt-1">
          <span className="font-medium text-slate-400">Longitude :</span>{' '}
          {device.longitude ?? '-'}
        </div>
      </div>

      <div
        className="mt-5 flex flex-wrap gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onOpen}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Ouvrir
        </button>

        <button
          onClick={onEdit}
          className="rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
        >
          Modifier
        </button>

        <button
          onClick={onDelete}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20"
        >
          Supprimer
        </button>
      </div>
    </div>
  )
}

export default function DevicesPage() {
  const router = useRouter()

  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    location: '',
    latitude: '',
    longitude: '',
    status: 'offline',
  })

  async function loadDevices() {
    try {
      setError('')

      if (!getToken()) {
        setError('Veuillez vous connecter')
        setLoading(false)
        return
      }

      const data = await getDevices()
      setDevices(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError('Impossible de charger les devices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
  }, [])

  function startEdit(device: Device) {
    setEditingId(device.id)
    setForm({
      name: device.name || '',
      location: device.location || '',
      latitude: device.latitude ? String(device.latitude) : '',
      longitude: device.longitude ? String(device.longitude) : '',
      status: device.status || 'offline',
    })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleUpdate(id: string) {
    try {
      await updateDevice(id, {
        name: form.name,
        location: form.location || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        status: form.status,
      })

      cancelEdit()
      await loadDevices()
    } catch (err) {
      console.error(err)
      alert('Erreur lors de la modification')
    }
  }

  async function handleDelete(id: string) {
    const ok = window.confirm('Supprimer ce device ?')
    if (!ok) return

    try {
      await deleteDevice(id)
      await loadDevices()
    } catch (err) {
      console.error(err)
      alert('Erreur suppression')
    }
  }

  function openDevice(id: string) {
    router.push(`/devices/${id}`)
  }

  const onlineCount = useMemo(
    () => devices.filter((d) => d.status === 'online').length,
    [devices]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1020] p-6 text-slate-100">
        Chargement...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="space-y-6">

          {/* HEADER */}
          <div className="rounded-[28px] border border-blue-900/30 bg-gradient-to-r from-[#0f172a] via-[#111c44] to-[#0b1020] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <h1 className="text-4xl font-bold text-white">Devices</h1>
            <p className="mt-2 text-slate-300">
              Gestion et supervision des écrans
            </p>

            <div className="mt-4 flex gap-3">
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
                Total: {devices.length}
              </span>

              <span className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-300">
                Online: {onlineCount}
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
              {error}
            </div>
          )}

          {/* DEVICES GRID */}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {devices.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-[#111827] p-6">
                Aucun device trouvé.
              </div>
            ) : (
              devices.map((device) => {
                const isEditing = editingId === device.id

                if (isEditing) {
                  return (
                    <div
                      key={device.id}
                      className="rounded-3xl border border-slate-800 bg-[#111827] p-6"
                    >
                      <div className="space-y-3">
                        <input
                          value={form.name}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3"
                        />

                        <input
                          value={form.location}
                          onChange={(e) =>
                            setForm({ ...form, location: e.target.value })
                          }
                          className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3"
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <input
                            value={form.latitude}
                            onChange={(e) =>
                              setForm({ ...form, latitude: e.target.value })
                            }
                            className="rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3"
                          />
                          <input
                            value={form.longitude}
                            onChange={(e) =>
                              setForm({ ...form, longitude: e.target.value })
                            }
                            className="rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3"
                          />
                        </div>

                        <select
                          value={form.status}
                          onChange={(e) =>
                            setForm({ ...form, status: e.target.value })
                          }
                          className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3"
                        >
                          <option value="online">online</option>
                          <option value="offline">offline</option>
                        </select>

                        <div className="flex gap-3">
                          <button
                            onClick={() => handleUpdate(device.id)}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-white"
                          >
                            Save
                          </button>

                          <button
                            onClick={cancelEdit}
                            className="rounded-xl border border-slate-700 px-4 py-2"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onOpen={() => openDevice(device.id)}
                    onEdit={() => startEdit(device)}
                    onDelete={() => handleDelete(device.id)}
                  />
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}