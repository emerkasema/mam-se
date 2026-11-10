# Předání správě projektu

Lokální prototyp a jeho hranice popisuje [README](../README.md). Tento návod připravuje GitHub Actions a Pages; vzdálené nastavení ani nasazení tím není provedeno.

## Rozhodnutí před mergem

| Co doplnit | Proč |
| --- | --- |
| **DOPLNIT PŘED MERGEM — licence a držitel práv** | Nahradit [LICENSE](../LICENSE) skutečným textem a upravit `UNLICENSED` až po rozhodnutí. Ověřit oprávnění k převzatým materiálům a doplnit úplnou licenci přibaleného Interu. |
| **DOPLNIT PŘED MERGEM — bezpečnostní/komunitní kontakt, odpovědná osoba a podporované verze** | Vyplnit SECURITY.md a CODE_OF_CONDUCT.md; neslibovat podporu bez kapacity. |
| **DOPLNIT PŘED MERGEM — GitHub owner/repo a publikační větev** | Potvrdit cílový repozitář a chráněnou větev, ze které se smí nasazovat. |
| **DOPLNIT PŘED MERGEM — konečná HTTPS URL/doména a hosting** | Potvrdit existující origin a případný přenos zálohou. Pages je připravená možnost. Produkční relay zůstává odložený. |

## Kontroly a oprávnění GitHubu

1. Po schváleném předání kódu do GitHubu nech doběhnout `CI`. Povinné kontroly nastav podle skutečně vzniklých checks **CI / Linux functional and integration** a **CI / macOS visual baseline** (UI může přidat prefix volajícího workflow). Vyber odpovídající joby z reálného PR. CI běží pro všechny PR a push do `main`, `miccy-main`, `miccy-dev` a `codex-*`; pro jinou integrační větev uprav push filtr. PR nemají path filtr, který by nechal povinnou kontrolu čekat.
2. Na hlavní/publikační větvi vyžaduj PR, úspěšné checks a vyřešené review komentáře; zakaž force push a smazání. Schválení druhým člověkem vyžaduj jen s dostupným reviewerem, aby se samotná autorka nezablokovala. Produkční deploy nepatří mezi podmínky merge.
3. Výchozí `GITHUB_TOKEN` nastav jen pro čtení obsahu a schvaluj běhy externích přispěvatelů. Workflow nepoužívají `pull_request_target`, PAT ani produkční tajemství. Pages/OIDC zápis má pouze deploy job; metadata Pages mají `pages: read`.
4. Zapni dostupné dependency/security alerts a soukromé hlášení zranitelností; dostupnost ochrany větví, Pages a bezpečnostních funkcí závisí na tarifu a viditelnosti repozitáře. Plošný auto-merge není potřeba.

Linux (`ubuntu-24.04`) spouští check, produkční build, unit, funkční E2E ve třech enginech a integrační build/testy. macOS (`macos-15`) spouští Chromium vizuální baseline (14 snímků ve dvou testech). Ty vznikly lokálně na macOS 27/arm64, nikoli na tomto GitHub runneru; rozdíl OS, architektury nebo fontového renderování může vyžadovat kontrolu diffu. Baseline se automaticky neobnovuje. macOS má vyšší spotřebu placených minut; zkontroluj rozpočet. Selhání uchová pouze syntetickou diagnostiku na 3 dny. Místní úspěch neověřuje GitHub runner ani fyzický telefon.

## První Pages nasazení — po rozhodnutí autorky

Pokud dostaneš tento základ jen v referenční větvi, nemusíš jej slučovat do
`main`. Můžeš si větev stáhnout a vyzkoušet lokálně podle README. Push do
`miccy-main` nebo `codex-*` spustí CI, pokud jsou v repozitáři povolené Actions.
Ruční Pages workflow se však v nabídce objeví až tehdy, když je přítomné ve
výchozí větvi. Samotný push referenční větve tedy nezaručuje dostupné tlačítko
pro nasazení. Pro samostatné demo lze po rozhodnutí použít vlastní fork s touto
větví jako výchozí a samostatně nastavenými Pages; výchozí větev původního
projektu kvůli vyzkoušení neměň. Jiný repozitář pod stejným Pages originem není
izolace místních dat — i demo zkoušej v odděleném profilu prohlížeče.

