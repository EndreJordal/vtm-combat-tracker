#!/usr/bin/env node
/* Regenerates the reference tables in README.md from js/data.js.
 * Run from the repo root:  node tools/readme-tables.js
 * Tables are written between <!-- BEGIN:name --> and <!-- END:name --> markers. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8');
const D = vm.runInNewContext(src + '\n;({ ATTRS, KINDS, HEALTH_TEMPLATES, ARMOR, WEAPONS, WEAPON_GROUPS, weaponGroup, PRESETS, MANEUVERS, TARGETING, RANGES, COVER });');

const weaponById = Object.fromEntries(D.WEAPONS.map(w => [w.id, w]));
const code = s => '`' + s + '`';
const cell = s => String(s ?? '').replace(/\|/g, '\\|');
const dmg = w => w.type === 'fire' ? `${w.fireLevels || 1} auto` : w.base === 'str' ? `Str${w.mod ? '+' + w.mod : ''}` : String(w.mod);
const type = w => ({ B: 'B', L: 'L', A: 'A', gun: 'L*', blunt: 'B*', fire: 'A (fire)' }[w.type] || w.type);
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.map(cell).join(' | ')} |`)].join('\n');

/* ---- presets ---- */
function presetsMd() {
  const cats = [...new Set(D.PRESETS.map(p => p.cat))];
  return cats.map(cat => {
    const rows = D.PRESETS.filter(p => p.cat === cat).map(p => {
      const a = p.a; // [Str, Dex, Sta, Cha, Man, App, Per, Int, Wit]
      const carried = (p.weapons || []).map(code).join(' ') || '—';
      const fav = (p.favored || []).filter(id => !(p.weapons || []).includes(id)).map(code).join(' ') || '—';
      const pools = [`WP ${p.wp}`, p.bp ? `BP ${p.bp}` : '', p.extra ? `${p.extra[0]} ${p.extra[1]}` : ''].filter(Boolean).join(', ');
      return [code(p.id), p.name, D.KINDS[p.kind].label, `${a[0]}/${a[1]}/${a[2]}`, a[1] + a[8], pools, p.armor || 0, p.health && p.health !== 'standard' ? p.health : 'standard', p.disc || '—', carried, fav];
    });
    return `#### ${cat}\n\n` + table(['ID', 'Name', 'Kind', 'Str/Dex/Sta', 'Init rtg', 'Pools', 'Armor', 'Health', 'Disciplines', 'Carries', 'Also favored'], rows);
  }).join('\n\n');
}

/* ---- weapons ---- */
function weaponsMd() {
  return D.WEAPON_GROUPS.map(g => {
    const items = D.WEAPONS.filter(w => w.id !== 'unarmed' && D.weaponGroup(w) === g.id)
      .sort((a, b) => (a.homebrew ? 1 : 0) - (b.homebrew ? 1 : 0) || (a.mod || 0) - (b.mod || 0));
    if (!items.length) return '';
    const head = ['ID', 'Name', 'Damage', 'Type', ...(g.ranged ? ['Range', 'Rate', 'Clip'] : []), 'Conceal', 'Quirk', 'Source'];
    const rows = items.map(w => [code(w.id), w.name, dmg(w), type(w), ...(g.ranged ? [w.range || '—', (w.rate || '—') + (w.burst ? ' (auto)' : ''), w.clip || '—'] : []),
      w.conceal || '—', w.quirk || '', w.source || (w.homebrew ? 'homebrew' : w.beast ? 'Bestiary' : 'core')]);
    return `#### ${g.label}\n\n` + table(head, rows);
  }).filter(Boolean).join('\n\n');
}

