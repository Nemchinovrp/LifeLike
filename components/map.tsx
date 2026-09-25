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
import PlaceDetails from "./place-details";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
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
type Selection = { place: Place; origin: Point; index: number };
function FocusPlace({ selected }: { selected: Selection | null }) {
  const map = useMap();
  useEffect(() => {
    if (selected)
      map.setView(
        [selected.place.lat, selected.place.lon],
        Math.max(map.getZoom(), 16),
      );
  }, [map, selected]);
  return selected ? (
    <Popup
      key={`${selected.index}-${selected.place.id}`}
      position={[selected.place.lat, selected.place.lon]}
      minWidth={240}
      maxWidth={300}
    >
      <strong>{selected.place.label}</strong>
      <PlaceDetails
        place={selected.place}
        origin={selected.origin}
        addressLabel={selected.index ? "B" : "A"}
      />
    </Popup>
  ) : null;
}
export default function Map({
  points,
  places,
  radius,
  onPick,
  selected,
  onSelect,
}: {
  selected: Selection | null;
  onSelect: (place: Place) => void;
  points: (Point | null)[];
  places: Place[];
  radius: number;
  onPick: (p: Point) => void;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lifelike-map-theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* The switch works even when browser storage is unavailable. */
    }
  }, []);
  function changeTheme(value: "light" | "dark") {
    setTheme(value);
    try {
      localStorage.setItem("lifelike-map-theme", value);
    } catch {
      /* Keep the session preference. */
    }
  }
  return (
    <div className={`map-shell map-theme-${theme}`}>
      <div className="map-theme-switch" role="group" aria-label="Тема карты">
        <button
          type="button"
          aria-pressed={theme === "light"}
          onClick={() => changeTheme("light")}
        >
          <Sun size={16} aria-hidden="true" />
          Светлая
        </button>
        <button
          type="button"
          aria-pressed={theme === "dark"}
          onClick={() => changeTheme("dark")}
        >
          <Moon size={16} aria-hidden="true" />
          Тёмная
        </button>
      </div>
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
        <FocusPlace selected={selected} />
        {places.map((p) => (
          <CircleMarker
            key={p.id}
            bubblingMouseEvents={false}
            center={[p.lat, p.lon]}
            eventHandlers={{ click: () => onSelect(p) }}
            radius={selected?.place.id === p.id ? 9 : 5}
            pathOptions={{
              color: "#fff",
              weight: 2,
              fillColor: categories.find((c) => c.id === p.category)!.color,
              fillOpacity: 1,
            }}
          ></CircleMarker>
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
    </div>
  );
}
