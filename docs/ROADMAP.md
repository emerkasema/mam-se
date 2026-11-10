# Malé další kroky pro Claude Code

Návrhy pro autorku, bez závazných termínů. Každý úkol zadávej zvlášť až po rozhodnutí o jeho rozsahu. Agent nejdřív čte AGENTS.md a README, zachová EN naming a české vysvětlení; pracuje se syntetickými daty, bez samovolného publikování.

| Pořadí a cíl | Krátký prompt pro agenta | Kontrola výsledku |
| --- | --- | --- |
| 1. Dokončit vlastnická rozhodnutí a první publikaci | „Projdi MAINTAINER.md, vypiš chybějící rozhodnutí a připrav konkrétní návrh k mé kontrole. Licence, kontakty, URL ani GitHub nastavení za mě neurčuj.“ | Doplněné pravdivé údaje, úspěšný GitHub CI a samostatně schválený Pages běh; ruční telefonní scénář z README. |
| 2. Změřit větší deník | „Navrhni a změř syntetický větší archiv s fotkami: start, zápis, export/import a paměť. Nejprve report, bez refaktoru adaptéru.“ | Reprodukovatelný objem dat a časy, úplný roundtrip včetně bajtů fotek; známé limity a návrh jednoho malého zlepšení. |
| 3. Uchovat koncept | „Navrhni minimální místní uchování rozepsaného obsahu pro jednu obrazovku. Před implementací ukaž pravidla obnovy, smazání a resetu.“ | Po schválení test reloadu, offline a resetu; koncept se nezamění za uložený záznam, žádný automatický reload během psaní. |
| Později: dokončit legacy migraci | „Zmapuj existující readLegacySnapshot, mapping a testy. Navrhni koordinaci starých karet, atomický marker, kontrolu úplnosti a přerušení. Nezapojuj migraci bez mého schválení.“ | Zdrojová IDB zůstane zachovaná, všechny stores/ID/nastavení/fotky se ověří, opakování neduplikuje a reset data nevrací. |
| Později: recovery a sync | „Nejdřív připrav návrh identity, záloh a výslovného zapnutí sync včetně rizik a výběru relay. Bez serverového auth a bez skutečného deníku na testovacím relay.“ | Samostatně schválená konfigurace a rozsah; teprve následně test dvou syntetických profilů, fotek, konfliktů a vypnutí sync. Fráze sama není záloha. |

Existence helperů neznamená hotovou migraci. Recovery/sync/relay nejsou součástí nynějšího prototypu. Technické předání a nastavení GitHubu shrnuje [MAINTAINER.md](MAINTAINER.md).
