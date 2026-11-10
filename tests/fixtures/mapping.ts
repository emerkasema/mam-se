import type { LegacySnapshot } from '../../src/data/legacy.ts';
import { legacyFixture } from './legacy.ts';

// Skutečný 1×1 PNG; browser test ověří dekódování před uložením i po reloadu.
export const photoBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
export function mappingFixture(): LegacySnapshot {
  const fixture = structuredClone(legacyFixture);
  const entry = fixture.zaznamy[0]!;
  return {
    ...fixture,
    zaznamy: [
      {
        ...entry,
        extra: { text: 'Neznámé pole', values: [null, false, 0] },
        emoce: [
          { slovo: 'radost', zakladni: 'radost', intenzita: null, smer: null, pod_tim: null },
        ],
        telo: [{ pocit: 'bolest', skupina: 'napeti', intenzita: 2, kde: 'záda', upresneni: '' }],
        potreby: [{ potreba: 'klid', skupina: 'pohoda', naplneni: null, skripnuta: false }],
        vyzkum: { spojeni: 0, dalsi: null },
        cinnost: ['chůze'],
        s_kym: ['sama'],
        kde: 'venku',
      },
      {
        ...entry,
        id: 'id-evening',
        typ: 'vecerni',
        poradi: 0,
        popis_bloku: 'Práce',
        prijemnost: null,
        chvile_delka_min: 60,
        zdroj_textu: null,
      },
      {
        ...entry,
        id: 'id-celebration',
        typ: 'oslava',
        podekovani: 'Děkuji.',
        prijemnost: null,
        chvile_delka_min: null,
        potreby: [{ potreba: 'blízkost', skupina: 'vztahy', naplneni: 4, skripnuta: false }],
      },
    ],
    tydny: [
      fixture.tydny[0]!,
      {
        tyden: '2026-W46',
        od: '2026-11-09',
        do: '2026-11-15',
        vytvoreno: entry.vytvoreno,
        upraveno: null,
        vyplneno: true,
        podily: { prijemny: 50, neutralni: 25, neprijemny: 25 },
        minuty: 120,
        pocet_zaznamu: 3,
        barva: '#aabbcc',
        vzpominka: '',
        tema: 'Téma',
        dal: '',
        who5: { odpovedi: [0, 1, 2, 3, 4], hruby: 10, index: 40, nizky: true },
        verze_aplikace: '0.7.0',
      },
    ],
    nastaveni: [
      {
        key: 'hlavni',
        value: {
          ...fixture.nastaveni,
          duveryhodne_kontakty: [
            { jmeno: 'Test', zpusob: 'email', hodnota: 'test@example.invalid' },
          ],
          pripominka_cas: '19:30',
          kod_ucastnika: null,
          extra: { enabled: true },
        },
      },
      { key: 'other', value: { own: 'Další klíč' } },
      { key: 'empty', value: {} },
    ],
  };
}
