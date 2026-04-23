'use client'

import { useState } from 'react'
import type { LibraryMedia } from './BroadcastStudio'

type Props = {
  library: LibraryMedia[]
  onUpload: (file: File, title?: string) => Promise<void>
  onAddUrl: (payload: {
    title: string
    media_url: string
    media_type: 'image' | 'video'
    duration_seconds: number
  }) => void
  onAddToTimeline: (media: LibraryMedia) => Promise<void>
}

function getYouTubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url)

    if (parsed.hostname.includes('youtube.com')) {
      const videoId = parsed.searchParams.get('v')
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    }

    if (parsed.hostname.includes('youtu.be')) {
      const videoId = parsed.pathname.replace('/', '')
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    }

    return null
  } catch {
    return null
  }
}

function MediaPreview({
  media,
}: {
  media: Pick<LibraryMedia, 'media_url' | 'media_type' | 'title'>
}) {
  if (media.media_type === 'image') {
    return (
      <img
        src={media.media_url}
        alt={media.title || 'media'}
        className="h-40 w-full object-cover"
      />
    )
  }

  const youtube = getYouTubeEmbedUrl(media.media_url)

  if (youtube) {
    return (
      <iframe
        src={youtube}
        title={media.title || 'video'}
        className="h-40 w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }

  return (
    <video
      src={media.media_url}
      controls
      className="h-40 w-full object-cover"
    />
  )
}

export default function MediaLibrary({
  library,
  onUpload,
  onAddUrl,
  onAddToTimeline,
}: Props) {
  const [tab, setTab] = useState<'upload' | 'url'>('upload')
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState('15')
  const [url, setUrl] = useState('')
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')

  async function handleFileChange(file: File | null) {
    if (!file) return
    await onUpload(file, title || file.name)
    setTitle('')
  }

  function handleAddUrl() {
    if (!url.trim()) {
      alert('Merci de saisir une URL')
      return
    }

    onAddUrl({
      title: title || 'Media by URL',
      media_url: url.trim(),
      media_type: mediaType,
      duration_seconds: Number(duration || '15'),
    })

    setTitle('')
    setUrl('')
    setDuration('15')
    setMediaType('image')
  }

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#0f172a] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <div>
        <h3 className="text-2xl font-semibold text-white">Bibliothèque médias</h3>
        <p className="mt-1 text-sm text-slate-400">
          Upload ou ajout via lien, puis insertion dans la timeline
        </p>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          onClick={() => setTab('upload')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            tab === 'upload'
              ? 'bg-blue-600 text-white'
              : 'border border-slate-700 bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          Upload
        </button>

        <button
          onClick={() => setTab('url')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            tab === 'url'
              ? 'bg-blue-600 text-white'
              : 'border border-slate-700 bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          URL
        </button>
      </div>

      <div className="mt-5 space-y-4 rounded-2xl border border-slate-800 bg-[#111827]/80 p-4">
        <input
          type="text"
          placeholder="Titre"
          value={title ?? ''}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-[#0b1220] px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        />

        <input
          type="number"
          placeholder="Durée par défaut (sec)"
          value={duration ?? ''}
          onChange={(e) => setDuration(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-[#0b1220] px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        />

        {tab === 'upload' ? (
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            className="block w-full rounded-xl border border-slate-700 bg-[#0b1220] px-4 py-3 text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white hover:file:bg-blue-700"
          />
        ) : (
          <>
            <input
              type="text"
              placeholder="URL du média"
              value={url ?? ''}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#0b1220] px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />

            <select
              value={mediaType ?? 'image'}
              onChange={(e) =>
                setMediaType(e.target.value as 'image' | 'video')
              }
              className="w-full rounded-xl border border-slate-700 bg-[#0b1220] px-4 py-3 text-slate-100 focus:border-blue-500 focus:outline-none"
            >
              <option value="image">image</option>
              <option value="video">video</option>
            </select>

            <button
              onClick={handleAddUrl}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-white transition hover:bg-blue-700"
            >
              Ajouter à la bibliothèque
            </button>
          </>
        )}
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Médias disponibles
        </h4>

        <div className="mt-4 grid max-h-[540px] gap-4 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {library.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0b1220] p-5 text-sm text-slate-500">
              Aucun média dans la bibliothèque.
            </div>
          ) : (
            library.map((media) => (
              <div
                key={media.localId}
                className="overflow-hidden rounded-3xl border border-slate-800 bg-[#111827] shadow-[0_10px_24px_rgba(0,0,0,0.25)]"
              >
                <MediaPreview media={media} />

                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="line-clamp-1 text-base font-semibold text-slate-100">
                      {media.title || 'Sans titre'}
                    </h5>

                    <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300">
                      {media.media_type}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Durée: {media.duration_seconds} sec
                  </p>

                  <button
                    onClick={() => onAddToTimeline(media)}
                    className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700"
                  >
                    Ajouter à la timeline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}