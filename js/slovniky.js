// =====================================================================
// SLOVNÍKY – slova, která aplikace nabízí jako návrhy.
// Vše je převzaté ze zadání (záložky Emoce, Tělesné pocity, Potřeby,
// Činnosti a kontext). Když budeš chtít slovo přidat nebo opravit,
// stačí to udělat tady – zbytek aplikace se přizpůsobí sám.
// =====================================================================

// Verze slovníků a otázek. Ukládá se ke každému záznamu,
// abychom později věděli, podle čeho záznam vznikl.
export const VERZE_PROTOKOLU = '1.0';

// ---------------------------------------------------------------------
// EMOCE
// Osm základních emocí z kola autorky (Emer, Mimonádovna).
// Žádná není „dobrá“ ani „špatná“ – liší se jen tím, jak jsou obecné.
// ---------------------------------------------------------------------
export const ZAKLADNI_EMOCE = [
  'radost', 'důvěra', 'strach', 'odpor', 'hněv', 'bolest', 'vztek', 'smutek'
];

// Přesnější slova. „blizko“ říká, ke které základní emoci slovo patří.
// První základní emoce je hlavní; slovo se ukáže pod všemi uvedenými.
export const PRESNEJSI_EMOCE = [
  { slovo: 'údiv',          blizko: ['radost'] },
  { slovo: 'hrdost',        blizko: ['radost'] },
  { slovo: 'překvapení',    blizko: ['radost', 'strach'] },
  { slovo: 'smír',          blizko: ['důvěra', 'smutek'] },
  { slovo: 'vděk',          blizko: ['radost', 'důvěra'] },
  { slovo: 'nervozita',     blizko: ['strach'] },
  { slovo: 'panika',        blizko: ['strach'] },
  { slovo: 'mrzutost',      blizko: ['vztek'] },
  { slovo: 'klid',          blizko: ['důvěra'] },
  { slovo: 'úzkost',        blizko: ['strach'] },
  { slovo: 'hořkost',       blizko: ['hněv', 'smutek'] },
  { slovo: 'lítost',        blizko: ['smutek'] },
  { slovo: 'netrpělivost',  blizko: ['vztek'] },
  { slovo: 'nadšení',       blizko: ['radost'] },
  { slovo: 'zmatek',        blizko: ['strach'] },
  { slovo: 'naplnění',      blizko: ['radost'] },
  { slovo: 'odpojení',      blizko: ['smutek', 'odpor'] },
  { slovo: 'zahlcení',      blizko: ['strach', 'bolest'] },
  { slovo: 'úleva',         blizko: ['důvěra', 'radost'] },
  { slovo: 'únava',         blizko: ['bolest'] },
  { slovo: 'povzbuzení',    blizko: ['důvěra', 'radost'] },
  { slovo: 'hřejivý pocit', blizko: ['důvěra', 'radost'] },
  { slovo: 'bezmoc',        blizko: ['smutek', 'strach'] },
  { slovo: 'zvědavost',     blizko: ['radost'] },
  { slovo: 'stud',          blizko: ['odpor', 'strach'] },
  { slovo: 'vina',          blizko: ['smutek', 'hněv'] },
  { slovo: 'osamělost',     blizko: ['smutek', 'bolest'] },
  { slovo: 'nuda',          blizko: ['odpor'] },
  { slovo: 'nechuť',        blizko: ['odpor'] },
  { slovo: 'frustrace',     blizko: ['vztek', 'hněv'] },
  { slovo: 'chuť do života', blizko: [] } // střed kola
];

// Pomocná funkce: přesnější slova pro jednu základní emoci.
export function presnejsiK(zakladni) {
  return PRESNEJSI_EMOCE.filter(e => e.blizko.includes(zakladni)).map(e => e.slovo);
}

// Ke kterému základnímu slovu patří dané slovo (pro uložení do záznamu).
export function zakladniPro(slovo) {
  if (ZAKLADNI_EMOCE.includes(slovo)) return slovo;
  const nalez = PRESNEJSI_EMOCE.find(e => e.slovo === slovo);
  return nalez && nalez.blizko.length ? nalez.blizko[0] : null;
}

// Hněv je vektor – míří na někoho, na něco, nebo na sebe.
export const SMER_HNEVU = [
  { kod: 'na_nekoho', text: 'na někoho' },
  { kod: 'na_neco',   text: 'na něco' },
  { kod: 'na_sebe',   text: 'na sebe' }
];

// ---------------------------------------------------------------------
// TĚLESNÉ POCITY (schváleno 6. 11. 2026)
// ---------------------------------------------------------------------
export const TELO = [
  { skupina: 'energie a únava', pocity: ['energie v těle', 'čilost', 'únava', 'ospalost', 'vyčerpanost'] },
  { skupina: 'napětí a uvolnění', pocity: ['tenze', 'stažení', 'tlak', 'uvolnění', 'tíže', 'lehkost'] },
  { skupina: 'základní potřeby těla', pocity: ['hlad', 'žízeň', 'sytost', 'potřeba pohybu', 'potřeba na záchod'] },
  { skupina: 'kůže a teplota', pocity: ['svědění', 'chlad', 'horko', 'mravenčení', 'přecitlivělost na dotek'] },
  { skupina: 'rytmus a vnitřek', pocity: ['zrychlený tep', 'mělký dech', 'neklid', 'chvění', 'nevolnost', '„motýli v břiše“'] },
  { skupina: 'bolest', pocity: ['bolest'] }
];

