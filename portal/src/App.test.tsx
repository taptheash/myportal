import React from 'react';
import { render, screen, act, renderHook } from '@testing-library/react';
// react-leaflet ships ESM only, which CRA's Jest can't load; the map isn't
// on screen in these tests anyway.
jest.mock('react-leaflet', () => ({ MapContainer: () => null, TileLayer: () => null }));

import App from './App';
import { useLocalStorage } from './hooks/useLocalStorage';
import { parseGCalTime, localDateKey, localPartsToIso } from './lib/calendarTime';
import { normalizeUrl } from './lib/url';

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as any;
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })) as any;
});

test('renders the portal shell on Home by default', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 2, name: 'Home' })).toBeInTheDocument();
});

test('recovers from a stale/unknown saved tab or section instead of crashing', () => {
  localStorage.setItem('pw6-active-section', JSON.stringify('tools'));
  localStorage.setItem('pw6-active-tool', JSON.stringify('no-such-widget'));
  render(<App />);
  expect(screen.getByRole('heading', { level: 2, name: 'Tools' })).toBeInTheDocument();
});

test('useLocalStorage functional updates see the latest value, even from an old setter', () => {
  const { result } = renderHook(() => useLocalStorage<number[]>('t', []));
  const oldSetter = result.current[1];
  act(() => result.current[1]((v) => [...v, 1]));
  act(() => oldSetter((v) => [...v, 2]));
  expect(result.current[0]).toEqual([1, 2]);
  expect(JSON.parse(localStorage.getItem('t')!)).toEqual([1, 2]);
});

test('all-day Google dates parse as local midnight, not UTC', () => {
  const d = parseGCalTime({ date: '2026-09-26' })!;
  expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 26, 0]);
  expect(localDateKey(new Date(2026, 8, 26, 23, 30))).toBe('2026-09-26');
});

test('event form times are sent as absolute instants in the browser zone', () => {
  const iso = localPartsToIso('2026-09-26', '14:00');
  expect(new Date(iso).getHours()).toBe(14);
  expect(iso.endsWith('Z')).toBe(true);
});

test('normalizeUrl only adds a scheme when one is missing', () => {
  expect(normalizeUrl('httpbin.org')).toBe('https://httpbin.org');
  expect(normalizeUrl(' HTTPS://Example.com ')).toBe('HTTPS://Example.com');
  expect(normalizeUrl('http://a.com')).toBe('http://a.com');
});

test('old daily caches and stale feed caches are cleaned up, user data never touched', () => {
  const { cleanUpOldCaches } = require('./lib/storageCleanup');
  const now = new Date(2026, 8, 27, 10);
  localStorage.setItem('on-this-day-09-27', '{}');
  localStorage.setItem('on-this-day-09-26', '{}');
  localStorage.setItem('national-day-01-01', '{}');
  localStorage.setItem('rss-business-12', '{}');
  localStorage.setItem('rss-headlines-NPR', JSON.stringify({ timestamp: now.getTime() - 3600000, data: [] }));
  localStorage.setItem('reddit-old', JSON.stringify({ timestamp: now.getTime() - 30 * 86400000, data: [] }));
  localStorage.setItem('pw6', '[]');
  localStorage.setItem('pw6-portal-key', 'x');
  expect(cleanUpOldCaches(now)).toBe(4);
  expect(Object.keys(localStorage).sort()).toEqual(['on-this-day-09-27', 'pw6', 'pw6-portal-key', 'rss-headlines-NPR']);
});

test('Home layout auto-switch: weekend, work hours, evenings, and a manual pick for today', () => {
  const { resolveActive, initialLayouts, localDay } = require('./lib/homeLayouts');
  const state = initialLayouts(['weather', 'news']);
  const sat = new Date(2026, 8, 26, 10);   // Saturday
  const monWork = new Date(2026, 8, 28, 9); // Monday 9 AM
  const monEve = new Date(2026, 8, 28, 19); // Monday 7 PM
  expect(resolveActive(state, null, sat)).toBe('weekend');
  expect(resolveActive(state, null, monWork)).toBe('work');
  expect(resolveActive(state, null, monEve)).toBe('home');
  // manual pick holds for that day only
  expect(resolveActive(state, { id: 'home', date: localDay(monWork) }, monWork)).toBe('home');
  expect(resolveActive(state, { id: 'home', date: '2026-09-27' }, monWork)).toBe('work');
  // auto off: the pick sticks
  expect(resolveActive({ ...state, auto: false }, { id: 'weekend', date: '2020-01-01' }, monWork)).toBe('weekend');
});

