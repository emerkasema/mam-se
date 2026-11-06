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

const app = document.getElementById('app');

let nastaveni = null;   // nastavení načtené z telefonu
let koncept = null;     // rozepsaný záznam (zatím jen v paměti)
let posledni = null;    // naposledy uložený záznam (pro obrazovku Hotovo)
let posledniKoncept = null; // jeho rozepsaná podoba – aby šel doplnit
let doporuceniKUkazani = null; // klidná kartička po uložení, pokud se hodí
let mazaniPotvrzeni = false;   // dvoukrokové mazání všech dat
let mazaniZaznamu = null;      // id záznamu, u kterého se ptáme „opravdu smazat?“
let diktovani = null;          // běžící diktování (pokud ho telefon umí)

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
    typ: 'okamzity',
    vytvoreno: k.vytvoreno,
    upraveno: k.upraveno || null,
    chvile_od: k.vytvoreno,
    chvile_delka_min: null,
    prijemnost: k.prijemnost,
    vlastni_slova: k.text.trim(),
    emoce: Object.entries(k.emoce).map(([slovo, v]) => ({
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
    '<span class="brzy" aria-disabled="true">' + IKONA.prehled + 'Přehled (brzy)</span>' +
    '<a href="#/nastaveni"' + (aktivni === 'nastaveni' ? ' aria-current="page"' : '') + '>' + IKONA.nastaveni + 'Nastavení</a>' +
    '</nav>';
}

// ---------------- DOMOV ----------------
async function obrazovkaDomov() {
  const vse = (await U.vsechnyZaznamy()).sort((a, b) => b.chvile_od.localeCompare(a.chvile_od));

  // Tento týden (pondělí až neděle)
  const dnes = new Date();
  const pondeli = new Date(dnes);
  pondeli.setHours(0, 0, 0, 0);
  pondeli.setDate(dnes.getDate() - ((dnes.getDay() + 6) % 7));
  const zkratky = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
  let tyden = '';
  for (let i = 0; i < 7; i++) {
    const den = new Date(pondeli);
    den.setDate(pondeli.getDate() + i);
    const datum = U.datumDne(den);
    const pocet = vse.filter(z => z.chvile_od.slice(0, 10) === datum).length;
    const jeDnes = datum === U.datumDne();
    tyden += '<div class="den' + (jeDnes ? ' dnes' : '') + '"><span class="kolecko"' +
      (pocet ? ' style="background: var(--jemna-zelena)"' : '') + ' aria-label="' + zkratky[i] + ': ' + pocet + ' záznamů">' +
      (pocet || '') + '</span>' + zkratky[i] + '</div>';
  }

  // Posledních pět záznamů
  let seznam = '';
  for (const z of vse.slice(0, 5)) {
    const p = z.prijemnost;
    const trida = p == null ? '' : p > 0 ? ' prijemna' : p < 0 ? ' neprijemna' : '';
    const popis = z.emoce.length
      ? z.emoce.map(e => e.slovo + (e.intenzita != null ? ' ' + e.intenzita : '')).join(', ')
      : (z.vlastni_slova ? z.vlastni_slova.slice(0, 80) + (z.vlastni_slova.length > 80 ? '…' : '') : (z.fotka ? '' : 'bez slov'));
    seznam += '<a class="zaznam-radek" href="#/detail/' + encodeURIComponent(z.id) + '"><span class="znamka' + trida + '" aria-label="Příjemnost ' + (p ?? 'nevyplněna') + '">' +
      (p == null ? '–' : p > 0 ? '+' + p : p) + '</span><div><div class="tlumene male">' + casZaznamu(z.chvile_od) +
      '</div><div>' + h(popis) + (z.fotka ? ' <span class="tlumene">· fotka</span>' : '') + '</div></div><span class="sipka" aria-hidden="true">›</span></a>';
  }

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
      '<p class="tlumene">Jaký byl Tvůj den? Tuhle část přidáme v dalším kroku.</p></section>' +
    '<section class="karta"><div class="karta-radek"><h2>Tento týden</h2></div><div class="tyden">' + tyden + '</div>' +
      '<p class="tlumene male">Číslo v kolečku je počet záznamů. Barvy dnů přibudou s večerním ohlédnutím.</p></section>' +
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

  // Přesnější slova u otevřené základní emoce
  let presnejsi = '';
  if (k.otevrenaZakladni) {
    const slova = S.presnejsiK(k.otevrenaZakladni);
    if (slova.length) {
      presnejsi = '<div class="panel"><span class="panel-nadpis">Přesnější slova u „' + h(k.otevrenaZakladni) + '“</span><div class="cipy">' +
        slova.map(s => cip(s, k.emoce[s], 'emoce', { slovo: s })).join('') + '</div></div>';
    }
  }

  const vlastni = k.vlastniEmoce
    ? '<div class="pole-radek"><input class="vstup" id="vlastni-emoce" placeholder="Tvoje slovo pro to, co cítíš" autocomplete="off">' +
      '<button type="button" class="tlacitko male-t" data-akce="vlastniEmocePridat">Přidat</button></div>' : '';

  // Vybrané emoce se sílou
  let vybrane = '';
  for (const [slovo, v] of Object.entries(k.emoce)) {
    vybrane += '<div class="vybrana-polozka"><span class="jmeno">' + h(slovo) + '</span>' + tecky('emoce', slovo, v.intenzita) + '</div>';
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
  const diktTlacitko = umiDiktovat
    ? '<button type="button" class="tlacitko obrys male-t" data-akce="diktovat" id="dikt">' + IKONA.mikrofon + (diktovani ? 'Poslouchám… klepni pro konec' : 'Diktovat') + '</button>'
    : '';

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
        (vybrane ? '<div class="vybrane" aria-label="Vybrané emoce a jejich síla">' + vybrane + '</div>' : '') +
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
        '<div class="pole"><textarea id="bolest-slova" rows="2" data-pole="bolestSlova">' + h(k.bolestSlova) + '</textarea></div>';
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
    sklenicky += '<div class="sklenicka-radek">' + sklenicka(v.naplneni, v.skripnuta) +
      '<span class="jmeno">' + h(potreba) + '</span>' +
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
      '<a class="ikona-tlacitko bez-okraje" href="#/zaznam" aria-label="Zpět na první část">' + IKONA.zpet + '</a>' +
      '<span class="nazev-obrazovky">Jak se mám? · víc</span>' +
      '<a class="tlacitko obrys male-t" href="#/pomoc">' + IKONA.srdce + 'Pomoc</a>' +
    '</header>' +
    '<main class="obsah">' +
      (k.fokus ? '' : '<p class="tlumene">Všechno tady je nepovinné. Vyplň, co Ti dává smysl.</p>') +
      vyberCasti(k, [
        ['telo', Object.keys(k.telo).length, 'Co cítíš v těle?',
          telo + (teloVybrane ? '<div class="vybrane">' + teloVybrane + '</div>' : '') + bolest],
        ['potreby', Object.keys(k.potreby).length || k.otevrenaSkupina, 'Co je teď živé? (potřeby)',
          '<p class="tlumene male">Návrhy podle Max-Neefa. Sklenička ukazuje, kolik té potřeby teď máš: 0 prázdná, 4 plná. Skřípnutá potřeba dostane prasklinu – i plná sklenička může prasknout.</p>' +
          '<div class="cipy">' + skupiny + '</div>' + vlastniPotreba + potrebyPanel +
          (sklenicky ? '<div class="vybrane">' + sklenicky + '</div>' : '')],
        ['kolem', k.cinnost.length || k.sKym.length || k.kde, 'Co se děje kolem?',
          '<span class="panel-nadpis">Co právě děláš?</span><div class="cipy">' + cinnosti + '</div>' +
          '<span class="panel-nadpis">S kým?</span><div class="cipy">' + skym + '</div>' +
          '<span class="panel-nadpis">Kde?</span><div class="cipy">' + kde + '</div>'],
        ['pomuze', k.strategie || k.prosba, 'Co by Ti teď mohlo udělat dobře?',
          '<div class="pole"><textarea rows="2" data-pole="strategie" aria-label="Co by Ti teď mohlo udělat dobře?" placeholder="Třeba procházka, napsat kamarádce, chvíli ticha…">' + h(k.strategie) + '</textarea></div>' +
          '<label class="panel-nadpis" for="prosba">Chceš o něco konkrétního požádat – sebe nebo někoho jiného?</label>' +
          '<div class="pole"><textarea id="prosba" rows="2" data-pole="prosba">' + h(k.prosba) + '</textarea></div>'],
        ['vyzkum', Object.keys(k.vyzkum).length, 'Pro výzkum (nepovinné)',
          '<p class="tlumene male">Devět stejných otázek pokaždé – z nich se počítá klasický U-index. Jak moc teď cítíš… (0 vůbec, 6 velmi silně). Druhé klepnutí odpověď zruší.</p>' +
          '<div class="vybrane">' + vyzkum + '</div>']
      ]) +
    '</main>' +
    '<footer class="spodni-lista">' +
      (k.fokus ? '<a class="tlacitko obrys" href="#/hotovo">Zpět</a>' : '<a class="tlacitko obrys" href="#/zaznam">Zpět</a>') +
      '<button type="button" class="tlacitko" data-akce="ulozit">Uložit</button>' +
    '</footer>';
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
  return '<label class="tlacitko obrys male-t" style="align-self:flex-start;cursor:pointer">' + IKONA.fotak + 'Přidat fotku' +
    '<input type="file" accept="image/*" data-akce="fotkaPridat" class="skryte"></label>';
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
      '<span class="nazev-obrazovky">Záznam · ' + h(casZaznamu(z.chvile_od)) + '</span></header>' +
    '<main class="obsah">' +
      '<section class="karta">' +
        radek('Jaká byla chvíle', prijemnost) +
        (z.fotka ? '<img class="fotka-velka" src="' + urlFotky(z.fotka) + '" alt="Fotka u záznamu">' : '') +
        radek('Vlastními slovy', z.vlastni_slova ? h(z.vlastni_slova).replace(/\n/g, '<br>') : '') +
        radek('Emoce', emoce) +
        radek('V těle', telo) +
        (potreby ? '<div style="display:flex;flex-direction:column;gap:6px"><span class="panel-nadpis">Potřeby</span>' + potreby + '</div>' : '') +
        radek('Kolem', kolem) +
        radek('Co by mi mohlo udělat dobře', h(z.strategie)) +
        radek('Prosba', h(z.prosba)) +
        radek('Pro výzkum', vyzkum) +
        (z.upraveno ? '<p class="tlumene male">Doplněno ' + h(casZaznamu(z.upraveno)) + '</p>' : '') +
      '</section>' +
      '<button type="button" class="tlacitko" style="align-self:flex-start" data-akce="upravitZaznam" data-id="' + h(z.id) + '">Doplnit nebo upravit</button>' +
      mazani +
    '</main>';
}

// Uložený záznam zpět do rozepsané podoby (aby šel doplnit nebo upravit).
function konceptZeZaznamu(z) {
  const k = novyKoncept();
  Object.assign(k, {
    id: z.id, vytvoreno: z.vytvoreno, upraveno: z.upraveno, ulozeno: true,
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
      '<details class="karta"' + (vyplneno || k.fokus === klic ? ' open' : '') + '><summary>' + nadpis + '</summary>' + obsah + '</details>')
    .join('');
}

// Které části záznamu ještě nejsou vyplněné (pro nabídku po uložení).
function chybejiciCasti(k) {
  const chybi = [];
  if (k.prijemnost == null || (!Object.keys(k.emoce).length && !k.text.trim())) chybi.push(['zaklad', 'Jaká je chvíle a co cítíš']);
  if (!Object.keys(k.telo).length) chybi.push(['telo', 'Co cítíš v těle']);
  if (!Object.keys(k.potreby).length) chybi.push(['potreby', 'Co je teď živé (potřeby)']);
  if (!k.cinnost.length && !k.sKym.length && !k.kde) chybi.push(['kolem', 'Co se děje kolem']);
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
      '<a class="tlacitko obrys" href="#/domov" style="align-self:flex-start">Pro teď to stačí</a>' +
    '</main>';
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
      'Až 3 blízké lidi si můžeš uložit v <a href="#/nastaveni">Nastavení</a>, pak je tu najdeš připravené.</p>';
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
        krok(3, 'Napsat místo volání',
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
        krok(4, 'Zavolat',
          '<div class="kontakt"><span class="nazev">Linka první psychické pomoci · 116 123</span><span class="tlumene male">zdarma, anonymně</span><div class="odkazy"><a class="tlacitko male-t" href="tel:116123">Zavolat 116 123</a></div></div>' +
          '<div class="kontakt"><span class="nazev">Linka bezpečí · 116 111</span><span class="tlumene male">nonstop · děti a studenti do 26 let</span><div class="odkazy"><a class="tlacitko male-t" href="tel:116111">Zavolat 116 111</a></div></div>' +
          '<div class="kontakt"><span class="nazev">Rodičovská linka · 606 021 021</span><span class="tlumene male">rodiče a pečující</span><div class="odkazy"><a class="tlacitko male-t" href="tel:606021021">Zavolat</a></div></div>') +
      '</section>' +
      '<section class="karta">' +
        krok(5, 'Ohrožení života nebo zdraví',
          '<p>Nejlepší je aplikace <b>Záchranka</b>: tlačítko SOS (zdravotní problém 155, jiná nouze 112) a operátor dostane Tvoji polohu. Když nemůžeš mluvit, použij v ní <b>„Nemohu mluvit“</b> – pošle SMS.</p>' +
          '<div class="odkazy"><a class="tlacitko male-t" href="https://play.google.com/store/search?q=Z%C3%A1chranka&c=apps" target="_blank" rel="noopener">Najít Záchranku</a>' +
          '<a class="tlacitko obrys male-t" href="tel:155">Volat 155</a><a class="tlacitko obrys male-t" href="tel:112">Volat 112</a></div>' +
          '<p class="tlumene male">Nebo požádej někoho blízkého, ať zavolá za Tebe.</p>') +
      '</section>' +
      '<section class="karta"><h2>Mezi krizí a ničím</h2><p>Je dobrý nápad svěřit se praktickému lékaři. Nemusíš vyprávět všechno – stačí říct, jak dlouho a jak moc je Ti těžko. Praktik může doporučit psychologa, psychiatra nebo jinou pomoc. Na krizi se čekat nemusí.</p></section>' +
      '<p class="tlumene male">Kontakty ověřeny 6. 11. 2026 na webech provozovatelů. Mám se! není zdravotnický prostředek a nenahrazuje odbornou pomoc.</p>' +
    '</main>';
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
      '<section class="karta"><h2>Blízcí lidé pro případ nouze</h2><p class="tlumene male">Ukážou se na obrazovce Pomoc s připravenou zprávou. Zůstávají jen v tomto telefonu.</p>' +
        kontakty + pridatKontakt + '</section>' +
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

  diktovat() {
    const Rozpoznavani = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rozpoznavani) return;
    if (diktovani) { diktovani.stop(); return; }
    diktovani = new Rozpoznavani();
    diktovani.lang = 'cs-CZ';
    diktovani.continuous = true;
    diktovani.interimResults = false;
    diktovani.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          const kus = ev.results[i][0].transcript.trim();
          koncept.text = (koncept.text ? koncept.text.replace(/\s*$/, ' ') : '') + kus;
          koncept.zdroj.diktovano = true;
        }
      }
      const pole = document.getElementById('text');
      if (pole) pole.value = koncept.text;
      vykresliPoznana();
    };
    diktovani.onend = () => { diktovani = null; prekresli(); };
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
    koncept.ulozeno = true;
    koncept.fokus = null;
    posledniKoncept = koncept;
    koncept = null;
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
    default:           html = await obrazovkaDomov();
  }
  app.innerHTML = html;
  if (t === 'zaznam') vykresliPoznana();
  // Při změně obrazovky nahoru, při překreslení stejné obrazovky zůstat na místě.
  window.scrollTo(0, stejnaObrazovka ? posun : 0);
  posledniTrasa = t;
}

function prekresli() { vykresli(); }

// Jedno místo pro všechna klepnutí.
app.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-akce]');
  if (!el || el.tagName === 'INPUT') return; // přepínače řeší událost „change“
  const akce = AKCE[el.dataset.akce];
  if (!akce) return;
  if (el.tagName === 'BUTTON') ev.preventDefault();
  akce(el.dataset, el);
});

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
