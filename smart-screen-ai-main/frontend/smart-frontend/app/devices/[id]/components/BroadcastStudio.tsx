'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  addPlaylistItem,
  deletePlaylistItem,
  getPlaylist,
  reorderPlaylist,
  updatePlaylistItem,
  uploadMedia,
} from '../../../../lib/api'
import MediaLibrary from './MediaLibrary'
import Timeline from './Timeline'
import TimelineEditor from './TimelineEditor'

export type StudioPlaylistItem = {
  id: number
  playlist_id: number
  title?: string | null
  media_url: string
  media_type: 'image' | 'video'
  duration_seconds: number
  start_date?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  order_index: number
  is_active: boolean
  created_at: string
}

export type StudioPlaylist = {
  id: number
  device_id: string
  name: string
  created_at: string
  items: StudioPlaylistItem[]
}

export type LibraryMedia = {
  localId: string
  title: string
  media_url: string
  media_type: 'image' | 'video'
  duration_seconds: number
  source: 'uploaded' | 'url'
}

type Props = {
  deviceId: string
}

export default function BroadcastStudio({ deviceId }: Props) {
  const [playlist, setPlaylist] = useState<StudioPlaylist | null>(null)
  const [library, setLibrary] = useState<LibraryMedia[]>([])
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadPlaylist() {
    try {
      const data = await getPlaylist(deviceId)
      setPlaylist((data as StudioPlaylist) || null)
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    if (!deviceId) return
    loadPlaylist()
  }, [deviceId])

  const sortedItems = useMemo(() => {
    return [...(playlist?.items || [])].sort((a, b) => a.order_index - b.order_index)
  }, [playlist])

  const selectedItem =
    sortedItems.find((item) => item.id === selectedItemId) || null

  function addToLibrary(media: LibraryMedia) {
    setLibrary((prev) => [media, ...prev])
  }

  async function handleUploadToLibrary(file: File, title?: string) {
    setLoading(true)
    try {
      const uploaded = await uploadMedia(file)

      const media: LibraryMedia = {
        localId: `${Date.now()}-${Math.random()}`,
        title: title || file.name || 'Untitled media',
        media_url: uploaded.url,
        media_type: uploaded.media_type,
        duration_seconds: uploaded.media_type === 'video' ? 30 : 15,
        source: 'uploaded',
      }

      addToLibrary(media)
    } catch (error) {
      console.error(error)
      alert("Erreur lors de l'upload du média")
    } finally {
      setLoading(false)
    }
  }

  function handleAddUrlToLibrary(payload: {
    title: string
    media_url: string
    media_type: 'image' | 'video'
    duration_seconds: number
  }) {
    const media: LibraryMedia = {
      localId: `${Date.now()}-${Math.random()}`,
      title: payload.title || 'Media by URL',
      media_url: payload.media_url,
      media_type: payload.media_type,
      duration_seconds: payload.duration_seconds,
      source: 'url',
    }

    addToLibrary(media)
  }

  async function handleAddLibraryMediaToTimeline(media: LibraryMedia) {
    setLoading(true)
    try {
      const updated = await addPlaylistItem(deviceId, {
        title: media.title || null,
        media_url: media.media_url,
        media_type: media.media_type,
        duration_seconds: Number(media.duration_seconds || 15),
        start_date: null,
        end_date: null,
        start_time: '08:00',
        end_time: '18:00',
        is_active: true,
      })

      setPlaylist((updated as StudioPlaylist) || null)
    } catch (error) {
      console.error(error)
      alert("Erreur lors de l'ajout à la timeline")
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteItem(itemId: number) {
    setLoading(true)
    try {
      const updated = await deletePlaylistItem(itemId)
      setPlaylist((updated as StudioPlaylist) || null)

      if (selectedItemId === itemId) {
        setSelectedItemId(null)
      }
    } catch (error) {
      console.error(error)
      alert('Erreur lors de la suppression')
    } finally {
      setLoading(false)
    }
  }

  async function handleMoveItem(itemId: number, direction: 'left' | 'right') {
    if (!playlist) return

    const items = [...sortedItems]
    const index = items.findIndex((item) => item.id === itemId)
    if (index === -1) return

    const targetIndex = direction === 'left' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= items.length) return

    ;[items[index], items[targetIndex]] = [items[targetIndex], items[index]]

    setLoading(true)
    try {
      const updated = await reorderPlaylist(
        deviceId,
        items.map((item) => item.id)
      )
      setPlaylist((updated as StudioPlaylist) || null)
    } catch (error) {
      console.error(error)
      alert('Erreur lors du déplacement')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveItem(payload: {
    title: string
    duration_seconds: string
    start_time: string
    end_time: string
    is_active: boolean
  }) {
    if (!selectedItem) return

    setLoading(true)
    try {
      const updated = await updatePlaylistItem(selectedItem.id, {
        title: payload.title || null,
        duration_seconds: Number(payload.duration_seconds || '15'),
        start_time: payload.start_time || null,
        end_time: payload.end_time || null,
        is_active: payload.is_active,
      })

      setPlaylist((updated as StudioPlaylist) || null)
    } catch (error) {
      console.error(error)
      alert("Erreur lors de l'enregistrement")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-[30px] border border-slate-800 bg-[#111827]/95 p-6 text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-white">Studio de diffusion</h2>
          <p className="mt-1 text-sm text-slate-400">
            Bibliothèque médias + timeline quotidienne de 00:00 à 23:59
          </p>
        </div>

        <div className="rounded-full border border-slate-700 bg-white/5 px-4 py-2 text-xs text-slate-300">
          {loading
            ? 'Mise à jour...'
            : `${library.length} média(s) en bibliothèque • ${sortedItems.length} élément(s) en diffusion`}
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[420px_minmax(0,1fr)]">
        <MediaLibrary
          library={library}
          onUpload={handleUploadToLibrary}
          onAddUrl={handleAddUrlToLibrary}
          onAddToTimeline={handleAddLibraryMediaToTimeline}
        />

        <Timeline
          items={sortedItems}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
          onDeleteItem={handleDeleteItem}
          onMoveItem={handleMoveItem}
        />
      </div>

      <div className="mt-6">
        <TimelineEditor
          item={selectedItem}
          onSave={handleSaveItem}
        />
      </div>
    </div>
  )
}