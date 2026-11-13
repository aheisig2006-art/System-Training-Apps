// Player characters (art: "Neon Aura Character Lineup").
// `img` is the 3:4 portrait used on the registration screen; `face` is the
// square crop used on the hunter card. Names can be changed freely: the id is what's saved.
// `frame` sets the electric frame colour on the system windows: 'blue' for the
// male hunters, 'purple' for the female hunters.
export const CHARACTERS = [
  { id: 'c1', name: 'Hunter I',   color: '#3fa9ff', frame: 'blue',   img: 'characters/hunter-1.jpg', face: 'characters/hunter-1-face.jpg' },
  { id: 'c2', name: 'Hunter II',  color: '#9b5cff', frame: 'purple', img: 'characters/hunter-2.jpg', face: 'characters/hunter-2-face.jpg' },
  { id: 'c3', name: 'Hunter III', color: '#3fa9ff', frame: 'blue',   img: 'characters/hunter-3.jpg', face: 'characters/hunter-3-face.jpg' },
  { id: 'c4', name: 'Hunter IV',  color: '#9b5cff', frame: 'purple', img: 'characters/hunter-4.jpg', face: 'characters/hunter-4-face.jpg' }
];

const FRAMES = {
  blue:   { color: '#3fa9ff', glow: 'rgba(63,169,255,.5)' },
  purple: { color: '#9b5cff', glow: 'rgba(155,92,255,.5)' }
};

// Sets the frame colour for every system window. No character chosen = blue.
export function applyFrame(ch) {
  const f = FRAMES[ch && ch.frame] || FRAMES.blue;
  const root = document.documentElement.style;
  root.setProperty('--frame', f.color);
  root.setProperty('--frame-glow', f.glow);
}

// size <= 120: square face crop; larger: 3:4 portrait.
export function characterArt(ch, size = 160) {
  if (!ch) return '';
  const glow = 'box-shadow:0 0 16px ' + ch.color + '66;border:1px solid ' + ch.color + 'aa;';
  if (size <= 120) {
    return '<img src="' + ch.face + '" alt="' + ch.name + '" width="' + size + '" height="' + size + '" style="display:block;object-fit:cover;border-radius:10px;' + glow + '">';
  }
  const h = Math.round(size * 4 / 3);
  return '<img src="' + ch.img + '" alt="' + ch.name + '" width="' + size + '" height="' + h + '" style="display:block;object-fit:cover;border-radius:12px;' + glow + '">';
}
