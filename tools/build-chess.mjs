/**
 * Generates assets/chess.svg — a neon, self-contained, looping chess animation.
 *
 * The game is encoded as a plain move list, simulated here, then baked into
 * pre-computed CSS keyframes. No JS runs in the browser: GitHub renders the
 * file through an <img>, which still executes CSS keyframes inside the SVG.
 *
 *   node tools/build-chess.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../assets/chess.svg");

/* ------------------------------------------------------------------ config */

const PLY = 0.55; // seconds per half-move
const PRE = 1.1; // lead-in on the starting position
const SQUARE = 48;
const BOARD_X = 26;
const BOARD_Y = 46;
const PANEL_W = BOARD_X * 2 + SQUARE * 8;
const PANEL_H = 512;
const BOARD_CX = BOARD_X + SQUARE * 4;
const BOARD_CY = BOARD_Y + SQUARE * 4;
const ORIGIN = [PANEL_W / 2, PANEL_H / 2];

const NEON_W = "#5EE7F9"; // white side
const NEON_B = "#F472B6"; // black side
const WORD = "Sarhan";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

/** [from, to, SAN, extraFromSquare?] */
const GAME = [
  ["e2", "e4", "1. e4"],
  ["e7", "e5", "e5"],
  ["g1", "f3", "2. Nf3"],
  ["d7", "d6", "d6"],
  ["d2", "d4", "3. d4"],
  ["c8", "g4", "Bg4"],
  ["d4", "e5", "4. dxe5"],
  ["g4", "f3", "Bxf3"],
  ["d1", "f3", "5. Qxf3"],
  ["d6", "e5", "dxe5"],
  ["f1", "c4", "6. Bc4"],
  ["g8", "f6", "Nf6"],
  ["f3", "b3", "7. Qb3"],
  ["d8", "e7", "Qe7"],
  ["b1", "c3", "8. Nc3"],
  ["c7", "c6", "c6"],
  ["c1", "g5", "9. Bg5"],
  ["b7", "b5", "b5"],
  ["c3", "b5", "10. Nxb5"],
  ["c6", "b5", "cxb5"],
  ["c4", "b5", "11. Bxb5+"],
  ["b8", "d7", "Nbd7"],
  ["e1", "c1", "12. O-O-O", "a1"],
  ["a8", "d8", "Rd8"],
  ["d1", "d7", "13. Rxd7"],
  ["d8", "d7", "Rxd7"],
  ["h1", "d1", "14. Rd1"],
  ["e7", "e6", "Qe6"],
  ["b5", "d7", "15. Bxd7+"],
  ["f6", "d7", "Nxd7"],
  ["b3", "b8", "16. Qb8+"],
  ["d7", "b8", "Nxb8"],
  ["d1", "d8", "17. Rd8#"],
];

/* ---------------------------------------------------------------- geometry */

const FILES = "abcdefgh";
const col = (sq) => FILES.indexOf(sq[0]);
const row = (sq) => 8 - Number(sq[1]);
const centerX = (sq) => BOARD_X + col(sq) * SQUARE + SQUARE / 2;
const centerY = (sq) => BOARD_Y + row(sq) * SQUARE + SQUARE / 2;

/* Every piece is drawn in its own 100x100 box, feet on y=80.
   Deliberately vector geometry: no font glyphs, and no crosses anywhere —
   the king's finial is an orb, not a cross. */
