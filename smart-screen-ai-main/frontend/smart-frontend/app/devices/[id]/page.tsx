'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  createWebSocket,
  getAlerts,
  getDevices,
  getLatestMetric,
  getMetrics,
} from '../../../lib/api'

type Device = {
  id: string
  name: string
  location?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: string
  is_online?: boolean
}

type Metric = {
  id: number
  device_id: string
  cpu: number
  ram: number
  temp?: number | null
  vlc_running: boolean
  timestamp: string
}

type Alert = {
  id: number
  device_id: string
  type: string
  message: string
  value?: number | null
  threshold?: number | null
  created_at: string
}

type ChartPoint = {
  time: string
  cpu: number
  ram: number
  temp: number
}

function MetricCard({
  label,
  value,
  subValue,
}: {
  label: string
  value: string
  subValue?: string
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      {subValue && <p className="mt-2 text-xs text-slate-400">{subValue}</p>}
    </div>
  )
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: any[]
  label?: string
}) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
      <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
      <div className="space-y-1 text-sm">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="font-medium" style={{ color: entry.color }}>
              {entry.name}
            </span>
            <span className="text-slate-700">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DeviceDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [device, setDevice] = useState<Device | null>(null)
  const [latestMetric, setLatestMetric] = useState<Metric | null>(null)
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [liveStatus, setLiveStatus] = useState('')

  async function loadData() {
    if (!id) return

    try {
      setError('')

      const [devicesData, latestData, metricsData, alertsData] =
        await Promise.all([
          getDevices(),
          getLatestMetric(id),
          getMetrics(id, 20),
          getAlerts(id),
        ])

      const devicesList = Array.isArray(devicesData) ? (devicesData as Device[]) : []
      const latest = latestData as Metric | null
      const metricsList = Array.isArray(metricsData) ? (metricsData as Metric[]) : []
      const alertsList = Array.isArray(alertsData) ? (alertsData as Alert[]) : []

      const currentDevice = devicesList.find((d) => d.id === id) || null

      setDevice(currentDevice)
      setLatestMetric(latest)
      setMetrics(metricsList)
      setAlerts(alertsList)

      const sortedMetrics = [...metricsList].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )

      setChartData(
        sortedMetrics.map((m) => ({
          time: new Date(m.timestamp).toLocaleTimeString(),
          cpu: m.cpu,
          ram: m.ram,
          temp: m.temp ?? 0,
        }))
      )
    } catch (err) {
      console.error(err)
      setError('Impossible de charger les détails du device')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return
    loadData()
  }, [id])

  useEffect(() => {
    if (!id) return

    const socket = createWebSocket((message) => {
      if (message?.type === 'metric_created') {
        const payload = message.payload

        if (payload.device_id !== id) return

        const newMetric: Metric = {
          id: Date.now(),
          device_id: payload.device_id,
          cpu: payload.cpu,
          ram: payload.ram,
          temp: payload.temp,
          vlc_running: payload.vlc_running,
          timestamp: payload.timestamp,
        }

        setLatestMetric(newMetric)

        setMetrics((prev) => {
          const updated = [newMetric, ...prev]
          return updated.slice(0, 20)
        })

        setChartData((prev) => [
          ...prev.slice(-19),
          {
            time: new Date(payload.timestamp).toLocaleTimeString(),
            cpu: payload.cpu,
            ram: payload.ram,
            temp: payload.temp ?? 0,
          },
        ])

        setLiveStatus('Nouvelle métrique reçue')

        setTimeout(() => {
          setLiveStatus('')
        }, 2500)
      }

      if (message?.type === 'alert_created') {
        const payload = message.payload

        if (payload.device_id !== id) return

        const newAlert: Alert = {
          id: payload.id,
          device_id: payload.device_id,
          type: payload.type,
          message: payload.message,
          value: payload.value,
          threshold: payload.threshold,
          created_at: payload.created_at,
        }

        setAlerts((prev) => [newAlert, ...prev])

        setLiveStatus(`Nouvelle alerte: ${payload.type}`)

        setTimeout(() => {
          setLiveStatus('')
        }, 3000)
      }
    })

    return () => {
      socket.close()
    }
  }, [id])

  const isOnline = useMemo(() => {
    return device?.status === 'online' || device?.is_online === true
  }, [device])

  function getAlertBadge(type: string) {
    if (type === 'CPU') return 'bg-orange-100 text-orange-700 border-orange-200'
    if (type === 'TEMP') return 'bg-red-100 text-red-700 border-red-200'
    if (type === 'VLC') return 'bg-violet-100 text-violet-700 border-violet-200'
    return 'bg-slate-100 text-slate-700 border-slate-200'
  }

  if (loading) {
    return (
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        Chargement...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
              Device details
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              {device?.name || 'Unknown Screen'}
            </h1>

            <p className="mt-3 flex items-center gap-2 text-sm text-slate-300">
              📍 {device?.location || 'Sans localisation'}
            </p>

            {device?.latitude != null && device?.longitude != null && (
              <a
                href={`/devices/map?focus=${device.id}`}
                className="mt-4 inline-flex items-center rounded-xl bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
              >
                Voir sur la carte
              </a>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`rounded-full border px-4 py-2 text-sm font-medium ${
                isOnline
                  ? 'border-green-400/30 bg-green-400/15 text-green-200'
                  : 'border-red-400/30 bg-red-400/15 text-red-200'
              }`}
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {liveStatus && (
        <div className="rounded-2xl border border-blue-300 bg-blue-50 p-3 text-blue-700">
          {liveStatus}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="CPU"
          value={latestMetric ? `${latestMetric.cpu}%` : '-'}
          subValue="Usage processeur"
        />

        <MetricCard
          label="RAM"
          value={latestMetric ? `${latestMetric.ram}%` : '-'}
          subValue="Utilisation mémoire"
        />

        <MetricCard
          label="Temperature"
          value={latestMetric?.temp != null ? `${latestMetric.temp}°C` : '-'}
          subValue="Capteur thermique"
        />

        <MetricCard
          label="VLC"
          value={
            latestMetric
              ? latestMetric.vlc_running
                ? 'Running'
                : 'Stopped'
              : '-'
          }
          subValue="Etat du player"
        />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Live Metrics Chart
            </h2>
            <p className="text-sm text-slate-500">
              Évolution en temps réel des métriques du screen
            </p>
          </div>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Temps réel
          </span>
        </div>

        <div className="h-96 rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-4">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              No chart data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  name="CPU"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="ram"
                  name="RAM"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="temp"
                  name="TEMP"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Recent Metrics</h2>

        <div className="mt-4 space-y-3">
          {metrics.length === 0 ? (
            <p className="text-slate-500">No metrics found.</p>
          ) : (
            metrics.map((metric) => (
              <div
                key={metric.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-500">
                    {new Date(metric.timestamp).toLocaleString()}
                  </div>
                  <div className="text-sm font-medium text-slate-700">
                    CPU: {metric.cpu}% | RAM: {metric.ram}% | TEMP:{' '}
                    {metric.temp != null ? `${metric.temp}°C` : '-'} | VLC:{' '}
                    {metric.vlc_running ? 'Running' : 'Stopped'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Related Alerts</h2>

        <div className="mt-4 space-y-3">
          {alerts.length === 0 ? (
            <p className="text-slate-500">No alerts found.</p>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAlertBadge(alert.type)}`}
                    >
                      {alert.type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(alert.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="mt-2 text-sm text-slate-700">
                  {alert.message}
                </div>

                <div className="mt-2 text-xs text-slate-500">
                  Value: {alert.value ?? '-'} | Threshold: {alert.threshold ?? '-'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}