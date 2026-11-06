// =====================================================================
// ÚLOŽIŠTĚ – všechno, co aplikace ukládá, zůstává v telefonu.
// Používáme IndexedDB, databázi, kterou má v sobě každý prohlížeč.
// Názvy „šuplíků“ (úložišť) odpovídají záložce Datový model v zadání.
// =====================================================================

const NAZEV_DB = 'mamse';
const VERZE_DB = 1;
export const VERZE_APLIKACE = '0.5.0';

// Výchozí nastavení – použije se, dokud člověk nic nezmění.
export const VYCHOZI_NASTAVENI = {
  prvni_spusteni_hotovo: false,
  pripominka_zapnuta: false,
  pripominka_cas: '19:30',
  barva_dne_zapnuta: true,
  barva_tydne_zapnuta: true,
  duveryhodne_kontakty: [],   // [{ jmeno, zpusob: 'telefon'|'email', hodnota }]
  chronicka_bolest: false,
  tvar_osloveni: 'oba',       // 'oba' = „byla/byl“, 'zensky' = „byla“, 'muzsky' = „byl“
  souhrn_zapnut: false,
  kod_ucastnika: null,
  verze_aplikace: VERZE_APLIKACE
};

let dbSlib = null; // jednou otevřená databáze se pak používá pořád

// Otevře databázi; při prvním spuštění v ní založí všechna úložiště.
function otevri() {
  if (dbSlib) return dbSlib;
  dbSlib = new Promise((hotovo, chyba) => {
    const pozadavek = indexedDB.open(NAZEV_DB, VERZE_DB);

    // Spustí se jen tehdy, když databáze ještě neexistuje (nebo má starší verzi).
    pozadavek.onupgradeneeded = () => {
      const db = pozadavek.result;
      if (!db.objectStoreNames.contains('zaznamy')) {
        const z = db.createObjectStore('zaznamy', { keyPath: 'id' });
        z.createIndex('chvile_od', 'chvile_od'); // abychom uměli řadit podle času
      }
      if (!db.objectStoreNames.contains('dny'))        db.createObjectStore('dny', { keyPath: 'datum' });
      if (!db.objectStoreNames.contains('tydny'))      db.createObjectStore('tydny', { keyPath: 'tyden' });
      if (!db.objectStoreNames.contains('nastaveni'))  db.createObjectStore('nastaveni');
      if (!db.objectStoreNames.contains('souhlasy'))   db.createObjectStore('souhlasy', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('doporuceni')) db.createObjectStore('doporuceni', { keyPath: 'co' });
    };
    pozadavek.onsuccess = () => hotovo(pozadavek.result);
    pozadavek.onerror = () => chyba(pozadavek.error);
  });
  return dbSlib;
}

// Obecná pomůcka: provede jednu operaci v jednom úložišti a vrátí výsledek.
async function operace(uloziste, rezim, co) {
  const db = await otevri();
  return new Promise((hotovo, chyba) => {
    const tx = db.transaction(uloziste, rezim);
    const pozadavek = co(tx.objectStore(uloziste));
    tx.oncomplete = () => hotovo(pozadavek ? pozadavek.result : undefined);
    tx.onerror = () => chyba(tx.error);
  });
}

// ---------------- Záznamy chvil ----------------

export function ulozZaznam(zaznam) {
  return operace('zaznamy', 'readwrite', s => s.put(zaznam));
}

export function nactiZaznam(id) {
  return operace('zaznamy', 'readonly', s => s.get(id));
}

export function smazZaznam(id) {
  return operace('zaznamy', 'readwrite', s => s.delete(id));
}

export function vsechnyZaznamy() {
  return operace('zaznamy', 'readonly', s => s.getAll());
}

// Záznamy od určitého okamžiku (např. posledních 7 dní).
export async function zaznamyOd(datum) {
  const vse = await vsechnyZaznamy();
  return vse.filter(z => new Date(z.chvile_od) >= datum);
}

// ---------------- Dny, týdny ----------------

export function nactiDen(datum) {
  return operace('dny', 'readonly', s => s.get(datum));
}
export function ulozDen(den) {
  return operace('dny', 'readwrite', s => s.put(den));
}

// ---------------- Nastavení ----------------

