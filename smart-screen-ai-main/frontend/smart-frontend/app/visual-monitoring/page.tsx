'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getDevices, getDeviceCaptures } from '@/lib/api'

type Device = {
  id: string
  name: string
  location?: string | null
  status?: string
}

type Capture = {
  id: number
  device_id: string
  image_url: string
  visual_status: string
  visual_reason?: string | null
  compliance_status: string
  compliance_reason?: string | null
  similarity_score?: number | null
  expected_media_title?: string | null
  expected_media_type?: string | null
  created_at: string
}

function badge(status: string) {
  if (status === 'black_screen' || status === 'non_compliant')
    return 'border-red-500/30 bg-red-500/15 text-red-300'
  if (status === 'frozen' || status === 'partially_compliant')
    return 'border-orange-500/30 bg-orange-500/15 text-orange-300'
  if (status === 'display_error')
    return 'border-violet-500/30 bg-violet-500/15 text-violet-300'

  return 'border-green-500/30 bg-green-500/15 text-green-300'
}

export default function VisualMonitoringPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [captures, setCaptures] = useState<Capture[]>([])
  const [loading, setLoading] = useState(true)
  const [capturesLoading, setCapturesLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadDevices() {
      try {
        setError('')
        const data = await getDevices()
        setDevices(Array.isArray(data) ? data : [])
      } catch (err: any) {
        setError(err?.message || 'Impossible de charger les devices')
      } finally {
        setLoading(false)
      }
    }

    loadDevices()
  }, [])

  async function openDevice(device: Device) {
    try {
      setSelectedDevice(device)
      setCapturesLoading(true)
      setError('')

      const data = await getDeviceCaptures(device.id, 100)
      setCaptures(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(err?.message || 'Impossible de charger les captures')
      setCaptures([])
    } finally {
      setCapturesLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1020] p-6 text-slate-100">
        Chargement...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
        <div className="rounded-[28px] border border-blue-900/30 bg-gradient-to-r from-[#0f172a] via-[#111c44] to-[#0b1020] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
            Visual monitoring
          </p>

          <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">
            Supervision visuelle par device
          </h1>

          <p className="mt-3 max-w-2xl text-slate-300">
            Sélectionne un écran pour consulter uniquement ses propres captures,
            son historique visuel et son état de conformité.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        )}

        {!selectedDevice ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">
                Devices enregistrés
              </h2>

              <span className="rounded-full border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-300">
                {devices.length} device(s)
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {devices.length === 0 ? (
                <div className="rounded-3xl border border-slate-800 bg-[#111827] p-8 text-center text-slate-500 md:col-span-2 xl:col-span-3">
                  Aucun device enregistré.
                </div>
              ) : (
                devices.map((device) => (
                  <button
                    key={device.id}
                    onClick={() => openDevice(device)}
                    className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-6 text-left shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition hover:-translate-y-1 hover:border-blue-500/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold text-white">
                          {device.name}
                        </h3>

                        <p className="mt-2 text-sm text-slate-400">
                          {device.location || 'Sans localisation'}
                        </p>
                      </div>

                      <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                        Voir captures
                      </span>
                    </div>

                    <div className="mt-6 h-1 w-20 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />

                    <p className="mt-4 text-sm text-slate-500">
                      Cliquer pour consulter l’historique visuel de cet écran.
                    </p>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-[#111827]/95 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <button
                  onClick={() => {
                    setSelectedDevice(null)
                    setCaptures([])
                  }}
                  className="mb-4 rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
                >
                  ← Retour aux devices
                </button>

                <h2 className="text-2xl font-semibold text-white">
                  {selectedDevice.name}
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  {selectedDevice.location || 'Sans localisation'}
                </p>
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/devices/${selectedDevice.id}`}
                  className="rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
                >
                  Ouvrir device
                </Link>

                <span className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
                  {captures.length} capture(s)
                </span>
              </div>
            </div>

            {capturesLoading ? (
              <div className="rounded-3xl border border-slate-800 bg-[#111827] p-8 text-slate-400">
                Chargement des captures...
              </div>
            ) : captures.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-[#111827] p-8 text-center text-slate-500">
                Aucune capture pour ce device.
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {captures.map((capture) => (
                  <div
                    key={capture.id}
                    className="overflow-hidden rounded-3xl border border-slate-800 bg-[#111827]/95 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
                  >
                    <Link href={`/captures/${capture.id}`}>
                      <div className="aspect-video bg-black">
                        <img
                          src={capture.image_url}
                          alt={`Capture ${capture.id}`}
                          className="h-full w-full object-cover transition hover:scale-105"
                        />
                      </div>
                    </Link>

                    <div className="space-y-4 p-5">
                      <div className="text-xs text-slate-500">
                        {new Date(capture.created_at).toLocaleString()}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs capitalize ${badge(capture.visual_status)}`}>
                          {capture.visual_status}
                        </span>

                        <span className={`rounded-full border px-3 py-1 text-xs capitalize ${badge(capture.compliance_status)}`}>
                          {capture.compliance_status}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm text-slate-300">
                        <p>
                          <span className="text-slate-500">Visual:</span>{' '}
                          {capture.visual_reason || '-'}
                        </p>

                        <p>
                          <span className="text-slate-500">Compliance:</span>{' '}
                          {capture.compliance_reason || '-'}
                        </p>

                        <p>
                          <span className="text-slate-500">Expected:</span>{' '}
                          {capture.expected_media_title || 'Sans titre'}
                          {capture.expected_media_type
                            ? ` (${capture.expected_media_type})`
                            : ''}
                        </p>
                      </div>

                      <Link
                        href={`/captures/${capture.id}`}
                        className="inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Détail capture
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}