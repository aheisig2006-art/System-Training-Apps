// Player characters (art: "Neon Aura Character Lineup").
// `img` is the 3:4 portrait used on the registration screen; `face` is the
// square crop used on the hunter card. Names can be changed freely: the id is what's saved.
export const CHARACTERS = [
  { id: 'c1', name: 'Hunter I',   color: '#3fa9ff', img: 'characters/hunter-1.jpg', face: 'characters/hunter-1-face.jpg' },
  { id: 'c2', name: 'Hunter II',  color: '#9b5cff', img: 'characters/hunter-2.jpg', face: 'characters/hunter-2-face.jpg' },
  { id: 'c3', name: 'Hunter III', color: '#3fa9ff', img: 'characters/hunter-3.jpg', face: 'characters/hunter-3-face.jpg' },
  { id: 'c4', name: 'Hunter IV',  color: '#9b5cff', img: 'characters/hunter-4.jpg', face: 'characters/hunter-4-face.jpg' }
];

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
