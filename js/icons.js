"use strict";
/* ============================================================
   Inline SVG icon set (square caps / miter joins for the
   sharp look). Usage: icon("trash") -> svg markup string.
   AVATAR_ICONS lists the ones offered as bot avatars.
   ============================================================ */

const ICONS = {
  /* UI icons */
  logo: '<path d="M12 2 20.5 7v10L12 22 3.5 17V7Z"/><circle cx="8.7" cy="11.5" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.3" cy="11.5" r="1.15" fill="currentColor" stroke="none"/><path d="M8.7 15.2h6.6"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  sun: '<rect x="8" y="8" width="8" height="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M4.5 19.5l2-2M17.5 6.5l2-2"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
  edit: '<path d="M17 3l4 4L7 21H3v-4L17 3Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/><path d="M10 11v5M14 11v5"/>',
  copy: '<rect x="9" y="9" width="12" height="12"/><path d="M15 5V3H3v12h2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  upload: '<path d="M12 15V4M6 9l6-6 6 6"/><path d="M4 20h16"/>',
  download: '<path d="M12 4v11M6 10l6 6 6-6"/><path d="M4 20h16"/>',
  "chevron-down": '<path d="M6 9l6 6 6-6"/>',
  share: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v6H4V6h6"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
  alert: '<path d="M12 3 1 21h22L12 3Z"/><path d="M12 10v4M12 17.2v.8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>',
  image: '<rect x="3" y="3" width="18" height="18"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/>',

  /* avatar icons */
  bot: '<rect x="4" y="7" width="16" height="13"/><path d="M12 7V3M8 3h8"/><path d="M9 12v1M15 12v1"/><path d="M9 16.5h6"/>',
  skull: '<path d="M12 2a8 8 0 0 0-8 8v6h3v4h10v-4h3v-6a8 8 0 0 0-8-8Z"/><circle cx="9" cy="11" r="1"/><circle cx="15" cy="11" r="1"/><path d="M12 14v2"/>',
  ghost: '<path d="M5 21V10a7 7 0 0 1 14 0v11l-2.3-2-2.4 2-2.3-2-2.3 2-2.4-2L5 21Z"/><path d="M9 9.5v1.5M15 9.5v1.5"/>',
  crown: '<path d="M4 18 3 8l5 4 4-7 4 7 5-4-1 10H4Z"/><path d="M4 21h16"/>',
  sword: '<path d="M20 4 8.5 15.5"/><path d="M20 4h-4.5M20 4v4.5"/><path d="M5.5 13.5l5 5"/><path d="M4 20l3.5-3.5"/>',
  shield: '<path d="M12 2 4 5v7c0 5 3.5 8 8 10 4.5-2 8-5 8-10V5l-8-3Z"/>',
  rocket: '<path d="M12 2 19 21l-7-4-7 4L12 2Z"/>',
  star: '<path d="m12 2 3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9l3-7Z"/>',
  flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-7 .5 2 1.5 3 3 4-1-3-1-6 0-9Z"/>',
  snowflake: '<path d="M12 2v20M4 6l16 12M20 6 4 18"/>',
  gamepad: '<rect x="2" y="8" width="20" height="9"/><path d="M7 10.5v4M5 12.5h4"/><path d="M15.5 11v1M18.5 13.5v1"/>',
  music: '<path d="M9 18V5l10-2v13"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
  cpu: '<rect x="6" y="6" width="12" height="12"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9l4-6Z"/><path d="M2 9h20"/><path d="m12 21-4-12 4-6 4 6-4 12"/>',
  cat: '<path d="M4 4l4 3h8l4-3v9a8 7.5 0 0 1-16 0V4Z"/><path d="M9 11.5v1M15 11.5v1"/><path d="M10 16.5h4"/>',
  wizard: '<path d="M4 19h16"/><path d="M6 19 12 3l6 16"/><path d="M8.7 13h6.6"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/>',
  zap: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>',
  heart: '<path d="M12 21C6 16 2 12.5 2 8.5 2 6 4 4 6.5 4c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C20 4 22 6 22 8.5c0 4-4 7.5-10 12.5Z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/>',
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14"/><path d="M5 13H3a9 9 0 0 0 18 0h-2"/>',
  book: '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
  flask: '<path d="M10 2v6L4 20a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 8V2"/><path d="M8 2h8M7 16h10"/>',
  dice: '<rect x="3" y="3" width="18" height="18"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="8.5" cy="15.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/>',
  pickaxe: '<path d="M3 21 15 9"/><path d="M9 3c5 1 9 4 12 9"/><path d="M13 7l4 4"/>',
  alien: '<path d="M12 2C7 2 4 6 4 10c0 5 4 9 8 12 4-3 8-7 8-12 0-4-3-8-8-8Z"/><path d="M8 10c1.5 0 2.5 1 2.5 2.5M16 10c-1.5 0-2.5 1-2.5 2.5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  code: '<path d="M9 8 4 12l5 4"/><path d="M15 8l5 4-5 4"/>',
  /* vampire: cloaked collar + two fangs */
  vampire: '<path d="M12 3 5 8v6a7 7 0 0 0 14 0V8Z"/><path d="M9.5 14v3l1.2-1.8Z" fill="currentColor" stroke="none"/><path d="M14.5 14v3l-1.2-1.8Z" fill="currentColor" stroke="none"/><circle cx="9" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10.5" r="1" fill="currentColor" stroke="none"/>',
  /* robot-butler: rounded head, bowtie, antenna */
  butler: '<rect x="5" y="7" width="14" height="12" rx="1"/><path d="M12 7V4M9.5 4h5"/><path d="M9 13v1M15 13v1"/><path d="M10.5 18 12 16.5 13.5 18Z" fill="currentColor" stroke="none"/>',
  /* plant/gardener: sprouting leaves from soil line */
  sprout: '<path d="M12 21v-8"/><path d="M12 13c0-4-3-6-7-6 0 4 3 6 7 6Z"/><path d="M12 11c0-3.5 2.5-5.5 6-5.5 0 3.5-2.5 5.5-6 5.5Z"/><path d="M5 21h14"/>',
  /* conspiracy: eye inside a triangle */
  eyetri: '<path d="M12 3 2 20h20Z"/><circle cx="12" cy="15" r="2.6"/><circle cx="12" cy="15" r="0.6" fill="currentColor" stroke="none"/>',
  /* barista: coffee cup with steam curls */
  brew: '<path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z"/><path d="M16 11h1.5a2 2 0 0 1 0 4H16"/><path d="M9 3c0 1-1 1-1 2s1 1 1 2M13 3c0 1-1 1-1 2s1 1 1 2"/>'
};