test('flight tracking: ticket flight numbers become ADS-B callsigns; tail numbers stay registrations', () => {
  const { parseFlightQuery, phaseOf, progressOf } = require('./lib/flightTrack');
  expect(parseFlightQuery('DL1234')).toEqual({ kind: 'callsign', value: 'DAL1234' });
  expect(parseFlightQuery('b6 512')).toEqual({ kind: 'callsign', value: 'JBU512' });
  expect(parseFlightQuery('AAL100')).toEqual({ kind: 'callsign', value: 'AAL100' });
  expect(parseFlightQuery('N123DL')).toEqual({ kind: 'reg', value: 'N123DL' });
  expect(parseFlightQuery('C-FABC')).toEqual({ kind: 'reg', value: 'C-FABC' });
  expect(parseFlightQuery('!!')).toBeNull();
  expect(phaseOf(null)).toBe('not-airborne');
  expect(phaseOf({ onGround: false, alt: 30000, vs: -1500, gs: 420 })).toBe('descending');
  const p = progressOf(
    { lat: 38, lon: -80, gs: 450, alt: 35000, vs: 0, onGround: false },
    { found: true, origin: { lat: 42.36, lon: -71.01 }, destination: { lat: 33.64, lon: -84.43 } }
  );
  expect(p.pct).toBeGreaterThan(30);
  expect(p.pct).toBeLessThan(70);
  expect(p.eta).not.toBeNull();
});

test('area views skip aircraft on the ground unless you follow them', () => {
  const { inArea } = require('./lib/flights');
  const { isFollowed } = require('./lib/flightTrack');
  const area = { id: 'h', name: 'Home', lat: 43.3, lon: -71.6, radiusMi: 20, minFt: 0, maxFt: 60000 };
  const base = { reg: null, type: null, vs: 0, track: 0, squawk: null, military: false, lat: 43.31, lon: -71.61 };
  const list = [
    { ...base, hex: '1', callsign: 'DAL1', alt: 30000, gs: 450, onGround: false },
    { ...base, hex: '2', callsign: 'JBU9', alt: 0, gs: 5, onGround: true },
    { ...base, hex: '3', callsign: 'N1AB', alt: 50, gs: 10, onGround: false },
  ];
  expect(inArea(list, area).map((a: any) => a.hex)).toEqual(['1']);
  const tracked = [{ id: 't', query: 'B6 9', kind: 'callsign', value: 'JBU9', alerts: false, addedAt: 0 }];
  expect(inArea(list, area, (a: any) => isFollowed(a, tracked)).map((a: any) => a.hex).sort()).toEqual(['1', '2']);
});

test('flight alerts fire on descent, landing and arriving overhead — not on the first reading', () => {
  const { alertFor } = require('./lib/flightTrack');
  const home = { id: 'h', name: 'Home', lat: 43.3, lon: -71.6, radiusMi: 15, minFt: 0, maxFt: 60000 };
  const at = (lat: number, alt: number, vs: number, onGround = false) => ({ lat, lon: -71.6, alt, vs, gs: onGround ? 10 : 400, onGround });
  expect(alertFor('DL1', undefined, at(40, 35000, 0), home)).toBeNull();
  expect(alertFor('DL1', at(40, 35000, 0), at(40.5, 33000, -1500), home)).toMatch(/descent/);
  expect(alertFor('DL1', at(40, 3000, -800), at(40, 0, 0, true), home)).toMatch(/landed/);
  expect(alertFor('DL1', at(44, 20000, 0), at(43.31, 20000, 0), home)).toMatch(/over Home/);
  expect(alertFor('DL1', null, at(40, 12000, 2000), home)).toMatch(/airborne/);
});

test('aircraft groups and the per-area type filter (followed flights always show)', () => {
  const { inArea, groupOf, logoCode } = require('./lib/flights');
  const base = { reg: null, type: null, vs: 0, track: 0, squawk: null, military: false, lat: 43.31, lon: -71.61, alt: 20000, gs: 300, onGround: false, category: null };
  const dal = { ...base, hex: 'a', callsign: 'DAL12' };
  const fdx = { ...base, hex: 'b', callsign: 'FDX901' };
  const eja = { ...base, hex: 'c', callsign: 'EJA455' };
  const cessna = { ...base, hex: 'd', callsign: 'N172SP' };
  const mil = { ...base, hex: 'e', callsign: 'RCH123', military: true };
  const heli = { ...base, hex: 'f', callsign: 'LN12', category: 'A7' };
  expect([dal, fdx, eja, cessna, mil, heli].map(groupOf)).toEqual(['airline', 'cargo', 'ga', 'ga', 'military', 'heli']);
  expect(logoCode(dal)).toBe('DAL');
  expect(logoCode(eja)).toBeNull();
  const area = { id: 'h', name: 'Home', lat: 43.3, lon: -71.6, radiusMi: 20, minFt: 0, maxFt: 60000, types: ['airline', 'cargo'] };
  const list = [dal, fdx, eja, cessna, mil, heli];
  expect(inArea(list, area).map((a: any) => a.hex).sort()).toEqual(['a', 'b']);
  expect(inArea(list, { ...area, types: undefined }).length).toBe(6);
  expect(inArea(list, area, (a: any) => a.hex === 'e').map((a: any) => a.hex).sort()).toEqual(['a', 'b', 'e']);
});
