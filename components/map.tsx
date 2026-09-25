"use client";
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { latLng, latLngBounds } from "leaflet";
import { useEffect } from "react";
import { categories, type Point, type Place } from "@/lib/geo";
import "leaflet/dist/leaflet.css";
function Events({
  onPick,
  points,
  radius,
}: {
  onPick: (p: Point) => void;
  points: (Point | null)[];
  radius: number;
}) {
  const map = useMap();
  useMapEvents({
    click: (e) =>
      onPick({
        lat: e.latlng.lat,
        lon: e.latlng.wrap().lng,
        label: `Точка на карте · ${e.latlng.lat.toFixed(5)}, ${e.latlng.wrap().lng.toFixed(5)}`,
      }),
  });
  useEffect(() => {
    const selected = points.filter((p): p is Point => !!p);
    if (selected.length) {
      const bounds = latLngBounds(selected.map((p) => latLng(p.lat, p.lon)));
      selected.forEach((p) =>
        bounds.extend(latLng(p.lat, p.lon).toBounds(radius * 2)),
      );
      map.fitBounds(bounds, {
        paddingTopLeft: [35, 125],
        paddingBottomRight: [35, 100],
        maxZoom: 16,
      });
    }
  }, [map, points, radius]);
  return null;
}
export default function Map({
  points,
  places,
  radius,
  onPick,
}: {
  points: (Point | null)[];
  places: Place[];
  radius: number;
  onPick: (p: Point) => void;
}) {
  return (
    <MapContainer
      center={[55.751, 37.615]}
      zoom={13}
      className="map"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Events points={points} radius={radius} onPick={onPick} />
      {points.map(
        (p, i) =>
          p && (
            <Circle
              key={i}
              center={[p.lat, p.lon]}
              radius={radius}
              interactive={false}
              pathOptions={{
                color: i ? "#7760b7" : "#23795c",
                weight: 2,
                fillOpacity: 0.07,
                dashArray: "6 7",
              }}
            >
              <Popup>
                {i ? "B" : "A"} · {p.label}
              </Popup>
            </Circle>
          ),
      )}
      {places.map((p) => (
        <CircleMarker
          key={p.id}
          bubblingMouseEvents={false}
          center={[p.lat, p.lon]}
          radius={5}
          pathOptions={{
            color: "#fff",
            weight: 2,
            fillColor: categories.find((c) => c.id === p.category)!.color,
            fillOpacity: 1,
          }}
        >
          <Popup>
            <strong>{p.label}</strong>
            <br />
            {categories.find((c) => c.id === p.category)!.label}
          </Popup>
        </CircleMarker>
      ))}
      {points.map(
        (p, i) =>
          p && (
            <CircleMarker
              key={`point-${i}`}
              bubblingMouseEvents={false}
              center={[p.lat, p.lon]}
              radius={14}
              pathOptions={{
                color: "#fff",
                weight: 4,
                fillColor: i ? "#7760b7" : "#23795c",
                fillOpacity: 1,
              }}
            >
              <Tooltip permanent direction="center" className="point-label">
                {i ? "B" : "A"}
              </Tooltip>
              <Popup>
                {i ? "B" : "A"} · {p.label}
              </Popup>
            </CircleMarker>
          ),
      )}
    </MapContainer>
  );
}
