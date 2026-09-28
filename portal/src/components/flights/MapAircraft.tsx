import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Aircraft, groupOf } from '../../lib/flights';
import { aircraftSvg, shapeFor } from '../../lib/aircraftIcon';

// The plane marker, animated between the 15-second updates: it glides along
// its reported heading at its ground speed, and when a new position comes in
// it eases onto it over two seconds instead of jumping. If the plane is about
// to leave the screen the map pans with it when `follow` is set (unless you'd
// panned it out of view). Shared by the tracked-flight map and the area map.
const EASE_MS = 2000;
const MAX_EXTRAPOLATE_S = 60;

function project(lat: number, lon: number, trackDeg: number, gsKt: number, seconds: number): [number, number] {
  const nm = (gsKt * Math.min(seconds, MAX_EXTRAPOLATE_S)) / 3600;
  const t = (trackDeg * Math.PI) / 180;
  const dLat = (nm * Math.cos(t)) / 60;
  const dLon = (nm * Math.sin(t)) / (60 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  return [lat + dLat, lon + dLon];
}

export default function MovingPlane({ a, label, hover, follow, highlight, onClick }: {
  a: Aircraft;
  label: string;          // permanent label (tracked map) or hover tooltip HTML (area map)
  hover?: boolean;        // true: show `label` only on hover, as HTML
  follow?: boolean;       // pan the map to keep this plane on screen
  highlight?: boolean;    // draw in cyan (a flight you're tracking)
  onClick?: () => void;
}) {
  const map = useMap();
  const layer = useRef<L.Marker | null>(null);
  const setIconRef = useRef<() => void>(() => {});
  const shapeKey = useRef('');
  const fix = useRef<{ a: Aircraft; t: number } | null>(null);
  const shown = useRef<[number, number] | null>(null);
  const ease = useRef<{ from: [number, number]; t: number } | null>(null);
  const wasVisible = useRef(true);
  const lastPan = useRef(0);
  const followRef = useRef(!!follow);
  followRef.current = !!follow;
  const click = useRef(onClick);
  click.current = onClick;
  const hl = useRef(!!highlight);

  useEffect(() => {
    const icon = () => {
      const f = fix.current?.a || a;
      const { html, size } = aircraftSvg(shapeFor(f.type, f.category, groupOf(f) === 'heli', f.military), f.track, f.military, hl.current);
      return L.divIcon({ html, className: 'aircraft-icon', iconSize: [size, size], iconAnchor: [size / 2, size / 2], tooltipAnchor: [0, -size / 2] });
    };
    const m = L.marker([a.lat, a.lon], { icon: icon(), keyboard: false, interactive: !!hover || !!onClick, riseOnHover: true })
      .bindTooltip(label, hover ? { direction: 'top', className: 'aircraft-tip', opacity: 1 } : { permanent: true, direction: 'top' })
      .addTo(map);
    m.on('click', () => click.current?.());
    setIconRef.current = () => m.setIcon(icon());
    layer.current = m;
    shown.current = [a.lat, a.lon];
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 100) return; // ~10 fps is plenty for a plane
      last = now;
      const f = fix.current;
      if (!f) return;
      const cur = f.a;
      const moving = !cur.onGround && cur.gs !== null && cur.gs > 30 && cur.track !== null;
      let target: [number, number] = moving
        ? project(cur.lat, cur.lon, cur.track as number, cur.gs as number, (Date.now() - f.t) / 1000)
        : [cur.lat, cur.lon];
      const e = ease.current;
      if (e) {
        const k = Math.min(1, (Date.now() - e.t) / EASE_MS);
        const s = k * k * (3 - 2 * k); // smoothstep
        target = [e.from[0] + (target[0] - e.from[0]) * s, e.from[1] + (target[1] - e.from[1]) * s];
        if (k >= 1) ease.current = null;
      }
      shown.current = target;
      m.setLatLng(target);
      // Follow: only when the plane is flying off the edge, not when you've
      // deliberately looked elsewhere.
      const inner = map.getBounds().pad(-0.12);
      const visible = map.getBounds().contains(target);
      if (followRef.current && wasVisible.current && !inner.contains(target) && now - lastPan.current > 1500) {
        lastPan.current = now;
        map.panTo(target, { animate: true, duration: 1 });
      }
      wasVisible.current = visible;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); m.remove(); layer.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // A new position report: ease from wherever the marker is now.
  const key = `${a.lat},${a.lon},${a.track},${a.gs}`;
  useEffect(() => {
    if (shown.current && fix.current) ease.current = { from: shown.current, t: Date.now() };
    fix.current = { a, t: Date.now() };
    // Turn the icon to the new heading (the SVG eases the rotation over 1s);
    // rebuild it only if the aircraft type became known.
    const sk = `${a.type}|${a.category}|${a.military}`;
    const svg = layer.current?.getElement()?.querySelector('svg') as SVGElement | null;
    if (sk !== shapeKey.current || !svg) { shapeKey.current = sk; setIconRef.current(); }
    else svg.style.transform = `rotate(${a.track ?? 0}deg)`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { layer.current?.setTooltipContent(label); }, [label]);
  useEffect(() => {
    if (hl.current === !!highlight) return;
    hl.current = !!highlight;
    setIconRef.current();
  }, [highlight]);
  return null;
}