const SHAPES = {
  p: [
    ["c", 50, 32, 13],
    ["p", "M36 46 L64 46 C68 58 72 70 72 80 L28 80 C28 70 32 58 36 46 Z"],
    ["r", 26, 80, 48, 9, 3],
  ],
  r: [
    ["p", "M30 80 L30 30 L26 30 L26 20 L40 20 L40 30 L48 30 L48 20 L58 20 L58 30 L66 30 L66 20 L78 20 L78 30 L74 30 L74 80 Z"],
    ["r", 24, 80, 56, 9, 3],
  ],
  b: [
    ["p", "M50 12 C56 22 64 32 64 42 C64 52 58 58 50 58 C42 58 36 52 36 42 C36 32 44 22 50 12 Z"],
    ["p", "M50 30 L57 44"],
    ["r", 38, 58, 24, 6, 2],
    ["p", "M36 64 L64 64 L70 80 L30 80 Z"],
    ["r", 26, 80, 48, 9, 3],
  ],
  n: [
    ["p", "M40 80 C34 68 34 58 40 50 C45 43 52 40 56 35 C60 30 62 26 61 21 C69 25 74 33 73 42 C72 52 66 60 61 65 L64 80 Z"],
    ["p", "M57 33 L59 20 L67 27 Z"],
    ["r", 30, 80, 46, 9, 3],
  ],
  q: [
    ["p", "M24 62 L20 24 L36 40 L50 16 L64 40 L80 24 L76 62 Z"],
    ["c", 20, 22, 4],
    ["c", 50, 14, 4.5],
    ["c", 80, 22, 4],
    ["r", 26, 62, 48, 6, 2],
    ["p", "M32 68 L68 68 L74 80 L26 80 Z"],
    ["r", 22, 80, 56, 9, 3],
  ],
  k: [
    ["p", "M26 60 L24 28 L38 40 L50 22 L62 40 L76 28 L74 60 Z"],
    ["c", 50, 14, 5],
    ["r", 28, 60, 44, 6, 2],
    ["p", "M34 66 L66 66 L72 80 L28 80 Z"],
    ["r", 24, 80, 52, 9, 3],
  ],
};

/** One piece = a halo pass plus a crisp pass. No SVG filters involved. */
function pieceMarkup(type, colour) {
  const draw = (attrs) =>
    SHAPES[type]
      .map((s) =>
        s[0] === "p"
          ? `<path d="${s[1]}"/>`
          : s[0] === "c"
            ? `<circle cx="${s[1]}" cy="${s[2]}" r="${s[3]}"/>`
            : `<rect x="${s[1]}" y="${s[2]}" width="${s[3]}" height="${s[4]}" rx="${s[5]}"/>`
      )
      .join("")
      .replaceAll("<path", `<path ${attrs}`)
      .replaceAll("<circle", `<circle ${attrs}`)
      .replaceAll("<rect", `<rect ${attrs}`);

  return (
    `<g class="halo">${draw(`fill="none" stroke="${colour}" stroke-width="9" stroke-opacity=".16" stroke-linejoin="round"`)}</g>` +
    `<g class="body">${draw(`fill="#0A1018" fill-opacity=".92" stroke="${colour}" stroke-width="2" stroke-linejoin="round"`)}</g>` +
    (type === "n" ? `<circle cx="60" cy="34" r="2.2" fill="${colour}"/>` : "")
  );
}

/* ---------------------------------------------------------------- simulate */

const board = new Map();
const allPieces = [];
START_FEN.split("/").forEach((rowStr, i) => {
  const rank = 8 - i;
  let file = 0;
  for (const ch of rowStr) {
    if (/\d/.test(ch)) {
      file += Number(ch);
    } else {
      const piece = {
        startSquare: FILES[file] + rank,
        type: ch.toLowerCase(),
        white: ch === ch.toUpperCase(),
      };
      board.set(piece.startSquare, piece);
      allPieces.push(piece);
      file += 1;
    }
  }
});

const PLAY_END = PRE + (GAME.length - 1) * PLY + PLY * 0.85;

/* Finale timing, measured from the mating move. */
const F = {
  zoomStart: 0.1,
  zoomEnd: 0.9,
  zoomK: 1.12,
  shutStart: 0.55, // board starts folding shut
  shutEnd: 1.1, // edge-on: the swap happens here
  openEnd: 1.8, // back face fully open
  holdEnd: 5.0,
  closeStart: 5.0, // back face folds away again
  closeEdge: 5.91, // exactly where scaleY crosses zero on the way home
  closeEnd: 6.05,
};
const FINALE = 6.25;
const DURATION = PLAY_END + FINALE;
const z = (offset) => PLAY_END + offset;

