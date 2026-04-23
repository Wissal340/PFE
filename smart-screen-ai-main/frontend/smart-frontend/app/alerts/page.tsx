'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createWebSocket, getAlerts } from '../../lib/api'

type Alert = {
  id: number
  type: string
  message: string
  value?: number
  threshold?: number
  device_id?: string
  created_at: string
}

function getAlertBadge(type: string) {
  if (type === 'CPU')
    return 'border border-orange-500/30 bg-orange-500/15 text-orange-300'
  if (type === 'TEMP')
    return 'border border-red-500/30 bg-red-500/15 text-red-300'
  if (type === 'VLC')
    return 'border border-slate-600 bg-slate-700/40 text-slate-200'
  return 'border border-slate-700 bg-slate-700/30 text-slate-300'
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [liveMessage, setLiveMessage] = useState('')

  async function loadAlerts() {
    try {
      setError('')
      const data = await getAlerts()
      setAlerts(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError('Impossible de charger les alertes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAlerts()

    const socket = createWebSocket((message) => {
      if (message?.type === 'alert_created') {
        setLiveMessage(`Nouvelle alerte: ${message.payload.message}`)
        loadAlerts()

        setTimeout(() => {
          setLiveMessage('')
        }, 4000)
      }
    })

    return () => socket.close()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1020] px-4 py-8 text-slate-100">
        <div className="mx-auto max-w-[1600px] space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-slate-800"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 py-6">

        <div className="space-y-6">

          {/* HEADER */}
          <div className="rounded-[28px] border border-blue-900/30 bg-gradient-to-r from-[#0f172a] via-[#111c44] to-[#0b1020] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <h1 className="text-4xl font-bold text-white">Alerts</h1>
            <p className="mt-2 text-slate-300">
              Surveillance et événements détectés en temps réel
            </p>
          </div>

          {/* LIVE MESSAGE */}
          {liveMessage && (
            <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 text-orange-300">
              {liveMessage}
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
              {error}
            </div>
          )}

          {/* ALERTS LIST */}
          <div className="space-y-4">
            {alerts.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-[#111827] p-8 text-center text-slate-500">
                Aucune alerte trouvée
              </div>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition hover:border-blue-500/30 hover:bg-[#101a31]"
                >
                  <div className="flex items-start justify-between gap-4">

                    {/* LEFT */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getAlertBadge(
                            a.type
                          )}`}
                        >
                          {a.type}
                        </span>

                        <span className="text-xs text-slate-500">
                          {new Date(a.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-base font-semibold text-slate-100">
                        {a.message}
                      </div>

                      <div className="text-sm text-slate-400">
                        Value: <b>{a.value ?? '-'}</b> | Threshold:{' '}
                        <b>{a.threshold ?? '-'}</b>
                      </div>
                    </div>

                    {/* RIGHT */}
                    <Link
                      href={`/devices/${a.device_id}`}
                      className="rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                    >
                      Voir device
                    </Link>
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