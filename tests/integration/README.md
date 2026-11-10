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
