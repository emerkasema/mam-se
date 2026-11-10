# Bezpečnost a soukromí

Deník se ukládá místně přes Evolu/SQLite. Synchronizace je vypnutá (`transports: []`); recovery ani serverové přihlášení nejsou implementované. Úložiště nechrání před člověkem u odemčeného zařízení, škodlivým rozšířením ani kódem stejného originu. JSON export není šifrovaný. Vymazání dat webu, evikce nebo ztráta zařízení mohou bez zálohy znamenat ztrátu deníku. Další hranice a zálohování popisuje [README](README.md).

## Neveřejné hlášení

**DOPLNIT PŘED MERGEM — bezpečnostní kontakt a podporované verze:** autorka určí neveřejný kanál i rozsah podpory. Zatím není stanovené SLA ani přislíbená aktivní údržba konkrétní verze.

Doporučujeme autorce zapnout GitHub Private vulnerability reporting, je-li pro repozitář dostupné. Jeho aktivaci tento soubor nepotvrzuje. Pokud se na GitHubu zobrazuje „Report a vulnerability“, použij tento neveřejný formulář; jinak vyčkej na doplnění kontaktu. Zranitelnost ani deník nevkládej do veřejného issue.

Popiš verzi/commit, prohlížeč, dopad a minimální reprodukci se syntetickými daty. Neposílej pravou zálohu, identitu ani obnovovací tajemství. Případnou přílohu nejdřív očisti od osobních dat.
