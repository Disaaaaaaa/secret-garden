/*
  portraits.js — storybook character portraits drawn as SVG.
  Each character can show different emotions (used in dialogs and Emotion Match).
*/

const PEOPLE = {
  mary:     { skin: '#f2d4bf', hair: '#3a2a21', outfit: '#2f3b55', collar: '#f4efe4', style: 'bob' },
  colin:    { skin: '#f4ddcd', hair: '#1f1a1a', outfit: '#c7d0d9', collar: '#e8edf2', style: 'wavy' },
  dickon:   { skin: '#e3b591', hair: '#a2532c', outfit: '#6b5a3a', collar: '#c9b48c', style: 'cap', cap: '#5d6b3a', freckles: true },
  martha:   { skin: '#f0c9a8', hair: '#6b4423', outfit: '#5d6f86', collar: '#fbf6ea', style: 'maid' },
  ben:      { skin: '#e5b99a', hair: '#b9b4ab', outfit: '#5a4a36', collar: '#8a7356', style: 'old', cap: '#4e3826' },
  explorer1:{ skin: '#e8bf9a', hair: '#4a3426', outfit: '#6b7f45', collar: '#e6d8bd', style: 'hat', cap: '#a7804a' },
  explorer2:{ skin: '#c68f68', hair: '#2b1f1a', outfit: '#a85f5d', collar: '#f1e3cf', style: 'curly', cap: '#3b5a40' },
  explorer3:{ skin: '#f2d6c2', hair: '#8a5a3a', outfit: '#5f8f84', collar: '#c99a2e', style: 'scarf' }
};

const BROWS = {
  neutral:   ['M44 50 Q50 47 56 50', 'M64 50 Q70 47 76 50'],
  happy:     ['M44 48 Q50 45 56 48', 'M64 48 Q70 45 76 48'],
  sad:       ['M44 51 L56 46', 'M64 46 L76 51'],
  angry:     ['M44 46 L56 51', 'M64 51 L76 46'],
  surprised: ['M44 45 Q50 40 56 45', 'M64 45 Q70 40 76 45'],
  thinking:  ['M44 50 Q50 48 56 50', 'M64 46 Q70 41 76 46'],
  worried:   ['M44 50 Q50 45 56 47', 'M64 47 Q70 45 76 50'],
  hopeful:   ['M44 48 Q50 44 56 47', 'M64 47 Q70 44 76 48']
};

const MOUTHS = {
  neutral:   '<path d="M52 79 Q60 81 68 79" stroke="#7a3d36" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  happy:     '<path d="M48 76 Q60 90 72 76 Q60 81 48 76 Z" fill="#8a3b3b"/><path d="M52 78 Q60 81 68 78" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/>',
  sad:       '<path d="M51 83 Q60 76 69 83" stroke="#7a3d36" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  angry:     '<path d="M50 82 Q60 76 70 82 Q60 80 50 82 Z" fill="#7a3d36" stroke="#7a3d36" stroke-width="2"/>',
  surprised: '<ellipse cx="60" cy="81" rx="4.5" ry="6" fill="#7a3d36"/>',
  thinking:  '<path d="M53 80 L67 78" stroke="#7a3d36" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  worried:   '<path d="M50 81 Q55 78 60 81 Q65 84 70 80" stroke="#7a3d36" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  hopeful:   '<path d="M51 78 Q60 85 69 78" stroke="#7a3d36" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
};

