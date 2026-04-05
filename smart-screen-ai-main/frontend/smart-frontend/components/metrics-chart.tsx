'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

export function MetricsChart({
  data,
  dataKey,
  title,
}: {
  data: any[]
  dataKey: string
  title: string
}) {
  const formatted = [...data]
    .reverse()
    .map((item) => ({
      ...item,
      time: new Date(item.timestamp).toLocaleTimeString(),
    }))

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey={dataKey} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}