const num = (n) => Number(n.toFixed(3));
const pct = (t) => `${num((t / DURATION) * 100)}%`;

const hops = new Map();
const deaths = new Map();
const bursts = [];
let cursor = PRE;
let plyIndex = 0;

for (const [from, to, , extraFrom] of GAME) {
  const mover = board.get(from);
  if (!mover) throw new Error(`move ${plyIndex + 1}: no piece on ${from}`);
  const victim = board.get(to);
  if (victim && victim.white === mover.white) {
    throw new Error(`move ${plyIndex + 1}: friendly piece on ${to}`);
  }

  const start = cursor;
  const end = cursor + PLY * 0.85;
  if (victim) {
    deaths.set(victim, { at: end });
    bursts.push({ at: end, square: to });
  }

  hops.set(mover, [
    ...(hops.get(mover) ?? []),
    { start, end, from: [centerX(from), centerY(from)], to: [centerX(to), centerY(to)] },
  ]);

  board.delete(from);
  board.set(to, mover);

  if (extraFrom) {
    const rookSquare = to === "c1" ? "d1" : "f1";
    const rook = board.get(extraFrom);
    if (!rook) throw new Error(`move ${plyIndex + 1}: no rook on ${extraFrom}`);
    hops.set(rook, [
      ...(rook ? hops.get(rook) ?? [] : []),
      {
        start,
        end,
        from: [centerX(extraFrom), centerY(extraFrom)],
        to: [centerX(rookSquare), centerY(rookSquare)],
      },
    ]);
    board.delete(extraFrom);
    board.set(rookSquare, rook);
  }

  cursor = start + PLY;
  plyIndex += 1;
}

/* --------------------------------------------------------------- keyframes */

const rules = [];
const bindings = [];
let id = 0;

const emit = (name, stops) =>
  rules.push(`@keyframes ${name}{${stops.map(([a, b]) => `${a}{${b}}`).join("")}}`);

const bind = (names) => {
  id += 1;
  const cls = `an${id}`;
  bindings.push(`.${cls}{animation-name:${names.join(",")}}`);
  return cls;
};

const dedupe = (stops) => {
  const out = [];
  for (const s of stops) {
    if (out.length && out[out.length - 1][0] === s[0]) out[out.length - 1] = s;
    else out.push(s);
  }
  return out;
};

/* 1. piece movement: hop out, land with a small rattle */
const pieceAnim = new Map();
for (const [piece, list] of hops) {
  id += 1;
  const name = `mv${id}`;
  const base = [centerX(piece.startSquare), centerY(piece.startSquare)];
  const tf = (target, lift = 0, scale = 1) =>
    `transform:translate(${num(target[0] - base[0])}px,${num(target[1] - base[1] - lift)}px) scale(${scale})`;

  const stops = [["0%", tf(base)]];
  let current = base;
  for (const hop of list) {
    const mid = [(hop.from[0] + hop.to[0]) / 2, (hop.from[1] + hop.to[1]) / 2];
    stops.push([pct(hop.start), tf(current)]);
    stops.push([pct(hop.start + (hop.end - hop.start) * 0.5), tf(mid, 12, 1.14)]);
    stops.push([pct(hop.end), tf(hop.to)]);
    stops.push([pct(hop.end + 0.06), tf([hop.to[0] - 2, hop.to[1] + 1], 0, 1.02)]);
    stops.push([pct(hop.end + 0.12), tf([hop.to[0] + 2, hop.to[1] - 1], 0, 1.01)]);
    stops.push([pct(hop.end + 0.18), tf(hop.to)]);
    current = hop.to;
  }
  stops.push(["100%", tf(current)]);
  emit(name, dedupe(stops));
  pieceAnim.set(piece, name);
}

