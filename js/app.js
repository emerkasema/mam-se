// =====================================================================
// APLIKACE „Mám se!“ – verze 0.1 (první prototyp)
// Obsahuje: Domov, okamžitý záznam (dva kroky), uložení, pomoc
// a základní nastavení se zálohou.
//
// Jak to funguje:
//  - Každá obrazovka je jedna funkce, která vrátí HTML (text).
//  - Adresa za # určuje obrazovku: #/domov, #/zaznam, #/pomoc …
//  - Kliknutí zachytáváme na jednom místě: prvek s atributem
//    data-akce="nazev" zavolá funkci AKCE.nazev().
// =====================================================================

import * as S from './slovniky.js';
import * as U from './uloziste.js';
import { spustOslavu, ANIMACE_PODLE_SKUPINY } from './oslava.js';

const app = document.getElementById('app');

let nastaveni = null;   // nastavení načtené z telefonu
let koncept = null;     // rozepsaný záznam (zatím jen v paměti)
let posledni = null;    // naposledy uložený záznam (pro obrazovku Hotovo)
let posledniKoncept = null; // jeho rozepsaná podoba – aby šel doplnit
let doporuceniKUkazani = null; // klidná kartička po uložení, pokud se hodí
let mazaniPotvrzeni = false;   // dvoukrokové mazání všech dat
let mazaniZaznamu = null;      // id záznamu, u kterého se ptáme „opravdu smazat?“
let diktovani = null;          // běžící diktování (pokud ho telefon umí)
let diktovaniCil = null;       // do kterého pole se diktuje

// ---------------------------------------------------------------------
// Pomůcky
// ---------------------------------------------------------------------

// Bezpečné vložení textu do HTML (aby se z vlastních slov nestal kód).
function h(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Oslovení podle nastavení: tvar('byla', 'byl') → „byla/byl“, „byla“ nebo „byl“.
function tvar(zensky, muzsky) {
  if (nastaveni.tvar_osloveni === 'zensky') return zensky;
  if (nastaveni.tvar_osloveni === 'muzsky') return muzsky;
  return zensky + '/' + muzsky; // výchozí: oba tvary, ženský první
}

// Text bez háčků a čárek, malými písmeny – pro hledání slov v textu.
function bezDiakritiky(t) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function dnesniDatumText() {
  const t = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Popis času u záznamu. Večerní záznamy přesný čas nemají – patří ke dni.
function popisCasu(z) {
  if (z.typ !== 'vecerni') return casZaznamu(z.chvile_od);
  const datum = z.chvile_od.slice(0, 10);
  if (datum === U.datumDne()) return 'dnes · večerní ohlédnutí';
  const d = new Date(datum + 'T12:00:00');
  return d.getDate() + '. ' + (d.getMonth() + 1) + '. · večerní ohlédnutí';
}

function casZaznamu(iso) {
  const d = new Date(iso);
  const cas = d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  if (U.datumDne(d) === U.datumDne()) return 'dnes ' + cas;
  return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + cas;
}

function oznam(text) {
  const el = document.createElement('div');
  el.className = 'oznameni';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// Ikonky (jednoduché obrázky v SVG)
const IKONA = {
  zpet: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  srdce: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  tuzka: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3"/></svg>',
  mikrofon: '<svg class="mikrofon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  fotak: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  hvezda: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/></svg>',
  mesic: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M19 15a8 8 0 0 1-10-10 8 8 0 1 0 10 10z"/></svg>',
  galerie: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M5 18l5-5 3 3 2-2 4 4"/></svg>',
  domov: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>',
  prehled: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  nastaveni: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>'
};

// Sklenička potřeby: 0 prázdná … 4 plná; skřípnutá má větvící se prasklinu.
function sklenicka(naplneni, skripnuta) {
  const vyska = naplneni == null ? 0 : (naplneni / 4) * 44;
  const id = 'k' + Math.random().toString(36).slice(2, 8);
  const prasklina = skripnuta
    ? '<path d="M24 18L28 10L31 6M24 18L31 22L33 26M24 18L20 28L17 38L15 47M24 18L15 15L10 12" fill="none" stroke="#246B56" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M28 10L34 9M31 22L34 17M20 28L25 34L27 41M25 34L30 37M17 38L21 44M15 15L12 22M27 41L30 45M12 22L13 28" fill="none" stroke="#246B56" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/>'
    : '';
  return '<svg width="40" height="52" viewBox="0 0 44 56" aria-hidden="true">' +
    '<defs><clipPath id="' + id + '"><path d="M8 6h28l-4 46H12z"/></clipPath></defs>' +
    '<rect x="0" y="' + (52 - vyska) + '" width="44" height="' + vyska + '" fill="#E6B173" clip-path="url(#' + id + ')"/>' +
    '<path d="M8 6h28l-4 46H12z" fill="none" stroke="#246B56" stroke-width="2" stroke-linejoin="round"/>' +
    prasklina + '</svg>';
}

// Řada teček pro sílu 1–6 (u vybrané emoce nebo pocitu).
// Druhé klepnutí na stejnou tečku sílu zase vymaže.
function tecky(co, slovo, hodnota) {
  let html = '<div class="tecky" role="group" aria-label="Jak silné je ' + h(slovo) + ', od 1 do 6">';
  for (let i = 1; i <= 6; i++) {
    const plna = hodnota != null && i <= hodnota;
    html += '<button type="button" class="' + (plna ? 'plna' : '') + '" data-akce="sila" data-co="' + co +
      '" data-slovo="' + h(slovo) + '" data-hodnota="' + i + '" aria-label="' + h(slovo) + ': síla ' + i + ' ze 6' +
      '" aria-pressed="' + (hodnota === i) + '"><span></span></button>';
  }
  return html + '</div>';
}

// Čísla 0–6 pro otázky „pro výzkum“ (tady má smysl i nula = vůbec).
function cisla06(klic, text, hodnota) {
  let html = '<div class="hladiny" role="group" aria-label="' + h(text) + ' od 0 do 6">';
  for (let i = 0; i <= 6; i++) {
    html += '<button type="button" data-akce="vyzkum" data-slovo="' + klic + '" data-hodnota="' + i +
      '" aria-pressed="' + (hodnota === i) + '" aria-label="' + h(text) + ': ' + i + '">' + i + '</button>';
  }
  return html + '</div>';
}

function cip(text, zapnuto, akce, data = {}) {
  let atributy = '';
  for (const [k, v] of Object.entries(data)) atributy += ' data-' + k + '="' + h(v) + '"';
  return '<button type="button" class="cip" aria-pressed="' + !!zapnuto + '" data-akce="' + akce + '"' + atributy + '>' + h(text) + '</button>';
}

// ---------------------------------------------------------------------
// Rozepsaný záznam
// ---------------------------------------------------------------------

function novyKoncept() {
  return {
    id: U.noveId(),
    vytvoreno: U.tedS(),
    prijemnost: null,
    text: '',
    zdroj: { psano: false, diktovano: false },
    emoce: {},            // { slovo: { intenzita } }
    otevrenaZakladni: null,
    smer: null,           // u hněvu
    podTimOtevreno: false,
    podTim: [],
    vlastniEmoce: false,  // je otevřené pole pro vlastní slovo?
    telo: {},             // { pocit: { intenzita } }
    bolestUpresnit: false,
    bolestKde: [],
    bolestSlova: '',
    potreby: {},          // { potreba: { naplneni, skripnuta } }
    otevrenaSkupina: null,
    vlastniPotreba: false,
    cinnost: [],
    sKym: [],
    kde: null,
    vyzkum: {},           // { klic: 0–6 }
    fotka: null,          // zmenšená fotka (Blob) nebo nic
    typ: 'okamzity',      // 'okamzity' nebo 'vecerni'
    chvileOd: null,       // u večerních záznamů začátek dne, jinak čas vzniku
    poradi: null,         // pořadí bloku ve večerním ohlédnutí
    delkaMin: null,       // délka bloku v minutách (odhad)
    smysluplnost: null,   // „Jak smysluplné to pro Tebe bylo?“ 0–6
    strategie: '',
    prosba: ''
  };
}

function maObsah(k) {
  return k && (k.prijemnost != null || k.text.trim() || Object.keys(k.emoce).length ||
    Object.keys(k.telo).length || Object.keys(k.potreby).length || k.fotka);
}

// Z rozepsaného záznamu udělá záznam podle datového modelu.
function sestavZaznam(k) {
  const hnevNeboVztek = s => s === 'hněv' || s === 'vztek';
  const vyzkumVyplnen = Object.keys(k.vyzkum).length > 0;
  let zdroj = null;
  if (k.zdroj.psano && k.zdroj.diktovano) zdroj = 'obe';
  else if (k.zdroj.diktovano) zdroj = 'diktovano';
  else if (k.zdroj.psano) zdroj = 'psano';

  return {
    id: k.id,
    typ: k.typ || 'okamzity',
    vytvoreno: k.vytvoreno,
    upraveno: k.upraveno || null,
    chvile_od: k.chvileOd || k.vytvoreno,
    chvile_delka_min: k.delkaMin ?? null,
    poradi: k.poradi ?? null,
    smysluplnost: k.smysluplnost ?? null,
    prijemnost: k.prijemnost,
    vlastni_slova: k.text.trim(),
    emoce: Object.entries(k.emoce).filter(([slovo, v]) => !jenRozbalenaZakladni(k, slovo, v)).map(([slovo, v]) => ({
      slovo,
      zakladni: S.zakladniPro(slovo),
      intenzita: v.intenzita,
      smer: slovo === 'hněv' ? k.smer : null,
      pod_tim: hnevNeboVztek(slovo) && k.podTim.length ? k.podTim.join(', ') : null
    })),
    telo: Object.entries(k.telo).map(([pocit, v]) => ({
      pocit,
      skupina: S.skupinaTela(pocit),
      intenzita: v.intenzita,
      kde: pocit === 'bolest' && k.bolestKde.length ? k.bolestKde.join(', ') : null,
      upresneni: pocit === 'bolest' && k.bolestSlova.trim() ? k.bolestSlova.trim() : null
    })),
    potreby: Object.entries(k.potreby).map(([potreba, v]) => ({
      potreba,
      skupina: S.skupinaPotreby(potreba),
      naplneni: v.naplneni,
      skripnuta: !!v.skripnuta
    })),
    strategie: k.strategie.trim(),
    prosba: k.prosba.trim(),
    cinnost: k.cinnost,
    s_kym: k.sKym,
    kde: k.kde,
    vyzkum: vyzkumVyplnen
      ? Object.fromEntries(S.VYZKUM.map(v => [v.klic, k.vyzkum[v.klic] ?? null]))
      : null,
    zdroj_textu: zdroj,
    fotka: k.fotka || null,
    verze_protokolu: S.VERZE_PROTOKOLU
  };
}

// Základní emoce bez síly, pod kterou člověk vybral přesnější slovo,
// byla jen „rozbalená“ – přesnější slovo ji nahrazuje a do záznamu nejde.
// Obě se uloží jen tehdy, když mají obě zadanou sílu.
function jenRozbalenaZakladni(k, slovo, v) {
  if (!S.ZAKLADNI_EMOCE.includes(slovo) || v.intenzita != null) return false;
  return S.presnejsiK(slovo).some(p => k.emoce[p]);
}

// Slova ze slovníku, která aplikace poznala ve vlastním textu.
// Porovnáváme začátky slov (kmeny), takže „smutná“ najde „smutek“ jen
// částečně – proto je to vždy jen NÁVRH k potvrzení.
function poznanaSlova(text) {
  if (!text.trim()) return [];
  const t = bezDiakritiky(text);
  const tokeny = t.split(/[^a-z]+/).filter(Boolean);
  const kandidati = [...S.ZAKLADNI_EMOCE, ...S.PRESNEJSI_EMOCE.map(e => e.slovo)];
  const nalezena = [];
  for (const slovo of kandidati) {
    const norm = bezDiakritiky(slovo);
    let shoda = false;
    if (norm.includes(' ')) {
      shoda = t.includes(norm);
    } else {
      const kmen = norm.slice(0, Math.max(4, norm.length - 2));
      shoda = tokeny.some(tk => tk.startsWith(kmen));
    }
    if (shoda && !koncept.emoce[slovo]) nalezena.push(slovo);
  }
  return nalezena;
}

// ---------------------------------------------------------------------
// OBRAZOVKY
// ---------------------------------------------------------------------

function navigace(aktivni) {
  return '<nav class="navigace" aria-label="Hlavní navigace">' +
    '<a href="#/domov"' + (aktivni === 'domov' ? ' aria-current="page"' : '') + '>' + IKONA.domov + 'Domov</a>' +
    '<a href="#/prehled"' + (aktivni === 'prehled' ? ' aria-current="page"' : '') + '>' + IKONA.prehled + 'Přehled</a>' +
    '<a href="#/nastaveni"' + (aktivni === 'nastaveni' ? ' aria-current="page"' : '') + '>' + IKONA.nastaveni + 'Nastavení</a>' +
    '</nav>';
}

// ---------------- SEZNAM ZÁZNAMŮ ----------------

// Krátký popis záznamu ze všeho, co v něm je. „beze slov“ jen tehdy,
// když opravdu není co ukázat.
function shrnutiZaznamu(z) {
  const casti = [];
  if (z.typ === 'oslava') {
    return ['oslava: ' + (z.vlastni_slova || z.potreby.map(p => p.potreba).join(', ') || 'beze slov'),
      z.podekovani ? 'díky: ' + z.podekovani : ''].filter(Boolean).join(' · ');
  }
  const blok = z.typ === 'vecerni' && z.poradi != null;
  if (blok) casti.push(z.popis_bloku || (z.cinnost || []).join(' + '));
  if (z.emoce.length) casti.push(z.emoce.map(e => e.slovo + (e.intenzita != null ? ' ' + e.intenzita : '')).join(', '));
  if (z.vlastni_slova) casti.push(z.vlastni_slova.length > 80 ? z.vlastni_slova.slice(0, 80) + '…' : z.vlastni_slova);
  if (z.telo.length) casti.push('tělo: ' + z.telo.map(t => t.pocit).join(', '));
  if (z.potreby.length) casti.push('potřeby: ' + z.potreby.map(p => p.potreba).join(', '));
  if (!blok && (z.cinnost || []).length) casti.push(z.cinnost.join(', '));
  if (z.strategie) casti.push('co by pomohlo: ' + z.strategie);
  if (z.prosba) casti.push('prosba: ' + z.prosba);
  if (z.vyzkum) casti.push('otázky pro výzkum');
  const text = casti.filter(Boolean).join(' · ');
  if (!text && z.fotka) return 'fotka';
  return text || 'beze slov';
}

// Seskupí večerní záznamy podle dne do jednoho balíčku; okamžité zůstanou samostatně.
function polozkySeznamu(zaznamy, tydny = []) {
  const polozky = tydny.map(t => ({ druh: 'tyden', t, kdy: t.upraveno || t.vytvoreno || rozsahTydne(t.tyden).do + 'T23:59:00' })), vecery = new Map();
  for (const z of zaznamy) {
    if (z.typ !== 'vecerni') { polozky.push({ druh: 'zaznam', z, kdy: z.upraveno || z.vytvoreno }); continue; }
    const datum = z.chvile_od.slice(0, 10);
    if (!vecery.has(datum)) {
      const balicek = { druh: 'vecer', datum, zaznamy: [], kdy: '' };
      vecery.set(datum, balicek);
      polozky.push(balicek);
    }
    const b = vecery.get(datum);
    b.zaznamy.push(z);
    const k = z.upraveno || z.vytvoreno;
    if (k > b.kdy) b.kdy = k;
  }
  return polozky.sort((a, b) => b.kdy.localeCompare(a.kdy));
}

function znamkaPrijemnosti(p) {
  const trida = p == null ? '' : p > 0 ? ' prijemna' : p < 0 ? ' neprijemna' : '';
  return '<span class="znamka' + trida + '" aria-label="Příjemnost ' + (p ?? 'nevyplněna') + '">' + (p == null ? '–' : p > 0 ? '+' + p : p) + '</span>';
}

function radekSeznamu(polozka) {
  if (polozka.druh === 'zaznam') {
    const z = polozka.z;
    return '<a class="zaznam-radek" href="#/detail/' + encodeURIComponent(z.id) + '">' +
      (z.typ === 'oslava' ? '<span class="znamka oslava" aria-label="Oslava">' + IKONA.hvezda + '</span>' : znamkaPrijemnosti(z.prijemnost)) +
      '<div><div class="tlumene male">' + popisCasu(z) + '</div><div>' + h(shrnutiZaznamu(z)) + '</div></div>' +
      (z.fotka ? '<img class="miniatura" src="' + urlFotky(z.fotka) + '" alt="">' : '<span class="sipka" aria-hidden="true">›</span>') + '</a>';
  }
  if (polozka.druh === 'tyden') {
    const t = polozka.t, r = rozsahTydne(t.tyden);
    const casti = [];
    if (t.podily) casti.push('příjemný čas ' + t.podily.prijemny + ' %');
    if (t.who5) casti.push('pohoda ' + t.who5.index + '/100');
    const text = t.vzpominka || t.tema || t.dal || '';
    return '<a class="zaznam-radek" href="#/tyden/' + t.tyden + '">' +
      '<span class="znamka" aria-hidden="true"' + (t.barva ? ' style="background:' + t.barva + ';color:' + inkoustPro(t.barva) + '"' : '') + '>' + IKONA.prehled + '</span>' +
      '<div><div class="tlumene male">' + h(r.text) + ' · týdenní ohlédnutí</div>' +
      '<div>' + h(text || casti.join(' · ') || 'beze slov') + '</div>' +
      (text && casti.length ? '<div class="tlumene male">' + h(casti.join(' · ')) + '</div>' : '') + '</div>' +
      '<span class="sipka" aria-hidden="true">›</span></a>';
  }
  // Balíček večerního ohlédnutí: aktivity pod sebou
  const bloky = polozka.zaznamy.filter(z => z.poradi != null).sort((a, b) => a.poradi - b.poradi);
  const doplneni = polozka.zaznamy.filter(z => z.poradi == null);
  const d = new Date(polozka.datum + 'T12:00:00');
  const kdy = polozka.datum === U.datumDne() ? 'dnes' : d.getDate() + '. ' + (d.getMonth() + 1) + '.';
  const radky = bloky.map(z => '<li>' + h(z.popis_bloku || (z.cinnost || []).join(' + ') || 'blok') +
    (z.chvile_delka_min ? ' <span class="tlumene">· ' + h(delkaText(z.chvile_delka_min)) + '</span>' : '') +
    (z.prijemnost != null ? ' <span class="tlumene">· ' + (z.prijemnost > 0 ? '+' + z.prijemnost : z.prijemnost) + '</span>' : '') + '</li>').join('') +
    doplneni.map(z => '<li class="tlumene">' + h(shrnutiZaznamu(z)) + '</li>').join('');
  return '<a class="zaznam-radek" href="#/vecer/' + polozka.datum + '"><span class="znamka" aria-hidden="true">' + IKONA.mesic + '</span>' +
    '<div><div class="tlumene male">' + kdy + ' · večerní ohlédnutí</div><ul class="balicek">' + radky + '</ul></div>' +
    '<span class="sipka" aria-hidden="true">›</span></a>';
}

// ---------------- DOMOV ----------------
function nazevTydne(pondeli) {
  if (posunTydne === 0) return 'Tento týden';
  if (posunTydne === -1) return 'Minulý týden';
  const ne = new Date(pondeli); ne.setDate(pondeli.getDate() + 6);
  return pondeli.getDate() + '. ' + (pondeli.getMonth() + 1) + '. – ' + ne.getDate() + '. ' + (ne.getMonth() + 1) + '.';
}

async function obrazovkaDomov() {
  const vse = (await U.vsechnyZaznamy()).sort((a, b) => (b.upraveno || b.vytvoreno).localeCompare(a.upraveno || a.vytvoreno));

  const denVecera = await denKOhlednuti();
  const jeVcera = denVecera !== denOhlednuti();
  const dnesDen = await U.nactiDen(denVecera);
  const dnesVecer = !!(dnesDen && dnesDen.vecerni_hotovo);

  // Tento týden (pondělí až neděle)
  const dnes = new Date();
  const pondeli = new Date(dnes);
  pondeli.setHours(0, 0, 0, 0);
  pondeli.setDate(dnes.getDate() - ((dnes.getDay() + 6) % 7) + 7 * posunTydne);
  const zkratky = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
  let tydenHtml = '';
  for (let i = 0; i < 7; i++) {
    const den = new Date(pondeli);
    den.setDate(pondeli.getDate() + i);
    const datum = U.datumDne(den);
    const pocet = vse.filter(z => z.chvile_od.slice(0, 10) === datum).length;
    const jeDnes = datum === U.datumDne();
    const budouci = datum > U.datumDne();
    const den_ = await U.nactiDen(datum);
    const barva = nastaveni.barva_dne_zapnuta && den_ && den_.barva;
    let styl = '';
    if (barva) styl = ' style="background:' + barva + ';color:' + inkoustPro(barva) + ';border-color:' + barva + '"';
    else if (pocet) styl = ' style="background: var(--jemna-zelena)"';
    const popisek = zkratky[i] + ' ' + den.getDate() + '. ' + (den.getMonth() + 1) + '.: ' + pocet + ' záznamů' + (barva ? ', barva dne' : '');
    tydenHtml += budouci
      ? '<div class="den"><span class="kolecko" aria-label="' + popisek + '"></span>' + zkratky[i] + '</div>'
      : '<a class="den' + (jeDnes ? ' dnes' : '') + '" href="' + (den_ && den_.vecerni_hotovo ? '#/vecer/' : '#/den/') + datum + '"><span class="kolecko"' + styl +
        ' aria-label="' + popisek + '">' + (pocet || '') + '</span>' + zkratky[i] + '</a>';
  }

  // Týdenní ohlédnutí: nabídka jednou týdně (v neděli za tento týden, jinak za minulý),
  // jen když v tom týdnu nějaké záznamy jsou a ohlédnutí ještě není hotové ani odložené.
  const kodT = tydenKOhlednuti();
  const ulozT = await U.nactiTyden(kodT);
  const rT = rozsahTydne(kodT);
  const maZaznamy = vse.some(z => { const d = z.chvile_od.slice(0, 10); return d >= rT.od && d <= rT.do; });
  const kartaTydne = maZaznamy && !(ulozT && (ulozT.vyplneno || ulozT.odlozeno))
    ? '<section class="karta"><div class="karta-radek"><h2>Týdenní ohlédnutí</h2><span class="tlumene">' + h(rT.text) + '</span></div>' +
      '<p class="tlumene">Jaký byl Tvůj týden?</p>' +
      '<div class="odkazy"><a class="tlacitko jemne" href="#/tyden/' + kodT + '">Začít</a>' +
      '<button type="button" class="tlacitko obrys male-t" data-akce="tydenOdlozit">Tento týden ne</button></div></section>'
    : '';

  // Posledních pět položek. Večerní ohlédnutí jednoho dne = jeden balíček.
  const tydny = (await U.vsechnyTydny()).filter(t => t.vyplneno);
  const seznam = polozkySeznamu(vse, tydny).slice(0, 5).map(radekSeznamu).join('');

  const rozepsano = maObsah(koncept) && !koncept.ulozeno
    ? '<a class="tlacitko jemne" href="#/zaznam">Pokračovat v rozepsaném záznamu</a>' : '';

  return '<header class="hlavicka"><div class="znacka"><img src="ikony/logo.svg" alt="">Mám se!</div>' +
    '<a class="ikona-tlacitko" href="#/nastaveni" aria-label="Nastavení">' + IKONA.nastaveni + '</a></header>' +
    '<main class="obsah">' +
    '<div><p class="tlumene">' + dnesniDatumText() + '</p><h1>Jak se máš?</h1></div>' +
    '<a class="karta-hlavni" href="#/zaznam" data-akce="novyZaznam">' +
      '<span class="titulek">V tuto chvíli…</span>' +
      '<span class="popis">Napiš nebo nadiktuj, co je teď živé. Kdykoli!</span>' +
      '<span class="tlacitko svetle"><span class="ikony">' + IKONA.tuzka + IKONA.mikrofon + '</span>Zaznamenat</span>' +
    '</a>' + rozepsano +
    '<a class="tlacitko-pomoc" href="#/pomoc">' + IKONA.srdce + 'Potřebuju pomoc</a>' +
    '<section class="karta"><div class="karta-radek"><h2>Večerní ohlédnutí</h2><span class="tlumene">v ' + h(nastaveni.pripominka_cas) + '</span></div>' +
      '<p class="tlumene">' + (jeVcera ? 'Jaký byl včerejší den? Ohlédnutí ještě není hotové.' : dnesVecer ? 'Dnešní ohlédnutí je hotové. Můžeš ho kdykoli doplnit.' : 'Jaký byl Tvůj den?') + '</p>' +
      '<a class="tlacitko jemne" style="align-self:flex-start" href="#/vecer">' + (dnesVecer ? 'Upravit ohlédnutí' : 'Začít ohlédnutí') + '</a></section>' +
    kartaTydne +
    '<section class="karta"><div class="karta-radek prehled-tydnu">' +
      '<button type="button" class="ikona-tlacitko bez-okraje" data-akce="tydenPosun" data-smer="-1" aria-label="Předchozí týden">‹</button>' +
      '<h2>' + nazevTydne(pondeli) + '</h2>' +
      '<button type="button" class="ikona-tlacitko bez-okraje" data-akce="tydenPosun" data-smer="1" aria-label="Další týden"' + (posunTydne >= 0 ? ' disabled' : '') + '>›</button>' +
    '</div><div class="tyden" data-tyden-swipe="1">' + tydenHtml + '</div>' +
      '<p class="tlumene male">Šipkami nebo přejetím prstem se dostaneš do starších týdnů. Číslo v kolečku je počet záznamů. Klepnutím na den otevřeš jeho ohlédnutí' + (nastaveni.barva_dne_zapnuta ? ', u dne bez ohlédnutí zvolíš barvu.' : '.') + '</p></section>' +
    (seznam ? '<section class="seznam" aria-label="Poslední záznamy"><h2>Poslední záznamy</h2>' + seznam + '</section>' : '') +
    '</main>' + navigace('domov');
}

// ---------------- OKAMŽITÝ ZÁZNAM – krok 1 ----------------
function obrazovkaZaznam() {
  if (!koncept) koncept = novyKoncept();
  const k = koncept;

  // Škála −3 až +3
  let skala = '';
  for (let v = -3; v <= 3; v++) {
    skala += '<button type="button" data-akce="prijemnost" data-hodnota="' + v + '" aria-pressed="' + (k.prijemnost === v) +
      '" aria-label="Hodnota ' + v + '">' + (v > 0 ? '+' + v : v) + '</button>';
  }

  // Základní emoce jako čipy
  let zakladni = '';
  for (const e of S.ZAKLADNI_EMOCE) {
    zakladni += cip(e, k.emoce[e] || k.otevrenaZakladni === e, 'zakladni', { slovo: e });
  }
  zakladni += '<button type="button" class="cip pridat" data-akce="vlastniEmoceOtevrit">+ vlastní slovo</button>';
  zakladni += '<button type="button" class="cip pridat" data-akce="vicNavrhu" aria-expanded="' + !!k.vicNavrhu + '">' +
    (k.vicNavrhu ? '− méně návrhů' : '+ víc návrhů') + '</button>';

  // Přesnější slova u otevřené základní emoce
  let presnejsi = '';
  if (k.otevrenaZakladni) {
    const slova = S.presnejsiK(k.otevrenaZakladni);
    if (slova.length) {
      presnejsi = '<div class="panel"><span class="panel-nadpis">Přesnější slova u „' + h(k.otevrenaZakladni) + '“</span><div class="cipy">' +
        slova.map(s => cip(s, k.emoce[s], 'emoce', { slovo: s })).join('') + '</div></div>';
    }
  }

  // Všechna přesnější slova najednou (seřazená podle základní emoce, ke které patří)
  if (k.vicNavrhu) {
    const poradi = e => S.ZAKLADNI_EMOCE.indexOf(e.blizko[0]);
    const vsechna = [...S.PRESNEJSI_EMOCE].sort((a, b) => poradi(a) - poradi(b)).map(e => e.slovo)
      .filter(sl => !(k.otevrenaZakladni && S.presnejsiK(k.otevrenaZakladni).includes(sl)));
    presnejsi += '<div class="panel"><span class="panel-nadpis">Další návrhy</span><div class="cipy">' +
      vsechna.map(sl => cip(sl, k.emoce[sl], 'emoce', { slovo: sl })).join('') + '</div></div>';
  }

  const vlastni = k.vlastniEmoce
    ? '<div class="pole-radek"><input class="vstup" id="vlastni-emoce" placeholder="Tvoje slovo pro to, co cítíš" autocomplete="off">' +
      '<button type="button" class="tlacitko male-t" data-akce="vlastniEmocePridat">Přidat</button></div>' : '';

  // Vybrané emoce se sílou
  let vybrane = '';
  for (const [slovo, v] of Object.entries(k.emoce)) {
    vybrane += editorSlova('emoce', slovo) ||
      ('<div class="vybrana-polozka"><span class="jmeno" data-dlouze="emoce" data-slovo="' + h(slovo) + '">' + h(slovo) + '</span>' + tecky('emoce', slovo, v.intenzita) + '</div>');
  }

  // Hněv a vztek: volitelné doplňující otázky
  let hnev = '';
  if (k.emoce['hněv'] || k.emoce['vztek']) {
    hnev = '<div class="panel">';
    if (k.emoce['hněv']) {
      hnev += '<span class="panel-nadpis">Na koho nebo na co? (nepovinné)</span><div class="cipy">' +
        S.SMER_HNEVU.map(s => cip(s.text, k.smer === s.kod, 'smer', { kod: s.kod })).join('') + '</div>';
    }
    if (!k.podTimOtevreno) {
      hnev += '<button type="button" class="tlacitko obrys male-t" style="align-self:flex-start" data-akce="podTimOtevrit">Je pod tím ještě něco dalšího?</button>';
    } else {
      const ostatni = S.ZAKLADNI_EMOCE.filter(e => e !== 'hněv' && e !== 'vztek');
      hnev += '<span class="panel-nadpis">Je pod tím ještě něco dalšího? Klidně nic.</span><div class="cipy">' +
        ostatni.map(e => cip(e, k.podTim.includes(e), 'podTim', { slovo: e })).join('') + '</div>';
    }
    hnev += '</div>';
  }

  const umiDiktovat = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const diktTlacitko = tlacitkoDiktovani('text');

  return '<header class="hlavicka">' +
      '<a class="ikona-tlacitko bez-okraje" href="#/domov" aria-label="Zpět na Domov">' + IKONA.zpet + '</a>' +
      '<span class="nazev-obrazovky">Jak se mám?</span>' +
      '<a class="tlacitko obrys male-t" href="#/pomoc">' + IKONA.srdce + 'Pomoc</a>' +
    '</header>' +
    '<main class="obsah">' +
      '<section style="display:flex;flex-direction:column;gap:12px">' +
        '<h1 style="font-size:24px">Jaká je pro Tebe tahle chvíle?</h1>' +
        '<div class="skala" role="group" aria-label="Od −3 velmi nepříjemná do +3 velmi příjemná">' + skala + '</div>' +
        '<div class="skala-popisky"><span>velmi nepříjemná</span><span>ani tak, ani tak</span><span>velmi příjemná</span></div>' +
      '</section>' +
      '<section style="display:flex;flex-direction:column;gap:12px">' +
        '<label for="text" style="font-family:var(--nadpisy);font-size:24px">Co tak zhruba cítíš?</label>' +
        '<div class="pole">' +
          '<textarea id="text" rows="4" placeholder="Napiš nebo nadiktuj, co je teď živé…">' + h(k.text) + '</textarea>' +
          '<div class="pole-radek"><span class="tlumene male">' +
            (umiDiktovat ? 'Diktování zpracovává Google. Můžeš použít i mikrofon na klávesnici.' : 'Diktovat můžeš mikrofonem na klávesnici.') +
          '</span>' + diktTlacitko + '</div>' +
        '</div>' +
        blokFotky(k) +
        '<div id="poznana"></div>' +
        '<p class="tlumene">Nebo vyber z návrhů:</p>' +
        '<div class="cipy">' + zakladni + '</div>' + vlastni + presnejsi +
        (vybrane ? '<div class="vybrane" aria-label="Vybrané emoce a jejich síla">' + vybrane + '</div><p class="tlumene male">Dlouhým podržením slova ho změníš nebo odstraníš.</p>' : '') +
        hnev +
      '</section>' +
    '</main>' +
    '<footer class="spodni-lista">' +
      '<button type="button" class="tlacitko obrys" data-akce="ulozit">Takhle to stačí</button>' +
      '<a class="tlacitko" href="#/zaznam-dal">Chci pokračovat</a>' +
    '</footer>';
}

// Část pod textem: slova, která aplikace poznala (překreslí se při psaní).
function vykresliPoznana() {
  const misto = document.getElementById('poznana');
  if (!misto || !koncept) return;
  const slova = poznanaSlova(koncept.text);
  misto.innerHTML = slova.length
    ? '<div class="panel"><span class="panel-nadpis">Poznávám ve Tvých slovech. Sedí to? Klepni pro přidání:</span><div class="cipy">' +
      slova.map(s => '<button type="button" class="cip navrh" data-akce="emoce" data-slovo="' + h(s) + '">+ ' + h(s) + '</button>').join('') +
      '</div></div>'
    : '';
}

// Kam vede „Zpět“ z druhého kroku: do večerního ohlédnutí, na Hotovo, nebo na krok 1.
function zpetZDruheho(k) {
  if (k.typ === 'vecerni' && vecer) return '#/vecer/' + vecer.datum;
  if (k.fokus) return '#/hotovo';
  return '#/zaznam';
}

// ---------------- OKAMŽITÝ ZÁZNAM – krok 2 ----------------
function obrazovkaZaznamDal() {
  if (!koncept) koncept = novyKoncept();
  const k = koncept;

  // Tělo
  let telo = '';
  for (const g of S.TELO) {
    telo += '<div style="display:flex;flex-direction:column;gap:6px"><span class="panel-nadpis">' + h(g.skupina) + '</span><div class="cipy">' +
      g.pocity.map(p => cip(p, k.telo[p], 'telo', { slovo: p })).join('') + '</div></div>';
  }
  let teloVybrane = '';
  for (const [pocit, v] of Object.entries(k.telo)) {
    teloVybrane += '<div class="vybrana-polozka"><span class="jmeno">' + h(pocit) + '</span>' + tecky('telo', pocit, v.intenzita) + '</div>';
  }
  let bolest = '';
  if (k.telo['bolest']) {
    bolest = '<div class="panel">';
    if (!k.bolestUpresnit) {
      bolest += '<button type="button" class="tlacitko obrys male-t" style="align-self:flex-start" data-akce="bolestUpresnit">Chceš to upřesnit?</button>';
    } else {
      bolest += '<span class="panel-nadpis">Kde? (můžeš vybrat víc míst)</span><div class="cipy">' +
        S.MISTA_NA_TELE.map(m => cip(m, k.bolestKde.includes(m), 'bolestKde', { misto: m })).join('') + '</div>' +
        '<label class="panel-nadpis" for="bolest-slova">Co a jak bolí – vlastními slovy</label>' +
        poleSDiktovanim('bolestSlova', 'Co a jak bolí');
    }
    bolest += '</div>';
  }

  // Potřeby
  let skupiny = '';
  for (const g of S.POTREBY) {
    const maVybrane = g.potreby.some(p => k.potreby[p]);
    skupiny += cip(g.skupina, k.otevrenaSkupina === g.skupina || maVybrane, 'skupinaPotreb', { skupina: g.skupina });
  }
  skupiny += '<button type="button" class="cip pridat" data-akce="vlastniPotrebaOtevrit">+ vlastní</button>';
  let potrebyPanel = '';
  if (k.otevrenaSkupina) {
    const g = S.POTREBY.find(x => x.skupina === k.otevrenaSkupina);
    potrebyPanel = '<div class="panel"><span class="panel-nadpis">Potřeby ve skupině „' + h(g.skupina) + '“</span><div class="cipy">' +
      g.potreby.map(p => cip(p, k.potreby[p], 'potreba', { slovo: p })).join('') + '</div></div>';
  }
  const vlastniPotreba = k.vlastniPotreba
    ? '<div class="pole-radek"><input class="vstup" id="vlastni-potreba" placeholder="Tvoje slovo pro potřebu" autocomplete="off">' +
      '<button type="button" class="tlacitko male-t" data-akce="vlastniPotrebaPridat">Přidat</button></div>' : '';
  let sklenicky = '';
  for (const [potreba, v] of Object.entries(k.potreby)) {
    let hladiny = '';
    for (let i = 0; i <= 4; i++) {
      hladiny += '<button type="button" data-akce="naplneni" data-slovo="' + h(potreba) + '" data-hodnota="' + i +
        '" aria-pressed="' + (v.naplneni === i) + '" aria-label="' + h(potreba) + ': naplnění ' + i + ' ze 4">' + i + '</button>';
    }
    const editor = editorSlova('potreby', potreba);
    if (editor) { sklenicky += editor; continue; }
    sklenicky += '<div class="sklenicka-radek">' + sklenicka(v.naplneni, v.skripnuta) +
      '<span class="jmeno" data-dlouze="potreby" data-slovo="' + h(potreba) + '">' + h(potreba) + '</span>' +
      '<div class="sklenicka-ovladani"><div class="hladiny" role="group" aria-label="Kolik je ve skleničce">' + hladiny + '</div>' +
      '<label class="prepinac-maly"><input type="checkbox" data-akce="skripnuta" data-slovo="' + h(potreba) + '"' +
      (v.skripnuta ? ' checked' : '') + '>skřípnutá</label></div></div>';
  }

  // Kontext
  const cinnosti = S.CINNOSTI.map(c => cip(c, k.cinnost.includes(c), 'cinnost', { slovo: c })).join('');
  const skym = S.S_KYM.map(c => cip(c, k.sKym.includes(c), 'skym', { slovo: c })).join('');
  const kde = S.KDE.map(c => cip(c, k.kde === c, 'kde', { slovo: c })).join('');

  // Pro výzkum
  let vyzkum = '';
  for (const v of S.VYZKUM) {
    vyzkum += '<div class="vybrana-polozka"><span class="jmeno">' + h(v.text) + '</span>' + cisla06(v.klic, v.text, k.vyzkum[v.klic]) + '</div>';
  }

  return '<header class="hlavicka">' +
      '<a class="ikona-tlacitko bez-okraje" href="' + zpetZDruheho(k) + '" aria-label="Zpět">' + IKONA.zpet + '</a>' +
      '<span class="nazev-obrazovky">Jak se mám? · víc</span>' +
      '<a class="tlacitko obrys male-t" href="#/pomoc">' + IKONA.srdce + 'Pomoc</a>' +
    '</header>' +
    '<main class="obsah">' +
      (k.fokus ? '' : '<p class="tlumene">Všechno tady je nepovinné. Vyplň, co Ti dává smysl.</p>') +
      vyberCasti(k, [
        ['telo', Object.keys(k.telo).length, 'Co cítíš v těle?',
          telo + (teloVybrane ? '<div class="vybrane">' + teloVybrane + '</div>' : '') + bolest],
        ['potreby', Object.keys(k.potreby).length || k.otevrenaSkupina || k.vlastniPotreba, 'Co je teď živé? (potřeby)',
          '<p class="tlumene male">Návrhy podle Max-Neefa. Sklenička ukazuje, kolik té potřeby teď máš: 0 prázdná, 4 plná. Skřípnutá potřeba dostane prasklinu – i plná sklenička může prasknout.</p>' +
          '<div class="cipy">' + skupiny + '</div>' + vlastniPotreba + potrebyPanel +
          (sklenicky ? '<div class="vybrane">' + sklenicky + '</div><p class="tlumene male">Dlouhým podržením názvu potřebu změníš nebo odstraníš.</p>' : '')],
        ['kolem', k.cinnost.length || k.sKym.length || k.kde, 'Co se teď děje?',
          '<div class="oddil"><h3 class="oddil-nadpis">Co právě děláš?</h3><div class="cipy">' + cinnosti + '</div></div>' +
          '<div class="oddil"><h3 class="oddil-nadpis">S kým?</h3><div class="cipy">' + skym + '</div></div>' +
          '<div class="oddil"><h3 class="oddil-nadpis">Kde?</h3><div class="cipy">' + kde + '</div></div>'],
        ['pomuze', k.strategie || k.prosba, 'Co by Ti teď mohlo udělat dobře?',
          poleSDiktovanim('strategie', 'Co by Ti teď mohlo udělat dobře?', 'Třeba procházka, napsat kamarádce, chvíli ticha…') +
          '<label class="panel-nadpis" for="prosba">Chceš o něco konkrétního požádat – sebe nebo někoho jiného?</label>' +
          poleSDiktovanim('prosba', 'Prosba')],
        ['vyzkum', Object.keys(k.vyzkum).length, 'Pro výzkum (nepovinné)',
          '<p class="tlumene male">Devět stejných otázek pokaždé – z nich se počítá klasický U-index. Jak moc teď cítíš… (0 vůbec, 6 velmi silně). Druhé klepnutí odpověď zruší.</p>' +
          '<div class="vybrane">' + vyzkum + '</div>']
      ]) +
    '</main>' +
    '<footer class="spodni-lista">' +
      '<a class="tlacitko obrys" href="' + zpetZDruheho(k) + '">Zpět</a>' +
      '<button type="button" class="tlacitko" data-akce="ulozit">Uložit</button>' +
    '</footer>';
}

// ---------------- DIKTOVÁNÍ ----------------
// Diktovat jde do každého většího pole. „cil“ je název pole v konceptu
// (text, strategie, prosba, bolestSlova) a zároveň určuje, do kterého
// políčka na obrazovce se slova vepíšou.
const ID_POLE = { text: 'text', strategie: 'pole-strategie', prosba: 'prosba', bolestSlova: 'bolest-slova' };

function tlacitkoDiktovani(cil) {
  if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) return '';
  const bezi = diktovani && diktovaniCil === cil;
  return '<button type="button" class="tlacitko obrys male-t" data-akce="diktovat" data-cil="' + cil + '">' +
    IKONA.mikrofon + (bezi ? 'Poslouchám… klepni pro konec' : 'Diktovat') + '</button>';
}

// Cíl „blok:3“ = vlastní slova ke třetímu bloku večerního ohlédnutí.
function hodnotaCile(cil) {
  if (cil === 'oslavaText') return oslava.text;
  if (cil === 'oslavaDik') return oslava.podekovani;
  if (cil === 'prosbaText') return prosba.text;
  if (cil.startsWith('tyden:')) return tyden[cil.slice(6)];
  if (cil === 'blokpopis') return vecer.rozpracovany.popis;
  if (cil.startsWith('blok:')) return vecer.bloky[+cil.slice(5)].text;
  return koncept[cil];
}
function nastavCil(cil, text) {
  if (cil === 'oslavaText') oslava.text = text;
  else if (cil === 'oslavaDik') oslava.podekovani = text;
  else if (cil === 'prosbaText') prosba.text = text;
  else if (cil.startsWith('tyden:')) tyden[cil.slice(6)] = text;
  else if (cil === 'blokpopis') vecer.rozpracovany.popis = text;
  else if (cil.startsWith('blok:')) vecer.bloky[+cil.slice(5)].text = text;
  else koncept[cil] = text;
}
function idPoleCile(cil) {
  if (cil === 'blokpopis') return 'blok-popis';
  if (cil === 'oslavaText') return 'oslava-text';
  if (cil === 'oslavaDik') return 'oslava-dik';
  if (cil === 'prosbaText') return 'prosba-text';
  if (cil.startsWith('tyden:')) return 'tyden-' + cil.slice(6);
  return cil.startsWith('blok:') ? 'blok-text-' + cil.slice(5) : ID_POLE[cil];
}

// Pole pro psaní s tlačítkem Diktovat pod ním.
function poleSDiktovanim(cil, popisek, placeholder, radku = 2) {
  return '<div class="pole"><textarea id="' + ID_POLE[cil] + '" rows="' + radku + '" data-pole="' + cil + '" aria-label="' + h(popisek) + '"' +
    (placeholder ? ' placeholder="' + h(placeholder) + '"' : '') + '>' + h(koncept[cil]) + '</textarea>' +
    (tlacitkoDiktovani(cil) ? '<div class="pole-radek"><span></span>' + tlacitkoDiktovani(cil) + '</div>' : '') + '</div>';
}

// ---------------- ÚPRAVA SLOVA (dlouhé podržení) ----------------
// Když se do vybraných slov dostane překlep, dlouhým podržením se
// slovo otevře k přepsání nebo odstranění.

function editorSlova(co, slovo) {
  const u = koncept && koncept.upravuji;
  if (!u || u.co !== co || u.slovo !== slovo) return '';
  return '<div class="panel" role="group" aria-label="Upravit slovo">' +
    '<label class="panel-nadpis" for="uprava-slova">Změnit nebo odstranit</label>' +
    '<input class="vstup" id="uprava-slova" value="' + h(slovo) + '" autocomplete="off">' +
    '<div class="odkazy"><button type="button" class="tlacitko male-t" data-akce="slovoUlozit">Uložit</button>' +
    '<button type="button" class="tlacitko obrys male-t" data-akce="slovoOdstranit">Odstranit</button>' +
    '<button type="button" class="tlacitko obrys male-t" data-akce="slovoZrusit">Zrušit</button></div></div>';
}

// Přejmenuje klíč v objektu a zachová pořadí i hodnotu.
function prejmenujKlic(obj, stary, novy) {
  const vysledek = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === stary) { if (!(novy in obj) || novy === stary) vysledek[novy] = v; }
    else vysledek[k] = v;
  }
  return vysledek;
}