1. V Settings → Pages zvol **Source: GitHub Actions**. Potvrď doménu a HTTPS (u vlastní domény také DNS/certifikát). V environmentu `github-pages` povol jen publikační větev; dostupné schvalování použij podle týmu a tarifu. Výchozí větev musí obsahovat ruční workflow, aby se nabídlo v Actions.
2. Repository variables: `PAGES_DEPLOY_REPOSITORY` = přesné potvrzené `owner/repo`, `PAGES_DEPLOY_BRANCH` = schválená větev bez `refs/heads/`, `PAGES_SITE_URL` = skutečná potvrzená HTTPS adresa webu odpovídající metadatům Pages. Teprve po kontrole nastav `PAGES_DEPLOY_ENABLED` na přesné `true`. Chybějící hodnoty deploy nepovolí; nejde o údaje, které má agent odhadnout.
3. V Actions spusť **Pages (manual)** na schválené větvi. Workflow ověří repozitář/větev i povolení, přečte již nastavené Pages pomocí `configure-pages` (bez automatického enablementu) a porovná URL s potvrzenou proměnnou. Odvodí normalizované `PUBLIC_APP_BASE`: projekt typicky `/repo/`, uživatelský web nebo vlastní doména `/`. Build i browser testy dostanou stejnou hodnotu. Astro `site` se nenastavuje na odhadnutou URL.
4. Tentýž běh sdíleného CI ověří stejný commit. **`bun run build`** vytvoří i SW manifest; holé `astro build` nestačí. Po testech se přes `upload-pages-artifact` nahraje pouze `dist/`. Deploy čeká na Linux i macOS a použije artefakt vlastního běhu, bez `workflow_run` nebo PR artefaktů. Concurrency chrání publikaci; build se nezapisuje do větve `gh-pages`.
5. Ověř veřejnou URL, manifest, ikony, SW scope, WASM a offline práci se syntetickým deníkem podle [telefonního scénáře](../README.md#krátká-ruční-zkouška-na-telefonu). Teprve skutečný GitHub běh potvrzuje runner, runtime downloady, oprávnění a Pages. Při vizuálním selhání nejdřív prohlédni diff.

Změna domény, protokolu či portu mění origin; před změnou exportuj zálohu. **Jiná cesta na stejném originu neizoluje IndexedDB/OPFS**: preview nesmí kolidovat se skutečným deníkem. Pro test používej oddělený browser profil. Produkční doménu neměň náhodně.

## Zastavení a návrat

Nastav `PAGES_DEPLOY_ENABLED` na `false` a zruš rozběhnuté nasazení; samotná proměnná již spuštěný job nezastaví. Již publikovaný web tím nezmizí. Pro návrat připrav na schválené větvi kontrolovaný revert ke známému funkčnímu kódu, nech projít stejné kontroly a ručně nasaď nový ověřený build. Dispatch nepovoluje libovolný starý tag či jinou větev. Zachovej origin a ověř aktualizaci SW bez nuceného reloadu během psaní. Návrat kódu **neobnovuje databázi**; starší kód nemusí rozumět novějším datům. Obnovu ze zálohy zkoušej odděleně, bez automatického resetu uživatelů.

Automatický push deploy je volitelná následná změna po prvním úspěšném ručním nasazení: autorka samostatně schválí trigger omezený na publikační větev, se stejnými pojistkami, kontrolami, environmentem a oprávněními.

## Ověřené zdroje

Release, plná SHA a `action.yml`/README byly ověřeny 10. 11. 2026 v oficiálních repozitářích. Akce používají interní Node 24, oddělený od projektového `.node-version`; potřebují aktuální hosted runner (nejméně v2.327.1). Cílem je GitHub.com, nikoli obecně GHES. Při aktualizaci znovu ověř SHA, vstupy a podporu.

| Action | Ověřený stabilní release |
| --- | --- |
| checkout | [v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) |
| setup-node | [v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) |
| setup-bun | [v2.2.0](https://github.com/oven-sh/setup-bun/releases/tag/v2.2.0) |
| upload-artifact | [v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) |
| configure-pages | [v6.0.0](https://github.com/actions/configure-pages/releases/tag/v6.0.0) |
| upload-pages-artifact | [v5.0.0](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0) |
| deploy-pages | [v5.0.1](https://github.com/actions/deploy-pages/releases/tag/v5.0.1) |

Podklady: [GitHub Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Astro na Pages](https://docs.astro.build/en/guides/deploy/github/), [bezpečnost Actions](https://docs.github.com/en/actions/reference/security/secure-use), [ochrana větví](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
