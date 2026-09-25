import { type Place, type Point, categories } from "@/lib/geo";

export function walkingUrl(origin: Point, place: Point) {
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", origin: `${origin.lat},${origin.lon}`, destination: `${place.lat},${place.lon}`, travelmode: "walking" })}`;
}
export default function PlaceDetails({
  place,
  origin,
  addressLabel,
}: {
  place: Place;
  origin: Point;
  addressLabel: string;
}) {
  return (
    <div className="place-details">
      <span className="place-category">
        {categories.find((c) => c.id === place.category)!.label}
      </span>
      <dl>
        <div>
          <dt>Адрес</dt>
          <dd>{place.address || "Не указан в OpenStreetMap"}</dd>
        </div>
        <div>
          <dt>Часы работы</dt>
          <dd>
            {place.openingHours === "24/7"
              ? "Круглосуточно"
              : place.openingHours || "Не указаны в OpenStreetMap"}
          </dd>
        </div>
        <div>
          <dt>От адреса {addressLabel}</dt>
          <dd>
            {place.distance} м по прямой
            {place.distanceBasis === "entrance"
              ? " до ближайшего известного входа"
              : place.distanceBasis === "center"
                ? " до центра объекта (приблизительно)"
                : ""}
          </dd>
        </div>
      </dl>
      {place.openingHours && place.openingHours !== "24/7" && (
        <p className="place-note">
          Расписание в записи OSM. Актуальное время уточняйте у организации.
        </p>
      )}
      {(place.sourceIds?.length ?? 0) > 1 && (
        <p className="place-note">
          Объединены записи остановки: {place.sourceIds!.length}. Показана
          ближайшая точка.
        </p>
      )}
      {place.category === "parks" && place.distanceBasis !== "entrance" && (
        <p className="place-note">
          Подходящий вход не найден в данных OSM. Маршрут ведёт к точке объекта,
          а не к подтверждённому входу.
        </p>
      )}
      <div className="place-links">
        <a href={walkingUrl(origin, place)} target="_blank" rel="noreferrer">
          Пеший маршрут в Google Maps ↗
        </a>
        <a
          href={`https://www.openstreetmap.org/${place.id}`}
          target="_blank"
          rel="noreferrer"
        >
          Карточка OpenStreetMap ↗
        </a>
      </div>
    </div>
  );
}