// ---------------- FOTKA ----------------
// Fotka se jen ukládá a ukazuje, nic se z ní nevyhodnocuje.
// Před uložením ji zmenšíme (šetří místo v telefonu) a tím se z ní
// zároveň odstraní skryté údaje, třeba místo, kde byla pořízena.

const MAX_STRANA = 1280;
const urlCache = new WeakMap(); // abychom pro stejnou fotku nedělali adresu pořád znovu

function urlFotky(blob) {
  if (!urlCache.has(blob)) urlCache.set(blob, URL.createObjectURL(blob));
  return urlCache.get(blob);
}

async function zmensiFotku(soubor) {
  const obrazek = await createImageBitmap(soubor, { imageOrientation: 'from-image' });
  const pomer = Math.min(1, MAX_STRANA / Math.max(obrazek.width, obrazek.height));
  const platno = document.createElement('canvas');
  platno.width = Math.round(obrazek.width * pomer);
  platno.height = Math.round(obrazek.height * pomer);
  platno.getContext('2d').drawImage(obrazek, 0, 0, platno.width, platno.height);
  return new Promise(hotovo => platno.toBlob(hotovo, 'image/jpeg', 0.82));
}

function blokFotky(k) {
  if (k.fotka) {
    return '<div class="fotka-nahled"><img src="' + urlFotky(k.fotka) + '" alt="Připojená fotka">' +
      '<button type="button" class="tlacitko obrys male-t" data-akce="fotkaOdebrat">Odebrat fotku</button></div>';
  }
  // „Pořídit fotku“ otevře rovnou foťák, „Vybrat z galerie“ uložené fotky.
  return '<div class="odkazy">' +
    '<label class="tlacitko obrys male-t" style="cursor:pointer">' + IKONA.fotak + 'Pořídit fotku' +
      '<input type="file" accept="image/*" capture="environment" data-akce="fotkaPridat" class="skryte"></label>' +
    '<label class="tlacitko obrys male-t" style="cursor:pointer">' + IKONA.galerie + 'Vybrat z galerie' +
      '<input type="file" accept="image/*" data-akce="fotkaPridat" class="skryte"></label>' +
    '</div>';
}

// ---------------- DEN (barva dne a záznamy toho dne) ----------------

// Nabídka barev. Jsou tu světlé i tmavé – písmo se přizpůsobí samo.
const BARVY_DNE = [
  '#246B56', '#72B97F', '#CFE3D6', '#3E6B5A',
  '#E6B173', '#F5BE4B', '#F2D7B6', '#E8E2C4',
  '#F4C7C3', '#C9706B', '#D9D2EA', '#8C6BB1',
  '#BFD8E8', '#4F7CA8', '#2B3A55', '#7A4E3A',
  '#B9AE9E', '#5E6B65', '#1F2A26', '#FFFDF9'
];

// Paleta barev dne. Vlastní barva (z „Jiná barva…“) se ukáže jako
// další kolečko na konci, zatržené – ať je vidět, co je zvolené.
function paletaBarev(datum, zvolena) {
  const barvy = zvolena && !BARVY_DNE.includes(zvolena) ? [...BARVY_DNE, zvolena] : BARVY_DNE;
  return '<div class="vzorky">' + barvy.map(b => '<button type="button" class="vzorek" data-akce="barvaDne" data-datum="' + datum +
    '" data-barva="' + b + '" aria-pressed="' + (zvolena === b) + '" aria-label="Barva ' + b + (BARVY_DNE.includes(b) ? '' : ' (vlastní)') +
    '" style="background:' + b + ';color:' + inkoustPro(b) + '">' + (zvolena === b ? '✓' : '') + '</button>').join('') + '</div>';
}

