# Integrační kontrola Astro + Evolu

Samostatný Astro root používá konfiguraci aplikace. Nevytváří routu v produkčním
`dist/` a nečte deník. Náhodná identita v sessionStorage slouží pouze syntetickému
testu reloadu; není to návrh úložiště identity aplikace.

1. `bunx --no-install playwright install chromium firefox webkit`
2. `bun run build:integration`
3. `bun run test:integration`

Kořenovou cestu ověřuj se stejným `PUBLIC_APP_BASE=/` u obou příkazů.
Vývojový server ověří `INTEGRATION_DEV=1 bun run test:integration`; test emitovaných
assetů se zde záměrně nespouští, protože patří produkčnímu buildu.

Test používá vlastní dočasné persistentní profily. Ephemeral kontext WebKitu
nemá OPFS a Evolu v něm hlásí `NotPersisted`: data po reloadu nepřežijí.
Viz [Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext).
`Unknown` neznamená garanci proti pozdějšímu vymazání dat prohlížečem.

Kontrolujeme skutečný zápis, čtení a reload bez relay, dostupnost obou workerů,
MIME WASM i jeho binární hlavičku. Tento test neprokazuje migraci, offline cache,
obnovu identity, synchronizaci ani chování fyzického telefonu.

Produkční schéma a klient z `src/data/` se testují jen na oddělené stránce
`diary/` tohoto rootu. Používají uloženou náhodnou testovací identitu a
`transports: []`; produkční deník na ně zatím není přepnutý.

1. Úspěch dávky vyžaduje callback všech mutací a přesný readback řádků i bajtů.
2. Neplatný nebo nadlimitní poslední řádek se odmítá před prvním zápisem.
3. Testovací SQLite trigger vyvolá chybu uvnitř dávky: po reloadu se ověřuje
   rollback předchozího insertu, updatu i lokálního markeru. Raw SQL a trigger
   jsou pouze testovací injekce, nikoliv API adaptéru aplikace.
4. Přímá Evolu volání naopak mohou uložit první řádek, pokud pozdější volání
   vyhodí synchronní chybu před odesláním. Potvrzení prvního řádku tedy není
   důkazem atomicity celé zamýšlené operace.
5. `NotPersisted` a abort transakce identity odmítnou připojení; uzavření klienta
   ukončí čekající zápisy. Unit testy navíc ověřují error store, timeout,
   nesouhlas readbacku, duplicitní ID a řídké pole.

Writer nyní podporuje úplné upserty. Doménová validace, legacy mapování,
soft-delete, migrace a import patří navazujícímu adaptéru. Timeout znamená
neznámý výsledek, nikoliv potvrzený rollback nebo automatické opakování.
Rollback injekcí `RAISE(ABORT)` není test fyzického plného disku či výpadku procesu.

Adaptér musí klienta uvolňovat přes `client.close()`, aby čekající dávky ihned
skončily. Přímý dispose nízkoúrovňového `client.evolu` bez `close()` ukončí
čekání až chybou Evolu nebo 15sekundovým timeoutem. Nízkoúrovňová instance
nenahrazuje potvrzené zápisové API.
