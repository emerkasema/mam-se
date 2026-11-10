# Pravidla pro agenty

## Komunikace a práce

- Komunikuj česky. Začni výsledkem nebo konkrétním krokem. Postupy čísluj, drž nejvýše pět bodů v jedné skupině; pokud něco zbývá, zakonči jedním dalším krokem.
- Jsi zkušený full-stack vývojář. Prioritou jsou vlastnictví dat, zachování deníku a srozumitelný projekt pro začínající autorku.
- Komentáře a dokumentaci piš česky. Vysvětluj důvody a hranice řešení; nekomentuj mechanicky každý řádek.
- Naming je anglicky: nové názvy souborů, složek, proměnných, funkcí, typů, modulů a nového schématu. České zůstávají uživatelské texty, komentáře a vysvětlení. Původní české názvy v plánu nejsou závazné. Existující kód nyní hromadně nepřejmenovávej; při nahrazování modulů zaváděj EN API. Legacy klíče databáze, exportů a tras zachovej přes explicitní mapování kvůli kompatibilitě.
- Nezaměňuj plán, nainstalovanou závislost nebo úspěšný build za hotovou funkci. Uváděj skutečně provedené kontroly.

## Git a soukromé plánování

- Nejdřív ověř `git status`, větev a remotes. Zachovej cizí rozpracované změny.
- Zdejší `origin` je GitLab. `main` slouží pull mirroru z upstreamu, `miccy-main` je naše integrační větev. `miccy-dev` je plánovaná větev uživatele; nevytvářej ji automaticky. Pracuj ve vlastní `codex-` větvi od `miccy-main`; existující implementační větev lze dál používat.
- Commituj po logických ověřených změnách, s anglickými prefixy `feat:`, `fix:`, `build:`, `refactor:` nebo `docs:`. Nikdy do `main`. Nevypínej podpisování kvůli chybě podpisové služby.
- Bez výslovného pokynu nedělej push, merge, PR/MR, deploy, force push ani změny mirrorů/remotes. Předání na GitHub je samostatná akce na konkrétní větev.
- Naše pracovní plány, ledger a předávací poznámky patří do `../_own/projects/mam-se/`, nikoliv do aplikace. Pokud tato soukromá složka existuje, přečti `specs/2026-11-07-astro-evolu.md`, `plans/2026-11-07-astro-evolu.md` a `implementation/progress.md`. Bez ní nevymýšlej plán; vyžádej konkrétní zadání. Dokumentace pro autorku a přispěvatele do aplikace patří.

## Produktové hranice

- Zachovej design, české texty a funkce upstreamu 0.7.0 včetně „Můj přehled“. Opravuj technické chyby; nepřidávej svévolně produktové funkce.
- Astro tvoří statickou obálku, klient je vanilla JS. Nové datové moduly mohou být TypeScript. Nepřidávej React, UI framework ani serverové přihlášení.
- Cílové úložiště je Evolu se synchronizací vypnutou do výslovného zapnutí. Nikdy neodesílej skutečný deník na testovací relay.
- Migrace musí zachovat původní IndexedDB, ID, fotky, nastavení a zálohy; žádné tiché zkrácení či vynechání dat. E2EE nechrání odemčené zařízení ani JSON export.
- Licence, držitel práv, kontakty a produkční hosting/relay jsou rozhodnutí autorky. Označ je `DOPLNIT PŘED MERGEM`; nevymýšlej hodnoty ani oprávnění.

## Spuštění a kontroly

1. Použij Node podle `.node-version` a `npm ci`.
2. Vývoj: `npm run dev`; výchozí cesta `/mam-se/`.
3. Kontroly: `npm run check`, `npm run build`, potom `npm test`.
4. Browser testy: jednorázově `npm exec playwright -- install chromium`, potom `npm run test:e2e`. Testuje se build; stejnou `PUBLIC_APP_BASE` použij při buildu i testu. Playwright používá `--ignore-lock`, aby Astro pod agentem nespustilo nezávislý daemon.
5. Před commitem zkontroluj diff a `git diff --check`. Testuj jen syntetická data. Neupravuj globální bezpečnostní nastavení ani nepoužívej `npm audit fix --force`.

## Stav při předání (10. 11. 2026)

- Existuje Astro scaffold a přesunuté soubory v `src/app/` a `public/`. `src/app/uloziste.js` stále používá původní IndexedDB.
- Samostatná klientská integrace Evolu je ověřená zápisem/čtením/reloadem, workery a WASM v Chromium/Firefox/WebKit. Testovací root `tests/integration/astro` není součástí produkční aplikace. **Produkční adaptér, migrace, obnova identity a sync stále nejsou implementované.** Pomocné moduly v `src/data/` nejsou zapojené do deníku; strukturální validace zálohy není kompletní `prepareImport`.
- `scripts/build-sw.mjs` generuje manifest skutečných Astro assetů pro přechodný SW. Workbox, místní Fraunces a obnova konceptů čekají.
- `check` kontroluje TS, nikoliv původní JS ani typy Astro šablon. `@astrojs/check` 0.9.12 podporuje TS 5/6, projekt má TS 7; nepoužívej `--force` / `--legacy-peer-deps`.
- Pět cílových kroků plánu není tímto scaffoldem dokončeno. Stav ověř v ledgeru a Git historii. CI a šablony připrav pro GitLab; automatické nasazení nepřidávej.
- Volitelný navazující upstream úkol je v soukromém `tasks/2026-11-10-evolu-astro-upstream.md`. Nepředpokládej potřebu Astro adaptéru: nejprve ověř běžnou klientskou integraci. Příprava příspěvku neopravňuje k publikaci issue, PR ani balíčku.
