import { useEffect } from 'react';
import { Polyline, useMap } from 'react-leaflet';

// Shared bits for the Flights maps (the tracked-flight map and the area map).

// Zoom only with the + and - buttons. Spread these props onto <MapContainer>
// to turn off the map's own scroll-wheel, double-click, drag-box and keyboard
// zoom, and render <ZoomButtonsOnly /> inside it.
export const zoomLockProps = {
  scrollWheelZoom: false,
  doubleClickZoom: false,
  boxZoom: false,
  keyboard: false,
};

// A trackpad pinch reaches the browser as a ctrl+wheel (Safari sends gesture
// events instead). With the map's own zoom off, that would zoom the whole page
// when the pointer is over the map, so it is swallowed here.
export function ZoomButtonsOnly() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const stopPinch = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    const stopGesture = (e: Event) => e.preventDefault();
    el.addEventListener('wheel', stopPinch, { passive: false });
    el.addEventListener('gesturestart', stopGesture);
    el.addEventListener('gesturechange', stopGesture);
    return () => {
      el.removeEventListener('wheel', stopPinch);
      el.removeEventListener('gesturestart', stopGesture);
      el.removeEventListener('gesturechange', stopGesture);
    };
  }, [map]);
  return null;
}

// The line a flight has flown. A dark blue with a white edge on the light map
// so it stands out from roads and terrain; the dark map keeps a bright cyan,
// since a dark line would disappear there.
export const TRACK_COLOR_LIGHT = '#1d4ed8';
export const TRACK_COLOR_DARK = '#22d3ee';

export function TrackLine({ positions, dark, weight = 4 }: { positions: Array<[number, number]>; dark: boolean; weight?: number }) {
  if (positions.length < 2) return null;
  return (
    <>
      <Polyline positions={positions}
        pathOptions={{ color: dark ? '#0f172a' : '#ffffff', weight: weight + 3, opacity: dark ? 0.55 : 0.95, interactive: false }} />
      <Polyline positions={positions}
        pathOptions={{ color: dark ? TRACK_COLOR_DARK : TRACK_COLOR_LIGHT, weight, opacity: 1, interactive: false }} />
    </>
  );
}
