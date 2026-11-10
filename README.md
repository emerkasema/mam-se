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

Potřebuješ Bun podle `.bun-version` a Node podle `.node-version`. Bun spravuje závislosti a spouští příkazy; Astro, build SW a stávající `node:test` zatím používají Node. Používej `bun run test`, nikoli nativní `bun test`, který by sbíral také Playwright testy.

1. Nainstaluj závislosti: `bun install --frozen-lockfile`.
2. Spusť vývoj: `bun run dev`.
3. Otevři vypsanou adresu s cestou `/mam-se/`.

Před předáním změny spusť:

```sh
bun run check
bun run build
bun run test
bunx --no-install playwright install chromium
bun run test:e2e
```

`bun run test` kontroluje výstup buildu, proto build spouštěj první. Browser testy používají syntetický deník a ověřují uložení, reload, offline otevření a navigaci. `typecheck` kontroluje pouze TypeScript soubory; `check` přidává také Biome. Typová kontrola původní JS a `.astro` šablony nepokrývá.

`bun run preview` otevře hotový build se service workerem. V režimu `dev` se service worker neregistruje. Pokud Astro pod agentem spustí preview na pozadí, ukončíš jej `bunx --no-install astro preview stop`.

Nasazuje se obsah `dist/`, nikoliv zdrojové soubory. Výchozí cesta je `/mam-se/`; pro kořen webu nastav `PUBLIC_APP_BASE=/` při buildu i preview/testu. Před skutečným nasazením potvrď původní doménu — místní data jsou vázaná na origin prohlížeče.

## Lint a formátování

`bun run check` spouští Biome a typovou kontrolu. `bun run lint` zkontroluje styl,
importy a lint pravidla; `bun run format` formátování opraví. Používáme Biome 2.6.6.

Kontrola pokrývá nové datové TS moduly, testy, build skripty a konfiguraci.
Původní `src/app/`, veřejné assety a `.astro` šablony nejsou plošně přeformátované.
Podpora `.astro` v Biome je experimentální; obálku ověřuje build a browser testy.
V testech jsou povolené non-null assertions nad známými fixtures a Playwright
`innerText()`; pravidlo pro DOM `textContent` se na toto testovací API nehodí.

## Stav technického základu

Aplikace nyní používá Astro jako statickou obálku. Data se **stále ukládají původní implementací do IndexedDB**. Samostatná klientská integrace Evolu má browser testy zápisu, čtení, reloadu a dostupnosti workerů/WASM. Pomocné moduly v `src/data/` zatím nejsou zapojené do deníku; synchronizace, obnova identity a migrace na Evolu nejsou implementované. Písmo Fraunces se stále načítá z Google Fonts. Podrobné instrukce pro agenta jsou v [AGENTS.md](AGENTS.md).

### Jak číst připravenou datovou vrstvu

| Modul | Co už dělá | Co ještě nezaručuje |
| --- | --- | --- |
| `src/data/identity.ts` | Vytvoří a uloží tajemství vlastníka; dvě karty použijí stejnou identitu. Poškozenou identitu nenahradí novou. | Přihlášení, obnovu fráze, reset ani ochranu před kódem stejného originu. |
| `src/data/legacy.ts` | Přečte všech šest původních úložišť v jedné transakci, zachová fotky i klíče nastavení. | Validaci obsahu, zastavení zápisů staré aplikace nebo samotný převod. |
| `src/data/backup.ts` | Ověří strukturu JSON zálohy a pravidlo pro porovnání času změn. | Úplnou přípravu importu, dekódování fotek nebo kontrolu limitů Evolu. |
| `src/data/photos.ts` | Rozdělí bajty fotky a složí je až po kontrole úplnosti a SHA-256. | Šifrování, rozpoznání skutečného formátu obrázku nebo zápis do databáze. |

Při čtení kódu rozlišuj **přípravu dat** a **potvrzené uložení**. Úspěšná
validace či rozdělení fotky ještě nic nezapsaly. Budoucí adaptér musí potvrdit
dokončený zápis a migraci ověřit zpětným načtením, než přepne deník na Evolu.
Samotná přítomnost závislosti Evolu současná data deníku nešifruje.

Samostatné integrační testy spustíš takto:

```sh
bunx --no-install playwright install chromium firefox webkit
bun run build:integration
bun run test:integration
```

Testovací stránka se nedostane do produkčního `dist/`. Podrobnosti a hranice
ověření popisuje [integrační README](tests/integration/README.md). Vizuální
baseline obsahuje macOS/Chromium snímky; linuxový CI potřebuje vlastní ověřené
snímky. Tyto testy nenahrazují kontrolu PWA na fyzickém telefonu.

## Licence a zdroje

Kolo emocí a kolo potřeb © Emer, Mimonádovna. Průvodce je inspirovaný nenásilnou komunikací (Marshall B. Rosenberg; Feelings and Needs Inventory © 2005 Center for Nonviolent Communication). Skupiny potřeb podle Manfreda Max-Neefa. Písmo Inter (SIL Open Font License).

Mám se! není zdravotnický prostředek a nenahrazuje odbornou pomoc.
