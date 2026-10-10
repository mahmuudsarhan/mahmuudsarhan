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
   the king's finial is an orb, not a cross.
   HALO says how many leading shapes get the soft outer pass; small bars skip
   it, which is where a third of the node count used to go. */
const HALO = { p: 2, r: 1, b: 3, n: 2, q: 5, k: 3 };
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

const shapeTag = (s, attrs = "") => {
  const a = attrs ? ` ${attrs}` : "";
  return s[0] === "p"
    ? `<path${a} d="${s[1]}"/>`
    : s[0] === "c"
      ? `<circle${a} cx="${s[1]}" cy="${s[2]}" r="${s[3]}"/>`
      : `<rect${a} x="${s[1]}" y="${s[2]}" width="${s[3]}" height="${s[4]}" rx="${s[5]}"/>`;
};

/** A piece = soft outer pass on its silhouette + one crisp pass. No filters. */
function pieceMarkup(type, colour) {
  const halo = SHAPES[type]
    .slice(0, HALO[type])
    .map((s) => shapeTag(s, `fill="none" stroke="${colour}" stroke-width="9" stroke-opacity=".16" stroke-linejoin="round"`))
    .join("");
  const crisp = SHAPES[type]
    .map((s) => shapeTag(s, `fill="#0A1018" fill-opacity=".92" stroke="${colour}" stroke-width="2" stroke-linejoin="round"`))
    .join("");
  return (
    `<g class="halo">${halo}</g><g class="body">${crisp}</g>` +
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
  shutStart: 0.55,
  shutEnd: 1.1,
  openEnd: 1.8,
  holdEnd: 5.0,
  closeStart: 5.0, // back face folds away again
  closeEdge: 5.91, // exactly where scaleY crosses zero on the way home
  closeEnd: 6.05,
};
const FINALE = 6.25;
const DURATION = PLAY_END + FINALE;
const z = (o) => PLAY_END + o;

const num = (n) => {
  if (!Number.isFinite(n)) throw new Error(`non-finite value in animation maths: ${n}`);
  return Number(n.toFixed(3));
};
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
      ...(hops.get(rook) ?? []),
      { start, end, from: [centerX(extraFrom), centerY(extraFrom)], to: [centerX(rookSquare), centerY(rookSquare)] },
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

/* 1. piece movement: hop out, land with a rattle */
const pieceAnim = new Map();
for (const [piece, list] of hops) {
  id += 1;
  const name = `mv${id}`;
  const base = [centerX(piece.startSquare), centerY(piece.startSquare)];
  const tf = (t, lift = 0, scale = 1) =>
    `transform:translate(${num(t[0] - base[0])}px,${num(t[1] - base[1] - lift)}px) scale(${scale})`;

  const stops = [["0%", tf(base)]];
  let cur = base;
  for (const hop of list) {
    const mid = [(hop.from[0] + hop.to[0]) / 2, (hop.from[1] + hop.to[1]) / 2];
    stops.push([pct(hop.start), tf(cur)]);
    stops.push([pct(hop.start + (hop.end - hop.start) * 0.5), tf(mid, 12, 1.14)]);
    stops.push([pct(hop.end), tf(hop.to)]);
    stops.push([pct(hop.end + 0.06), tf([hop.to[0] - 2, hop.to[1] + 1], 0, 1.02)]);
    stops.push([pct(hop.end + 0.12), tf([hop.to[0] + 2, hop.to[1] - 1], 0, 1.01)]);
    stops.push([pct(hop.end + 0.18), tf(hop.to)]);
    cur = hop.to;
  }
  stops.push(["100%", tf(cur)]);
  emit(name, dedupe(stops));
  pieceAnim.set(piece, name);
}

/* 2. captured pieces fade out (opacity only — shares the <g> with movement) */
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
  const at = (sq) => `transform:translate(${BOARD_X + col(sq) * SQUARE}px,${BOARD_Y + row(sq) * SQUARE}px)`;
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

/* 4. every capture ripple, packed into ONE element + ONE animation */
const capStops = [["0%", "transform:translate(0px,0px) scale(.1);opacity:0"]];
for (const { at, square } of bursts) {
  const c = [centerX(square), centerY(square)];
  const tf = (scale) => `transform:translate(${c[0]}px,${c[1]}px) scale(${scale})`;
  capStops.push([pct(at), `${tf(.1)};opacity:0`]);
  capStops.push([pct(at + 0.12), `${tf(.45)};opacity:.85`]);
  capStops.push([pct(at + 0.45), `${tf(1.5)};opacity:0`]);
}
capStops.push(["100%", "transform:translate(0px,0px) scale(1.5);opacity:0"]);
id += 1;
emit(`cap${id}`, capStops);
const capCls = bind([`cap${id}`]);

/* 5. slow breathing zoom */
id += 1;
emit(`breathe${id}`, [
  ["0%", "transform:scale(1)"],
  ["12.5%", "transform:scale(1.045)"],
  ["25%", "transform:scale(1)"],
  ["37.5%", "transform:scale(1.045)"],
  ["50%", "transform:scale(1)"],
  ["62.5%", "transform:scale(1.045)"],
  ["75%", "transform:scale(1)"],
  ["87.5%", "transform:scale(1.045)"],
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
emit(`stage${id}`, dedupe(stageStops.sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))));
const stageCls = bind([`stage${id}`]);

/* 7. light sweeping across the board */
id += 1;
emit(`sweep${id}`, [
  ["0%", "transform:translate(-320px,0) skewX(-18deg);opacity:0"],
  ["6%", "opacity:.5"],
  ["18%", "opacity:0"],
  ["50%", "transform:translate(320px,0) skewX(-18deg);opacity:0"],
  ["56%", "transform:translate(-320px,0) skewX(-18deg);opacity:0"],
  ["62%", "opacity:.5"],
  ["74%", "opacity:0"],
  ["100%", "transform:translate(320px,0) skewX(-18deg);opacity:0"],
]);
const sweepCls = bind([`sweep${id}`]);

/* 8. the card flip: board folds shut, emblem shows on the back */
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

/* faces swap while the card is edge-on (|scaleY| <= 0.02) */
const open = [z(F.shutEnd - 0.02), z(F.shutEnd + 0.02)];
const shut = [z(F.closeEdge - 0.05), z(F.closeEdge + 0.02)];
const faceStops = (from, to) => [
  ["0%", `opacity:${from}`],
  [pct(open[0]), `opacity:${from}`],
  [pct(open[1]), `opacity:${to}`],
  [pct(shut[0]), `opacity:${to}`],
  [pct(shut[1]), `opacity:${from}`],
  ["100%", `opacity:${from}`],
];
id += 1;
emit(`front${id}`, faceStops(1, 0));
const frontCls = bind([`front${id}`]);
id += 1;
emit(`back${id}`, faceStops(0, 1));
const backCls = bind([`back${id}`]);

/* 9. the reveal: a neon iris blooms on the back face */
id += 1;
emit(`iris${id}`, [
  ["0%", "transform:scale(.2);opacity:0"],
  [pct(z(F.openEnd - 0.22)), "transform:scale(.2);opacity:0"],
  [pct(z(F.openEnd + 0.1)), "transform:scale(1);opacity:1"],
  [pct(z(F.holdEnd)), "transform:scale(1.06);opacity:1"],
  [pct(z(F.closeStart + 0.3)), "transform:scale(1.25);opacity:0"],
  ["100%", "transform:scale(1.25);opacity:0"],
]);
const irisCls = bind([`iris${id}`]);

/* 10. slow rotations on the back face — one rule each, no filters */
const spin = (name, from, to, origin) => {
  id += 1;
  emit(`${name}${id}`, [
    ["0%", `transform:rotate(${from}deg)`],
    ["100%", `transform:rotate(${to}deg)`],
  ]);
  return { cls: bind([`${name}${id}`]), origin };
};
const spinA = spin("spinA", 0, 360, BOARD_CY);
const spinB = spin("spinB", 360, 0, BOARD_CY);

const dots = [0, 90, 180, 270]
  .map(
    (a) =>
      `<circle class="dot" cx="${num(BOARD_CX + Math.cos((a * Math.PI) / 180) * 90)}" cy="${num(
        BOARD_CY + Math.sin((a * Math.PI) / 180) * 90
      )}" r="3.5"/>`
  )
  .join("");

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
for (const piece of allPieces) if (!rendered.has(piece)) rendered.set(piece, []);

const pieceEls = [...rendered].map(([piece, anims]) => {
  const base = [centerX(piece.startSquare), centerY(piece.startSquare)];
  const colour = piece.white ? NEON_W : NEON_B;
  return (
    `<g class="piece${anims.length ? ` ${bind(anims)}` : ""}">` +
    `<g transform="translate(${base[0]} ${base[1]}) scale(.46) translate(-50 -50)">${pieceMarkup(
      piece.type,
      colour
    )}</g></g>`
  );
});

const frontFace = `<g class="face front ${frontCls}">
<g clip-path="url(#clip)">
${squares.join("")}
<g class="grid">
${Array.from({ length: 9 }, (_, i) => `<line class="gridline" x1="${BOARD_X + i * SQUARE}" y1="${BOARD_Y}" x2="${BOARD_X + i * SQUARE}" y2="${BOARD_Y + boardPx}"/>`).join("")}
${Array.from({ length: 9 }, (_, i) => `<line class="gridline" x1="${BOARD_X}" y1="${BOARD_Y + i * SQUARE}" x2="${BOARD_X + boardPx}" y2="${BOARD_Y + i * SQUARE}"/>`).join("")}
</g>
<g class="sweep ${sweepCls}"><rect class="band" x="${BOARD_X}" y="${BOARD_Y}" width="150" height="${boardPx}"/></g>
<g class="hl ${bind(["hlFrom"])}"><rect width="${SQUARE}" height="${SQUARE}"/></g>
<g class="hl ${bind(["hlTo"])}"><rect width="${SQUARE}" height="${SQUARE}"/></g>
<circle class="ripple ${capCls}" cx="${BOARD_CX}" cy="${BOARD_CY}" r="18"/>
${pieceEls.join("\n")}
</g>
<rect x="${BOARD_X}" y="${BOARD_Y}" width="${boardPx}" height="${boardPx}" fill="none" stroke="#5EE7F9" stroke-opacity=".35"/>
${coords.join("\n")}
</g>`;

const backFace = `<g class="face back ${backCls}" transform="translate(0 ${BOARD_CY * 2}) scale(1 -1)">
<rect class="plate" x="${BOARD_X}" y="${BOARD_Y}" width="${boardPx}" height="${boardPx}"/>
<g class="iris ${irisCls}">
<circle class="glowdisc" cx="${BOARD_CX}" cy="${BOARD_CY}" r="86"/>
<g class="spin ${spinA.cls}" style="transform-origin:${BOARD_CX}px ${BOARD_CY}px">
<circle class="ringA" cx="${BOARD_CX}" cy="${BOARD_CY}" r="66"/>
${dots}
</g>
<g class="spin ${spinB.cls}" style="transform-origin:${BOARD_CX}px ${BOARD_CY}px">
<circle class="ringB" cx="${BOARD_CX}" cy="${BOARD_CY}" r="66"/>
<circle class="ringB" cx="${BOARD_CX}" cy="${BOARD_CY}" r="96"/>
</g>
<circle class="core" cx="${BOARD_CX}" cy="${BOARD_CY}" r="16"/>
<circle class="coreDot" cx="${BOARD_CX}" cy="${BOARD_CY}" r="5"/>
</g>
</g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PANEL_W} ${PANEL_H}" width="${PANEL_W}" height="${PANEL_H}" role="img" aria-label="Neon chess animation: a game plays out, then the board flips">
<defs>
<radialGradient id="plateGrad" cx=".5" cy=".5" r=".7"><stop offset="0%" stop-color="#241C42"/><stop offset="100%" stop-color="#0A0E18"/></radialGradient>
<linearGradient id="bandGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#5EE7F9" stop-opacity="0"/><stop offset="50%" stop-color="#5EE7F9" stop-opacity=".55"/><stop offset="100%" stop-color="#5EE7F9" stop-opacity="0"/></linearGradient>
<clipPath id="clip"><rect x="${BOARD_X}" y="${BOARD_Y}" width="${boardPx}" height="${boardPx}"/></clipPath>
</defs>
<style>
.bg{fill:#0D1117}
.plate{fill:url(#plateGrad)}
.band{fill:url(#bandGrad)}
.sqL{fill:#0F1A24}
.sqD{fill:#0B1119}
.gridline{stroke:#5EE7F9;stroke-opacity:.07;stroke-width:1}
.coord{font:600 10px ui-monospace,Menlo,monospace;fill:#3D4757;text-anchor:middle}
.piece,.stage,.breath,.flipper,.face,.ripple,.hl,.sweep,.iris,.spin{animation-duration:${num(DURATION)}s;animation-iteration-count:infinite;animation-timing-function:linear}
.piece{transform-box:fill-box;transform-origin:center}
.stage,.breath,.flipper,.iris,.spin{transform-box:view-box;transform-origin:50% 46.5%}
.sweep,.hl,.ripple{transform-box:view-box;transform-origin:0 0}
.hl{fill:#5EE7F9;opacity:.16}
.ripple{fill:none;stroke:#FDE68A;stroke-width:2.5;opacity:0}
.glowdisc{fill:#A78BFA;opacity:.10}
.ringA{fill:none;stroke:#5EE7F9;stroke-width:2;stroke-dasharray:10 12;opacity:.65}
.ringB{fill:none;stroke:#F472B6;stroke-width:1.5;stroke-dasharray:3 14;opacity:.5}
.dot{fill:#5EE7F9;opacity:.9}
.core{fill:#0A0E18;stroke:#A78BFA;stroke-width:2.5}
.coreDot{fill:#F0ABFC}
${rules.join("\n")}
${bindings.join("\n")}
@media (prefers-color-scheme:light){
.bg{fill:#FFFFFF}.sqL{fill:#F4F8FB}.sqD{fill:#E8EFF5}.coord{fill:#94A3B8}
.gridline{stroke:#0EA5E9;stroke-opacity:.12}.plate{fill:#F6F3FF}
.glowdisc{opacity:.14}.core{fill:#FFFFFF}
}
@media (prefers-reduced-motion:reduce){
.piece,.stage,.breath,.flipper,.face,.ripple,.hl,.sweep,.iris,.spin{animation:none}
.hl,.ripple,.iris{opacity:0}
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
    `${pieceEls.length} pieces · ${bindings.length} animations · ${(svg.match(/<(path|circle|rect|line)\b/g) ?? []).length} shapes`
);