/* 2. captured pieces fade out (opacity only, shares the <g> with movement) */
const goneAnim = new Map();
for (const [piece, { at }] of deaths) {
  id += 1;
  emit(`gone${id}`, [
    ["0%", "opacity:1"],
    [pct(at), "opacity:1"],
    [pct(at + 0.28), "opacity:0"],
    ["100%", "opacity:0"],
  ]);
  goneAnim.set(piece, `gone${id}`);
}

/* 3. last-move highlight */
const hlStops = (pickFrom) => {
  const at = (sq) =>
    `transform:translate(${BOARD_X + col(sq) * SQUARE}px,${BOARD_Y + row(sq) * SQUARE}px)`;
  const stops = [];
  GAME.forEach(([from, to], i) => {
    const start = PRE + i * PLY;
    stops.push([pct(start), at(pickFrom ? from : to)]);
    stops.push([pct(start + PLY * 0.85), at(pickFrom ? to : from)]);
  });
  stops.unshift(["0%", at(GAME[0][0])]);
  const last = GAME[GAME.length - 1];
  stops.push(["100%", at(pickFrom ? last[0] : last[1])]);
  return dedupe(stops);
};
emit("hlFrom", hlStops(true));
emit("hlTo", hlStops(false));

/* 4. capture burst rings */
const ringAnim = bursts.map(({ at, square }) => {
  id += 1;
  const name = `burst${id}`;
  const c = [centerX(square), centerY(square)];
  emit(name, [
    ["0%", `transform:translate(${c[0]}px,${c[1]}px) scale(.1);opacity:0`],
    [pct(at), `transform:translate(${c[0]}px,${c[1]}px) scale(.1);opacity:0`],
    [pct(at + 0.12), `transform:translate(${c[0]}px,${c[1]}px) scale(.45);opacity:.85`],
    [pct(at + 0.45), `transform:translate(${c[0]}px,${c[1]}px) scale(1.5);opacity:0`],
    ["100%", `transform:translate(${c[0]}px,${c[1]}px) scale(1.5);opacity:0`],
  ]);
  return name;
});

/* 5. slow breathing zoom */
id += 1;
emit(`breathe${id}`, [
  ["0%", "transform:scale(1)"],
  ["8.3%", "transform:scale(1.045)"],
  ["16.6%", "transform:scale(1)"],
  ["25%", "transform:scale(1.045)"],
  ["33.3%", "transform:scale(1)"],
  ["41.6%", "transform:scale(1.045)"],
  ["50%", "transform:scale(1)"],
  ["58.3%", "transform:scale(1.045)"],
  ["66.6%", "transform:scale(1)"],
  ["74.9%", "transform:scale(1.045)"],
  ["83.3%", "transform:scale(1)"],
  ["91.6%", "transform:scale(1.045)"],
  ["100%", "transform:scale(1)"],
]);
const breatheCls = bind([`breathe${id}`]);

/* 6. stage: capture shakes + a nudge as the finale lands */
const stageStops = [["0%", "transform:translate(0px,0px) scale(1)"]];
const zoomAt = (k) =>
  `transform:translate(${num(ORIGIN[0] - k * BOARD_CX)}px,${num(ORIGIN[1] - k * BOARD_CY)}px) scale(${num(k)})`;
