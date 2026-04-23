'use client'

import { useEffect, useState } from 'react'
import type { StudioPlaylistItem } from './BroadcastStudio'

type Props = {
  item: StudioPlaylistItem | null
  onSave: (payload: any) => Promise<void>
}

export default function TimelineEditor({ item, onSave }: Props) {
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState('15')
  const [startTime, setStartTime] = useState('00:00')
  const [endTime, setEndTime] = useState('23:59')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!item) return
    setTitle(item.title || '')
    setDuration(String(item.duration_seconds))
    setStartTime(item.start_time || '00:00')
    setEndTime(item.end_time || '23:59')
    setIsActive(item.is_active)
  }, [item])

  async function handleSave() {
    if (!item) return
    await onSave({
      title,
      duration_seconds: duration,
      start_time: startTime,
      end_time: endTime,
      is_active: isActive,
    })
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-[#111827] p-5 text-slate-100">

      <h3 className="text-lg font-semibold">Éditeur timeline</h3>

      {!item ? (
        <p className="mt-4 text-slate-500">
          Sélectionne un élément
        </p>
      ) : (
        <div className="mt-4 space-y-3">

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3"
          />

          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3"
          />

          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3"
          />

          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3"
          />

          <button
            onClick={handleSave}
            className="w-full rounded-xl bg-blue-600 py-3 hover:bg-blue-700"
          >
            Sauvegarder
          </button>
        </div>
      )}
    </div>
  )
}