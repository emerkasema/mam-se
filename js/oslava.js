// =====================================================================
// ANIMACE OSLAV – krátká něžná animace přes celou obrazovku.
// Která se přehraje, záleží na skupině naplněných potřeb:
//   bezpečí → deka a kakao, láska → tančící srdíčka,
//   výživa → rozkvétající květina, sounáležitost → květinový věnec,
//   odpočinek a hra → drink, porozumění a smysl → transparent s textem,
//   tvořivost → konfety, autonomie → ohňostroj, bez potřeb → konfety.
// Trvá asi 5–6 vteřin, klepnutím jde přeskočit, je bez zvuku.
// Kdo má v telefonu zapnuté omezení pohybu, uvidí klidný obrázek.
// =====================================================================

export const ANIMACE_PODLE_SKUPINY = {
  'bezpečí': 'deka',
  'láska': 'srdicka',
  'výživa': 'kvetina',
  'sounáležitost': 'venec',
  'odpočinek a hra': 'drink',
  'porozumění': 'transparent',
  'smysl': 'transparent',
  'tvořivost': 'konfety',
  'autonomie': 'ohnostroj'
};

const BARVY = ['#246B56', '#72B97F', '#E6B173', '#F5BE4B', '#F4C7C3', '#BFD8E8', '#D9D2EA'];

// Barva dne: v každé animaci se v ní objeví něco (deštníček, plátky, srdíčka…).
// Když barva dne není, použije se výchozí barva té části.
let barvaDne = null;
const bd = (vychozi) => barvaDne || vychozi;
// Tmavší odstín barvy (na obrysy, aby byla vidět i velmi světlá barva).
function tmavsi(hex, k = 0.6) {
  const c = [1, 3, 5].map(i => Math.round(parseInt(hex.substr(i, 2), 16) * k));
  return '#' + c.map(x => x.toString(16).padStart(2, '0')).join('');
}
const DELKA = 5600; // ms
let V = 800, S = 400; // výška a šířka plochy (nastaví se při spuštění)

function el(tag, styl = '', html = '') {
  const e = document.createElement(tag);
  if (styl) e.style.cssText = styl;
  if (html) e.innerHTML = html;
  return e;
}
const nahoda = (a, b) => a + Math.random() * (b - a);

function bezpecnyText(t) {
  return String(t || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Spustí animaci. Vrací slib, který se splní, až animace skončí.
export function spustOslavu(druh, text, barva) {
  barvaDne = /^#[0-9a-fA-F]{6}$/.test(barva || '') ? barva : null;
  return new Promise((hotovo) => {
    const klidne = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const vrstva = el('div', '', '');
    vrstva.className = 'oslava-vrstva';
    vrstva.setAttribute('role', 'dialog');
    vrstva.setAttribute('aria-label', 'Oslava: ' + (text || ''));
    const scena = el('div');
    scena.className = 'oslava-scena';
    vrstva.appendChild(scena);
    const napoveda = el('p', '', 'Klepnutím zavřeš');
    napoveda.className = 'oslava-napoveda';
    vrstva.appendChild(napoveda);
    document.body.appendChild(vrstva);
    V = vrstva.clientHeight || window.innerHeight; S = vrstva.clientWidth || window.innerWidth;

    let skonceno = false;
    const konec = () => {
      if (skonceno) return;
      skonceno = true;
      vrstva.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: 'forwards' }).onfinish = () => { vrstva.remove(); hotovo(); };
    };
    vrstva.addEventListener('click', konec);
    vrstva.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'forwards' });

    const kresli = KRESLENI[druh] || KRESLENI.konfety;
    kresli(scena, text || '', klidne);
    setTimeout(konec, klidne ? 3000 : DELKA);
  });
}

// Popisek s textem oslavy (pod animací)
function popisek(scena, text, zpozdeni = 600, velky = false) {
  if (!text) return;
  const p = el('p', '', bezpecnyText(text));
  p.className = 'oslava-text' + (velky ? ' velky' : '');
  scena.appendChild(p);
  p.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
    { duration: 600, delay: zpozdeni, fill: 'backwards', easing: 'ease-out' });
}