for (const { at } of bursts) {
  stageStops.push([pct(at), "transform:translate(0px,0px) scale(1)"]);
  stageStops.push([pct(at + 0.05), "transform:translate(-5px,2.5px) scale(1)"]);
  stageStops.push([pct(at + 0.11), "transform:translate(5px,-2.5px) scale(1)"]);
  stageStops.push([pct(at + 0.18), "transform:translate(0px,0px) scale(1)"]);
}
stageStops.push([pct(z(F.zoomStart)), "transform:translate(0px,0px) scale(1)"]);
stageStops.push([pct(z((F.zoomStart + F.zoomEnd) / 2)), zoomAt(1 + (F.zoomK - 1) * 0.7)]);
stageStops.push([pct(z(F.zoomEnd)), zoomAt(F.zoomK)]);
stageStops.push([pct(z(F.closeStart)), zoomAt(F.zoomK)]);
stageStops.push([pct(z(F.closeEnd)), "transform:translate(0px,0px) scale(1)"]);
stageStops.push(["100%", "transform:translate(0px,0px) scale(1)"]);
id += 1;
emit(
  `stage${id}`,
  dedupe(stageStops.sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])))
);
const stageCls = bind([`stage${id}`]);

/* 7. the card flip: board folds shut, name shows on the back */
id += 1;
emit(`flip${id}`, [
  ["0%", "transform:scaleY(1)"],
  [pct(z(F.shutStart)), "transform:scaleY(1)"],
  [pct(z((F.shutStart + F.shutEnd) / 2)), "transform:scaleY(0.42)"],
  [pct(z(F.shutEnd)), "transform:scaleY(0.02)"],
  [pct(z(F.shutEnd + 0.14)), "transform:scaleY(-0.02)"],
  [pct(z((F.shutEnd + F.openEnd) / 2)), "transform:scaleY(-0.62)"],
  [pct(z(F.openEnd)), "transform:scaleY(-1)"],
  [pct(z(F.closeStart)), "transform:scaleY(-1)"],
  [pct(z((F.closeStart + F.closeEnd) * 0.5 - 0.2)), "transform:scaleY(-0.42)"],
  [pct(z(F.closeEdge)), "transform:scaleY(0.02)"],
  [pct(z(F.closeEnd)), "transform:scaleY(1)"],
  ["100%", "transform:scaleY(1)"],
]);
const flipCls = bind([`flip${id}`]);

// face swap happens while the card is edge-on (|scaleY| <= 0.02)
const EDGE_OPEN_IN = [z(F.shutEnd - 0.02), z(F.shutEnd + 0.02)];
const EDGE_CLOSE = [z(F.closeEdge - 0.05), z(F.closeEdge + 0.02)];
const swap = (from, to) => () => [
  ["0%", `opacity:${from}`],
  [pct(EDGE_OPEN_IN[0]), `opacity:${from}`],
  [pct(EDGE_OPEN_IN[1]), `opacity:${to}`],
  [pct(EDGE_CLOSE[0]), `opacity:${to}`],
  [pct(EDGE_CLOSE[1]), `opacity:${from}`],
  ["100%", `opacity:${from}`],
];

id += 1;
emit(`front${id}`, swap(1, 0)());
const frontCls = bind([`front${id}`]);

id += 1;
emit(`back${id}`, swap(0, 1)());
const backCls = bind([`back${id}`]);

/* 8. the name: chromatic ghosts + halo + gradient face, rising into place */
const WORD_SIZE = 78;
const WORD_BASELINE = BOARD_CY + 20; // optical centring: letters + rule straddle the middle
const advances = [...WORD].map((ch) =>
  ch === "S" ? 52 : ch === "r" ? 32 : ch === "i" || ch === "l" ? 22 : 46
);
const track = -3;
const wordWidth = advances.reduce((a, b) => a + b, 0) + track * (WORD.length - 1);

