export const COLORS = [
  { id: 'blue', hex: '#2f6bff' },
  { id: 'green', hex: '#1f9d55' },
  { id: 'red', hex: '#e0463e' },
  { id: 'purple', hex: '#8a4fdb' },
  { id: 'amber', hex: '#e08a1e' },
];
export function colHex(id: string): string {
  return (COLORS.find((c) => c.id === id) || COLORS[0]).hex;
}

const AV_COLORS = ['#2f6bff', '#1f9d55', '#e0463e', '#8a4fdb', '#e08a1e', '#0aa5b5'];
export function avColor(seed: string): string {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return AV_COLORS[s % AV_COLORS.length];
}
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const MONTHS = [
  'januar', 'februar', 'marec', 'april', 'maj', 'junij',
  'julij', 'avgust', 'september', 'oktober', 'november', 'december',
];
export const DOW = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob'];
export const DOW_FULL = [
  'nedelja', 'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota',
];
export function cap(s: string): string {
  return s.replace(/^./, (c) => c.toUpperCase());
}
