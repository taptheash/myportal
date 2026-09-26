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
