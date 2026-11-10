# Pravidla pro agenty

## Komunikace a práce

- Komunikuj česky. Začni výsledkem nebo konkrétním krokem. Postupy čísluj, drž nejvýše pět bodů v jedné skupině; pokud něco zbývá, zakonči jedním dalším krokem.
- Jsi zkušený full-stack vývojář. Prioritou jsou vlastnictví dat, zachování deníku a srozumitelný projekt pro začínající autorku.
- Komentáře a dokumentaci piš česky. Vysvětluj důvody a hranice řešení; nekomentuj mechanicky každý řádek.
- Naming je anglicky: nové názvy souborů, složek, proměnných, funkcí, typů, modulů a nového schématu. České zůstávají uživatelské texty, komentáře a vysvětlení. Původní české názvy v plánu nejsou závazné. Existující kód nyní hromadně nepřejmenovávej; při nahrazování modulů zaváděj EN API. Legacy klíče databáze, exportů a tras zachovej přes explicitní mapování kvůli kompatibilitě.
- Nezaměňuj plán, nainstalovanou závislost nebo úspěšný build za hotovou funkci. Uváděj skutečně provedené kontroly.

## Git a soukromé plánování

- Nejdřív ověř `git status`, větev a remotes. Zachovej cizí rozpracované změny.
- Zdejší `origin` je GitLab. `main` slouží pull mirroru z upstreamu, `miccy-main` je naše integrační větev. `miccy-dev` již existuje a obsahuje první implementaci. Pro navazující práci vytvoř vlastní `codex-` větev z aktuálního `miccy-dev`; existující implementační větev lze dál používat, pokud obsahuje jeho změny. Stav větví vždy ověř z Gitu, ne pouze z tohoto popisu.
- Commituj po logických ověřených změnách, s anglickými prefixy `feat:`, `fix:`, `build:`, `refactor:` nebo `docs:`. Nikdy do `main`. Nevypínej podpisování kvůli chybě podpisové služby.
- Předání proběhne až po kontrole uživatele: naše větev → `miccy-dev` → `miccy-main` → PR, který uživatel připraví přes GitLab mirror nebo přímo GitHub. Samotný popis tohoto pořadí neopravňuje k vytvoření větve, merge ani push.
- Bez výslovného pokynu nedělej push, merge, PR/MR, deploy, force push ani změny mirrorů/remotes. Předání na GitHub je samostatná akce na konkrétní větev.
- Naše pracovní plány, ledger a předávací poznámky patří do `../_own/projects/mam-se/`, nikoliv do aplikace. Pokud tato soukromá složka existuje, přečti `specs/2026-11-07-astro-evolu.md`, `plans/2026-11-07-astro-evolu.md` a `implementation/progress.md`. Bez ní nevymýšlej plán; vyžádej konkrétní zadání. Dokumentace pro autorku a přispěvatele do aplikace patří.

## Produktové hranice

- Zachovej design, české texty a funkce upstreamu 0.7.0 včetně „Můj přehled“. Opravuj technické chyby; nepřidávej svévolně produktové funkce.
- Astro tvoří statickou obálku, klient je vanilla JS. Nové datové moduly mohou být TypeScript. Nepřidávej React, UI framework ani serverové přihlášení.
- Cílové úložiště je Evolu se synchronizací vypnutou do výslovného zapnutí. Nikdy neodesílej skutečný deník na testovací relay.
- Migrace musí zachovat původní IndexedDB, ID, fotky, nastavení a zálohy; žádné tiché zkrácení či vynechání dat. E2EE nechrání odemčené zařízení ani JSON export.
- Licence, držitel práv, kontakty a produkční hosting/relay jsou rozhodnutí autorky. Označ je `DOPLNIT PŘED MERGEM`; nevymýšlej hodnoty ani oprávnění.

## Spuštění a kontroly

1. Použij Bun podle `.bun-version`, Node podle `.node-version` a `bun install --frozen-lockfile`. Jediný lockfile aplikace je `bun.lock`. Bun nahrazuje npm; Node zatím zůstává runtime pro Astro/build a node:test.
2. Vývoj: `bun run dev`; výchozí cesta `/mam-se/`.
3. Biome: `bun run lint`, oprava formátu `bun run format`. Kontroly: `bun run check`, `bun run build`, potom `bun run test`.
4. Browser testy: jednorázově `bunx --no-install playwright install chromium`, potom `bun run test:e2e`. Testuje se build; stejnou `PUBLIC_APP_BASE` použij při buildu i testu. Playwright používá `--ignore-lock`, aby Astro pod agentem nespustilo nezávislý daemon.
5. Před commitem zkontroluj diff a `git diff --check`. Testuj jen syntetická data. Neupravuj globální bezpečnostní nastavení; nálezy auditu neřeš automatickým hromadným upgradem závislostí.

## Aktuální lokální prototyp (10. 11. 2026)

- Produkční `src/app/app.js` používá EN API `src/data/storage.ts` nad Evolu/SQLite. Synchronizace je vypnutá (`transports: []`), recovery není implementované. Nepřidávej relay ani serverové přihlášení.
- Nový uživatel začíná s prázdným deníkem. Původní `src/app/uloziste.js` ani `src/data/legacy.ts` se do produkce neimportují. Read-only snapshot, mapování a legacy testy jsou ponechané jako příprava pro Emerku; **automatická migrace není dokončená ani zapojená**. Původní IndexedDB se při startu ani resetu této verze nečte a nemaže.
- Adaptér podporuje lokální CRUD, potvrzené mazání i obnovení stejného ID, společnou dávku večera, JSON export/import a místní reset včetně identity. Změny nových karet koordinuje Web Lock, stav resetu přežívá vymazání Evolu DB. Nepoužívej přímé nízkoúrovňové mutace z UI místo writeru.
- Import ověřuje celý soubor, dekódování fotek a limity před zápisem. Zachovej legacy klíče, všech šest stores, další klíče nastavení, neznámá kompatibilní JSON pole a přesné uložené bajty/MIME fotek. `settingsEntries` rozšiřuje formát 1 o explicitní klíče nastavení. Nepodporovaný obsah odmítej, nezahazuj.
- `scripts/build-sw.mjs` generuje manifest skutečných assetů včetně workerů/WASM a místních fontů Inter/Fraunces. Workbox není podmínkou prototypu. Rozepsaný obsah je jen v paměti; nevyvolávej automatický reload během psaní.
- `check` pokrývá Biome pro vybraný rozsah a TS kontrolu. Původní JS ani typy Astro šablon nepokrývá; ověřuj je buildem a browser testy. `@astrojs/check` 0.9.12 podporuje TS 5/6, projekt má TS 7; nepoužívej `--force` / `--legacy-peer-deps`.
- `bun run test:e2e` testuje produkční build v Chromium/Firefox/WebKit; 14 vizuálních baseline snímků pouze macOS/Chromium. Integrační root není součást produkce. Fyzický telefon a velké archivy vyžadují samostatné ověření, testy desktopových enginů je nenahrazují. Podrobnosti jsou v README.
- Volitelný upstream úkol a široké recovery/sync zadání zůstávají odložené. Žádný push/merge/PR/deploy či změna remotes bez dalšího výslovného pokynu.
