// Top-down aircraft silhouettes for the map, picked from the ICAO type code
// (falling back to the ADS-B size category), drawn nose-up and rotated to
// the aircraft's heading. Sizes are relative so a 777 looks bigger than a
// Cessna.

export type Shape = 'quad' | 'wide' | 'narrow' | 'regional' | 'bizjet' | 'turboprop' | 'light' | 'heli' | 'fighter';

// Paths are in a 64×64 box centred on 0,0, nose pointing up (negative y).
const m = (d: string) => d; // left-side path; mirrored below
const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${-Number(x)},${y}`);
const both = (d: string) => `${d} ${mirror(d)}`;

const JET_FUSE = (w: number, top: number, bot: number) =>
  `M0,${top} C${w * 0.8},${top} ${w},${top + 4} ${w},${top + 9} L${w},${bot - 7} L${w * 0.45},${bot} L${-w * 0.45},${bot} L${-w},${bot - 7} L${-w},${top + 9} C${-w},${top + 4} ${-w * 0.8},${top} 0,${top}Z`;

const SHAPES: Record<Shape, { d: string; size: number }> = {
  quad: {
    size: 56,
    d: [JET_FUSE(4, -31, 30),
      both(m('M4,-8 L31,9 L31,12 L4,4Z')),
      both(m('M11,-3 L14,-3 L14,6 L11,6Z')), both(m('M20,2 L23,2 L23,10 L20,10Z')),
      both(m('M3,20 L13,27 L13,29.5 L2.5,26Z'))].join(' '),
  },
  wide: {
    size: 52,
    d: [JET_FUSE(4, -31, 30),
      both(m('M4,-8 L31,9 L31,12 L4,4Z')),
      both(m('M11,-5 L15,-5 L15,6 L11,6Z')),
      both(m('M3,20 L13,27 L13,29.5 L2.5,26Z'))].join(' '),
  },
  narrow: {
    size: 44,
    d: [JET_FUSE(3, -30, 29),
      both(m('M3,-6 L29,7 L29,10 L3,4Z')),
      both(m('M9.5,-3 L13,-3 L13,5 L9.5,5Z')),
      both(m('M2,20 L11,26 L11,28.5 L1.5,25Z'))].join(' '),
  },
  regional: {
    size: 38,
    d: [JET_FUSE(2.8, -30, 28),
      both(m('M2.8,-3 L25,6 L25,9 L2.8,6Z')),
      both(m('M3.5,11 L7,11 L7,19 L3.5,19Z')),
      both(m('M1.5,22 L11,26 L11,28.5 L1.5,27Z'))].join(' '),
  },
  bizjet: {
    size: 34,
    d: [JET_FUSE(2.6, -29, 27),
      both(m('M2.6,-2 L23,7 L24,10 L2.6,7Z')),
      both(m('M3.2,11 L6.8,11 L6.8,19 L3.2,19Z')),
      both(m('M1.5,21 L11,25 L11,27.5 L1.5,26.5Z'))].join(' '),
  },
  turboprop: {
    size: 38,
    d: [JET_FUSE(3, -29, 28),
      both(m('M3,-5 L30,-3.5 L30,1.5 L3,1.5Z')),
      both(m('M9.5,-12 L13.5,-12 L13.5,3 L9.5,3Z')),
      both(m('M6,-14 L17,-14 L17,-12.8 L6,-12.8Z')),
      both(m('M2,20 L12,21 L12,25 L2,25Z'))].join(' '),
  },
  light: {
    size: 32,
    d: ['M0,-24 C2,-24 3,-20 3,-14 L1.5,22 L-1.5,22 L-3,-14 C-3,-20 -2,-24 0,-24Z',
      both(m('M2.5,-12 L30,-12 L30,-6 L2.5,-6Z')),
      both(m('M1,16 L11,16 L11,20.5 L1,20.5Z')),
      'M-8,-27 L8,-27 L8,-25.6 L-8,-25.6Z'].join(' '),
  },
  heli: {
    size: 36,
    d: ['M0,-16 C6,-16 7,-10 7,-5 C7,2 4,6 0,6 C-4,6 -7,2 -7,-5 C-7,-10 -6,-16 0,-16Z',
      'M-1.2,5 L1.2,5 L1,26 L-1,26Z',
      'M-6,24 L6,24 L6,26 L-6,26Z',
      'M-17.15,-23.85 L18.85,12.15 L17.15,13.85 L-18.85,-22.15Z',
      'M17.15,-23.85 L-18.85,12.15 L-17.15,13.85 L18.85,-22.15Z'].join(' '),
  },
  fighter: {
    size: 36,
    d: ['M0,-31 C1.5,-28 2.5,-22 3,-14 L4,-4 L21,10 L21,14 L4,12 L3.5,20 L11,27 L11,30 L2,28 L-2,28 L-11,30 L-11,27 L-3.5,20 L-4,12 L-21,14 L-21,10 L-4,-4 L-3,-14 C-2.5,-22 -1.5,-28 0,-31Z'].join(' '),
  },
};

const RULES: Array<[RegExp, Shape]> = [
  [/^(B74|A38|A34|B52|C5M?$|C17$|E3TF|E3CF|E6$|K35|KC35|R135|IL76|A124|AN12)/, 'quad'],
  [/^(B76|B77|B78|A30|A310|A33|A35|MD11|DC10|L101|KC10|KC46|A400|B703)/, 'wide'],
  [/^(A31|A32|A2[01]N|B73|B3[789]M|B75|B71|MD8|MD9|DC9|BCS|E17|E75|E19|E29|E28|A22|C919|B72)/, 'narrow'],
  [/^(CRJ|E13|E14|E45|F70|F100|RJ|B46|DC93)/, 'regional'],
  [/^(F1[5-8]|F2[2-9]|F35|FA18|F18|A10|T38|T6|EUFI|TOR|RFAL|M2K|HAWK|L39|A4|AV8|F4|F5)/, 'fighter'],
  [/^(GLF|E35L|GL5|GL6|GL7|GLEX|G280|GALX|CL3|CL6|CL30|CL35|CL60|C25|C50|C51|C52|C55|C56|C65|C68|C75|C700|LJ|E50P|E55P|E545|E550|F2TH|F900|FA|H25|PRM|HDJT|PC24|SF50|BE40|ASTR|WW24)/, 'bizjet'],
  [/^(DH8|AT4|AT7|SF34|B190|BE20|BE30|BE35|BE9|C130|C30J|P3|E120|JS41|D328|SW4|DHC6|C2|E2|PC6|L410|AN2)/, 'turboprop'],
  [/^(C1[0-9]|C2[0-9]|P28|PA|SR2|BE3|BE2|BE1|M20|DA4|DA2|C18|C20|C21|C8|RV|PC12|TBM|C208|KODI|GA8|AA5|AC11|CH|TAMP|J3|CUB|DR40|G115|T206|P210|B36T)/, 'light'],
];

export function shapeFor(type: string | null, category: string | null | undefined, heli: boolean, military: boolean): Shape {
  if (heli || category === 'A7') return 'heli';
  const t = (type || '').toUpperCase();
  if (t) for (const [re, s] of RULES) if (re.test(t)) return s;
  switch (category) {
    case 'A1': return 'light';
    case 'A2': return 'bizjet';
    case 'A3': return 'narrow';
    case 'A4': return 'narrow';
    case 'A5': return 'wide';
    case 'A6': return military ? 'fighter' : 'bizjet';
    default: return 'narrow';
  }
}

// An SVG string for a Leaflet divIcon. `scale` enlarges it on close zooms.
export function aircraftSvg(shape: Shape, heading: number | null, military: boolean, highlight = false): { html: string; size: number } {
  const { d, size } = SHAPES[shape];
  const fill = highlight ? '#22d3ee' : military ? '#ff3b30' : '#ffb000';
  const html =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-32 -32 64 64" ` +
    `style="transform:rotate(${heading ?? 0}deg);transition:transform 1s linear;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.55))">` +
    `<path d="${d}" fill="${fill}" stroke="${highlight ? '#083344' : '#3f2a00'}" stroke-width="1.6" stroke-linejoin="round" fill-rule="nonzero"/></svg>`;
  return { html, size };
}
