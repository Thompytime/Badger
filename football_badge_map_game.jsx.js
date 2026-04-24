import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import "leaflet/dist/leaflet.css";

// Football Badge Map Game
// A GeoGuessr/EthnoGuessr-style football geography prototype.
// Uses a real interactive OpenStreetMap/Leaflet map.
// Badges here are original placeholder SVG-style crests to avoid club-logo licensing issues.
// This version avoids lucide-react and Web Crypto so it works in stricter sandboxes.

const TEAMS = [
  {
    id: "north-london-cannons",
    name: "North London Cannons",
    hint: "A red club from north London",
    city: "London, England",
    stadium: "Emirates Stadium",
    lat: 51.5549,
    lng: -0.1084,
    colors: ["#d71920", "#ffffff"],
    monogram: "NLC",
  },
  {
    id: "catalan-crowns",
    name: "Catalan Crowns",
    hint: "A giant from Catalonia",
    city: "Barcelona, Spain",
    stadium: "Camp Nou",
    lat: 41.3809,
    lng: 2.1228,
    colors: ["#004d98", "#a50044"],
    monogram: "CC",
  },
  {
    id: "bavarian-stars",
    name: "Bavarian Stars",
    hint: "A red powerhouse in Bavaria",
    city: "Munich, Germany",
    stadium: "Allianz Arena",
    lat: 48.2188,
    lng: 11.6247,
    colors: ["#dc052d", "#ffffff"],
    monogram: "BS",
  },
  {
    id: "milan-serpents",
    name: "Milan Serpents",
    hint: "Blue and black from northern Italy",
    city: "Milan, Italy",
    stadium: "San Siro",
    lat: 45.4781,
    lng: 9.1239,
    colors: ["#010e80", "#000000"],
    monogram: "MS",
  },
  {
    id: "lisbon-eagles",
    name: "Lisbon Eagles",
    hint: "A red club near the Atlantic",
    city: "Lisbon, Portugal",
    stadium: "Estádio da Luz",
    lat: 38.7528,
    lng: -9.1847,
    colors: ["#e00000", "#ffd700"],
    monogram: "LE",
  },
  {
    id: "istanbul-lions",
    name: "Istanbul Lions",
    hint: "A yellow-red giant straddling continents",
    city: "Istanbul, Türkiye",
    stadium: "Rams Park",
    lat: 41.1033,
    lng: 28.9906,
    colors: ["#fdb912", "#a90432"],
    monogram: "IL",
  },
  {
    id: "buenos-aires-river",
    name: "Buenos Aires River",
    hint: "A white shirt with a red sash",
    city: "Buenos Aires, Argentina",
    stadium: "Estadio Mâs Monumental",
    lat: -34.5453,
    lng: -58.4498,
    colors: ["#ffffff", "#e30613"],
    monogram: "BAR",
  },
  {
    id: "rio-flames",
    name: "Rio Flames",
    hint: "Red and black by Guanabara Bay",
    city: "Rio de Janeiro, Brazil",
    stadium: "Maracanã",
    lat: -22.9122,
    lng: -43.2302,
    colors: ["#c40013", "#111111"],
    monogram: "RF",
  },
  {
    id: "tokyo-cranes",
    name: "Tokyo Cranes",
    hint: "A Japanese capital club",
    city: "Tokyo, Japan",
    stadium: "Ajinomoto Stadium",
    lat: 35.6642,
    lng: 139.527,
    colors: ["#004ea2", "#e60012"],
    monogram: "TC",
  },
  {
    id: "cairo-suns",
    name: "Cairo Suns",
    hint: "A historic red club on the Nile",
    city: "Cairo, Egypt",
    stadium: "Cairo International Stadium",
    lat: 30.0691,
    lng: 31.3123,
    colors: ["#d00000", "#f6c445"],
    monogram: "CS",
  },
];

function Icon({ name, className = "h-4 w-4" }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };

  const paths = {
    trophy: (
      <>
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M5 5H3v2a4 4 0 0 0 4 4" />
        <path d="M19 5h2v2a4 4 0 0 1-4 4" />
      </>
    ),
    calendar: (
      <>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 14h.01" />
        <path d="M12 14h.01" />
        <path d="M16 14h.01" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    reset: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 3v6h6" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </>
    ),
  };

  return <svg {...common}>{paths[name] || paths.info}</svg>;
}

