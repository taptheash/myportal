// Minimal RSS 2.0 / Atom / RSS 1.0 (RDF) reader for /api/rss. Files starting
// with "_" in api/ are not deployed as their own endpoints by Vercel.
//
// Only pulls out what the widgets actually use: title, link and date. It's
// deliberately forgiving (regex over the XML, not a strict parser), because
// real-world feeds are often slightly malformed and a strict parser would
// reject the whole feed over one bad entity.

function unwrap(s) {
  if (s == null) return '';
  let out = String(s).trim();
  // <![CDATA[ ... ]]> may appear once or several times
  out = out.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return out.trim();
}

// Text of the first <tag ...>...</tag> inside block (namespaced or not).
function tagText(block, names) {
  for (const name of names) {
    const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i');
    const m = block.match(re);
    if (m) return unwrap(m[1]);
  }
  return '';
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3] ?? '') : '';
}

// Atom: prefer <link rel="alternate" href>, else the first <link href>.
// RSS: <link>url</link>.
function linkOf(block) {
  const linkTags = block.match(/<link\b[^>]*\/?>/gi) || [];
  let fallback = '';
  for (const t of linkTags) {
    const href = attr(t, 'href');
    if (!href) continue;
    const rel = attr(t, 'rel');
    if (!rel || rel === 'alternate') return decodeBasic(href);
    if (!fallback) fallback = href;
  }
  const text = tagText(block, ['link']);
  if (text && /^https?:\/\//i.test(text)) return decodeBasic(text);
  if (fallback) return decodeBasic(fallback);
  const guid = tagText(block, ['guid', 'id']);
  return /^https?:\/\//i.test(guid) ? decodeBasic(guid) : '';
}

// Only the entities that appear inside URLs; titles are decoded client-side.
function decodeBasic(s) {
  return s.replace(/&amp;/g, '&').replace(/&#38;/g, '&').trim();
}

// rss2json's format, which the widgets parse: "YYYY-MM-DD HH:MM:SS" in UTC.
function formatDate(raw) {
  const d = new Date(raw);
  if (!raw || isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function parseFeed(xml) {
  const text = String(xml || '');
  if (!/<(rss|feed|rdf:RDF)\b/i.test(text)) return null; // not a feed (HTML block page, etc.)

  const blocks = text.match(/<item\b[\s\S]*?<\/item>/gi) || text.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const head = text.split(/<(item|entry)\b/i)[0];
  const feedTitle = tagText(head, ['title']);

  const items = blocks.map((b) => {
    const title = tagText(b, ['title']);
    const link = linkOf(b);
    const date = tagText(b, ['pubDate', 'published', 'updated', 'dc:date', 'date']);
    return { title, link, pubDate: formatDate(date), guid: tagText(b, ['guid', 'id']) || link };
  }).filter((it) => it.title || it.link);

  return { title: feedTitle, items };
}

module.exports = { parseFeed, formatDate };
