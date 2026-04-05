'use client'

import { useEffect, useState } from 'react'
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
  is_online?: boolean
}

export default function DevicesPage() {
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
      latitude:
        device.latitude !== null && device.latitude !== undefined
          ? String(device.latitude)
          : '',
      longitude:
        device.longitude !== null && device.longitude !== undefined
          ? String(device.longitude)
          : '',
      status: device.status || 'offline',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({
      name: '',
      location: '',
      latitude: '',
      longitude: '',
      status: 'offline',
    })
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
    const ok = window.confirm('Voulez-vous vraiment supprimer ce device ?')
    if (!ok) return

    try {
      await deleteDevice(id)
      await loadDevices()
    } catch (err) {
      console.error(err)
      alert('Erreur lors de la suppression')
    }
  }

  if (loading) {
    return <div>Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Devices</h1>
        <p className="text-sm text-slate-500">
          Liste des screens enregistrés
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {devices.length === 0 ? (
          <div className="rounded-xl border bg-white p-4">
            Aucun device trouvé.
          </div>
        ) : (
          devices.map((device) => {
            const isEditing = editingId === device.id

            return (
              <div
                key={device.id}
                className="rounded-2xl border bg-white p-5 shadow-sm"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="Name"
                      className="w-full rounded-xl border px-4 py-2"
                    />

                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) =>
                        setForm({ ...form, location: e.target.value })
                      }
                      placeholder="Location"
                      className="w-full rounded-xl border px-4 py-2"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={form.latitude}
                        onChange={(e) =>
                          setForm({ ...form, latitude: e.target.value })
                        }
                        placeholder="Latitude"
                        className="w-full rounded-xl border px-4 py-2"
                      />

                      <input
                        type="text"
                        value={form.longitude}
                        onChange={(e) =>
                          setForm({ ...form, longitude: e.target.value })
                        }
                        placeholder="Longitude"
                        className="w-full rounded-xl border px-4 py-2"
                      />
                    </div>

                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                      }
                      className="w-full rounded-xl border px-4 py-2"
                    >
                      <option value="online">online</option>
                      <option value="offline">offline</option>
                    </select>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleUpdate(device.id)}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-white"
                      >
                        Save
                      </button>

                      <button
                        onClick={cancelEdit}
                        className="rounded-xl border px-4 py-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold">{device.name}</div>
                      <div className="text-sm text-slate-500">
                        {device.location || 'Sans localisation'}
                      </div>

                      <div className="mt-2 text-xs text-slate-400">
                        {device.latitude ?? '-'} / {device.longitude ?? '-'}
                      </div>

                      <div className="mt-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            device.status === 'online' || device.is_online
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {device.status === 'online' || device.is_online
                            ? 'Online'
                            : 'Offline'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(device)}
                        className="rounded-xl border px-4 py-2 text-sm"
                      >
                        Modifier
                      </button>

                      <button
                        onClick={() => handleDelete(device.id)}
                        className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}