/* ---- reference ---- */
function referenceMd() {
  const kindRules = {
    vampire: 'Soaks bashing and lethal with Stamina + Fortitude; aggravated with Fortitude only. Halves bashing after soak. Firearms do bashing unless aimed at the head. Torpor at Incapacitated + normal damage; Final Death from aggravated.',
    ghoul: 'Soaks bashing; soaks lethal only while it has vitae (blood pool above 0). Aggravated sources count as lethal. Does not halve bashing.',
    mortal: 'Soaks bashing only (armor still helps against lethal). Aggravated sources count as lethal. Dies past Incapacitated.',
    mage: 'As mortal.',
    werewolf: 'Soaks everything with Stamina (not silver). Does not halve bashing. Battle form doubles Physical Attributes (status toggle).',
    faerie: 'Soaks lethal; takes aggravated damage only from fire (other aggravated sources count as lethal). Does not halve bashing.',
    wraith: 'Soaks lethal. Use Shadowlands Strength for fights.',
    animal: 'As mortal. Bestiary attacks are fixed dice pools.',
  };
  const kinds = table(['`kind`', 'Label', 'How it takes damage'], Object.entries(D.KINDS).map(([k, v]) => [code(k), v.label, kindRules[k] || '']));
  const armor = table(['`armor`', 'Armor', 'Soak bonus', 'Dexterity penalty'], D.ARMOR.map(a => [code(a.r), a.n, a.r ? '+' + a.r : '—', a.pen ? '−' + a.pen : '—']));
  const health = table(['`health`', 'Levels'], [
    ['`standard`', D.HEALTH_TEMPLATES.standard.map(l => l.n + (l.p ? ` (${l.p})` : '')).join(', ')],
    ['`extra`', D.HEALTH_TEMPLATES.extra.map(l => l.n + (l.p ? ` (${l.p})` : '')).join(', ') + ' — then dead'],
    ['custom string', 'Comma-separated penalties: `OK` = no penalty, numbers like `-1`, and `Inc` for Incapacitated, e.g. `"OK,-1,-1,-3,-5,Inc"`. Without `Inc` the creature dies when the last box fills.'],
  ]);
  const man = Object.entries(D.MANEUVERS).flatMap(([kind, list]) => list.map(m => [kind, m.name,
    `${m.trait[0][0].toUpperCase() + m.trait[0].slice(1)} + ${m.trait[1][0].toUpperCase() + m.trait[1].slice(1)}`,
    m.acc ? `+${m.acc}` : '—', m.diff ? `+${m.diff}` : '—',
    m.dmg === 'weapon' ? 'weapon' : m.dmg === 'none' ? 'none' : typeof m.dmg === 'object' ? `Str${m.dmg.mod ? '+' + m.dmg.mod : ''}${m.dmg.type ? ' ' + m.dmg.type : ''}` : m.dmg,
    m.ammo ? (m.ammo === 'all' ? 'whole clip' : m.ammo) : '—', m.note || (m.needs ? 'burst-capable weapons only' : '')]));
  const maneuvers = table(['Weapon kind', 'Maneuver', 'Roll', 'Acc', 'Diff', 'Damage', 'Ammo', 'Notes'], man);
  return `#### Creature kinds\n\n${kinds}\n\n#### Armor\n\n${armor}\n\n#### Health charts\n\n${health}\n\n#### Maneuvers (attack dialog)\n\n${maneuvers}`;
}

const blocks = { presets: presetsMd(), weapons: weaponsMd(), reference: referenceMd() };
const readmePath = path.join(root, 'README.md');
let readme = fs.readFileSync(readmePath, 'utf8');
for (const [name, body] of Object.entries(blocks)) {
  const re = new RegExp(`(<!-- BEGIN:${name} -->)[\\s\\S]*?(<!-- END:${name} -->)`);
  if (!re.test(readme)) throw new Error(`README.md is missing the <!-- BEGIN:${name} --> / <!-- END:${name} --> markers`);
  readme = readme.replace(re, `$1\n<!-- generated by tools/readme-tables.js; edit js/data.js and re-run -->\n\n${body}\n\n$2`);
}
fs.writeFileSync(readmePath, readme);
console.log(`README.md updated: ${D.PRESETS.length} presets, ${D.WEAPONS.length - 1} weapons.`);