// Světlost barvy (0 tmavá … 1 světlá) podle pravidel přístupnosti WCAG.
function svetlost(hex) {
  const c = [1, 3, 5].map(i => {
    const v = parseInt(hex.substr(i, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
// Na tmavé barvě světlé písmo, na světlé tmavé – vždy dobře čitelné.
function inkoustPro(hex) { return svetlost(hex) < 0.18 ? '#F7F2EA' : '#1F2A26'; }

async function obrazovkaDen(datum) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum || '')) return '<main class="obsah"><h1>Den nenalezen</h1><a class="tlacitko" href="#/domov">Domů</a></main>';
  const den = (await U.nactiDen(datum)) || { datum, barva: null, vecerni_hotovo: false, poznamka: '' };
  const zaznamy = (await U.vsechnyZaznamy()).filter(z => z.chvile_od.slice(0, 10) === datum)
    .sort((a, b) => (a.typ === 'vecerni') - (b.typ === 'vecerni') || a.chvile_od.localeCompare(b.chvile_od) || (a.poradi ?? 99) - (b.poradi ?? 99));
  const d = new Date(datum + 'T12:00:00');
  let nazev = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  nazev = nazev.charAt(0).toUpperCase() + nazev.slice(1);

  let barvy = '';
  if (nastaveni.barva_dne_zapnuta) {
    barvy = '<section class="karta"><h2>Jakou barvu ' + (datum === U.datumDne() ? 'má' : 'měl') + ' Tvůj den?</h2>' +
      paletaBarev(datum, den.barva) +
      '<div class="odkazy"><label class="tlacitko obrys male-t" style="cursor:pointer">Jiná barva…' +
        '<input type="color" class="skryte" data-akce="barvaVlastni" data-datum="' + datum + '" value="' + (den.barva || '#72B97F') + '"></label>' +
        (den.barva ? '<button type="button" class="tlacitko obrys male-t" data-akce="barvaDne" data-datum="' + datum + '" data-barva="">Bez barvy</button>' : '') +
      '</div>' +
      '<p class="tlumene male">Barvu si volíš ' + tvar('sama', 'sám') + ' a kdykoli ji změníš. Vypnout ji jde v Nastavení.</p></section>';
  }

  // Ukázka, jak den vypadá v barvě (deníkový záznam má barevný motiv)
  const pozadi = nastaveni.barva_dne_zapnuta && den.barva ? den.barva : null;
  const motiv = pozadi ? ' style="background:' + pozadi + ';color:' + inkoustPro(pozadi) + ';border-color:' + pozadi + '"' : '';

  const seznam = polozkySeznamu(zaznamy).map(radekSeznamu).join('');

  return '<header class="hlavicka">' +
      '<a class="ikona-tlacitko bez-okraje" href="#/domov" aria-label="Zpět na Domov">' + IKONA.zpet + '</a>' +
      '<span class="nazev-obrazovky">' + h(nazev) + '</span></header>' +
    '<main class="obsah">' +
      '<section class="karta"' + motiv + '><h2>' + h(nazev) + '</h2><p' + (pozadi ? '' : ' class="tlumene"') + '>' +
        (zaznamy.length ? 'Záznamů: ' + zaznamy.length : 'Tento den zatím bez záznamů.') + '</p></section>' +
      barvy +
      '<a class="tlacitko jemne" style="align-self:flex-start" href="#/vecer/' + datum + '">' +
        (den.vecerni_hotovo ? 'Upravit večerní ohlédnutí' : 'Večerní ohlédnutí tohoto dne') + '</a>' +
      (seznam ? '<section class="seznam"><h2>Záznamy toho dne</h2>' + seznam + '</section>' : '') +
    '</main>';
}

// ---------------- VEČERNÍ OHLÉDNUTÍ ----------------
// Postup (podle zadání, tok C):
//  1. bloky – den rozložený do bloků (činnost, délka, s kým, kde)
//  2. chvile – aplikace vybere 2–3 bloky; u každého „Jaká chvíle to pro
//     Tebe byla?“, vlastní slova, smysluplnost, volitelně 9 otázek pro výzkum
//  3. barva – „Jakou barvu měl Tvůj den?“ (jen když je barva zapnutá)
//  4. shrnuti – krátké shrnutí bez hodnocení + nabídka doplnit další
// Každý blok se ukládá jako jeden záznam typu „vecerni“.

let vecer = null; // rozpracované ohlédnutí (jen v paměti, ukládá se po krocích)

// Ke kterému dni ohlédnutí patří: po půlnoci (do 4:00) ještě ke včerejšku.
function denOhlednuti() {
  const d = new Date();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  return U.datumDne(d);
}

// Který den otevřít pod „Večerní ohlédnutí“: dopoledne (do 13 h) včerejšek,
// pokud ho člověk ještě nedokončil – ten už měl být vyplněný. Jinak dnešek.
// Netýká se úplně nových uživatelů (nic staršího než dnešek v aplikaci nemají).
async function denKOhlednuti() {
  const dnes = denOhlednuti();
  const ted = new Date();
  if (ted.getHours() < 4 || ted.getHours() >= 13) return dnes;
  const v = new Date(dnes + 'T12:00:00'); v.setDate(v.getDate() - 1);
  const vcera = U.datumDne(v);
  const den = await U.nactiDen(vcera);
  if (den && den.vecerni_hotovo) return dnes;
  const pouzivaUz = (await U.vsechnyZaznamy()).some(z => z.chvile_od.slice(0, 10) <= vcera);
  return pouzivaUz ? vcera : dnes;
}

function novyBlok() {
  return { id: U.noveId(), vytvoreno: U.tedS(), popis: '', cinnost: [], delkaMin: null, sKym: [], kde: null,
    hodnotit: false, prijemnost: null, text: '', smysluplnost: null, vyzkum: {}, ulozeny: false };
}

// Načte ohlédnutí daného dne (když už bylo uložené, jde ho upravit).
async function pripravVecer(datum) {
  if (vecer && vecer.datum === datum) return;
  const zaznamy = (await U.vsechnyZaznamy())
    .filter(z => z.typ === 'vecerni' && z.poradi != null && z.chvile_od.slice(0, 10) === datum)
    .sort((a, b) => a.poradi - b.poradi);
  vecer = {
    datum,
    krok: 'bloky',
    upravovany: null,  // index bloku, který se právě upravuje (nebo 'novy')
    rozpracovany: null,
    vlastniCinnost: false,
    bloky: zaznamy.map(z => ({
      id: z.id, vytvoreno: z.vytvoreno, popis: z.popis_bloku || '', cinnost: [...(z.cinnost || [])], delkaMin: z.chvile_delka_min,
      sKym: z.s_kym || [], kde: z.kde, hodnotit: z.prijemnost != null || !!z.vlastni_slova,
      prijemnost: z.prijemnost, text: z.vlastni_slova || '', smysluplnost: z.smysluplnost ?? null,
      vyzkum: Object.fromEntries(Object.entries(z.vyzkum || {}).filter(([, v]) => v != null)),
      ulozeny: true, puvodni: z
    }))
  };
  const den = await U.nactiDen(datum);
  if (vecer.bloky.length && den && den.vecerni_hotovo) vecer.krok = 'shrnuti';
  if (!vecer.bloky.length) {
    // Je k dispozici rozvrh z některého dřívějšího dne? Pak se nejdřív zeptáme.
    const drivejsi = (await U.vsechnyZaznamy())
      .filter(z => z.typ === 'vecerni' && z.poradi != null && z.chvile_od.slice(0, 10) < datum)
      .map(z => z.chvile_od.slice(0, 10)).sort();
    const dny = [...new Set(drivejsi)];
    vecer.predchoziDen = dny.length ? dny[dny.length - 1] : null;
    // Poslední stejný den v týdnu (např. minulý pátek), pokud je jiný než předchozí den.
    const denTydne = new Date(datum + 'T12:00:00').getDay();
    const stejne = dny.filter(x => new Date(x + 'T12:00:00').getDay() === denTydne);
    vecer.stejnyDen = stejne.length && stejne[stejne.length - 1] !== vecer.predchoziDen ? stejne[stejne.length - 1] : null;
    // Rovnou se tvoří nový blok; načtení předchozího rozvrhu se nabídne nad ním.
    vecer.upravovany = 'novy'; vecer.rozpracovany = novyBlok();
  }
}

function delkaText(min) {
  const d = S.DELKY.find(x => x.min === min);
  return d ? d.text : '';
}

function popisBloku(b) {
  return [nazevBloku(b), delkaText(b.delkaMin), b.sKym.join(', '), b.kde].filter(Boolean).join(' · ');
}

// Jedna nebo víc činností zároveň („práce + učení se něčemu novému“).
function nazevBloku(b, nahradni = 'bez činnosti') {
  return b.cinnost.length ? b.cinnost.join(' + ') : nahradni;
}

// Nadpis bloku: vlastní slova, když jsou, jinak činnosti.
function titulekBloku(b, nahradni) {
  return b.popis && b.popis.trim() ? b.popis.trim() : nazevBloku(b, nahradni);
}

// Aplikace vybere 2–3 chvíle: nejdelší bloky, každý s jinou činností.
// Rozbalí všechny chvíle dne. Vynechat jde tlačítkem „Vynechat“ nebo tím,
// že ji člověk nevyplní. Ručně vynechané zůstanou vynechané.
function vyberChvile() {
  for (const b of vecer.bloky) if (!b.vynechano) b.hodnotit = true;
}

// Uloží všechny bloky jako záznamy (nové přidá, upravené přepíše).
async function ulozVecer(hotovo = true) {
  const zacatekDne = U.tedS(new Date(vecer.datum + 'T00:00:00'));
  for (let i = 0; i < vecer.bloky.length; i++) {
    const b = vecer.bloky[i];
    const zaklad = b.puvodni || {};
    const zaznam = Object.assign({}, zaklad, {
      id: b.id, typ: 'vecerni', vytvoreno: b.vytvoreno, upraveno: b.ulozeny ? U.tedS() : null,
      chvile_od: zacatekDne, chvile_delka_min: b.delkaMin, poradi: i,
      prijemnost: b.hodnotit ? b.prijemnost : null,
      vlastni_slova: b.hodnotit ? b.text.trim() : '',
      smysluplnost: b.hodnotit ? b.smysluplnost : null,
      vyzkum: b.hodnotit && Object.keys(b.vyzkum).length ? Object.fromEntries(S.VYZKUM.map(v => [v.klic, b.vyzkum[v.klic] ?? null])) : null,
      popis_bloku: b.popis.trim(), cinnost: [...b.cinnost], s_kym: b.sKym, kde: b.kde,
      emoce: zaklad.emoce || [], telo: zaklad.telo || [], potreby: zaklad.potreby || [],
      strategie: zaklad.strategie || '', prosba: zaklad.prosba || '', fotka: zaklad.fotka || null,
      zdroj_textu: b.text.trim() ? (zaklad.zdroj_textu || 'psano') : null,
      verze_protokolu: S.VERZE_PROTOKOLU
    });
    await U.ulozZaznam(zaznam);
    b.ulozeny = true; b.puvodni = zaznam;
  }
  // Bloky, které člověk odebral, smažeme.
  for (const id of vecer.smazane || []) await U.smazZaznam(id);
  vecer.smazane = [];
  const den = (await U.nactiDen(vecer.datum)) || { datum: vecer.datum, barva: null, vecerni_hotovo: false, poznamka: '' };
  if (hotovo) den.vecerni_hotovo = true;
  await U.ulozDen(den);
}

const MAX_CINNOSTI = 2;
const HLASKA_CINNOSTI = 'V jednom bloku můžou být nejvýš dvě činnosti. Dělo se toho víc? Rozděl ho na víc bloků.';

// Editor jednoho bloku (nový nebo upravovaný).
function editorBloku(b) {
  // V jednom bloku nejvýš 2 činnosti. Když jsou vybrané dvě, ostatní čipy zešednou.
  const plno = b.cinnost.length >= MAX_CINNOSTI;
  const cipC = (c, zap) => zap || !plno ? cip(c, zap, 'blokCinnost', { slovo: c })
    : '<button type="button" class="cip neaktivni" data-akce="blokCinnost" data-slovo="' + h(c) + '" aria-disabled="true">' + h(c) + '</button>';
  const cinnosti = S.CINNOSTI.map(c => cipC(c, b.cinnost.includes(c))).join('') +
    b.cinnost.filter(c => !S.CINNOSTI.includes(c)).map(c => cipC(c, true)).join('') +
    (plno ? '' : '<button type="button" class="cip pridat" data-akce="blokVlastniOtevrit">+ vlastní</button>');
  const vlastni = vecer.vlastniCinnost
    ? '<div class="pole-radek"><input class="vstup" id="vlastni-cinnost" placeholder="Co jsi ' + tvar('dělala', 'dělal') + '?" autocomplete="off">' +
      '<button type="button" class="tlacitko male-t" data-akce="blokVlastniPridat">Přidat</button></div>' : '';
  // Každá otázka je samostatný oddíl s čárou nahoře, ať je jasné, kde která nabídka končí.
  const oddil = (nadpis, obsah, pro) => '<div class="oddil">' +
    (pro ? '<label class="oddil-nadpis" for="' + pro + '">' : '<h3 class="oddil-nadpis">') + nadpis + (pro ? '</label>' : '</h3>') + obsah + '</div>';
  return '<section class="karta">' +
    '<h2>' + (vecer.upravovany === 'novy' ? (vecer.bloky.length ? 'Další blok dne' : 'První blok dne') : 'Upravit blok') + '</h2>' +
    oddil('Co jsi ' + tvar('dělala', 'dělal') + '? <span class="oddil-pozn">Můžeš vybrat i dvě činnosti, pokud probíhaly společně. Např. vaření a podcast.</span>',
      '<div class="cipy">' + cinnosti + '</div>' + (plno ? '<p class="tlumene male">Vybrané jsou dvě činnosti. Jinou zvolíš, když jednu z nich zrušíš.</p>' : vlastni)) +
    oddil('Vlastními slovy <span class="oddil-pozn">nepovinné – ať víš, který kus dne to byl</span>',
      '<div class="pole"><textarea id="blok-popis" rows="2" data-blok-popis="1" placeholder="Třeba: dopolední porada, psaní zprávy…">' + h(b.popis) + '</textarea>' +
      (tlacitkoDiktovani('blokpopis') ? '<div class="pole-radek"><span></span>' + tlacitkoDiktovani('blokpopis') + '</div>' : '') + '</div>', 'blok-popis') +
    oddil('Jak dlouho zhruba?', '<div class="cipy">' + S.DELKY.map(d => cip(d.text, b.delkaMin === d.min, 'blokDelka', { min: d.min })).join('') + '</div>') +
    oddil('S kým? <span class="oddil-pozn">nepovinné</span>', '<div class="cipy">' + S.S_KYM.map(c => cip(c, b.sKym.includes(c), 'blokSKym', { slovo: c })).join('') + '</div>') +
    oddil('Kde? <span class="oddil-pozn">nepovinné</span>', '<div class="cipy">' + S.KDE.map(c => cip(c, b.kde === c, 'blokKde', { slovo: c })).join('') + '</div>') +
    '<div class="odkazy"><button type="button" class="tlacitko male-t" data-akce="blokHotovo">' +
      (vecer.upravovany === 'novy' ? 'Přidat do dne' : 'Hotovo') + '</button>' +
      (vecer.bloky.length ? '<button type="button" class="tlacitko obrys male-t" data-akce="blokZrusit">Zrušit</button>' : '') +
      (vecer.upravovany !== 'novy' ? '<button type="button" class="tlacitko obrys male-t" data-akce="blokOdebrat">Odebrat blok</button>' : '') +
      (vecer.upravovany !== 'novy' && vecer.bloky.length > 1
        ? '<button type="button" class="tlacitko obrys male-t" data-akce="blokPosun" data-smer="-1"' + (vecer.upravovany === 0 ? ' disabled' : '') + '>Posunout výš</button>' +
          '<button type="button" class="tlacitko obrys male-t" data-akce="blokPosun" data-smer="1"' + (vecer.upravovany === vecer.bloky.length - 1 ? ' disabled' : '') + '>Posunout níž</button>'
        : '') +
    '</div></section>';
}

function hlavickaVecera(nazev, zpet) {
  return '<header class="hlavicka">' +
    '<a class="ikona-tlacitko bez-okraje" href="' + zpet + '" aria-label="Zpět">' + IKONA.zpet + '</a>' +
    '<span class="nazev-obrazovky">' + nazev + '</span></header>';
}

function nazevDneVecera() {
  if (vecer.datum === U.datumDne()) return 'Večerní ohlédnutí';
  const d = new Date(vecer.datum + 'T12:00:00');
  const den = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long' }).format(d);
  return 'Ohlédnutí · ' + d.getDate() + '. ' + (d.getMonth() + 1) + '. · ' + den;
}

async function obrazovkaVecer(parametr) {
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(parametr || '') ? parametr : await denKOhlednuti();
  // Den se zapíše do adresy, aby ohlédnutí zůstalo u něj i po uložení
  // (jinak by se po dokončení včerejška samo otevřelo dnešní ohlédnutí).
  if (!parametr) history.replaceState(null, '', '#/vecer/' + datum);
  await pripravVecer(datum);
  const v = vecer;

  // ---- 0. nový rozvrh, nebo předchozí? ----
  if (v.krok === 'start') {
    const d = new Date(v.predchoziDen + 'T12:00:00');
    const kdy = d.getDate() + '. ' + (d.getMonth() + 1) + '. (' + new Intl.DateTimeFormat('cs-CZ', { weekday: 'long' }).format(d) + ')';
    return hlavickaVecera(nazevDneVecera(), '#/domov') +
      '<main class="obsah">' +
        '<h1 style="font-size:26px">Jak chceš začít?</h1>' +
        '<button type="button" class="karta" style="text-align:left;cursor:pointer;font:inherit" data-akce="vecerNacist">' +
          '<h2>Načíst předchozí rozvrh</h2><p class="tlumene">Rozvrh ze dne ' + h(kdy) + '. Bloky si pak upravíš. Hodnocení chvil se nepřebírá.</p></button>' +
        '<button type="button" class="karta" style="text-align:left;cursor:pointer;font:inherit" data-akce="vecerNovy">' +
          '<h2>Nový rozvrh</h2><p class="tlumene">Začneš s prázdným dnem.</p></button>' +
      '</main>';
  }

  // ---- 1. bloky ----
  if (v.krok === 'bloky') {
    // Nabídka načíst rozvrh – jen když je den zatím prázdný.
    const kratce = x => { const d = new Date(x + 'T12:00:00'); return d.getDate() + '. ' + (d.getMonth() + 1) + '.'; };
    const MINULY = ['minulou neděli', 'minulé pondělí', 'minulé úterý', 'minulou středu', 'minulý čtvrtek', 'minulý pátek', 'minulou sobotu'];
    const NAZEV = ['neděli', 'pondělí', 'úterý', 'středu', 'čtvrtek', 'pátek', 'sobotu'];
    let nacist = '';
    if (!v.bloky.length && (v.predchoziDen || v.stejnyDen)) {
      const tlac = (datumZdroje, text) => '<button type="button" class="tlacitko obrys" style="justify-content:flex-start" data-akce="vecerNacist" data-zdroj="' + datumZdroje + '">' + text + '</button>';
      let stejny = '';
      if (v.stejnyDen) {
        const dny = Math.round((new Date(v.datum + 'T12:00:00') - new Date(v.stejnyDen + 'T12:00:00')) / 86400000);
        const wd = new Date(v.stejnyDen + 'T12:00:00').getDay();
        stejny = tlac(v.stejnyDen, 'Načíst ' + (dny === 7 ? MINULY[wd] : NAZEV[wd]) + ' (' + kratce(v.stejnyDen) + ')');
      }
      nacist = '<section class="karta"><h2>Načíst rozvrh?</h2>' +
        '<p class="tlumene male">Bloky si pak upravíš. Hodnocení chvil se nepřebírá. Nebo rovnou začni tvořit níž.</p>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
          (v.predchoziDen ? tlac(v.predchoziDen, 'Načíst předchozí den (' + kratce(v.predchoziDen) + ')') : '') + stejny +
        '</div></section>';
    }
    let seznam = '';
    v.bloky.forEach((b, i) => {
      if (v.upravovany === i) { seznam += editorBloku(v.rozpracovany); return; }
      seznam += '<button type="button" class="zaznam-radek blok-radek" style="text-align:left;width:100%;cursor:pointer" data-akce="blokUpravit" data-index="' + i + '" data-blok-index="' + i + '">' +
        '<span class="znamka">' + (i + 1) + '</span><div>' + (b.popis.trim() ? '<div style="font-weight:600">' + h(b.popis.trim()) + '</div><div class="tlumene male">' + h(popisBloku(b)) + '</div>' : h(popisBloku(b))) +
        '</div><span class="sipka" aria-hidden="true">›</span></button>';
    });
    const novy = v.upravovany === 'novy' ? editorBloku(v.rozpracovany) : '';
    const pridat = v.upravovany === null
      ? '<button type="button" class="tlacitko obrys" style="align-self:flex-start" data-akce="blokNovy">+ Přidat další blok</button>' : '';
    return hlavickaVecera(nazevDneVecera(), '#/domov') +
      '<main class="obsah">' +
        '<div><h1 style="font-size:26px">Co jsi ' + (v.datum === U.datumDne() ? 'dnes' : 'ten den') + ' ' + tvar('dělala', 'dělal') + '?</h1>' +
        '<p class="tlumene">Rozlož si den do bloků, jak šly po sobě. Stačí zhruba. Noční spánek se nezapisuje.</p></div>' +
        nacist +
        (seznam ? '<div class="seznam" id="seznam-bloku">' + seznam + '</div>' +
          (v.bloky.length > 1 && v.upravovany === null ? '<p class="tlumene male">Pořadí změníš, když blok podržíš a přetáhneš nahoru nebo dolů.</p>' : '') : '') + novy + pridat +
      '</main>' +
      '<footer class="spodni-lista tri">' +
        '<button type="button" class="tlacitko obrys" data-akce="vecerOdlozit">Odložit</button>' +
        '<button type="button" class="tlacitko obrys" data-akce="vecerUlozitRozvrh"' + (v.bloky.length || v.upravovany !== null ? '' : ' disabled') + '>Uložit</button>' +
        '<button type="button" class="tlacitko" data-akce="vecerDal"' + (v.bloky.length ? '' : ' disabled') + '>Dál</button>' +
      '</footer>';
  }

  // ---- 2. chvíle ----
  if (v.krok === 'chvile') {
    let karty = '';
    v.bloky.forEach((b, i) => {
      if (!b.hodnotit) return;
      let skala = '';
      for (let x = -3; x <= 3; x++) {
        skala += '<button type="button" data-akce="blokPrijemnost" data-index="' + i + '" data-hodnota="' + x + '" aria-pressed="' + (b.prijemnost === x) +
          '" aria-label="Hodnota ' + x + '">' + (x > 0 ? '+' + x : x) + '</button>';
      }
      let smysl = '<div class="hladiny" role="group" aria-label="Smysluplnost od 0 do 6">';
      for (let x = 0; x <= 6; x++) {
        smysl += '<button type="button" data-akce="blokSmysl" data-index="' + i + '" data-hodnota="' + x + '" aria-pressed="' + (b.smysluplnost === x) + '">' + x + '</button>';
      }
      smysl += '</div>';
      let vyzkum = '';
      for (const q of S.VYZKUM) {
        let cisla = '<div class="hladiny" role="group" aria-label="' + h(q.text) + ' od 0 do 6">';
        for (let x = 0; x <= 6; x++) {
          cisla += '<button type="button" data-akce="blokVyzkum" data-index="' + i + '" data-klic="' + q.klic + '" data-hodnota="' + x +
            '" aria-pressed="' + (b.vyzkum[q.klic] === x) + '">' + x + '</button>';
        }
        vyzkum += '<div class="vybrana-polozka"><span class="jmeno">' + h(q.text) + '</span>' + cisla + '</div></div>';
      }
      const cil = 'blok:' + i;
      karty += '<section class="karta">' +
        '<div class="karta-radek"><h2>' + h(titulekBloku(b, 'Chvíle')) + '</h2><button type="button" class="tlacitko obrys male-t" data-akce="blokNehodnotit" data-index="' + i + '">Vynechat</button></div>' +
        '<p class="tlumene male">' + h(popisBloku(b)) + '</p>' +
        '<span class="panel-nadpis">Jaká chvíle to pro Tebe byla?</span>' +
        '<div class="skala" role="group" aria-label="Od −3 do +3">' + skala + '</div>' +
        '<div class="skala-popisky"><span>velmi nepříjemná</span><span>ani tak, ani tak</span><span>velmi příjemná</span></div>' +
        '<label class="panel-nadpis" for="blok-text-' + i + '">Co jsi při tom ' + tvar('cítila', 'cítil') + '? Vlastními slovy</label>' +
        '<div class="pole"><textarea id="blok-text-' + i + '" rows="2" data-blok-text="' + i + '">' + h(b.text) + '</textarea>' +
          (tlacitkoDiktovani(cil) ? '<div class="pole-radek"><span></span>' + tlacitkoDiktovani(cil) + '</div>' : '') + '</div>' +
        '<span class="panel-nadpis">Jak smysluplné to pro Tebe bylo? (0 vůbec, 6 velmi)</span>' + smysl +
        '<details class="karta" data-cast="vyzkum-' + i + '" style="padding:12px"' + (Object.keys(b.vyzkum).length ? ' open' : '') + '><summary>Pro výzkum (nepovinné)</summary>' +
          '<p class="tlumene male">Jak silně jsi ' + tvar('cítila', 'cítil') + '… (0 vůbec, 6 velmi silně)</p><div class="vybrane">' + vyzkum + '</div></details>' +
      '</section>';
    });
    const ostatni = v.bloky.map((b, i) => ({ b, i })).filter(x => !x.b.hodnotit);
    const dalsi = ostatni.length
      ? '<section class="karta"><h2>Vynechané chvíle</h2><div class="cipy">' +
        ostatni.map(({ b, i }) => '<button type="button" class="cip" data-akce="blokHodnotit" data-index="' + i + '">' + h(titulekBloku(b, 'blok ' + (i + 1))) + ' · ' + h(delkaText(b.delkaMin)) + '</button>').join('') +
        '</div></section>' : '';
    return hlavickaVecera(nazevDneVecera(), '#/vecer/' + v.datum) +
      '<main class="obsah">' +
        '<div><h1 style="font-size:26px">Pár chvil z Tvého dne</h1><p class="tlumene">Kteroukoli chvíli můžeš vynechat – tlačítkem, nebo ji prostě nevyplň.</p></div>' +
        karty + dalsi +
      '</main>' +
      '<footer class="spodni-lista">' +
        '<button type="button" class="tlacitko obrys" data-akce="vecerZpet">Zpět</button>' +
        '<button type="button" class="tlacitko" data-akce="vecerUlozit">Takhle to stačí</button>' +
      '</footer>';
  }

  // ---- 3. barva dne ----
  if (v.krok === 'barva') {
    const den = (await U.nactiDen(v.datum)) || {};
    return hlavickaVecera(nazevDneVecera(), '#/vecer/' + v.datum) +
      '<main class="obsah"><section class="karta"><h1 style="font-size:26px">Jakou barvu ' + (v.datum === U.datumDne() ? 'má' : 'měl') + ' Tvůj den?</h1>' +
        paletaBarev(v.datum, den.barva) +
        '<div class="odkazy"><label class="tlacitko obrys male-t" style="cursor:pointer">Jiná barva…' +
          '<input type="color" class="skryte" data-akce="barvaVlastni" data-datum="' + v.datum + '" value="' + (den.barva || '#72B97F') + '"></label>' +
          (den.barva ? '<button type="button" class="tlacitko obrys male-t" data-akce="barvaDne" data-datum="' + v.datum + '" data-barva="">Bez barvy</button>' : '') +
        '</div></section></main>' +
      '<footer class="spodni-lista">' +
        '<button type="button" class="tlacitko obrys" data-akce="vecerShrnuti">Přeskočit</button>' +
        '<button type="button" class="tlacitko" data-akce="vecerShrnuti">Dál</button>' +
      '</footer>';
  }

  // ---- 4. shrnutí ----
  const den = (await U.nactiDen(v.datum)) || {};
  const celkem = v.bloky.reduce((s, b) => s + (b.delkaMin || 0), 0);
  const hodnocene = v.bloky.filter(b => b.hodnotit && b.prijemnost != null);
  const cas = { prijemny: 0, neutralni: 0, neprijemny: 0 };
  for (const b of hodnocene) {
    const k = b.prijemnost > 0 ? 'prijemny' : b.prijemnost < 0 ? 'neprijemny' : 'neutralni';
    cas[k] += b.delkaMin || 0;
  }
  const hodiny = m => m >= 60 ? (Math.round(m / 6) / 10).toString().replace('.', ',') + ' h' : m + ' min';
  const motiv = nastaveni.barva_dne_zapnuta && den.barva ? ' style="background:' + den.barva + ';color:' + inkoustPro(den.barva) + ';border-color:' + den.barva + '"' : '';
  const radkyChvil = hodnocene.map(b => '<li>' + h(titulekBloku(b, 'chvíle')) + ': ' + (b.prijemnost > 0 ? '+' + b.prijemnost : b.prijemnost) +
    (b.text.trim() ? ' – „' + h(b.text.trim().slice(0, 60)) + (b.text.trim().length > 60 ? '…' : '') + '“' : '') + '</li>').join('');

  // Všechny záznamy toho dne – okamžité i večerní (kvůli fotkám a průběhu dne)
  const zaznamyDne = (await U.vsechnyZaznamy()).filter(z => z.chvile_od.slice(0, 10) === v.datum);
  const okamzite = zaznamyDne.filter(z => z.typ !== 'vecerni' && z.typ !== 'oslava').sort((a, b) => a.chvile_od.localeCompare(b.chvile_od));
  const oslavyDne = zaznamyDne.filter(z => z.typ === 'oslava').sort((a, b) => a.chvile_od.localeCompare(b.chvile_od));
  const sFotkou = [...okamzite, ...zaznamyDne.filter(z => z.typ === 'vecerni')].filter(z => z.fotka);

  // Co ještě jde doplnit
  const nabidka = [];
  if (v.bloky.some(b => !b.hodnotit)) nabidka.push(['chvile', 'Popsat další chvíle']);
  // Co už k tomuto dni doplněné je, znovu nenabízíme.
  const doplneni = zaznamyDne.filter(z => z.typ === 'vecerni' && z.poradi == null);
  if (!doplneni.some(z => z.telo.length)) nabidka.push(['telo', 'Co se dnes dělo v těle']);
  if (!doplneni.some(z => z.potreby.length)) nabidka.push(['potreby', 'Jak jsou právě naplněné Tvé potřeby?']);
  if (!doplneni.some(z => z.strategie || z.prosba)) nabidka.push(['pomuze', 'Co by Ti teď mohlo udělat dobře']);

  return hlavickaVecera(nazevDneVecera(), '#/domov') +
    '<main class="obsah">' +
      '<h1>Tvůj den</h1>' +
      '<section class="karta"' + motiv + '>' +
        '<p>' + v.bloky.length + ' ' + (v.bloky.length === 1 ? 'blok' : v.bloky.length < 5 ? 'bloky' : 'bloků') + (celkem ? ', zhruba ' + hodiny(celkem) : '') + '.</p>' +
        (hodnocene.length ? '<p>Z popsaných chvil: příjemný čas ' + hodiny(cas.prijemny) + ', neutrální ' + hodiny(cas.neutralni) + ', nepříjemný ' + hodiny(cas.neprijemny) + '.</p>' +
          '<ul style="margin:0;padding-left:20px">' + radkyChvil + '</ul>' : '<p>Chvíle zatím nejsou popsané.</p>') +
      '</section>' +
      grafBloku(v.bloky, hodiny) +
      grafOkamzitych(okamzite) +
      nahledyFotek(sFotkou) +
      kartaOslav(oslavyDne) +
      '<p class="tlumene male">Uloženo jen v tomto telefonu.</p>' +
      panelSdileni(v, okamzite, hodiny, cas, celkem, hodnocene, sFotkou, nastaveni.barva_dne_zapnuta ? den.barva : null, oslavyDne) +
      (nabidka.length ? '<section class="karta"><h2>Chceš zaznamenat ještě něco dalšího?</h2><div class="cipy">' +
        nabidka.map(([cast, text]) => '<button type="button" class="cip" data-akce="vecerDoplnit" data-cast="' + cast + '">' + h(text) + '</button>').join('') +
      '</div></section>' : '') +
      '<div class="dvojice">' +
        '<button type="button" class="tlacitko obrys" data-akce="oslavaZacit" data-zpet="#/vecer/' + v.datum + '" data-datum="' + v.datum + '">Dnes chci oslavit…</button>' +
        '<a class="tlacitko obrys" href="#/domov">Takhle mi to stačí</a></div>' +
      '<div class="odkazy">' +
      '<button type="button" class="tlacitko obrys male-t" data-akce="vecerZpet">Upravit rozvrh dne</button>' +
      (nastaveni.barva_dne_zapnuta ? '<button type="button" class="tlacitko obrys male-t" data-akce="vecerBarva">Změnit barvu dne</button>' : '') + '</div>' +
    '</main>';
}

// ---------------- SDÍLENÍ SHRNUTÍ DNE ----------------
// Sdílí se jen na pokyn člověka a jen text, který vidí v náhledu.
// Odchází přes běžné sdílení telefonu (zpráva, e-mail, chat) – aplikace
// sama nic neposílá. Fotky a vlastní slova jsou ve výchozím stavu vypnuté.
let sdileni = { otevreno: false, slova: false, okamzite: false, fotky: true, oslavy: false, titulek: '', format: 'prispevek', obrazek: null, klicObrazku: null, pripravuji: false };

function textSdileni(v, okamzite, hodiny, cas, celkem, hodnocene, oslavy = []) {
  const d = new Date(v.datum + 'T12:00:00');
  const radky = ['Snímek dne ' + d.getDate() + '. ' + (d.getMonth() + 1) + '. (z aplikace Mám se!)'];
  radky.push(v.bloky.length + ' ' + (v.bloky.length === 1 ? 'blok' : v.bloky.length < 5 ? 'bloky' : 'bloků') + (celkem ? ', zhruba ' + hodiny(celkem) : ''));
  if (hodnocene.length) {
    radky.push('Příjemný čas ' + hodiny(cas.prijemny) + ', neutrální ' + hodiny(cas.neutralni) + ', nepříjemný ' + hodiny(cas.neprijemny) + '.');
    for (const b of hodnocene) {
      radky.push('• ' + titulekBloku(b, 'chvíle') + ': ' + (b.prijemnost > 0 ? '+' + b.prijemnost : b.prijemnost) +
        (sdileni.slova && b.text.trim() ? ' – ' + b.text.trim() : ''));
    }
  }
  if (sdileni.okamzite && okamzite.length) {
    radky.push('Během dne:');
    for (const z of okamzite) {
      const cas2 = new Date(z.chvile_od).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
      const p = z.prijemnost == null ? '' : ' ' + (z.prijemnost > 0 ? '+' + z.prijemnost : z.prijemnost);
      const slova = [z.emoce.map(e => e.slovo).join(', '), sdileni.slova ? z.vlastni_slova : ''].filter(Boolean).join(' – ');
      radky.push('• ' + cas2 + p + (slova ? ' ' + slova : ''));
    }
  }
  for (const o of oslavy) {
    if (o.vlastni_slova) radky.push('Dnes oslavuji: ' + o.vlastni_slova);
    if (o.potreby && o.potreby.length) radky.push('Naplněné potřeby: ' + o.potreby.map(p => p.potreba).join(', '));
    if (o.podekovani) radky.push('Děkuji: ' + o.podekovani);
  }
  return radky.join('\n');
}

function panelSdileni(v, okamzite, hodiny, cas, celkem, hodnocene, fotky, barvaDne, oslavy = []) {
  if (!sdileni.otevreno) {
    return '<button type="button" class="tlacitko obrys male-t" style="align-self:flex-start" data-akce="sdiletOtevrit">Sdílet snímek dne…</button>';
  }
  const text = textSdileni(v, okamzite, hodiny, cas, celkem, hodnocene, sdileni.oslavy ? oslavy : []);
  // Obrázek se kreslí znovu jen tehdy, když se změní, co v něm má být.
  const klic = [v.datum, sdileni.slova, sdileni.okamzite, sdileni.fotky, sdileni.oslavy, sdileni.format, barvaDne, text].join('|');
  if (sdileni.klicObrazku !== klic && !sdileni.pripravuji) {
    sdileni.pripravuji = true;
    nakresliSnimekDne({ v, okamzite: sdileni.okamzite ? okamzite : [], hodiny, cas, celkem, hodnocene,
      fotky: sdileni.fotky ? fotky : [], barvaDne, oslavy: sdileni.oslavy ? oslavy : [] }).then(blob => {
      if (sdileni.obrazek) URL.revokeObjectURL(sdileni.obrazek.url);
      sdileni.obrazek = { blob, url: URL.createObjectURL(blob) };
      sdileni.klicObrazku = klic;
      sdileni.pripravuji = false;
      prekresli();
    });
  }
  const nahled = sdileni.obrazek && sdileni.klicObrazku === klic
    ? '<img class="nahled-snimku" src="' + sdileni.obrazek.url + '" alt="Náhled snímku dne">'
    : '<p class="tlumene">Připravuji náhled…</p>';
  return '<section class="karta"><h2>Sdílet snímek dne</h2>' +
    '<p class="tlumene male">Odejde jen tenhle obrázek s textem – nic jiného. Komu a kudy (zpráva, e-mail, chat) si vybereš sama/sám.</p>'.replace('sama/sám', tvar('sama', 'sám')) +
    '<label class="panel-nadpis" for="titulek-snimku">Tvůj komentář ke sdílení (nepovinné)</label>' +
    '<input class="vstup" id="titulek-snimku" data-akce="sdiletTitulek" maxlength="90" value="' + h(sdileni.titulek) +
      '" placeholder="Třeba: Ani bych ' + tvar('nevěřila', 'nevěřil') + ', co jsem toho dnes ' + tvar('stihla', 'stihl') + '!" autocomplete="off">' +
    '<span class="panel-nadpis">Tvar obrázku</span><div class="cipy">' +
      cip('příspěvek', sdileni.format === 'prispevek', 'sdiletFormat', { format: 'prispevek' }) +
      cip('příběh (na výšku)', sdileni.format === 'pribeh', 'sdiletFormat', { format: 'pribeh' }) + '</div>' +
    '<label class="prepinac-maly" style="font-size:15px"><input type="checkbox" data-akce="sdiletSlova"' + (sdileni.slova ? ' checked' : '') + '>Přidat moje vlastní slova</label>' +
    (okamzite.length ? '<label class="prepinac-maly" style="font-size:15px"><input type="checkbox" data-akce="sdiletOkamzite"' + (sdileni.okamzite ? ' checked' : '') + '>Přidat okamžité záznamy</label>' : '') +
    (oslavy.length ? '<label class="prepinac-maly" style="font-size:15px"><input type="checkbox" data-akce="sdiletOslavy"' + (sdileni.oslavy ? ' checked' : '') + '>Přidat oslavu</label>' : '') +
    (fotky.length ? '<label class="prepinac-maly" style="font-size:15px"><input type="checkbox" data-akce="sdiletFotky"' + (sdileni.fotky ? ' checked' : '') + '>Přidat miniatury fotek</label>' : '') +
    nahled +
    '<pre class="nahled-sdileni skryte">' + h(text) + '</pre>' +
    '<p class="tlumene male">Komentář se nepřidá do obrázku – pošle se jako text k němu (na Facebooku třeba jako popisek příběhu).</p>' +
    '<div class="odkazy"><button type="button" class="tlacitko male-t" data-akce="sdiletTed"' + (nahled.includes('<img') ? '' : ' disabled') + '>Sdílet</button>' +
    '<button type="button" class="tlacitko obrys male-t" data-akce="sdiletStahnout"' + (nahled.includes('<img') ? '' : ' disabled') + '>Uložit obrázek</button>' +
    '<button type="button" class="tlacitko obrys male-t" data-akce="sdiletKopirovat">Zkopírovat text</button>' +
    '<button type="button" class="tlacitko obrys male-t" data-akce="sdiletZavrit">Zavřít</button></div></section>';
}

// ---------------- SNÍMEK DNE (obrázek ke sdílení) ----------------
// Kreslíme do „plátna“ (canvas) a z něj uděláme obrázek PNG.
// Stejné barvy a tvary jako ve shrnutí v aplikaci.

function nactiObrazek(src) {
  return new Promise((hotovo, chyba) => { const i = new Image(); i.onload = () => hotovo(i); i.onerror = chyba; i.src = src; });
}

// Rozdělí text do řádků, aby se vešel do dané šířky.
function zalomText(ctx, text, sirka) {
  const slova = text.split(' '), radky = [];
  let radek = '';
  for (const slovo of slova) {
    const zkus = radek ? radek + ' ' + slovo : slovo;
    if (ctx.measureText(zkus).width > sirka && radek) { radky.push(radek); radek = slovo; } else radek = zkus;
  }
  if (radek) radky.push(radek);
  return radky;
}

function zaoblenyObdelnik(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Skleničky potřeb na obrázku (stejný tvar jako v aplikaci, viz sklenicka()).
const SKL_W = 46, SKL_H = 58, SKL_RADEK = 74;
function rozvrhniSklenicky(ctx, potreby, sirka, font) {
  ctx.font = font;
  const polozky = []; let x = 0, radek = 0;
  for (const p of potreby) {
    const w = SKL_W + 12 + ctx.measureText(p.potreba).width + 30;
    if (x > 0 && x + w > sirka) { radek++; x = 0; }
    polozky.push({ potreba: p.potreba, naplneni: p.naplneni, x, radek }); x += w;
  }
  return { polozky, radku: polozky.length ? radek + 1 : 0, font };
}
function nakresliSklenicky(ctx, rozvrh, x0, y0, barvaTextu) {
  const k = SKL_W / 44;
  for (const p of rozvrh.polozky) {
    const x = x0 + p.x, y = y0 + p.radek * SKL_RADEK;
    const obrys = () => { ctx.beginPath(); ctx.moveTo(x + 8 * k, y + 6 * k); ctx.lineTo(x + 36 * k, y + 6 * k); ctx.lineTo(x + 32 * k, y + 52 * k); ctx.lineTo(x + 12 * k, y + 52 * k); ctx.closePath(); };
    const hladina = p.naplneni == null ? 0 : (p.naplneni / 4) * 46 * k;
    ctx.save(); obrys(); ctx.clip();
    ctx.fillStyle = '#FFFDF9'; ctx.fillRect(x, y, SKL_W, SKL_H);
    ctx.fillStyle = '#E6B173'; ctx.fillRect(x, y + 52 * k - hladina, SKL_W, hladina);
    ctx.restore();
    obrys(); ctx.strokeStyle = '#246B56'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.font = rozvrh.font; ctx.fillStyle = barvaTextu || '#1F2A26'; ctx.textBaseline = 'middle';
    ctx.fillText(p.potreba, x + SKL_W + 12, y + SKL_H / 2);
    ctx.textBaseline = 'top';
  }
}

async function nakresliSnimekDne(d) {
  const W = 1080, P = 64, SIRKA = W - 2 * P;
  const platno = document.createElement('canvas');
  const ctx = platno.getContext('2d');
  const serif = '"Fraunces", Georgia, serif', sans = '"Inter", system-ui, sans-serif';
  try { await document.fonts.ready; } catch (e) { /* písmo není nutné */ }

  // Obsah si nejdřív připravíme jako seznam kroků a spočítáme výšku.
  ctx.font = '400 34px ' + sans;
  const datum = new Date(d.v.datum + 'T12:00:00');
  const nazevDne = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }).format(datum);
  const souhrn = [];
  souhrn.push(d.v.bloky.length + ' ' + (d.v.bloky.length === 1 ? 'blok' : d.v.bloky.length < 5 ? 'bloky' : 'bloků') + (d.celkem ? ', zhruba ' + d.hodiny(d.celkem) : ''));
  if (d.hodnocene.length) souhrn.push('Příjemný čas ' + d.hodiny(d.cas.prijemny) + ', neutrální ' + d.hodiny(d.cas.neutralni) + ', nepříjemný ' + d.hodiny(d.cas.neprijemny) + '.');
  const chvile = d.hodnocene.map(b => titulekBloku(b, 'chvíle') + ': ' + (b.prijemnost > 0 ? '+' + b.prijemnost : b.prijemnost) +
    (sdileni.slova && b.text.trim() ? ' – ' + b.text.trim() : ''));
  const okamzite = d.okamzite.map(z => {
    const c = new Date(z.chvile_od).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    const p = z.prijemnost == null ? '' : ' ' + (z.prijemnost > 0 ? '+' + z.prijemnost : z.prijemnost);
    const slova = [z.emoce.map(e => e.slovo).join(', '), sdileni.slova ? z.vlastni_slova : ''].filter(Boolean).join(' – ');
    return { z, text: c + p + (slova ? ' ' + slova : '') };
  });
  const radkySouhrnu = souhrn.flatMap(t => zalomText(ctx, t, SIRKA - 64));
  const radkyChvil = chvile.flatMap(t => zalomText(ctx, '• ' + t, SIRKA - 64));
  const radkyOkamzitych = okamzite.flatMap(o => zalomText(ctx, '• ' + o.text, SIRKA));
  ctx.font = '500 34px ' + serif;
  // Každá oslava: co oslavuji, skleničky naplněných potřeb (zásada oslavy v NVC), komu děkuji.
  const oslavyKresba = (d.oslavy || []).map(o => {
    ctx.font = '500 34px ' + serif;
    const text = o.vlastni_slova ? zalomText(ctx, 'Dnes oslavuji: ' + o.vlastni_slova, SIRKA - 64) : [];
    const dik = o.podekovani ? zalomText(ctx, 'Děkuji: ' + o.podekovani, SIRKA - 64) : [];
    const skl = rozvrhniSklenicky(ctx, o.potreby || [], SIRKA - 64, '400 30px ' + sans);
    const vyska = text.length * 46 + (skl.radku ? 10 + skl.radku * SKL_RADEK : 0) + dik.length * 46;
    return { text, dik, skl, vyska };
  }).filter(o => o.vyska);
  const vyskaOslav = oslavyKresba.length ? 40 + oslavyKresba.reduce((a, o) => a + o.vyska, 0) + (oslavyKresba.length - 1) * 30 + 40 : 0;
  ctx.font = '400 34px ' + sans;
  const poradiKat = Object.keys(KATEGORIE);
  const katB = b => kategorie(b.hodnotit ? b.prijemnost : null);
  const sBloky = d.v.bloky.filter(b => b.delkaMin)
    .map((b, i) => ({ b, i })).sort((x, y) => poradiKat.indexOf(katB(x.b)) - poradiKat.indexOf(katB(y.b)) || x.i - y.i).map(x => x.b);
  // Fotky: všechny na stejnou výšku, šířka podle poměru stran (nic se neořezává).
  const VYSKA_FOTKY = 240, MEZERA = 16;
  const fotky = [];
  for (const z of d.fotky.slice(0, 6)) {
    try { const img = await nactiObrazek(urlFotky(z.fotka)); fotky.push({ img, w: Math.min(SIRKA, img.width * VYSKA_FOTKY / img.height) }); }
    catch (e) { /* fotku se nepodařilo načíst */ }
  }
  // Rozmístění do řádků
  let radkuFotek = fotky.length ? 1 : 0, xf = 0;
  for (const f of fotky) {
    if (xf > 0 && xf + f.w > SIRKA) { radkuFotek++; xf = 0; }
    f.radek = radkuFotek - 1; f.x = xf; xf += f.w + MEZERA;
  }

  ctx.font = '400 34px ' + sans;
  let H = P + 70 + 16 + 72 + 50 + 30;                        // hlavička: Mám se!, Snímek dne, datum
  H += 48 + radkySouhrnu.length * 48 + (radkyChvil.length ? 16 + radkyChvil.length * 46 : 0) + 48 + 32; // karta dne
  if (vyskaOslav) H += vyskaOslav + 32;
  if (sBloky.length) H += 50 + 56 + 24 + 60 + 32;           // průběh dne
  if (okamzite.length) H += 50 + 50 + 50 + radkyOkamzitych.length * 46 + 32;
  if (fotky.length) H += radkuFotek * (VYSKA_FOTKY + MEZERA) + 32;
  H += 60 + P;
  platno.width = W; platno.height = H;

  // Pozadí
  ctx.fillStyle = '#F7F2EA'; ctx.fillRect(0, 0, W, H);
  let y = P;

  // Hlavička: logo, název dne
  try { const logo = await nactiObrazek('ikony/logo.svg'); ctx.drawImage(logo, P, y, 64, 64); } catch (e) { /* bez loga */ }
  ctx.fillStyle = '#1F2A26'; ctx.font = '600 44px ' + serif; ctx.textBaseline = 'middle';
  ctx.fillText('Mám se!', P + 84, y + 34);
  y += 70 + 16;
  ctx.textBaseline = 'top';
  ctx.font = '500 62px ' + serif; ctx.fillStyle = '#1F2A26';
  ctx.fillText('Snímek dne', P, y);
  y += 72;
  ctx.font = '400 36px ' + sans; ctx.fillStyle = '#5E6B65';
  ctx.fillText(nazevDne.charAt(0).toUpperCase() + nazevDne.slice(1), P, y);
  y += 50 + 30;

  // Karta dne (v barvě dne)
  const vyskaKarty = 48 + radkySouhrnu.length * 48 + (radkyChvil.length ? 16 + radkyChvil.length * 46 : 0) + 48;
  zaoblenyObdelnik(ctx, P, y, SIRKA, vyskaKarty, 36);
  ctx.fillStyle = d.barvaDne || '#FFFDF9'; ctx.fill();
  if (!d.barvaDne) { ctx.strokeStyle = '#E6DED2'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.fillStyle = d.barvaDne ? inkoustPro(d.barvaDne) : '#1F2A26';
  let yy = y + 48;
  ctx.font = '400 34px ' + sans;
  for (const r of radkySouhrnu) { ctx.fillText(r, P + 32, yy); yy += 48; }
  if (radkyChvil.length) { yy += 16; for (const r of radkyChvil) { ctx.fillText(r, P + 32, yy); yy += 46; } }
  y += vyskaKarty + 32;

  // Oslava (jen když ji člověk zaškrtl)
  if (vyskaOslav) {
    zaoblenyObdelnik(ctx, P, y, SIRKA, vyskaOslav, 36);
    ctx.fillStyle = '#FDF3DC'; ctx.fill();
    ctx.strokeStyle = '#F5BE4B'; ctx.lineWidth = 3; ctx.stroke();
    let yo = y + 40;
    oslavyKresba.forEach((o, i) => {
      if (i) yo += 30;
      ctx.fillStyle = '#1F2A26'; ctx.font = '500 34px ' + serif;
      for (const r of o.text) { ctx.fillText(r, P + 32, yo); yo += 46; }
      if (o.skl.radku) { yo += 10; nakresliSklenicky(ctx, o.skl, P + 32, yo); yo += o.skl.radku * SKL_RADEK; }
      ctx.fillStyle = '#1F2A26'; ctx.font = '500 34px ' + serif;
      for (const r of o.dik) { ctx.fillText(r, P + 32, yo); yo += 46; }
    });
    ctx.font = '400 34px ' + sans;
    y += vyskaOslav + 32;
  }

  // Průběh dne
  if (sBloky.length) {
    ctx.fillStyle = '#1F2A26'; ctx.font = '500 38px ' + serif; ctx.fillText('Složení dne', P, y); y += 56;
    const celkem = sBloky.reduce((s, b) => s + b.delkaMin, 0), mezera = 4;
    let x = P; const sirkaPruhu = SIRKA - mezera * (sBloky.length - 1);
    const soucty = {};
    for (const b of sBloky) {
      const k = kategorie(b.hodnotit ? b.prijemnost : null);
      soucty[k] = (soucty[k] || 0) + b.delkaMin;
      const w = Math.max(10, sirkaPruhu * b.delkaMin / celkem);
      zaoblenyObdelnik(ctx, x, y, w, 56, 8);
      if (k === 'nepopsana') {
        ctx.fillStyle = '#EFEAE2'; ctx.fill(); ctx.save(); ctx.clip();
        ctx.strokeStyle = '#DCD3C6'; ctx.lineWidth = 4;
        for (let s = -60; s < w + 60; s += 14) { ctx.beginPath(); ctx.moveTo(x + s, y + 56); ctx.lineTo(x + s + 56, y); ctx.stroke(); }
        ctx.restore();
      } else { ctx.fillStyle = KATEGORIE[k].barva; ctx.fill(); }
      x += w + mezera;
    }
    y += 56 + 24;
    // legenda
    ctx.font = '400 28px ' + sans; let lx = P;
    for (const k of Object.keys(KATEGORIE).filter(k => soucty[k])) {
      const popis = KATEGORIE[k].text + ' · ' + d.hodiny(soucty[k]);
      const sirka = 28 + 12 + ctx.measureText(popis).width + 32;
      if (lx + sirka > P + SIRKA) { lx = P; y += 40; }
      zaoblenyObdelnik(ctx, lx, y + 2, 28, 28, 6);
      ctx.fillStyle = k === 'nepopsana' ? '#DCD3C6' : KATEGORIE[k].barva; ctx.fill();
      ctx.fillStyle = '#1F2A26'; ctx.fillText(popis, lx + 40, y);
      lx += sirka;
    }
    y += 60 + 32;
  }

  // Během dne
  if (okamzite.length) {
    ctx.fillStyle = '#1F2A26'; ctx.font = '500 38px ' + serif; ctx.fillText('Během dne', P, y); y += 50;
    const minuty = z => { const t = new Date(z.chvile_od); return t.getHours() * 60 + t.getMinutes(); };
    const od = Math.min(360, ...okamzite.map(o => minuty(o.z))), doM = 1440;
    ctx.fillStyle = '#E6DED2'; ctx.fillRect(P, y + 24, SIRKA, 4);
    for (const o of okamzite) {
      const x = P + ((minuty(o.z) - od) / (doM - od)) * SIRKA, k = kategorie(o.z.prijemnost);
      ctx.beginPath(); ctx.arc(x, y + 26, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#F7F2EA'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y + 26, 14, 0, Math.PI * 2);
      ctx.fillStyle = k === 'nepopsana' ? '#DCD3C6' : KATEGORIE[k].barva; ctx.fill();
    }
    y += 50;
    ctx.font = '400 24px ' + sans; ctx.fillStyle = '#5E6B65';
    for (let hod = Math.ceil(od / 360) * 6; hod <= 24; hod += 6) {
      const x = P + ((hod * 60 - od) / (doM - od)) * SIRKA, t = hod + ':00';
      ctx.fillText(t, Math.min(P + SIRKA - ctx.measureText(t).width, Math.max(P, x - ctx.measureText(t).width / 2)), y);
    }
    y += 50;
    ctx.font = '400 32px ' + sans; ctx.fillStyle = '#1F2A26';
    for (const r of radkyOkamzitych) { ctx.fillText(r, P, y); y += 46; }
    y += 32;
  }

  // Miniatury fotek (doplněk) – celé, jen zmenšené
  if (fotky.length) {
    for (const f of fotky) {
      const fx = P + f.x, fy = y + f.radek * (VYSKA_FOTKY + MEZERA);
      const fh = f.w < f.img.width * VYSKA_FOTKY / f.img.height ? f.img.height * f.w / f.img.width : VYSKA_FOTKY;
      ctx.save(); zaoblenyObdelnik(ctx, fx, fy, f.w, fh, 16); ctx.clip();
      ctx.drawImage(f.img, fx, fy, f.w, fh);
      ctx.restore();
    }
    y += radkuFotek * (VYSKA_FOTKY + MEZERA) + 32;
  }

  // Patička
  ctx.font = '400 26px ' + sans; ctx.fillStyle = '#5E6B65';
  ctx.fillText('Z aplikace Mám se! od Emer · mimonadovna.cz', P, H - P - 30);

  // Příběh (Facebook, Instagram, WhatsApp): 1080 × 1920, obsah vystředěný.
  let vysledek = platno;
  if (sdileni.format === 'pribeh') {
    vysledek = document.createElement('canvas');
    vysledek.width = 1080; vysledek.height = 1920;
    const c2 = vysledek.getContext('2d');
    c2.fillStyle = '#F7F2EA'; c2.fillRect(0, 0, 1080, 1920);
    const meritko = Math.min(1, 1920 / H);
    const w = W * meritko, v2 = H * meritko;
    c2.drawImage(platno, (1080 - w) / 2, (1920 - v2) / 2, w, v2);
  }
  return new Promise(hotovo => vysledek.toBlob(hotovo, 'image/png'));
}

// Oslavy dne ve shrnutí
function kartaOslav(oslavy) {
  if (!oslavy.length) return '';
  const zpet = location.hash;
  return '<section class="karta"><h2>Oslavy dne</h2><div class="seznam">' +
    oslavy.map(z => radekSeznamu({ druh: 'zaznam', z })).join('') + '</div><div class="odkazy">' +
    oslavy.map(z => '<button type="button" class="tlacitko obrys male-t" data-akce="oslavaSdilet" data-id="' + h(z.id) + '" data-zpet="' + h(zpet) + '">Sdílet ' +
      (oslavy.length > 1 ? '„' + h((z.vlastni_slova || 'oslavu').slice(0, 24)) + ((z.vlastni_slova || '').length > 24 ? '…' : '') + '“' : 'oslavu') + '</button>').join('') +
    '</div></section>';
}

// ---------------- GRAFIKA DNE ----------------
// Barvy podle toho, jaká chvíle byla (stejné jako v Přehledu):
// příjemná = svěží zelená, ani tak ani tak = béžová, nepříjemná = medová.
// Nepopsané bloky („neurčeno“) jsou šrafované. Barva nikdy nenese význam sama –
// vždy je u ní i legenda a čísla.
const KATEGORIE = {
  prijemna:   { text: 'příjemná',          barva: '#72B97F' },
  neutralni:  { text: 'ani tak, ani tak',  barva: '#D8CFC0' },
  neprijemna: { text: 'nepříjemná',        barva: '#E6B173' },
  nepopsana:  { text: 'neurčeno',          barva: null }
};
function kategorie(prijemnost) {
  if (prijemnost == null) return 'nepopsana';
  return prijemnost > 0 ? 'prijemna' : prijemnost < 0 ? 'neprijemna' : 'neutralni';
}
function stylKategorie(k) {
  return k === 'nepopsana'
    ? 'background: repeating-linear-gradient(45deg, #EFEAE2 0 4px, #DCD3C6 4px 6px)'
    : 'background:' + KATEGORIE[k].barva;
}

// Průběh dne: bloky za sebou, šířka podle délky.
function grafBloku(bloky, hodiny) {
  // Seřazeno jako legenda: příjemná, ani tak ani tak, nepříjemná, neurčeno
  // (uvnitř skupiny v pořadí dne).
  const poradiKat = Object.keys(KATEGORIE);
  const katBloku = b => kategorie(b.hodnotit ? b.prijemnost : null);
  const sDelkou = bloky.filter(b => b.delkaMin)
    .map((b, i) => ({ b, i })).sort((x, y) => poradiKat.indexOf(katBloku(x.b)) - poradiKat.indexOf(katBloku(y.b)) || x.i - y.i).map(x => x.b);
  if (!sDelkou.length) return '';
  const celkem = sDelkou.reduce((s, b) => s + b.delkaMin, 0);
  const soucty = {};
  let pruh = '';
  for (const b of sDelkou) {
    const k = kategorie(b.hodnotit ? b.prijemnost : null);
    soucty[k] = (soucty[k] || 0) + b.delkaMin;
    const popisek = titulekBloku(b, 'blok') + ', ' + delkaText(b.delkaMin) + ', ' + KATEGORIE[k].text;
    pruh += '<span class="segment" style="flex:' + b.delkaMin + ';' + stylKategorie(k) + '" title="' + h(popisek) + '" aria-label="' + h(popisek) + '" role="img"></span>';
  }
  const legenda = Object.keys(KATEGORIE).filter(k => soucty[k]).map(k =>
    '<span class="legenda-polozka"><span class="legenda-znak" style="' + stylKategorie(k) + '"></span>' + KATEGORIE[k].text + ' · ' + hodiny(soucty[k]) + '</span>').join('');
  return '<section class="karta"><h2>Složení dne</h2>' +
    '<div class="pruh-dne" aria-label="Bloky dne podle délky, seřazené jako legenda">' + pruh + '</div>' +
    '<div class="legenda">' + legenda + '</div></section>';
}

// Okamžité záznamy na ose dne (podle času), pod tím seznam.
function grafOkamzitych(zaznamy) {
  if (!zaznamy.length) return '';
  const minuty = z => { const d = new Date(z.chvile_od); return d.getHours() * 60 + d.getMinutes(); };
  const od = Math.min(6 * 60, ...zaznamy.map(minuty)), doMin = 24 * 60;
  let body = '';
  for (const z of zaznamy) {
    const k = kategorie(z.prijemnost);
    const x = ((minuty(z) - od) / (doMin - od)) * 100;
    const cas = new Date(z.chvile_od).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    body += '<a class="bod" href="#/detail/' + encodeURIComponent(z.id) + '" style="left:' + x.toFixed(1) + '%;' + stylKategorie(k) +
      '" aria-label="' + cas + ', ' + KATEGORIE[k].text + '"></a>';
  }
  let popisky = '';
  for (let hod = Math.ceil(od / 360) * 6; hod <= 24; hod += 6) {
    popisky += '<span style="left:' + (((hod * 60 - od) / (doMin - od)) * 100).toFixed(1) + '%">' + hod + ':00</span>';
  }
  const seznam = zaznamy.map(z => {
    const p = z.prijemnost;
    const popis = shrnutiZaznamu(z);
    return '<a class="zaznam-radek" href="#/detail/' + encodeURIComponent(z.id) + '"><span class="znamka' +
      (p == null ? '' : p > 0 ? ' prijemna' : p < 0 ? ' neprijemna' : '') + '">' + (p == null ? '–' : p > 0 ? '+' + p : p) + '</span>' +
      '<div><div class="tlumene male">' + new Date(z.chvile_od).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) + '</div>' +
      '<div>' + h(popis.slice(0, 80)) + '</div></div>' +
      (z.fotka ? '<img class="miniatura" src="' + urlFotky(z.fotka) + '" alt="">' : '<span class="sipka" aria-hidden="true">›</span>') + '</a>';
  }).join('');
  return '<section class="karta"><h2>Během dne</h2>' +
    '<div class="osa-dne" aria-label="Okamžité záznamy podle času"><span class="osa-cara"></span>' + body + '</div>' +
    '<div class="osa-popisky tlumene male">' + popisky + '</div>' +
    '<div class="seznam">' + seznam + '</div></section>';
}

function nahledyFotek(zaznamy) {
  if (!zaznamy.length) return '';
  return '<section class="karta"><h2>Fotky dne</h2><div class="fotky-mrizka">' +
    zaznamy.map(z => '<a href="#/detail/' + encodeURIComponent(z.id) + '"><img src="' + urlFotky(z.fotka) + '" alt="Fotka u záznamu"></a>').join('') +
    '</div></section>';
}

// ---------------- OSLAVA DNE ----------------
// „Dnes chci oslavit…“ – vlastní slova, naplněné potřeby, komu poděkovat.
// Ukládá se jako záznam typu „oslava“. Tlačítko „Oslavit!“ spustí
// animaci podle skupiny nejplnější vybrané potřeby (viz js/oslava.js).

let oslava = null;
let posunTydne = 0;  // přehled týdnů na Domově: 0 = tento týden, -1 = minulý…
let prehled = { mesic: 0, den: null }; // Můj přehled: posun měsíce a vybraný den
let prosba = null;  // rozepsaná prosba (jen v paměti)
let sdileniOslavy = null; // sdílení jedné oslavy (obrázek s textem)
let posledniOslava = null; // naposledy uložená oslava – aby šla hned sdílet

function novaOslava(zpet, datum) {
  return { id: U.noveId(), vytvoreno: U.tedS(), datum: datum || U.datumDne(), zpet: zpet || '#/domov',
    text: '', potreby: {}, otevrenaSkupina: null, vlastniPotreba: false, podekovani: '', ulozena: false };
}

function oslavaZeZaznamu(z, zpet) {
  const o = novaOslava(zpet, z.chvile_od.slice(0, 10));
  Object.assign(o, { id: z.id, vytvoreno: z.vytvoreno, text: z.vlastni_slova || '', podekovani: z.podekovani || '', ulozena: true, puvodni: z });
  for (const p of z.potreby) o.potreby[p.potreba] = { naplneni: p.naplneni };
  return o;
}

// Barva dne pro animaci (jen když je barva dne zapnutá a zvolená).
async function barvaDneK(datum) {
  if (!nastaveni.barva_dne_zapnuta) return null;
  const den = await U.nactiDen(datum);
  return den && den.barva ? den.barva : null;
}

// Která animace: skupina potřeby s nejplnější skleničkou (při shodě ta první vybraná).
function druhOslavy(potreby) {
  let nejlepsi = null;
  for (const [potreba, v] of Object.entries(potreby)) {
    const skupina = S.skupinaPotreby(potreba);
    if (!skupina) continue;
    const n = v.naplneni ?? 0;
    if (!nejlepsi || n > nejlepsi.n) nejlepsi = { skupina, n };
  }
  return nejlepsi ? ANIMACE_PODLE_SKUPINY[nejlepsi.skupina] : 'konfety';
}

function obrazovkaOslava() {
  if (!oslava) oslava = novaOslava();
  const o = oslava;
  let skupiny = '';
  for (const g of S.POTREBY) {
    const maVybrane = g.potreby.some(p => o.potreby[p]);
    skupiny += cip(g.skupina, o.otevrenaSkupina === g.skupina || maVybrane, 'oslavaSkupina', { skupina: g.skupina });
  }
  skupiny += '<button type="button" class="cip pridat" data-akce="oslavaVlastniOtevrit">+ vlastní</button>';
  let panel = '';
  if (o.otevrenaSkupina) {
    const g = S.POTREBY.find(x => x.skupina === o.otevrenaSkupina);
    panel = '<div class="panel"><span class="panel-nadpis">Potřeby ve skupině „' + h(g.skupina) + '“</span><div class="cipy">' +
      g.potreby.map(p => cip(p, o.potreby[p], 'oslavaPotreba', { slovo: p })).join('') + '</div></div>';
  }
  const vlastni = o.vlastniPotreba
    ? '<div class="pole-radek"><input class="vstup" id="oslava-vlastni" placeholder="Tvoje slovo pro potřebu" autocomplete="off">' +
      '<button type="button" class="tlacitko male-t" data-akce="oslavaVlastniPridat">Přidat</button></div>' : '';
  let sklenicky = '';
  for (const [potreba, v] of Object.entries(o.potreby)) {
    let hladiny = '';
    for (let i = 0; i <= 4; i++) {
      hladiny += '<button type="button" data-akce="oslavaNaplneni" data-slovo="' + h(potreba) + '" data-hodnota="' + i +
        '" aria-pressed="' + (v.naplneni === i) + '" aria-label="' + h(potreba) + ': naplnění ' + i + ' ze 4">' + i + '</button>';
    }
    sklenicky += '<div class="sklenicka-radek">' + sklenicka(v.naplneni, false) + '<span class="jmeno">' + h(potreba) + '</span>' +
      '<div class="sklenicka-ovladani"><div class="hladiny" role="group" aria-label="Jak je naplněná">' + hladiny + '</div>' +
      '<button type="button" class="tlacitko obrys male-t" data-akce="oslavaPotreba" data-slovo="' + h(potreba) + '">Odebrat</button></div></div>';
  }
  const pole = (cil, id, popisek, placeholder) => '<div class="pole"><textarea id="' + id + '" rows="3" data-oslava-pole="' + cil + '" aria-label="' + h(popisek) + '"' +
    (placeholder ? ' placeholder="' + h(placeholder) + '"' : '') + '>' + h(o[cil]) + '</textarea>' +
    (tlacitkoDiktovani(cil === 'text' ? 'oslavaText' : 'oslavaDik') ? '<div class="pole-radek"><span></span>' + tlacitkoDiktovani(cil === 'text' ? 'oslavaText' : 'oslavaDik') + '</div>' : '') + '</div>';

  return '<header class="hlavicka">' +
      '<a class="ikona-tlacitko bez-okraje" href="' + o.zpet + '" aria-label="Zpět">' + IKONA.zpet + '</a>' +
      '<span class="nazev-obrazovky">Oslava</span></header>' +
    '<main class="obsah">' +
      '<div class="oddil" style="border-top:none;padding-top:0;margin-top:0"><label class="oddil-nadpis" for="oslava-text" style="font-size:26px">Dnes chci oslavit…</label>' +
        pole('text', 'oslava-text', 'Dnes chci oslavit', 'Napiš nebo nadiktuj, co se povedlo, co Tě potěšilo…') + '</div>' +
      '<div class="oddil"><h3 class="oddil-nadpis">Jaké potřeby byly naplněny?</h3>' +
        '<div class="cipy">' + skupiny + '</div>' + vlastni + panel +
        (sklenicky ? '<div class="vybrane">' + sklenicky + '</div>' : '') + '</div>' +
      '<div class="oddil"><label class="oddil-nadpis" for="oslava-dik">Komu chci poděkovat?' +
        '<span class="oddil-pozn">Klidně můžeš poděkovat sobě nebo celému světu.</span></label>' +
        pole('podekovani', 'oslava-dik', 'Komu chci poděkovat') + '</div>' +
    '</main>' +
    '<footer class="spodni-lista">' +
      '<button type="button" class="tlacitko obrys" data-akce="oslavaUlozit">Takhle je to dobré</button>' +
      '<button type="button" class="tlacitko" data-akce="oslavaUlozit" data-oslavit="1">Oslavit!</button>' +
    '</footer>';
}

async function ulozOslavu() {
  const o = oslava;
  const kdy = o.datum === U.datumDne() ? (o.puvodni ? o.puvodni.chvile_od : U.tedS()) : U.tedS(new Date(o.datum + 'T20:00:00'));
  const zaznam = Object.assign({}, o.puvodni || {}, {
    id: o.id, typ: 'oslava', vytvoreno: o.vytvoreno, upraveno: o.ulozena ? U.tedS() : null,
    chvile_od: kdy, chvile_delka_min: null, poradi: null, smysluplnost: null,
    prijemnost: null, vlastni_slova: o.text.trim(), podekovani: o.podekovani.trim(),
    emoce: [], telo: [], strategie: '', prosba: '', cinnost: [], s_kym: [], kde: null, vyzkum: null,
    fotka: (o.puvodni && o.puvodni.fotka) || null,
    potreby: Object.entries(o.potreby).map(([potreba, v]) => ({ potreba, skupina: S.skupinaPotreby(potreba), naplneni: v.naplneni, skripnuta: false })),
    zdroj_textu: o.text.trim() ? 'psano' : null,
    verze_protokolu: S.VERZE_PROTOKOLU
  });
  await U.ulozZaznam(zaznam);
  o.ulozena = true; o.puvodni = zaznam;
  return zaznam;
}

// ---------------- SDÍLENÍ OSLAVY ----------------
// Obrázek „Dnes oslavuji“ v barvě dne s konfetami. Odejde jen to, co je v náhledu.

function noveSdileniOslavy(z, zpet) {
  return { z, zpet, dik: !!z.podekovani, potreby: true, format: 'prispevek', komentar: '', obrazek: null, klic: null, pripravuji: false };
}

async function nakresliOslavu(so, barvaDne) {
  const z = so.z, W = 1080, P = 72, SIRKA = W - 2 * P;
  const serif = '"Fraunces", Georgia, serif', sans = '"Inter", system-ui, sans-serif';
  try { await document.fonts.ready; } catch (e) { /* písmo není nutné */ }
  const platno = document.createElement('canvas');
  const ctx = platno.getContext('2d');
  const datum = new Date(z.chvile_od);
  const nazevDne = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }).format(datum);
  const barva = barvaDne || '#F5BE4B';
  const inkoust = inkoustPro(barva);

  ctx.font = '500 56px ' + serif;
  const radkyTextu = zalomText(ctx, z.vlastni_slova || 'Něco, co stojí za oslavu.', SIRKA - 2 * 64);
  ctx.font = '500 38px ' + serif;
  const radkyDiku = so.dik && z.podekovani ? zalomText(ctx, 'Děkuji: ' + z.podekovani, SIRKA) : [];
  const skl = so.potreby && z.potreby.length ? rozvrhniSklenicky(ctx, z.potreby, SIRKA, '400 32px ' + sans) : { radku: 0, polozky: [] };

  const vyskaKarty = 72 + radkyTextu.length * 72 + 56;
  let H = P + 70 + 60 + 80 + 50 + 50 + vyskaKarty + 40;
  if (radkyDiku.length) H += radkyDiku.length * 52 + 24;
  if (skl.radku) H += 44 + skl.radku * SKL_RADEK + 24;
  H += 60 + P;
  H = Math.max(H, 1080);
  platno.width = W; platno.height = H;
  ctx.fillStyle = '#F7F2EA'; ctx.fillRect(0, 0, W, H);

  // Konfety (vždy stejně rozházené – podle id oslavy)
  let semeno = [...z.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const nahodne = () => { semeno = (semeno * 1664525 + 1013904223) >>> 0; return semeno / 4294967296; };
  const barvyKonfet = [barva, '#246B56', '#E6B173', '#72B97F', '#F5BE4B', '#C9706B', '#4F7CA8', barva];
  for (let i = 0; i < 160; i++) {
    const x = nahodne() * W, yk = nahodne() * H;
    // nechat volné místo pro text uprostřed
    if (x > P - 20 && x < W - P + 20 && yk > P + 110) continue;   // konfety jen po okrajích, ne přes text
    if (x < P + 340 && yk < P + 90) continue;          // ani přes logo a název
    ctx.save(); ctx.translate(x, yk); ctx.rotate(nahodne() * Math.PI);
    ctx.fillStyle = barvyKonfet[i % barvyKonfet.length];
    if (i % 3 === 0) { ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-8, -14, 16, 28);
    ctx.restore();
  }

  let y = P;
  try { const logo = await nactiObrazek('ikony/logo.svg'); ctx.drawImage(logo, P, y, 64, 64); } catch (e) { /* bez loga */ }
  ctx.fillStyle = '#1F2A26'; ctx.font = '600 44px ' + serif; ctx.textBaseline = 'middle';
  ctx.fillText('Mám se!', P + 84, y + 34);
  y += 70 + 60;
  ctx.textBaseline = 'top';
  ctx.font = '500 72px ' + serif; ctx.fillStyle = '#1F2A26';
  ctx.fillText('Dnes oslavuji', P, y); y += 80;
  ctx.font = '400 36px ' + sans; ctx.fillStyle = '#5E6B65';
  ctx.fillText(nazevDne.charAt(0).toUpperCase() + nazevDne.slice(1), P, y); y += 50 + 50;

  zaoblenyObdelnik(ctx, P, y, SIRKA, vyskaKarty, 40);
  ctx.fillStyle = barva; ctx.fill();
  ctx.strokeStyle = tmavsiBarva(barva); ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = inkoust; ctx.font = '500 56px ' + serif; ctx.textAlign = 'center';
  let yt = y + 72;
  for (const r of radkyTextu) { ctx.fillText(r, W / 2, yt); yt += 72; }
  ctx.textAlign = 'left';
  y += vyskaKarty + 40;
  if (skl.radku) {
    ctx.fillStyle = '#3E6B5A'; ctx.font = '400 30px ' + sans;
    ctx.fillText('Naplněné potřeby:', P, y); y += 44;
    nakresliSklenicky(ctx, skl, P, y); y += skl.radku * SKL_RADEK + 24;
  }
  if (radkyDiku.length) {
    ctx.fillStyle = '#1F2A26'; ctx.font = '500 38px ' + serif;
    for (const r of radkyDiku) { ctx.fillText(r, P, y); y += 52; }
    y += 24;
  }
  ctx.font = '400 26px ' + sans; ctx.fillStyle = '#5E6B65';
  ctx.fillText('Z aplikace Mám se! od Emer · mimonadovna.cz', P, H - P - 30);

  let vysledek = platno;
  if (so.format === 'pribeh') {
    vysledek = document.createElement('canvas');
    vysledek.width = 1080; vysledek.height = 1920;
    const c2 = vysledek.getContext('2d');
    c2.fillStyle = '#F7F2EA'; c2.fillRect(0, 0, 1080, 1920);
    const m = Math.min(1, 1920 / H);
    c2.drawImage(platno, (1080 - W * m) / 2, (1920 - H * m) / 2, W * m, H * m);
  }
  return new Promise(hotovo => vysledek.toBlob(hotovo, 'image/png'));
}

// Tmavší odstín pro obrys (aby byla vidět i světlá barva dne).
function tmavsiBarva(hex) {
  const n = parseInt(hex.slice(1), 16);
  const k = .75, r = Math.round((n >> 16) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function textOslavy(so) {
  const z = so.z, r = [];
  if (so.komentar.trim()) r.push(so.komentar.trim());
  r.push('Dnes oslavuji: ' + (z.vlastni_slova || 'něco, co stojí za oslavu.'));
  if (so.potreby && z.potreby.length) r.push('Naplněné potřeby: ' + z.potreby.map(p => p.potreba).join(', '));
  if (so.dik && z.podekovani) r.push('Děkuji: ' + z.podekovani);
  return r.join('\n');
}

async function obrazovkaSdiletOslavu() {
  const so = sdileniOslavy;
  if (!so) { location.hash = '#/domov'; return ''; }
  const z = so.z;
  const barvaDne = await barvaDneK(z.chvile_od.slice(0, 10));
  const klic = [so.dik, so.potreby, so.format, barvaDne].join('|');
  if (so.klic !== klic && !so.pripravuji) {
    so.pripravuji = true;
    nakresliOslavu(so, barvaDne).then(blob => {
      if (so.obrazek) URL.revokeObjectURL(so.obrazek.url);
      so.obrazek = { blob, url: URL.createObjectURL(blob) };
      so.klic = klic; so.pripravuji = false;
      if (sdileniOslavy === so) prekresli();
    });
  }
  const hotovo = so.obrazek && so.klic === klic;
  const vyp = hotovo ? '' : ' disabled';
  return '<header class="hlavicka">' +
      '<a class="ikona-tlacitko bez-okraje" href="' + h(so.zpet) + '" aria-label="Zpět">' + IKONA.zpet + '</a>' +
      '<span class="nazev-obrazovky">Sdílet oslavu</span></header>' +
    '<main class="obsah">' +
      '<p class="tlumene male">Odejde jen tenhle obrázek s textem – nic jiného. Komu a kudy (zpráva, e-mail, chat) si vybereš ' + tvar('sama', 'sám') + '.</p>' +
      (hotovo ? '<img class="nahled-snimku" src="' + so.obrazek.url + '" alt="Náhled obrázku oslavy">' : '<p class="tlumene">Připravuji náhled…</p>') +
      '<section class="karta">' +
        '<span class="panel-nadpis">Tvar obrázku</span><div class="cipy">' +
          cip('příspěvek', so.format === 'prispevek', 'oslavaSdiletFormat', { format: 'prispevek' }) +
          cip('příběh (na výšku)', so.format === 'pribeh', 'oslavaSdiletFormat', { format: 'pribeh' }) + '</div>' +
        (z.podekovani ? '<label class="prepinac-maly"><input type="checkbox" data-akce="oslavaSdiletDik"' + (so.dik ? ' checked' : '') + '>Přidat poděkování</label>' : '') +
        (z.potreby.length ? '<label class="prepinac-maly"><input type="checkbox" data-akce="oslavaSdiletPotreby"' + (so.potreby ? ' checked' : '') + '>Přidat naplněné potřeby</label>' : '') +
        '<label class="panel-nadpis" for="oslava-komentar">Tvůj komentář ke sdílení (nepovinné)</label>' +
        '<input class="vstup" id="oslava-komentar" data-oslava-komentar="1" maxlength="120" value="' + h(so.komentar) + '" placeholder="Třeba: Tohle jsem prostě ' + tvar('musela', 'musel') + ' oslavit!" autocomplete="off">' +
        '<p class="tlumene male">Komentář se nepřidá do obrázku – pošle se jako text k němu.</p>' +
      '</section>' +
      '<div class="odkazy svisle">' +
        '<button type="button" class="tlacitko" data-akce="oslavaSdiletTed"' + vyp + '>Sdílet</button>' +
        '<div class="dvojice"><button type="button" class="tlacitko obrys" data-akce="oslavaSdiletStahnout"' + vyp + '>Uložit obrázek</button>' +
        '<button type="button" class="tlacitko obrys" data-akce="oslavaSdiletKopirovat">Zkopírovat text</button></div>' +
      '</div>' +
    '</main>';
}

// ---------------- DETAIL ZÁZNAMU ----------------
async function obrazovkaDetail(id) {
  const z = await U.nactiZaznam(id);
  if (!z) return '<main class="obsah"><h1>Záznam nenalezen</h1><a class="tlacitko" href="#/domov">Domů</a></main>';

  const radek = (nadpis, obsah) => obsah ? '<div style="display:flex;flex-direction:column;gap:4px"><span class="panel-nadpis">' + nadpis + '</span><div>' + obsah + '</div></div>' : '';
  const sila = v => v != null ? ' <span class="tlumene">' + v + '/6</span>' : '';
  const prijemnost = z.prijemnost == null ? '' : (z.prijemnost > 0 ? '+' + z.prijemnost : String(z.prijemnost));
  const smery = Object.fromEntries(S.SMER_HNEVU.map(x => [x.kod, x.text]));

  const emoce = z.emoce.map(e => h(e.slovo) + sila(e.intenzita) +
    (e.smer ? ' <span class="tlumene">(' + h(smery[e.smer] || e.smer) + ')</span>' : '') +
    (e.pod_tim ? ' <span class="tlumene">· pod tím: ' + h(e.pod_tim) + '</span>' : '')).join('<br>');
  const telo = z.telo.map(t => h(t.pocit) + sila(t.intenzita) +
    (t.kde ? ' <span class="tlumene">· ' + h(t.kde) + '</span>' : '') +
    (t.upresneni ? '<br><span class="tlumene">„' + h(t.upresneni) + '“</span>' : '')).join('<br>');
  const potreby = z.potreby.map(p => '<div class="sklenicka-radek">' + sklenicka(p.naplneni, p.skripnuta) +
    '<span class="jmeno">' + h(p.potreba) + '</span><span class="tlumene male">' +
    (p.naplneni != null ? p.naplneni + ' ze 4' : '') + (p.skripnuta ? ' · skřípnutá' : '') + '</span></div>').join('');
  const kolem = [z.cinnost.join(', '), z.s_kym.join(', '), z.kde].filter(Boolean).map(h).join('<br>');
  const vyzkum = z.vyzkum ? S.VYZKUM.filter(v => z.vyzkum[v.klic] != null).map(v => h(v.text) + ': ' + z.vyzkum[v.klic]).join(' · ') : '';

  const mazani = mazaniZaznamu === z.id
    ? '<p>Opravdu smazat tento záznam? Vrátit to půjde jen ze zálohy.</p><div class="odkazy"><button type="button" class="tlacitko male-t" data-akce="smazatZaznamAno" data-id="' + h(z.id) + '">Ano, smazat</button>' +
      '<button type="button" class="tlacitko obrys male-t" data-akce="smazatZaznamNe">Ne, nechat</button></div>'
    : '<button type="button" class="tlacitko obrys male-t" style="align-self:flex-start" data-akce="smazatZaznam" data-id="' + h(z.id) + '">Smazat záznam</button>';

  return '<header class="hlavicka">' +
      '<a class="ikona-tlacitko bez-okraje" href="#/domov" aria-label="Zpět na Domov">' + IKONA.zpet + '</a>' +
      '<span class="nazev-obrazovky">Záznam · ' + h(popisCasu(z)) + '</span></header>' +
    '<main class="obsah">' +
      '<section class="karta">' +
        radek('Jaká byla chvíle', prijemnost) +
        (z.fotka ? '<img class="fotka-velka" src="' + urlFotky(z.fotka) + '" alt="Fotka u záznamu">' : '') +
        radek('Kus dne', z.popis_bloku ? h(z.popis_bloku) : '') +
        (z.typ === 'oslava' ? radek('Dnes chci oslavit…', h(z.vlastni_slova)) + radek('Poděkování', h(z.podekovani || '')) : '') +
        radek('Vlastními slovy', z.typ !== 'oslava' && z.vlastni_slova ? h(z.vlastni_slova).replace(/\n/g, '<br>') : '') +
        radek('Emoce', emoce) +
        radek('V těle', telo) +
        (potreby ? '<div style="display:flex;flex-direction:column;gap:6px"><span class="panel-nadpis">Potřeby</span>' + potreby + '</div>' : '') +
        radek('Kolem', kolem) +
        radek('Jak dlouho', z.chvile_delka_min ? h((S.DELKY.find(x => x.min === z.chvile_delka_min) || {}).text || z.chvile_delka_min + ' min') : '') +
        radek('Jak smysluplné to bylo', z.smysluplnost != null ? z.smysluplnost + ' z 6' : '') +
        radek('Co by mi mohlo udělat dobře', h(z.strategie)) +
        (z.prosba ? radek('Prosba', h(z.prosba) + '<div class="odkazy" style="margin-top:6px"><button type="button" class="tlacitko obrys male-t" data-akce="prosbaZacit" data-id="' + h(z.id) + '" data-zpet="#/detail/' + encodeURIComponent(z.id) + '">Poslat prosbu</button></div>') : '') +
        radek('Pro výzkum', vyzkum) +
        (z.upraveno ? '<p class="tlumene male">Doplněno ' + h(casZaznamu(z.upraveno)) + '</p>' : '') +
      '</section>' +
      (z.typ === 'oslava'
        ? '<div class="odkazy"><button type="button" class="tlacitko" data-akce="oslavaZnovu" data-id="' + h(z.id) + '">Oslavit znovu!</button>' +
          '<button type="button" class="tlacitko obrys" data-akce="oslavaSdilet" data-id="' + h(z.id) + '">Sdílet</button>' +
          '<button type="button" class="tlacitko obrys" data-akce="oslavaUpravit" data-id="' + h(z.id) + '">Upravit</button></div>'
        : '<button type="button" class="tlacitko" style="align-self:flex-start" data-akce="upravitZaznam" data-id="' + h(z.id) + '">Doplnit nebo upravit</button>') +
      mazani +
    '</main>';
}

// Uložený záznam zpět do rozepsané podoby (aby šel doplnit nebo upravit).
function konceptZeZaznamu(z) {
  const k = novyKoncept();
  Object.assign(k, {
    id: z.id, vytvoreno: z.vytvoreno, upraveno: z.upraveno, ulozeno: true,
    typ: z.typ || 'okamzity', chvileOd: z.typ === 'vecerni' ? z.chvile_od : null,
    poradi: z.poradi ?? null, delkaMin: z.chvile_delka_min ?? null, smysluplnost: z.smysluplnost ?? null,
    prijemnost: z.prijemnost, text: z.vlastni_slova || '',
    zdroj: { psano: z.zdroj_textu === 'psano' || z.zdroj_textu === 'obe', diktovano: z.zdroj_textu === 'diktovano' || z.zdroj_textu === 'obe' },
    strategie: z.strategie || '', prosba: z.prosba || '',
    cinnost: [...(z.cinnost || [])], sKym: [...(z.s_kym || [])], kde: z.kde || null
  });
  for (const e of z.emoce) {
    k.emoce[e.slovo] = { intenzita: e.intenzita };
    if (e.smer) k.smer = e.smer;
    if (e.pod_tim) { k.podTim = e.pod_tim.split(', '); k.podTimOtevreno = true; }
  }
  for (const t of z.telo) {
    k.telo[t.pocit] = { intenzita: t.intenzita };
    if (t.pocit === 'bolest' && (t.kde || t.upresneni)) {
      k.bolestUpresnit = true;
      k.bolestKde = t.kde ? t.kde.split(', ') : [];
      k.bolestSlova = t.upresneni || '';
    }
  }
  k.fotka = z.fotka || null;
  for (const p of z.potreby) k.potreby[p.potreba] = { naplneni: p.naplneni, skripnuta: p.skripnuta };
  if (z.vyzkum) for (const [klic, v] of Object.entries(z.vyzkum)) if (v != null) k.vyzkum[klic] = v;
  return k;
}

// Části druhého kroku. Při doplňování (k.fokus) ukážeme jen tu jednu, rozbalenou.
function vyberCasti(k, casti) {
  return casti
    .filter(([klic]) => !k.fokus || k.fokus === klic)
    .map(([klic, vyplneno, nadpis, obsah]) =>
      '<details class="karta" data-cast="' + klic + '"' + (vyplneno || k.fokus === klic ? ' open' : '') + '><summary>' + nadpis + '</summary>' + obsah + '</details>')
    .join('');
}

// Které části záznamu ještě nejsou vyplněné (pro nabídku po uložení).
function chybejiciCasti(k) {
  const chybi = [];
  if (k.prijemnost == null || (!Object.keys(k.emoce).length && !k.text.trim())) chybi.push(['zaklad', 'Jaká je chvíle a co cítíš']);
  if (!Object.keys(k.telo).length) chybi.push(['telo', 'Co cítíš v těle']);
  if (!Object.keys(k.potreby).length) chybi.push(['potreby', 'Co je teď živé (potřeby)']);
  if (!k.cinnost.length && !k.sKym.length && !k.kde) chybi.push(['kolem', 'Co se teď děje']);
  if (!k.strategie.trim() && !k.prosba.trim()) chybi.push(['pomuze', 'Co by Ti teď mohlo udělat dobře']);
  if (!k.fotka) chybi.push(['fotka', 'Fotka']);
  if (!Object.keys(k.vyzkum).length) chybi.push(['vyzkum', 'Pro výzkum']);
  return chybi;
}

// ---------------- HOTOVO ----------------
function obrazovkaHotovo() {
  if (!posledni) { location.hash = '#/domov'; return ''; }
  const z = posledni;
  const casti = [];
  if (z.prijemnost != null) casti.push('chvíle ' + (z.prijemnost > 0 ? '+' + z.prijemnost : z.prijemnost));
  if (z.emoce.length) casti.push(z.emoce.map(e => e.slovo).join(', '));
  if (z.potreby.length) casti.push(z.potreby.length + ' ' + (z.potreby.length === 1 ? 'potřeba' : 'potřeby'));

  // Nabídka částí, které v tomto záznamu ještě nejsou vyplněné.
  const chybi = posledniKoncept ? chybejiciCasti(posledniKoncept) : [];
  const dalsiNabidka = chybi.length
    ? '<section class="karta"><h2>Chceš zaznamenat ještě něco dalšího?</h2><div class="cipy">' +
      chybi.map(([cast, text]) => '<button type="button" class="cip" data-akce="doplnit" data-cast="' + cast + '">' + h(text) + '</button>').join('') +
      '</div><p class="tlumene male">Doplní se do stejného záznamu.</p></section>'
    : '';

  let karta = '';
  if (doporuceniKUkazani === 'bolest') {
    karta = '<section class="karta doporuceni"><h2>Bolest se Ti v posledních dnech vrací</h2>' +
      '<p>Možná by stálo za to říct o ní praktickému lékaři. A pro jistotu: aplikace <b>Záchranka</b> pomůže přivolat pomoc, kdyby bylo potřeba – i bez mluvení.</p>' +
      '<div class="odkazy"><a class="tlacitko male-t" href="https://play.google.com/store/search?q=Z%C3%A1chranka&c=apps" target="_blank" rel="noopener">Najít Záchranku</a></div>' +
      '<div class="odkazy"><button type="button" class="tlacitko obrys male-t" data-akce="odkliknout" data-co="zachranka" data-stav="uz_mam">Už ji mám</button>' +
      '<button type="button" class="tlacitko obrys male-t" data-akce="odkliknout" data-co="zachranka" data-stav="neukazovat">Neukazovat znovu</button></div>' +
      '<p class="tlumene male">Máš chronickou bolest? Upozorňování můžeš vypnout v Nastavení.</p></section>';
  }

  return '<header class="hlavicka"><div class="znacka"><img src="ikony/logo.svg" alt="">Mám se!</div></header>' +
    '<main class="obsah">' +
      '<h1>Uloženo.</h1>' +
      '<p>Díky, že ses na chvíli ' + tvar('zastavila', 'zastavil') + '.</p>' +
      (casti.length ? '<p class="tlumene">' + h(casti.join(' · ')) + '</p>' : '') +
      '<p class="tlumene male">Záznam je jen v tomto telefonu.</p>' +
      karta +
      dalsiNabidka +
      (z.prosba ? '<button type="button" class="tlacitko obrys" style="align-self:flex-start" data-akce="prosbaZacit" data-id="' + h(z.id) + '" data-zpet="#/hotovo">Poslat prosbu někomu blízkému</button>' : '') +
      (posledniOslava && posledniOslava.zpet === '#/hotovo'
        ? '<button type="button" class="tlacitko obrys" style="align-self:flex-start" data-akce="oslavaSdilet" data-id="' + h(posledniOslava.id) + '" data-zpet="#/hotovo">Sdílet oslavu</button>' : '') +
      '<div class="dvojice"><button type="button" class="tlacitko obrys" data-akce="oslavaZacit" data-zpet="#/hotovo">Dnes chci oslavit…</button>' +
      '<a class="tlacitko obrys" href="#/domov">Pro teď to stačí</a></div>' +
    '</main>';
}

// ---------------- PROSBA ----------------
// Poslední krok cesty od pocitu k potřebě: konkrétní prosba, kterou si člověk
// může poslat někomu blízkému. Aplikace nic neposílá sama – připraví zprávu
// a otevře SMS, e-mail nebo běžné sdílení telefonu. Vždy s náhledem.

function novaProsba(z, zpet) {
  return { zaznam: z || null, zpet: zpet || '#/domov', text: (z && z.prosba) || '', komu: null, ne: null,
    pridat: { emoce: false, telo: false, potreby: false, slova: false } };
}

// Co ze záznamu jde k prosbě přidat (jen to, co v něm opravdu je).
function castiKPridani(z) {
  if (!z) return [];
  const c = [];
  if (z.emoce && z.emoce.length) c.push(['emoce', 'Co cítím', 'Cítím: ' + z.emoce.map(e => e.slovo).join(', ')]);
  if (z.telo && z.telo.length) c.push(['telo', 'Co cítím v těle', 'V těle: ' + z.telo.map(t => t.pocit + (t.kde ? ' (' + t.kde + ')' : '')).join(', ')]);
  if (z.potreby && z.potreby.length) c.push(['potreby', 'Co je pro mě teď důležité', 'Teď je pro mě důležité: ' + z.potreby.map(p => p.potreba).join(', ')]);
  if (z.vlastni_slova && z.typ !== 'oslava') c.push(['slova', 'Moje vlastní slova', '„' + z.vlastni_slova.trim() + '“']);
  return c;
}

function textProsby() {
  const p = prosba;
  let t = p.text.trim();
  const pridane = castiKPridani(p.zaznam).filter(([k]) => p.pridat[k]).map(x => x[2]);
  if (pridane.length) t += '\n\nJak se teď mám:\n' + pridane.join('\n');
  return t;
}

function obrazovkaProsba() {
  if (!prosba) { location.hash = '#/domov'; return ''; }
  const p = prosba;
  const kontakty = nastaveni.duveryhodne_kontakty;
  const cipKomu = (hodnota, text) => '<button type="button" class="cip' + (String(p.komu) === String(hodnota) ? ' zapnuto' : '') +
    '" data-akce="prosbaKomu" data-komu="' + hodnota + '" aria-pressed="' + (String(p.komu) === String(hodnota)) + '">' + h(text) + '</button>';
  const cipNe = (hodnota, text) => '<button type="button" class="cip' + (p.ne === hodnota ? ' zapnuto' : '') +
    '" data-akce="prosbaNe" data-odpoved="' + hodnota + '" aria-pressed="' + (p.ne === hodnota) + '">' + text + '</button>';

  const odpovedNe = p.ne === 'ano'
    ? '<p class="tlumene male">Díky tomu je to opravdu prosba – druhý se může svobodně rozhodnout.</p>'
    : p.ne === 'spis-ne'
      ? '<p class="tlumene male">Pak je to možná spíš požadavek. To je v pořádku – jen ho druhý může slyšet jako tlak. Můžeš si ji nechat uležet nebo ji zkusit napsat tak, aby šlo svobodně říct ne. Poslat ji můžeš i tak.</p>'
      : '';

  const casti = castiKPridani(p.zaznam);
  const pridat = casti.length
    ? '<section class="karta"><h2>Chceš přidat i něco ze svého záznamu?</h2>' +
      '<p class="tlumene male">Nic z toho nejde samo. Přidá se jen to, co zaškrtneš.</p>' +
      casti.map(([k, popisek, ukazka]) => '<label class="prepinac-maly"><input type="checkbox" data-akce="prosbaPridat" data-co="' + k + '"' +
        (p.pridat[k] ? ' checked' : '') + '><span>' + h(popisek) + '<br><span class="tlumene male">' + h(ukazka) + '</span></span></label>').join('') +
      '</section>'
    : '';

  let tlacitka = '';
  const prazdna = !p.text.trim();
  const vypnuto = prazdna ? ' disabled' : '';
  if (p.komu !== null) {
    const c = p.komu === 'jiny' ? null : kontakty[+p.komu];
    if (c && c.zpusob === 'telefon') tlacitka += '<button type="button" class="tlacitko" data-akce="prosbaPoslat" data-jak="sms"' + vypnuto + '>Poslat SMS – ' + h(c.jmeno) + '</button>';
    if (c && c.zpusob !== 'telefon') tlacitka += '<button type="button" class="tlacitko" data-akce="prosbaPoslat" data-jak="email"' + vypnuto + '>Poslat e-mail – ' + h(c.jmeno) + '</button>';
    tlacitka += '<button type="button" class="tlacitko' + (c ? ' obrys' : '') + '" data-akce="prosbaPoslat" data-jak="sdilet"' + vypnuto + '>' +
      (c ? 'Poslat jinak (WhatsApp, Messenger…)' : 'Sdílet (SMS, WhatsApp, e-mail…)') + '</button>' +
      '<button type="button" class="tlacitko obrys" data-akce="prosbaPoslat" data-jak="kopirovat"' + vypnuto + '>Zkopírovat text</button>';
  }

  return '<header class="hlavicka">' +
      '<a class="ikona-tlacitko bez-okraje" href="' + h(p.zpet) + '" aria-label="Zpět">' + IKONA.zpet + '</a>' +
      '<span class="nazev-obrazovky">Prosba</span></header>' +
    '<main class="obsah">' +
      '<h1>Poprosit o něco</h1>' +
      '<p class="tlumene">Prosba říká, co by Ti teď pomohlo – a druhému dává možnost to udělat.</p>' +
      '<section class="karta"><h2>Tvoje prosba</h2>' +
        '<div class="pole"><textarea id="prosba-text" rows="3" data-prosba-pole="text" aria-label="Tvoje prosba" placeholder="Např. Můžeš mi dnes večer zavolat? Stačí na deset minut.">' + h(p.text) + '</textarea>' +
        (tlacitkoDiktovani('prosbaText') ? '<div class="pole-radek"><span></span>' + tlacitkoDiktovani('prosbaText') + '</div>' : '') + '</div>' +
        '<details class="tipy"><summary>Jak napsat dobrou prosbu</summary><ul class="male">' +
          '<li><b>Konkrétně:</b> co, kdy, jak dlouho. „Zavoláš mi dnes po osmé?“ místo „Mohl by ses víc ozývat.“</li>' +
          '<li><b>Proveditelně:</b> něco, co druhý opravdu může udělat – teď nebo brzy.</li>' +
          '<li><b>Co chceš, ne co nechceš:</b> „Nech mě prosím domluvit“ místo „Přestaň mě přerušovat.“</li>' +
        '</ul></details>' +
      '</section>' +
      '<section class="karta"><h2>Je v pořádku, když druhý řekne ne?</h2><div class="cipy">' +
        cipNe('ano', 'Ano') + cipNe('spis-ne', 'Spíš ne') + '</div>' + odpovedNe + '</section>' +
      '<section class="karta"><h2>Komu ji chceš poslat?</h2><div class="cipy">' +
        kontakty.map((c, i) => cipKomu(i, c.jmeno)).join('') + cipKomu('jiny', kontakty.length ? 'Někomu jinému' : 'Vybrat v telefonu') + '</div>' +
        (kontakty.length ? '' : '<p class="tlumene male">Blízké lidi, kterým věříš, si můžeš uložit v <a href="#/nastaveni">Nastavení</a>. Pak je tu najdeš připravené.</p>') +
      '</section>' +
      pridat +
      '<section class="karta"><h2>Takhle zpráva odejde</h2>' +
        '<div class="nahled-sdileni" id="prosba-nahled">' + (prazdna ? '<span class="tlumene">Zatím prázdné – napiš prosbu nahoře.</span>' : h(textProsby())) + '</div>' +
        (p.komu === null ? '<p class="tlumene male">Vyber, komu ji chceš poslat.</p>' : '<div class="odkazy svisle">' + tlacitka + '</div>') +
        '<p class="tlumene male">Aplikace nic neposílá sama. Zpráva odejde, až ji odešleš ve svém telefonu.</p>' +
      '</section>' +
      '<p class="tlumene male">Když Ti někdo ubližuje nebo se vedle někoho necítíš v bezpečí, nemusíš ho o nic prosit. Podívej se do <a href="#/pomoc">Pomoci</a>.</p>' +
    '</main>';
}

// ---------------- TÝDENNÍ OHLÉDNUTÍ ----------------
// Týden = pondělí až neděle, označený podle ISO (2026-W45). Podíly času
// se počítají z ohodnocených bloků večerního ohlédnutí (U-index).

// WHO-5 v přesném oficiálním českém znění (WHO, verze 1998).
const WHO5 = {
  pokyn: 'Vyberte, prosím, pro každé z pěti tvrzení tu odpověď, která se nejvíc blíží tomu, jak jste se cítil/a v posledních dvou týdnech. Všimněte si, že vyšší čísla znamenají lepší emoční pohodu.',
  polozky: [
    'Byl/a jsem veselý/á a v dobré náladě',
    'Byl/a jsem klidný/á a uvolněný/á',
    'Byl/a jsem aktivní a plný/á elánu',
    'Probouzel/a jsem se osvěžený/á a odpočinutý/á',
    'Můj každodenní život byl naplněn věcmi, které mne zajímají'
  ],
  odpovedi: [[5, 'celou dobu'], [4, 'většinu doby'], [3, 'více než polovinu doby'], [2, 'méně než polovinu doby'], [1, 'občas'], [0, 'nikdy']]
};

function pondeliTydne(datum) {
  const d = new Date(datum); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
function kodTydne(datum) {
  const d = new Date(datum); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));          // čtvrtek téhož týdne
  const rok = d.getFullYear();
  const prvni = new Date(rok, 0, 4, 12);
  const cislo = 1 + Math.round(((d - prvni) / 864e5 - 3 + (prvni.getDay() + 6) % 7) / 7);
  return rok + '-W' + String(cislo).padStart(2, '0');
}
function pondeliZKodu(kod) {
  const [rok, t] = kod.split('-W').map(Number);
  const ctvrtek = new Date(rok, 0, 4, 12);
  const pondeli = pondeliTydne(ctvrtek);
  pondeli.setDate(pondeli.getDate() + (t - 1) * 7);
  return pondeli;
}
function rozsahTydne(kod) {
  const od = pondeliZKodu(kod), konec = new Date(od); konec.setDate(od.getDate() + 6);
  const f = d => d.getDate() + '. ' + (d.getMonth() + 1) + '.';
  return { od: U.datumDne(od), do: U.datumDne(konec), text: f(od) + ' – ' + f(konec) };
}
// Za který týden se ohlížet: v neděli za ten právě končící, jinak za minulý.
function tydenKOhlednuti() {
  const d = new Date();
  if (d.getDay() !== 0) d.setDate(d.getDate() - 7);
  return kodTydne(d);
}
function predchoziTyden(kod, o = 1) {
  const d = pondeliZKodu(kod); d.setDate(d.getDate() - 7 * o);
  return kodTydne(d);
}

// Podíly času a počet záznamů v týdnu – spočítané ze záznamů v telefonu.
function datTydne(kod, vse) {
  const r = rozsahTydne(kod);
  const vTydnu = vse.filter(z => { const d = z.chvile_od.slice(0, 10); return d >= r.od && d <= r.do; });
  const min = { prijemny: 0, neutralni: 0, neprijemny: 0 };
  for (const z of vTydnu) {
    if (z.typ !== 'vecerni' || z.poradi == null || z.prijemnost == null || !z.chvile_delka_min) continue;
    min[z.prijemnost > 0 ? 'prijemny' : z.prijemnost < 0 ? 'neprijemny' : 'neutralni'] += z.chvile_delka_min;
  }
  const celkem = min.prijemny + min.neutralni + min.neprijemny;
  const podily = celkem ? {
    prijemny: Math.round(100 * min.prijemny / celkem), neprijemny: Math.round(100 * min.neprijemny / celkem)
  } : null;
  if (podily) podily.neutralni = 100 - podily.prijemny - podily.neprijemny;
  return { pocet: vTydnu.length, minuty: celkem, podily, rozsah: r };
}

function skorWho5(odpovedi) {
  if (!odpovedi || odpovedi.some(o => o == null)) return null;
  const hruby = odpovedi.reduce((a, b) => a + b, 0);
  return { hruby, index: hruby * 4, nizky: hruby < 13 || odpovedi.some(o => o <= 1) };
}

let tyden = null; // rozpracované týdenní ohlédnutí

async function pripravTyden(kod) {
  const ulozeny = await U.nactiTyden(kod);
  const vse = await U.vsechnyZaznamy();
  const tydny = (await U.vsechnyTydny()).filter(t => t.tyden < kod && t.who5).sort((a, b) => b.tyden.localeCompare(a.tyden));
  const minuly = tydny[0] || null;               // poslední vyplněné WHO-5
  const who5Minule = !!(minuly && minuly.tyden === predchoziTyden(kod));
  // Běžný stav = průměr až 4 předchozích týdnů, které mají ohodnocený čas.
  const predchozi = [];
  for (let i = 1; i <= 8 && predchozi.length < 4; i++) {
    const dt = datTydne(predchoziTyden(kod, i), vse);
    if (dt.podily) predchozi.push(dt.podily);
  }
  const bezny = predchozi.length ? Object.fromEntries(['prijemny', 'neutralni', 'neprijemny'].map(k =>
    [k, Math.round(predchozi.reduce((a, p) => a + p[k], 0) / predchozi.length)])) : null;
  tyden = {
    kod, data: datTydne(kod, vse), bezny, pocetBeznych: predchozi.length, minulyWho5: minuly,
    barvyDnu: [],
    barva: ulozeny ? ulozeny.barva || null : null,
    vzpominka: ulozeny ? ulozeny.vzpominka || '' : '', tema: ulozeny ? ulozeny.tema || '' : '', dal: ulozeny ? ulozeny.dal || '' : '',
    who5: ulozeny && ulozeny.who5 ? [...ulozeny.who5.odpovedi] : [null, null, null, null, null],
    ukazatWho5: !!(ulozeny && ulozeny.who5) || !who5Minule,
    ulozeny: ulozeny || null
  };
  const r = tyden.data.rozsah;
  for (let d = new Date(r.od + 'T12:00:00'); U.datumDne(d) <= r.do; d.setDate(d.getDate() + 1)) {
    const den = await U.nactiDen(U.datumDne(d));
    if (den && den.barva) tyden.barvyDnu.push(den.barva);
  }
}

function obrazovkaTyden() {
  const t = tyden;
  if (!t) { location.hash = '#/domov'; return ''; }
  const kat = [['prijemny', 'příjemný', KATEGORIE.prijemna.barva], ['neutralni', 'ani tak, ani tak', KATEGORIE.neutralni.barva], ['neprijemny', 'nepříjemný', KATEGORIE.neprijemna.barva]];
  let cas;
  if (t.data.podily) {
    const p = t.data.podily;
    cas = '<div class="pruh-dne" role="img" aria-label="Podíly času">' + kat.filter(([k]) => p[k]).map(([k, , b]) =>
        '<span class="segment" style="flex:' + p[k] + ';background:' + b + '"></span>').join('') + '</div>' +
      '<div class="legenda">' + kat.map(([k, text, b]) => '<span class="legenda-polozka"><i class="legenda-znak" style="background:' + b + '"></i>' + text + ' ' + p[k] + ' %' +
        (t.bezny ? ' <span class="tlumene">(obvykle ' + t.bezny[k] + ' %)</span>' : '') + '</span>').join('') + '</div>' +
      (t.bezny ? '<p class="tlumene male">„Obvykle“ = průměr ' + (t.pocetBeznych === 1 ? 'předchozího týdne' : 'předchozích ' + t.pocetBeznych + ' týdnů') + ' s ohlédnutím.</p>'
        : '<p class="tlumene male">Srovnání s Tvým běžným stavem se ukáže, až budou ohlédnutí aspoň ze dvou týdnů.</p>');
  } else {
    cas = '<p class="tlumene">V tomhle týdnu zatím nejsou popsané chvíle z večerního ohlédnutí, takže podíly času nejdou spočítat.</p>';
  }

  const barva = nastaveni.barva_dne_zapnuta
    ? '<section class="karta"><h2>Jakou barvu měl Tvůj týden?</h2>' +
      (t.barvyDnu.length ? '<p class="tlumene male">Barvy Tvých dnů:</p><div class="vzorky male">' + t.barvyDnu.map(b => '<span class="vzorek" style="background:' + b + '"></span>').join('') + '</div>' : '') +
      '<div class="vzorky">' + BARVY_DNE.map(b => '<button type="button" class="vzorek" data-akce="tydenBarva" data-barva="' + b + '" aria-pressed="' + (t.barva === b) +
        '" aria-label="Barva ' + b + '" style="background:' + b + ';color:' + inkoustPro(b) + '">' + (t.barva === b ? '✓' : '') + '</button>').join('') + '</div></section>'
    : '';

  const otazka = (klic, nadpis) => '<div class="oddil"><label class="oddil-nadpis" for="tyden-' + klic + '">' + nadpis + '</label>' +
    '<div class="pole"><textarea id="tyden-' + klic + '" rows="2" data-tyden-pole="' + klic + '" aria-label="' + h(nadpis) + '">' + h(t[klic]) + '</textarea>' +
    (tlacitkoDiktovani('tyden:' + klic) ? '<div class="pole-radek"><span></span>' + tlacitkoDiktovani('tyden:' + klic) + '</div>' : '') + '</div></div>';

  let who5 = '';
  if (t.ukazatWho5) {
    const skor = skorWho5(t.who5);
    who5 = '<section class="karta"><h2>Dotazník pohody WHO-5</h2>' +
      '<p class="tlumene male">Jednou za dva týdny. Nepovinné – klidně ho přeskoč.</p>' +
      '<p>' + WHO5.pokyn + '</p>' +
      WHO5.polozky.map((pol, i) => '<div class="who5-polozka"><p class="who5-otazka">' + (i + 1) + '. ' + pol + '</p><div class="who5-odpovedi" role="group" aria-label="' + h(pol) + '">' +
        WHO5.odpovedi.map(([b, text]) => '<button type="button" class="cip" data-akce="who5" data-i="' + i + '" data-body="' + b + '" aria-pressed="' + (t.who5[i] === b) + '">' +
          '<b>' + b + '</b> ' + text + '</button>').join('') + '</div></div>').join('') +
      (skor ? '<p class="who5-vysledek">Index pohody: <b>' + skor.index + '</b> ze 100' +
        (t.minulyWho5 ? ' <span class="tlumene">(minule ' + t.minulyWho5.who5.index + ')</span>' : '') + '</p>' : '') +
      (skor && skor.nizky && t.minulyWho5 && t.minulyWho5.who5.nizky
        ? '<div class="karta doporuceni"><p>Dotazník pohody vyšel nízko už podruhé po sobě. Možná by stálo za to probrat, jak se teď máš, s praktickým lékařem nebo s někým, komu věříš.</p>' +
          '<div class="odkazy"><a class="tlacitko obrys male-t" href="#/pomoc">Kde najít pomoc</a></div></div>' : '') +
      '</section>';
  } else {
    who5 = '<button type="button" class="tlacitko obrys male-t" style="align-self:flex-start" data-akce="who5Ukazat">Vyplnit i dotazník pohody WHO-5</button>';
  }

  return '<header class="hlavicka">' +
      '<a class="ikona-tlacitko bez-okraje" href="#/domov" aria-label="Zpět">' + IKONA.zpet + '</a>' +
      '<span class="nazev-obrazovky">Týden ' + h(t.data.rozsah.text) + '</span></header>' +
    '<main class="obsah">' +
      '<h1>Tvůj týden</h1>' +
      '<section class="karta"><h2>Jak se Ti čas rozdělil</h2>' + cas +
        '<p class="tlumene male">Záznamů za týden: ' + t.data.pocet + '</p></section>' +
      barva +
      '<section class="karta">' +
        otazka('vzpominka', 'Jak budeš na tento týden vzpomínat?') +
        otazka('tema', 'Bylo nějaké téma týdne?') +
        otazka('dal', 'Co z tohoto týdne s Tebou půjde dál životem?') +
      '</section>' +
      who5 +
      '<p class="tlumene male">Uloží se jen v tomto telefonu.</p>' +
    '</main>' +
    '<footer class="spodni-lista">' +
      '<a class="tlacitko obrys" href="#/domov">Teď ne</a>' +
      '<button type="button" class="tlacitko" data-akce="tydenUlozit">Uložit</button>' +
    '</footer>';
}

// ---------------- MŮJ PŘEHLED ----------------
// Kalendář barev dnů, průběh týdnů, WHO-5, nejčastější slova a souvislosti.
// Každá vrstva zvlášť, žádné celkové skóre. Souvislost nikdy není příčina.

function kategorieBloku(z) {
  if (z.prijemnost == null) return null;
  return z.prijemnost > 0 ? 'prijemny' : z.prijemnost < 0 ? 'neprijemny' : 'neutralni';
}

// „Ve Tvých záznamech se spolu častěji objevuje…“ – činnost nebo společnost
// a příjemný/nepříjemný čas. Jen když je dost dat (aspoň 3 chvíle s tou věcí).
function souvislosti(vse) {
  const od = new Date(); od.setDate(od.getDate() - 28);
  const bloky = vse.filter(z => z.typ === 'vecerni' && z.poradi != null && kategorieBloku(z) && z.chvile_od >= U.tedS(od));
  if (bloky.length < 8) return { malo: true, vety: [] };
  const celkem = { prijemny: 0, neprijemny: 0 };
  for (const b of bloky) { const k = kategorieBloku(b); if (k in celkem) celkem[k]++; }
  const podil = k => celkem[k] / bloky.length;
  const kandidati = [];
  const projdi = (klic, popis) => {
    const mapa = new Map();
    for (const b of bloky) for (const x of (b[klic] || [])) {
      if (!mapa.has(x)) mapa.set(x, []);
      mapa.get(x).push(kategorieBloku(b));
    }
    for (const [x, kat] of mapa) {
      if (kat.length < 3) continue;
      for (const k of ['prijemny', 'neprijemny']) {
        const p = kat.filter(c => c === k).length / kat.length;
        const rozdil = p - podil(k);
        if (rozdil >= .25 && p >= .5) kandidati.push({ rozdil, pocet: kat.length, veta: (k === 'prijemny' ? 'příjemná' : 'nepříjemná') + ' chvíle a ' + popis(x) });
      }
    }
  };
  projdi('cinnost', x => '„' + x + '“');
  projdi('s_kym', x => 'společnost „' + x + '“');
  kandidati.sort((a, b) => b.rozdil - a.rozdil);
  return { malo: false, vety: kandidati.slice(0, 3).map(k => 'Ve Tvých záznamech za poslední 4 týdny se spolu častěji objevuje ' + k.veta + '.') };
}

function nejcastejsi(polozky, n = 8) {
  const m = new Map();
  for (const x of polozky) m.set(x, (m.get(x) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
}

async function obrazovkaPrehled() {
  const vse = await U.vsechnyZaznamy();
  const tydny = (await U.vsechnyTydny()).filter(t => t.vyplneno);
  const dnes = U.datumDne();

  // --- kalendář měsíce ---
  const prvni = new Date(); prvni.setHours(12, 0, 0, 0); prvni.setDate(1); prvni.setMonth(prvni.getMonth() + prehled.mesic);
  const nazevMesice = new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric' }).format(prvni);
  const start = pondeliTydne(prvni);
  const poctyDnu = new Map();
  for (const z of vse) { const d = z.chvile_od.slice(0, 10); poctyDnu.set(d, (poctyDnu.get(d) || 0) + 1); }
  let kal = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map(x => '<span class="kal-hlava">' + x + '</span>').join('');
  for (let d = new Date(start); ; d.setDate(d.getDate() + 1)) {
    if (d.getMonth() !== prvni.getMonth() && d > prvni && d.getDay() === 1) break;
    const datum = U.datumDne(d);
    if (d.getMonth() !== prvni.getMonth()) { kal += '<span></span>'; continue; }
    const den = await U.nactiDen(datum);
    const barva = nastaveni.barva_dne_zapnuta && den && den.barva;
    const pocet = poctyDnu.get(datum) || 0;
    const budouci = datum > dnes;
    let styl = barva ? 'background:' + barva + ';color:' + inkoustPro(barva) + ';border-color:' + barva : pocet ? 'background:var(--jemna-zelena)' : '';
    kal += budouci
      ? '<span class="kal-den budouci">' + d.getDate() + '</span>'
      : '<button type="button" class="kal-den' + (datum === dnes ? ' dnes' : '') + (prehled.den === datum ? ' vybrany' : '') + '" data-akce="prehledDen" data-datum="' + datum +
        '" style="' + styl + '" aria-label="' + d.getDate() + '. ' + (d.getMonth() + 1) + '.: ' + pocet + ' záznamů">' + d.getDate() + '</button>';
  }

  // --- vybraný den ---
  let kartaDne = '';
  if (prehled.den) {
    const datum = prehled.den, d = new Date(datum + 'T12:00:00');
    const den = await U.nactiDen(datum);
    const barva = nastaveni.barva_dne_zapnuta && den && den.barva;
    const zaz = vse.filter(z => z.chvile_od.slice(0, 10) === datum);
    const bloky = zaz.filter(z => z.typ === 'vecerni' && z.poradi != null);
    const emoce = nejcastejsi(zaz.flatMap(z => (z.emoce || []).map(e => e.slovo)), 6);
    const slova = zaz.map(z => z.vlastni_slova).filter(Boolean);
    const nazev = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
    const ink = barva ? inkoustPro(barva) : null;
    const kat = nejcastejsi(bloky.map(kategorieBloku).filter(Boolean), 1)[0];
    const nazvyKat = { prijemny: 'příjemná', neutralni: 'ani tak, ani tak', neprijemny: 'nepříjemná' };
    const casti = [];
    if (bloky.length) casti.push('Večerní ohlédnutí · ' + bloky.length + ' ' + (bloky.length === 1 ? 'chvíle' : bloky.length < 5 ? 'chvíle' : 'chvil') + (kat ? ' · nejčastěji „' + nazvyKat[kat[0]] + '“' : ''));
    const okamzite = zaz.filter(z => z.typ === 'okamzity').length;
    if (okamzite) casti.push('Okamžité záznamy: ' + okamzite);
    if (zaz.some(z => z.typ === 'oslava')) casti.push('Oslava dne');
    kartaDne = '<section class="karta karta-dne"' + (barva ? ' style="background:' + barva + ';color:' + ink + ';border-color:' + barva + '"' : '') + '>' +
      '<h2>' + h(nazev.charAt(0).toUpperCase() + nazev.slice(1)) + '</h2>' +
      (casti.length ? '<p>' + casti.map(h).join('<br>') + '</p>' : '<p>Z tohoto dne nemáš žádné záznamy.</p>') +
      (emoce.length ? '<div class="cipy">' + emoce.map(([e, n]) => '<span class="cip staticky"' + (ink ? ' style="color:' + ink + ';border-color:' + ink + '"' : '') + '>' + h(e) + (n > 1 ? ' ' + n : '') + '</span>').join('') + '</div>' : '') +
      (slova.length ? '<p class="male">„' + h(slova[0].length > 140 ? slova[0].slice(0, 140) + '…' : slova[0]) + '“' + (slova.length > 1 ? ' <span>(+' + (slova.length - 1) + ')</span>' : '') + '</p>' : '') +
      '<div class="odkazy"><a class="tlacitko obrys male-t" href="' + (den && den.vecerni_hotovo ? '#/vecer/' : '#/den/') + datum + '"' + (ink ? ' style="color:' + ink + ';border-color:' + ink + '"' : '') + '>Otevřít den</a></div>' +
      '</section>';
  }

  // --- průběh týdnů (posledních 8) ---
  const kat3 = [['prijemny', KATEGORIE.prijemna.barva], ['neutralni', KATEGORIE.neutralni.barva], ['neprijemny', KATEGORIE.neprijemna.barva]];
  let radkyTydnu = '', maTydny = false;
  for (let i = 0; i < 8; i++) {
    const kod = predchoziTyden(kodTydne(new Date()), i);
    const dt = datTydne(kod, vse);
    const ulozeny = tydny.find(t => t.tyden === kod);
    if (!dt.podily && !ulozeny) continue;
    maTydny = true;
    const r = rozsahTydne(kod);
    const pruh = dt.podily
      ? '<div class="pruh-dne maly">' + kat3.filter(([k]) => dt.podily[k]).map(([k, b]) => '<span class="segment" style="flex:' + dt.podily[k] + ';background:' + b + '"></span>').join('') + '</div>'
      : '<div class="tlumene male">bez ohodnocených chvil</div>';
    const obsah = '<span class="tyden-popis">' + (i === 0 ? 'tento týden' : h(r.text)) + (ulozeny && ulozeny.barva ? ' <i class="tecka" style="background:' + ulozeny.barva + '"></i>' : '') + '</span>' + pruh +
      (dt.podily ? '<span class="tlumene male">' + dt.podily.prijemny + ' % příjemný</span>' : '');
    radkyTydnu += ulozeny ? '<a class="tyden-radek" href="#/tyden/' + kod + '">' + obsah + '</a>' : '<div class="tyden-radek">' + obsah + '</div>';
  }

  // --- WHO-5 ---
  const who = tydny.filter(t => t.who5).sort((a, b) => a.tyden.localeCompare(b.tyden)).slice(-10);
  const who5 = who.length
    ? '<section class="karta"><h2>Dotazník pohody WHO-5</h2><div class="who5-graf">' +
      who.map(t => '<a class="who5-sloupec" href="#/tyden/' + t.tyden + '" aria-label="' + h(rozsahTydne(t.tyden).text) + ': ' + t.who5.index + ' ze 100"><span class="who5-hodnota">' + t.who5.index + '</span>' +
        '<span class="who5-sloupek" style="height:' + Math.max(4, t.who5.index) + '%"></span><span class="tlumene male">' + pondeliZKodu(t.tyden).getDate() + '. ' + (pondeliZKodu(t.tyden).getMonth() + 1) + '.</span></a>').join('') +
      '</div><p class="tlumene male">Index pohody od 0 do 100. Každý sloupec je jedno vyplnění.</p></section>'
    : '';

  // --- nejčastější slova za 30 dní ---
  const od30 = new Date(); od30.setDate(od30.getDate() - 30);
  const posledni = vse.filter(z => z.chvile_od >= U.tedS(od30));
  const emoce = nejcastejsi(posledni.flatMap(z => (z.emoce || []).map(e => e.slovo)));
  const telo = nejcastejsi(posledni.flatMap(z => (z.telo || []).map(t => t.pocit)));
  const potrebyMapa = new Map();
  for (const z of posledni) for (const p of (z.potreby || [])) {
    if (!potrebyMapa.has(p.potreba)) potrebyMapa.set(p.potreba, []);
    if (p.naplneni != null) potrebyMapa.get(p.potreba).push(p.naplneni);
  }
  const potreby = [...potrebyMapa].sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  const cipy = seznam => '<div class="cipy">' + seznam.map(([x, n]) => '<span class="cip staticky">' + h(x) + ' <span class="tlumene">' + n + '×</span></span>').join('') + '</div>';
  const vrstvy = (emoce.length || telo.length || potreby.length)
    ? '<section class="karta"><h2>Posledních 30 dní</h2>' +
      (emoce.length ? '<span class="panel-nadpis">Nejčastější emoce</span>' + cipy(emoce) : '') +
      (telo.length ? '<span class="panel-nadpis">Nejčastěji v těle</span>' + cipy(telo) : '') +
      (potreby.length ? '<span class="panel-nadpis">Potřeby – jak bývají naplněné (průměr)</span><div class="sklenicky-prehled">' +
        potreby.map(([p, hodnoty]) => {
          const prumer = hodnoty.length ? hodnoty.reduce((a, b) => a + b, 0) / hodnoty.length : null;
          return '<div class="sklenicka-polozka">' + sklenicka(prumer == null ? null : Math.round(prumer * 2) / 2) + '<span>' + h(p) + '</span><span class="tlumene male">' + (hodnoty.length || potrebyMapa.get(p).length) + '×</span></div>';
        }).join('') + '</div>' : '') +
      '</section>'
    : '';

  const sv = souvislosti(vse);
  const souvis = '<section class="karta jemna"><h2>Souvislosti</h2>' +
    (sv.vety.length ? sv.vety.map(v => '<p>' + h(v) + '</p>').join('') + '<p class="tlumene male">Je to souvislost, ne příčina. Co z toho platí, víš nejlíp Ty.</p>'
      : '<p class="tlumene">' + (sv.malo ? 'Souvislosti se ukážou, až bude ve večerních ohlédnutích za poslední 4 týdny aspoň 8 ohodnocených chvil.' : 'Zatím se v Tvých záznamech nic výrazně neopakuje spolu.') + '</p>') +
    '</section>';

  return '<header class="hlavicka"><h1>Můj přehled</h1></header>' +
    '<main class="obsah">' +
      '<section class="karta"><div class="karta-radek prehled-tydnu">' +
        '<button type="button" class="ikona-tlacitko bez-okraje" data-akce="prehledMesic" data-smer="-1" aria-label="Předchozí měsíc">‹</button>' +
        '<h2>' + h(nazevMesice.charAt(0).toUpperCase() + nazevMesice.slice(1)) + '</h2>' +
        '<button type="button" class="ikona-tlacitko bez-okraje" data-akce="prehledMesic" data-smer="1" aria-label="Další měsíc"' + (prehled.mesic >= 0 ? ' disabled' : '') + '>›</button>' +
        '</div><div class="kalendar" data-mesic-swipe="1">' + kal + '</div>' +
        '<p class="tlumene male">Klepnutím na den uvidíš jeho shrnutí.</p></section>' +
      kartaDne +
      '<section class="karta"><h2>Průběh týdnů</h2>' +
        (maTydny ? '<div class="tydny-prehled">' + radkyTydnu + '</div><div class="legenda">' +
          '<span class="legenda-polozka"><i class="legenda-znak" style="background:' + KATEGORIE.prijemna.barva + '"></i>příjemný</span>' +
          '<span class="legenda-polozka"><i class="legenda-znak" style="background:' + KATEGORIE.neutralni.barva + '"></i>ani tak, ani tak</span>' +
          '<span class="legenda-polozka"><i class="legenda-znak" style="background:' + KATEGORIE.neprijemna.barva + '"></i>nepříjemný</span></div>' +
          '<p class="tlumene male">Podíly času z ohodnocených chvil večerního ohlédnutí. Týdny s ohlédnutím jdou otevřít.</p>'
          : '<p class="tlumene">Tady se ukáže, jak se Ti čas v jednotlivých týdnech rozděloval, až začneš ohodnocovat chvíle ve večerním ohlédnutí.</p>') +
      '</section>' +
      who5 + vrstvy + souvis +
      '<p class="tlumene male">Všechno se počítá jen v tomto telefonu.</p>' +
    '</main>' + navigace('prehled');
}

// ---------------- POMOC ----------------
// Kontakty ověřené na webech provozovatelů 6. 11. 2026.
// Pravidlo: nikdy jen telefon. Nejdřív cesty bez volání.

// Je teď (v českém čase) otevřeno? den: 1 = pondělí … 7 = neděle
function prazskyCas() {
  const casti = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date());
  const z = Object.fromEntries(casti.map(c => [c.type, c.value]));
  const dny = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { den: dny[z.weekday], minuty: parseInt(z.hour, 10) * 60 + parseInt(z.minute, 10) };
}
function vOkne(minuty, od, doHod) { return minuty >= od * 60 && minuty < doHod * 60; }

function stavChatu() {
  const { den, minuty } = prazskyCas();
  return {
    // Linka první psychické pomoci: út–čt 13–18, pá–po 8–13 (o svátcích 8–13 – svátky zatím nepoznáme)
    lppp: (den >= 2 && den <= 4) ? vOkne(minuty, 13, 18) : vOkne(minuty, 8, 13),
    // Nepanikař poradna: po–pá 16–22
    nepanikar: den <= 5 && vOkne(minuty, 16, 22),
    // Linka bezpečí chat: denně 9–13 a 15–19
    lb: vOkne(minuty, 9, 13) || vOkne(minuty, 15, 19)
  };
}

function stitek(otevreno) {
  return otevreno ? '<span class="stitek otevreno">teď otevřeno</span>' : '<span class="stitek zavreno">teď zavřeno</span>';
}

function obrazovkaPomoc() {
  const chat = stavChatu();
  const zprava = 'Není mi dobře. Můžeš za mnou teď přijít, nebo mi napsat?';

  let blizci = '';
  for (const c of nastaveni.duveryhodne_kontakty) {
    if (c.zpusob === 'telefon') {
      const tel = c.hodnota.replace(/\s+/g, '');
      blizci += '<div class="kontakt"><span class="nazev">' + h(c.jmeno) + '</span><div class="odkazy">' +
        '<a class="tlacitko male-t" href="sms:' + h(tel) + '?body=' + encodeURIComponent(zprava) + '">Poslat zprávu</a>' +
        '<a class="tlacitko obrys male-t" href="tel:' + h(tel) + '">Zavolat</a></div></div>';
    } else {
      blizci += '<div class="kontakt"><span class="nazev">' + h(c.jmeno) + '</span><div class="odkazy">' +
        '<a class="tlacitko male-t" href="mailto:' + h(c.hodnota) + '?subject=' + encodeURIComponent('Potřebuju Tě') +
        '&body=' + encodeURIComponent(zprava) + '">Poslat e-mail</a></div></div>';
    }
  }
  if (!blizci) {
    blizci = '<p class="tlumene male">Můžeš poslat třeba tuhle zprávu: „' + h(zprava) + '“. ' +
      'Až 3 blízké lidi, kterým věříš, si můžeš uložit v <a href="#/nastaveni">Nastavení</a>, pak je tu najdeš připravené.</p>';
  }

  const krok = (cislo, nadpis, obsah) =>
    '<div class="krok"><span class="cislo">' + cislo + '</span><div class="telo-kroku"><h2>' + nadpis + '</h2>' + obsah + '</div></div>';

  return '<header class="hlavicka">' +
      '<button type="button" class="ikona-tlacitko bez-okraje" data-akce="zpet" aria-label="Zpět">' + IKONA.zpet + '</button>' +
      '<span class="nazev-obrazovky">Pomoc</span></header>' +
    '<main class="obsah">' +
      '<p>Jsi tu správně. Vyber si, co teď zvládneš – nemusíš volat.</p>' +
      '<section class="karta">' +
        krok(1, 'Je teď někdo, komu se můžeš svěřit osobně?', blizci) +
      '</section>' +
      '<section class="karta">' +
        krok(2, 'Pomoc hned v telefonu', '<p>Aplikace <b>Nepanikař</b> (zdarma) pomáhá při úzkosti a panice, depresi, sebepoškozování, myšlenkách na sebevraždu a poruchách příjmu potravy. Najdeš v ní i kontakty na krizová centra.</p>' +
          '<div class="odkazy"><a class="tlacitko male-t" href="https://play.google.com/store/apps/details?id=org.dontpanic" target="_blank" rel="noopener">Otevřít Nepanikař</a></div>') +
      '</section>' +
      '<section class="karta">' +
        krok(3, 'Zavolat',
          '<div class="kontakt"><span class="nazev">Linka první psychické pomoci · 116 123</span><span class="tlumene male">zdarma, anonymně</span><div class="odkazy"><a class="tlacitko male-t" href="tel:116123">Zavolat 116 123</a></div></div>' +
          '<div class="kontakt"><span class="nazev">Linka bezpečí · 116 111</span><span class="tlumene male">nonstop · děti a studenti do 26 let</span><div class="odkazy"><a class="tlacitko male-t" href="tel:116111">Zavolat 116 111</a></div></div>' +
          '<div class="kontakt"><span class="nazev">Rodičovská linka · 606 021 021</span><span class="tlumene male">rodiče a pečující</span><div class="odkazy"><a class="tlacitko male-t" href="tel:606021021">Zavolat</a></div></div>') +
      '</section>' +
      '<section class="karta">' +
        krok(4, 'Napsat místo volání',
          '<div class="kontakt"><span class="nazev">Linka první psychické pomoci – chat ' + stitek(chat.lppp) + '</span><span class="tlumene male">út–čt 13–18, pá–po a svátky 8–13 · pro dospělé</span>' +
            '<div class="odkazy"><a class="tlacitko male-t" href="https://linkapsychickepomoci.cz/chat/" target="_blank" rel="noopener">Otevřít chat</a></div></div>' +
          '<div class="kontakt"><span class="nazev">Poradna Nepanikař – chat ' + stitek(chat.nepanikar) + '</span><span class="tlumene male">po–pá 16–22 · hlavně pro mladé · e-mailem kdykoli, odpověď do 7 dní</span>' +
            '<div class="odkazy"><a class="tlacitko male-t" href="https://nepanikar.eu/poradna/" target="_blank" rel="noopener">Chat</a><a class="tlacitko obrys male-t" href="https://nepanikar.eu/poradna/#formular" target="_blank" rel="noopener">Napsat e-mail</a></div></div>' +
          '<div class="kontakt"><span class="nazev">Linka bezpečí – chat ' + stitek(chat.lb) + '</span><span class="tlumene male">denně 9–13 a 15–19 · pro děti a studenty do 26 let · e-mail: pomoc@linkabezpeci.cz (odpověď do 3 pracovních dnů)</span>' +
            '<div class="odkazy"><a class="tlacitko male-t" href="https://www.linkabezpeci.cz/" target="_blank" rel="noopener">Linka bezpečí</a><a class="tlacitko obrys male-t" href="mailto:pomoc@linkabezpeci.cz">Napsat e-mail</a></div></div>' +
          '<div class="kontakt"><span class="nazev">Rodičovská linka – e-mail</span><span class="tlumene male">pro rodiče a pečující · pomoc@rodicovskalinka.cz</span>' +
            '<div class="odkazy"><a class="tlacitko obrys male-t" href="mailto:pomoc@rodicovskalinka.cz">Napsat e-mail</a></div></div>' +
          '<p class="tlumene male">E-mail není na akutní ohrožení – tam pomůže funkce „Nemohu mluvit“ v aplikaci Záchranka (krok 5).</p>') +
      '</section>' +
      '<section class="karta">' +
        krok(5, 'Ohrožení života nebo zdraví',
          '<p>Nejlepší je aplikace <b>Záchranka</b>: tlačítko SOS (zdravotní problém 155, jiná nouze 112) a operátor dostane Tvoji polohu. Když nemůžeš mluvit, použij v ní <b>„Nemohu mluvit“</b> – pošle SMS.</p>' +
          '<div class="odkazy"><a class="tlacitko male-t" href="https://play.google.com/store/search?q=Z%C3%A1chranka&c=apps" target="_blank" rel="noopener">Najít Záchranku</a>' +
          '<a class="tlacitko obrys male-t" href="tel:155">Volat 155</a><a class="tlacitko obrys male-t" href="tel:112">Volat 112</a></div>' +
          '<p class="tlumene male">Nebo požádej někoho blízkého, ať zavolá za Tebe.</p>') +
      '</section>' +
      '<section class="karta">' +
        krok(6, 'Na záchranku to není, ale samo to nepřejde.',
          '<p>Je dobrý nápad svěřit se praktickému lékaři. Nemusíš vyprávět všechno – stačí říct, jak dlouho a jak moc je Ti těžko. Praktik může doporučit psychologa, psychiatra nebo jinou pomoc. Není dobré čekat, až Ti bude nejhůř.</p>') +
      '</section>' +
      '<p class="tlumene male">Kontakty ověřeny 6. 11. 2026 na webech provozovatelů. Mám se! není zdravotnický prostředek a nenahrazuje odbornou pomoc.</p>' +
    '</main>';
}

// ---------------- PŘIPOMÍNKA DO KALENDÁŘE ----------------
// Webová aplikace bez serveru neumí spolehlivě posílat upozornění,
// proto připomínku vytvoříme v kalendáři telefonu (opakuje se denně).

function adresaVecera() { return location.origin + location.pathname + '#/vecer'; }

function casyPripominky() {
  const [hod, min] = (nastaveni.pripominka_cas || '19:30').split(':').map(Number);
  const zacatek = new Date(); zacatek.setHours(hod, min, 0, 0);
  const konec = new Date(zacatek.getTime() + 10 * 60000);
  const f = d => U.tedS(d).slice(0, 19).replace(/[-:]/g, ''); // 20261106T193000
  return { od: f(zacatek), do: f(konec) };
}

function odkazGoogleKalendar() {
  const c = casyPripominky();
  const parametry = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Mám se! – večerní ohlédnutí',
    details: 'Jaký byl Tvůj den? ' + adresaVecera(),
    dates: c.od + '/' + c.do,
    ctz: 'Europe/Prague',
    recur: 'RRULE:FREQ=DAILY'
  });
  return 'https://calendar.google.com/calendar/render?' + parametry.toString();
}

function souborIcs() {
  const c = casyPripominky();
  const radky = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mam se//CS', 'BEGIN:VEVENT',
    'UID:mamse-vecer-' + Date.now() + '@mamse',
    'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
    'DTSTART;TZID=Europe/Prague:' + c.od,
    'DTEND;TZID=Europe/Prague:' + c.do,
    'RRULE:FREQ=DAILY',
    'SUMMARY:Mám se! – večerní ohlédnutí',
    'DESCRIPTION:Jaký byl Tvůj den? ' + adresaVecera(),
    'URL:' + adresaVecera(),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Večerní ohlédnutí', 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ];
  return radky.join('\r\n');
}

// ---------------- NASTAVENÍ ----------------
async function obrazovkaNastaveni() {
  const n = nastaveni;
  const odkliknuta = await U.vsechnaDoporuceni();
  const volba = (hodnota, text) => '<label class="prepinac-maly" style="font-size:15px"><input type="radio" name="osloveni" value="' + hodnota + '" data-akce="osloveni"' +
    (n.tvar_osloveni === hodnota ? ' checked' : '') + '>' + text + '</label>';

  let kontakty = '';
  n.duveryhodne_kontakty.forEach((c, i) => {
    kontakty += '<div class="kontakt"><span class="nazev">' + h(c.jmeno) + '</span><span class="tlumene male">' + h(c.hodnota) + '</span>' +
      '<div class="odkazy"><button type="button" class="tlacitko obrys male-t" data-akce="kontaktSmazat" data-index="' + i + '">Odebrat</button></div></div>';
  });
  const pridatKontakt = n.duveryhodne_kontakty.length < 3
    ? '<input class="vstup" id="kontakt-jmeno" placeholder="Jméno" autocomplete="off">' +
      '<input class="vstup" id="kontakt-hodnota" placeholder="Telefon nebo e-mail" autocomplete="off" inputmode="email">' +
      '<button type="button" class="tlacitko obrys male-t" style="align-self:flex-start" data-akce="kontaktPridat">Přidat kontakt</button>'
    : '<p class="tlumene male">Uložit jde nejvýš 3 kontakty.</p>';

  const doporuceni = odkliknuta.length
    ? odkliknuta.map(d => '<div class="kontakt"><span>' + h(d.co === 'zachranka' ? 'Doporučení aplikace Záchranka' : d.co) + ' – ' +
        (d.stav === 'uz_mam' ? '„Už ji mám“' : '„Neukazovat znovu“') + '</span><div class="odkazy"><button type="button" class="tlacitko obrys male-t" data-akce="vratitDoporuceni" data-co="' + h(d.co) + '">Zase ukazovat</button></div></div>').join('')
    : '<p class="tlumene male">Zatím žádné přijaté doporučení.</p>';

  return '<header class="hlavicka">' +
      '<a class="ikona-tlacitko bez-okraje" href="#/domov" aria-label="Zpět na Domov">' + IKONA.zpet + '</a>' +
      '<span class="nazev-obrazovky">Nastavení</span></header>' +
    '<main class="obsah">' +
      '<section class="karta"><h2>Oslovení</h2><p class="tlumene male">Jaký tvar sloves preferuješ?</p>' +
        volba('oba', '„byla/byl“ – oba tvary') + volba('zensky', '„byla“') + volba('muzsky', '„byl“') + '</section>' +
      '<section class="karta"><h2>Blízcí lidé, kterým věřím</h2><p class="tlumene male">Ti, se kterými chceš sdílet svá osobní pozorování nebo se na ně obrátit v případě nouze.</p>' +
        kontakty + pridatKontakt + '</section>' +
      '<section class="karta"><h2>Připomínka večerního ohlédnutí</h2>' +
        '<p class="tlumene male">Aplikace sama připomínat neumí, proto si připomínku dáš do kalendáře. Odkaz v ní otevře rovnou večerní ohlédnutí.</p>' +
        '<label class="panel-nadpis" for="cas-pripominky">V kolik?</label>' +
        '<input class="vstup" type="time" id="cas-pripominky" data-akce="casPripominky" value="' + h(n.pripominka_cas) + '" style="max-width:160px">' +
        '<div class="odkazy"><a class="tlacitko male-t" href="' + h(odkazGoogleKalendar()) + '" target="_blank" rel="noopener">Přidat do Google Kalendáře</a>' +
        '<button type="button" class="tlacitko obrys male-t" data-akce="stahnoutIcs">Jiný kalendář (.ics)</button></div>' +
        '<p class="tlumene male">Když čas změníš, přidej připomínku znovu a tu starou v kalendáři smaž.</p></section>' +
      '<section class="karta"><h2>Barva dne</h2>' +
        '<label class="prepinac-maly" style="font-size:15px"><input type="checkbox" data-akce="barvyZapnute"' + (n.barva_dne_zapnuta ? ' checked' : '') + '>Chci si volit barvu dne</label>' +
        '<p class="tlumene male">Když je vypnutá, aplikace se na barvu neptá a dny ukazuje bez ní. Zvolené barvy zůstanou uložené.</p></section>' +
      '<section class="karta"><h2>Bolest</h2>' +
        '<label class="prepinac-maly" style="font-size:15px"><input type="checkbox" data-akce="chronicka"' + (n.chronicka_bolest ? ' checked' : '') + '>Mám chronickou bolest – neupozorňuj mě na opakovanou bolest</label>' +
        '<h3>Přijatá doporučení</h3>' + doporuceni + '</section>' +
      '<section class="karta"><h2>Záloha</h2><p class="tlumene male">Všechno je jen v tomto telefonu. Když smažeš data prohlížeče nebo změníš telefon, bez zálohy o záznamy přijdeš. Záloha obsahuje osobní věci, dávej na ni pozor!</p>' +
        '<div class="odkazy"><button type="button" class="tlacitko male-t" data-akce="zaloha">Stáhnout zálohu</button>' +
        '<label class="tlacitko obrys male-t" style="cursor:pointer">Nahrát zálohu<input type="file" accept=".json,application/json" data-akce="nahrat" class="skryte"></label></div></section>' +
      '<section class="karta"><h2>Smazat všechno</h2>' +
        (mazaniPotvrzeni
          ? '<p>Opravdu? Smažou se všechny záznamy i nastavení v tomto telefonu. Vrátit to půjde jen ze zálohy.</p><div class="odkazy"><button type="button" class="tlacitko male-t" data-akce="smazatAno">Ano, smazat všechno</button><button type="button" class="tlacitko obrys male-t" data-akce="smazatNe">Ne, nechat</button></div>'
          : '<button type="button" class="tlacitko obrys male-t" style="align-self:flex-start" data-akce="smazat">Smazat všechna data</button>') +
      '</section>' +
      '<section class="karta"><h2>O aplikaci</h2>' +
        '<p class="tlumene male">Mám se! · verze ' + h(U.VERZE_APLIKACE) + ' (první prototyp). Není zdravotnický prostředek a nenahrazuje odbornou pomoc.</p>' +
        '<p class="tlumene male">Kolo emocí a kolo potřeb © Emer, Mimonádovna. Průvodce je inspirovaný nenásilnou komunikací (Marshall B. Rosenberg; Feelings and Needs Inventory © 2005 Center for Nonviolent Communication). Skupiny potřeb podle Manfreda Max-Neefa.</p></section>' +
    '</main>' + navigace('nastaveni');
}

// ---------------------------------------------------------------------
// AKCE – co se stane po klepnutí
// ---------------------------------------------------------------------

const AKCE = {
  novyZaznam() {
    // Nový záznam začne čistý, když ten předchozí nemá obsah nebo už je uložený.
    if (!maObsah(koncept) || koncept.ulozeno) koncept = novyKoncept();
  },
  // ---- Večerní ohlédnutí ----
  blokNovy() { vecer.upravovany = 'novy'; vecer.rozpracovany = novyBlok(); prekresli(); },
  blokUpravit(d) {
    const i = +d.index;
    vecer.upravovany = i;
    vecer.rozpracovany = Object.assign({}, vecer.bloky[i], { sKym: [...vecer.bloky[i].sKym], cinnost: [...vecer.bloky[i].cinnost] });
    prekresli();
  },
  blokCinnost(d) {
    const b = vecer.rozpracovany;
    if (b.cinnost.includes(d.slovo)) b.cinnost = b.cinnost.filter(c => c !== d.slovo);
    else if (b.cinnost.length >= MAX_CINNOSTI) { oznam(HLASKA_CINNOSTI); return; }
    else b.cinnost = [...b.cinnost, d.slovo];
    prekresli();
  },
  blokVlastniOtevrit() { vecer.vlastniCinnost = true; prekresli(); document.getElementById('vlastni-cinnost')?.focus(); },
  blokVlastniPridat() {
    const t = document.getElementById('vlastni-cinnost').value.trim().toLowerCase();
    if (t && !vecer.rozpracovany.cinnost.includes(t)) {
      if (vecer.rozpracovany.cinnost.length >= MAX_CINNOSTI) oznam(HLASKA_CINNOSTI);
      else vecer.rozpracovany.cinnost.push(t);
    }
    vecer.vlastniCinnost = false;
    prekresli();
  },
  blokDelka(d) { const b = vecer.rozpracovany, m = +d.min; b.delkaMin = b.delkaMin === m ? null : m; prekresli(); },
  blokSKym(d) {
    const b = vecer.rozpracovany;
    b.sKym = b.sKym.includes(d.slovo) ? b.sKym.filter(x => x !== d.slovo) : [...b.sKym, d.slovo];
    prekresli();
  },
  blokKde(d) { const b = vecer.rozpracovany; b.kde = b.kde === d.slovo ? null : d.slovo; prekresli(); },
  blokHotovo() {
    const b = vecer.rozpracovany;
    if (!b.cinnost.length) { oznam('Vyber, co jsi ' + tvar('dělala', 'dělal') + ' – stačí jedno slovo.'); return; }
    if (vecer.upravovany === 'novy') vecer.bloky.push(b);
    else vecer.bloky[vecer.upravovany] = b;
    vecer.upravovany = null; vecer.rozpracovany = null; vecer.vlastniCinnost = false;
    prekresli();
  },
  // Posun upravovaného bloku o jedno místo (náhrada za přetažení).
  blokPosun(d) {
    const i = vecer.upravovany, j = i + parseInt(d.smer, 10);
    if (j < 0 || j >= vecer.bloky.length) return;
    vecer.bloky[i] = vecer.rozpracovany;
    [vecer.bloky[i], vecer.bloky[j]] = [vecer.bloky[j], vecer.bloky[i]];
    vecer.upravovany = j;
    prekresli();
  },
  blokZrusit() { vecer.upravovany = null; vecer.rozpracovany = null; vecer.vlastniCinnost = false; prekresli(); },
  blokOdebrat() {
    const [odebrany] = vecer.bloky.splice(vecer.upravovany, 1);
    if (odebrany.ulozeny) (vecer.smazane = vecer.smazane || []).push(odebrany.id);
    vecer.upravovany = null; vecer.rozpracovany = null;
    prekresli();
  },
  // ---- Oslava ----
  prehledMesic(d) { prehled.mesic = Math.min(0, prehled.mesic + (+d.smer)); prehled.den = null; prekresli(); },
  prehledDen(d) { prehled.den = prehled.den === d.datum ? null : d.datum; prekresli(); },
  tydenPosun(d) { posunTydne = Math.min(0, posunTydne + (+d.smer)); prekresli(); },
  tydenBarva(d) { tyden.barva = tyden.barva === d.barva ? null : d.barva; prekresli(); },
  who5(d) { const i = +d.i, b = +d.body; tyden.who5[i] = tyden.who5[i] === b ? null : b; prekresli(); },
  who5Ukazat() { tyden.ukazatWho5 = true; prekresli(); },
  async tydenOdlozit() {
    const kod = tydenKOhlednuti();
    const t = (await U.nactiTyden(kod)) || { tyden: kod };
    t.odlozeno = true; await U.ulozTyden(t); prekresli();
  },
  async tydenUlozit() {
    if (diktovani) diktovani.stop();
    const t = tyden, skor = skorWho5(t.who5);
    await U.ulozTyden({
      tyden: t.kod, od: t.data.rozsah.od, do: t.data.rozsah.do,
      vytvoreno: t.ulozeny && t.ulozeny.vytvoreno ? t.ulozeny.vytvoreno : U.tedS(), upraveno: t.ulozeny && t.ulozeny.vyplneno ? U.tedS() : null,
      vyplneno: true,
      podily: t.data.podily, minuty: t.data.minuty, pocet_zaznamu: t.data.pocet,
      barva: t.barva, vzpominka: t.vzpominka.trim(), tema: t.tema.trim(), dal: t.dal.trim(),
      who5: skor ? { odpovedi: [...t.who5], hruby: skor.hruby, index: skor.index, nizky: skor.nizky } : null,
      verze_aplikace: U.VERZE_APLIKACE
    });
    tyden = null;
    oznam('Týdenní ohlédnutí je uložené.');
    location.hash = '#/domov';
  },
  async prosbaZacit(d) {
    const z = d.id ? await U.nactiZaznam(d.id) : null;
    prosba = novaProsba(z, d.zpet);
    location.hash = '#/prosba';
  },
  prosbaKomu(d) { prosba.komu = d.komu; prekresli(); },
  prosbaNe(d) { prosba.ne = prosba.ne === d.odpoved ? null : d.odpoved; prekresli(); },
  prosbaPridat(d, el) { prosba.pridat[d.co] = el.checked; obnovNahledProsby(); },
  async prosbaPoslat(d) {
    const text = textProsby();
    if (!prosba.text.trim()) return;
    // Upravená prosba se uloží zpátky do záznamu (jen v telefonu).
    const z = prosba.zaznam;
    if (z && z.prosba !== prosba.text.trim()) {
      z.prosba = prosba.text.trim(); z.upraveno = U.tedS();
      await U.ulozZaznam(z);
    }
    const c = prosba.komu === 'jiny' ? null : nastaveni.duveryhodne_kontakty[+prosba.komu];
    if (d.jak === 'sms' && c) {
      location.href = 'sms:' + c.hodnota.replace(/\s+/g, '') + '?body=' + encodeURIComponent(text);
    } else if (d.jak === 'email' && c) {
      location.href = 'mailto:' + c.hodnota + '?subject=' + encodeURIComponent('Prosba') + '&body=' + encodeURIComponent(text);
    } else if (d.jak === 'sdilet' && navigator.share) {
      try { await navigator.share({ text }); } catch (e) { /* zrušeno */ }
    } else {
      try { await navigator.clipboard.writeText(text); oznam('Zkopírováno. Můžeš to vložit do zprávy.'); }
      catch (e) { oznam('Kopírování nejde – text můžeš označit a zkopírovat ručně.'); }
    }
  },
  async oslavaSdilet(d) {
    sdileniOslavy = noveSdileniOslavy(await U.nactiZaznam(d.id), d.zpet || '#/detail/' + encodeURIComponent(d.id));
    location.hash = '#/sdilet-oslavu';
  },
  oslavaSdiletFormat(d) { sdileniOslavy.format = d.format; prekresli(); },
  oslavaSdiletDik(d, el) { sdileniOslavy.dik = el.checked; prekresli(); },
  oslavaSdiletPotreby(d, el) { sdileniOslavy.potreby = el.checked; prekresli(); },
  async oslavaSdiletTed() {
    const so = sdileniOslavy, text = textOslavy(so);
    const soubor = new File([so.obrazek.blob], 'mam-se-oslava.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [soubor] })) await navigator.share({ files: [soubor], title: 'Dnes oslavuji', text });
      else if (navigator.share) await navigator.share({ title: 'Dnes oslavuji', text });
      else AKCE.oslavaSdiletStahnout();
    } catch (e) { /* zrušeno */ }
  },
  oslavaSdiletStahnout() {
    const a = document.createElement('a');
    a.href = sdileniOslavy.obrazek.url; a.download = 'mam-se-oslava-' + sdileniOslavy.z.chvile_od.slice(0, 10) + '.png';
    document.body.appendChild(a); a.click(); a.remove();
  },
  async oslavaSdiletKopirovat() {
    try { await navigator.clipboard.writeText(textOslavy(sdileniOslavy)); oznam('Zkopírováno. Můžeš to vložit do zprávy.'); }
    catch (e) { oznam('Kopírování nejde – text můžeš označit a zkopírovat ručně.'); }
  },
  oslavaZacit(d) { oslava = novaOslava(d.zpet, d.datum); location.hash = '#/oslava'; },
  async oslavaUpravit(d) { oslava = oslavaZeZaznamu(await U.nactiZaznam(d.id), '#/detail/' + encodeURIComponent(d.id)); location.hash = '#/oslava'; },
  async oslavaZnovu(d) {
    const z = await U.nactiZaznam(d.id);
    await spustOslavu(druhOslavy(Object.fromEntries(z.potreby.map(p => [p.potreba, p]))), z.vlastni_slova, await barvaDneK(z.chvile_od.slice(0, 10)));
  },
  oslavaSkupina(d) { oslava.otevrenaSkupina = oslava.otevrenaSkupina === d.skupina ? null : d.skupina; prekresli(); },
  oslavaPotreba(d) {
    if (oslava.potreby[d.slovo]) delete oslava.potreby[d.slovo];
    else oslava.potreby[d.slovo] = { naplneni: 4 }; // naplněná potřeba – sklenička plná, jde snížit
    prekresli();
  },
  oslavaNaplneni(d) { oslava.potreby[d.slovo].naplneni = parseInt(d.hodnota, 10); prekresli(); },
  oslavaVlastniOtevrit() { oslava.vlastniPotreba = true; prekresli(); document.getElementById('oslava-vlastni')?.focus(); },
  oslavaVlastniPridat() {
    const t = document.getElementById('oslava-vlastni').value.trim().toLowerCase();
    if (t) oslava.potreby[t] = { naplneni: 4 };
    oslava.vlastniPotreba = false;
    prekresli();
  },
  async oslavaUlozit(d) {
    if (!oslava.text.trim() && !Object.keys(oslava.potreby).length && !oslava.podekovani.trim()) {
      oslava.text = ''; // prázdná oslava se neukládá, ale oslavit jde i tak
      if (d.oslavit) await spustOslavu('konfety', '', await barvaDneK(oslava.datum));
      location.hash = oslava.zpet; oslava = null; return;
    }
    if (diktovani) diktovani.stop();
    const z = await ulozOslavu();
    posledniOslava = { id: z.id, zpet: oslava.zpet };
    if (d.oslavit) await spustOslavu(druhOslavy(oslava.potreby), z.vlastni_slova, await barvaDneK(oslava.datum));
    else oznam('Uloženo.');
    const zpet = oslava.zpet; oslava = null;
    location.hash = zpet;
  },

  sdiletOtevrit() { sdileni.otevreno = true; prekresli(); },
  sdiletZavrit() {
    if (sdileni.obrazek) URL.revokeObjectURL(sdileni.obrazek.url);
    sdileni = { otevreno: false, slova: false, okamzite: false, fotky: true, oslavy: false, titulek: '', format: 'prispevek', obrazek: null, klicObrazku: null, pripravuji: false };
    prekresli();
  },
  sdiletSlova(d, el) { sdileni.slova = el.checked; prekresli(); },
  sdiletOkamzite(d, el) { sdileni.okamzite = el.checked; prekresli(); },
  sdiletFotky(d, el) { sdileni.fotky = el.checked; prekresli(); },
  sdiletOslavy(d, el) { sdileni.oslavy = el.checked; prekresli(); },
  sdiletTitulek(d, el) { sdileni.titulek = el.value; prekresli(); },
  sdiletFormat(d) { sdileni.format = d.format; prekresli(); },
  async sdiletTed() {
    // K obrázku jde jako text komentář; když žádný není, krátké textové shrnutí.
    const text = sdileni.titulek.trim() || app.querySelector('.nahled-sdileni').textContent;
    const soubor = new File([sdileni.obrazek.blob], 'snimek-dne.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [soubor] })) {
        await navigator.share({ files: [soubor], title: 'Snímek dne', text });
      } else if (navigator.share) {
        await navigator.share({ title: 'Snímek dne', text });
      } else {
        await AKCE.sdiletStahnout();
      }
    } catch (e) { /* zrušeno – nic se neděje */ }
  },
  sdiletStahnout() {
    const odkaz = document.createElement('a');
    odkaz.href = sdileni.obrazek.url;
    odkaz.download = 'mam-se-snimek-dne-' + (vecer ? vecer.datum : U.datumDne()) + '.png';
    document.body.appendChild(odkaz); odkaz.click(); odkaz.remove();
  },
  async sdiletKopirovat() {  // jen text
    const text = app.querySelector('.nahled-sdileni').textContent;
    try { await navigator.clipboard.writeText(text); oznam('Zkopírováno. Můžeš to vložit do zprávy.'); }
    catch (e) { oznam('Kopírování nejde – text můžeš označit a zkopírovat ručně.'); }
  },
  vecerNovy() { vecer.krok = 'bloky'; vecer.upravovany = 'novy'; vecer.rozpracovany = novyBlok(); prekresli(); },
  async vecerNacist(d) {
    const zdroj = (d && d.zdroj) || vecer.predchoziDen;
    const z = (await U.vsechnyZaznamy())
      .filter(x => x.typ === 'vecerni' && x.poradi != null && x.chvile_od.slice(0, 10) === zdroj)
      .sort((a, b) => a.poradi - b.poradi);
    // Přebíráme jen rozvrh (co, jak dlouho, s kým, kde) – ne pocity ani hodnocení.
    vecer.bloky = z.map(x => Object.assign(novyBlok(), {
      popis: x.popis_bloku || '', cinnost: [...(x.cinnost || [])], delkaMin: x.chvile_delka_min, sKym: [...(x.s_kym || [])], kde: x.kde
    }));
    vecer.krok = 'bloky';
    vecer.upravovany = null; vecer.rozpracovany = null; vecer.vlastniCinnost = false;
    prekresli();
  },
  vecerOdlozit() {
    // Rozepsané zůstane v paměti, dokud aplikaci nezavřeš. Jistota je „Uložit“.
    location.hash = '#/domov';
  },
  async vecerUlozitRozvrh() {
    // „Uložit“ vezme i rozepsaný blok – funguje jako „Přidat do dne“ a hned uloží.
    if (vecer.upravovany !== null) {
      const b = vecer.rozpracovany;
      const prazdny = vecer.upravovany === 'novy' && !b.cinnost.length && !b.popis.trim();
      if (prazdny && vecer.bloky.length) { vecer.upravovany = null; vecer.rozpracovany = null; vecer.vlastniCinnost = false; }
      else { AKCE.blokHotovo(); if (vecer.upravovany !== null) return; }
    }
    if (!vecer.bloky.length) return;
    await ulozVecer(false);
    oznam('Rozvrh je uložený. Můžeš kdykoli pokračovat.');
    prekresli();
  },
  vecerDal() {
    if (vecer.upravovany !== null) { oznam('Nejdřív dokonči rozepsaný blok.'); return; }
    vyberChvile();
    vecer.krok = 'chvile';
    prekresli();
    window.scrollTo(0, 0);
  },
  vecerZpet() { vecer.krok = 'bloky'; prekresli(); window.scrollTo(0, 0); },
  blokPrijemnost(d) { const b = vecer.bloky[+d.index], x = +d.hodnota; b.prijemnost = b.prijemnost === x ? null : x; prekresli(); },
  blokSmysl(d) { const b = vecer.bloky[+d.index], x = +d.hodnota; b.smysluplnost = b.smysluplnost === x ? null : x; prekresli(); },
  blokVyzkum(d) {
    const b = vecer.bloky[+d.index], x = +d.hodnota;
    if (b.vyzkum[d.klic] === x) delete b.vyzkum[d.klic]; else b.vyzkum[d.klic] = x;
    prekresli();
  },
  blokHodnotit(d) { const b = vecer.bloky[+d.index]; b.hodnotit = true; b.vynechano = false; prekresli(); },
  blokNehodnotit(d) { const b = vecer.bloky[+d.index]; b.hodnotit = false; b.vynechano = true; prekresli(); },
  async vecerUlozit() {
    if (diktovani) diktovani.stop();
    await ulozVecer();
    vecer.krok = nastaveni.barva_dne_zapnuta ? 'barva' : 'shrnuti';
    prekresli();
    window.scrollTo(0, 0);
  },
  vecerBarva() { vecer.krok = 'barva'; prekresli(); window.scrollTo(0, 0); },
  vecerShrnuti() { vecer.krok = 'shrnuti'; prekresli(); window.scrollTo(0, 0); },
  vecerDoplnit(d) {
    if (d.cast === 'chvile') {
      for (const b of vecer.bloky) b.hodnotit = true;
      vecer.krok = 'chvile';
      prekresli();
      window.scrollTo(0, 0);
      return;
    }
    // Tělo, potřeby, co by pomohlo: záznam k celému dni (bez bloku)
    koncept = novyKoncept();
    koncept.typ = 'vecerni';
    koncept.chvileOd = U.tedS(new Date(vecer.datum + 'T00:00:00'));
    koncept.fokus = d.cast;
    location.hash = '#/zaznam-dal';
  },

  async casPripominky(d, el) {
    if (!el.value) return;
    nastaveni.pripominka_cas = el.value;
    nastaveni.pripominka_zapnuta = true;
    await U.ulozNastaveni(nastaveni);
    prekresli();
  },
  stahnoutIcs() {
    const soubor = new Blob([souborIcs()], { type: 'text/calendar' });
    const odkaz = document.createElement('a');
    odkaz.href = URL.createObjectURL(soubor);
    odkaz.download = 'mam-se-pripominka.ics';
    document.body.appendChild(odkaz);
    odkaz.click();
    setTimeout(() => { URL.revokeObjectURL(odkaz.href); odkaz.remove(); }, 1000);
  },
  async barvaDne(d) {
    const den = (await U.nactiDen(d.datum)) || { datum: d.datum, barva: null, vecerni_hotovo: false, poznamka: '' };
    den.barva = d.barva || null;
    await U.ulozDen(den);
    prekresli();
  },
  async barvaVlastni(d, el) { await AKCE.barvaDne({ datum: d.datum, barva: el.value.toUpperCase() }); },
  async barvyZapnute(d, el) {
    nastaveni.barva_dne_zapnuta = el.checked;
    nastaveni.barva_tydne_zapnuta = el.checked;
    await U.ulozNastaveni(nastaveni);
    oznam('Uloženo.');
  },
  slovoUlozit() {
    const { co, slovo } = koncept.upravuji;
    const nove = document.getElementById('uprava-slova').value.trim().toLowerCase();
    if (!nove) return AKCE.slovoOdstranit();
    koncept[co] = prejmenujKlic(koncept[co], slovo, nove);
    if (co === 'emoce') koncept.podTim = koncept.podTim.map(x => x === slovo ? nove : x);
    koncept.upravuji = null;
    prekresli();
  },
  slovoOdstranit() {
    const { co, slovo } = koncept.upravuji;
    delete koncept[co][slovo];
    if (co === 'emoce') {
      koncept.podTim = koncept.podTim.filter(x => x !== slovo);
      if (koncept.otevrenaZakladni === slovo) koncept.otevrenaZakladni = null;
    }
    koncept.upravuji = null;
    prekresli();
  },
  slovoZrusit() { koncept.upravuji = null; prekresli(); },
  async fotkaPridat(d, el) {
    const soubor = el.files && el.files[0];
    if (!soubor) return;
    try {
      koncept.fotka = await zmensiFotku(soubor);
    } catch (e) {
      oznam('Tuhle fotku se nepodařilo načíst.');
    }
    prekresli();
  },
  fotkaOdebrat() { koncept.fotka = null; prekresli(); },
  async upravitZaznam(d) {
    koncept = konceptZeZaznamu(await U.nactiZaznam(d.id));
    location.hash = '#/zaznam';
  },
  smazatZaznam(d) { mazaniZaznamu = d.id; prekresli(); },
  smazatZaznamNe() { mazaniZaznamu = null; prekresli(); },
  async smazatZaznamAno(d) {
    await U.smazZaznam(d.id);
    mazaniZaznamu = null;
    oznam('Záznam je smazaný.');
    location.hash = '#/domov';
  },
  // Doplnit do právě uloženého záznamu část, která ještě chybí.
  doplnit(d) {
    koncept = posledniKoncept;
    const naPrvniStrane = d.cast === 'zaklad' || d.cast === 'fotka';
    koncept.fokus = naPrvniStrane ? null : d.cast;
    location.hash = naPrvniStrane ? '#/zaznam' : '#/zaznam-dal';
  },
  zpet() { history.length > 1 ? history.back() : (location.hash = '#/domov'); },

  prijemnost(d) {
    const v = parseInt(d.hodnota, 10);
    koncept.prijemnost = koncept.prijemnost === v ? null : v; // druhé klepnutí volbu zruší
    prekresli();
  },
  zakladni(d) {
    const k = koncept, s = d.slovo;
    if (k.emoce[s]) { delete k.emoce[s]; if (k.otevrenaZakladni === s) k.otevrenaZakladni = null; }
    else { k.emoce[s] = { intenzita: null }; k.otevrenaZakladni = s; }
    prekresli();
  },
  emoce(d) {
    const k = koncept;
    if (k.emoce[d.slovo]) delete k.emoce[d.slovo]; else k.emoce[d.slovo] = { intenzita: null };
    prekresli();
  },
  vicNavrhu() { koncept.vicNavrhu = !koncept.vicNavrhu; prekresli(); },
  vlastniEmoceOtevrit() { koncept.vlastniEmoce = true; prekresli(); document.getElementById('vlastni-emoce')?.focus(); },
  vlastniEmocePridat() {
    const pole = document.getElementById('vlastni-emoce');
    const slovo = pole.value.trim().toLowerCase();
    if (slovo) koncept.emoce[slovo] = { intenzita: null };
    koncept.vlastniEmoce = false;
    prekresli();
  },
  sila(d) {
    const v = parseInt(d.hodnota, 10);
    const seznam = d.co === 'emoce' ? koncept.emoce : koncept.telo;
    const polozka = seznam[d.slovo];
    polozka.intenzita = polozka.intenzita === v ? null : v; // druhé klepnutí vymaže
    prekresli();
  },
  vyzkum(d) {
    const v = parseInt(d.hodnota, 10);
    if (koncept.vyzkum[d.slovo] === v) delete koncept.vyzkum[d.slovo];
    else koncept.vyzkum[d.slovo] = v;
    prekresli();
  },
  smer(d) { koncept.smer = koncept.smer === d.kod ? null : d.kod; prekresli(); },
  podTimOtevrit() { koncept.podTimOtevreno = true; prekresli(); },
  podTim(d) {
    const k = koncept, s = d.slovo;
    if (k.podTim.includes(s)) { k.podTim = k.podTim.filter(x => x !== s); delete k.emoce[s]; }
    else { k.podTim.push(s); k.emoce[s] = k.emoce[s] || { intenzita: null }; }
    prekresli();
  },

  diktovat(d) {
    const Rozpoznavani = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rozpoznavani) return;
    const cil = d.cil || 'text';
    if (diktovani) {
      const predchozi = diktovaniCil;
      diktovani.stop();
      if (predchozi === cil) return; // klepnutí na běžící diktování = konec
    }
    diktovaniCil = cil;
    diktovani = new Rozpoznavani();
    diktovani.lang = 'cs-CZ';
    diktovani.continuous = true;
    diktovani.interimResults = false;
    diktovani.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          const kus = ev.results[i][0].transcript.trim();
          const dosud = hodnotaCile(cil);
          nastavCil(cil, (dosud ? dosud.replace(/\s*$/, ' ') : '') + kus);
          if (cil === 'text') koncept.zdroj.diktovano = true;
        }
      }
      const pole = document.getElementById(idPoleCile(cil));
      if (pole) { pole.value = hodnotaCile(cil); rozvinPole(pole); }
      if (cil === 'text') vykresliPoznana();
    };
    const tentoBeh = diktovani;
    diktovani.onend = () => { if (diktovani === tentoBeh) { diktovani = null; diktovaniCil = null; prekresli(); } };
    diktovani.onerror = () => { oznam('Diktování teď nejde. Zkus mikrofon na klávesnici.'); };
    diktovani.start();
    prekresli();
  },

  telo(d) {
    const k = koncept;
    if (k.telo[d.slovo]) delete k.telo[d.slovo]; else k.telo[d.slovo] = { intenzita: null };
    prekresli();
  },
  bolestUpresnit() { koncept.bolestUpresnit = true; prekresli(); },
  bolestKde(d) {
    const k = koncept;
    k.bolestKde = k.bolestKde.includes(d.misto) ? k.bolestKde.filter(m => m !== d.misto) : [...k.bolestKde, d.misto];
    prekresli();
  },
  skupinaPotreb(d) { koncept.otevrenaSkupina = koncept.otevrenaSkupina === d.skupina ? null : d.skupina; prekresli(); },
  potreba(d) {
    const k = koncept;
    if (k.potreby[d.slovo]) delete k.potreby[d.slovo]; else k.potreby[d.slovo] = { naplneni: null, skripnuta: false };
    prekresli();
  },
  vlastniPotrebaOtevrit() { koncept.vlastniPotreba = true; prekresli(); document.getElementById('vlastni-potreba')?.focus(); },
  vlastniPotrebaPridat() {
    const slovo = document.getElementById('vlastni-potreba').value.trim().toLowerCase();
    if (slovo) koncept.potreby[slovo] = { naplneni: null, skripnuta: false };
    koncept.vlastniPotreba = false;
    prekresli();
  },
  naplneni(d) {
    const p = koncept.potreby[d.slovo], v = parseInt(d.hodnota, 10);
    p.naplneni = p.naplneni === v ? null : v;
    prekresli();
  },
  skripnuta(d, el) { koncept.potreby[d.slovo].skripnuta = el.checked; prekresli(); },
  cinnost(d) { prepniVSeznamu('cinnost', d.slovo); },
  skym(d) { prepniVSeznamu('sKym', d.slovo); },
  kde(d) { koncept.kde = koncept.kde === d.slovo ? null : d.slovo; prekresli(); },

  async ulozit() {
    if (!maObsah(koncept) && !koncept.strategie && !koncept.cinnost.length) {
      oznam('Zatím tu nic není. Stačí jedno slovo nebo číslo.');
      return;
    }
    if (diktovani) diktovani.stop();
    const doplnuji = !!koncept.ulozeno;
    if (doplnuji) koncept.upraveno = U.tedS(); // doplňování už uloženého záznamu
    const zaznam = sestavZaznam(koncept);
    await U.ulozZaznam(zaznam);
    posledni = zaznam;
    if (!doplnuji) posledniOslava = null;
    koncept.ulozeno = true;
    koncept.fokus = null;
    posledniKoncept = koncept;
    koncept = null;
    // Doplnění těla nebo potřeb z večerního ohlédnutí → zpět na shrnutí dne.
    if (zaznam.typ === 'vecerni' && vecer && vecer.datum === zaznam.chvile_od.slice(0, 10)) {
      posledniKoncept = null;
      vecer.krok = 'shrnuti';
      location.hash = '#/vecer/' + vecer.datum;
      return;
    }
    // Kartičku o bolesti nabízíme jen po prvním uložení, ne při každém doplnění.
    if (!doplnuji) doporuceniKUkazani = await mamUkazatBolest() ? 'bolest' : null;
    location.hash = '#/hotovo';
  },

  async odkliknout(d) {
    await U.odklikniDoporuceni(d.co, d.stav);
    doporuceniKUkazani = null;
    oznam('Rozumím. Vrátit to jde v Nastavení.');
    prekresli();
  },

  // ---- Nastavení ----
  async osloveni(d, el) { nastaveni.tvar_osloveni = el.value; await U.ulozNastaveni(nastaveni); oznam('Uloženo.'); },
  async chronicka(d, el) { nastaveni.chronicka_bolest = el.checked; await U.ulozNastaveni(nastaveni); oznam('Uloženo.'); },
  async kontaktPridat() {
    const jmeno = document.getElementById('kontakt-jmeno').value.trim();
    const hodnota = document.getElementById('kontakt-hodnota').value.trim();
    if (!jmeno || !hodnota) { oznam('Vyplň jméno i telefon nebo e-mail.'); return; }
    const zpusob = hodnota.includes('@') ? 'email' : 'telefon';
    nastaveni.duveryhodne_kontakty.push({ jmeno, zpusob, hodnota });
    await U.ulozNastaveni(nastaveni);
    prekresli();
  },
  async kontaktSmazat(d) {
    nastaveni.duveryhodne_kontakty.splice(parseInt(d.index, 10), 1);
    await U.ulozNastaveni(nastaveni);
    prekresli();
  },
  async vratitDoporuceni(d) { await U.vratDoporuceni(d.co); prekresli(); },
  async zaloha() {
    const data = await U.vytvorZalohu();
    const soubor = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const odkaz = document.createElement('a');
    odkaz.href = URL.createObjectURL(soubor);
    odkaz.download = 'mam-se-zaloha-' + U.datumDne() + '.json';
    document.body.appendChild(odkaz);
    odkaz.click();
    setTimeout(() => { URL.revokeObjectURL(odkaz.href); odkaz.remove(); }, 1000);
  },
  async nahrat(d, el) {
    const soubor = el.files && el.files[0];
    if (!soubor) return;
    try {
      const pridano = await U.nahrajZalohu(JSON.parse(await soubor.text()));
      oznam('Hotovo. Přibylo záznamů: ' + pridano + '.');
    } catch (chyba) {
      oznam(chyba.message || 'Zálohu se nepodařilo načíst.');
    }
    el.value = '';
  },
  smazat() { mazaniPotvrzeni = true; prekresli(); },
  smazatNe() { mazaniPotvrzeni = false; prekresli(); },
  async smazatAno() {
    await U.smazVse();
    nastaveni = await U.nactiNastaveni();
    mazaniPotvrzeni = false;
    koncept = null;
    oznam('Všechno je smazané.');
    location.hash = '#/domov';
  }
};

