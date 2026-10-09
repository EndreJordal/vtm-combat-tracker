'use strict';

/* ============================================================
 * Utilities
 * ============================================================ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const d10 = () => 1 + Math.floor(Math.random() * 10);
const clone = o => JSON.parse(JSON.stringify(o));

const STORE = { pcs: 'vtm.pcs', weapons: 'vtm.customWeapons', combat: 'vtm.combat', settings: 'vtm.settings', presets: 'vtm.customPresets' };
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { toast('Could not save to localStorage: ' + e.message); }
}

let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

/* ============================================================
 * Trait parsing ("Alertness 2, Melee (sword-cane) 3, ...")
 * ============================================================ */
function splitTopLevel(str) {
  const out = []; let depth = 0, cur = '';
  for (const ch of String(str || '')) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}
function parseTraits(input) {
  if (!input) return {};
  if (typeof input === 'object') return { ...input };
  const res = {};
  for (const part of splitTopLevel(input)) {
    const clean = part.replace(/\([^)]*\)/g, '').trim();
    const m = clean.match(/^(.+?)\s+(\d+)\b/);
    if (m) res[titleCase(m[1].trim())] = num(m[2]);
  }
  return res;
}
const titleCase = s => s.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
const traitsToString = (obj, exclude = []) =>
  Object.entries(obj || {}).filter(([k, v]) => v > 0 && !exclude.includes(k.toLowerCase())).map(([k, v]) => `${k} ${v}`).join(', ');
function trait(obj, key) {
  if (!obj) return 0;
  const k = Object.keys(obj).find(x => x.toLowerCase().replace(/\s/g, '') === key.toLowerCase().replace(/\s/g, ''));
  return k ? num(obj[k]) : 0;
}

/* ============================================================
 * Health
 * ============================================================ */
const SHORT_LEVEL = { Bruised: 'Brui', Hurt: 'Hurt', Injured: 'Inj', Wounded: 'Wnd', Mauled: 'Maul', Crippled: 'Crip', Incapacitated: 'Inc', Maimed: 'Maim' };
function parseHealth(key) {
  if (!key || HEALTH_TEMPLATES[key]) return clone(HEALTH_TEMPLATES[key || 'standard']);
  return String(key).split(',').map(s => s.trim()).filter(Boolean).map(s => {
    if (/^inc/i.test(s)) return { n: 'Incapacitated', p: null };
    if (/^ok$/i.test(s) || s === '0') return { n: 'OK', p: 0 };
    const p = num(s.replace('−', '-'), 0);
    return { n: String(p), p };
  });
}
const healthOf = c => parseHealth(c.health);

function woundInfo(c) {
  const lv = healthOf(c);
  const total = c.dmg.a + c.dmg.l + c.dmg.b;
  const ignoring = !!(c.st.frenzy || c.st.wpIgnore);
  if (total === 0) return { total, level: null, pen: 0, rawPen: 0, incap: false, label: 'Healthy', ignoring };
  const level = lv[Math.min(total, lv.length) - 1];
  const incap = level.p === null;
  const rawPen = incap ? 0 : -level.p;
  return { total, level, incap, rawPen, pen: ignoring ? 0 : rawPen, label: level.n, ignoring };
}

function applyDamage(c, type, n) {
  n = Math.max(0, n | 0);
  if (!n) return '';
  const key = { B: 'b', L: 'l', A: 'a' }[type];
  const len = healthOf(c).length;
  c.dmg[key] += n;
  let over = c.dmg.a + c.dmg.l + c.dmg.b - len;
  let msg = '';
  if (over > 0) {
    // Aggravated always marks above normal damage; overflow pushes normal levels off the chart.
    for (const k of ['b', 'l', 'a']) { const take = Math.min(over, c.dmg[k]); c.dmg[k] -= take; over -= take; }
    const kind = KINDS[c.kind] || {};
    if (c.state !== 'dead') {
      if (kind.torpor && type !== 'A') { c.state = 'torpor'; msg = `${c.name} falls into torpor.`; }
      else { c.state = 'dead'; msg = kind.torpor ? `${c.name} meets Final Death!` : `${c.name} is dead.`; }
    }
  }
  return msg;
}
function healDamage(c, type, n) {
  const key = { B: 'b', L: 'l', A: 'a' }[type];
  const healed = Math.min(c.dmg[key], n);
  c.dmg[key] -= healed;
  return healed;
}

/* ============================================================
 * Weapons
 * ============================================================ */
let customWeapons = load(STORE.weapons, []);
const allWeapons = () => [...WEAPONS, ...customWeapons];
const getWeapon = id => allWeapons().find(w => w.id === id) || null;
const shortName = w => w?.short || w?.name || '?';
/* Card weapon columns: unarmed is fixed; everything else is close combat (melee) or ranged. */
const slotOf = def => (def.kind === 'ranged' || def.kind === 'thrown' ? 'ranged' : 'melee');
/* Weapons associated with a combatant's preset (or a PC's own loadout); listed first in the swap dropdowns. */
function favoredOf(c) {
  const p = c.presetId && getPreset(c.presetId);
  const pc = c.pcId && pcs.find(x => x.id === c.pcId);
  const ids = [...(p?.weapons || []), ...(p?.favored || []), ...(pc?.weapons || [])].map(w => (typeof w === 'string' ? w : w.wid));
  return [...new Set(ids)].filter(id => id !== 'unarmed' && getWeapon(id));
}
function weaponOptionsFor(c, slot, currentId, { remove = false } = {}) {
  const fav = favoredOf(c).filter(id => slotOf(getWeapon(id)) === slot);
  const rest = allWeapons().filter(w => w.id !== 'unarmed' && slotOf(w) === slot && !fav.includes(w.id) && (!w.beast || w.id === currentId));
  const opt = (w, star) => `<option value="${w.id}" ${w.id === currentId ? 'selected' : ''}>${star ? '* ' : ''}${esc(w.name)} — ${weaponDamageText(w)} ${(TYPE_TAG[w.type] || [w.type])[0]}</option>`;
  return (fav.length ? `<optgroup label="Preset favorites">${fav.map(id => opt(getWeapon(id), true)).join('')}</optgroup>` : '')
    + `<optgroup label="All ${slot} weapons">${rest.map(w => opt(w, false)).join('')}</optgroup>`
    + (remove ? '<optgroup label="—"><option value="__remove">✕ Drop this weapon</option></optgroup>' : '');
}
function weaponDamageText(w) {
  if (!w) return '?';
  if (w.type === 'fire') return `${w.fireLevels || 1} auto`;
  return w.base === 'str' ? `Str${w.mod ? '+' + w.mod : ''}` : `${w.mod}`;
}
const TYPE_TAG = { B: ['B', 'tag-b'], L: ['L', 'tag-l'], A: ['A', 'tag-a'], gun: ['L*', 'tag-g'], blunt: ['B*', 'tag-b'], fire: ['A🔥', 'tag-a'] };
const typeTag = t => { const [txt, cls] = TYPE_TAG[t] || [t, '']; return `<span class="${cls}">${txt}</span>`; };
const TYPE_HELP = { B: 'Bashing', L: 'Lethal', A: 'Aggravated', gun: 'Firearm: lethal vs mortals, bashing vs Kindred unless head', blunt: 'Blunt: bashing unless head targeted', fire: 'Fire: automatic aggravated, ignores armor, Fortitude soak only' };

/* ============================================================
 * Combatants
 * ============================================================ */
const ATTR_KEYS = ATTRS.map(a => a[0]);
function attrsFrom(a) {
  const out = {};
  if (Array.isArray(a)) ATTR_KEYS.forEach((k, i) => (out[k] = num(a[i], 1)));
  else ATTR_KEYS.forEach(k => (out[k] = num(a?.[k], 1)));
  return out;
}

/* Build a full combatant from a template (preset, PC, custom or link payload). */
function makeCombatant(t, side) {
  const weapons = (t.weapons || []).map(w => (typeof w === 'string' ? { wid: w } : { ...w }))
    .filter(w => getWeapon(w.wid));
  weapons.forEach(w => { const def = getWeapon(w.wid); if (def.clip && w.ammo == null) w.ammo = def.clip; });
  const extra = Array.isArray(t.extra) ? { label: t.extra[0], max: num(t.extra[1]), cur: num(t.extra[1]) }
    : t.extra ? { label: t.extra.label, max: num(t.extra.max), cur: num(t.extra.cur ?? t.extra.max) } : null;
  const wpMax = num(typeof t.wp === 'object' ? t.wp?.max : t.wp, 0);
  const bpMax = num(typeof t.bp === 'object' ? t.bp?.max : t.bp, 0);
  return {
    id: uid(),
    name: t.name || 'Unnamed',
    side: t.side || side || 'npc',
    kind: KINDS[t.kind] ? t.kind : 'mortal',
    presetId: t.presetId || null,
    pcId: t.pcId || null,
    attrs: attrsFrom(t.attrs || t.a),
    abil: parseTraits(t.abil),
    disc: parseTraits(t.disc),
    wp: { max: wpMax, cur: num(typeof t.wp === 'object' ? t.wp?.cur : null, wpMax) },
    bp: { max: bpMax, cur: num(typeof t.bp === 'object' ? t.bp?.cur : null, bpMax) },
    gen: t.gen || null,
    extra,
    armor: num(t.armor, 0),
    health: t.health || 'standard',
    dmg: { a: num(t.dmg?.a), l: num(t.dmg?.l), b: num(t.dmg?.b) },
    state: t.state || 'active',
    init: null,
    st: {},
    boost: { str: 0, dex: 0, sta: 0 },
    weapons,
    regen: !!t.regen,
    humanity: t.humanity ?? '',
    notes: t.notes || '',
    acted: false,
    extraActions: 0,
    celerityNext: 0,
    expanded: false,
  };
}
const presetTemplate = p => ({ ...p, attrs: p.a || p.attrs, side: 'npc', presetId: p.id });
let customPresets = load(STORE.presets, []);
const allPresets = () => [...customPresets.map(p => ({ ...p, cat: 'My Antagonists', custom: true })), ...PRESETS];
const getPreset = id => allPresets().find(p => p.id === id);

/* Serialize a combatant back to a compact template. */
function toTemplate(c, withState = false) {
  const t = {
    name: c.name, side: c.side, kind: c.kind,
    attrs: ATTR_KEYS.map(k => c.attrs[k]),
    abil: traitsToString(c.abil), disc: traitsToString(c.disc),
    wp: c.wp.max, bp: c.bp.max,
    weapons: c.weapons.map(w => w.wid),
  };
  if (c.gen) t.gen = c.gen;
  if (c.extra) t.extra = [c.extra.label, c.extra.max];
  if (c.armor) t.armor = c.armor;
  if (c.health !== 'standard') t.health = c.health;
  if (c.regen) t.regen = true;
  if (c.humanity) t.humanity = c.humanity;
  if (c.notes) t.notes = c.notes;
  if (withState) addState(t, c);
  return t;
}
function addState(t, c) {
  if (c.dmg.a || c.dmg.l || c.dmg.b) t.dmg = { ...c.dmg };
  if (c.wp.cur !== c.wp.max) t.wp = { max: c.wp.max, cur: c.wp.cur };
  if (c.bp.cur !== c.bp.max) t.bp = { max: c.bp.max, cur: c.bp.cur };
  if (c.state !== 'active') t.state = c.state;
}

/* Effective attribute: blood boosts and werewolf battle form (Physical doubled). */
function eff(c, k) {
  let v = num(c.attrs[k]) + (c.boost?.[k] || 0);
  if (c.st.battleForm && ['str', 'dex', 'sta'].includes(k)) v *= 2;
  return v;
}
const ab = (c, k) => trait(c.abil, k);
const disc = (c, k) => trait(c.disc, k);
const armorOf = c => ARMOR[clamp(c.armor, 0, 5)] || ARMOR[0];
const isOut = c => c.state !== 'active';
const canAct = c => !isOut(c) && !woundInfo(c).incap && !c.st.staked;

function initRating(c) {
  return eff(c, 'dex') + eff(c, 'wit') - woundInfo(c).pen - (c.st.knockdown ? 2 : 0);
}

/* Soak pool for a given (already converted) damage type. */
function soakFor(target, effType, src = {}) {
  const kind = KINDS[target.kind] || {};
  const sta = eff(target, 'sta');
  const fort = disc(target, 'fortitude');
  const isFire = src.fire;
  const armor = isFire ? 0 : armorOf(target).r;
  const parts = [];
  const add = (label, v) => { if (v) parts.push(`${label} ${v}`); return v; };
  let pool = 0;
  if (src.silver && target.kind === 'werewolf') return { pool: 0, parts: ['silver: unsoakable'], diff: 6 };
  if (effType === 'B') {
    pool = add('Sta', sta) + add('Fort', fort) + add('Armor', armor);
  } else if (effType === 'L') {
    const staOk = kind.soakAll || kind.soakLethal === true || (kind.soakLethal === 'vitae' && target.bp.cur > 0);
    if (!staOk) parts.push(kind.soakLethal === 'vitae' ? 'no vitae: no Sta' : 'mortal: no Sta');
    pool = (staOk && !isFire ? add('Sta', sta) : 0) + add('Fort', fort) + add('Armor', armor);
    if (staOk && isFire) parts.push('fire: no Sta');
  } else {
    // Aggravated: Fortitude only (werewolves soak with Stamina). Armor only vs teeth & claws.
    if (kind.soakAll) pool += add('Sta', sta);
    pool += add('Fort', fort);
    if (src.natural) pool += add('Armor', armor);
  }
  const diff = isFire ? (src.heat || 6) : 6;
  return { pool, parts, diff };
}

/* Convert a weapon damage type into B/L/A for this target. */
function effectiveType(raw, target, targeting, opts = {}) {
  const kind = KINDS[target.kind] || {};
  const head = !!TARGETING.find(t => t.id === targeting)?.head;
  let t = raw;
  if (raw === 'gun') t = target.kind === 'vampire' && !head ? 'B' : 'L';
  else if (raw === 'blunt') t = head ? 'L' : 'B';
  else if (raw === 'fire') t = 'A';
  if (t === 'A') {
    if (kind.aggAsLethal) t = 'L';
    else if (kind.aggOnlyFire && raw !== 'fire') t = 'L';
  }
  return t;
}

/* ============================================================
 * Dice
 * ============================================================ */
function roll(pool, diff, { canBotch = true } = {}) {
  pool = Math.max(0, pool | 0);
  const dice = Array.from({ length: pool }, d10);
  return evalDice(dice, diff, canBotch);
}
function evalDice(dice, diff, canBotch = true) {
  const s = dice.filter(d => d >= diff).length;
  const ones = dice.filter(d => d === 1).length;
  const succ = Math.max(0, s - ones);
  return { dice, diff, succ, botch: canBotch && s === 0 && ones > 0 };
}
function diceHTML(r, autoSucc = 0) {
  if (!r) return '';
  const ds = r.dice.map(d => `<span class="die ${d === 1 ? 'one' : d >= r.diff ? 's' : ''}">${d}</span>`).join('');
  const autos = Array.from({ length: autoSucc }, () => '<span class="die auto" title="Automatic success">✓</span>').join('');
  return `<span class="dice">${ds}${autos}</span>`;
}
function resultHTML(r, autoSucc = 0) {
  const total = r.succ + autoSucc;
  if (r.botch && !autoSucc) return '<span class="result botch">Botch!</span>';
  return `<span class="result ${total > 0 ? 'good' : 'bad'}">${total} success${total === 1 ? '' : 'es'}</span>`;
}

/* ============================================================
 * State
 * ============================================================ */
const settings = Object.assign({ autoSoak: false, addQty: 1, keepInit: false, skipDeclare: false }, load(STORE.settings, {}));
let pcs = load(STORE.pcs, []);
let combat = load(STORE.combat, null) || newCombat();
let logEntries = combat.log || [];

function newCombat(name = '') {
  return { name, round: 1, phase: 'setup', cursor: 0, combatants: [], log: [] };
}
function persist() {
  combat.log = logEntries.slice(0, 200);
  save(STORE.combat, combat);
}
function commit() { persist(); render(); }
function log(html) {
  logEntries.unshift({ t: `T${combat.round}`, html });
  if (logEntries.length > 200) logEntries.length = 200;
  if (!$('#tab-log').classList.contains('hidden')) renderLog();
}
const byId = id => combat.combatants.find(c => c.id === id);

