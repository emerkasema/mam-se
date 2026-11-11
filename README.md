# Mám se!

Osobní deník pohody. Webová aplikace (PWA), která běží v telefonu a všechno, co do ní člověk zapíše, nechává jen v jeho telefonu.

**Verze 0.10.0 – první prototyp:** Domov, okamžitý záznam s fotkou, večerní ohlédnutí s rozvrhem dne, shrnutí a snímek dne ke sdílení, oslava dne s animacemi a sdílením, prosba blízkému člověku, týdenní ohlédnutí s WHO-5, Můj přehled (kalendář, průběh týdnů, souvislosti), týdenní souhrn do společné tabulky se souhlasem, barva dne, detail a doplňování záznamů, pomoc, připomínka do kalendáře, nastavení se zálohou.

## Co je v kterém souboru

| Soubor | K čemu je |
| --- | --- |
| `index.html` | Kostra stránky. Načte vzhled a program. |
| `styl.css` | Vzhled: barvy (nahoře v `:root`), písmo, tlačítka, karty. |
| `js/app.js` | Program: obrazovky, klepnutí, ukládání záznamu, pomoc. |
| `js/slovniky.js` | Slova, která aplikace nabízí: emoce, tělo, potřeby, činnosti. Tady se slova přidávají a opravují. |
| `js/oslava.js` | Animace oslav (konfety, deka, drink…). |
| `js/uloziste.js` | Ukládání do telefonu (IndexedDB), záloha a obnova. |
| `sw.js` | Díky němu aplikace funguje i bez internetu. **Po každé změně souborů zvyš číslo `VERZE`.** |
| `manifest.webmanifest` | Název a ikony pro přidání na plochu. |
| `ikony/`, `fonty/` | Logo, ikony aplikace a písmo Inter. |

## Kam se co ukládá

- Záznamy, fotky a nastavení: jen v prohlížeči telefonu (IndexedDB). Nikam se neposílají. Fotky se zmenší a tím ztratí skryté údaje (např. místo pořízení); v záloze jsou uložené jako text.
- Diktování přes tlačítko „Diktovat“ zpracovává Google (stejně jako mikrofon na klávesnici).
- Písma Inter i Fraunces jsou uložená přímo u aplikace (složka `fonty`). Aplikace nenačítá nic z cizích serverů.

## Jak vyzkoušet změny

Po úpravě souborů je nahraj na GitHub znovu (stejně jako poprvé). Zvyš číslo `VERZE` v `sw.js`, jinak si telefon může chvíli držet starou verzi. Telefon pak stačí zavřít a otevřít aplikaci znovu.

## Licence a zdroje

Kolo emocí a kolo potřeb © Emer, Mimonádovna. Průvodce je inspirovaný nenásilnou komunikací (Marshall B. Rosenberg; Feelings and Needs Inventory © 2005 Center for Nonviolent Communication). Skupiny potřeb podle Manfreda Max-Neefa. Písmo Inter (SIL Open Font License).

Mám se! není zdravotnický prostředek a nenahrazuje odbornou pomoc.