function prepniVSeznamu(pole, slovo) {
  const s = koncept[pole];
  koncept[pole] = s.includes(slovo) ? s.filter(x => x !== slovo) : [...s, slovo];
  prekresli();
}

// Má se po uložení ukázat klidná kartička o opakované bolesti?
// Spouštěč (schválený): bolest v 5 a více záznamech za posledních 7 dní.
async function mamUkazatBolest() {
  if (nastaveni.chronicka_bolest) return false;
  const odkliknuta = await U.vsechnaDoporuceni();
  if (odkliknuta.some(d => d.co === 'zachranka')) return false;
  const tydenZpet = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const zaznamy = await U.zaznamyOd(tydenZpet);
  const sBolesti = zaznamy.filter(z => (z.telo || []).some(t => t.pocit === 'bolest'));
  return sBolesti.length >= 5;
}

// ---------------------------------------------------------------------
// VYKRESLOVÁNÍ A UDÁLOSTI
// ---------------------------------------------------------------------

function trasa() { return location.hash.replace(/^#\/?/, '') || 'domov'; }

let posledniTrasa = null;

async function vykresli() {
  const [t, parametr] = trasa().split('/');
  const stejnaObrazovka = t === posledniTrasa;
  const posun = window.scrollY;
  let html;
  switch (t) {
    case 'zaznam':     html = obrazovkaZaznam(); break;
    case 'zaznam-dal': html = obrazovkaZaznamDal(); break;
    case 'hotovo':     html = obrazovkaHotovo(); break;
    case 'pomoc':      html = obrazovkaPomoc(); break;
    case 'nastaveni':  html = await obrazovkaNastaveni(); break;
    case 'detail':     html = await obrazovkaDetail(decodeURIComponent(parametr)); break;
    case 'den':        html = await obrazovkaDen(parametr); break;
    case 'vecer':      html = await obrazovkaVecer(parametr); break;
    case 'oslava':     html = obrazovkaOslava(); break;
    case 'prosba':     html = obrazovkaProsba(); break;
    case 'prehled':    html = await obrazovkaPrehled(); break;
    case 'tyden':
      if (!tyden || tyden.kod !== (parametr || tydenKOhlednuti())) await pripravTyden(parametr || tydenKOhlednuti());
      html = obrazovkaTyden(); break;
    case 'sdilet-oslavu': html = await obrazovkaSdiletOslavu(); break;
    default:           html = await obrazovkaDomov();
  }
  // Rozbalené části zůstanou rozbalené i po překreslení.
  const otevrene = stejnaObrazovka
    ? [...app.querySelectorAll('details[data-cast]')].filter(d => d.open).map(d => d.dataset.cast) : [];
  app.innerHTML = html;
  for (const cast of otevrene) {
    const d = app.querySelector('details[data-cast="' + cast + '"]');
    if (d) d.open = true;
  }
  if (t === 'zaznam') vykresliPoznana();
  rozvinVsechnaPole();
  // Při změně obrazovky nahoru, při překreslení stejné obrazovky zůstat na místě.
  window.scrollTo(0, stejnaObrazovka ? posun : 0);
  posledniTrasa = t;
}

function prekresli() { vykresli(); }

// Pole pro psaní roste s textem, aby šlo pohodlně číst a opravovat,
// co diktování zaslechlo.
function rozvinPole(el) {
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight + 2) + 'px';
}
function rozvinVsechnaPole() { app.querySelectorAll('textarea').forEach(rozvinPole); }

// Jedno místo pro všechna klepnutí.
app.addEventListener('click', (ev) => {
  if (potlacitKlik) { ev.preventDefault(); return; } // klik po přetažení bloku ignorujeme
  const el = ev.target.closest('[data-akce]');
  if (!el || el.tagName === 'INPUT') return; // přepínače řeší událost „change“
  const akce = AKCE[el.dataset.akce];
  if (!akce) return;
  if (el.tagName === 'BUTTON') ev.preventDefault();
  akce(el.dataset, el);
});

// Dlouhé podržení (asi půl vteřiny) na vybraném slově otevře úpravu.
let casovacPodrzeni = null;
let poPodrzeni = false;
function otevriUpravu(el) {
  koncept.upravuji = { co: el.dataset.dlouze, slovo: el.dataset.slovo };
  if (navigator.vibrate) navigator.vibrate(15); // jemné cvrnknutí na znamení
  prekresli();
  setTimeout(() => { const pole = document.getElementById('uprava-slova'); if (pole) { pole.focus(); pole.select(); } }, 50);
}
app.addEventListener('pointerdown', (ev) => {
  const el = ev.target.closest('[data-dlouze]');
  if (!el || !koncept) return;
  poPodrzeni = false;
  casovacPodrzeni = setTimeout(() => { poPodrzeni = true; otevriUpravu(el); }, 550);
});
for (const udalost of ['pointerup', 'pointerleave', 'pointercancel', 'pointermove']) {
  app.addEventListener(udalost, (ev) => {
    if (udalost === 'pointermove' && Math.abs(ev.movementX) + Math.abs(ev.movementY) < 6) return;
    clearTimeout(casovacPodrzeni);
  });
}
// Na Androidu dlouhé podržení vyvolá i „kontextovou nabídku“ – tu nahradíme úpravou.
app.addEventListener('contextmenu', (ev) => {
  const el = ev.target.closest('[data-dlouze]');
  if (!el || !koncept) return;
  ev.preventDefault();
  clearTimeout(casovacPodrzeni);
  if (!poPodrzeni) otevriUpravu(el);
});

// ---- Přetahování bloků dne (podržet a táhnout) ----
let kandidatTazeni = null, tazeni = null, potlacitKlik = false;
app.addEventListener('pointerdown', (ev) => {
  const el = ev.target.closest('[data-blok-index]');
  if (!el || !vecer) return;
  kandidatTazeni = { el, i: +el.dataset.blokIndex, y0: ev.clientY };
  kandidatTazeni.casovac = setTimeout(() => {
    tazeni = kandidatTazeni;
    tazeni.el.classList.add('zvednuty');
    if (navigator.vibrate) navigator.vibrate(15);
  }, 450);
});
app.addEventListener('pointermove', (ev) => {
  if (kandidatTazeni && !tazeni && Math.abs(ev.clientY - kandidatTazeni.y0) > 8) {
    clearTimeout(kandidatTazeni.casovac); kandidatTazeni = null; // člověk jen posouvá stránku
  }
  if (!tazeni) return;
  tazeni.el.style.transform = 'translateY(' + (ev.clientY - tazeni.y0) + 'px)';
  tazeni.y = ev.clientY;
});
// Během přetahování se stránka nesmí posouvat.
app.addEventListener('touchmove', (ev) => { if (tazeni) ev.preventDefault(); }, { passive: false });
function konecTazeni() {
  if (kandidatTazeni) clearTimeout(kandidatTazeni.casovac);
  kandidatTazeni = null;
  if (!tazeni) return;
  const t = tazeni; tazeni = null;
  potlacitKlik = true; setTimeout(() => { potlacitKlik = false; }, 300);
  if (t.y == null) { t.el.classList.remove('zvednuty'); t.el.style.transform = ''; return; }
  // Nové místo: kolik ostatních bloků má střed nad prstem.
  const radky = [...document.querySelectorAll('[data-blok-index]')].filter(r => r !== t.el);
  let nove = 0;
  for (const r of radky) { const b = r.getBoundingClientRect(); if (b.top + b.height / 2 < t.y) nove++; }
  const [blok] = vecer.bloky.splice(t.i, 1);
  vecer.bloky.splice(nove, 0, blok);
  prekresli();
}
app.addEventListener('pointerup', konecTazeni);
app.addEventListener('pointercancel', konecTazeni);
app.addEventListener('contextmenu', (ev) => { if (ev.target.closest('[data-blok-index]')) ev.preventDefault(); });

// Zaškrtávátka, přepínače a výběr souboru.
app.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.tagName !== 'INPUT' || !el.dataset.akce) return;
  const akce = AKCE[el.dataset.akce];
  if (akce) akce(el.dataset, el);
});