const AVATAR_ICONS = ["bot","skull","ghost","crown","sword","shield","rocket","star","flame","snowflake","gamepad","music","cpu","gem","cat","wizard","eye","zap","heart","globe","anchor","book","flask","dice","pickaxe","alien","target","code","vampire","butler","sprout","eyetri","brew"];

/* solid-shape path data for the small everyday UI icons (favorite,
   add, remove, confirm, delete) — these are simple enough to read
   well as filled glyphs, unlike outline icons such as home/settings. */
const ICONS_FILLED = {
  star: '<path d="m12 2 3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9l3-7Z"/>',
  heart: '<path d="M12 21C6 16 2 12.5 2 8.5 2 6 4 4 6.5 4c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C20 4 22 6 22 8.5c0 4-4 7.5-10 12.5Z"/>',
  plus: '<path d="M11 3h2v8h8v2h-8v8h-2v-8H3v-2h8Z"/>',
  x: '<path d="M6.7 4.6 12 9.9l5.3-5.3 1.4 1.4L13.4 11.3l5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3Z"/>',
  check: '<path d="M8.6 18.4 3 12.8l2.3-2.3 3.3 3.3L18.7 3.7 21 6Z"/>',
  trash: '<path d="M8 4V2h8v2h5v2h-1.1l-1 15a1 1 0 0 1-1 .9H6.1a1 1 0 0 1-1-.9L4.1 6H3V4Zm2 4v11h1.5V8Zm3 0v11h1.5V8Zm3.5 0v11H18V8Z"/>'
};

/* common everyday words that don't exist verbatim in Lucide's naming ->
   the closest real icon name in the vendored catalogue. Covers the gap
   between how a bot would naturally phrase a concept and how Lucide
   actually names it, without relying on the bot guessing correctly. */
