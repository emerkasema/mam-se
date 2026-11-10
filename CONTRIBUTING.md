# Jak přispět

Děkujeme za malé, srozumitelné příspěvky. Než začneš, přečti [README](README.md) (spuštění, datový tok i omezení) a [AGENTS.md](AGENTS.md). Projekt je lokální prototyp; větší změnu nejdřív navrhni v issue. Licence dosud není rozhodnutá, viz [LICENSE](LICENSE).

1. Použij verze z `.bun-version` a `.node-version`, spusť `bun install --frozen-lockfile` a `bun run dev`. Pracuj ve vlastní větvi a samostatném profilu prohlížeče se smyšlenými daty.
2. Zachovej české rozhraní a vzhled. Nové technické názvy piš anglicky, vysvětlení česky. Zálohy a původní datové klíče jsou kompatibilitní smlouva; neměň je bez výslovného zadání.
3. Před PR spusť `bun run check`, `bun run build`, `bun run test`, `bun run test:e2e`, `bun run build:integration` a `bun run test:integration`. Instalaci prohlížečů a rozdíl macOS/Linux popisuje README. Nakonec `git diff --check` a vlastní kontrola diffu.
4. Pošli malý PR s cílem, důvodem a skutečnými výsledky kontrol. Neprovedené testy pojmenuj; samotný build neprokazuje funkční deník. Vizuální baseline nepřepisuj kvůli neúspěchu testu bez kontroly rozdílu.

Do issue, PR, screenshotů, logů ani promptů nevkládej skutečný deník, JSON zálohu, kontakty, fotky nebo obnovovací tajemství. Bezpečnostní chyby řeš podle [SECURITY.md](SECURITY.md). Návazné malé úkoly najdeš v [roadmapě](docs/ROADMAP.md).