// Psaní do polí: ukládáme průběžně, ale obrazovku nepřekreslujeme
// (jinak by klávesnice zmizela uprostřed slova).
app.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.tagName === 'TEXTAREA') rozvinPole(el);
  if (el.dataset.blokText != null && vecer) { vecer.bloky[+el.dataset.blokText].text = el.value; return; }
  if (el.dataset.blokPopis && vecer && vecer.rozpracovany) { vecer.rozpracovany.popis = el.value; return; }
  if (el.dataset.oslavaPole && oslava) { oslava[el.dataset.oslavaPole] = el.value; return; }
  if (el.dataset.tydenPole && tyden) { tyden[el.dataset.tydenPole] = el.value; return; }
  if (el.dataset.oslavaKomentar && sdileniOslavy) { sdileniOslavy.komentar = el.value; return; }
  if (el.dataset.prosbaPole && prosba) { prosba.text = el.value; obnovNahledProsby(); return; }
  if (!koncept) return;
  if (el.id === 'text') {
    koncept.text = el.value;
    koncept.zdroj.psano = true;
    vykresliPoznana();
  } else if (el.dataset.pole) {
    koncept[el.dataset.pole] = el.value;
  }
});

// Enter v poli pro vlastní slovo = Přidat
app.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  if (ev.target.id === 'vlastni-emoce') { ev.preventDefault(); AKCE.vlastniEmocePridat(); }
  if (ev.target.id === 'vlastni-potreba') { ev.preventDefault(); AKCE.vlastniPotrebaPridat(); }
  if (ev.target.id === 'uprava-slova') { ev.preventDefault(); AKCE.slovoUlozit(); }
  if (ev.target.id === 'vlastni-cinnost') { ev.preventDefault(); AKCE.blokVlastniPridat(); }
  if (ev.target.id === 'oslava-vlastni') { ev.preventDefault(); AKCE.oslavaVlastniPridat(); }
});

