'use client'

import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'

type Props = {
  value: { lat: number; lng: number } | null
  onChange: (coords: { lat: number; lng: number }) => void
}
const screenIcon = L.icon({
  iconUrl: '/screen-marker.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
})

function ClickHandler({ onChange }: { onChange: Props['onChange'] }) {
  useMapEvents({
    click(e) {
      onChange({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      })
    },
  })
  return null
}

export default function MapPicker({ value, onChange }: Props) {
  const center: LatLngExpression = value
    ? [value.lat, value.lng]
    : [34.7398, 10.7600]

  return (
    <div className="overflow-hidden rounded-2xl border">
      <MapContainer
        center={center}
        zoom={7}
        style={{ height: '350px', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickHandler onChange={onChange} />

        {value && <Marker position={[value.lat, value.lng]} icon={screenIcon} />}
      </MapContainer>
    </div>
  )
}