const letterEls = [];
let letterX = BOARD_CX - wordWidth / 2;
[...WORD].forEach((ch, i) => {
  const adv = advances[i];
  const cx = letterX + adv / 2;
  letterX += adv + track;

  const start = z(F.openEnd + i * 0.07);
  const settle = start + 0.42;
  id += 1;
  emit(`ltr${id}`, [
    ["0%", "opacity:0;transform:translateY(26px) scale(.86)"],
    [pct(start), "opacity:0;transform:translateY(26px) scale(.86)"],
    [pct(start + 0.12), "opacity:.85;transform:translateY(4px) scale(1.04)"],
    [pct(settle), "opacity:1;transform:translateY(0) scale(1)"],
    [pct(z(F.holdEnd)), "opacity:1;transform:translateY(0) scale(1)"],
    [pct(z(F.closeStart + 0.35)), "opacity:0;transform:translateY(-14px) scale(.94)"],
    ["100%", "opacity:0;transform:translateY(-14px) scale(.94)"],
  ]);

  const glyph = `<text class="wghost a" dx="-2.5">${ch}</text><text class="wghost b" dx="2.5">${ch}</text><text class="wglow">${ch}</text><text class="wglow2">${ch}</text><text class="word">${ch}</text>`;
  letterEls.push(
    `<g transform="translate(${num(cx)} ${num(WORD_BASELINE)})"><g class="ltr ${bind([`ltr${id}`])}">${glyph}</g></g>`
  );
});

/* the rule sweeps out under the name */
id += 1;
emit(`rule${id}`, [
  ["0%", "transform:scaleX(0);opacity:0"],
  [pct(z(F.openEnd + 0.1)), "transform:scaleX(0);opacity:0"],
  [pct(z(F.openEnd + 0.55)), "transform:scaleX(1);opacity:1"],
  [pct(z(F.holdEnd)), "transform:scaleX(1);opacity:1"],
  [pct(z(F.closeStart + 0.3)), "transform:scaleX(0);opacity:0"],
  ["100%", "transform:scaleX(0);opacity:0"],
]);
const ruleCls = bind([`rule${id}`]);

/* 9. shockwaves behind the name */
const finaleRings = [0, 0.13, 0.26].map((off) => {
  id += 1;
  const at = z(F.openEnd - 0.1 + off);
  emit(`ring${id}`, [
    ["0%", `transform:translate(${BOARD_CX}px,${BOARD_CY}px) scale(.2);opacity:0`],
    [pct(at), `transform:translate(${BOARD_CX}px,${BOARD_CY}px) scale(.2);opacity:0`],
    [pct(at + 0.2), `transform:translate(${BOARD_CX}px,${BOARD_CY}px) scale(.55);opacity:.55`],
    [pct(at + 0.9), `transform:translate(${BOARD_CX}px,${BOARD_CY}px) scale(2.4);opacity:0`],
    ["100%", `transform:translate(${BOARD_CX}px,${BOARD_CY}px) scale(2.4);opacity:0`],
  ]);
  return `<circle class="ring ${bind([`ring${id}`])}" r="100"/>`;
});

/* --------------------------------------------------------------- rendering */

const boardPx = SQUARE * 8;
const squares = [];
for (let r = 0; r < 8; r += 1) {
  for (let f = 0; f < 8; f += 1) {
    squares.push(
      `<rect class="${(f + r) % 2 === 1 ? "sqL" : "sqD"}" x="${BOARD_X + f * SQUARE}" y="${BOARD_Y + r * SQUARE}" width="${SQUARE}" height="${SQUARE}"/>`
    );
  }
}

const coords = [
  ...FILES.split("").map(
    (f, i) =>
      `<text class="coord" x="${BOARD_X + i * SQUARE + SQUARE / 2}" y="${BOARD_Y + boardPx + 17}">${f}</text>`
  ),
  ...Array.from(
    { length: 8 },
    (_, r) => `<text class="coord" x="${BOARD_X - 9}" y="${BOARD_Y + r * SQUARE + SQUARE / 2 + 4}">${8 - r}</text>`
  ),
];

const rendered = new Map();
for (const [piece, name] of pieceAnim) rendered.set(piece, [name]);
for (const [piece, name] of goneAnim) rendered.set(piece, [...(rendered.get(piece) ?? []), name]);
// pieces that never move still have to be drawn — they just carry no animation
for (const piece of allPieces) if (!rendered.has(piece)) rendered.set(piece, []);