function seededDailyIndex(date = new Date()) {
  const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return hash % TEAMS.length;
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function scoreForDistance(km) {
  if (!Number.isFinite(km) || km < 0) return 0;
  return Math.max(0, Math.round(5000 * Math.exp(-km / 900)));
}

function guessMessage(km) {
  if (km < 1) return "Perfect. You found the stadium.";
  if (km < 10) return "Excellent — basically matchday traffic distance.";
  if (km < 50) return "Very close. You know the right area.";
  if (km < 250) return "Good region, but not quite the city.";
  if (km < 1000) return "Right part of the continent, keep narrowing it down.";
  return "Long way off. Use the clue and badge colours.";
}

function makeGuessId(counter = 0) {
  // Do not use crypto.randomUUID here. Some preview/build sandboxes do not expose Web Crypto.
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `guess-${counter}-${timePart}-${randomPart}`;
}

function runDevTests() {
  const tests = [
    {
      name: "haversine returns zero for identical coordinates",
      pass: Math.abs(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })) < 0.001,
    },
    {
      name: "London to Barcelona distance is plausible",
      pass: (() => {
        const km = haversineKm({ lat: 51.5549, lng: -0.1084 }, { lat: 41.3809, lng: 2.1228 });
        return km > 1100 && km < 1200;
      })(),
    },
    {
      name: "score decreases as distance increases",
      pass: scoreForDistance(1) > scoreForDistance(1000),
    },
    {
      name: "daily index always points at a team",
      pass: seededDailyIndex(new Date("2026-04-24T00:00:00Z")) >= 0 && seededDailyIndex(new Date("2026-04-24T00:00:00Z")) < TEAMS.length,
    },
    {
      name: "guess IDs are strings without Web Crypto",
      pass: typeof makeGuessId(1) === "string" && makeGuessId(1).startsWith("guess-1-"),
    },
    {
      name: "guess IDs vary by counter",
      pass: makeGuessId(1) !== makeGuessId(2),
    },
  ];

  const failed = tests.filter((test) => !test.pass);
  if (failed.length > 0) {
    console.error("BadgeFinder FC self-tests failed:", failed.map((test) => test.name));
  }
}