function uniqueName(base) {
  const names = new Set(combat.combatants.map(c => c.name));
  if (!names.has(base)) return base;
  let i = 2;
  while (names.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}
function addCombatant(c) {
  c.name = uniqueName(c.name);
  combat.combatants.push(c);
  // NPCs joining after NPC initiative was rolled get rolled right away; players enter their own.
  const npcRolled = combat.phase !== 'setup' || combat.combatants.some(x => x !== c && x.side === 'npc' && x.init);
  if (c.side === 'npc' && npcRolled && canAct(c)) rollInit(c);
  return c;
}

/* ============================================================
 * Initiative & turn flow
 * ============================================================ */
/* A player reports their total (d10 + Dex + Wits − wounds); keep the implied die so the score can follow wounds later. */
function setInitTotal(c, total) {
  const rating = initRating(c);
  c.init = { roll: total - rating, rating, total, manual: true };
  if (c.st.knockdown) c.st.knockdown = false;
}
function rollInit(c, dieValue) {
  if (!canAct(c)) { c.init = null; return; }
  const rating = initRating(c);
  const r = dieValue ?? d10();
  c.init = { roll: r, rating, total: r + rating };
  if (c.st.knockdown) c.st.knockdown = false;
}
/* NPCs roll digitally; players roll their own dice and enter the result on their card. */
function rollNpcInit() {
  const npcs = combat.combatants.filter(c => c.side === 'npc');
  npcs.forEach(c => rollInit(c));
  const rolled = npcs.filter(c => c.init);
  if (rolled.length) log(`<b>NPC initiative</b> turn ${combat.round}: ` + rolled.map(c => `${esc(c.name)} ${c.init.total}`).join(', '));
}
// Everyone able to act must have an initiative score before the turn can start.
const pendingInit = () => combat.combatants.filter(c => canAct(c) && !c.init);
function startTurn() {
  combat.phase = 'declare';
  combat.cursor = 0;
  combat.combatants.forEach(c => (c.acted = false));
  log(`<b>Initiative order</b> turn ${combat.round}: ` + actors().map(c => `${esc(c.name)} ${c.init.total}`).join(', '));
  if (!phaseList().length) advancePhase();
}

/* Initiative order: highest total first; ties broken by rating, then simultaneous. */
function ordered() {
  const withInit = combat.combatants.filter(c => c.init && canAct(c))
    .sort((a, b) => b.init.total - a.init.total || b.init.rating - a.init.rating);
  const rest = combat.combatants.filter(c => !withInit.includes(c));
  return [...withInit, ...rest];
}
const actors = () => ordered().filter(c => c.init && canAct(c));
function phaseList(phase = combat.phase) {
  // NPC declarations are hidden, so only players declare (slowest first).
  if (phase === 'declare') return settings.skipDeclare ? [] : actors().filter(c => c.side === 'pc').reverse();
  if (phase === 'act') return actors();
  if (phase === 'extra') return combat.combatants.filter(c => c.extraActions > 0 && canAct(c))
    .sort((a, b) => initRating(b) - initRating(a));
  return [];
}
const currentActor = () => phaseList()[combat.cursor] || null;

function next() {
  if (combat.phase === 'setup') {
    if (!combat.combatants.length) return toast('Add some combatants first.');
    const pending = pendingInit();
    if (pending.length) return toast(`Waiting for initiative: ${pending.map(c => c.name).join(', ')}`);
    startTurn();
    return commit();
  }
  if (combat.phase === 'end') { newTurn(); return commit(); }
  const list = phaseList();
  const cur = list[combat.cursor];
  if (combat.phase === 'act' && cur && !cur.st.delayed) cur.acted = true;
  combat.cursor++;
  if (combat.cursor >= list.length) advancePhase();
  commit();
}
function advancePhase() {
  combat.cursor = 0;
  if (combat.phase === 'declare') combat.phase = 'act';
  else if (combat.phase === 'act') combat.phase = phaseList('extra').length ? 'extra' : 'end';
  else combat.phase = 'end';
  if (!phaseList().length && combat.phase !== 'end') advancePhase();
}
function prev() {
  if (combat.phase === 'setup') return;
  if (combat.cursor > 0) {
    combat.cursor--;
    if (combat.phase === 'act') { const c = phaseList()[combat.cursor]; if (c) c.acted = false; }
  } else {
    const order = ['declare', 'act', 'extra', 'end'];
    let i = order.indexOf(combat.phase) - 1;
    while (i >= 0 && !phaseList(order[i]).length) i--;
    if (i < 0) return;
    combat.phase = order[i];
    combat.cursor = Math.max(0, phaseList().length - 1);
  }
  commit();
}
function newTurn() {
  combat.round++;
  combat.combatants.forEach(c => {
    c.acted = false;
    c.st.delayed = false;
    c.st.wpIgnore = false;
    c.st.defending = false;
    c.extraActions = c.celerityNext || 0;
    c.celerityNext = 0;
    if (c.regen && c.state === 'active') {
      if (c.dmg.b) { c.dmg.b--; log(`${esc(c.name)} regenerates a bashing level.`); }
      else if (c.dmg.l) { c.dmg.l--; log(`${esc(c.name)} regenerates a lethal level.`); }
    }
  });
  log(`<b>— Turn ${combat.round} —</b>`);
  combat.phase = 'setup';
  combat.cursor = 0;
  if (settings.keepInit) {
    // House rule: keep each character's die; the rating still follows wounds, knockdown etc.
    combat.combatants.forEach(c => {
      if (!c.init || !canAct(c)) { c.init = null; return; }
      const manual = c.init.manual;
      rollInit(c, c.init.roll);
      c.init.manual = manual;
    });
    combat.combatants.filter(c => c.side === 'npc' && !c.init && canAct(c)).forEach(c => rollInit(c));
    if (!pendingInit().length) startTurn();
  } else {
    combat.combatants.forEach(c => (c.init = null));
    rollNpcInit();
  }
}

function resetCombat() {
  combat.combatants.forEach(c => {
    c.dmg = { a: 0, l: 0, b: 0 };
    c.wp.cur = c.wp.max; c.bp.cur = c.bp.max;
    if (c.extra) c.extra.cur = c.extra.max;
    c.state = 'active'; c.init = null; c.st = {}; c.boost = { str: 0, dex: 0, sta: 0 };
    c.acted = false; c.extraActions = 0; c.celerityNext = 0; c._editInit = false;
    c.weapons.forEach(w => { const def = getWeapon(w.wid); if (def?.clip) w.ammo = def.clip; });
  });
  Object.assign(combat, { round: 1, phase: 'setup', cursor: 0 });
  logEntries = [];
  log('<b>Combat reset</b> — health, Willpower, blood, ammo and initiative restored.');
}

/* ============================================================
 * Rendering
 * ============================================================ */
function render() {
  $('#encounterName').value = combat.name || '';
  renderTurnInfo();
  renderList();
  renderSidebar();
}

function renderTurnInfo() {
  const labels = { setup: 'Initiative', declare: 'Declaration', act: 'Actions', extra: 'Extra actions', end: 'Turn over' };
  $('#turnInfo').innerHTML = `<span class="pill">Turn <b>${combat.round}</b></span><span class="pill">${labels[combat.phase]}</span>
    <label class="check small" title="House rule: roll initiative once per combat. Each character keeps their die roll; wound penalties still lower the score."><input type="checkbox" id="setKeepInit" ${settings.keepInit ? 'checked' : ''}> Keep initiative</label>
    <label class="check small" title="House rule: no declaration step. Everyone decides what to do on their own turn. Suggested: defending before your turn uses your action; split pools are decided at your first roll."><input type="checkbox" id="setSkipDeclare" ${settings.skipDeclare ? 'checked' : ''}> Skip declarations</label>`;
  const btnNext = $('#btnNext');
  btnNext.textContent = combat.phase === 'setup' ? 'Start ▶' : combat.phase === 'end' ? 'New turn ▶' : 'Next ▶';
  $('#btnPrev').disabled = combat.phase === 'setup';
  const pending = pendingInit();
  btnNext.disabled = combat.phase === 'setup' && (!combat.combatants.length || pending.length > 0);
  btnNext.title = btnNext.disabled && pending.length ? `Waiting for initiative: ${pending.map(c => c.name).join(', ')}` : '';
  const pendingNpc = pending.filter(c => c.side === 'npc').length;
  const pendingPcs = pending.filter(c => c.side === 'pc').map(c => `<b>${esc(c.name)}</b>`);

  const cur = currentActor();
  const banner = {
    setup: !combat.combatants.length ? '' : pending.length
      ? `<b>Initiative</b> (1d10 + Dexterity + Wits − wounds). ${pendingPcs.length ? `Type each player's total on their card — waiting for ${pendingPcs.join(', ')}. ` : ''}${pendingNpc ? `${pendingNpc} NPC${pendingNpc > 1 ? 's' : ''} not rolled — press <b>Roll NPC initiative</b>.` : ''}`
      : 'All initiative is in. Press <b>Start ▶</b>.',
    declare: cur ? `<b>Stage One — Declaration.</b> Players declare, slowest first (NPC actions stay hidden). <b>${esc(cur.name)}</b> declares (multiple actions, Disciplines, Willpower).` : '',
    act: cur ? `<b>Stage Two — Attack.</b> <b>${esc(cur.name)}</b> acts (initiative ${cur.init.total}). Defensive actions may interrupt; delayed characters may act at any time.` : '',
    extra: cur ? `<b>End of turn — multiple actions.</b> <b>${esc(cur.name)}</b> takes ${cur.extraActions} extra action${cur.extraActions > 1 ? 's' : ''} (Celerity), in order of initiative rating.` : '',
    end: settings.keepInit
      ? 'Turn complete. Press <b>New turn ▶</b>: initiative carries over, adjusted for new wounds (werewolves regenerate, Celerity from last turn kicks in).'
      : 'Turn complete. Press <b>New turn ▶</b>: NPCs re-roll initiative, players enter new totals (werewolves regenerate, Celerity from last turn kicks in).',
  }[combat.phase];
  $('#phaseBanner').innerHTML = banner || '';
}

function renderList() {
  const list = $('#combatList');
  if (!combat.combatants.length) {
    list.innerHTML = `<div class="empty">No combatants yet.<br>Add antagonists or players from the panel on the right, or open an encounter link.</div>`;
    return;
  }
  const cur = currentActor();
  const ord = ordered();
  list.innerHTML = ord.map((c, i) => {
    const prevC = ord[i - 1], nextC = ord[i + 1];
    const sim = c.init && [prevC, nextC].some(o => o?.init && o.init.total === c.init.total && o.init.rating === c.init.rating);
    return cardHTML(c, {
      current: cur === c && combat.phase !== 'declare',
      declaring: cur === c && combat.phase === 'declare',
      sim,
    });
  }).join('') + `<div class="small faint" style="text-align:center">Health: <span class="tag-b">╱ bashing</span> · <span class="tag-l">✕ lethal</span> · <span class="tag-a">✱ aggravated</span> · Keys: <code>N</code> next, <code>P</code> previous</div>`;
}

function dotsHTML(cur, max, cls, act, id) {
  let h = '';
  for (let i = 0; i < max; i++) h += `<span class="dot ${cls} ${i < cur ? 'f' : ''}" data-act="${act}" data-id="${id}" data-v="${i + 1}" title="${i + 1}"></span>`;
  return `<span class="dots">${h}</span>`;
}

function cardHTML(c, ctx) {
  const wi = woundInfo(c);
  const lv = healthOf(c);
  const kind = KINDS[c.kind];
  const classes = ['card', c.side, ctx.current && 'current', ctx.declaring && 'declaring', c.acted && 'acted', (isOut(c) || wi.incap) && 'out'].filter(Boolean).join(' ');

  // Health boxes: aggravated first, then lethal, then bashing.
  const marks = [...Array(c.dmg.a).fill('a'), ...Array(c.dmg.l).fill('l'), ...Array(c.dmg.b).fill('b')];
  const glyph = { a: '✱', l: '✕', b: '╱' };
  const boxes = lv.map((l, i) => {
    const m = marks[i];
    const lbl = SHORT_LEVEL[l.n] || (l.p === null ? 'Inc' : l.p === 0 ? 'OK' : l.p);
    return `<div class="hbox ${m || ''}" title="${esc(l.n)}${l.p ? ' (' + l.p + ')' : ''}"><div class="mark">${m ? glyph[m] : ''}</div><div class="lbl">${esc(lbl)}</div></div>`;
  }).join('');

  let stateTxt;
  if (c.state === 'dead') stateTxt = `<b>${kind.torpor ? 'Final Death' : 'Dead'}</b>`;
  else if (c.state === 'torpor') stateTxt = '<b>Torpor</b>';
  else if (wi.incap) stateTxt = `<b title="${esc(HEALTH_MOVEMENT.Incapacitated)}">Incapacitated</b>`;
  else if (!wi.total) stateTxt = '<b>Healthy</b>';
  else stateTxt = `<span title="${esc(wi.label)}${wi.rawPen ? `: −${wi.rawPen} dice${wi.ignoring ? ' (ignored this turn)' : ''}` : ''}. ${esc(HEALTH_MOVEMENT[wi.label] || '')}"><b>${esc(wi.label)}</b> ${wi.rawPen ? `<span class="${wi.ignoring ? 'faint' : ''}">−${wi.rawPen}</span>` : ''}</span>`;

  const soakB = soakFor(c, 'B').pool, soakL = soakFor(c, 'L').pool, soakA = soakFor(c, 'A').pool;
  const ar = armorOf(c);
  const canBloodHeal = c.bp.max > 0 && ['vampire', 'ghoul'].includes(c.kind);

  const editing = c._editInit || (!c.init && c.side === 'pc' && canAct(c));
  const initBox = editing
    ? `<label class="init entry" title="Type the initiative total and press Enter (rating ${initRating(c)})${c.side === 'npc' ? '. Leave empty and press Enter to re-roll.' : ''}"><input class="init-input mono" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" placeholder="total" value="${c._editInit && c.init ? c.init.total : ''}" data-field="inittotal" data-id="${c.id}"><span class="r">rtg ${initRating(c)}</span></label>`
    : c.init
    ? `<div class="init" data-act="init" data-id="${c.id}" title="${c.init.manual ? 'Entered total' : `Roll ${c.init.roll} + rating ${c.init.rating}`}. Click to change."><span class="v mono">${c.init.total}</span><span class="r">${c.init.manual ? `rtg ${c.init.rating}` : `${c.init.roll}+${c.init.rating}`}${ctx.sim ? ' =' : ''}</span></div>`
    : `<div class="init none" data-act="init" data-id="${c.id}" title="Click to roll or enter initiative"><span class="v">—</span><span class="r">rtg ${initRating(c)}</span></div>`;

  const chips = STATUSES.filter(s => !s.kinds || s.kinds.includes(c.kind))
    .filter(s => c.expanded || c.st[s.id])
    .map(s => `<span class="badge chip ${c.st[s.id] ? 'on' : ''}" data-act="status" data-id="${c.id}" data-s="${s.id}" title="${esc(s.tip)}">${s.label}</span>`).join(' ');

  // Weapon columns: unarmed (fixed) | melee | ranged. Each carried weapon has a swap dropdown.
  const chip = (def, idx, inst) => {
    const ammo = def.clip ? ` · <span class="ammo mono">${inst.ammo}/${def.clip}</span><button class="reload" data-act="reload" data-id="${c.id}" data-w="${idx}" title="Reload (one full turn${def.reload ? `; crossbow ${def.reload} turns` : ''})">↻</button>` : '';
    const swap = idx >= 0 ? `<select class="wsel" data-field="wswap" data-id="${c.id}" data-w="${idx}" title="Swap weapon">${weaponOptionsFor(c, slotOf(def), def.id, { remove: true })}</select>` : '';
    return `<div class="wchip2" data-act="attack" data-id="${c.id}" data-w="${idx}" title="Attack with ${esc(def.name)}. ${esc(def.notes || TYPE_HELP[def.type] || '')}">
      <span class="wn">${esc(shortName(def))}</span><span class="wd"><span class="wdmg">${weaponDamageText(def)} ${typeTag(def.type)}${ammo}</span>${def.quirk ? `<span class="wq">${esc(def.quirk)}</span>` : ''}</span>${swap}</div>`;
  };
  const slotCol = slot => {
    const held = c.weapons.map((w, i) => ({ w, i, def: getWeapon(w.wid) })).filter(x => x.def && slotOf(x.def) === slot);
    const add = `<select class="wsel add ${held.length ? 'more' : ''}" data-field="wadd" data-id="${c.id}" data-slot="${slot}" title="${held.length ? `Carry another ${slot} weapon` : `Add a ${slot} weapon`}">
      <option value="" selected disabled>${held.length ? '+' : `+ ${slot === 'melee' ? 'Melee' : 'Ranged'}`}</option>${weaponOptionsFor(c, slot, null)}</select>`;
    return `<div class="wcol ${slot}">${held.map(x => chip(x.def, x.i, x.w)).join('')}${add}</div>`;
  };
  // Armor column: worn armor (if any) with a dropdown to change it. It isn't an attack, so clicking does nothing.
  const armorOpts = ARMOR.map(x => `<option value="${x.r}" ${x.r === ar.r ? 'selected' : ''}>${x.r ? `${x.s} — armor ${x.r}${x.pen ? `, −${x.pen} Dex` : ''}` : '✕ No armor'}</option>`).join('');
  const armorCol = ar.r
    ? `<div class="wcol armor"><div class="wchip2 armor" title="${esc(ar.n)}: adds ${ar.r} to soak vs bashing, lethal and fangs/claws (not fire or sunlight)${ar.pen ? `; −${ar.pen} dice to Dexterity pools` : ''}. Destroyed if one attack's damage roll is at least ${ar.r * 2}.">
        <span class="wn">${esc(ar.s)}</span><span class="wd"><span class="wdmg">Soak +${ar.r}</span>${ar.pen ? `<span class="wq">−${ar.pen} Dex</span>` : ''}</span>
        <select class="wsel" data-field="armor" data-id="${c.id}" title="Change armor">${armorOpts}</select></div></div>`
    : `<div class="wcol armor"><select class="wsel add" data-field="armor" data-id="${c.id}" title="Put on armor"><option value="0" selected disabled>+ Armor</option>${ARMOR.slice(1).map(x => `<option value="${x.r}">${x.s} — armor ${x.r}${x.pen ? `, −${x.pen} Dex` : ''}</option>`).join('')}</select></div>`;
  const weaponsHTML = `<div class="wcol unarmed">${chip(getWeapon('unarmed'), -1, null)}</div>${slotCol('melee')}${slotCol('ranged')}${armorCol}`;

  const extraRes = c.extra ? `<div class="res"><span class="rl">${esc(c.extra.label)}</span>
      <button class="btn xs" data-act="res" data-r="extra" data-d="-1" data-id="${c.id}">−</button>
      ${dotsHTML(c.extra.cur, c.extra.max, 'extra sq', 'res-set-extra', c.id)}
      <button class="btn xs" data-act="res" data-r="extra" data-d="1" data-id="${c.id}">+</button>
      <span class="small mono">${c.extra.cur}/${c.extra.max}</span></div>` : '';

  const cel = disc(c, 'celerity');
  let celHTML = '';
  if (cel && !isOut(c)) {
    if (c.kind === 'werewolf' || c.bp.max === 0) celHTML = `<button class="btn xs" data-act="multi" data-id="${c.id}" title="Extra actions this turn without blood (as Celerity). Click to cycle.">⚡ +${c.extraActions} actions</button>`;
    else celHTML = `<button class="btn xs" data-act="celerity" data-id="${c.id}" title="Celerity ${cel}: spend 1 blood for +${cel} physical actions next turn, at full dice pools">⚡ Celerity</button>`;
  }
  const celBadge = c.celerityNext ? `<span class="badge chip on" title="Celerity active next turn">+${c.celerityNext} next turn</span>` : '';
  const extraBadge = c.extraActions ? `<span class="badge chip on" title="Extra actions at end of this turn">+${c.extraActions} actions</span>` : '';

  const stateBadge = c.state === 'dead' ? `<span class="badge dead">${kind.torpor ? 'Final Death' : 'Dead'}</span>`
    : c.state === 'torpor' ? '<span class="badge state">Torpor</span>'
    : wi.incap ? '<span class="badge state">Incapacitated</span>' : '';
  const delayBtn = combat.phase === 'act' && !isOut(c) && !c.acted
    ? (c.st.delayed ? `<button class="btn sm on" data-act="actnow" data-id="${c.id}" title="Delayed character acts now (may interrupt)">Act now</button>`
      : `<button class="btn sm" data-act="status" data-s="delayed" data-id="${c.id}" title="Delay action">Delay</button>`) : '';

  const details = c.expanded ? `<div class="details">
      <div><b>Attributes:</b> ${ATTRS.map(([k, n]) => `${n} ${c.attrs[k]}${eff(c, k) !== c.attrs[k] ? ` (<b>${eff(c, k)}</b>)` : ''}`).join(', ')}</div>
      <div><b>Abilities:</b> ${esc(traitsToString(c.abil)) || '—'}</div>
      <div><b>Disciplines:</b> ${esc(traitsToString(c.disc)) || '—'}</div>
      ${c.humanity !== '' ? `<div><b>Humanity:</b> ${esc(c.humanity)}${c.gen ? ` · <b>Generation:</b> ${esc(c.gen)}` : ''}</div>` : ''}
      ${c.notes ? `<div><b>Notes:</b> ${esc(c.notes)}</div>` : ''}
      ${c.bp.max ? `<div class="row" style="margin-top:6px"><span>Spend blood (scene):</span>
        <button class="btn xs" data-act="boost" data-k="str" data-id="${c.id}">+1 Str</button>
        <button class="btn xs" data-act="boost" data-k="dex" data-id="${c.id}">+1 Dex</button>
        <button class="btn xs" data-act="boost" data-k="sta" data-id="${c.id}">+1 Sta</button>
        ${(c.boost.str || c.boost.dex || c.boost.sta) ? `<button class="btn xs" data-act="unboost" data-id="${c.id}">Clear boosts</button>` : ''}</div>` : ''}
      ${isOut(c) ? `<div class="row" style="margin-top:6px"><button class="btn xs" data-act="revive" data-id="${c.id}">Set state: active</button></div>` : `<div class="row" style="margin-top:6px"><button class="btn xs" data-act="setstate" data-v="torpor" data-id="${c.id}">Send to torpor</button><button class="btn xs" data-act="setstate" data-v="dead" data-id="${c.id}">Mark dead</button></div>`}
    </div>` : '';

  const resRow = (label, r, key, cls, title = '', extra = '') => `<div class="res" title="${esc(title)}"><span class="rl">${esc(label)}</span>
      <button class="btn xs" data-act="res" data-r="${key}" data-d="-1" data-id="${c.id}" title="Spend 1">−</button>
      ${dotsHTML(r.cur, r.max, cls, 'res-set-' + key, c.id)}
      <button class="btn xs" data-act="res" data-r="${key}" data-d="1" data-id="${c.id}" title="Regain 1">+</button>
      <span class="small mono">${r.cur}/${r.max}</span>${extra}</div>`;
  const wpIgnoreBtn = c.wp.cur > 0 && !c.st.wpIgnore && wi.rawPen && !wi.incap
    ? `<button class="btn xs" data-act="wpignore" data-id="${c.id}" title="Spend 1 Willpower: ignore wound penalties for one turn">Ignore wounds</button>` : '';

  return `<article class="${classes}" data-id="${c.id}">
    <div class="c-init">${initBox}</div>

    <div class="c-left">
      <div class="c-name"><span class="cname">${esc(c.name)}</span>
        <span class="badge ${c.side === 'pc' ? 'pc' : ''}">${c.side === 'pc' ? 'PC' : 'NPC'} · ${kind.label}</span>
        ${stateBadge}${extraBadge}${celBadge}${c.acted ? '<span class="badge">acted</span>' : ''}${chips}
      </div>
      <div class="c-healthrow">
        <div class="health">${boxes}</div>
        <div class="hstate">${stateTxt}</div>
      </div>
      <div class="dmg-ctrl">
        <span class="grp" title="Apply one level of damage">
          <button class="btn xs b" data-act="dmg" data-t="B" data-id="${c.id}" title="+1 bashing">+B</button><button class="btn xs l" data-act="dmg" data-t="L" data-id="${c.id}" title="+1 lethal">+L</button><button class="btn xs a" data-act="dmg" data-t="A" data-id="${c.id}" title="+1 aggravated">+A</button>
        </span>
        <span class="grp" title="Heal one level">
          <button class="btn xs b" data-act="heal" data-t="B" data-id="${c.id}" title="Heal 1 bashing">−B</button><button class="btn xs l" data-act="heal" data-t="L" data-id="${c.id}" title="Heal 1 lethal">−L</button><button class="btn xs a" data-act="heal" data-t="A" data-id="${c.id}" title="Heal 1 aggravated">−A</button>
        </span>
        ${canBloodHeal ? `<button class="btn xs" data-act="mend" data-id="${c.id}" title="Mend: spend 1 blood to heal 1 normal (bashing/lethal) level">Mend</button>` : ''}
        ${c.kind === 'vampire' ? `<button class="btn xs" data-act="mendagg" data-id="${c.id}" title="Mend aggravated: 5 blood (+1 WP if not the first this day) heals 1 aggravated level after a full day's rest">Mend A</button>` : ''}
      </div>
    </div>

    <div class="c-mid">
      <div class="c-res">
        ${resRow('WP', c.wp, 'wp', 'sq', 'Willpower', wpIgnoreBtn)}
        ${c.bp.max ? resRow('Blood', c.bp, 'bp', 'blood', 'Blood pool', celHTML) : ''}
        ${c.extra ? resRow(c.extra.label, c.extra, 'extra', 'extra sq', '', c.bp.max ? '' : celHTML) : ''}
        ${!c.bp.max && !c.extra ? `<div class="res">${celHTML || ''}</div>` : ''}
      </div>
      <div class="wcols">${weaponsHTML}</div>
    </div>

    <div class="c-right">
      <div class="c-actions">
        ${delayBtn}
        <button class="btn sm" data-act="edit" data-id="${c.id}" title="Edit stats & weapon loadout">✎</button>
        <button class="btn sm" data-act="dup" data-id="${c.id}" title="Duplicate">⧉</button>
        <button class="btn sm" data-act="expand" data-id="${c.id}" title="Details, statuses, blood boosts">${c.expanded ? '▴' : '▾'}</button>
        <button class="btn sm danger" data-act="remove" data-id="${c.id}" title="Remove from combat">✕</button>
      </div>
      <div class="statblock">
        <div>Str <b>${eff(c, 'str')}</b> Dex <b>${eff(c, 'dex')}</b> Sta <b>${eff(c, 'sta')}</b> Wits <b>${eff(c, 'wit')}</b> Per <b>${eff(c, 'per')}</b></div>
        <div>Brawl <b>${ab(c, 'brawl')}</b> Melee <b>${ab(c, 'melee')}</b> Firearms <b>${ab(c, 'firearms')}</b> Dodge <b>${ab(c, 'dodge')}</b></div>
        <div>Soak <span class="tag-b">B</span><b>${soakB}</b> <span class="tag-l">L</span><b>${soakL}</b> <span class="tag-a">A</span><b>${soakA}</b>${kind.halveBashing ? ' <span class="faint" title="Undead halve bashing damage after soak">½B</span>' : ''}${ar.r ? ` <span class="faint">(incl. armor ${ar.r})</span>` : ''}</div>
        <div>${[['potence', 'Potence'], ['fortitude', 'Fortitude'], ['celerity', 'Celerity']].filter(([k]) => disc(c, k)).map(([k, n]) => `${n} <b>${disc(c, k)}</b>`).join(' · ') || '<span class="faint">No combat Disciplines</span>'}</div>
      </div>
    </div>
    ${details}
  </article>`;
}

/* ---------- Sidebar ---------- */
let presetFilter = '';
function renderSidebar() {
  renderAntagonists();
  renderPlayersTab();
  renderCustomTab();
  renderDiceTab();
  renderLog();
}
function renderAntagonists() {
  const el = $('#tab-antagonists');
  const focused = document.activeElement?.id === 'presetSearch';
  const f = presetFilter.toLowerCase();
  const presets = allPresets().filter(p => !f || (p.name + ' ' + p.cat + ' ' + p.kind).toLowerCase().includes(f));
  const cats = [...new Set(presets.map(p => p.cat))];
  el.innerHTML = `
    <div class="row" style="margin-bottom:8px">
      <input id="presetSearch" class="grow" placeholder="Search antagonists…" value="${esc(presetFilter)}">
      <label class="row" title="How many to add per click">×<input id="addQty" type="number" min="1" max="20" value="${settings.addQty}" class="num-sm"></label>
    </div>
    ${cats.map(cat => `<div class="cat-title">${esc(cat)}</div>` + presets.filter(p => p.cat === cat).map(p => {
      const ws = (p.weapons || []).map(id => getWeapon(id)?.name).filter(Boolean).join(', ') || 'unarmed';
      const a = p.a || (Array.isArray(p.attrs) ? p.attrs : ATTR_KEYS.map(k => p.attrs?.[k]));
      return `<div class="preset">
        <div class="name">${esc(p.name)} <span class="faint small">${KINDS[p.kind]?.label || ''}</span>
          <small>Dex ${a[1]} Wits ${a[8]} Sta ${a[2]} · WP ${typeof p.wp === 'object' ? p.wp.max : p.wp} · ${esc(ws)}${p.armor ? ` · armor ${p.armor}` : ''}</small></div>
        ${p.custom ? `<button class="btn xs danger" data-act="delpreset" data-p="${p.id}" title="Delete from My Antagonists">✕</button>` : ''}
        <button class="btn sm" data-act="addpreset" data-p="${p.id}" title="Add to combat">+ Add</button>
      </div>`;
    }).join('')).join('') || '<div class="empty">No matches.</div>'}
    <p class="small faint" style="margin-top:12px">Stats from Chapter Nine (Antagonists) and the Appendix Bestiary. "Generic Kindred" are simple templates built from character-creation baselines.</p>`;
  if (focused) { const s = $('#presetSearch'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
}
function renderPlayersTab() {
  const el = $('#tab-players');
  el.innerHTML = `
    <div class="row" style="margin-bottom:10px">
      <button class="btn primary" data-act="addallpcs" ${pcs.length ? '' : 'disabled'}>Add all players</button>
      <button class="btn right" data-act="players">Configure…</button>
    </div>
    ${pcs.length ? pcs.map(p => {
      const inCombat = combat.combatants.some(c => c.pcId === p.id);
      return `<div class="preset"><div class="name">${esc(p.name)} <span class="faint small">${KINDS[p.kind]?.label || ''}</span>
        <small>${p.player ? esc(p.player) + ' · ' : ''}Dex ${p.attrs[1]} Wits ${p.attrs[8]} · WP ${p.wp} ${p.bp ? '· BP ' + p.bp : ''}</small></div>
        <button class="btn sm" data-act="addpc" data-p="${p.id}" ${inCombat ? 'disabled title="Already in combat"' : ''}>+ Add</button></div>`;
    }).join('') : '<div class="empty">No player characters yet.<br><button class="btn" data-act="players" style="margin-top:8px">Add players</button></div>'}
    <p class="small faint" style="margin-top:12px">Players are saved in this browser's localStorage.</p>`;
}
function renderCustomTab() {
  $('#tab-custom').innerHTML = `
    <p class="small muted" style="margin-top:0">Create a one-off combatant with the full editor. Tick “Save to My Antagonists” in the editor to reuse it later.</p>
    <div class="row">
      <button class="btn primary" data-act="newcustom" data-side="npc">New antagonist</button>
      <button class="btn" data-act="newcustom" data-side="pc">New ally / PC (this fight only)</button>
    </div>
    <div class="fieldset" style="margin-top:14px"><div class="legend">Quick extra</div>
      <div class="row">
        <input id="qxName" placeholder="Name" class="grow" value="Thug">
        <label>Dex+Wits <input id="qxInit" type="number" class="num-sm" value="4"></label>
      </div>
      <div class="row" style="margin-top:6px">
        <label>Attack pool <input id="qxPool" type="number" class="num-sm" value="5"></label>
        <label>Soak <input id="qxSoak" type="number" class="num-sm" value="2"></label>
        <select id="qxWeapon">${allWeapons().filter(w => !w.beast).map(w => `<option value="${w.id}" ${w.id === 'knife' ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select>
      </div>
      <div class="row" style="margin-top:6px"><label class="check"><input type="checkbox" id="qxExtra" checked> Extras health (3 levels)</label>
      <button class="btn sm right" data-act="quickextra">+ Add</button></div>
    </div>`;
}
function renderDiceTab() {
  const el = $('#tab-dice');
  if (el.dataset.ready) { refreshDiceCombatants(); return; }
  el.dataset.ready = '1';
  el.innerHTML = `
    <div class="fieldset"><div class="legend">Roll dice pool</div>
      <div class="row"><label>Pool <input id="dPool" type="number" min="1" value="5"></label>
        <label>Difficulty <input id="dDiff" type="number" min="2" max="10" value="6"></label>
        <label class="check"><input type="checkbox" id="dWP"> +1 WP success</label></div>
      <div class="row" style="margin-top:8px"><button class="btn primary" data-act="rolldice">Roll</button>
        <button class="btn" data-act="rolld10">1d10</button></div>
      <div id="dOut" style="margin-top:8px"></div>
    </div>
    <div class="fieldset"><div class="legend">Roll for a combatant</div>
      <div class="row"><select id="dWho" class="grow"></select></div>
      <div class="row" style="margin-top:6px">
        <select id="dAttr">${ATTRS.map(([k, n]) => `<option value="${k}" ${k === 'dex' ? 'selected' : ''}>${n}</option>`).join('')}</select> +
        <select id="dAbil"><option value="">—</option>${['Alertness', 'Athletics', 'Brawl', 'Dodge', 'Firearms', 'Intimidation', 'Melee', 'Stealth', 'Empathy', 'Subterfuge', 'Occult', 'Survival', 'Investigation'].map(a => `<option ${a === 'Dodge' ? 'selected' : ''}>${a}</option>`).join('')}</select>
      </div>
      <div class="row" style="margin-top:6px"><label class="check"><input type="checkbox" id="dWound" checked> Apply wound penalty</label>
        <button class="btn primary right" data-act="rollwho">Roll</button></div>
      <div id="dOut2" style="margin-top:8px"></div>
    </div>
    <div class="fieldset"><div class="legend">Settings</div>
      <label class="check" title="Quick +B/+L/+A buttons roll a soak first (with undead bashing halving)"><input type="checkbox" id="setAutoSoak" ${settings.autoSoak ? 'checked' : ''}> Quick damage buttons roll soak</label>
    </div>`;
  refreshDiceCombatants();
}
function refreshDiceCombatants() {
  const sel = $('#dWho'); if (!sel) return;
  const v = sel.value;
  sel.innerHTML = combat.combatants.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('') || '<option value="">(no combatants)</option>';
  if (byId(v)) sel.value = v;
}
function renderLog() {
  $('#tab-log').innerHTML = `<div class="row" style="margin-bottom:6px"><span class="muted small">Newest first</span><button class="btn xs right" data-act="clearlog">Clear</button></div>` +
    (logEntries.map(e => `<div class="log-entry"><span class="t">${esc(e.t)}</span> ${e.html}</div>`).join('') || '<div class="empty">Nothing yet.</div>');
}

/* ============================================================
 * Modals
 * ============================================================ */
function openModal(html, { wide = false, onClose } = {}) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  root._onClose = onClose;
  const bd = $('.modal-backdrop', root);
  bd.addEventListener('mousedown', e => { if (e.target === bd) closeModal(); });
  return $('.modal', root);
}
/* In-app confirmation. Stacks above any open modal. Resolves true/false. */
function ask(message, { ok = 'OK', danger = false } = {}) {
  return new Promise(resolve => {
    const host = document.createElement('div');
    host.className = 'modal-backdrop';
    host.style.zIndex = 70;
    host.innerHTML = `<div class="modal" style="width:min(420px,100%)" role="alertdialog" aria-modal="true">
      <div class="modal-body">${esc(message)}</div>
      <div class="modal-foot"><button class="btn" data-no>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(ok)}</button></div></div>`;
    const done = v => { host.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = e => {
      e.stopPropagation(); // keep tracker shortcuts (N/P, Escape) from firing behind the dialog
      if (e.key === 'Escape') { e.stopPropagation(); done(false); }
      if (e.key === 'Enter') { e.preventDefault(); done(true); }
    };
    host.addEventListener('mousedown', e => { if (e.target === host) done(false); });
    host.querySelector('[data-no]').onclick = () => done(false);
    host.querySelector('[data-yes]').onclick = () => done(true);
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(host);
    host.querySelector('[data-yes]').focus();
  });
}
function closeModal() {
  const root = $('#modalRoot');
  const cb = root._onClose; root._onClose = null;
  root.innerHTML = '';
  if (cb) cb();
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#modalRoot').innerHTML) closeModal();
});

/* ---------- Combatant editor (used for combatants, PCs and custom presets) ---------- */
function openEditor({ combatant, template, mode, onSave, focus }) {
  // Work on a full combatant object so every field is present.
  const c = combatant ? clone(combatant) : makeCombatant(template || { name: 'New character', side: mode === 'pc' ? 'pc' : 'npc', kind: mode === 'pc' ? 'vampire' : 'mortal', wp: 5, bp: mode === 'pc' ? 10 : 0, attrs: [2, 2, 2, 2, 2, 2, 2, 2, 2] });
  if (template?.player) c.player = template.player;
  const combatAb = COMBAT_ABILITIES.map(a => a[0]);
  const combatDi = COMBAT_DISCIPLINES.map(a => a[0]);
  const healthOpts = [['standard', 'Standard (7 levels)'], ['extra', 'Extra (Hurt, Maimed, Incap)']];
  const isCustomHealth = !HEALTH_TEMPLATES[c.health];

  const m = openModal(`
    <div class="modal-head"><h2>${mode === 'pc' ? 'Player character' : 'Edit combatant'}</h2><button class="btn ghost right" data-x>✕</button></div>
    <div class="modal-body">
      <div class="fieldset"><div class="legend">Identity</div>
        <div class="form-grid">
          <div class="f" style="grid-column: span 2"><label>Name</label><input id="eName" value="${esc(c.name)}"></div>
          ${mode === 'pc' ? `<div class="f"><label>Player</label><input id="ePlayer" value="${esc(c.player || '')}"></div>` : ''}
          <div class="f"><label>Creature</label><select id="eKind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${c.kind === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
          ${mode !== 'pc' ? `<div class="f"><label>Side</label><select id="eSide"><option value="npc" ${c.side === 'npc' ? 'selected' : ''}>Antagonist (NPC)</option><option value="pc" ${c.side === 'pc' ? 'selected' : ''}>Player / ally</option></select></div>` : ''}
          <div class="f"><label>Humanity / Path</label><input id="eHum" value="${esc(c.humanity)}"></div>
          <div class="f"><label>Generation</label><input id="eGen" value="${esc(c.gen || '')}" placeholder="e.g. 12"></div>
        </div>
      </div>
      <div class="fieldset"><div class="legend">Attributes</div>
        <div class="form-grid">${ATTRS.map(([k, n]) => `<div class="f"><label>${n}</label><input type="number" min="0" max="10" data-attr="${k}" value="${c.attrs[k]}"></div>`).join('')}</div>
      </div>
      <div class="fieldset"><div class="legend">Abilities</div>
        <div class="form-grid">${COMBAT_ABILITIES.map(([k, n]) => `<div class="f"><label>${n}</label><input type="number" min="0" max="10" data-abil="${n}" value="${ab(c, k)}"></div>`).join('')}</div>
        <div class="f" style="margin-top:8px"><label>Other abilities (e.g. "Occult 3, Streetwise 2")</label><textarea id="eAbilOther" rows="2">${esc(traitsToString(c.abil, combatAb))}</textarea></div>
      </div>
      <div class="fieldset"><div class="legend">Disciplines & resources</div>
        <div class="form-grid">
          ${COMBAT_DISCIPLINES.map(([k, n]) => `<div class="f"><label>${n}</label><input type="number" min="0" max="10" data-disc="${n}" value="${disc(c, k)}"></div>`).join('')}
          <div class="f"><label>Willpower</label><input type="number" min="0" max="10" id="eWP" value="${c.wp.max}"></div>
          <div class="f"><label>Blood pool</label><input type="number" min="0" max="50" id="eBP" value="${c.bp.max}"></div>
          <div class="f"><label>Other pool name</label><input id="eExL" value="${esc(c.extra?.label || '')}" placeholder="Gnosis, Glamour…"></div>
          <div class="f"><label>Other pool size</label><input type="number" min="0" id="eExM" value="${c.extra?.max || 0}"></div>
        </div>
        <div class="f" style="margin-top:8px"><label>Other disciplines (e.g. "Dominate 2, Protean 4")</label><textarea id="eDiscOther" rows="2">${esc(traitsToString(c.disc, combatDi))}</textarea></div>
      </div>
      <div class="fieldset"><div class="legend">Protection & health</div>
        <div class="form-grid">
          <div class="f" style="grid-column: span 2"><label>Armor</label><select id="eArmor">${ARMOR.map(a => `<option value="${a.r}" ${c.armor === a.r ? 'selected' : ''}>${a.r} — ${a.n}${a.pen ? ` (−${a.pen})` : ''}</option>`).join('')}</select></div>
          <div class="f" style="grid-column: span 2"><label>Health levels</label><select id="eHealth">${healthOpts.map(([k, n]) => `<option value="${k}" ${c.health === k ? 'selected' : ''}>${n}</option>`).join('')}<option value="custom" ${isCustomHealth ? 'selected' : ''}>Custom…</option></select></div>
          <div class="f" style="grid-column: span 2"><label>Custom levels (e.g. OK,-1,-1,-2,-5,Inc)</label><input id="eHealthCustom" value="${isCustomHealth ? esc(c.health) : ''}"></div>
          <div class="f"><label>&nbsp;</label><label class="check"><input type="checkbox" id="eRegen" ${c.regen ? 'checked' : ''}> Regenerates 1/turn</label></div>
        </div>
      </div>
      <div class="fieldset" id="eWeaponsSet"><div class="legend">Weapon loadout</div>
        <div id="eWeapons"></div>
        <div class="row" style="margin-top:8px">
          <select id="eAddWeapon" class="grow">${weaponOptions()}</select>
          <button class="btn" id="eAddWeaponBtn">Add weapon</button>
          <button class="btn ghost" id="eNewWeaponBtn" title="Create a custom weapon">New weapon…</button>
        </div>
        <p class="small faint">Everyone also has Unarmed (strike, kick, clinch, hold, tackle, sweep${'; bite for vampires/werewolves'}).</p>
      </div>
      <div class="f"><label>Notes</label><textarea id="eNotes" rows="2">${esc(c.notes)}</textarea></div>
    </div>
    <div class="modal-foot">
      ${mode === 'combat' || mode === 'new' ? '<label class="check" style="margin-right:auto"><input type="checkbox" id="eSavePreset"> Save to My Antagonists</label>' : ''}
      <button class="btn" data-x>Cancel</button>
      <button class="btn primary" id="eSave">Save</button>
    </div>`, { wide: true });

  const renderWeapons = () => {
    $('#eWeapons', m).innerHTML = c.weapons.length ? c.weapons.map((w, i) => {
      const def = getWeapon(w.wid);
      return `<div class="list-row"><span class="grow">${esc(def?.name || w.wid)} <span class="muted small">${weaponDamageText(def)} ${typeTag(def?.type)}${def?.range ? ` · range ${def.range}` : ''}${def?.clip ? ` · clip ${def.clip}` : ''}</span></span>
        <button class="btn xs" data-up="${i}" ${i === 0 ? 'disabled' : ''} title="Move up (first weapon is the default attack)">▲</button>
        <button class="btn xs danger" data-rm="${i}">Remove</button></div>`;
    }).join('') : '<div class="muted small">No weapons — fights unarmed.</div>';
  };
  renderWeapons();
  m.addEventListener('click', e => {
    if (e.target.closest('[data-x]')) return closeModal();
    const rm = e.target.closest('[data-rm]'); if (rm) { c.weapons.splice(+rm.dataset.rm, 1); renderWeapons(); }
    const up = e.target.closest('[data-up]'); if (up) { const i = +up.dataset.up; [c.weapons[i - 1], c.weapons[i]] = [c.weapons[i], c.weapons[i - 1]]; renderWeapons(); }
  });
  $('#eAddWeaponBtn', m).onclick = () => {
    const id = $('#eAddWeapon', m).value; const def = getWeapon(id); if (!def) return;
    c.weapons.push({ wid: id, ammo: def.clip || undefined }); renderWeapons();
  };
  $('#eNewWeaponBtn', m).onclick = () => openWeaponForm(null, w => {
    $('#eAddWeapon', m).innerHTML = weaponOptions(); $('#eAddWeapon', m).value = w.id;
  }, true);
  if (focus === 'weapons') setTimeout(() => $('#eWeaponsSet', m).scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);

  $('#eSave', m).onclick = () => {
    c.name = $('#eName', m).value.trim() || 'Unnamed';
    c.kind = $('#eKind', m).value;
    if ($('#eSide', m)) c.side = $('#eSide', m).value;
    if ($('#ePlayer', m)) c.player = $('#ePlayer', m).value.trim();
    c.humanity = $('#eHum', m).value.trim();
    c.gen = $('#eGen', m).value.trim() || null;
    $$('[data-attr]', m).forEach(i => (c.attrs[i.dataset.attr] = num(i.value)));
    const abil = parseTraits($('#eAbilOther', m).value);
    $$('[data-abil]', m).forEach(i => { if (num(i.value)) abil[i.dataset.abil] = num(i.value); });
    c.abil = abil;
    const dsc = parseTraits($('#eDiscOther', m).value);
    $$('[data-disc]', m).forEach(i => { if (num(i.value)) dsc[i.dataset.disc] = num(i.value); });
    c.disc = dsc;
    const wpMax = num($('#eWP', m).value), bpMax = num($('#eBP', m).value);
    c.wp = { max: wpMax, cur: Math.min(c.wp.cur === c.wp.max ? wpMax : c.wp.cur, wpMax) };
    c.bp = { max: bpMax, cur: Math.min(c.bp.cur === c.bp.max ? bpMax : c.bp.cur, bpMax) };
    const exL = $('#eExL', m).value.trim(), exM = num($('#eExM', m).value);
    c.extra = exL && exM ? { label: exL, max: exM, cur: Math.min(c.extra?.cur ?? exM, exM) } : null;
    c.armor = num($('#eArmor', m).value);
    const hv = $('#eHealth', m).value;
    c.health = hv === 'custom' ? ($('#eHealthCustom', m).value.trim() || 'standard') : hv;
    const len = healthOf(c).length;
    while (c.dmg.a + c.dmg.l + c.dmg.b > len) { if (c.dmg.b) c.dmg.b--; else if (c.dmg.l) c.dmg.l--; else c.dmg.a--; }
    c.regen = $('#eRegen', m).checked;
    c.notes = $('#eNotes', m).value.trim();
    if ($('#eSavePreset', m)?.checked) {
      const t = toTemplate(c); t.id = 'my_' + uid(); t.side = 'npc';
      customPresets.push(t); save(STORE.presets, customPresets);
      toast(`Saved "${c.name}" to My Antagonists`);
    }
    closeModal();
    onSave(c);
  };
}
function weaponOptions() {
  const groups = [['Natural / Brawl', w => w.kind === 'brawl' && !w.beast], ['Melee', w => w.kind === 'melee'], ['Ranged', w => w.kind === 'ranged' || w.kind === 'thrown'], ['Animal attacks', w => w.beast]];
  return groups.map(([label, fn]) => {
    const list = allWeapons().filter(w => w.id !== 'unarmed' && fn(w));
    return list.length ? `<optgroup label="${label}">${list.map(w => `<option value="${w.id}">${esc(w.name)} (${weaponDamageText(w)} ${w.type})${w.builtin ? '' : ' ★'}</option>`).join('')}</optgroup>` : '';
  }).join('');
}

/* ---------- Players config ---------- */
function openPlayers() {
  const m = openModal(`
    <div class="modal-head"><h2>Player characters</h2><button class="btn ghost right" data-x>✕</button></div>
    <div class="modal-body">
      <div id="pcList"></div>
      <div class="row" style="margin-top:12px">
        <button class="btn primary" id="pcNew">New player character</button>
        <button class="btn right" id="pcExport">Export JSON</button>
        <button class="btn" id="pcImport">Import JSON</button>
      </div>
      <textarea id="pcJson" class="code hidden" style="margin-top:10px" placeholder="Paste exported players JSON here"></textarea>
      <div class="row hidden" id="pcJsonRow" style="margin-top:6px"><button class="btn primary" id="pcJsonApply">Import (merge)</button></div>
      <p class="small faint">Saved in this browser (localStorage key <code>${STORE.pcs}</code>). Players can be referenced by name in encounter links.</p>
    </div>
    <div class="modal-foot"><button class="btn" data-x>Close</button></div>`);
  const list = () => {
    $('#pcList', m).innerHTML = pcs.length ? pcs.map(p => `<div class="list-row">
      <span class="grow"><b>${esc(p.name)}</b> <span class="muted small">${p.player ? esc(p.player) + ' · ' : ''}${KINDS[p.kind]?.label || ''} · Dex ${p.attrs[1]} Wits ${p.attrs[8]} Sta ${p.attrs[2]}</span></span>
      <button class="btn sm" data-ed="${p.id}">Edit</button>
      <button class="btn sm danger" data-del="${p.id}">Delete</button></div>`).join('') : '<div class="empty">No players yet.</div>';
  };
  list();
  const editPC = p => openEditor({
    template: p ? { ...p, side: 'pc' } : null, mode: 'pc',
    onSave: c => {
      const t = toTemplate(c); t.side = 'pc'; t.player = c.player || '';
      t.id = p?.id || 'pc_' + uid();
      if (p) pcs[pcs.findIndex(x => x.id === p.id)] = t; else pcs.push(t);
      save(STORE.pcs, pcs); render(); openPlayers();
    },
  });
  m.addEventListener('click', e => {
    if (e.target.closest('[data-x]')) return closeModal();
    const ed = e.target.closest('[data-ed]'); if (ed) editPC(pcs.find(p => p.id === ed.dataset.ed));
    const del = e.target.closest('[data-del]');
    if (del) ask('Delete this player character?', { ok: 'Delete', danger: true }).then(yes => { if (yes) { pcs = pcs.filter(p => p.id !== del.dataset.del); save(STORE.pcs, pcs); list(); render(); } });
  });
  $('#pcNew', m).onclick = () => editPC(null);
  $('#pcExport', m).onclick = () => {
    const ta = $('#pcJson', m); ta.classList.remove('hidden'); $('#pcJsonRow', m).classList.add('hidden');
    ta.value = JSON.stringify(pcs, null, 2); ta.select();
  };
  $('#pcImport', m).onclick = () => { const ta = $('#pcJson', m); ta.classList.remove('hidden'); ta.value = ''; $('#pcJsonRow', m).classList.remove('hidden'); ta.focus(); };
  $('#pcJsonApply', m).onclick = () => {
    try {
      const arr = JSON.parse($('#pcJson', m).value);
      if (!Array.isArray(arr)) throw new Error('Expected an array');
      arr.forEach(p => {
        if (!p.name) return;
        const t = toTemplate(makeCombatant(p, 'pc')); t.side = 'pc'; t.player = p.player || ''; t.id = p.id || 'pc_' + uid();
        const i = pcs.findIndex(x => x.id === t.id || x.name.toLowerCase() === t.name.toLowerCase());
        if (i >= 0) pcs[i] = { ...t, id: pcs[i].id }; else pcs.push(t);
      });
      save(STORE.pcs, pcs); list(); render(); toast(`Imported ${arr.length} player(s)`);
    } catch (err) { toast('Invalid JSON: ' + err.message); }
  };
}
function pcToCombatant(p) {
  const c = makeCombatant({ ...p, side: 'pc' }, 'pc');
  c.pcId = p.id;
  return c;
}

/* ---------- Weapons catalog ---------- */
function openWeapons() {
  const m = openModal(`
    <div class="modal-head"><h2>Weapon catalog</h2><button class="btn ghost right" data-x>✕</button></div>
    <div class="modal-body">
      <p class="small muted" style="margin-top:0">Built-in weapons come from the Melee and Ranged Weapons Charts. ★ = your custom weapons (saved in localStorage). Add any weapon to any combatant via its <b>Edit → Weapon loadout</b>.</p>
      <div id="wList"></div>
    </div>
    <div class="modal-foot"><button class="btn primary" id="wNew" style="margin-right:auto">New weapon</button><button class="btn" data-x>Close</button></div>`, { wide: true });
  const list = () => {
    $('#wList', m).innerHTML = `<table class="rules" style="width:100%"><tbody>
      <tr><th>Weapon</th><th>Kind</th><th>Damage</th><th>Type</th><th>Range</th><th>Rate</th><th>Clip</th><th>Conceal</th><th></th></tr>
      ${allWeapons().filter(w => w.id !== 'unarmed').map(w => `<tr>
        <td>${esc(w.name)}${w.builtin ? '' : ' ★'}${w.quirk ? ` <span class="wq">${esc(w.quirk)}</span>` : ''}${w.notes ? `<div class="faint small">${esc(w.notes)}</div>` : ''}</td>
        <td>${w.kind}</td><td>${weaponDamageText(w)}</td><td title="${esc(TYPE_HELP[w.type] || '')}">${typeTag(w.type)}</td>
        <td>${w.range || '—'}</td><td>${w.rate || '—'}${w.burst ? ' (auto)' : ''}</td><td>${w.clip || '—'}</td><td>${w.conceal || '—'}</td>
        <td>${w.builtin ? '' : `<button class="btn xs" data-ed="${w.id}">Edit</button> <button class="btn xs danger" data-del="${w.id}">✕</button>`}</td></tr>`).join('')}
      </tbody></table>
      <p class="small faint">Type: B bashing · L lethal · A aggravated · L* firearm (lethal vs mortals, bashing vs Kindred unless the head is targeted) · B* blunt (lethal if aimed at the head).</p>`;
  };
  list();
  m.addEventListener('click', e => {
    if (e.target.closest('[data-x]')) return closeModal();
    const ed = e.target.closest('[data-ed]'); if (ed) openWeaponForm(customWeapons.find(w => w.id === ed.dataset.ed), () => openWeapons());
    const del = e.target.closest('[data-del]');
    if (del) ask('Delete this weapon? Combatants carrying it will lose it.', { ok: 'Delete', danger: true }).then(yes => {
      if (!yes) return;
      customWeapons = customWeapons.filter(w => w.id !== del.dataset.del); save(STORE.weapons, customWeapons);
      combat.combatants.forEach(c => (c.weapons = c.weapons.filter(w => w.wid !== del.dataset.del)));
      list(); commit();
    });
  });
  $('#wNew', m).onclick = () => openWeaponForm(null, () => openWeapons());
}
/* Weapon form; when `stacked`, it overlays the current modal instead of replacing it. */
function openWeaponForm(w, onDone, stacked = false) {
  const isNew = !w;
  w = w ? { ...w } : { id: 'w_' + uid(), name: '', kind: 'melee', base: 'str', mod: 1, type: 'L' };
  const html = `
    <div class="modal-head"><h2>${isNew ? 'New weapon' : 'Edit weapon'}</h2></div>
    <div class="modal-body"><div class="form-grid">
      <div class="f" style="grid-column: span 2"><label>Name</label><input id="wfName" value="${esc(w.name)}"></div>
      <div class="f"><label>Kind</label><select id="wfKind">${[['brawl', 'Brawl / natural'], ['melee', 'Melee'], ['ranged', 'Firearm / ranged'], ['thrown', 'Thrown']].map(([k, n]) => `<option value="${k}" ${w.kind === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="f"><label>Damage base</label><select id="wfBase"><option value="str" ${w.base === 'str' ? 'selected' : ''}>Strength +</option><option value="fixed" ${w.base === 'fixed' ? 'selected' : ''}>Fixed dice</option></select></div>
      <div class="f"><label>Damage bonus / dice</label><input type="number" id="wfMod" value="${w.mod}"></div>
      <div class="f"><label>Damage type</label><select id="wfType">${Object.entries(TYPE_HELP).map(([k, n]) => `<option value="${k}" ${w.type === k ? 'selected' : ''}>${k} — ${n.split(':')[0]}</option>`).join('')}</select></div>
      <div class="f"><label>Accuracy (dice)</label><input type="number" id="wfAcc" value="${w.acc || 0}"></div>
      <div class="f"><label>Difficulty mod</label><input type="number" id="wfDiff" value="${w.diffMod || 0}"></div>
      <div class="f"><label>Range (yards)</label><input type="number" id="wfRange" value="${w.range || 0}"></div>
      <div class="f"><label>Rate</label><input type="number" id="wfRate" value="${w.rate || 0}"></div>
      <div class="f"><label>Clip (incl. chamber)</label><input type="number" id="wfClip" value="${w.clip || 0}"></div>
      <div class="f"><label>Conceal</label><select id="wfConceal">${['', 'P', 'J', 'T', 'N'].map(x => `<option ${w.conceal === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="f"><label>Fire: levels / heat diff</label><div class="row"><input type="number" id="wfFire" class="num-sm" value="${w.fireLevels || 1}"><input type="number" id="wfHeat" class="num-sm" value="${w.heat || 5}"></div></div>
    </div>
    <div class="row" style="margin-top:10px">
      <label class="check"><input type="checkbox" id="wfBurst" ${w.burst ? 'checked' : ''}> Burst / full-auto capable</label>
      <label class="check"><input type="checkbox" id="wfNatural" ${w.natural ? 'checked' : ''}> Teeth/claws (armor applies vs agg)</label>
      <label class="check"><input type="checkbox" id="wfStake" ${w.stake ? 'checked' : ''}> Can stake</label>
      <label class="check"><input type="checkbox" id="wfSilver" ${w.silver ? 'checked' : ''}> Silver</label>
    </div>
    <div class="form-grid" style="margin-top:8px">
      <div class="f"><label>Quirk (shown on the card)</label><input id="wfQuirk" maxlength="24" placeholder="e.g. needs grapple" value="${esc(w.quirk || '')}"></div>
      <div class="f" style="grid-column: span 3"><label>Notes (tooltip & attack dialog)</label><input id="wfNotes" value="${esc(w.notes || '')}"></div>
    </div>
    </div>
    <div class="modal-foot"><button class="btn" id="wfCancel">Cancel</button><button class="btn primary" id="wfSave">Save weapon</button></div>`;

  let host, cleanup;
  if (stacked) {
    host = document.createElement('div');
    host.className = 'modal-backdrop';
    host.style.zIndex = 55;
    host.innerHTML = `<div class="modal">${html}</div>`;
    document.body.appendChild(host);
    cleanup = () => host.remove();
  } else {
    host = openModal(html);
    cleanup = closeModal;
  }
  $('#wfCancel', host).onclick = () => { cleanup(); if (!stacked) onDone && onDone(); };
  $('#wfSave', host).onclick = () => {
    const nw = {
      id: w.id, name: $('#wfName', host).value.trim() || 'Custom weapon', kind: $('#wfKind', host).value,
      base: $('#wfBase', host).value, mod: num($('#wfMod', host).value), type: $('#wfType', host).value,
      acc: num($('#wfAcc', host).value) || undefined, diffMod: num($('#wfDiff', host).value) || undefined,
      range: num($('#wfRange', host).value) || undefined, rate: num($('#wfRate', host).value) || undefined,
      clip: num($('#wfClip', host).value) || undefined, conceal: $('#wfConceal', host).value || undefined,
      burst: $('#wfBurst', host).checked || undefined, natural: $('#wfNatural', host).checked || undefined,
      stake: $('#wfStake', host).checked || undefined, silver: $('#wfSilver', host).checked || undefined,
      notes: $('#wfNotes', host).value.trim() || undefined,
      quirk: $('#wfQuirk', host).value.trim() || undefined,
    };
    if (nw.type === 'fire') { nw.fireLevels = num($('#wfFire', host).value, 1); nw.heat = num($('#wfHeat', host).value, 5); }
    const i = customWeapons.findIndex(x => x.id === nw.id);
    if (i >= 0) customWeapons[i] = nw; else customWeapons.push(nw);
    save(STORE.weapons, customWeapons);
    cleanup();
    onDone && onDone(nw);
    render();
  };
}

/* ---------- Attack dialog ---------- */
let atk = null;
function openAttack(attackerId, weaponIdx) {
  const a = byId(attackerId);
  if (!a) return;
  const targets = combat.combatants.filter(c => c.id !== a.id);
  const prevTarget = atk?.attackerId === a.id ? atk.targetId : null;
  const defaultTarget = (prevTarget && byId(prevTarget)) ? prevTarget
    : (targets.find(t => t.side !== a.side && !isOut(t)) || targets[0])?.id || null;
  atk = {
    attackerId: a.id, weaponIdx: weaponIdx ?? -1, maneuverId: null, targetId: defaultTarget,
    range: 'short', targeting: 'none', cover: 0, flank: 0, multiOpp: 0, actions: 1, actionNo: 1,
    aim: 0, scope: false, wp: false, immobilized: false, extraDice: 0, extraDiff: 0,
    atkRoll: null, atkSucc: null, defType: 'none', defRoll: null, defSucc: 0,
    dmgRoll: null, dmgSucc: null, soakRoll: null, soakSucc: null, applied: false, spent: false, showAll: false,
  };
  pickDefaultManeuver();
  openModal('<div id="atkBody"></div>', { wide: true, onClose: () => { atk = null; } });
  renderAttack();
}
function atkWeapon(a) {
  if (atk.weaponIdx < 0) return { def: getWeapon('unarmed'), inst: null };
  const inst = a.weapons[atk.weaponIdx];
  return { def: inst ? getWeapon(inst.wid) : getWeapon('unarmed'), inst };
}
function maneuversFor(a, def) {
  let list = MANEUVERS[def.kind] || MANEUVERS.melee;
  if (def.kind === 'brawl') {
    list = list.filter(m => (def.id === 'unarmed' ? true : !m.unarmedOnly));
    list = list.filter(m => !m.fangs || KINDS[a.kind]?.fangs);
  }
  if (def.kind === 'ranged') list = list.filter(m => !m.needs || def[m.needs]);
  return list;
}
function pickDefaultManeuver() {
  const a = byId(atk.attackerId);
  const { def } = atkWeapon(a);
  const list = maneuversFor(a, def);
  if (!list.find(m => m.id === atk.maneuverId)) atk.maneuverId = list[0]?.id;
}

function atkCalc() {
  const a = byId(atk.attackerId);
  const t = byId(atk.targetId);
  const { def: w, inst } = atkWeapon(a);
  const man = maneuversFor(a, w).find(m => m.id === atk.maneuverId) || maneuversFor(a, w)[0];
  const wi = woundInfo(a);
  const ar = armorOf(a);
  const [attrK, abilK] = man.trait;
  const attrV = eff(a, attrK), abilV = ab(a, abilK);
  const parts = [`${ATTRS.find(x => x[0] === attrK)[1]} ${attrV}`, `${titleCase(abilK)} ${abilV}`];
  let pool = attrV + abilV;
  const addP = (label, v) => { if (v) { pool += v; parts.push(`${label} ${v > 0 ? '+' : ''}${v}`); } };
  addP('Accuracy', (man.acc || 0) + (w.acc || 0));
  if (attrK === 'dex') addP('Armor penalty', -ar.pen);
  addP('Wounds', -wi.pen);
  addP(atk.flank === 2 ? 'Rear attack' : 'Flank', atk.flank);
  if (t && (t.st.immobilized || t.st.clinched)) addP('Target immobilized', 2);
  if (t?.st.blinded) addP('Target blinded', 2);
  if (w.kind === 'ranged' && atk.aim) addP('Aiming', Math.min(atk.aim, eff(a, 'per')) + (atk.scope ? 2 : 0));
  if (atk.actions > 1) addP(`Multiple actions (${atk.actionNo}/${atk.actions})`, -(atk.actions + atk.actionNo - 1));
  addP('Other', atk.extraDice);

  // Difficulty
  const dparts = [];
  let diff = 6;
  if (w.kind === 'ranged') { const r = RANGES.find(x => x.id === atk.range); diff = r.diff; dparts.push(`${r.name} ${r.diff}`); } else dparts.push('Base 6');
  const addD = (label, v) => { if (v) { diff += v; dparts.push(`${label} +${v}`.replace('+-', '−')); } };
  addD(man.name, man.diff);
  addD('Weapon', w.diffMod || 0);
  const tg = TARGETING.find(x => x.id === atk.targeting);
  if (!man.noTargeting) addD(`Target ${tg.name.toLowerCase()}`, tg.diff);
  if (w.kind === 'ranged') addD('Cover', COVER[atk.cover].diff);
  if (w.kind !== 'ranged' && atk.multiOpp) addD('Multiple opponents', Math.min(4, atk.multiOpp));
  if (a.st.blinded) addD('Blinded', 2);
  addD('Other', atk.extraDiff);
  diff = clamp(diff, 2, 10);

  // Damage
  const mdmg = man.dmg;
  let rawType = w.type, natural = !!w.natural, strBased = false, base = 0, dmgLabel = '';
  if (mdmg === 'none') { base = 0; dmgLabel = 'No damage'; }
  else if (mdmg === 'weapon' || mdmg === 'special') {
    if (w.type === 'fire') { base = w.fireLevels || 1; dmgLabel = `${base} automatic (fire)`; }
    else if (w.base === 'str') { strBased = true; base = eff(a, 'str') + w.mod; dmgLabel = `Str ${eff(a, 'str')}${w.mod ? ' + ' + w.mod : ''}`; }
    else { base = w.mod; dmgLabel = `${w.mod} (weapon)`; }
  } else {
    strBased = true; base = eff(a, 'str') + (mdmg.mod || 0); dmgLabel = `Str ${eff(a, 'str')}${mdmg.mod ? ' + ' + mdmg.mod : ''}`;
    if (mdmg.type) { rawType = mdmg.type; natural = !!mdmg.natural; }
    else if (w.id === 'unarmed') rawType = 'B';
  }
  const atkTotal = atk.atkSucc == null ? null : atk.atkSucc + (atk.wp ? 1 : 0);
  const net = atkTotal == null ? null : Math.max(0, atkTotal - (atk.defSucc || 0));
  const hit = net != null && net > 0;
  const autoFire = w.type === 'fire' && (mdmg === 'weapon');
  let dmgPool = base;
  const dparts2 = [dmgLabel];
  if (hit && !autoFire && mdmg !== 'none') {
    if (net > 1) { dmgPool += net - 1; dparts2.push(`extra successes +${net - 1}`); }
    if (!man.noTargeting && tg.dmg) { dmgPool += tg.dmg; dparts2.push(`targeting +${tg.dmg}`); }
    if (strBased && wi.pen) { dmgPool -= wi.pen; dparts2.push(`wounds −${wi.pen}`); }
    dmgPool = Math.max(1, dmgPool);
  }
  const potence = strBased && (w.kind === 'brawl' || w.kind === 'melee') ? disc(a, 'potence') : 0;
  const effType = t ? effectiveType(rawType, t, man.noTargeting ? 'none' : atk.targeting) : rawType;
  const soak = t ? soakFor(t, effType, { fire: rawType === 'fire', heat: w.heat, natural, silver: w.silver }) : { pool: 0, parts: [], diff: 6 };
  const dmgTotal = autoFire ? (hit ? base : null) : (atk.dmgSucc == null ? null : atk.dmgSucc + potence);
  let final = null, halved = false;
  if (dmgTotal != null && atk.soakSucc != null) {
    final = Math.max(0, dmgTotal - atk.soakSucc);
    if (t && KINDS[t.kind].halveBashing && effType === 'B') { final = Math.floor(final / 2); halved = true; }
  }
  // Defense pool for the target (dodge / block / parry)
  let def = { pool: 0, diff: 6, parts: [] };
  if (t && atk.defType !== 'none') {
    const [dAttr, dAbil] = { dodge: ['dex', 'dodge'], block: ['dex', 'brawl'], parry: ['dex', 'melee'] }[atk.defType];
    const tw = woundInfo(t), tar = armorOf(t);
    def.parts = [`Dexterity ${eff(t, dAttr)}`, `${titleCase(dAbil)} ${ab(t, dAbil)}`];
    def.pool = eff(t, dAttr) + ab(t, dAbil);
    if (tar.pen) { def.pool -= tar.pen; def.parts.push(`Armor −${tar.pen}`); }
    if (tw.pen) { def.pool -= tw.pen; def.parts.push(`Wounds −${tw.pen}`); }
    if (man.id === 'strafe' && atk.defType === 'dodge') { def.diff += 1; def.parts.push('vs strafing: diff +1'); }
    if (t.st.blinded) { def.diff += 2; def.parts.push('blinded: diff +2'); }
    def.diff = clamp(def.diff, 2, 10);
  }
  return { a, t, w, inst, man, def, pool, parts, diff, dparts, tg, dmgPool, dparts2, potence, rawType, effType, soak, net, hit, atkTotal, autoFire, dmgTotal, final, halved, natural, noDamage: mdmg === 'none' };
}

function renderAttack() {
  const body = $('#atkBody'); if (!body || !atk) return;
  const k = atkCalc();
  const { a, t, w, inst, man } = k;
  const isRanged = w.kind === 'ranged';
  const typeNames = { B: 'bashing', L: 'lethal', A: 'aggravated' };
  const dazedLimit = t ? eff(t, 'sta') + (KINDS[t.kind].supernatural ? 2 : 0) : 0;
  const ammoNeed = man.ammo === 'all' ? (inst?.ammo || 0) : (man.ammo || 0);
  const targetIsPlayer = t?.side === 'pc';

  // Small builders
  const seg = (key, options, cur, numeric = false) => `<span class="seg">${options.map(([v, label, title]) =>
    `<button class="${String(v) === String(cur) ? 'on' : ''}" data-set="${key}" data-v="${esc(v)}" ${numeric ? 'data-num' : ''} ${title ? `title="${esc(title)}"` : ''}>${label}</button>`).join('')}</span>`;
  const field = (label, inner) => `<div class="af"><label>${label}</label>${inner}</div>`;
  const numIn = (key, val, min = '', extra = '') => `<input type="number" class="num-sm" data-k="${key}" data-num value="${val ?? ''}" ${min !== '' ? `min="${min}"` : ''} ${extra}>`;
  // Digital roll button plus a box for typing in a physical roll's successes.
  const rollOrEnter = (act, key, pool, val, { digital = true, disabled = false } = {}) => `<div class="roll-row">
      ${digital ? `<button class="btn primary" data-a="${act}" ${disabled || pool < 1 ? 'disabled' : ''}>🎲 Roll${pool > 0 && !disabled ? ` ${pool} dice` : ''}</button><span class="muted small">or</span>` : '<span class="muted small">Player rolls —</span>'}
      <label class="succ">successes ${numIn(key, val, 0, `placeholder="–" ${disabled ? 'disabled' : ''}`)}</label>
    </div>`;

  // Targets: the other side first; "show all" adds same-side combatants.
  const others = combat.combatants.filter(c => c.id !== a.id);
  const opposing = others.filter(c => c.side !== a.side);
  const shown = atk.showAll || !opposing.length ? others : opposing;
  const targetChips = shown.map(x => {
    const xw = woundInfo(x);
    const st = x.state !== 'active' ? x.state : xw.incap ? 'incap.' : xw.total ? xw.label : '';
    return `<button class="tchip ${x.side} ${x.id === atk.targetId ? 'on' : ''} ${isOut(x) ? 'out' : ''}" data-set="targetId" data-v="${x.id}">
      <b>${esc(x.name)}</b><small>${KINDS[x.kind].label}${st ? ' · ' + esc(st) : ''}</small></button>`;
  }).join('');

  const weaponChips = [{ i: -1, def: getWeapon('unarmed'), inst: null }, ...a.weapons.map((x, i) => ({ i, def: getWeapon(x.wid), inst: x }))]
    .filter(x => x.def).map(x => `<button class="wchip ${x.i === atk.weaponIdx ? 'on' : ''}" data-set="weaponIdx" data-v="${x.i}" data-num>
      ${esc(x.def.name)} <span class="dmg">${weaponDamageText(x.def)} ${typeTag(x.def.type)}</span>${x.def.clip ? ` <span class="ammo mono">${x.inst.ammo}/${x.def.clip}</span>` : ''}</button>`).join('');

  const defLabels = { dodge: 'Dodge', block: 'Block', parry: 'Parry' };

  body.innerHTML = `
    <div class="modal-head"><h2>Attack — ${esc(a.name)}</h2><button class="btn ghost right" data-x>✕</button></div>
    <div class="modal-body atk">
      <div class="step"><h3><span class="n">1</span>Setup</h3>
        <div class="arow"><span class="al">Weapon</span><div class="chips">${weaponChips}</div></div>
        <div class="arow"><span class="al">Maneuver</span>${seg('maneuverId', maneuversFor(a, w).map(m => [m.id, m.name, m.note || '']), man.id)}</div>
        <div class="arow"><span class="al">Target</span><div class="chips">${targetChips || '<span class="muted">No one else in the fight.</span>'}
          ${opposing.length && opposing.length < others.length ? `<button class="btn xs ghost" data-set="showAll" data-v="${atk.showAll ? '' : '1'}">${atk.showAll ? 'Only opponents' : 'Show allies too'}</button>` : ''}</div></div>
        <div class="mods">
          ${isRanged ? field(`Range <span class="faint">(short ${w.range || '?'} yd)</span>`, seg('range', RANGES.map(r => [r.id, `${r.id === 'pb' ? 'Point blank' : r.id === 'short' ? 'Short' : 'Long'} <span class="faint">${r.diff}</span>`, r.name]), atk.range)) : ''}
          ${isRanged ? field('Target cover', seg('cover', [[0, 'None'], [1, 'Prone +1'], [2, 'Wall +2'], [3, 'Head only +3']], atk.cover, true)) : ''}
          ${man.noTargeting ? '' : field('Aim at', seg('targeting', [['none', 'Body'], ['medium', 'Limb +1', 'Medium target: +1 difficulty'], ['small', 'Head +2', 'Small target: +2 difficulty, +1 damage'], ['precise', 'Heart/eye +3', 'Precise target: +3 difficulty, +2 damage']], atk.targeting))}
          ${field('Position', seg('flank', [[0, 'Front'], [1, 'Flank +1'], [2, 'Rear +2']], atk.flank, true))}
          ${isRanged ? field(`Turns aiming <span class="faint">(max ${eff(a, 'per')})</span>`, `<span class="row">${numIn('aim', atk.aim, 0)}<label class="check small"><input type="checkbox" data-k="scope" ${atk.scope ? 'checked' : ''}> Scope +2</label></span>`)
            : field('Extra opponents', numIn('multiOpp', atk.multiOpp, 0, 'max="4"'))}
          ${field('Actions this turn', numIn('actions', atk.actions, 1))}
          ${field('This is action #', numIn('actionNo', atk.actionNo, 1, `max="${atk.actions}"`))}
          ${field('Extra dice', numIn('extraDice', atk.extraDice))}
          ${field('Extra difficulty', numIn('extraDiff', atk.extraDiff))}
          ${field('Willpower', `<label class="check"><input type="checkbox" data-k="wp" ${atk.wp ? 'checked' : ''} ${a.wp.cur < 1 && !atk.wp ? 'disabled' : ''}> +1 auto success</label>`)}
        </div>
        ${man.note ? `<div class="note">${esc(man.note)}</div>` : ''}
        ${w.notes ? `<div class="note">${esc(w.notes)}</div>` : ''}
      </div>

      <div class="atk-grid">
        <div class="step"><h3><span class="n">2</span>Attack roll</h3>
          <div class="bigline">Pool <b>${Math.max(0, k.pool)}</b> vs difficulty <b>${k.diff}</b>${inst && w.clip ? ` <span class="muted small">· ammo ${inst.ammo}/${w.clip}${ammoNeed ? `, uses ${ammoNeed}` : ''}</span>` : ''}</div>
          <div class="calc">${k.parts.map(esc).join(' · ')}</div>
          <div class="calc">Difficulty: ${k.dparts.map(esc).join(' · ')}</div>
          ${rollOrEnter('rollatk', 'atkSucc', k.pool, atk.atkSucc)}
          ${atk.atkRoll ? `<div class="dice-out">${diceHTML(atk.atkRoll, atk.wp ? 1 : 0)} ${resultHTML(atk.atkRoll, atk.wp ? 1 : 0)}</div>` : atk.atkSucc != null && atk.wp ? '<div class="calc">+1 Willpower success added.</div>' : ''}
          ${atk.atkRoll?.botch && !atk.wp ? '<div class="note">Botch: the weapon jams or explodes, the blade breaks, an ally is hit…</div>' : ''}
        </div>

        <div class="step"><h3><span class="n">3</span>Defense</h3>
          ${t ? `
            <div class="arow">${seg('defType', [['none', 'None'], ['dodge', 'Dodge'], ['block', 'Block'], ['parry', 'Parry']], atk.defType)}</div>
            ${atk.defType === 'none' ? `<div class="calc">${esc(t.name)} doesn't defend. Needs an action left (or abort with Willpower).</div>` : `
              <div class="bigline">${esc(t.name)}: pool <b>${Math.max(0, k.def.pool)}</b> vs difficulty <b>${k.def.diff}</b></div>
              <div class="calc">${k.def.parts.map(esc).join(' · ')}</div>
              ${rollOrEnter('rolldef', 'defSucc', k.def.pool, atk.defSucc, { digital: !targetIsPlayer })}
              ${atk.defRoll ? `<div class="dice-out">${diceHTML(atk.defRoll)} ${resultHTML(atk.defRoll)}</div>` : ''}
              <div class="calc">${defLabels[atk.defType]} is resisted: only attack successes above the defender's count hit.${atk.defType === 'block' && k.effType !== 'B' ? ' Block can\'t stop lethal/aggravated without Fortitude or armor.' : ''}</div>`}
          ` : '<div class="muted">Pick a target.</div>'}
          ${k.atkTotal != null ? `<div class="bigline">Net successes <b>${k.net}</b> — ${k.hit ? '<span class="result good">Hit!</span>' : '<span class="result bad">Miss</span>'}</div>` : ''}
        </div>

        <div class="step"><h3><span class="n">4</span>Damage</h3>
          ${k.noDamage ? '<div class="muted">This maneuver inflicts no damage.</div>' : `
            ${k.autoFire ? `<div class="bigline">Automatic damage <b>${k.hit ? k.dmgTotal : '—'}</b></div>` : `
              <div class="bigline">Pool <b>${k.hit ? k.dmgPool : '—'}</b> vs difficulty <b>6</b>${k.potence ? ` <span class="muted small">+ ${k.potence} Potence success${k.potence > 1 ? 'es' : ''}</span>` : ''}</div>`}
            <div class="calc">${k.dparts2.map(esc).join(' · ')}</div>
            <div class="calc">${typeTag(k.rawType)} → <b class="tag-${k.effType.toLowerCase()}">${typeNames[k.effType]}</b>${t ? ` vs ${KINDS[t.kind].label.toLowerCase()}` : ''} <span class="faint">(${esc(TYPE_HELP[k.rawType] || '')})</span></div>
            ${k.autoFire ? '' : rollOrEnter('rolldmg', 'dmgSucc', k.hit ? k.dmgPool : 0, atk.dmgSucc, { disabled: !k.hit })}
            ${atk.dmgRoll ? `<div class="dice-out">${diceHTML(atk.dmgRoll, k.potence)} ${resultHTML(atk.dmgRoll, k.potence)}</div>` : ''}`}
        </div>

        <div class="step"><h3><span class="n">5</span>Soak & apply</h3>
          ${t && !k.noDamage ? `
            <div class="bigline">${esc(t.name)}: pool <b>${k.soak.pool}</b> vs difficulty <b>${k.soak.diff}</b></div>
            <div class="calc">Soaking ${typeNames[k.effType]}: ${k.soak.parts.map(esc).join(' + ') || 'nothing'}</div>
            ${rollOrEnter('rollsoak', 'soakSucc', k.soak.pool, atk.soakSucc, { digital: !targetIsPlayer, disabled: k.dmgTotal == null })}
            ${atk.soakRoll ? `<div class="dice-out">${diceHTML(atk.soakRoll)} ${resultHTML(atk.soakRoll)}</div>` : ''}
            ${k.final != null ? `<div class="bigline">${esc(t.name)} takes <b>${k.final}</b> ${typeNames[k.effType]}${k.halved ? ' <span class="muted small">(bashing halved: undead)</span>' : ''}</div>
              ${k.final > dazedLimit ? `<div class="note">More than ${KINDS[t.kind].supernatural ? 'Stamina + 2' : 'Stamina'} (${dazedLimit}): <b>dazed</b>, loses next turn.</div>` : ''}
              ${w.stake && atk.targeting === 'precise' && k.final >= 3 && t.kind === 'vampire' ? `<div class="note">Stake through the heart: <b>staked</b> (paralysed).</div>` : ''}
              ${man.id === 'disarm' && k.dmgTotal > eff(t, 'str') ? `<div class="note">Damage successes exceed Strength: no damage, <b>disarmed</b> instead.</div>` : ''}` : ''}
            <div class="roll-row">
              <button class="btn primary" data-a="apply" ${k.final == null || atk.applied ? 'disabled' : ''}>${atk.applied ? 'Applied ✓' : 'Apply damage'}</button>
              ${targetIsPlayer ? '' : `<button class="btn" data-a="autoall" ${k.atkTotal == null || !k.hit || atk.applied ? 'disabled' : ''} title="Roll any remaining damage and soak digitally, then apply">Roll rest & apply</button>`}
            </div>` : '<div class="muted">—</div>'}
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" data-a="reset">New attack</button>
      <button class="btn" data-x>Close</button>
    </div>`;
}

/* Ammunition and the Willpower point are spent once per attack, whether rolled digitally or entered by hand. */
function spendAttack(k) {
  if (atk.spent) return true;
  const { a, w, inst, man } = k;
  if (inst && w.clip) {
    const need = man.ammo === 'all' ? inst.ammo : (man.ammo || 1);
    if (man.id === 'auto' && inst.ammo < Math.ceil(w.clip / 2)) { toast('Automatic fire needs the clip at least half full.'); return false; }
    if (inst.ammo < 1 || inst.ammo < need) { toast('Not enough ammunition — reload (one full turn).'); return false; }
    inst.ammo -= need;
  }
  if (atk.wp) {
    if (a.wp.cur < 1) { toast('No Willpower left.'); return false; }
    a.wp.cur--;
  }
  atk.spent = true;
  return true;
}
function logAttack(k) {
  const { a, t, w, man } = k;
  const total = atk.atkSucc + (atk.wp ? 1 : 0);
  const shown = atk.atkRoll ? diceHTML(atk.atkRoll, atk.wp ? 1 : 0) : '(physical dice)';
  log(`<b>${esc(a.name)}</b> attacks ${t ? esc(t.name) : ''} with ${esc(w.name)} (${esc(man.name)}): ${shown} → ${atk.atkRoll?.botch && !atk.wp ? '<b>botch</b>' : total + ' succ'} @${k.diff}`);
}

function atkAction(act) {
  const k = atkCalc();
  const { t, w, man } = k;
  if (act === 'rollatk') {
    if (!spendAttack(k)) return;
    atk.atkRoll = roll(k.pool, k.diff);
    atk.atkSucc = atk.atkRoll.succ;
    Object.assign(atk, { dmgRoll: null, dmgSucc: null, soakRoll: null, soakSucc: null, applied: false });
    logAttack(k);
    persist();
  } else if (act === 'rolldef') {
    if (!t) return;
    atk.defRoll = roll(k.def.pool, k.def.diff);
    atk.defSucc = atk.defRoll.succ;
    Object.assign(atk, { dmgRoll: null, dmgSucc: null, soakRoll: null, soakSucc: null, applied: false });
    log(`${esc(t.name)} ${atk.defType}s: ${diceHTML(atk.defRoll)} → ${atk.defSucc} succ`);
  } else if (act === 'rolldmg') {
    atk.dmgRoll = roll(k.dmgPool, 6, { canBotch: false });
    atk.dmgSucc = atk.dmgRoll.succ;
    Object.assign(atk, { soakRoll: null, soakSucc: null, applied: false });
  } else if (act === 'rollsoak') {
    if (!t) return;
    atk.soakRoll = roll(k.soak.pool, k.soak.diff, { canBotch: false });
    atk.soakSucc = atk.soakRoll.succ;
    atk.applied = false;
  } else if (act === 'autoall') {
    if (!k.autoFire && atk.dmgSucc == null) { atk.dmgRoll = roll(k.dmgPool, 6, { canBotch: false }); atk.dmgSucc = atk.dmgRoll.succ; }
    const k2 = atkCalc();
    if (atk.soakSucc == null) { atk.soakRoll = roll(k2.soak.pool, k2.soak.diff, { canBotch: false }); atk.soakSucc = atk.soakRoll.succ; }
    return atkAction('apply');
  } else if (act === 'apply') {
    const k2 = atkCalc();
    if (k2.final == null || !t || atk.applied) return;
    const disarmed = man.id === 'disarm' && k2.dmgTotal > eff(t, 'str');
    let msg = '';
    if (!disarmed) msg = applyDamage(t, k2.effType, k2.final);
    const dazedLimit = eff(t, 'sta') + (KINDS[t.kind].supernatural ? 2 : 0);
    if (!disarmed && k2.final > dazedLimit) t.st.dazed = true;
    if (w.stake && atk.targeting === 'precise' && k2.final >= 3 && t.kind === 'vampire') t.st.staked = true;
    if (['clinch', 'hold'].includes(man.id)) t.st.clinched = true;
    atk.applied = true;
    log(`→ ${esc(t.name)} ${disarmed ? 'is <b>disarmed</b>' : `takes <b>${k2.final}</b> ${k2.effType}`} (dmg ${k2.dmgTotal}, soak ${atk.soakSucc}${k2.halved ? ', halved' : ''})${t.st.dazed && k2.final > dazedLimit ? ' — dazed' : ''}${msg ? ' — ' + esc(msg) : ''}`);
    if (msg) toast(msg);
    commit();
  } else if (act === 'reset') {
    Object.assign(atk, { atkRoll: null, atkSucc: null, defRoll: null, defSucc: 0, dmgRoll: null, dmgSucc: null, soakRoll: null, soakSucc: null, applied: false, wp: false, spent: false });
  }
  renderAttack();
  render();
}

/* Update one attack setting; anything downstream of it is cleared. */
function setAtk(key, v) {
  const k0 = atkCalc();
  if (key === 'atkSucc' && v != null && !atk.spent && !spendAttack(k0)) { renderAttack(); return; }
  atk[key] = v;
  if (key === 'weaponIdx') pickDefaultManeuver();
  if (key === 'actions' || key === 'actionNo') {
    atk.actions = Math.max(1, atk.actions || 1);
    atk.actionNo = clamp(atk.actionNo || 1, 1, atk.actions);
  }
  if (key === 'defType' && v === 'none') atk.defSucc = 0;
  const level = {
    weaponIdx: 'atk', maneuverId: 'atk', range: 'atk', targeting: 'atk', cover: 'atk', flank: 'atk', multiOpp: 'atk',
    actions: 'atk', actionNo: 'atk', aim: 'atk', scope: 'atk', extraDice: 'atk', extraDiff: 'atk',
    targetId: 'def', defType: 'def', atkSucc: 'dmg', defSucc: 'dmg', dmgSucc: 'soak', soakSucc: 'apply',
  }[key];
  if (level === 'atk') Object.assign(atk, { atkRoll: null, atkSucc: null, defRoll: null, defSucc: 0 });
  if (level === 'def') Object.assign(atk, { defRoll: null, defSucc: 0 });
  if (['atk', 'def', 'dmg'].includes(level)) Object.assign(atk, { dmgRoll: null, dmgSucc: null });
  if (['atk', 'def', 'dmg', 'soak'].includes(level)) Object.assign(atk, { soakRoll: null, soakSucc: null });
  if (level) atk.applied = false;
  if (key === 'atkSucc') { atk.atkRoll = null; if (v != null) { logAttack(atkCalc()); persist(); } }
  if (key === 'defSucc') atk.defRoll = null;
  if (key === 'dmgSucc') atk.dmgRoll = null;
  if (key === 'soakSucc') atk.soakRoll = null;
  renderAttack();
  render();
}

$('#modalRoot').addEventListener('click', e => {
  if (!atk || !$('#atkBody')) return;
  if (e.target.closest('[data-x]')) return closeModal();
  const s = e.target.closest('[data-set]');
  if (s) {
    const raw = s.dataset.v;
    const v = s.dataset.set === 'showAll' ? !!raw : s.hasAttribute('data-num') ? num(raw) : raw;
    if (s.dataset.set === 'showAll') { atk.showAll = v; return renderAttack(); }
    return setAtk(s.dataset.set, v);
  }
  const b = e.target.closest('[data-a]');
  if (b && !b.disabled) atkAction(b.dataset.a);
});
$('#modalRoot').addEventListener('change', e => {
  if (!atk || !$('#atkBody')) return;
  const el = e.target.closest('[data-k]'); if (!el) return;
  const v = el.type === 'checkbox' ? el.checked : el.hasAttribute('data-num') ? (el.value === '' ? null : num(el.value)) : el.value;
  setAtk(el.dataset.k, v);
});

/* ---------- Share / encounter link ---------- */
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ''; bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
}

function buildPayload({ includePCs = true, includeState = false } = {}) {
  const payload = { v: 1, name: combat.name || undefined };
  const entries = [];
  const usedCustomWeapons = new Set();
  combat.combatants.forEach(c => {
    c.weapons.forEach(w => { if (customWeapons.find(x => x.id === w.wid)) usedCustomWeapons.add(w.wid); });
    if (c.pcId || (c.side === 'pc' && pcs.find(p => p.name === c.name))) {
      if (!includePCs) return;
      const e = { pc: c.name };
      if (includeState) addState(e, c);
      return entries.push(e);
    }
    const p = c.presetId && getPreset(c.presetId);
    if (p) {
      const base = makeCombatant(presetTemplate(p));
      const e = { preset: p.id };
      const nameBase = c.name.replace(/ \d+$/, '');
      if (nameBase !== p.name) e.name = c.name;
      if (c.side !== 'npc') e.side = c.side;
      if (c.kind !== base.kind) e.kind = c.kind;
      const ad = {}; ATTR_KEYS.forEach(k => { if (c.attrs[k] !== base.attrs[k]) ad[k] = c.attrs[k]; });
      if (Object.keys(ad).length) e.attrs = { ...base.attrs, ...ad };
      if (traitsToString(c.abil) !== traitsToString(base.abil)) e.abil = traitsToString(c.abil);
      if (traitsToString(c.disc) !== traitsToString(base.disc)) e.disc = traitsToString(c.disc);
      if (c.wp.max !== base.wp.max) e.wp = c.wp.max;
      if (c.bp.max !== base.bp.max) e.bp = c.bp.max;
      if (c.armor !== base.armor) e.armor = c.armor;
      if (c.health !== base.health) e.health = c.health;
      const wids = c.weapons.map(w => w.wid);
      if (wids.join() !== base.weapons.map(w => w.wid).join()) e.weapons = wids;
      if (c.notes !== base.notes) e.notes = c.notes;
      if (includeState) addState(e, c);
      if (e.attrs) e.attrs = ATTR_KEYS.map(k => e.attrs[k]);
      return entries.push(e);
    }
    const e = { custom: toTemplate(c) };
    if (includeState) addState(e.custom, c);
    entries.push(e);
  });
  // Merge consecutive identical preset entries into a count.
  const merged = [];
  entries.forEach(e => {
    const last = merged[merged.length - 1];
    if (last && e.preset && last.preset) {
      const { count, ...rest } = last;
      if (JSON.stringify(rest) === JSON.stringify(e)) { last.count = (count || 1) + 1; return; }
    }
    merged.push(e);
  });
  payload.combatants = merged;
  if (usedCustomWeapons.size) payload.weapons = customWeapons.filter(w => usedCustomWeapons.has(w.id));
  return JSON.parse(JSON.stringify(payload));
}
function payloadToUrl(payload) {
  const base = location.href.split('#')[0].split('?')[0];
  return `${base}#encounter=${b64urlEncode(JSON.stringify(payload))}`;
}

function loadPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Payload must be an object');
  (payload.weapons || []).forEach(w => {
    if (w?.id && !getWeapon(w.id)) { customWeapons.push({ ...w, builtin: undefined }); }
  });
  save(STORE.weapons, customWeapons);
  const c2 = newCombat(payload.name || '');
  const missing = [];
  const list = [...(payload.combatants || []), ...(payload.npcs || [])];
  const pcEntries = payload.pcs === true ? pcs.map(p => ({ pc: p.name })) : (Array.isArray(payload.pcs) ? payload.pcs.map(n => (typeof n === 'string' ? { pc: n } : n)) : []);
  const prevCombat = combat;
  combat = c2; // so uniqueName works against the new combat
  const applyState = (c, e) => {
    if (e.dmg) { c.dmg = { a: num(e.dmg.a), l: num(e.dmg.l), b: num(e.dmg.b) }; }
    if (typeof e.wp === 'object' && e.wp) c.wp.cur = clamp(num(e.wp.cur, c.wp.max), 0, c.wp.max);
    if (typeof e.bp === 'object' && e.bp) c.bp.cur = clamp(num(e.bp.cur, c.bp.max), 0, c.bp.max);
    if (e.state) c.state = e.state;
  };
  try {
    [...pcEntries, ...list].forEach(e => {
      if (!e) return;
      const count = clamp(num(e.count, 1), 1, 50);
      for (let i = 0; i < count; i++) {
        let c = null;
        if (e.pc) {
          const p = pcs.find(x => x.name.toLowerCase() === String(e.pc).toLowerCase());
          if (p) c = pcToCombatant(p);
          else if (e.attrs || e.custom) c = makeCombatant({ ...(e.custom || e), name: e.pc, side: 'pc' }, 'pc');
          else { if (i === 0) missing.push(e.pc); continue; }
        } else if (e.preset) {
          const p = getPreset(e.preset);
          if (!p) { if (i === 0) missing.push(e.preset); continue; }
          const t = presetTemplate(p);
          ['name', 'side', 'kind', 'abil', 'disc', 'armor', 'health', 'weapons', 'notes', 'regen', 'extra', 'gen', 'humanity'].forEach(f => { if (e[f] !== undefined) t[f] = e[f]; });
          if (e.attrs) t.attrs = e.attrs;
          if (e.wp !== undefined) t.wp = e.wp;
          if (e.bp !== undefined) t.bp = e.bp;
          delete t.a;
          c = makeCombatant(t);
        } else if (e.custom || e.name) {
          c = makeCombatant(e.custom || e);
        }
        if (!c) continue;
        applyState(c, e.custom ? { ...e.custom, ...e } : e);
        addCombatant(c);
      }
    });
  } catch (err) {
    combat = prevCombat;
    throw err;
  }
  logEntries = [];
  log(`<b>Encounter loaded</b>${c2.name ? ': ' + esc(c2.name) : ''} (${c2.combatants.length} combatants)`);
  if (missing.length) toast(`Not found: ${missing.join(', ')}`, 5000);
  commit();
}

function openShare() {
  const m = openModal(`
    <div class="modal-head"><h2>Encounter link</h2><button class="btn ghost right" data-x>✕</button></div>
    <div class="modal-body">
      <p class="small muted" style="margin-top:0">Opening this link starts the encounter in the tracker. Players are referenced by name and pulled from the opener's saved players.</p>
      <div class="row">
        <label class="check"><input type="checkbox" id="shPCs" checked> Include players (by name)</label>
        <label class="check"><input type="checkbox" id="shState"> Include current damage / Willpower / blood</label>
      </div>
      <div class="f" style="margin-top:10px"><label>Link</label><textarea id="shUrl" class="code" rows="3" readonly style="min-height:70px"></textarea></div>
      <div class="row" style="margin-top:6px"><button class="btn primary" id="shCopy">Copy link</button><a class="btn" id="shOpen" target="_blank" rel="noopener">Open in new tab</a></div>
      <div class="f" style="margin-top:14px"><label>Payload (JSON) — edit and rebuild to hand-craft an encounter</label><textarea id="shJson" class="code" rows="12"></textarea></div>
      <div class="row" style="margin-top:6px"><button class="btn" id="shBuild">Build link from JSON</button><button class="btn" id="shLoad">Load JSON into tracker</button></div>
      <details style="margin-top:12px"><summary class="muted">Payload format & IDs</summary>
        <div class="small muted" style="margin-top:6px">
          <p>URL format: <code>index.html#encounter=&lt;base64url(JSON)&gt;</code>. Plain URL-encoded JSON also works: <code>#encounter={"combatants":[…]}</code>.</p>
          <pre class="code" style="white-space:pre-wrap">{
  "v": 1,
  "name": "Warehouse ambush",
  "pcs": true,                         // all saved players, or ["Anna", "Mikkel"]
  "combatants": [
    { "preset": "inquisitor", "count": 2 },
    { "preset": "gov_agent", "name": "Agent Smith",
      "weapons": ["shotgun", "knife"], "armor": 3 },
    { "preset": "were_vet", "dmg": { "b": 0, "l": 2, "a": 0 } },
    { "pc": "Anna" },
    { "custom": { "name": "Lasombra Elder", "kind": "vampire",
        "attrs": [4,4,4,3,4,3,3,3,4], "abil": "Brawl 4, Dodge 3, Melee 3",
        "disc": "Fortitude 3, Potence 2, Obtenebration 4",
        "wp": 8, "bp": 20, "weapons": ["sword"] } }
  ]
}</pre>
          <p><b>attrs</b> order: Str, Dex, Sta, Cha, Man, App, Per, Int, Wits. <b>kind</b>: ${Object.keys(KINDS).join(', ')}. <b>health</b>: standard, extra, or e.g. "OK,-1,-2,-5,Inc".</p>
          <p><b>Preset IDs:</b> ${allPresets().map(p => `<code>${esc(p.id)}</code>`).join(' ')}</p>
          <p><b>Weapon IDs:</b> ${allWeapons().map(w => `<code>${esc(w.id)}</code>`).join(' ')}</p>
        </div></details>
    </div>
    <div class="modal-foot"><button class="btn" data-x>Close</button></div>`, { wide: true });
  const rebuild = () => {
    const p = buildPayload({ includePCs: $('#shPCs', m).checked, includeState: $('#shState', m).checked });
    $('#shJson', m).value = JSON.stringify(p, null, 2);
    setUrl(p);
  };
  const setUrl = p => { const url = payloadToUrl(p); $('#shUrl', m).value = url; $('#shOpen', m).href = url; };
  rebuild();
  m.addEventListener('click', e => { if (e.target.closest('[data-x]')) closeModal(); });
  $('#shPCs', m).onchange = rebuild;
  $('#shState', m).onchange = rebuild;
  $('#shCopy', m).onclick = async () => {
    try { await navigator.clipboard.writeText($('#shUrl', m).value); toast('Link copied'); }
    catch { $('#shUrl', m).select(); document.execCommand('copy'); toast('Link copied'); }
  };
  const parse = () => { try { return JSON.parse($('#shJson', m).value); } catch (err) { toast('Invalid JSON: ' + err.message); return null; } };
  $('#shBuild', m).onclick = () => { const p = parse(); if (p) { setUrl(p); toast('Link rebuilt'); } };
  $('#shLoad', m).onclick = async () => {
    const p = parse(); if (!p) return;
    if (combat.combatants.length && !(await ask('Replace the current combat with this encounter?', { ok: 'Replace' }))) return;
    try { loadPayload(p); closeModal(); } catch (err) { toast('Could not load: ' + err.message); }
  };
}

async function checkUrlPayload() {
  const hash = location.hash.slice(1);
  const query = new URLSearchParams(location.search);
  let raw = new URLSearchParams(hash).get('encounter') || query.get('encounter');
  if (!raw) return;
  let payload;
  try {
    const trimmed = raw.trim();
    payload = trimmed.startsWith('{') ? JSON.parse(trimmed) : JSON.parse(b64urlDecode(trimmed));
  } catch {
    try { payload = JSON.parse(decodeURIComponent(raw)); } catch (err) { toast('Encounter link is not valid: ' + err.message, 5000); return; }
  }
  try { history.replaceState(null, '', location.pathname + location.search.replace(/[?&]encounter=[^&]*/, '')); } catch { location.hash = ''; }
  const label = payload.name ? `"${payload.name}"` : 'this encounter';
  if (combat.combatants.length && !(await ask(`Start ${label} from the link? This replaces the current combat.`, { ok: 'Start encounter' }))) return;
  try { loadPayload(payload); toast(`Loaded ${label}`); } catch (err) { toast('Could not load encounter: ' + err.message, 5000); }
}

/* ---------- Rules reference ---------- */
function openRules() {
  const m = openModal(`
    <div class="modal-head"><h2>Combat quick reference</h2><button class="btn ghost right" data-x>✕</button></div>
    <div class="modal-body rules">
      <h3>The turn (3 seconds)</h3>
      <ul>
        <li><b>Initiative:</b> 1d10 + Dexterity + Wits; wound penalties subtract from the rating. Ties: higher rating first, otherwise simultaneous. Re-rolled every turn.</li>
        <li><b>Declaration:</b> in reverse initiative order (slowest first). Declare multiple actions, Disciplines and Willpower now.</li>
        <li><b>Attack:</b> act in initiative order. Delayed characters may act any time later, even interrupting. Defensive actions may be taken any time an action remains; aborting to one needs a Willpower roll (diff 6) or 1 WP.</li>
        <li><b>Multiple actions</b> (incl. Celerity) happen at the end of the turn in order of initiative rating. Celerity: 1 blood for +rating physical actions next turn at full pools.</li>
        <li><b>Resolution:</b> damage pool + 1 die per attack success above the first. Damage and soak are diff 6, cannot botch.</li>
      </ul>
      <h3>Attacks</h3>
      <ul>
        <li>Unarmed: Dex + Brawl · Melee: Dex + Melee · Guns: Dex + Firearms · Thrown: Dex + Athletics. Default difficulty 6.</li>
        <li>Range: point blank (≤2 m) diff 4 · short diff 6 · long (≤2× range) diff 8. Aiming: +1 die/turn up to Perception (+2 scope).</li>
        <li>Flank +1 die, rear +2 dice. Multiple opponents in close combat: +1 diff each after the first (max +4). Blind: +2 diff.</li>
        <li>Multiple actions: first pool −(number of actions), each later one −1 more. Full defense: −1 die per extra defense.</li>
        <li>Willpower: +1 automatic success (one per turn), or ignore wound penalties for a turn.</li>
      </ul>
      <table><tr><th>Targeting</th><th>Difficulty</th><th>Damage</th></tr>
        ${TARGETING.slice(1).map(t => `<tr><td>${t.name}</td><td>+${t.diff}</td><td>${t.dmg ? '+' + t.dmg : '—'}</td></tr>`).join('')}</table>
      <table><tr><th>Cover</th><th>Attacker diff</th></tr>${COVER.slice(1).map(c => `<tr><td>${c.name}</td><td>+${c.diff}</td></tr>`).join('')}</table>
      <h3>Maneuvers</h3>
      <table><tr><th>Maneuver</th><th>Traits</th><th>Acc</th><th>Diff</th><th>Damage</th></tr>
        <tr><td>Bite</td><td>Dex + Brawl</td><td>+1</td><td>—</td><td>Str +1 (A)</td></tr>
        <tr><td>Claw</td><td>Dex + Brawl</td><td>—</td><td>—</td><td>Str +1 (A)</td></tr>
        <tr><td>Clinch</td><td>Str + Brawl</td><td>—</td><td>—</td><td>Str (C)</td></tr>
        <tr><td>Disarm</td><td>Dex + Melee</td><td>—</td><td>+1</td><td>Special</td></tr>
        <tr><td>Hold</td><td>Str + Brawl</td><td>—</td><td>—</td><td>None (C)</td></tr>
        <tr><td>Kick</td><td>Dex + Brawl</td><td>—</td><td>+1</td><td>Str +1</td></tr>
        <tr><td>Strike</td><td>Dex + Brawl</td><td>—</td><td>—</td><td>Str</td></tr>
        <tr><td>Sweep</td><td>Dex + Brawl/Melee</td><td>—</td><td>+1</td><td>Str (K)</td></tr>
        <tr><td>Tackle</td><td>Str + Brawl</td><td>—</td><td>+1</td><td>Str +1 (K)</td></tr>
        <tr><td>Weapon Strike</td><td>Dex + Melee</td><td>—</td><td>—</td><td>Weapon</td></tr>
        <tr><td>3-Round Burst</td><td>Dex + Firearms</td><td>+2</td><td>+1</td><td>Weapon</td></tr>
        <tr><td>Automatic Fire / Strafing</td><td>Dex + Firearms</td><td>+10</td><td>+2</td><td>Weapon</td></tr>
      </table>
      <p class="small muted">(A) aggravated · (C) carries over · (K) knockdown. Block, dodge and parry are resisted rolls that subtract from attack successes.</p>
      <h3>Damage & soak</h3>
      <ul>
        <li><b>Bashing</b> (fists, clubs; firearms vs Kindred): everyone soaks with Stamina (+Fortitude). Vampires halve bashing after soak.</li>
        <li><b>Lethal</b> (blades, bullets vs mortals): mortals cannot soak (armor still helps); vampires soak with Stamina + Fortitude. Ghouls soak lethal while they have vitae.</li>
        <li><b>Aggravated</b> (fire, sunlight, fangs, claws): soak with Fortitude only. Armor helps vs fangs/claws, not fire. Mortals treat aggravated sources as lethal.</li>
        <li><b>Armor</b> adds to soak; its penalty subtracts from Dexterity pools. Destroyed if one attack's damage roll is twice its rating.</li>
        <li><b>Fire:</b> automatic levels (torch 1, bonfire 2, inferno 3); Fortitude soak at heat difficulty (candle 3, torch 5, Bunsen 7, electrical 8, chemical 9, molten metal 10).</li>
        <li><b>Dazed:</b> damage after soak > Stamina (mortals) or Stamina + 2 (supernaturals): lose next turn.</li>
        <li><b>Stake:</b> target heart (diff 9) and 3+ levels: vampire paralysed.</li>
        <li><b>Werewolves</b> soak everything with Stamina (not silver), regenerate 1 level/turn, don't halve bashing. <b>Faeries</b> soak lethal, aggravated only from fire.</li>
      </ul>
      <h3>Health</h3>
      <table><tr><th>Level</th><th>Penalty</th><th>Movement</th></tr>
        ${HEALTH_TEMPLATES.standard.map(l => `<tr><td>${l.n}</td><td>${l.p === null ? '—' : l.p || '0'}</td><td>${HEALTH_MOVEMENT[l.n]}</td></tr>`).join('')}</table>
      <ul>
        <li>Aggravated is marked above normal damage; normal damage heals first.</li>
        <li>Incapacitated vampire + more bashing/lethal → torpor; + aggravated → Final Death. Mortals beyond Incapacitated die.</li>
        <li>Vampires heal 1 normal level per blood point (one per turn at most generations). Aggravated: 5 blood and a full day of rest per level.</li>
        <li>Extras (optional): Hurt −1, Maimed −3, Incapacitated, then dead.</li>
      </ul>
    </div>
    <div class="modal-foot"><button class="btn" data-x>Close</button></div>`, { wide: true });
  m.addEventListener('click', e => { if (e.target.closest('[data-x]')) closeModal(); });
}

/* ============================================================
 * Event wiring
 * ============================================================ */
function quickDamage(c, type) {
  const n = 1;
  let applied = n, note = '';
  if (settings.autoSoak) {
    const s = soakFor(c, type, {});
    const r = roll(s.pool, s.diff, { canBotch: false });
    applied = Math.max(0, n - r.succ);
    if (type === 'B' && KINDS[c.kind].halveBashing) { applied = Math.floor(applied / 2); note = ', halved'; }
    note = ` (soak ${diceHTML(r)} ${r.succ}${note})`;
  }
  const msg = applyDamage(c, type, applied);
  log(`${esc(c.name)} takes <b>${applied}</b> ${type}${note}${msg ? ' — ' + esc(msg) : ''}`);
  if (msg) toast(msg);
}

document.addEventListener('click', e => {
  if (e.target.closest('#modalRoot')) return;
  if (e.target.closest('select')) return;
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  const c = el.dataset.id ? byId(el.dataset.id) : null;

  switch (act) {
    case 'addpreset': {
      const p = getPreset(el.dataset.p);
      for (let i = 0; i < settings.addQty; i++) addCombatant(makeCombatant(presetTemplate(p)));
      log(`Added ${settings.addQty > 1 ? settings.addQty + '× ' : ''}${esc(p.name)}`);
      return commit();
    }
    case 'delpreset':
      return ask('Delete this saved antagonist?', { ok: 'Delete', danger: true }).then(yes => {
        if (!yes) return;
        customPresets = customPresets.filter(p => p.id !== el.dataset.p); save(STORE.presets, customPresets);
        render();
      });
    case 'addpc': {
      const p = pcs.find(x => x.id === el.dataset.p); if (!p) return;
      addCombatant(pcToCombatant(p)); return commit();
    }
    case 'addallpcs':
      pcs.filter(p => !combat.combatants.some(c2 => c2.pcId === p.id)).forEach(p => addCombatant(pcToCombatant(p)));
      return commit();
    case 'players': return openPlayers();
    case 'newcustom':
      return openEditor({ mode: 'new', template: { name: el.dataset.side === 'pc' ? 'Ally' : 'Antagonist', side: el.dataset.side, kind: el.dataset.side === 'pc' ? 'vampire' : 'mortal', wp: 5, bp: el.dataset.side === 'pc' ? 10 : 0, attrs: [2, 2, 2, 2, 2, 2, 2, 2, 2], abil: 'Brawl 2, Dodge 2, Melee 2, Firearms 2, Alertness 2' }, onSave: nc => { addCombatant(nc); commit(); } });
    case 'quickextra': {
      const init = num($('#qxInit').value, 4), pool = num($('#qxPool').value, 5), soak = num($('#qxSoak').value, 2);
      const wid = $('#qxWeapon').value; const w = getWeapon(wid);
      const dex = Math.ceil(init / 2), wit = Math.floor(init / 2);
      const skill = w.kind === 'ranged' ? 'Firearms' : w.kind === 'melee' ? 'Melee' : 'Brawl';
      const nc = makeCombatant({
        name: $('#qxName').value.trim() || 'Thug', kind: 'mortal', side: 'npc',
        attrs: [2, dex, soak, 1, 1, 1, 2, 2, wit], abil: `${skill} ${Math.max(0, pool - dex)}, Dodge 1`, wp: 3,
        weapons: wid === 'unarmed' ? [] : [wid], health: $('#qxExtra').checked ? 'extra' : 'standard',
      });
      for (let i = 0; i < settings.addQty; i++) addCombatant(i ? { ...clone(nc), id: uid() } : nc);
      return commit();
    }
    case 'attack': return openAttack(c.id, num(el.dataset.w, -1));
    case 'edit':
      return openEditor({
        combatant: c, mode: 'combat', focus: el.dataset.focus,
        onSave: nc => { Object.assign(c, nc); commit(); },
      });
    case 'dup': {
      const nc = clone(c); nc.id = uid(); nc.name = c.name.replace(/ \d+$/, ''); nc.pcId = null;
      addCombatant(nc); return commit();
    }
    case 'remove':
      return ask(`Remove ${c.name} from combat?`, { ok: 'Remove', danger: true }).then(yes => {
        if (!yes) return;
        combat.combatants = combat.combatants.filter(x => x !== c);
        combat.cursor = Math.min(combat.cursor, Math.max(0, phaseList().length - 1));
        commit();
      });
    case 'expand': c.expanded = !c.expanded; return commit();
    case 'init':
      if (!canAct(c)) return toast(`${c.name} can't act.`);
      c._editInit = true; render();
      $(`.init-input[data-id="${c.id}"]`)?.select();
      return;
    case 'status': {
      const s = el.dataset.s;
      c.st[s] = !c.st[s];
      if (s === 'wpIgnore' && c.st[s]) { if (c.wp.cur < 1) { c.st[s] = false; return toast('No Willpower left'); } c.wp.cur--; }
      return commit();
    }
    case 'wpignore':
      c.wp.cur--; c.st.wpIgnore = true; log(`${esc(c.name)} spends Willpower to ignore wound penalties this turn.`); return commit();
    case 'actnow':
      c.st.delayed = false; c.acted = true; log(`${esc(c.name)} acts (delayed action).`); return commit();
    case 'dmg': quickDamage(c, el.dataset.t); return commit();
    case 'heal': {
      const h = healDamage(c, el.dataset.t, 1);
      if (h) log(`${esc(c.name)} heals ${h} ${el.dataset.t}`);
      return commit();
    }
    case 'mend': {
      if (c.bp.cur < 1) return toast('No blood left');
      if (!c.dmg.l && !c.dmg.b) return toast('No normal damage to heal');
      c.bp.cur--; healDamage(c, c.dmg.l ? 'L' : 'B', 1);
      log(`${esc(c.name)} spends 1 blood to heal a level.`); return commit();
    }
    case 'mendagg': {
      if (!c.dmg.a) return toast('No aggravated damage');
      if (c.bp.cur < 5) return toast('Needs 5 blood');
      c.bp.cur -= 5; healDamage(c, 'A', 1);
      log(`${esc(c.name)} spends 5 blood to heal an aggravated level (requires a full day of rest).`); return commit();
    }
    case 'res': {
      const r = c[el.dataset.r]; r.cur = clamp(r.cur + num(el.dataset.d), 0, r.max); return commit();
    }
    case 'res-set-wp': case 'res-set-bp': case 'res-set-extra': {
      const r = c[act.split('-')[2]]; const v = num(el.dataset.v);
      r.cur = r.cur === v ? v - 1 : v; return commit();
    }
    case 'celerity':
      if (c.bp.cur < 1) return toast('No blood left');
      c.bp.cur--; c.celerityNext = disc(c, 'celerity');
      log(`${esc(c.name)} activates Celerity: +${c.celerityNext} actions next turn.`); return commit();
    case 'multi': {
      const max = Math.max(disc(c, 'celerity'), 5);
      c.extraActions = (c.extraActions + 1) % (max + 1);
      return commit();
    }
    case 'boost': {
      if (c.bp.cur < 1) return toast('No blood left');
      c.bp.cur--; c.boost[el.dataset.k]++;
      log(`${esc(c.name)} spends blood: +1 ${el.dataset.k} for the scene.`); return commit();
    }
    case 'unboost': c.boost = { str: 0, dex: 0, sta: 0 }; return commit();
    case 'reload': {
      const inst = c.weapons[num(el.dataset.w)]; const def = getWeapon(inst.wid);
      inst.ammo = def.clip; log(`${esc(c.name)} reloads ${esc(def.name)}.`); return commit();
    }
    case 'revive': c.state = 'active'; return commit();
    case 'setstate': c.state = el.dataset.v; return commit();
    case 'rolldice': {
      const pool = num($('#dPool').value, 1), diff = num($('#dDiff').value, 6), wp = $('#dWP').checked;
      const r = roll(pool, diff);
      $('#dOut').innerHTML = `${diceHTML(r, wp ? 1 : 0)} ${resultHTML(r, wp ? 1 : 0)}`;
      log(`Roll ${pool}@${diff}: ${diceHTML(r, wp ? 1 : 0)} ${resultHTML(r, wp ? 1 : 0)}`);
      return persist();
    }
    case 'rolld10': { const v = d10(); $('#dOut').innerHTML = `<span class="dice"><span class="die">${v}</span></span>`; return; }
    case 'rollwho': {
      const w = byId($('#dWho').value); if (!w) return;
      const attrK = $('#dAttr').value, abilN = $('#dAbil').value;
      const pen = $('#dWound').checked ? woundInfo(w).pen : 0;
      const pool = eff(w, attrK) + (abilN ? ab(w, abilN) : 0) - pen;
      const diff = num($('#dDiff').value, 6);
      const r = roll(pool, diff);
      const label = `${ATTRS.find(a => a[0] === attrK)[1]}${abilN ? ' + ' + abilN : ''}`;
      $('#dOut2').innerHTML = `<div class="small muted">${esc(w.name)}: ${label} = ${pool} @${diff}</div>${diceHTML(r)} ${resultHTML(r)}`;
      log(`${esc(w.name)} rolls ${label} (${pool}@${diff}): ${diceHTML(r)} ${resultHTML(r)}`);
      return persist();
    }
    case 'clearlog': logEntries = []; persist(); return renderLog();
  }
});

document.addEventListener('change', e => {
  if (e.target.closest('#modalRoot')) return;
  const el = e.target;
  if (el.id === 'addQty') { settings.addQty = clamp(num(el.value, 1), 1, 20); save(STORE.settings, settings); }
  if (el.dataset.field === 'inittotal') { commitInitInput(el); return; }
  if (el.dataset.field === 'armor') {
    const c = byId(el.dataset.id); if (!c) return;
    c.armor = clamp(num(el.value), 0, 5);
    log(c.armor ? `${esc(c.name)} wears ${esc(ARMOR[c.armor].s)} (armor ${c.armor}).` : `${esc(c.name)} removes their armor.`);
    commit();
    return;
  }
  if (el.dataset.field === 'wswap' || el.dataset.field === 'wadd') {
    const c = byId(el.dataset.id); if (!c || !el.value) return;
    if (el.value === '__remove') {
      const [gone] = c.weapons.splice(num(el.dataset.w), 1);
      log(`${esc(c.name)} drops ${esc(getWeapon(gone.wid)?.name || 'a weapon')}.`);
    } else {
      const def = getWeapon(el.value);
      const inst = { wid: def.id, ammo: def.clip || undefined };
      if (el.dataset.field === 'wswap') {
        const old = getWeapon(c.weapons[num(el.dataset.w)].wid);
        c.weapons[num(el.dataset.w)] = inst;
        log(`${esc(c.name)} swaps ${esc(old?.name || '')} for ${esc(def.name)}.`);
      } else {
        c.weapons.push(inst);
        log(`${esc(c.name)} takes up ${esc(def.name)}.`);
      }
    }
    commit();
    return;
  }
  if (el.id === 'setKeepInit') { settings.keepInit = el.checked; save(STORE.settings, settings); toast(el.checked ? 'Initiative now carries over between turns (house rule).' : 'Initiative is re-rolled every turn (rules as written).'); render(); }
  if (el.id === 'setSkipDeclare') {
    settings.skipDeclare = el.checked; save(STORE.settings, settings);
    if (settings.skipDeclare && combat.phase === 'declare') advancePhase(); // jump straight to actions
    toast(el.checked ? 'Declaration step skipped: each character decides on their own turn (house rule).' : 'Declaration step restored (rules as written).');
    commit();
  }
  if (el.id === 'setAutoSoak') { settings.autoSoak = el.checked; save(STORE.settings, settings); }
  if (el.id === 'encounterName') { combat.name = el.value.trim(); persist(); }
});
function commitInitInput(el) {
  const c = byId(el.dataset.id); if (!c) return;
  const raw = el.value.trim();
  if (raw === '') {
    if (c.side === 'npc') { rollInit(c); log(`${esc(c.name)} re-rolls initiative: ${c.init.total}`); }
  } else {
    const v = num(raw, NaN);
    if (!Number.isFinite(v) || v < 0) { el.value = ''; return toast('Enter the initiative total'); }
    setInitTotal(c, v);
    log(`${esc(c.name)} initiative ${v}`);
  }
  c._editInit = false;
  commit();
  $('.init-input')?.focus(); // jump to the next player still waiting
}
// Enter on an empty box (NPC re-roll) doesn't fire "change"; Escape cancels an edit.
document.addEventListener('keydown', e => {
  const el = e.target;
  if (!el.classList?.contains('init-input')) return;
  if (e.key === 'Enter' && el.value.trim() === '') { e.preventDefault(); commitInitInput(el); }
  if (e.key === 'Escape') { const c = byId(el.dataset.id); if (c?._editInit) { c._editInit = false; render(); } }
});
document.addEventListener('input', e => {
  if (e.target.id === 'presetSearch') { presetFilter = e.target.value; renderAntagonists(); }
});

$('#sideTabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  $$('#sideTabs button').forEach(x => x.classList.toggle('active', x === b));
  $$('.tab-body').forEach(t => t.classList.toggle('hidden', t.id !== 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'log') renderLog();
  if (b.dataset.tab === 'dice') refreshDiceCombatants();
});

$('#btnRollInit').onclick = () => {
  if (!combat.combatants.some(c => c.side === 'npc')) return toast('No NPCs in this combat.');
  rollNpcInit(); commit();
  $('.init-input')?.focus();
};
$('#btnNext').onclick = next;
$('#btnPrev').onclick = prev;
$('#btnNewRound').onclick = () => { if (!combat.combatants.length) return; newTurn(); commit(); };
$('#btnShare').onclick = openShare;
$('#btnPlayers').onclick = openPlayers;
$('#btnWeapons').onclick = openWeapons;
$('#btnRules').onclick = openRules;
$('#btnClear').onclick = async () => {
  if (combat.combatants.length && !(await ask('End combat and remove all combatants?', { ok: 'End combat', danger: true }))) return;
  combat = newCombat(); logEntries = []; commit();
};
$('#btnReset').onclick = async () => {
  if (!combat.combatants.length) return;
  if (!(await ask('Reset combat? Everyone stays, but health, Willpower, blood, ammo, statuses and initiative are restored and the turn counter goes back to 1.', { ok: 'Reset combat' }))) return;
  resetCombat(); commit();
};
window.addEventListener('hashchange', checkUrlPayload);

// Keyboard: N = next, P = previous (when not typing)
document.addEventListener('keydown', e => {
  if ($('#modalRoot').innerHTML || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (e.key === 'n') { e.preventDefault(); next(); }
  if (e.key === 'p') prev();
});

/* ============================================================
 * Boot
 * ============================================================ */
// Re-attach weapons that may have been deleted since the combat was saved.
combat.combatants.forEach(c => { c.weapons = (c.weapons || []).filter(w => getWeapon(w.wid)); c.st = c.st || {}; c.boost = c.boost || { str: 0, dex: 0, sta: 0 }; });
render();
checkUrlPayload();
