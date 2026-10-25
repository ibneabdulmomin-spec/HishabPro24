import { useState } from 'react';
import { saveEntity } from './data.ts';
import type { Lang } from './i18n.ts';

const COLORS = ['#0E7A5F', '#B4452F', '#B7791F', '#3B6EA5', '#7A4FA0', '#2E8B8B'];
export function Avatar({ name, photo, size = 44 }: { name: string; photo?: string; size?: number }) {
  const c = COLORS[[...name].reduce((a, ch) => a + (ch.codePointAt(0) ?? 0), 0) % COLORS.length];
  const st = { width: size, height: size };
  return photo ? <img src={photo} alt="" style={st} className="rounded-full object-cover shrink-0" />
    : <span style={{ ...st, background: c + '22', color: c, fontSize: size * 0.42 }} className="rounded-full grid place-items-center font-semibold shrink-0">{[...name.trim()][0] ?? '?'}</span>;
}

/** Shrinks a photo to ~160px JPEG (≈20–40 KB) so it can live in the Firestore document: no paid Storage plan needed. */
export function resizePhoto(file: File, max = 160): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('IMG')); }; img.src = u;
  });
}

/** Opens WhatsApp chat with the text pre-filled; the person taps Send (fully automatic sending needs the paid Business API). */
export function waLink(phone: string, text: string): string {
  let d = phone.replace(/[০-৯]/g, (x) => String('০১২৩৪৫৬৭৮৯'.indexOf(x))).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '880' + d.slice(1);
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

type Ent = { id: string; name: string; phone?: string; photo?: string };
export function EntityHead({ e, col, uid, lang, wa }: { e: Ent; col: 'contacts' | 'businesses'; uid: string; lang: Lang; wa?: string }) {
  const bn = lang === 'bn'; const [open, setOpen] = useState(false); const [phone, setPhone] = useState(e.phone ?? ''); const [photo, setPhoto] = useState(e.photo ?? '');
  const save = async () => { await saveEntity(uid, col, { ...e, phone: phone.trim(), photo } as never); setOpen(false); };
  return <div className="space-y-2">
    <div className="flex items-center gap-3"><Avatar name={e.name} photo={e.photo} />
      <div className="flex-1 min-w-0"><div className="font-medium truncate">{e.name}</div>{e.phone && <div className="text-xs text-mute num">{e.phone}</div>}</div>
      {e.phone && wa !== undefined && <a className="btn !px-3 !py-1.5 text-xs" href={waLink(e.phone, wa)} target="_blank" rel="noreferrer" onClick={(x) => x.stopPropagation()}>WhatsApp</a>}
      <span role="button" className="btn !px-3 !py-1.5 text-xs" onClick={(x) => { x.stopPropagation(); setOpen(!open); }}>✎</span></div>
    {open && <div className="space-y-2 rounded-xl border border-line p-2" onClick={(x) => x.stopPropagation()}>
      <input className="field" inputMode="tel" placeholder={bn ? 'ফোন নম্বর (01XXXXXXXXX)' : 'Phone number'} value={phone} onChange={(x) => setPhone(x.target.value)} />
      <div className="flex items-center gap-2"><Avatar name={e.name} photo={photo} size={40} />
        <label className="btn text-xs cursor-pointer">{bn ? 'ছবি বাছুন' : 'Choose photo'}<input type="file" accept="image/*" className="hidden" onChange={async (x) => { const f = x.target.files?.[0]; if (f) setPhoto(await resizePhoto(f)); }} /></label>
        {photo && <button className="btn text-xs" onClick={() => setPhoto('')}>{bn ? 'ছবি সরান' : 'Remove'}</button>}</div>
      <button className="btn btn-primary w-full" onClick={save}>{bn ? 'সংরক্ষণ' : 'Save'}</button></div>}
  </div>;
}