function eyes(emotion) {
  const ink = '#2b2a22';
  if (emotion === 'happy') {
    return `<path d="M45 61 Q50 55 55 61" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
            <path d="M65 61 Q70 55 75 61" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  }
  let r = 3.3, ry = 3.3, dx = 0, dy = 0;
  if (emotion === 'surprised') { r = 4.2; ry = 4.6; }
  if (emotion === 'angry') { ry = 2.2; }
  if (emotion === 'sad') { dy = 1.2; }
  if (emotion === 'thinking') { dx = 1.8; dy = -1.2; }
  if (emotion === 'hopeful') { r = 3.6; ry = 3.8; dy = -0.5; }
  return [50, 70].map(x => `
    <ellipse cx="${x}" cy="60" rx="${r + 2.2}" ry="${ry + 1.6}" fill="#fff" opacity=".9"/>
    <ellipse cx="${x + dx}" cy="${60 + dy}" rx="${r}" ry="${ry}" fill="${ink}"/>
    <circle cx="${x + dx + 1.2}" cy="${58.6 + dy}" r="1.1" fill="#fff"/>`).join('');
}

function hairBack(p) {
  switch (p.style) {
    case 'bob': return `<path d="M31 60 C28 30 48 22 60 22 C74 22 93 30 89 60 L91 80 C85 83 80 77 80 72 L40 72 C40 77 35 83 29 80 Z" fill="${p.hair}"/>`;
    case 'wavy': return `<path d="M33 62 C27 34 46 23 60 24 C77 23 95 34 87 62 C86 52 84 46 80 44 L40 44 C36 46 34 52 33 62 Z" fill="${p.hair}"/>`;
    case 'maid': return `<circle cx="60" cy="27" r="11" fill="${p.hair}"/><path d="M33 58 C30 34 46 26 60 26 C74 26 90 34 87 58 Z" fill="${p.hair}"/>`;
    case 'curly': return `<g fill="${p.hair}">${[[38,40],[46,30],[58,26],[70,28],[80,36],[86,48],[34,52],[88,60],[32,64]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="10"/>`).join('')}</g>`;
    case 'scarf': return `<path d="M32 62 C28 32 46 24 60 24 C76 24 94 32 88 62 L90 86 L30 86 Z" fill="${p.hair}"/>`;
    default: return `<path d="M33 58 C30 34 46 25 60 25 C75 25 90 34 87 58 Z" fill="${p.hair}"/>`;
  }
}

function hairFront(p) {
  switch (p.style) {
    case 'bob': return `<path d="M35 47 C39 31 51 28 60 29 C70 28 82 33 85 48 C77 41 66 39 61 44 C55 39 44 41 35 47 Z" fill="${p.hair}"/>`;
    case 'wavy': return `<path d="M35 51 C35 35 48 28 60 29 C74 27 87 35 85 51 C81 44 75 40 69 45 C64 38 56 38 52 45 C46 40 40 44 35 51 Z" fill="${p.hair}"/>`;
    case 'cap': return `
      <path d="M36 50 C38 44 42 46 44 42 C46 47 50 44 52 41 L36 41 Z" fill="${p.hair}"/>
      <path d="M84 50 C82 44 78 46 76 42 C74 47 70 44 68 41 L84 41 Z" fill="${p.hair}"/>
      <path d="M32 44 C34 25 50 19 62 19 C77 19 89 27 88 42 C70 36 50 36 32 44 Z" fill="${p.cap}"/>
      <path d="M27 45 C45 38 75 38 93 45 C80 50 42 50 27 45 Z" fill="${shade(p.cap, -18)}"/>`;
    case 'maid': return `
      <path d="M36 48 C40 36 50 33 60 33 C70 33 80 36 84 48 C74 42 46 42 36 48 Z" fill="${p.hair}"/>
      <path d="M34 38 C40 24 80 24 86 38 C78 34 42 34 34 38 Z" fill="#fff" stroke="#e5dccb" stroke-width="1.5"/>
      ${[38, 46, 54, 62, 70, 78].map(x => `<circle cx="${x + 2}" cy="${30 - Math.sin((x - 34) / 52 * Math.PI) * 4}" r="3.2" fill="#fff" stroke="#e5dccb"/>`).join('')}`;
    case 'old': return `
      <path d="M34 60 C30 48 34 44 38 44 L38 60 Z M86 60 C90 48 86 44 82 44 L82 60 Z" fill="${p.hair}"/>
      <path d="M33 44 C35 28 50 22 61 22 C75 22 88 30 87 43 C70 38 50 38 33 44 Z" fill="${p.cap}"/>
      <path d="M29 45 C45 40 75 40 91 45 C78 49 42 49 29 45 Z" fill="${shade(p.cap, -15)}"/>`;
    case 'hat': return `
      <path d="M36 48 C40 38 50 36 60 37 C70 36 80 38 84 48 C75 43 46 43 36 48 Z" fill="${p.hair}"/>
      <ellipse cx="60" cy="38" rx="40" ry="8" fill="${shade(p.cap, -12)}"/>
      <path d="M38 38 C38 20 50 15 60 15 C70 15 82 20 82 38 Z" fill="${p.cap}"/>
      <rect x="38" y="31" width="44" height="5" fill="#6b4f2c"/>`;
    case 'curly': return `
      <g fill="${p.hair}">${[[42,40],[52,36],[62,35],[72,38],[79,44]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="7"/>`).join('')}</g>
      <path d="M36 40 C40 26 80 26 84 40 C70 34 50 34 36 40 Z" fill="${p.cap}"/>
      <path d="M78 38 L98 42 L80 44 Z" fill="${shade(p.cap, -15)}"/>`;
    case 'scarf': return `<path d="M35 48 C38 33 50 29 60 30 C72 29 83 34 85 48 C78 40 70 38 64 42 C58 37 44 40 35 48 Z" fill="${p.hair}"/>`;
    default: return '';
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = v => Math.max(0, Math.min(255, v + amt));
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** SVG portrait of a character with an emotion. */
export function portrait(id, emotion = 'neutral') {
  if (id === 'narrator' || !PEOPLE[id]) return bookIcon();
  const p = PEOPLE[id];
  const em = BROWS[emotion] ? emotion : 'neutral';
  const brows = BROWS[em];
  const extras = [];
  if (p.freckles) extras.push([[47, 68], [51, 70], [69, 70], [73, 68], [49, 66], [71, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="#a8623a" opacity=".7"/>`).join(''));
  if (p.style === 'old') extras.push(`<path d="M38 68 C40 92 52 100 60 100 C68 100 80 92 82 68 C76 80 70 84 60 84 C50 84 44 80 38 68 Z" fill="#cfcac0"/>`);
  if (p.style === 'scarf') extras.push(`<path d="M34 90 C44 84 76 84 86 90 L84 100 C72 95 48 95 36 100 Z" fill="${p.collar}"/><path d="M70 92 L76 112 L66 112 L64 94 Z" fill="${shade(p.collar, -20)}"/>`);
  const mouth = p.style === 'old' && em !== 'surprised' ? MOUTHS[em].replace(/stroke="#7a3d36"/g, 'stroke="#6a4a3a"') : MOUTHS[em];
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${id} looks ${em}">
    ${hairBack(p)}
    <path d="M18 122 C22 98 40 89 60 89 C80 89 98 98 102 122 Z" fill="${p.outfit}"/>
    <path d="M46 90 L60 102 L74 90 C68 88 52 88 46 90 Z" fill="${p.collar}"/>
    <rect x="52" y="76" width="16" height="15" rx="6" fill="${shade(p.skin, -14)}"/>
    <ellipse cx="34.5" cy="62" rx="4" ry="6" fill="${shade(p.skin, -8)}"/>
    <ellipse cx="85.5" cy="62" rx="4" ry="6" fill="${shade(p.skin, -8)}"/>
    <ellipse cx="60" cy="59" rx="26" ry="28" fill="${p.skin}"/>
    <circle cx="44" cy="70" r="5" fill="#e88f8f" opacity="${em === 'happy' || em === 'hopeful' ? 0.45 : 0.22}"/>
    <circle cx="76" cy="70" r="5" fill="#e88f8f" opacity="${em === 'happy' || em === 'hopeful' ? 0.45 : 0.22}"/>
    ${extras.join('')}
    ${eyes(em)}
    <path d="${brows[0]}" stroke="${shade(p.hair, -10)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="${brows[1]}" stroke="${shade(p.hair, -10)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M59 64 Q57 70 60 72" stroke="${shade(p.skin, -30)}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${mouth}
    ${hairFront(p)}
    ${em === 'sad' && id === 'colin' ? '<path d="M47 66 Q46 70 47 72" stroke="#8fb6d6" stroke-width="2" fill="none" stroke-linecap="round"/>' : ''}
  </svg>`;
}

function bookIcon() {
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Story book">
    <rect width="120" height="120" fill="#efe3c8"/>
    <path d="M22 38 C36 32 50 34 58 42 L58 90 C50 82 36 80 22 86 Z" fill="#fbf6ea" stroke="#7a5a40" stroke-width="2"/>
    <path d="M98 38 C84 32 70 34 62 42 L62 90 C70 82 84 80 98 86 Z" fill="#fbf6ea" stroke="#7a5a40" stroke-width="2"/>
    <path d="M30 48 L50 50 M30 56 L50 58 M30 64 L48 66 M70 50 L90 48 M70 58 L90 56 M72 66 L90 64" stroke="#c2a058" stroke-width="2"/>
    <path d="M60 30 C64 22 74 22 74 30 C74 36 66 38 60 44 C54 38 46 36 46 30 C46 22 56 22 60 30 Z" fill="#c97a86"/>
  </svg>`;
}

