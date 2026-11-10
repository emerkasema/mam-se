# Mám se!

Osobní deník pohody. Webová aplikace (PWA), která běží v telefonu a všechno, co do ní člověk zapíše, nechává jen v jeho telefonu.

**Verze 0.7.0 – první prototyp:** Domov, okamžitý záznam s fotkou, večerní ohlédnutí s rozvrhem dne, shrnutí a snímek dne ke sdílení, oslava dne s animacemi a sdílením, prosba blízkému člověku, týdenní ohlédnutí s WHO-5, Můj přehled (kalendář, průběh týdnů, souvislosti), barva dne, detail a doplňování záznamů, pomoc, připomínka do kalendáře, nastavení se zálohou.

## Co je v kterém souboru

| Soubor | K čemu je |
| --- | --- |
| `src/pages/index.astro` | Kostra stránky. Načte vzhled a program. |
| `public/styl.css` | Vzhled: barvy (nahoře v `:root`), písmo, tlačítka, karty. |
| `src/app/app.js` | Program: obrazovky, klepnutí, ukládání záznamu, pomoc. |
| `src/app/slovniky.js` | Slova, která aplikace nabízí: emoce, tělo, potřeby, činnosti. Tady se slova přidávají a opravují. |
| `src/app/oslava.js` | Animace oslav (konfety, deka, drink…). |
| `src/app/uloziste.js` | Ukládání do telefonu (IndexedDB), záloha a obnova. |
| `scripts/build-sw.mjs` | Při buildu vytvoří service worker a manifest skutečných souborů. Verze cache vzniká z obsahu automaticky. |
| `public/manifest.webmanifest` | Název a ikony pro přidání na plochu. |
| `public/ikony/`, `public/fonty/` | Logo, ikony aplikace a písmo Inter. |

## Kam se co ukládá

- Záznamy, fotky a nastavení: jen v prohlížeči telefonu (IndexedDB). Nikam se neposílají. Fotky se zmenší a tím ztratí skryté údaje (např. místo pořízení); v záloze jsou uložené jako text.
- Diktování přes tlačítko „Diktovat“ zpracovává Google (stejně jako mikrofon na klávesnici).
- Písmo nadpisů Fraunces se zatím načítá z Google Fonts. Později ho uložíme přímo k aplikaci.

## Jak vyzkoušet změny

Potřebuješ Node podle `.node-version` a npm podle `package.json`.

1. Nainstaluj závislosti: `npm ci`.
2. Spusť vývoj: `npm run dev`.
3. Otevři vypsanou adresu s cestou `/mam-se/`.

Před předáním změny spusť:

```sh
npm run check
npm run build
npm test
npm exec playwright -- install chromium
npm run test:e2e
```

`npm test` kontroluje výstup buildu, proto build spouštěj první. Browser testy používají syntetický deník a ověřují uložení, reload, offline otevření a navigaci. `check` zatím kontroluje pouze TypeScript soubory; původní JS a typy `.astro` šablon nepokrývá.

`npm run preview` otevře hotový build se service workerem. V režimu `dev` se service worker neregistruje. Pokud Astro pod agentem spustí preview na pozadí, ukončíš jej `npm exec astro -- preview stop`.

Nasazuje se obsah `dist/`, nikoliv zdrojové soubory. Výchozí cesta je `/mam-se/`; pro kořen webu nastav `PUBLIC_APP_BASE=/` při buildu i preview/testu. Před skutečným nasazením potvrď původní doménu — místní data jsou vázaná na origin prohlížeče.

## Stav technického základu

Aplikace nyní používá Astro jako statickou obálku. Data se **stále ukládají původní implementací do IndexedDB**. Balíčky Evolu jsou připravené pro další práci, ale synchronizace, obnova identity a migrace na Evolu zatím nejsou implementované. Písmo Fraunces se stále načítá z Google Fonts. Podrobné instrukce pro agenta jsou v [AGENTS.md](AGENTS.md).

## Licence a zdroje

Kolo emocí a kolo potřeb © Emer, Mimonádovna. Průvodce je inspirovaný nenásilnou komunikací (Marshall B. Rosenberg; Feelings and Needs Inventory © 2005 Center for Nonviolent Communication). Skupiny potřeb podle Manfreda Max-Neefa. Písmo Inter (SIL Open Font License).

Mám se! není zdravotnický prostředek a nenahrazuje odbornou pomoc.