function ClickHandler({ onGuess }) {
  useMapEvents({
    click(e) {
      onGuess({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function makeIcon(label, bg = "#111827") {
  return L.divIcon({
    className: "custom-pin",
    html: `<div style="background:${bg};color:white;border:2px solid white;border-radius:999px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-weight:800;box-shadow:0 8px 20px rgba(0,0,0,.25);font-size:12px">${label}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function Badge({ team, large = false }) {
  const [a, b] = team.colors;
  return (
    <div
      className={`relative grid place-items-center overflow-hidden shadow-xl ${large ? "h-32 w-28" : "h-16 w-14"}`}
      style={{ clipPath: "polygon(50% 0%, 92% 13%, 82% 78%, 50% 100%, 18% 78%, 8% 13%)" }}
      aria-label={`${team.name} badge`}
    >
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${a} 0 50%, ${b} 50% 100%)` }} />
      <div className="absolute inset-2 border-2 border-white/80" style={{ clipPath: "polygon(50% 0%, 92% 13%, 82% 78%, 50% 100%, 18% 78%, 8% 13%)" }} />
      <div className={`relative z-10 rounded-full bg-white/90 px-2 py-1 text-center font-black tracking-tight text-slate-900 ${large ? "text-xl" : "text-xs"}`}>
        {team.monogram}
      </div>
    </div>
  );
}

export default function FootballBadgeMapGame() {
  useEffect(() => {
    runDevTests();
  }, []);

  const nextIdRef = useRef(1);
  const dailyIndex = useMemo(() => seededDailyIndex(), []);
  const [mode, setMode] = useState("daily");
  const [teamIndex, setTeamIndex] = useState(dailyIndex);
  const [guesses, setGuesses] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const team = TEAMS[teamIndex];
  const target = { lat: team.lat, lng: team.lng };
  const lastGuess = guesses[guesses.length - 1];
  const bestGuess = guesses.reduce((best, g) => (!best || g.distanceKm < best.distanceKm ? g : best), null);
  const guessIcon = useMemo(() => makeIcon("?", "#2563eb"), []);
  const targetIcon = useMemo(() => makeIcon("⚽", "#16a34a"), []);

  function handleGuess(point) {
    const distanceKm = haversineKm(point, target);
    const score = scoreForDistance(distanceKm);
    const id = makeGuessId(nextIdRef.current);
    nextIdRef.current += 1;
    setGuesses((prev) => [...prev, { ...point, distanceKm, score, id }]);
  }

  function resetRound(nextIndex = teamIndex) {
    setTeamIndex(nextIndex);
    setGuesses([]);
    setRevealed(false);
    setShowHint(false);
  }

  function nextTeam() {
    setMode("practice");
    resetRound((teamIndex + 1) % TEAMS.length);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 lg:grid lg:grid-cols-[390px_1fr]">
        <motion.aside initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card className="border-white/10 bg-white/10 text-white shadow-2xl backdrop-blur">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Icon name="calendar" className="h-4 w-4" /> {mode === "daily" ? "Daily badge" : "Practice round"}
                  </div>
                  <h1 className="mt-1 text-3xl font-black tracking-tight">BadgeFinder FC</h1>
                </div>
                <Icon name="trophy" className="h-8 w-8 text-yellow-300" />
              </div>

              <div className="flex items-center gap-5 rounded-3xl bg-slate-900/70 p-4">
                <Badge team={team} large />
                <div className="min-w-0">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Locate where they play</p>
                  <h2 className="mt-1 text-2xl font-black leading-tight">{team.name}</h2>
                  <p className="mt-2 text-sm text-slate-300">Click the world map to place a guess. Each new guess gives distance and score, so you can home in on the stadium.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-slate-900/70 p-3">
                  <div className="text-xs text-slate-400">Guesses</div>
                  <div className="text-2xl font-black">{guesses.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-900/70 p-3">
                  <div className="text-xs text-slate-400">Best</div>
                  <div className="text-2xl font-black">{bestGuess ? `${Math.round(bestGuess.distanceKm)}km` : "—"}</div>
                </div>
                <div className="rounded-2xl bg-slate-900/70 p-3">
                  <div className="text-xs text-slate-400">Score</div>
                  <div className="text-2xl font-black">{bestGuess ? bestGuess.score : "—"}</div>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {lastGuess ? (
                  <motion.div
                    key={lastGuess.id}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-3xl border border-blue-300/20 bg-blue-500/15 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <Icon name="target" className="mt-1 h-5 w-5 text-blue-200" />
                      <div>
                        <div className="text-xl font-black">{lastGuess.distanceKm.toFixed(1)} km away</div>
                        <p className="text-sm text-blue-100">{guessMessage(lastGuess.distanceKm)}</p>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
                    Your first click drops a pin. Keep clicking to improve your distance.
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setShowHint((v) => !v)} variant="secondary" className="rounded-2xl">
                  <Icon name="info" className="mr-2 h-4 w-4" /> {showHint ? "Hide clue" : "Show clue"}
                </Button>
                <Button onClick={() => resetRound()} variant="secondary" className="rounded-2xl">
                  <Icon name="reset" className="mr-2 h-4 w-4" /> Reset
                </Button>
                <Button onClick={() => setRevealed(true)} className="rounded-2xl bg-emerald-600 hover:bg-emerald-700">
                  Reveal stadium
                </Button>
                <Button onClick={nextTeam} className="rounded-2xl bg-indigo-600 hover:bg-indigo-700">
                  Next team
                </Button>
              </div>

              {showHint && (
                <div className="rounded-2xl bg-amber-300/15 p-3 text-sm text-amber-100">
                  <strong>Clue:</strong> {team.hint}
                </div>
              )}

              {revealed && (
                <div className="rounded-2xl bg-emerald-400/15 p-3 text-sm text-emerald-100">
                  <strong>{team.stadium}</strong> — {team.city}
                </div>
              )}

              <div className="rounded-2xl bg-slate-900/60 p-3 text-xs leading-relaxed text-slate-400">
                Real club badges are trademarked, so this prototype uses original fake crests inspired by club colours. Swap in licensed badge image URLs later by replacing the <code>Badge</code> component.
              </div>
            </CardContent>
          </Card>
        </motion.aside>

        <main className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 shadow-2xl">
          <div className="h-[72vh] min-h-[520px] w-full">
            <MapContainer center={[25, 5]} zoom={2} minZoom={2} maxZoom={18} scrollWheelZoom className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ClickHandler onGuess={handleGuess} />

              {guesses.map((g, idx) => (
                <Marker key={g.id} position={[g.lat, g.lng]} icon={guessIcon}>
                  <Popup>
                    Guess {idx + 1}: {g.distanceKm.toFixed(1)} km away<br />Score: {g.score}
                  </Popup>
                </Marker>
              ))}

              {(revealed || (bestGuess && bestGuess.distanceKm < 5)) && (
                <Marker position={[team.lat, team.lng]} icon={targetIcon}>
                  <Popup>
                    {team.stadium}<br />{team.city}
                  </Popup>
                </Marker>
              )}

              {lastGuess && (
                <Polyline
                  positions={[
                    [lastGuess.lat, lastGuess.lng],
                    [team.lat, team.lng],
                  ]}
                  pathOptions={{ weight: 3, opacity: revealed ? 0.85 : 0.25, dashArray: revealed ? undefined : "8 10" }}
                />
              )}
            </MapContainer>
          </div>
        </main>
      </div>
    </div>
  );
}
