# Mám se!

Osobní deník pohody. Statická webová aplikace (PWA) s českým rozhraním, která ukládá deník místně přes **Evolu / SQLite v prohlížeči**. Není potřeba účet ani serverové přihlášení. **Synchronizace je vypnutá (`transports: []`); přenos mezi zařízeními zajišťuje JSON záloha.**

**Verze 0.7.0 – první prototyp:** Domov, okamžitý záznam s fotkou, večerní ohlédnutí s rozvrhem dne, shrnutí a snímek dne ke sdílení, oslava dne s animacemi a sdílením, prosba blízkému člověku, týdenní ohlédnutí s WHO-5, Můj přehled (kalendář, průběh týdnů, souvislosti), barva dne, detail a doplňování záznamů, pomoc, připomínka do kalendáře, nastavení se zálohou.

## Jak aplikaci používat

1. Otevři aplikaci v běžném okně prohlížeče. Novému uživateli automaticky vznikne prázdný místní deník a místní identita. Počkej na zobrazení Domova; pokud se úložiště nepodaří otevřít, aplikace zobrazí chybu a nepřejde na paměťové náhradní ukládání.
2. Přes „Zaznamenat“ napiš chvíli, případně přilož fotku a doplň emoce či potřeby. Ulož ji tlačítkem „Takhle to stačí“ / „Uložit“. Večerní ohlédnutí má i samostatné uložení rozvrhu. Rozepsaný, neuložený obsah zůstává pouze v paměti stránky.
3. Z Domova, detailu a „Můj přehled“ lze uložené záznamy prohlížet a doplňovat. Fungují také oslavy, barva dne, týdenní ohlédnutí, WHO-5, doporučení a kontakty v Nastavení. Jednotlivé smazání vyžaduje potvrzení.
4. V **Nastavení → Záloha → Stáhnout zálohu** pravidelně stáhni JSON soubor a ulož ho mimo tento prohlížeč. Na jiném zařízení použij **Nahrát zálohu**. Samotná instalace PWA ani místní identita nejsou záloha.
5. Pro offline používání nejprve otevři hotový build online a nech dokončit načtení. Pak ho lze otevřít bez internetu, číst, psát, prohlížet fotky i pracovat se zálohou. PWA lze přidat na plochu přes nabídku prohlížeče.

Při chybě uložení se nezobrazuje úspěch. Pokud hlášení uvádí neověřený výsledek nebo vypršení času, obnov stránku a zkontroluj skutečně uložený obsah; nepočítej automaticky s tím, že operace proběhla nebo byla vrácena zpět. Neuložený text si před obnovením zkopíruj.

## Záloha, obnova a mazání

- Export obsahuje všech šest datových oblastí, nastavení i fotky. Fotky jsou v JSON jako data URL; při exportu/importu se jejich uložené bajty znovu nekomprimují. Rozšíření `settingsEntries` uchovává další klíče nastavení; původní pole `nastaveni` zůstává kompatibilní s formátem 1.
- Import nejdřív ověří celý soubor, dekódování všech obrázků a limity jednotlivých Evolu mutací. Vadný nebo příliš velký obsah se nezkracuje. Potom se změny potvrdí jako jedna dávka. U stejného ID záznamu se použije novější skutečný čas změny; při shodě zůstává místní záznam. Dny, týdny, souhlasy, doporučení a dodaná nastavení se přepíší hodnotami ze zálohy; obsah chybějící v záloze se nemaže.
- **Smazat všechno** odstraní tento místní Evolu deník i jeho místní identitu. Po přerušení se reset dokončí při dalším otevření. Ostatní otevřené karty se starou identitou musíš obnovit. Soubory záloh, sdílené obrázky a původní historická IndexedDB se tím nemažou.
- Jednotlivé mazání používá Evolu soft-delete. Není to příslib bezpečného odstranění historie ze zařízení, systémových záloh ani uvolněného místa na disku.

**JSON záloha není šifrovaná.** Může obsahovat citlivý text, kontakty a fotky. Nepatří do Gitu, issue ani promptů pro agenta. Smazání dat webu, ztráta zařízení nebo evikce úložiště prohlížečem mohou bez zálohy znamenat ztrátu deníku.

## Kam se data ukládají

Deník používá Evolu s místní SQLite databází ve webovém úložišti (OPFS); pomocná IndexedDB uchovává místní identitu a stav resetu. Žádný relay ani synchronizační transport se nepřipojuje. Místní úložiště není zámek aplikace ani šifrovaný trezor před uživatelem odemčeného zařízení nebo kódem stejného originu. Obnovovací fráze a synchronizace nejsou součástí této verze.

