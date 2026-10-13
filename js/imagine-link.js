/* Live link with imagineVTT (https://endrejordal.github.io/imagineVTT/).
 *
 * imagineVTT opens this tracker in a window named "vtm-tracker" and talks to it over a
 * BroadcastChannel (both apps are served from the same address). imagineVTT hands over an
 * encounter (the same payload as an #encounter= link) or a saved fight to resume; the tracker
 * reports its combat after every change, with a full snapshot that imagineVTT saves in its
 * scene file, so a fight can be resumed next week from the scene.
 *
 * Each linked fight carries a linkId (kept in the combat object). imagineVTT only takes
 * state for the fight that belongs to its open scene, so a fight run here on its own never
 * overwrites a scene's save.
 *
 * Only the window imagineVTT opened takes part; other tracker tabs keep working as before.
 * Nothing here changes how the tracker runs a fight. See imagineVTT's docs/combat-link.md.
 */
(() => {
  if (!('BroadcastChannel' in window)) return;
  const APP = 'imagine-combat';
  const V = 1;
  const channel = new BroadcastChannel(APP);
  const isLinkWindow = () => window.name === 'vtm-tracker';
  let vttSeen = 0;
  let lastSent = '';
  let timer = 0;

  const post = (type, extra = {}) => channel.postMessage({ app: APP, v: V, from: 'tracker', type, ...extra });
  const absolute = url => { try { return url ? new URL(url, location.href).href : ''; } catch { return ''; } };

  /* The text for a token's Type line: the encounter's own, else the preset's name, else the kind. */
  function typeOf(c) {
    if (c.vtt && typeof c.vtt.type === 'string' && c.vtt.type) return c.vtt.type;
    const p = c.presetId && getPreset(c.presetId);
    if (p) return p.name;
    return KINDS[c.kind] ? KINDS[c.kind].label : '';
  }

  /* What imagineVTT shows: who, in what order, whose turn. */
  function summary() {
    const actor = currentActor();
    return {
      name: combat.name || '',
      round: combat.round,
      phase: combat.phase,
      activeId: actor ? actor.id : null,
      order: ordered().map(c => c.id),
      combatants: combat.combatants.map(c => ({
        id: c.id,
        name: c.name,
        type: typeOf(c),
        side: c.side,
        allegiance: allegianceOf(c),
        state: c.state,
        inactive: !!c.inactive,
        acted: !!c.acted,
        init: c.init ? c.init.total : null,
        portrait: absolute(portraitFull(c)),
        vtt: c.vtt && typeof c.vtt === 'object' ? c.vtt : null,
      })),
    };
  }

  /* Everything needed to resume the fight elsewhere: the combat, its log, and the custom
   * weapons the combatants carry (they live in this browser's catalog otherwise). */
  function snapshot() {
    const used = new Set(combat.combatants.flatMap(c => (c.weapons || []).map(w => w.wid)));
    return {
      combat: { ...combat, log: logEntries.slice(0, 200) },
      weapons: customWeapons.filter(w => used.has(w.id)),
    };
  }

  function publish(force = false) {
    if (!isLinkWindow() || !combat.linkId) return;
    const state = { linkId: combat.linkId, summary: summary(), snapshot: snapshot() };
    const json = JSON.stringify(state);
    if (!force && json === lastSent) return;
    lastSent = json;
    post('state', state);
  }

  function badge() {
    let el = document.getElementById('imagineLink');
    if (!el) {
      el = document.createElement('span');
      el.id = 'imagineLink';
      el.className = 'small';
      el.style.cssText = 'margin-left:8px; white-space:nowrap; opacity:.85';
      const brand = document.querySelector('.topbar .brand');
      if (!brand) return;
      brand.appendChild(el);
    }
    const linked = Date.now() - vttSeen < 6000;
    el.textContent = linked ? (combat.linkId ? '● imagineVTT' : '● imagineVTT (no linked fight)') : '○ imagineVTT';
    el.title = linked
      ? 'Linked to imagineVTT: this fight is saved in its scene, and the players see the order.'
      : 'Not linked to imagineVTT (it opens the tracker when a fight starts there).';
    el.style.color = linked ? '#7fc98f' : '';
  }

  /* An encounter from imagineVTT: the same path as an #encounter= link, then linked. */
  async function startEncounter(linkId, payload) {
    if (combat.linkId === linkId) return publish(true); // already running it
    const label = payload && payload.name ? `"${payload.name}"` : 'this encounter';
    if (combat.combatants.length && !(await ask(`Start ${label} from imagineVTT? This replaces the current combat.`, { ok: 'Start encounter' }))) return;
    try {
      const missing = loadPayload(payload);
      combat.linkId = linkId;
      commit();
      toast(missing.length ? `Loaded ${label} — not found: ${missing.join(', ')}` : `Loaded ${label} from imagineVTT`, missing.length ? 7000 : 2600);
    } catch (err) {
      toast('Could not load encounter: ' + err.message, 5000);
    }
    publish(true);
  }

  /* A saved fight from imagineVTT's scene: put it back exactly as it was. */
  async function resume(linkId, saved) {
    if (combat.linkId === linkId) return publish(true); // this tracker still has it
    if (!saved || !saved.combat) return;
    const label = saved.combat.name ? `"${saved.combat.name}"` : 'the saved fight';
    if (combat.combatants.length && !(await ask(`Resume ${label} from imagineVTT? This replaces the current combat.`, { ok: 'Resume fight' }))) return;
    (saved.weapons || []).forEach(w => {
      if (w && w.id && !getWeapon(w.id)) customWeapons.push({ ...w, builtin: undefined });
    });
    save(STORE.weapons, customWeapons);
    combat = { ...saved.combat, linkId };
    logEntries = combat.log || [];
    commit();
    toast(`Resumed ${label}`);
    publish(true);
  }

  channel.onmessage = e => {
    const msg = e.data;
    if (!msg || msg.app !== APP || msg.from !== 'vtt') return;
    vttSeen = Date.now();
    badge();
    if (!isLinkWindow()) return;
    if (msg.type === 'hello') publish(true); // imagineVTT (re)started or took the fight on: send it all
    else if (msg.type === 'ping') publish(); // only if something changed
    else if (msg.type === 'encounter' && msg.linkId && msg.payload) startEncounter(msg.linkId, msg.payload);
    else if (msg.type === 'resume' && msg.linkId && msg.saved) resume(msg.linkId, msg.saved);
  };

  // Heard by imagineVTT as "the tracker is here", with which fight it holds.
  const beat = () => { if (isLinkWindow()) post('beat', { linkId: combat.linkId || null }); badge(); };
  setInterval(beat, 2000);
  beat();
  if (isLinkWindow()) post('hello', { linkId: combat.linkId || null });

  window.imagineLink = {
    /* Called after every render: report the change (debounced). */
    changed() { clearTimeout(timer); timer = setTimeout(() => publish(), 120); },
  };
})();
