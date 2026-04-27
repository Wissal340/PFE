'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getCaptureById } from '@/lib/api'

type Capture = {
  id: number
  device_id: string
  device_name: string
  device_location?: string
  image_url: string
  visual_status: string
  visual_reason?: string
  compliance_status: string
  compliance_reason?: string
  similarity_score?: number
  expected_media_type?: string
  expected_media_title?: string
  expected_media_url?: string
  created_at: string
}

export default function CaptureDetailPage() {
  const { id } = useParams()
  const [capture, setCapture] = useState<Capture | null>(null)

  useEffect(() => {
    async function load() {
      const data = await getCaptureById(id as string)
      setCapture(data)
    }

    load()
  }, [id])

  if (!capture) return <div className="p-6 text-white">Loading...</div>

  return (
    <div className="min-h-screen bg-[#0b1020] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        <Link href="/visual-monitoring" className="text-blue-400">
          ← Retour
        </Link>

        {/* IMAGE */}
        <div className="rounded-3xl overflow-hidden border border-slate-800">
          <img
            src={capture.image_url}
            className="w-full object-cover"
          />
        </div>

        {/* INFOS */}
        <div className="grid md:grid-cols-2 gap-6">

          <div className="bg-[#111827] p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold mb-4">Device</h2>
            <p><b>Name:</b> {capture.device_name}</p>
            <p><b>Location:</b> {capture.device_location || '-'}</p>
          </div>

          <div className="bg-[#111827] p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold mb-4">Visual</h2>
            <p><b>Status:</b> {capture.visual_status}</p>
            <p><b>Reason:</b> {capture.visual_reason || '-'}</p>
          </div>

          <div className="bg-[#111827] p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold mb-4">Compliance</h2>
            <p><b>Status:</b> {capture.compliance_status}</p>
            <p><b>Reason:</b> {capture.compliance_reason || '-'}</p>
            <p><b>Score:</b> {capture.similarity_score?.toFixed(2) || '-'}</p>
          </div>

          <div className="bg-[#111827] p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold mb-4">Expected Media</h2>
            <p><b>Type:</b> {capture.expected_media_type || '-'}</p>
            <p><b>Title:</b> {capture.expected_media_title || '-'}</p>
            <p><b>URL:</b> {capture.expected_media_url || '-'}</p>
          </div>

        </div>

        <div className="text-sm text-gray-400">
          {new Date(capture.created_at).toLocaleString()}
        </div>

      </div>
    </div>
  )
}