const ICON_ALIASES = {
  gear: "settings", fire: "flame", water: "droplet", ocean: "waves",
  wave: "waves", tree: "tree-deciduous", palm: "palmtree", swim: "waves",
  sad: "frown", think: "brain", thinking: "brain",
  person: "user", people: "users", group: "users",
  bullseye: "target", idea: "lightbulb", question: "circle-help",
  exclamation: "alert-triangle", help: "circle-help",
  lock: "lock-keyhole", trophy: "trophy", medal: "medal", award: "award",
  money: "banknote", cash: "banknote", piggybank: "piggy-bank",
  backpack: "backpack", school: "school", graduation: "graduation-cap",
  calculator: "calculator", ruler: "ruler", link: "link", share: "share-2",
  bookmark: "bookmark", map: "map", compass: "compass",
  umbrella: "umbrella", thermometer: "thermometer", brain: "brain",
  tooth: "bluetooth", pill: "pill", stethoscope: "stethoscope",
  syringe: "syringe", bone: "bone",

  /* emotions / reactions a bot writes very often */
  happy: "smile", laughing: "laugh", laugh: "laugh", celebrate: "party-popper",
  party: "party-popper", excited: "party-popper", angry: "angry", mad: "angry",
  cry: "frown", crying: "frown", confused: "help-circle", love: "heart",
  cool: "glasses", shy: "smile",
  sleepy: "moon", tired: "moon", scared: "ghost", nervous: "alert-circle",

  /* everyday objects/concepts */
  win: "trophy", winner: "trophy", success: "check-circle", fail: "x-circle",
  error: "x-circle", warning: "triangle-alert", danger: "triangle-alert",
  time: "clock", clock: "clock", calendar: "calendar", date: "calendar",
  food: "utensils", eat: "utensils", drink: "cup-soda", coffee: "coffee",
  tea: "cup-soda", pizza: "pizza", cake: "cake", gift: "gift",
  present: "gift", present2: "gift", weather: "cloud-sun", rain: "cloud-rain",
  snow: "snowflake", sun: "sun", moon: "moon", star: "star", stars: "sparkles",
  sparkle: "sparkles", sparkles: "sparkles", magic: "wand-2", wand: "wand-2",
  book: "book", read: "book-open", write: "pen-line", pen: "pen-line",
  phone: "phone", call: "phone", email: "mail", mail: "mail",
  message: "message-circle", chat: "message-circle", speak: "message-circle",
  talk: "message-circle", camera: "camera", photo: "image", picture: "image",
  video: "video", movie: "clapperboard", tv: "tv", computer: "monitor",
  laptop: "laptop", keyboard: "keyboard", mouse: "mouse", game: "gamepad-2",
  play: "play", pause: "pause", stop: "square", music2: "music",
  song: "music", headphones: "headphones", car: "car", drive: "car",
  plane: "plane", flight: "plane", travel: "map", train: "train-front",
  bike: "bike", walk: "footprints", run: "footprints", house: "home",
  building: "building-2", city: "building-2", plant: "sprout", flower: "flower-2",
  animal: "paw-print", pet: "paw-print", dog: "dog", cat2: "cat",
  bird: "bird", fish: "fish", bug: "bug", spider: "bug",
  strong: "dumbbell", exercise: "dumbbell", gym: "dumbbell", sport: "trophy",
  ball: "circle", science: "flask-conical", experiment: "flask-conical",
  space: "rocket", planet: "globe", world: "globe", earth: "globe",
  key: "key", door: "door-open", box: "package", package: "package",
  shopping: "shopping-cart", cart: "shopping-cart", buy: "shopping-cart",
  wallet: "wallet", card: "credit-card", bank: "landmark",
  work: "briefcase", job: "briefcase", office: "briefcase",
  paint: "palette", art: "palette", draw: "pen-line", design: "palette",
  puzzle: "puzzle", chess: "gamepad-2", cards: "spade",
  battery: "battery", power: "zap", plug: "plug", wifi: "wifi",
  bluetooth2: "bluetooth", download2: "download", upload2: "upload",
  save: "save", folder: "folder", file: "file", document: "file-text",
  print: "printer", scan: "scan", filter: "filter", sort: "arrow-up-down"
};

/* fuzzy fallback: a bot will write plausible natural-language names
   ("laughing", "celebrate", "money-bag") that don't exist verbatim in
   Lucide's kebab-case vocabulary. Rather than only catching the ~30
   words in ICON_ALIASES, score every vendored icon name by word-token
   overlap + substring containment against the requested name and take
   the best match above a threshold. All local, no network — just a
   smarter search over the catalogue we already ship. */
