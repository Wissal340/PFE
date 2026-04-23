'use client'

import type { StudioPlaylistItem } from './BroadcastStudio'

type Props = {
  items: StudioPlaylistItem[]
  selectedItemId: number | null
  onSelectItem: (id: number) => void
  onDeleteItem?: (id: number) => Promise<void> | void
  onMoveItem?: (id: number, direction: 'left' | 'right') => Promise<void> | void
}

function timeToMinutes(time?: string | null) {
  if (!time || !time.includes(':')) return 0
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getBlockPosition(item: StudioPlaylistItem) {
  const start = timeToMinutes(item.start_time)
  const end = timeToMinutes(item.end_time || item.start_time)

  const safeStart = clamp(start, 0, 1439)
  const safeEnd = clamp(
    end <= safeStart ? safeStart + 30 : end,
    safeStart + 1,
    1439
  )

  const leftPercent = (safeStart / 1439) * 100
  const widthPercent = ((safeEnd - safeStart) / 1439) * 100

  return {
    left: `${leftPercent}%`,
    width: `${Math.max(widthPercent, 6)}%`,
  }
}

const HOURS = [
  '00:00',
  '02:00',
  '04:00',
  '06:00',
  '08:00',
  '10:00',
  '12:00',
  '14:00',
  '16:00',
  '18:00',
  '20:00',
  '22:00',
  '23:59',
]

export default function Timeline({
  items,
  selectedItemId,
  onSelectItem,
  onDeleteItem,
  onMoveItem,
}: Props) {
  const sortedItems = [...items].sort((a, b) => a.order_index - b.order_index)

  const rowHeight = 64
  const timelineHeight =
    sortedItems.length > 0
      ? Math.max(220, sortedItems.length * rowHeight + 32)
      : 220

  return (
    <div className="rounded-3xl border border-slate-800 bg-[#111827] p-6 text-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <div className="mb-5">
        <h3 className="text-2xl font-semibold text-white">
          Timeline quotidienne
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          Affichage de 00:00 à 23:59
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1200px]">
          <div className="mb-3 flex justify-between px-2 text-xs font-medium text-slate-500">
            {HOURS.map((hour) => (
              <span key={hour}>{hour}</span>
            ))}
          </div>

          <div
            className="relative overflow-hidden rounded-3xl border border-slate-700 bg-[#0f172a]"
            style={{ height: timelineHeight }}
          >
            <div className="absolute inset-0 flex">
              {new Array(12).fill(null).map((_, index) => (
                <div
                  key={index}
                  className="h-full flex-1 border-r border-dashed border-slate-700/70"
                />
              ))}
            </div>

            {sortedItems.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                Aucun élément dans la timeline.
              </div>
            ) : (
              sortedItems.map((item, index) => {
                const pos = getBlockPosition(item)
                const isSelected = selectedItemId === item.id
                const top = 20 + index * rowHeight

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectItem(item.id)}
                    className={`absolute rounded-2xl border px-3 py-3 text-left shadow-sm transition hover:scale-[1.01] ${
                      isSelected
                        ? 'border-blue-400 bg-blue-600 text-white shadow-[0_0_0_1px_rgba(96,165,250,0.4)]'
                        : item.is_active
                        ? 'border-blue-500/30 bg-blue-500/20 text-blue-100 hover:bg-blue-500/25'
                        : 'border-slate-700 bg-slate-800 text-slate-400'
                    }`}
                    style={{
                      left: pos.left,
                      width: pos.width,
                      top,
                      minHeight: 48,
                    }}
                  >
                    <div className="truncate text-sm font-semibold">
                      {item.title || 'Sans titre'}
                    </div>

                    <div className="mt-1 truncate text-[11px] opacity-90">
                      {item.start_time || '--:--'} → {item.end_time || '--:--'}
                    </div>

                    <div className="mt-1 truncate text-[11px] opacity-75">
                      {item.duration_seconds}s • {item.media_type} • #
                      {item.order_index + 1}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {sortedItems.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortedItems.map((item, index) => {
            const isSelected = selectedItemId === item.id

            return (
              <div
                key={`card-${item.id}`}
                className={`rounded-2xl border p-4 transition ${
                  isSelected
                    ? 'border-blue-400 bg-blue-600 text-white'
                    : 'border-slate-700 bg-[#0f172a] text-slate-200 hover:border-blue-500/30 hover:bg-[#101a31]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectItem(item.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">
                      {item.title || 'Sans titre'}
                    </div>
                    <span className="text-xs opacity-80">#{index + 1}</span>
                  </div>

                  <div className="mt-2 text-xs opacity-80">
                    {item.start_time || '--:--'} → {item.end_time || '--:--'}
                  </div>

                  <div className="mt-1 text-xs opacity-70">
                    {item.duration_seconds}s • {item.media_type} •{' '}
                    {item.is_active ? 'Actif' : 'Inactif'}
                  </div>
                </button>

                {(onMoveItem || onDeleteItem) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {onMoveItem && (
                      <>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => onMoveItem(item.id, 'left')}
                          className="rounded-xl border border-slate-600 px-3 py-1 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          ←
                        </button>

                        <button
                          type="button"
                          disabled={index === sortedItems.length - 1}
                          onClick={() => onMoveItem(item.id, 'right')}
                          className="rounded-xl border border-slate-600 px-3 py-1 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          →
                        </button>
                      </>
                    )}

                    {onDeleteItem && (
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/15"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}