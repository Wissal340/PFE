'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createWebSocket, getAlerts, getDevices, getToken } from '../lib/api'
import LiveToast from '../components/live-toast'

type Device = {
  id: string
  name: string
  location?: string | null
  is_online?: boolean
}

type Alert = {
  id: number
  message: string
  type: string
  created_at: string
  device_id?: string
}

type ToastItem = {
  id: string
  message: string
  deviceId?: string
  deviceName?: string
  deviceLocation?: string | null
}

export default function HomePage() {
  const router = useRouter()

  const [hasToken, setHasToken] = useState(false)
  const [loading, setLoading] = useState(true)
  const [devices, setDevices] = useState<Device[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [error, setError] = useState('')
  const [toasts, setToasts] = useState<ToastItem[]>([])

  async function loadDashboard(authenticated?: boolean) {
    const isAuthenticated =
      authenticated !== undefined ? authenticated : !!getToken()

    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      setError('')

      const [devicesData, alertsData] = await Promise.all([
        getDevices(),
        getAlerts(),
      ])

      setDevices(Array.isArray(devicesData) ? devicesData : [])
      setAlerts(Array.isArray(alertsData) ? alertsData : [])
    } catch (err) {
      console.error(err)
      setError('Impossible de charger les données du dashboard')
    } finally {
      setLoading(false)
    }
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  function handleToastClick(deviceId?: string) {
    if (!deviceId) return
    router.push(`/devices/${deviceId}`)
  }

  useEffect(() => {
    const token = getToken()
    const authenticated = !!token
    setHasToken(authenticated)

    loadDashboard(authenticated)

    if (!authenticated) return

    const socket = createWebSocket((message) => {
      console.log('WS message:', message)

      if (message?.type === 'alert_created') {
        const payload = message.payload
        const matchedDevice = devices.find((d) => d.id === payload.device_id)

        const toastId = `${payload.id}-${Date.now()}`

        setToasts((prev) => [
          {
            id: toastId,
            message: payload.message,
            deviceId: payload.device_id,
            deviceName: matchedDevice?.name || 'Screen',
            deviceLocation: matchedDevice?.location || 'Sans localisation',
          },
          ...prev,
        ])

        setTimeout(() => {
          removeToast(toastId)
        }, 5000)

        loadDashboard(true)
      }

      if (message?.type === 'metric_created') {
        loadDashboard(true)
      }
    })

    return () => {
      socket.close()
    }
  }, [devices])

  if (!hasToken) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="w-full max-w-2xl rounded-3xl border bg-white p-10 text-center shadow-sm">
          <h1 className="text-4xl font-bold text-slate-900">
            Smart Screen AI
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Plateforme intelligente de supervision des écrans connectés
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="rounded-2xl bg-slate-900 px-6 py-3 text-white transition hover:opacity-90"
            >
              Login
            </Link>

            <Link
              href="/signup"
              className="rounded-2xl border border-slate-300 px-6 py-3 text-slate-900 transition hover:bg-slate-50"
            >
              Register
            </Link>
          </div>

          <div className="mt-8 rounded-2xl bg-slate-50 p-5 text-left">
            <h2 className="text-lg font-semibold text-slate-800">
              Fonctionnalités
            </h2>
            <ul className="mt-3 space-y-2 text-slate-600">
              <li>• Monitoring des devices en temps réel</li>
              <li>• Alertes intelligentes</li>
              <li>• Dashboard interactif</li>
              <li>• Analyse IA des métriques</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-slate-600">Chargement du dashboard...</p>
      </div>
    )
  }

  return (
    <>
      <LiveToast
        toasts={toasts}
        onClose={removeToast}
        onClick={handleToastClick}
      />

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">
            Vue globale de la plateforme Smart Screen AI
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Total Devices</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {devices.length}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Devices Online</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {devices.filter((d) => d.is_online).length}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Total Alerts</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {alerts.length}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Derniers devices
            </h2>

            <div className="mt-4 space-y-3">
              {devices.length === 0 ? (
                <p className="text-slate-500">Aucun device trouvé.</p>
              ) : (
                devices.slice(0, 5).map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{device.name}</p>
                      <p className="text-sm text-slate-500">
                        {device.location || 'Sans localisation'}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        device.is_online
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {device.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Dernières alertes
            </h2>

            <div className="mt-4 space-y-3">
              {alerts.length === 0 ? (
                <p className="text-slate-500">Aucune alerte trouvée.</p>
              ) : (
                alerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-900">{alert.type}</p>
                      <span className="text-xs text-slate-500">
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}