const pieceEls = [...rendered].map(([piece, anims]) => {
  const base = [centerX(piece.startSquare), centerY(piece.startSquare)];
  const colour = piece.white ? NEON_W : NEON_B;
  return (
    `<g class="piece${anims.length ? ` ${bind(anims)}` : ""}">` +
    `<g transform="translate(${base[0]} ${base[1]}) scale(0.46) translate(-50 -50)">` +
    `${pieceMarkup(piece.type, colour)}</g></g>`
  );
});

/* front face: the game */
const frontFace = `<g class="face front ${frontCls}">
<g clip-path="url(#clip)">
${squares.join("")}
<g class="grid">
${Array.from({ length: 9 }, (_, i) => `<line class="gridline" x1="${BOARD_X + i * SQUARE}" y1="${BOARD_Y}" x2="${BOARD_X + i * SQUARE}" y2="${BOARD_Y + boardPx}"/>`).join("")}
${Array.from({ length: 9 }, (_, i) => `<line class="gridline" x1="${BOARD_X}" y1="${BOARD_Y + i * SQUARE}" x2="${BOARD_X + boardPx}" y2="${BOARD_Y + i * SQUARE}"/>`).join("")}
</g>
<g class="hl ${bind(["hlFrom"])}"><rect width="${SQUARE}" height="${SQUARE}"/></g>
<g class="hl ${bind(["hlTo"])}"><rect width="${SQUARE}" height="${SQUARE}"/></g>
${pieceEls.join("\n")}
${ringAnim.map((a) => `<g class="ring ${bind([a])}"><circle r="20"/></g>`).join("\n")}
</g>
<rect x="${BOARD_X}" y="${BOARD_Y}" width="${boardPx}" height="${boardPx}" fill="none" stroke="#5EE7F9" stroke-opacity=".35"/>
${coords.join("\n")}
</g>`;

/* back face: the name, revealed by the flip. Pre-mirrored about the board's
   horizontal centre so the card flip leaves it upright. */