export async function nactiNastaveni() {
  const ulozene = await operace('nastaveni', 'readonly', s => s.get('hlavni'));
  // Spojíme výchozí hodnoty s uloženými – nové položky tak mají vždy hodnotu.
  return Object.assign({}, VYCHOZI_NASTAVENI, ulozene || {});
}
export function ulozNastaveni(nastaveni) {
  return operace('nastaveni', 'readwrite', s => s.put(nastaveni, 'hlavni'));
}

// ---------------- Odkliknutá doporučení ----------------

export function vsechnaDoporuceni() {
  return operace('doporuceni', 'readonly', s => s.getAll());
}
export function odklikniDoporuceni(co, stav) {
  return operace('doporuceni', 'readwrite', s => s.put({ co, stav, kdy: tedS() }));
}
export function vratDoporuceni(co) {
  return operace('doporuceni', 'readwrite', s => s.delete(co));
}

// ---------------- Záloha (export a import) ----------------

const VSECHNA_ULOZISTE = ['zaznamy', 'dny', 'tydny', 'souhlasy', 'doporuceni'];

// Vytvoří jeden objekt se vším, co je v telefonu uložené.
export async function vytvorZalohu() {
  const zaloha = {
    aplikace: 'Mám se!',
    format_zalohy: 1,
    exportovano: tedS(),
    verze_aplikace: VERZE_APLIKACE
  };
  for (const u of VSECHNA_ULOZISTE) {
    zaloha[u] = await operace(u, 'readonly', s => s.getAll());
  }
  // Fotky převedeme na text, aby se vešly do souboru zálohy.
  for (const z of zaloha.zaznamy) {
    if (z.fotka instanceof Blob) z.fotka = await blobNaText(z.fotka);
  }
  zaloha.nastaveni = await nactiNastaveni();
  return zaloha;
}

// Nahraje zálohu. Nic nemaže: co chybí, přibude; u stejného záznamu
// vyhraje ten, který byl upraven později.
export async function nahrajZalohu(zaloha) {
  if (!zaloha || zaloha.aplikace !== 'Mám se!') {
    throw new Error('Tohle nevypadá jako záloha z aplikace Mám se!');
  }
  let pridano = 0;
  const stavajici = new Map((await vsechnyZaznamy()).map(z => [z.id, z]));
  for (const z of zaloha.zaznamy || []) {
    if (typeof z.fotka === 'string') z.fotka = await (await fetch(z.fotka)).blob(); // text zpět na fotku
    const mam = stavajici.get(z.id);
    const novejsi = !mam || (z.upraveno || z.vytvoreno) > (mam.upraveno || mam.vytvoreno);
    if (novejsi) { await ulozZaznam(z); if (!mam) pridano++; }
  }
  for (const u of ['dny', 'tydny', 'souhlasy', 'doporuceni']) {
    for (const polozka of zaloha[u] || []) {
      await operace(u, 'readwrite', s => s.put(polozka));
    }
  }
  return pridano;
}

// Smaže úplně všechno (jen na výslovnou žádost v Nastavení).
export async function smazVse() {
  for (const u of [...VSECHNA_ULOZISTE, 'nastaveni']) {
    await operace(u, 'readwrite', s => s.clear());
  }
}

function blobNaText(blob) {
  return new Promise(hotovo => {
    const ctecka = new FileReader();
    ctecka.onload = () => hotovo(ctecka.result);
    ctecka.readAsDataURL(blob);
  });
}

// ---------------- Pomůcky pro čas ----------------

// Aktuální čas jako text s časovým pásmem, např. 2026-11-06T19:30:00+01:00
export function tedS(datum = new Date()) {
  const posun = -datum.getTimezoneOffset();
  const znamenko = posun >= 0 ? '+' : '-';
  const dvojice = n => String(Math.floor(Math.abs(n))).padStart(2, '0');
  return datum.getFullYear() + '-' + dvojice(datum.getMonth() + 1) + '-' + dvojice(datum.getDate()) +
    'T' + dvojice(datum.getHours()) + ':' + dvojice(datum.getMinutes()) + ':' + dvojice(datum.getSeconds()) +
    znamenko + dvojice(posun / 60) + ':' + dvojice(posun % 60);
}

// Datum dne ve tvaru 2026-11-06 (podle místního času).
export function datumDne(datum = new Date()) {
  return tedS(datum).slice(0, 10);
}

// Náhodné ID; z něj nejde nic vyčíst.
export function noveId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}