export const AVATARS = [
  { id: 1, key: 'explorer1', name: 'Explorer 1', hint: 'The Lantern Keeper' },
  { id: 2, key: 'explorer2', name: 'Explorer 2', hint: 'The Path Finder' },
  { id: 3, key: 'explorer3', name: 'Explorer 3', hint: 'The Seed Collector' }
];

export function avatarSVG(id, emotion = 'happy') {
  const a = AVATARS.find(x => x.id === Number(id)) || AVATARS[0];
  return portrait(a.key, emotion);
}

/* ---------- Plants (seed planting mini-game) ---------- */
export function plantSVG(type) {
  const stem = '<path d="M50 118 C50 96 49 80 50 62" stroke="#4f7a3a" stroke-width="4" fill="none"/>';
  switch (type) {
    case 'rose': return `<svg viewBox="0 0 100 120">${stem}
      <path d="M50 96 C38 92 32 84 32 78 C42 80 48 86 50 96Z M50 86 C62 82 68 74 68 68 C58 70 52 76 50 86Z" fill="#5b8a3e"/>
      <circle cx="50" cy="52" r="15" fill="#b54d66"/><path d="M40 50 Q50 40 60 50 Q50 58 40 50Z" fill="#d06e86"/><circle cx="50" cy="50" r="5" fill="#8f3048"/></svg>`;
    case 'sunflower': return `<svg viewBox="0 0 100 120">${stem}
      <path d="M50 100 C36 98 30 88 30 82 C42 84 48 92 50 100Z" fill="#5b8a3e"/>
      <g fill="#e2b43c">${Array.from({ length: 12 }, (_, i) => `<ellipse cx="50" cy="32" rx="5" ry="12" transform="rotate(${i * 30} 50 50)"/>`).join('')}</g>
      <circle cx="50" cy="50" r="11" fill="#6b4423"/></svg>`;
    case 'lavender': return `<svg viewBox="0 0 100 120">
      ${[-14, 0, 14].map((dx, i) => `<path d="M${50 + dx / 2} 118 C${50 + dx / 2} 96 ${50 + dx} 70 ${50 + dx} ${46 + i * 4}" stroke="#6f8f55" stroke-width="3" fill="none"/>
      ${Array.from({ length: 6 }, (_, j) => `<ellipse cx="${50 + dx}" cy="${48 + i * 4 + j * 6}" rx="4.5" ry="4" fill="${j % 2 ? '#8e78ab' : '#a28fc0'}"/>`).join('')}`).join('')}</svg>`;
    case 'fern': return `<svg viewBox="0 0 100 120">
      ${[-34, -14, 6, 26].map((rot, i) => `<g transform="rotate(${rot} 50 116)"><path d="M50 116 C50 90 50 66 50 40" stroke="#4f7a3a" stroke-width="3" fill="none"/>
      ${Array.from({ length: 7 }, (_, j) => `<ellipse cx="${j % 2 ? 56 : 44}" cy="${48 + j * 9}" rx="7" ry="3" fill="${i % 2 ? '#5f8f5a' : '#6fa064'}" transform="rotate(${j % 2 ? 25 : -25} ${j % 2 ? 56 : 44} ${48 + j * 9})"/>`).join('')}</g>`).join('')}</svg>`;
    case 'ivy': return `<svg viewBox="0 0 100 120">
      <path d="M50 118 C40 100 62 90 48 74 C38 62 58 54 50 40" stroke="#4e6b3a" stroke-width="3" fill="none"/>
      ${[[44, 100], [58, 90], [42, 80], [56, 66], [44, 54], [54, 42]].map(([x, y], i) => `<path d="M${x} ${y} l-7 -4 l3 -8 l4 4 l4 -4 l3 8 Z" fill="${i % 2 ? '#3f6b35' : '#5e7d4a'}"/>`).join('')}</svg>`;
    default: return '';
  }
}