const backFace = `<g class="face back ${backCls}" transform="translate(0 ${BOARD_CY * 2}) scale(1 -1)">
<rect class="backplate" x="${BOARD_X}" y="${BOARD_Y}" width="${boardPx}" height="${boardPx}"/>
<g clip-path="url(#clip)">
<g class="rays">
${Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return `<line class="ray" x1="${BOARD_CX}" y1="${BOARD_CY}" x2="${num(BOARD_CX + Math.cos(a) * 420)}" y2="${num(BOARD_CY + Math.sin(a) * 420)}"/>`;
}).join("")}
</g>
<g class="pulse">${finaleRings.join("\n")}</g>
${letterEls.join("\n")}
<g class="${ruleCls}">
<rect class="rule" x="${num(BOARD_CX - wordWidth / 2)}" y="${num(WORD_BASELINE + 34)}" width="${num(wordWidth)}" height="3" rx="1.5"/>
</g>
</g>
<rect x="${BOARD_X}" y="${BOARD_Y}" width="${boardPx}" height="${boardPx}" fill="none" stroke="#F0ABFC" stroke-opacity=".5"/>
</g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PANEL_W} ${PANEL_H}" width="${PANEL_W}" height="${PANEL_H}" role="img" aria-label="Neon chess animation that flips the board to reveal the name Sarhan">
<defs>
<linearGradient id="wordGrad" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#ECFEFF"/><stop offset="38%" stop-color="#5EE7F9"/>
<stop offset="72%" stop-color="#A78BFA"/><stop offset="100%" stop-color="#F472B6"/>
</linearGradient>
<linearGradient id="ruleGrad" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="#5EE7F9"/><stop offset="100%" stop-color="#F472B6"/>
</linearGradient>
<radialGradient id="plateGrad" cx=".5" cy=".45" r=".75">
<stop offset="0%" stop-color="#1B2440"/><stop offset="100%" stop-color="#0B0F1A"/>
</radialGradient>
<clipPath id="clip"><rect x="${BOARD_X}" y="${BOARD_Y}" width="${boardPx}" height="${boardPx}"/></clipPath>
</defs>
<style>
.bg{fill:#0D1117}
.backplate{fill:url(#plateGrad)}
.rays{transform-box:view-box;transform-origin:${BOARD_CX}px ${BOARD_CY}px;animation-name:spin;animation-duration:${num(DURATION * 3)}s;animation-iteration-count:infinite;animation-timing-function:linear}
.ray{stroke:#A78BFA;stroke-opacity:.08;stroke-width:1.5}
.pulse{animation-name:pulseA;animation-duration:${num(DURATION)}s;animation-iteration-count:infinite;animation-timing-function:linear}
.sqL{fill:#0F1A24}
.sqD{fill:#0B1119}
.gridline{stroke:#5EE7F9;stroke-opacity:.07;stroke-width:1}
.coord{font:600 10px ui-monospace,Menlo,monospace;fill:#3D4757;text-anchor:middle}
.piece,.stage,.breath,.flipper,.face,.ring,.hl,.ltr,.rule{animation-duration:${num(DURATION)}s;animation-iteration-count:infinite;animation-timing-function:linear}
.piece,.ltr{transform-box:fill-box;transform-origin:center}
.stage,.breath,.flipper{transform-box:view-box;transform-origin:50% 46.5%}
.hl{transform-box:view-box;transform-origin:0 0}
.hl{fill:#5EE7F9;opacity:.16}
.ring{fill:none;stroke:#F0ABFC;stroke-width:2;opacity:0}
.word{font:italic 900 ${WORD_SIZE}px "Segoe UI","Helvetica Neue",Arial,sans-serif;text-anchor:middle;fill:url(#wordGrad);stroke:#F0ABFC;stroke-width:1.1;paint-order:stroke}
.wglow{fill:none;stroke:#A78BFA;stroke-width:17;stroke-opacity:.15}
.wglow2{fill:none;stroke:#5EE7F9;stroke-width:7;stroke-opacity:.3}
.wghost{font:italic 900 ${WORD_SIZE}px "Segoe UI","Helvetica Neue",Arial,sans-serif;text-anchor:middle;opacity:.4}
.wghost.a{fill:#5EE7F9}
.wghost.b{fill:#F472B6}
.rule{fill:url(#ruleGrad)}
${rules.join("\n")}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulseA{0%{opacity:.55}18%{opacity:.2}36%{opacity:.55}54%{opacity:.2}72%{opacity:.55}90%{opacity:.2}100%{opacity:.55}}
${bindings.join("\n")}
@media (prefers-color-scheme:light){
.bg{fill:#FFFFFF}.sqL{fill:#F4F8FB}.sqD{fill:#E8EFF5}.coord{fill:#94A3B8}
.gridline{stroke:#0EA5E9;stroke-opacity:.12}.backplate{fill:#F7F2FF}
.word{stroke:#7C3AED}.ray{stroke-opacity:.1}
}
@media (prefers-reduced-motion:reduce){
.piece,.stage,.breath,.flipper,.face,.ring,.hl,.ltr,.rule,.rays,.pulse{animation:none}
.hl,.ring{opacity:0}
}
</style>
<rect class="bg" width="${PANEL_W}" height="${PANEL_H}"/>
<g class="stage ${stageCls}">
<g class="breath ${breatheCls}">
<g class="flipper ${flipCls}">
${frontFace}
${backFace}
</g>
</g>
</g>
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log(
  `wrote ${OUT}\n  ${GAME.length} plies · ${num(DURATION)}s loop · ${(svg.length / 1024).toFixed(1)} KB · ` +
    `${pieceEls.length} pieces · board flips to "${WORD}"`
);