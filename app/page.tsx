"use client";
import PlaceList from "@/components/place-list";
import dynamic from "next/dynamic";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  MapPin,
  Search,
  ArrowUpRight,
  SlidersHorizontal,
  Leaf,
  ShoppingBasket,
  GraduationCap,
  Bus,
  Plus,
  X,
  LocateFixed,
  ArrowRight,
  LoaderCircle,
  Pill,
  Hospital,
  Baby,
  Dumbbell,
  Package,
} from "lucide-react";
import {
  categories,
  defaultWeights,
  score,
  dataQuality,
  type Point,
  type Place,
  type Analysis,
  type Category,
} from "@/lib/geo";
const NeighborhoodMap = dynamic(() => import("@/components/map"), {
  ssr: false,
  loading: () => <div className="map-loading">Загружаем карту…</div>,
});
const icons = {
  shops: ShoppingBasket,
  schools: GraduationCap,
  parks: Leaf,
  transport: Bus,
  pharmacies: Pill,
  clinics: Hospital,
  kindergartens: Baby,
  sports: Dumbbell,
  pickup: Package,
};
async function json<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Не удалось загрузить данные");
  return data;
}
function Result({
  point,
  radius,
  weights,
  onData,
  index,
  retryKey,
  onSelect,
}: {
  point: Point;
  radius: number;
  weights: typeof defaultWeights;
  onData: (index: number, data: Analysis | null) => void;
  index: number;
  retryKey: number;
  onSelect: (place: Place, index: number) => void;
}) {
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    onData(index, null);
    json<Analysis>(
      `/api/nearby?lat=${point.lat}&lon=${point.lon}&radius=${radius}`,
      c.signal,
    )
      .then((d) => {
        setData(d);
        onData(index, d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [point, radius, index, onData, retryKey]);
  if (error)
    return (
      <div role="alert" className="error">
        {error}
      </div>
    );
  if (!data)
    return (
      <div className="loading">
        <LoaderCircle size={17} className="spin" /> Изучаем окружение…
      </div>
    );
  const s = score(data.places, weights);
  const quality = dataQuality(data.places);
  return (
    <>
      <div className="score">
        <div>
          <span className="eyebrow">ПО ВАШИМ ПРИОРИТЕТАМ</span>
          <p>
            {s === null
              ? "Выберите приоритеты"
              : s >= 70
                ? "Всё нужное рядом"
                : s >= 35
                  ? "Есть из чего выбрать"
                  : "Стоит присмотреться"}
          </p>
        </div>
        <strong>
          {s ?? "—"}
          <small>/100</small>
        </strong>
      </div>
      <div className="stats">
        {categories.map((c) => {
          const Icon = icons[c.id];
          const list = data.places.filter((p) => p.category === c.id);
          return (
            <div key={c.id}>
              <Icon size={19} style={{ color: c.color }} />
              <span>
                {c.label}
                <small>
                  {list.length
                    ? `ближайший объект · ${list[0].distance} м`
                    : "нет в данных OSM"}
                </small>
              </span>
              <b>{list.length}</b>
            </div>
          );
        })}
      </div>
      <details className="data-quality">
        <summary>
          Заполненность сведений ·{" "}
          {quality.percent === null ? "нет объектов" : `${quality.percent}%`}
        </summary>
        <p>
          Это заполненность полей найденных объектов, а не доля всех мест
          района, нанесённых на карту.
        </p>
        <ul>
          <li>
            Название: {quality.named} из {quality.total}
          </li>
          <li>
            Адрес: {quality.addressed} из {quality.total}
          </li>
          <li>
            Часы работы: {quality.scheduled} из {quality.total}
          </li>
          <li>
            Парки с известным входом: {quality.entrances} из {quality.parks}
          </li>
          <li>Объединено дублей остановок: {quality.merged}</li>
        </ul>
        <p>
          Для парков без подходящего входа используется центр или точка OSM. Не
          все объекты нуждаются в адресе и расписании; сведения могут быть
          неполными или устаревшими.
        </p>
      </details>
      <PlaceList
        places={data.places}
        origin={point}
        index={index}
        onSelect={onSelect}
      />
      <p className="timestamp">
        Данные на{" "}
        {new Date(data.fetchedAt).toLocaleString("ru-RU", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </>
  );
}
export default function Home() {
  const [points, setPoints] = useState<(Point | null)[]>([null, null]);
  const [active, setActive] = useState(0);
  const [radius, setRadius] = useState(1000);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Point[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searched, setSearched] = useState(false);
  const [weights, setWeights] = useState(defaultWeights);
  const [preferences, setPreferences] = useState(false);
  const [data, setData] = useState<(Analysis | null)[]>([null, null]);
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<Category | null>(null);
  const [selection, setSelection] = useState<{
    id: string;
    index: number;
  } | null>(null);
  const selectedPlace = selection
    ? data[selection.index]?.places.find((p) => p.id === selection.id)
    : undefined;
  function selectPlace(place: Place, index: number) {
    setFilter(null);
    setSelection({ id: place.id, index });
    document
      .querySelector(".map-section")
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  const searchController = useRef<AbortController | null>(null);
  const onData = useMemo(
    () => (index: number, value: Analysis | null) =>
      setData((prev) => prev.map((d, i) => (i === index ? value : d))),
    [],
  );
  function pick(p: Point) {
    setPoints((prev) => prev.map((v, i) => (i === active ? p : v)));
    setData((prev) => prev.map((v, i) => (i === active ? null : v)));
    setResults([]);
    setQuery("");
    setSearched(false);
    setSearchError("");
  }
  async function search(e: React.FormEvent) {
    e.preventDefault();
    searchController.current?.abort();
    const c = new AbortController();
    searchController.current = c;
    setSearching(true);
    setSearchError("");
    setResults([]);
    setSearched(false);
    try {
      setResults(
        await json<Point[]>(
          `/api/search?q=${encodeURIComponent(query)}`,
          c.signal,
        ),
      );
      setSearched(true);
    } catch (e) {
      if (!c.signal.aborted) setSearchError((e as Error).message);
    } finally {
      if (!c.signal.aborted) setSearching(false);
    }
  }
  const places = useMemo(() => {
    const list = data
      .flatMap((d) => d?.places ?? [])
      .filter((p) => !filter || p.category === filter);
    return [...new Map(list.map((p) => [p.id, p])).values()];
  }, [data, filter]);
  const scores = data.map((d) => (d ? score(d.places, weights) : null));
  return (
    <>
      <header className="header">
        <a href="/" className="brand">
          <span className="brand-icon">
            <MapPin size={24} />
          </span>
          LifeLike<span className="brand-tag">МЕСТО ДЛЯ ЖИЗНИ</span>
        </a>
        <span className="header-note">
          Хороший район начинается с ваших привычек
          <ArrowUpRight size={18} />
        </span>
      </header>
      <main>
        <aside className="sidebar">
          <div className="intro">
            <span className="eyebrow">ИССЛЕДУЙТЕ. СРАВНИВАЙТЕ. ВЫБИРАЙТЕ.</span>
            <h1>
              Как здесь
              <br />
              живётся<span>?</span>
            </h1>
            <p>
              Узнайте, что рядом с домом.
              <br />И найдите место, которое подходит вам.
            </p>
          </div>
          <div className="search-area">
            <div className="section-title">
              <h2>Ваши адреса</h2>
              <span>до 2 точек</span>
            </div>
            <div className="point-tabs">
              {["Адрес A", "Адрес B"].map((label, i) => (
                <button
                  key={label}
                  className={active === i ? "selected" : ""}
                  onClick={() => {
                    setActive(i);
                    setResults([]);
                    setSearched(false);
                  }}
                >
                  <span className={`letter point-${i}`}>{i ? "B" : "A"}</span>
                  {label}
                  {points[i] && <span className="tab-check">✓</span>}
                </button>
              ))}
            </div>
            <form onSubmit={search} className="search">
              <Search size={19} />
              <input
                aria-label={`Поиск адреса ${active ? "B" : "A"}`}
                placeholder="Город, улица, дом"
                minLength={3}
                maxLength={200}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearched(false);
                  setResults([]);
                }}
                required
              />
              <button
                title="Найти адрес"
                aria-label="Найти адрес"
                disabled={searching}
              >
                {searching ? (
                  <LoaderCircle size={19} className="spin" />
                ) : (
                  <ArrowRight size={19} />
                )}
              </button>
            </form>
            {searchError && (
              <p className="error" role="alert">
                {searchError}
              </p>
            )}
            {searched && !results.length && (
              <p className="hint">
                Адрес не найден. Уточните город или выберите точку на карте.
              </p>
            )}
            {!!results.length && (
              <ul className="search-results">
                {results.map((p, i) => (
                  <li key={i}>
                    <button onClick={() => pick(p)}>
                      <MapPin size={16} />
                      {p.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="hint">
              <LocateFixed size={14} /> Или нажмите на дом на карте → точка{" "}
              {active ? "B" : "A"}
            </p>
            <div className="radius">
              <span>Радиус вокруг дома</span>
              <div>
                {[500, 1000, 2000].map((r) => (
                  <button
                    key={r}
                    className={radius === r ? "selected" : ""}
                    onClick={() => {
                      if (r !== radius) {
                        setRadius(r);
                        setData([null, null]);
                      }
                    }}
                  >
                    {r === 500 ? "500 м" : `${r / 1000} км`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            className={`preferences-toggle ${preferences ? "open" : ""}`}
            onClick={() => setPreferences(!preferences)}
            aria-expanded={preferences}
          >
            <SlidersHorizontal size={18} />
            <span>Что для вас важнее?</span>
            <Plus size={18} />
          </button>
          {preferences && (
            <div className="preferences">
              <p>0 — не важно · 5 — очень важно</p>
              {categories.map((c) => {
                const Icon = icons[c.id];
                return (
                  <label key={c.id}>
                    <span>
                      <Icon size={16} />
                      {c.label}
                      <b>{weights[c.id]}</b>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      value={weights[c.id]}
                      onChange={(e) =>
                        setWeights({
                          ...weights,
                          [c.id]: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                );
              })}
            </div>
          )}
          <div className="address-cards">
            {points.map((point, i) =>
              point ? (
                <article key={i} className={`address-card card-${i}`}>
                  <div className="address-heading">
                    <span className={`letter point-${i}`}>{i ? "B" : "A"}</span>
                    <h3>{point.label}</h3>
                    <button
                      aria-label={`Удалить адрес ${i ? "B" : "A"}`}
                      onClick={() => {
                        setPoints((prev) =>
                          prev.map((p, j) => (i === j ? null : p)),
                        );
                        onData(i, null);
                      }}
                    >
                      <X size={17} />
                    </button>
                  </div>
                  <Result
                    point={point}
                    radius={radius}
                    weights={weights}
                    index={i}
                    onData={onData}
                    onSelect={selectPlace}
                    retryKey={retry}
                  />
                  <button
                    className="text-button"
                    onClick={() => setRetry(retry + 1)}
                  >
                    Повторить загрузку
                  </button>
                </article>
              ) : i === 0 ? (
                <div key={i} className="empty-card">
                  <span className="empty-icon">
                    <MapPin size={25} />
                  </span>
                  <h3>Начнём с первого адреса</h3>
                  <p>
                    Найдите дом через поиск или поставьте точку на карте. Мы
                    посмотрим, что есть поблизости.
                  </p>
                </div>
              ) : (
                <button
                  key={i}
                  className="add-address"
                  onClick={() => setActive(1)}
                >
                  <Plus size={20} />
                  <span>
                    Добавьте второй адрес<small>Чтобы сравнить окружение</small>
                  </span>
                </button>
              ),
            )}
          </div>
          {data[0] && data[1] && (
            <div className="comparison">
              <h2>Сравнение адресов</h2>
              <p>
                {scores.some((s) => s === null)
                  ? "Задайте хотя бы один приоритет."
                  : scores[0] === scores[1]
                    ? "По вашим приоритетам — ничья."
                    : `Адрес ${scores[0]! > scores[1]! ? "A" : "B"} набирает больше баллов.`}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Рядом с домом</th>
                    <th>A</th>
                    <th>B</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}>
                      <td>{c.label}</td>
                      {data.map((d, i) => (
                        <td key={i}>
                          {d!.places.filter((p) => p.category === c.id).length}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <details className="method">
            <summary>Как мы считаем?</summary>
            <p>
              Расстояния по прямой, а не маршрут пешком. Для парков используем
              ближайший известный вход на границе; без него — точку или центр
              объекта (приблизительно). Объекты за пределами выбранного радиуса
              не учитываются.
            </p>
            <p>
              Оценка 0–100 — взвешенное среднее наполненности категорий. За 100%
              принимаем 8 магазинов, 3 школы, 3 парка, 10 остановок, 3 аптеки, 2
              поликлиники, 3 детсада, 4 спортплощадки и 4 пункта выдачи. Это
              условные ориентиры, не оценка качества района. Нулевые приоритеты
              исключаются.
            </p>
            <p>
              Близкие записи остановки и платформы с одинаковым названием
              объединяются при совместимых тегах. Разные направления и
              неоднозначные записи остаются отдельно. В OpenStreetMap могут
              отсутствовать объекты. Отсутствие в данных не означает отсутствие
              в жизни.
            </p>
          </details>
          <footer>
            Сделано для осознанного выбора.
            <br />
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              © OpenStreetMap contributors
            </a>{" "}
            · ODbL
          </footer>
        </aside>
        <section className="map-section" aria-label="Карта окружения">
          <div className="map-top">
            <span>
              <span className="live-dot" /> Ваш район крупным планом
            </span>
            <span className="map-radius">
              Радиус {radius === 500 ? "500 м" : `${radius / 1000} км`}
            </span>
          </div>
          <NeighborhoodMap
            selected={
              selectedPlace && selection && points[selection.index]
                ? {
                    place: selectedPlace,
                    origin: points[selection.index]!,
                    index: selection.index,
                  }
                : null
            }
            onSelect={(place) => {
              const index = data[active]?.places.some((p) => p.id === place.id)
                ? active
                : data.findIndex((d) =>
                    d?.places.some((p) => p.id === place.id),
                  );
              if (index >= 0)
                selectPlace(
                  data[index]!.places.find((p) => p.id === place.id)!,
                  index,
                );
            }}
            points={points}
            radius={radius}
            places={places}
            onPick={pick}
          />
          <div className="map-instruction">
            <MapPin size={19} />
            <span>
              Нажмите на карту, чтобы выбрать <b>адрес {active ? "B" : "A"}</b>
            </span>
          </div>
          <div className="legend">
            {categories.map((c) => {
              const Icon = icons[c.id];
              return (
                <button
                  key={c.id}
                  aria-pressed={filter === c.id}
                  className={filter === c.id ? "active" : ""}
                  onClick={() => {
                    setSelection(null);
                    setFilter(filter === c.id ? null : c.id);
                  }}
                >
                  <Icon size={17} style={{ color: c.color }} />
                  {c.label}
                </button>
              );
            })}
          </div>
          <div className="map-caption">Ближе к тому, что важно вам.</div>
        </section>
      </main>
    </>
  );
}