Aplikace vyžaduje zabezpečený kontext: HTTPS, při vývoji `localhost` / loopback, a podporu Web Locks, IndexedDB, workerů, WASM a trvalého úložiště. Režim `Unknown` u persistence znamená úložiště bez záruky proti evikci. Anonymní režim nebo omezený prohlížeč může být odmítnut. Browser testy používají vlastní trvalé profily, nikoli osobní profily uživatele.

Doména, protokol a port tvoří origin. `localhost` a `127.0.0.1`, jiné porty nebo jiná doména tedy uvidí jiný deník. Pro běžné používání si drž jednu stabilní adresu. Při změně adresy nebo telefonu přenes data JSON zálohou.

Fotky zvolené přes UI se před prvním uložením zmenšují původním obrazovým zpracováním aplikace. Diktování závisí na prohlížeči a jeho službě rozpoznávání řeči; může používat externí službu a není garantováno offline. Ruční sdílení, kontakty a kalendář otevírají zvolenou aplikaci. Písma Inter i Fraunces jsou přibalená místně.

## Spuštění pro vývoj

Použij **Bun 1.4.4** podle `.bun-version` a **Node 26.13.0** podle `.node-version`. Bun spravuje závislosti a spouští příkazy; Astro, build skript a `node:test` používají Node. Jediný lockfile je `bun.lock`.

```sh
bun install --frozen-lockfile
bun run dev
```

Otevři adresu vypsanou Astro s cestou `/mam-se/`, obvykle `http://localhost:4321/mam-se/`. Ve vývoji se service worker neregistruje; offline chování ověřuj až na buildu. Nepoužívej `file://`. Pro zkoušky používej smyšlené údaje a samostatný profil prohlížeče. Neotvírej vývoj na originu, kde máš skutečný deník.

Hotový build vyzkoušíš takto:

```sh
bun run build
bun run preview -- --host 127.0.0.1 --port 4321 --ignore-lock
```

Adresa preview je v tomto příkladu `http://127.0.0.1:4321/mam-se/`. Stejný port nemůže současně používat dev i preview. Nasaditelný obsah je v `dist/`; automatické nasazování po push není nastavené. Ruční, výslovně povolované Pages nasazení a GitHub CI popisuje [návod pro správu](docs/MAINTAINER.md). Hosting a produkční URL: **DOPLNIT PŘED MERGEM** autorkou.

## Automatické kontroly

Nejprve jednorázově nainstaluj testovací prohlížeče:

```sh
bunx --no-install playwright install chromium firefox webkit
```

Běžná kontrola aplikace:

```sh
bun run check
bun run build
bun run test
bun run test:e2e
```

- `check` spustí Biome a TypeScript. Nepokrývá typy původního JS ani Astro šablon; ty ověřují build a browser testy.
- `test` je `node:test` nad datovými moduly a výstupem buildu. Proto build spouštěj před ním. Používej `bun run test`, nikoli `bun test`, který by sbíral i Playwright soubory.
- `test:e2e` spustí vlastní preview produkčního buildu na portu 4321. Chromium, Firefox a WebKit ověřují nový deník, skutečné UI, fotku, reload, offline zápis/mazání, zálohu/obnovu a reset. Vizuální baseline se porovnává jen v Chromium; obsahuje 14 macOS snímků a její soubory nebyly kvůli přepnutí přepsány.

Podrobnější integrační kontroly:

```sh
bun run build:integration
bun run test:integration
```

Samostatný Astro root na portu 4322 ověřuje schéma, writer/readback, rollback injektované SQLite chyby, mapování fotek, adaptér, více karet a pokračování přerušeného resetu. Legacy čtečka a roundtrip podklady mají vlastní testy. Tyto testovací stránky nejsou součástí produkčního `dist/`.

Jednu oblast lze spustit například `bun run test:integration --grep 'reset'` nebo `bun run test:e2e --project chromium --grep 'new user'`. Na jiném systému lze funkční E2E spustit bez macOS vizuálních snímků pomocí `bun run test:e2e --grep-invert 'upstream visual baseline'`; nové baseline musí autor zvlášť vizuálně ověřit. Výstupy a trace neúspěšných scénářů jsou v `test-results/e2e/` a `test-results/integration/`. Testy si vytvářejí vlastní profily a syntetické deníky.

Pro kořen webu použij stejnou hodnotu při buildu i testu:

```sh
PUBLIC_APP_BASE=/ bun run build
PUBLIC_APP_BASE=/ bun run test:e2e
```