const KRESLENI = {
  // ---------- konfety: déšť shora a dvě „konfetová děla“ ze spodních rohů ----------
  konfety(scena, text, klidne) {
    const pole = el('div'); pole.className = 'oslava-pole'; scena.appendChild(pole);
    const pocet = klidne ? 30 : 150;
    for (let i = 0; i < pocet; i++) {
      const barva = barvaDne && i % 3 === 0 ? barvaDne : BARVY[i % BARVY.length];
      const delo = !klidne && i % 3 === 1;              // každá třetí letí z rohu
      const zleva = i % 2 === 0;
      const k = el('span', 'left:' + (delo ? (zleva ? 0 : 100) : nahoda(0, 100)) + '%;top:' + (klidne ? nahoda(5, 90) : delo ? 100 : -4) +
        '%;background:' + barva + ';width:' + nahoda(8, 14) + 'px;height:' + nahoda(12, 20) + 'px;border-radius:' + (i % 4 ? '3px' : '50%'));
      k.className = 'oslava-castice';
      pole.appendChild(k);
      if (klidne) continue;
      if (delo) {
        const dx = (zleva ? 1 : -1) * nahoda(S * .25, S * .8), vrchol = -nahoda(V * .55, V * .9);
        k.animate([
          { transform: 'translate(0,0) rotate(0)' },
          { transform: 'translate(' + dx * .7 + 'px,' + vrchol + 'px) rotate(' + nahoda(200, 500) + 'deg)', offset: .4, easing: 'ease-in' },
          { transform: 'translate(' + dx + 'px,' + (vrchol * .2 + 60) + 'px) rotate(' + nahoda(600, 1100) + 'deg)' }
        ], { duration: nahoda(3200, 4400), delay: nahoda(0, 500), easing: 'cubic-bezier(.15,.75,.35,1)', fill: 'both' });
      } else {
        k.animate([
          { transform: 'translate(0,0) rotate(0deg)' },
          { transform: 'translate(' + nahoda(-80, 80) + 'px,' + (V * nahoda(1.05, 1.2)) + 'px) rotate(' + nahoda(400, 1000) + 'deg)' }
        ], { duration: nahoda(3400, 5200), delay: nahoda(0, 1600), easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' });
      }
    }
    popisek(scena, text, 300, true);
  },

  // ---------- ohňostroj: rakety stoupají a rozprsknou se, s jiskřením ----------
  ohnostroj(scena, text, klidne) {
    const pole = el('div'); pole.className = 'oslava-pole'; scena.appendChild(pole);
    const vybuchy = klidne ? 3 : 10;
    const zakladni = ['#246B56', '#E6A23C', '#C9706B', '#4F7CA8', '#8C6BB1', '#72B97F', '#F5BE4B'];
    for (let v = 0; v < vybuchy; v++) {
      const x = nahoda(12, 88), y = nahoda(8, 42), barva = barvaDne && v % 2 === 0 ? barvaDne : zakladni[v % 7];
      const start = v * 430, raketa = 650;
      if (!klidne) {
        const r = el('span', 'left:' + x + '%;top:' + y + '%;width:4px;height:16px;border-radius:2px;background:' + tmavsi(barva, .9));
        r.className = 'oslava-castice'; pole.appendChild(r);
        r.animate([{ transform: 'translateY(' + (V * .7) + 'px)', opacity: 1 }, { transform: 'translateY(0)', opacity: 1, offset: .95 }, { opacity: 0 }],
          { duration: raketa, delay: start, easing: 'ease-out', fill: 'both' });
      }
      for (let i = 0; i < 26; i++) {
        const uhel = (i / 26) * Math.PI * 2, d = nahoda(90, 160);
        const j = el('span', 'left:' + x + '%;top:' + y + '%;background:' + barva + ';width:10px;height:10px;border-radius:50%;box-shadow:0 0 0 2px ' + barva + '55');
        j.className = 'oslava-castice';
        pole.appendChild(j);
        if (klidne) { j.style.transform = 'translate(' + Math.cos(uhel) * d * .6 + 'px,' + Math.sin(uhel) * d * .6 + 'px)'; continue; }
        j.animate([
          { transform: 'translate(0,0) scale(1.2)', opacity: 0 },
          { opacity: 1, offset: .05 },
          { transform: 'translate(' + Math.cos(uhel) * d + 'px,' + (Math.sin(uhel) * d + 20) + 'px) scale(.9)', opacity: 1, offset: .55 },
          { transform: 'translate(' + Math.cos(uhel) * d * 1.08 + 'px,' + (Math.sin(uhel) * d + 90) + 'px) scale(.3)', opacity: 0 }
        ], { duration: 1900, delay: start + raketa, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'both' });
      }
    }
    popisek(scena, text, 500, true);
  },

  // ---------- tančící srdíčka + velké srdce, které tluče ----------
  srdicka(scena, text, klidne) {
    const pole = el('div'); pole.className = 'oslava-pole'; scena.appendChild(pole);
    const barvy = ['#E88B8B', '#F4C7C3', bd('#E6B173'), '#D98E9E', bd('#F5BE4B')];
    const srdce = (barva) => '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" fill="' +
      barva + '" stroke="' + tmavsi(barva, .8) + '" stroke-width=".6"/></svg>';
    // velké srdce za textem
    const velke = el('div', 'width:220px;height:220px;margin:0 auto -150px;opacity:.3', srdce(bd('#F4C7C3')));
    scena.appendChild(velke);
    if (!klidne) velke.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.08)', opacity: .3, offset: .25 }, { transform: 'scale(.95)', offset: .4 },
      { transform: 'scale(1.1)', offset: .55 }, { transform: 'scale(.97)', offset: .7 }, { transform: 'scale(1.06)', offset: .85 }, { transform: 'scale(1)', opacity: .3 }],
      { duration: 3200, fill: 'both', easing: 'ease-in-out' });
    const pocet = klidne ? 12 : 38;
    for (let i = 0; i < pocet; i++) {
      const v = nahoda(30, 64);
      const s = el('span', 'left:' + nahoda(2, 92) + '%;top:' + (klidne ? nahoda(5, 85) : 102) + '%;width:' + v + 'px;height:' + v + 'px', srdce(barvy[i % barvy.length]));
      s.className = 'oslava-castice';
      pole.appendChild(s);
      if (klidne) continue;
      const kyv = nahoda(25, 55);
      s.animate([
        { transform: 'translate(0,0) rotate(-12deg) scale(.8)', opacity: 0 },
        { transform: 'translate(' + kyv + 'px,' + (-V * .3) + 'px) rotate(14deg) scale(1)', opacity: 1, offset: .3 },
        { transform: 'translate(' + (-kyv) + 'px,' + (-V * .62) + 'px) rotate(-14deg) scale(1.1)', opacity: 1, offset: .65 },
        { transform: 'translate(' + kyv / 2 + 'px,' + (-V * 1.05) + 'px) rotate(10deg) scale(1)', opacity: 0 }
      ], { duration: nahoda(3400, 4800), delay: nahoda(0, 1600), easing: 'ease-in-out', fill: 'both' });
    }
    popisek(scena, text, 700);
  },

  // ---------- rozkvétající květina (a dvě menší vedle ní), létající pyl ----------
  kvetina(scena, text, klidne) {
    const kvet = (cx, sx, meritko, trida) => `
      <g class="${trida}" transform="translate(${cx} 0) scale(${meritko})">
        <path class="k-stonek" d="M0 330 C-2 260 6 220 0 150" stroke="#246B56" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path class="k-list" d="M0 270 C-36 258 -48 232 -46 214 C-20 220 -2 242 0 270Z" fill="#72B97F"/>
        <path class="k-list" d="M1 240 C38 230 52 206 50 188 C24 194 4 214 1 240Z" fill="#72B97F"/>
        <g class="k-hlava" transform="translate(0 125)">
          ${[0, 45, 90, 135, 180, 225, 270, 315].map(u => `<g transform="rotate(${u})"><ellipse class="k-platek" cx="0" cy="-40" rx="21" ry="40" fill="${bd('#F4C7C3')}" stroke="${tmavsi(bd('#F4C7C3'), .82)}" stroke-width="2"/></g>`).join('')}
          <circle class="k-stred" r="24" fill="#F5BE4B"/>
        </g>
      </g>`;
    const obal = el('div', 'position:relative;width:340px;height:340px;margin:0 auto', `
      <svg viewBox="-170 0 340 340" width="340" height="340" aria-hidden="true" style="overflow:visible">
        ${kvet(-115, 0, .55, 'k-maly')}${kvet(115, 0, .55, 'k-maly')}${kvet(0, 0, 1, 'k-velky')}
      </svg>`);
    scena.appendChild(obal);
    if (!klidne) {
      obal.querySelectorAll('.k-velky, .k-maly').forEach((k, ki) => {
        const zpozdeni = ki === 2 ? 0 : 900 + ki * 250;   // velký kvete první, malé po něm
        const stonek = k.querySelector('.k-stonek');
        stonek.style.strokeDasharray = 190; stonek.style.strokeDashoffset = 190;
        stonek.animate([{ strokeDashoffset: 190 }, { strokeDashoffset: 0 }], { duration: 900, delay: zpozdeni, fill: 'forwards', easing: 'ease-out' });
        k.querySelectorAll('.k-list').forEach((l, i) => {
          l.style.transformOrigin = '0px ' + (i ? 240 : 270) + 'px';
          l.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 500, delay: zpozdeni + 500 + i * 180, fill: 'both', easing: 'ease-out' });
        });
        k.querySelectorAll('.k-platek').forEach((p, i) => {
          p.animate([{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1.12)', offset: .75 }, { opacity: 1, transform: 'scale(1)' }],
            { duration: 600, delay: zpozdeni + 1000 + i * 110, fill: 'both', easing: 'ease-out' });
        });
        k.querySelector('.k-stred').animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 500, delay: zpozdeni + 900, fill: 'both', easing: 'cubic-bezier(.3,1.6,.5,1)' });
        k.querySelector('.k-hlava').animate([{ transform: 'translate(0px,125px) rotate(0deg)' }, { transform: 'translate(0px,125px) rotate(7deg)' }, { transform: 'translate(0px,125px) rotate(-5deg)' }, { transform: 'translate(0px,125px) rotate(0deg)' }],
          { duration: 1800, delay: zpozdeni + 2100, iterations: 2, easing: 'ease-in-out' });
      });
      // pyl / jiskřičky
      for (let i = 0; i < 18; i++) {
        const j = el('span', 'left:' + nahoda(20, 80) + '%;top:' + nahoda(15, 45) + '%;width:7px;height:7px;border-radius:50%;background:' + (i % 2 ? '#F5BE4B' : bd('#F4C7C3')));
        j.className = 'oslava-castice'; obal.appendChild(j);
        j.animate([{ transform: 'translate(0,0) scale(0)', opacity: 0 }, { transform: 'translate(' + nahoda(-40, 40) + 'px,' + nahoda(-60, -20) + 'px) scale(1)', opacity: 1, offset: .5 },
          { transform: 'translate(' + nahoda(-70, 70) + 'px,' + nahoda(-130, -70) + 'px) scale(.4)', opacity: 0 }], { duration: 2000, delay: 2300 + nahoda(0, 1800), fill: 'both' });
      }
    }
    popisek(scena, text, 2200);
  },

  // ---------- květinový věnec ----------
  venec(scena, text, klidne) {
    const n = 14, r = 115;
    let kvety = '';
    for (let i = 0; i < n; i++) {
      const u = (i / n) * Math.PI * 2 - Math.PI / 2, x = 150 + Math.cos(u) * r, y = 150 + Math.sin(u) * r;
      const barva = barvaDne && i % 2 === 0 ? barvaDne : ['#F4C7C3', '#F5BE4B', '#D9D2EA', '#BFD8E8'][i % 4];
      kvety += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><g class="v-kvet">
        <path d="M0 0 C-14 -6 -16 -18 -6 -20 Z" fill="#72B97F" transform="rotate(${(u * 180 / Math.PI + 120).toFixed(0)})"/>
        ${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-9" rx="7" ry="10" fill="${barva}" stroke="${tmavsi(barva, .82)}" stroke-width="1" transform="rotate(${a})"/>`).join('')}
        <circle r="5" fill="#E6B173"/></g></g>`;
    }
    const obal = el('div', 'position:relative;width:300px;height:300px;margin:0 auto', `
      <svg viewBox="0 0 300 300" width="300" height="300" aria-hidden="true">
        <circle cx="150" cy="150" r="${r}" fill="none" stroke="#3E6B5A" stroke-width="4" class="v-kruh"/>${kvety}
      </svg>`);
    scena.appendChild(obal);
    if (text) {
      const t = el('p', '', bezpecnyText(text));
      t.className = 'oslava-text oslava-text-uvnitr';
      obal.appendChild(t);
      if (!klidne) t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 1900, fill: 'both' });
    }
    if (klidne) return;
    const kruh = obal.querySelector('.v-kruh'), obvod = 2 * Math.PI * r;
    kruh.style.strokeDasharray = obvod;
    kruh.animate([{ strokeDashoffset: obvod }, { strokeDashoffset: 0 }], { duration: 1000, fill: 'both', easing: 'ease-in-out' });
    obal.querySelectorAll('.v-kvet').forEach((k, i) => {
      k.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.25)', offset: .7 }, { transform: 'scale(1)' }],
        { duration: 450, delay: 500 + i * 90, fill: 'both' });
    });
  },

  // ---------- drink: přijede sklenička, bublinky vyhodí deštníček, ten se otočí a vrátí ----------
  drink(scena, text, klidne) {
    const obrys = barvaDne ? tmavsi(barvaDne) : '#8C6BB1';
    const obal = el('div', 'position:relative;width:240px;height:300px;margin:60px auto 0', `
      <svg viewBox="0 0 240 300" width="240" height="300" aria-hidden="true" style="overflow:visible">
        <g class="d-sklenice">
          <path d="M44 80 L196 80 L172 270 Q120 288 68 270 Z" fill="#FFFDF9" stroke="#246B56" stroke-width="6" stroke-linejoin="round"/>
          <path class="d-napoj" d="M51 120 L189 120 L173 263 Q120 280 67 263 Z" fill="#F5BE4B" opacity=".85"/>
          <path d="M186 30 L148 190" stroke="#E88B8B" stroke-width="9" stroke-linecap="round"/>
          <circle cx="180" cy="92" r="17" fill="#72B97F" stroke="#246B56" stroke-width="3"/>
          <path d="M180 77 L180 107 M165 92 L195 92" stroke="#246B56" stroke-width="2"/>
          <g class="d-destnik" transform="translate(88 58)">
            <path d="M-50 0 Q0 -50 50 0 Z" fill="${bd('#D9D2EA')}" stroke="${obrys}" stroke-width="3.5"/>
            <path d="M-50 0 Q-25 -10 0 0 Q25 -10 50 0" fill="none" stroke="${obrys}" stroke-width="2.5"/>
            <path d="M0 -2 L10 56" stroke="${obrys}" stroke-width="4" stroke-linecap="round"/>
          </g>
        </g>
      </svg>`);
    scena.appendChild(obal);
    if (!klidne) {
      obal.querySelector('.d-sklenice').animate([{ transform: 'translateY(' + V + 'px) rotate(-10deg)' }, { transform: 'translateY(-14px) rotate(3deg)', offset: .75 }, { transform: 'none' }],
        { duration: 1000, fill: 'both', easing: 'ease-out' });
      // deštníček: vyskočí, otočí se a vrátí se
      obal.querySelector('.d-destnik').animate([
        { transform: 'translate(88px,58px) rotate(0deg)' },
        { transform: 'translate(88px,58px) rotate(-6deg)', offset: .1 },
        { transform: 'translate(70px,-150px) rotate(200deg) scale(1.3)', offset: .45, easing: 'ease-in' },
        { transform: 'translate(96px,-60px) rotate(340deg) scale(1.15)', offset: .7 },
        { transform: 'translate(88px,58px) rotate(360deg) scale(1)', offset: .9 },
        { transform: 'translate(88px,58px) rotate(366deg)' }
      ], { duration: 2200, delay: 1700, fill: 'both', easing: 'ease-out' });
      // bublinky – nejdřív pár, pak jich hodně najednou (to vyhodí deštníček)
      for (let i = 0; i < 34; i++) {
        const v = nahoda(7, 15), naraz = i > 10;
        const b = el('span', 'left:' + nahoda(32, 66) + '%;top:82%;width:' + v + 'px;height:' + v + 'px;border:2px solid #FFFDF9;border-radius:50%;background:#FFFDF955');
        b.className = 'oslava-castice';
        obal.appendChild(b);
        b.animate([{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: .2 }, { transform: 'translate(' + nahoda(-14, 14) + 'px,' + (naraz ? -nahoda(220, 300) : -170) + 'px)', opacity: 0 }],
          { duration: nahoda(1100, 1700), delay: naraz ? 1300 + nahoda(0, 700) : 1000 + nahoda(0, 2600), fill: 'both' });
      }
    }
    popisek(scena, text || 'Na zdraví!', 1100);
  },

  // ---------- transparent: rozvine se, vlaje, kolem třpytky ----------
  transparent(scena, text, klidne) {
    const obal = el('div', 'position:relative;width:min(370px,92vw);margin:0 auto;padding-top:20px');
    const tyc = el('div', 'height:12px;border-radius:6px;background:#7A4E3A;margin:0 -14px');
    const platno = el('div', '', '<p>' + bezpecnyText(text || 'Hurá!') + '</p>');
    platno.className = 'oslava-transparent';
    if (barvaDne) platno.style.borderColor = barvaDne;
    obal.appendChild(tyc); obal.appendChild(platno);
    const praporky = el('div', 'display:flex;justify-content:space-between;margin-top:8px');
    for (let i = 0; i < 11; i++) {
      const p = el('span', 'width:0;height:0;border-left:15px solid transparent;border-right:15px solid transparent;border-top:26px solid ' + (barvaDne && i % 2 === 0 ? barvaDne : BARVY[i % BARVY.length]));
      praporky.appendChild(p);
      if (!klidne) p.animate([{ transform: 'rotate(-10deg)' }, { transform: 'rotate(10deg)' }], { duration: 650, delay: i * 70, iterations: 8, direction: 'alternate', easing: 'ease-in-out' });
    }
    obal.appendChild(praporky);
    scena.appendChild(obal);
    if (klidne) return;
    platno.style.transformOrigin = 'top';
    obal.animate([{ transform: 'translateY(-' + V * .6 + 'px)' }, { transform: 'translateY(12px)', offset: .8 }, { transform: 'none' }], { duration: 900, fill: 'both', easing: 'ease-out' });
    platno.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1.06)', offset: .8 }, { transform: 'scaleY(1)' }], { duration: 1000, delay: 700, fill: 'both', easing: 'ease-out' });
    platno.animate([{ transform: 'skewY(0deg)' }, { transform: 'skewY(2deg)' }, { transform: 'skewY(-2deg)' }, { transform: 'skewY(0deg)' }],
      { duration: 1500, delay: 1800, iterations: 2, composite: 'add' });
    // třpytky kolem transparentu
    for (let i = 0; i < 20; i++) {
      const t = el('span', 'left:' + nahoda(-5, 100) + '%;top:' + nahoda(-20, 120) + '%;width:14px;height:14px;color:' + (barvaDne && i % 2 ? barvaDne : '#F5BE4B'),
        '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="currentColor"/></svg>');
      t.className = 'oslava-castice'; obal.appendChild(t);
      t.animate([{ transform: 'scale(0) rotate(0)', opacity: 0 }, { transform: 'scale(1.3) rotate(90deg)', opacity: 1, offset: .5 }, { transform: 'scale(0) rotate(180deg)', opacity: 0 }],
        { duration: 1000, delay: 1600 + nahoda(0, 3000), fill: 'both' });
    }
  },

  // ---------- deka: celá se snese shora, zadní část skončí za nápisem, přední před ním; pak kakao ----------
  // Deka je pořád jeden kus látky: zadní plocha a přední přehyb mají stejný vzor a navazující okraje.
  deka(scena, text, klidne) {
    const barva = barvaDne || '#E6B173';
    const latka = 'repeating-linear-gradient(90deg, ' + barva + 'cc 0 18px, transparent 18px 36px), ' +
      'repeating-linear-gradient(0deg, ' + barva + '88 0 18px, #FFFDF9 18px 36px)';
    const okraj = tmavsi(barva, .8);
    const obal = el('div', 'position:relative;width:320px;height:400px;margin:0 auto;');
    const zadni = el('div'); zadni.className = 'oslava-deka-zadni';
    zadni.style.background = latka; zadni.style.borderColor = okraj;
    const karta = el('div', '', '<p>' + bezpecnyText(text || 'Je mi dobře.') + '</p>');
    karta.className = 'oslava-karta';
    const predni = el('div'); predni.className = 'oslava-deka-predni';
    predni.style.background = latka; predni.style.borderColor = okraj;
    const hrnek = el('div', 'position:absolute;left:50%;bottom:0;width:140px;margin-left:-70px;z-index:4', `
      <svg viewBox="0 0 130 140" width="140" height="150" aria-hidden="true" style="overflow:visible">
        <g class="h-para" fill="none" stroke="#B9AE9E" stroke-width="4" stroke-linecap="round">
          <path d="M45 30 Q35 18 45 6"/><path d="M65 28 Q55 14 65 2"/><path d="M85 30 Q75 18 85 6"/>
        </g>
        <path d="M18 66 Q20 40 65 40 Q110 40 112 66 Z" fill="#FFFDF9" stroke="#E6DED2" stroke-width="2"/>
        <circle cx="48" cy="50" r="6" fill="#F4C7C3"/><circle cx="76" cy="46" r="6" fill="#FFFDF9" stroke="#E6DED2"/><circle cx="90" cy="54" r="5" fill="#F4C7C3"/>
        <path d="M14 64 L116 64 L108 128 Q65 140 22 128 Z" fill="#C9706B"/>
        <path d="M18 84 L112 84" stroke="#FFFDF9" stroke-width="5" stroke-dasharray="8 7"/>
        <path d="M112 76 Q132 80 128 100 Q124 116 106 112" fill="none" stroke="#C9706B" stroke-width="9" stroke-linecap="round"/>
      </svg>`);
    obal.appendChild(zadni); obal.appendChild(karta); obal.appendChild(predni); obal.appendChild(hrnek);
    scena.appendChild(obal);
    if (klidne) return;
    // Nápis je tu od začátku. Deka padá shora jako jeden kus: obě její části mají stejné kroky pohybu
    // i stejný střed otáčení, takže drží pohromadě. Při dopadu skončí zadní část za nápisem a přední před ním.
    karta.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 450, fill: 'both' });
    const pad = [
      { transform: 'translateY(-' + V + 'px) rotate(-6deg)' },
      { transform: 'translateY(-26px) rotate(2deg)', offset: .68 },
      { transform: 'translateY(8px) rotate(-1deg)', offset: .84 },
      { transform: 'none' }
    ];
    const pohyb = { duration: 1700, delay: 350, fill: 'both', easing: 'ease-out' };
    zadni.style.transformOrigin = '156px 145px';
    predni.style.transformOrigin = '156px -5px';     // stejný bod v ploše obalu
    zadni.animate(pad, pohyb);
    predni.animate(pad, pohyb);
    // přední díl se k nápisu přitulí (lehce se stáhne a povolí)
    predni.animate([{ transform: 'scale(1,1)' }, { transform: 'scale(.95,1.04)' }, { transform: 'scale(1,1)' }],
      { duration: 700, delay: 2050, easing: 'ease-in-out', composite: 'add' });
    hrnek.animate([{ transform: 'translateY(200px) scale(.8)', opacity: 0 }, { transform: 'translateY(-10px) scale(1.05)', opacity: 1, offset: .75 }, { transform: 'none', opacity: 1 }],
      { duration: 800, delay: 2700, fill: 'both', easing: 'ease-out' });
    hrnek.querySelectorAll('.h-para path').forEach((p, i) => {
      p.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1 }, { opacity: 0, transform: 'translateY(-12px)' }],
        { duration: 1400, delay: 3300 + i * 250, iterations: 2, fill: 'both' });
    });
  }
};
