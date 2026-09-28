// Shared helpers for the ADS-B proxy functions. Files starting with "_" in
// api/ are not deployed as their own endpoints by Vercel.

function num(v) {
  return typeof v === 'number' && isFinite(v) ? v : null;
}

function normalize(a) {
  const alt = a.alt_baro === 'ground' ? 0 : num(a.alt_baro) ?? num(a.alt_geom);
  return {
    hex: String(a.hex || '').toLowerCase(),
    callsign: String(a.flight || '').trim() || null,
    reg: a.r || null,
    type: a.t || null,
    alt,                                   // feet (barometric); 0 = on the ground
    onGround: a.alt_baro === 'ground',
    gs: num(a.gs),                         // knots
    track: num(a.track) ?? num(a.true_heading) ?? num(a.mag_heading), // degrees
    vs: num(a.baro_rate) ?? num(a.geom_rate), // ft/min
    lat: num(a.lat),
    lon: num(a.lon),
    squawk: a.squawk || null,
    category: a.category || null,
    military: typeof a.dbFlags === 'number' ? (a.dbFlags & 1) === 1 : false,
    seen: num(a.seen_pos) ?? num(a.seen),
  };
}

module.exports = { num, normalize };