Před dalším běžným testováním obnov výchozí build příkazem `bun run build`. Vývojový build, produkční build a starý service worker na stejném originu se mohou ovlivňovat. Pro čistý vývoj použij samostatný profil; nemaž data běžného uživatelského profilu bez vlastní zálohy.

`bun run lint` provede pouze Biome kontrolu a `bun run format` opraví formátování moderních souborů. Původní `src/app/`, veřejné assety a `.astro` šablony nejsou plošně přeformátované. Před commitem zkontroluj také `git diff --check`.

## Krátká ruční zkouška na telefonu

1. Na cílovém telefonu otevři testovací HTTPS adresu, vytvoř smyšlený záznam s fotkou, večer, oslavu a týden. Změň nastavení a aplikaci zavři a znovu otevři.
2. Stáhni zálohu a ověř, že soubor skutečně najdeš ve Stažených souborech. Zapni režim letadlo, aplikaci otevři, načti fotku a ulož další záznam.
3. Smaž jeden záznam, restartuj aplikaci a ověř, že se nevrátil. Potom vyzkoušej „Smazat všechno“ a obnov smyšlený deník ze zálohy.

Automatické testy desktopových browser enginů nenahrazují ověření fyzické iOS/Android PWA. Velké dlouhodobé deníky a fyzické výpadky disku nejsou výkonově ani havarijně vyčerpávajícím způsobem ověřené. Současný jednoduchý adaptér při operaci načítá snapshot deníku; není optimalizovaný pro rozsáhlé archivy.

## Mapa projektu a rozdělaná migrace

| Soubor | K čemu je |
| --- | --- |
| `src/pages/index.astro`, `src/app/app.js` | Statická obálka a původní vanilla JS obrazovky. UI používá nové EN datové API. |
| `src/data/storage.ts` | Produkční lokální CRUD, společný zámek nových karet, zálohy a přerušitelný reset. |
| `src/data/client.ts`, `identity.ts`, `batch.ts` | Inicializace Evolu, místní identita a potvrzené dávky včetně soft-delete a obnovení stejného ID. |
| `src/data/schema.ts`, `mapping.ts`, `photos.ts` | EN schéma, zachování CZ datových klíčů a neznámých JSON polí, validace a bajty fotek. |
| `src/data/backup.ts` | Formát zálohy, úplná příprava importu a export snapshotu. |
| `src/data/legacy.ts`, `src/app/uloziste.js` | Příprava čtení původní IndexedDB a její historická implementace. Produkční aplikace je neimportuje. |
| `scripts/build-sw.mjs`, `scripts/sw-legacy.js` | Service worker s manifestem skutečných assetů včetně Evolu workerů, WASM a místních fontů. |
| `public/styl.css`, `src/app/slovniky.js`, `src/app/oslava.js` | Zachovaný vzhled, slovníky a animace. |

**Automatická migrace původní IndexedDB není zapojená.** Stará databáze `mamse` zůstává nedotčená a nový deník ji při startu nečte. Pro Emerku a jejího agenta zůstává read-only `readLegacySnapshot`, mapování šesti stores a roundtrip testy. Dokončení migrace ještě potřebuje koordinaci se starou aplikací, marker, ověření celého převodu a scénáře přerušení. Pouhá existence helperů není hotová migrace. Import staré JSON zálohy formátu 1 se samostatně validuje; nepodporovaný obsah se odmítne s chybou.

## Licence a zdroje

Kolo emocí a kolo potřeb © Emer, Mimonádovna. Průvodce je inspirovaný nenásilnou komunikací (Marshall B. Rosenberg; Feelings and Needs Inventory © 2005 Center for Nonviolent Communication). Skupiny potřeb podle Manfreda Max-Neefa. Písmo Inter (SIL Open Font License).

Mám se! není zdravotnický prostředek a nenahrazuje odbornou pomoc.

Písmo Fraunces © The Fraunces Project Authors, SIL Open Font License 1.1; text je v `public/fonty/Fraunces-OFL.txt`. Provozovatel, licence aplikace, držitel práv a bezpečnostní kontakt: **DOPLNIT PŘED MERGEM** autorkou. Závislosti ani přibalená fontová licence samy neudělují licenci aplikaci; v `package.json` zůstává `UNLICENSED`.

## Spolupráce a další kroky

[Jak přispět](CONTRIBUTING.md) · [Bezpečnost](SECURITY.md) · [Pravidla spolupráce](CODE_OF_CONDUCT.md) · [Stav licence](LICENSE) · [Správa a Pages](docs/MAINTAINER.md) · [Malá roadmapa pro Claude Code](docs/ROADMAP.md).
