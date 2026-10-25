const FONTS = ['Hind Siliguri', 'Noto Sans Bengali', 'Anek Bangla', 'Baloo Da 2', 'Tiro Bangla'];
function apply(name: string) {
  document.documentElement.style.setProperty('--f', `'${name}'`);
  const id = 'f-' + name.replace(/\s/g, '');
  if (!document.getElementById(id)) { const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`; document.head.appendChild(l); }
}
export function currentFont(): string { const f = localStorage.getItem('hp_font') ?? FONTS[0]; apply(f); return f; }
export function nextFont(): string { const f = FONTS[(FONTS.indexOf(localStorage.getItem('hp_font') ?? FONTS[0]) + 1) % FONTS.length]; localStorage.setItem('hp_font', f); apply(f); return f; }
