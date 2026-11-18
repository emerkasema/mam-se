# Nejdřív si aplikaci vyzkoušej

**Cíl: otevřít místní zkušební aplikaci na počítači.** Po instalaci nástrojů počítej přibližně s 5–10 minutami. GitHub zobrazuje zdrojové soubory; samotná stránka repozitáře aplikaci nespouští. Veřejná testovací URL zatím v tomto návodu není potvrzená.

Větev `miccy-main` je samostatný technický základ s Astro a Evolu. Původní `main` může dál existovat vedle ní. Pro vyzkoušení nemusíš nic mergovat ani vytvářet pull request.

## 1. Otevři správnou kopii projektu

Na GitHubu přepni nad seznamem souborů větev na **miccy-main**. Pro novou místní kopii otevři terminál ve složce, kam si ukládáš projekty, a spusť:

```sh
git clone --branch miccy-main --single-branch https://github.com/emerkasema/mam-se.git mam-se-reference
cd mam-se-reference
```

Pokud složka už existuje, nevytvářej přes ni novou kopii. Otevři ji v editoru a v terminálu ověř `git status --short --branch`. Na prvním řádku má být `miccy-main`; při rozpracovaných změnách nejdřív požádej agenta o jejich kontrolu.

## 2. Nech agenta ověřit nástroje

Projekt používá Bun podle `.bun-version` a Node podle `.node-version`. Neinstaluj náhodné verze ani nenahrazuj Bun příkazem `npm install`. Pokud nástroje nemáš, použij následující prompt v Claude Code **otevřeném ve složce projektu**:

```text
Chci si tento projekt nejprve bezpečně vyzkoušet na počítači.
Přečti AGENTS.md, README.md a docs/TRY_IT.md. Ověř složku, větev,
rozpracované změny a dostupnost Bun a Node podle souborů s verzemi.
Pokud nástroj chybí, vysvětli mi jednu konkrétní možnost instalace
pro můj systém. Před globální instalací nebo změnou konfigurace se zeptej.
Je-li prostředí připravené, spusť bun install --frozen-lockfile,
bun run build a místní preview podle návodu. Vypiš přesnou klikací URL
a nech preview běžet. Nic nepublikuj, nepushuj, nemerguj, neměň remotes
a nemaž žádná data. Použijeme pouze smyšlené záznamy.
Při chybě zastav navazující kroky a vysvětli příčinu; neobcházej ji
pomocí --force, vypnutím kontrol nebo smazáním úložiště.
```

## 3. Spusť hotovou aplikaci

Pokud nástroje máš, spusť postupně v terminálu projektu:

```sh
bun install --frozen-lockfile
bun run build
bun run preview -- --host 127.0.0.1 --port 4321 --ignore-lock
```

Pokud některý příkaz skončí chybou, další nespouštěj. S úspěšně běžícím preview otevři **[http://127.0.0.1:4321/mam-se/](http://127.0.0.1:4321/mam-se/)**. Terminál nech otevřený; `Ctrl+C` preview zastaví. Pokud je port obsazený, zastav předchozí dev/preview nebo nech agenta ověřit příčinu.

Použij samostatný profil prohlížeče bez skutečného deníku. První návštěva ukáže tříkrokový úvod. Volitelné diktování a týdenní souhrny mohou zůstat vypnuté. Nová verze automaticky nepřebírá původní databázi.

## 4. Vyzkoušej jednu smyšlenou chvíli

1. Dokonči úvod, klikni **Zaznamenat**, napiš „Zkušební procházka“ a záznam ulož.
2. Obnov stránku. Záznam musí zůstat na Domově.
3. V **Nastavení → Záloha → Stáhnout zálohu** stáhni JSON a najdi jej ve stažených souborech.
4. Po prvním úplném načtení vypni připojení k internetu a obnov stránku. Záznam musí být dál dostupný.
5. Znovu připoj internet. Pokud chceš pokračovat mazáním a obnovou, použij [telefonní zkušební scénář](../README.md#krátká-ruční-zkouška-na-telefonu), stále jen se smyšlenými údaji.

Stažený JSON není šifrovaný. Soubor se skutečným deníkem neposílej agentovi ani do Gitu. Místní identita není účet ani záloha.

## 5. Rozhodni o dalším kroku

Pro první úpravu vytvoř vlastní větev z vyzkoušeného základu. Agentovi můžeš zadat:

```text
Přečti AGENTS.md a ověř git status a dostupné větve.
Chci pokračovat z miccy-main. Zachovej všechny moje rozpracované změny
a vytvoř z aktuálního referenčního základu novou codex- pracovní větev.
Nejdřív mi jednou větou popiš současný stav a jeden malý další úkol
z docs/ROADMAP.md. Zatím nic nepublikuj ani nemerguj do main.
```

Pro odkaz otevřitelný na telefonu je potřeba samostatně nastavit hosting. Adresa `127.0.0.1` na telefonu míří na telefon, nikoli na počítač. [Návod ke správě a Pages](MAINTAINER.md) patří až k tomuto dalšímu kroku; push větve sám web nenasadí.

Když se něco nepovede, pošli agentovi příkaz a první chybovou zprávu. Před mazáním dat vždy nejdřív ověř existující zálohu. [Oficiální návod GitHubu ke klonování](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository).
