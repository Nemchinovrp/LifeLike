"use client";
import { useState } from "react";
import { categories, type Place, type Point, type Category } from "@/lib/geo";
import PlaceDetails from "./place-details";
export default function PlaceList({
  places,
  origin,
  index,
  onSelect,
}: {
  places: Place[];
  origin: Point;
  index: number;
  onSelect: (place: Place, index: number) => void;
}) {
  const [category, setCategory] = useState<Category | "">("");
  const [sort, setSort] = useState("distance");
  const [limit, setLimit] = useState(10);
  const filtered = places
    .filter((p) => !category || p.category === category)
    .sort((a, b) =>
      sort === "name"
        ? a.label.localeCompare(b.label, "ru") || a.distance - b.distance
        : a.distance - b.distance,
    );
  return (
    <details className="place-list">
      <summary>Объекты рядом · {places.length}</summary>
      <div className="place-controls">
        <label>
          Категория
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as Category | "");
              setLimit(10);
            }}
          >
            <option value="">Все категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Сортировка
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setLimit(10);
            }}
          >
            <option value="distance">Сначала ближайшие</option>
            <option value="name">По названию</option>
          </select>
        </label>
      </div>
      <p className="place-note" aria-live="polite">
        Найдено: {filtered.length}. Расстояния от адреса {index ? "B" : "A"}.
      </p>
      {filtered.length === 0 ? (
        <p className="place-note">
          В этой категории нет объектов в данных OSM.
        </p>
      ) : (
        <ul>
          {filtered.slice(0, limit).map((p) => (
            <li key={p.id}>
              <details>
                <summary>
                  <span>{p.label}</span>
                  <small>{p.distance} м</small>
                </summary>
                <PlaceDetails
                  place={p}
                  origin={origin}
                  addressLabel={index ? "B" : "A"}
                />
                <button
                  className="show-place"
                  onClick={() => onSelect(p, index)}
                >
                  Показать на карте
                </button>
              </details>
            </li>
          ))}
        </ul>
      )}
      {limit < filtered.length && (
        <button className="show-place" onClick={() => setLimit(limit + 10)}>
          Показать ещё {Math.min(10, filtered.length - limit)}
        </button>
      )}
    </details>
  );
}