// Místa, kde to bolí (u bolesti, když chce člověk upřesnit).
export const MISTA_NA_TELE = [
  'hlava', 'obličej a čelist', 'krk a ramena', 'hrudník', 'břicho',
  'záda', 'ruce', 'nohy', 'celé tělo'
];

export function skupinaTela(pocit) {
  const s = TELO.find(g => g.pocity.includes(pocit));
  return s ? s.skupina : null;
}

// ---------------------------------------------------------------------
// POTŘEBY – 9 skupin podle Max-Neefa (pracovní překlad autorky)
// a konkrétní potřeby z kola autorky.
// ---------------------------------------------------------------------
export const POTREBY = [
  { skupina: 'výživa',          potreby: ['jídlo a pití', 'termoregulace', 'zdraví'] },
  { skupina: 'bezpečí',         potreby: ['jistota, řád', 'důvěra', 'domov', 'klid', 'harmonie', 'přiměřenost'] },
  { skupina: 'láska',           potreby: ['láska', 'intimita', 'dotek', 'přijetí', 'pozornost'] },
  { skupina: 'porozumění',      potreby: ['být slyšena/slyšen', 'souznění', 'jasnost, přímost', 'vědět, umět'] },
  { skupina: 'tvořivost',       potreby: ['tvořivost', 'spontánnost'] },
  { skupina: 'odpočinek a hra', potreby: ['hra', 'zábava', 'spánek', 'relaxace'] },
  { skupina: 'sounáležitost',   potreby: ['sdílení', 'spolupráce', 'podpora', 'uznání', 'patřit někam'] },
  { skupina: 'autonomie',       potreby: ['autonomie', 'prostor, svoboda', 'svým tempem', 'moc', 'soukromí'] },
  { skupina: 'smysl',           potreby: ['efektivita', 'darování', 'krása', 'oslava', 'truchlení'] }
];

export function skupinaPotreby(potreba) {
  const s = POTREBY.find(g => g.potreby.includes(potreba));
  return s ? s.skupina : null;
}

// ---------------------------------------------------------------------
// ČINNOSTI A KONTEXT (schváleno 6. 11. 2026)
// ---------------------------------------------------------------------
export const CINNOSTI = [
  'práce', 'škola, studium', 'cesta, dojíždění', 'domácí práce', 'vaření', 'jídlo',
  'nakupování, vyřizování', 'péče o druhé', 'osobní péče, hygiena', 'pohyb, sport',
  'venku, příroda, procházka', 'odpočinek, nicnedělání', 'šlofíček',
  'telefon, sociální sítě', 'film, seriál, video', 'hry', 'četba', 'tvorba, koníček',
  'učení se něčemu novému', 'setkání, povídání, společný čas', 'intimita',
  'telefonát, zprávy', 'úřady, finance, administrativa', 'zdraví, lékař, terapie',
  'duchovní praxe, meditace', 'dobrovolnictví, pomoc druhým'
];

export const S_KYM = [
  'se sebou', 'partnerka / partner', 'nejlepší kamarádka / kamarád', 'dítě, děti', 'rodina',
  'přátelé', 'kolegyně, kolegové / spolužačky, spolužáci',
  'nadřízená osoba, učitelka / učitel', 'zákazníci, klienti', 'úřad, osoba v úřadu',
  'cizí člověk', 'náhodní lidé kolem', 'zvířata', 'online s někým'
];

export const KDE = [
  'doma', 'v práci, ve škole', 'cestou (auto, doprava, pěšky)', 'venku, v přírodě',
  'u přátel nebo rodiny', 'obchod, úřad, veřejné místo', 'jinde'
];

// ---------------------------------------------------------------------
// POSUVNÍKY „PRO VÝZKUM“ (klasický U-index, nepovinné)
// Pořadí a klíče odpovídají datovému modelu.
// ---------------------------------------------------------------------
export const VYZKUM = [
  { klic: 'stesti',       text: 'štěstí',               kladne: true },
  { klic: 'klid_vrelost', text: 'klid, vřelost',        kladne: true },
  { klic: 'zaujeti',      text: 'zaujetí',              kladne: true },
  { klic: 'pozitek',      text: 'požitek',              kladne: true },
  { klic: 'stres',        text: 'stres',                kladne: false },
  { klic: 'smutek',       text: 'smutek',               kladne: false },
  { klic: 'frustrace',    text: 'frustrace, naštvání',  kladne: false },
  { klic: 'starost',      text: 'starost',              kladne: false },
  { klic: 'bolest',       text: 'bolest',               kladne: false }
];
