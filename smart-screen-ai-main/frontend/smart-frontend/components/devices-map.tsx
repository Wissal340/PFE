'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import Link from 'next/link'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'

type Device = {
  id: string
  name: string
  location?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: string
  is_online?: boolean
}

const onlineIcon = L.icon({
  iconUrl: '/screengreen.png',
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -42],
})

const offlineIcon = L.icon({
  iconUrl: '/screenred.png',
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -42],
})

const focusedIcon = L.icon({
  iconUrl: '/screengreen.png',
  iconSize: [54, 54],
  iconAnchor: [27, 54],
  popupAnchor: [0, -54],
})

function getDeviceIcon(device: Device, focusedId?: string | null) {
  if (focusedId && device.id === focusedId) {
    return focusedIcon
  }

  if (device.status === 'online' || device.is_online === true) {
    return onlineIcon
  }

  return offlineIcon
}

export default function DevicesMap({
  devices,
  focusedId,
}: {
  devices: Device[]
  focusedId?: string | null
}) {
  const devicesWithCoords = devices.filter(
    (d) => d.latitude != null && d.longitude != null
  )

  const focusedDevice =
    focusedId != null
      ? devicesWithCoords.find((d) => d.id === focusedId)
      : null

  const center =
    focusedDevice
      ? [focusedDevice.latitude!, focusedDevice.longitude!] as [number, number]
      : devicesWithCoords.length > 0
      ? [devicesWithCoords[0].latitude!, devicesWithCoords[0].longitude!] as [number, number]
      : [34.7398, 10.7600] as [number, number]

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <MapContainer
        center={center}
        zoom={focusedDevice ? 13 : 7}
        style={{ height: '620px', width: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {devicesWithCoords.map((device) => {
          const isOnline = device.status === 'online' || device.is_online === true

          return (
            <Marker
              key={device.id}
              position={[device.latitude!, device.longitude!]}
              icon={getDeviceIcon(device, focusedId)}
            >
              <Popup>
                <div className="min-w-[220px]">
                  <div className="text-base font-semibold text-slate-900">
                    📺 {device.name}
                  </div>

                  <div className="mt-2 text-sm text-slate-700">
                    <div>
                      <b>Location:</b> {device.location || 'No location'}
                    </div>
                    <div>
                      <b>Latitude:</b> {device.latitude?.toFixed(6)}
                    </div>
                    <div>
                      <b>Longitude:</b> {device.longitude?.toFixed(6)}
                    </div>
                  </div>

                  <div className="mt-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        isOnline
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <div className="mt-4">
                    <Link
                      href={`/devices/${device.id}`}
                      className="inline-block rounded-lg bg-slate-900 px-3 py-2 text-xs text-white"
                    >
                      Voir détail
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}