/* crude singular form: strips a trailing "es"/"s" plural so
   "trophies"/"trophy", "boxes"/"box", "cats"/"cat" line up. Not
   linguistically perfect, just enough to bridge common bot phrasing. */
function singularize(word) {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 3 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

let _lucideNameCache = null;
function fuzzyMatchIconName(name) {
  if (typeof LUCIDE_ICONS === "undefined") return null;
  if (!_lucideNameCache) _lucideNameCache = Object.keys(LUCIDE_ICONS);

  const reqTokens = name.split("-").filter(Boolean).map(singularize);
  let best = null, bestScore = 0;

  for (const cand of _lucideNameCache) {
    if (cand === name) return cand;
    const candTokens = cand.split("-").filter(Boolean).map(singularize);
    let score = 0;

    /* whole-word overlap (after singularizing): the primary signal —
       real matches share an actual word, not a coincidental fragment
       ("celebration" contains the substring "ratio" but shares no
       word with it). A single shared token only counts if it's a
       substantial word (>=5 chars) — short generic tokens like "bag"/
       "high"/"phone" appear across many unrelated compounds and cause
       wrong matches ("money-bag" -> "paper-bag" on a shared "bag"). */
    const sharedTokens = reqTokens.filter(t => candTokens.includes(t));
    if (sharedTokens.length >= 2) {
      score += sharedTokens.length * 4;
    } else if (sharedTokens.length === 1 && sharedTokens[0].length >= 5) {
      score += 4;
    }

    /* single-token request as a whole-word prefix/suffix of a single-
       token candidate, or vice versa — catches real compounds like
       "airplane"/"plane" or "wristwatch"/"watch" without matching
       arbitrary short substrings buried mid-word */
    if (reqTokens.length === 1 && candTokens.length === 1) {
      const r = reqTokens[0], c = candTokens[0];
      /* require the shorter side to be a substantial word on its own
         (>=5 chars) — short generic suffixes like "bag"/"mic"/"high"
         appear in dozens of unrelated compounds and produce wrong
         matches (e.g. "money-bag" landing on "paper-bag") */
      const longEnough = Math.min(r.length, c.length) >= 5;
      const compound = longEnough && (r.startsWith(c) || r.endsWith(c) || c.startsWith(r) || c.endsWith(r));
      if (compound) score += 4;
    }

    if (score > bestScore) { bestScore = score; best = cand; }
  }

  return bestScore >= 4 ? best : null;
}

/* has this name been custom hand-drawn (ICONS), an alias of a real
   Lucide name, a direct hit in the vendored ~2000-icon catalogue
   (LUCIDE_ICONS, js/vendor/lucide-icons.js), or close enough to one
   via fuzzy matching? */
function resolveIconName(name) {
  if (ICONS[name]) return name;
  if (typeof LUCIDE_ICONS !== "undefined") {
    if (LUCIDE_ICONS[name]) return name;
    if (ICON_ALIASES[name] && LUCIDE_ICONS[ICON_ALIASES[name]]) return ICON_ALIASES[name];
    const fuzzy = fuzzyMatchIconName(name);
    if (fuzzy) return fuzzy;
  }
  return null;
}

function hasIcon(name) {
  return resolveIconName(name) !== null;
}

function icon(name, cls, filled) {
  if (filled && ICONS_FILLED[name]) {
    return '<svg class="ic' + (cls ? " " + cls : "") +
      '" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">' +
      ICONS_FILLED[name] + "</svg>";
  }
  const resolved = resolveIconName(name) || "bot";
  const markup = ICONS[resolved] ||
    (typeof LUCIDE_ICONS !== "undefined" && LUCIDE_ICONS[resolved]) || ICONS.bot;
  return '<svg class="ic' + (cls ? " " + cls : "") +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">' +
    markup + "</svg>";
}

/* button whose content is an icon (optionally with a text label) */
function iconBtn(name, cls, title, label, filled) {
  const b = document.createElement("button");
  b.type = "button";
  if (cls) b.className = cls;
  if (title) b.title = title;
  b.innerHTML = icon(name, null, filled) + (label ? "<span>" + label + "</span>" : "");
  return b;
}