/* ---------- Badge medal ---------- */
export function medalSVG(avatarId, label = 'Garden Keeper') {
  return `<svg viewBox="0 0 140 140" class="badge-medal" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label} badge">
    <defs>
      <radialGradient id="mg" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#fff3cf"/><stop offset=".6" stop-color="#e2c98b"/><stop offset="1" stop-color="#b08a43"/></radialGradient>
      <clipPath id="mc"><circle cx="70" cy="66" r="38"/></clipPath>
    </defs>
    <path d="M44 104 L34 136 L52 128 L60 140 L68 108 Z" fill="#b54d66"/>
    <path d="M96 104 L106 136 L88 128 L80 140 L72 108 Z" fill="#5e7d4a"/>
    ${Array.from({ length: 16 }, (_, i) => `<ellipse cx="70" cy="14" rx="7" ry="12" fill="${i % 2 ? '#6b7f45' : '#9cae8c'}" transform="rotate(${i * 22.5} 70 66)"/>`).join('')}
    <circle cx="70" cy="66" r="46" fill="url(#mg)" stroke="#8a6a2e" stroke-width="2"/>
    <circle cx="70" cy="66" r="39" fill="#e9dcc3"/>
    <g clip-path="url(#mc)"><g transform="translate(26 22) scale(.74)">${avatarSVG(avatarId).replace(/<svg[^>]*>|<\/svg>/g, '')}</g></g>
    <circle cx="70" cy="66" r="39" fill="none" stroke="#b08a43" stroke-width="2"/>
  </svg>`;
}