// Náhled prosby se mění při psaní, aniž by se překreslila obrazovka.
function obnovNahledProsby() {
  const n = app.querySelector('#prosba-nahled');
  if (n) n.innerHTML = prosba.text.trim() ? h(textProsby()) : '<span class="tlumene">Zatím prázdné – napiš prosbu nahoře.</span>';
  app.querySelectorAll('[data-akce="prosbaPoslat"]').forEach(b => { b.disabled = !prosba.text.trim(); });
}

// Přehled týdnů jde posouvat i přejetím prstem (doprava = do minulosti).
let tydenDotyk = null;
app.addEventListener('touchstart', e => {
  const t = e.target.closest('[data-tyden-swipe], [data-mesic-swipe]');
  tydenDotyk = t ? { x: e.touches[0].clientX, y: e.touches[0].clientY, mesic: !!t.dataset.mesicSwipe } : null;
}, { passive: true });
app.addEventListener('touchend', e => {
  if (!tydenDotyk) return;
  const dx = e.changedTouches[0].clientX - tydenDotyk.x, dy = e.changedTouches[0].clientY - tydenDotyk.y;
  const mesic = tydenDotyk.mesic;
  tydenDotyk = null;
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (mesic) {
    const m = Math.min(0, prehled.mesic + (dx > 0 ? -1 : 1));
    if (m !== prehled.mesic) { prehled.mesic = m; prehled.den = null; prekresli(); }
    return;
  }
  const novy = Math.min(0, posunTydne + (dx > 0 ? -1 : 1));
  if (novy !== posunTydne) { posunTydne = novy; prekresli(); }
});

window.addEventListener('hashchange', vykresli);

// Start aplikace
(async function start() {
  try {
    nastaveni = await U.nactiNastaveni();
  } catch (e) {
    app.innerHTML = '<main class="obsah"><h1>Úložiště nejde otevřít</h1><p>Prohlížeč možná běží v anonymním režimu nebo má ukládání vypnuté. Zkus aplikaci otevřít v běžném okně Chromu.</p></main>';
    return;
  }
  vykresli();
  // Offline provoz a instalace na plochu
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
