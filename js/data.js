/* Rules data extracted from Vampire: The Masquerade Revised Edition
 * (Chapter Six: Combat Systems, Chapter Nine: Antagonists, Appendix: Bestiary). */
'use strict';

const ATTRS = [
  ['str', 'Strength'], ['dex', 'Dexterity'], ['sta', 'Stamina'],
  ['cha', 'Charisma'], ['man', 'Manipulation'], ['app', 'Appearance'],
  ['per', 'Perception'], ['int', 'Intelligence'], ['wit', 'Wits'],
];

// Abilities the tracker uses for combat rolls. Anything else is kept as free text.
const COMBAT_ABILITIES = [
  ['alertness', 'Alertness'], ['athletics', 'Athletics'], ['brawl', 'Brawl'],
  ['dodge', 'Dodge'], ['firearms', 'Firearms'], ['melee', 'Melee'], ['stealth', 'Stealth'],
];

const COMBAT_DISCIPLINES = [['celerity', 'Celerity'], ['fortitude', 'Fortitude'], ['potence', 'Potence']];

/* Creature kinds and how they take damage.
 * soakLethal: true = Stamina soaks lethal, 'vitae' = only while blood in system, false = cannot.
 * aggAsLethal: mortals treat aggravated sources (fire, fangs, claws) as lethal.
 * halveBashing: the undead halve bashing damage after soak.
 * soakAll: werewolves soak bashing, lethal and aggravated with Stamina. */
const KINDS = {
  vampire:  { label: 'Vampire',  soakLethal: true,    halveBashing: true, fangs: true, torpor: true, supernatural: true },
  ghoul:    { label: 'Ghoul',    soakLethal: 'vitae', aggAsLethal: true },
  mortal:   { label: 'Mortal',   soakLethal: false,   aggAsLethal: true },
  mage:     { label: 'Mage',     soakLethal: false,   aggAsLethal: true },
  werewolf: { label: 'Werewolf', soakAll: true,       fangs: true, supernatural: true },
  faerie:   { label: 'Faerie',   soakLethal: true,    aggOnlyFire: true, supernatural: true },
  wraith:   { label: 'Wraith',   soakLethal: true,    supernatural: true },
  animal:   { label: 'Animal',   soakLethal: false,   aggAsLethal: true },
};

/* Health charts */
const HEALTH_TEMPLATES = {
  standard: [
    { n: 'Bruised', p: 0 }, { n: 'Hurt', p: -1 }, { n: 'Injured', p: -1 }, { n: 'Wounded', p: -2 },
    { n: 'Mauled', p: -2 }, { n: 'Crippled', p: -5 }, { n: 'Incapacitated', p: null },
  ],
  // Optional Rule: Extras — Hurt -1, Maimed -3, Incapacitated, then Dead
  extra: [{ n: 'Hurt', p: -1 }, { n: 'Maimed', p: -3 }, { n: 'Incapacitated', p: null }],
};

const HEALTH_MOVEMENT = {
  Bruised: 'No penalty.', Hurt: 'No movement hindrance.', Injured: 'Halve maximum running speed.',
  Wounded: 'May not run (may still walk).', Mauled: 'May only hobble (3 yards/turn).',
  Crippled: 'May only crawl (1 yard/turn).', Maimed: 'Badly hurt.',
  Incapacitated: 'Cannot move; may only spend blood to heal.',
};

/* Armor Chart */
const ARMOR = [
  { r: 0, n: 'None', pen: 0 },
  { r: 1, n: 'Class One (reinforced clothing)', s: 'Reinforced', pen: 0 },
  { r: 2, n: 'Class Two (armor T-shirt)', s: 'Armor T-shirt', pen: 1 },
  { r: 3, n: 'Class Three (Kevlar vest)', s: 'Kevlar vest', pen: 1 },
  { r: 4, n: 'Class Four (flak jacket)', s: 'Flak jacket', pen: 2 },
  { r: 5, n: 'Class Five (full riot gear)', s: 'Riot gear', pen: 3 },
];

/* Weapons.
 * kind: brawl | melee | ranged | thrown
 * base: 'str' (Strength + mod) or 'fixed' (mod dice)
 * type: B | L | A | gun (lethal vs mortals, bashing vs Kindred unless head) | blunt (bashing unless head) | fire
 * natural: teeth/claws — armor applies against their aggravated damage
 * quirk: a few words shown on the card's weapon chip; notes: the longer explanation (tooltip, attack dialog) */
const WEAPONS = [
  { id: 'unarmed', name: 'Unarmed', kind: 'brawl', base: 'str', mod: 0, type: 'B', builtin: true, notes: 'Fists, feet, grapples.' },
  { id: 'feral_claws', name: 'Feral Claws', kind: 'brawl', base: 'str', mod: 1, type: 'A', natural: true, builtin: true, quirk: '1 BP to grow', notes: 'Protean 2. Costs 1 blood, one turn to grow.' },
  { id: 'bone_spurs', name: 'Bone Spurs', kind: 'brawl', base: 'str', mod: 1, type: 'L', builtin: true, quirk: 'Vicissitude', notes: 'Vicissitude Bonecraft weapon.' },
  { id: 'lupine_claws', short: 'Claws', name: 'Lupine Claws', kind: 'brawl', base: 'str', mod: 1, type: 'A', natural: true, builtin: true, notes: 'Werewolf claws.' },
  { id: 'lupine_bite', short: 'Bite', name: 'Lupine Bite', kind: 'brawl', base: 'str', mod: 1, type: 'A', natural: true, acc: 1, builtin: true, quirk: 'needs grapple', notes: 'Bite maneuver: requires a successful clinch, hold or tackle on the previous turn (that is where the +1 accuracy comes from).' },

  // Melee Weapons Chart
  { id: 'sap', name: 'Sap', kind: 'melee', base: 'str', mod: 1, type: 'blunt', conceal: 'P', builtin: true, quirk: 'lethal to head' },
  { id: 'club', name: 'Club', kind: 'melee', base: 'str', mod: 2, type: 'blunt', conceal: 'T', builtin: true, quirk: 'lethal to head' },
  { id: 'knife', name: 'Knife', kind: 'melee', base: 'str', mod: 1, type: 'L', conceal: 'J', builtin: true },
  { id: 'sword', name: 'Sword', kind: 'melee', base: 'str', mod: 2, type: 'L', conceal: 'T', builtin: true },
  { id: 'axe', name: 'Axe', kind: 'melee', base: 'str', mod: 3, type: 'L', conceal: 'N', builtin: true },
  { id: 'stake', name: 'Stake', kind: 'melee', base: 'str', mod: 1, type: 'L', conceal: 'T', stake: true, builtin: true, quirk: 'heart: stakes', notes: 'Target heart (diff 9) + 3 levels after soak = staked.' },
  { id: 'sword_cane', name: 'Sword-cane', kind: 'melee', base: 'str', mod: 2, type: 'L', conceal: 'T', builtin: true, quirk: 'concealed', notes: 'Uses Sword stats.' },
  { id: 'propane_torch', short: 'Torch', name: 'Propane Torch', kind: 'melee', base: 'fixed', mod: 1, type: 'fire', fireLevels: 1, heat: 7, builtin: true, quirk: 'fire · no armor', notes: 'Fire: 1 automatic aggravated level/turn, ignores armor, Fortitude soak diff 7.' },

  // Ranged Weapons Chart
  { id: 'revolver_lt', short: 'Lt. revolver', name: 'Revolver, Lt. (.38)', kind: 'ranged', base: 'fixed', mod: 4, type: 'gun', range: 12, rate: 3, clip: 6, conceal: 'P', builtin: true },
  { id: 'revolver_hvy', short: 'Hvy. revolver', name: 'Revolver, Hvy. (.44 Mag)', kind: 'ranged', base: 'fixed', mod: 6, type: 'gun', range: 35, rate: 2, clip: 6, conceal: 'J', builtin: true },
  { id: 'pistol_lt', short: 'Lt. pistol', name: 'Pistol, Lt. (Glock 17)', kind: 'ranged', base: 'fixed', mod: 4, type: 'gun', range: 20, rate: 4, clip: 18, conceal: 'P', builtin: true },
  { id: 'pistol_hvy', short: 'Hvy. pistol', name: 'Pistol, Hvy. (Sig P220)', kind: 'ranged', base: 'fixed', mod: 5, type: 'gun', range: 30, rate: 3, clip: 8, conceal: 'J', builtin: true },
  { id: 'rifle', short: 'Rifle', name: 'Rifle (Remington M-700)', kind: 'ranged', base: 'fixed', mod: 8, type: 'gun', range: 200, rate: 1, clip: 6, conceal: 'N', builtin: true },
  { id: 'smg_small', short: 'Small SMG', name: 'SMG, Small (Mac-10)', kind: 'ranged', base: 'fixed', mod: 4, type: 'gun', range: 25, rate: 3, clip: 31, conceal: 'J', burst: true, builtin: true, quirk: 'burst / auto' },
  { id: 'smg_large', short: 'Large SMG', name: 'SMG, Large (Uzi)', kind: 'ranged', base: 'fixed', mod: 4, type: 'gun', range: 50, rate: 3, clip: 33, conceal: 'T', burst: true, builtin: true, quirk: 'burst / auto' },
  { id: 'assault_rifle', short: 'Assault rifle', name: 'Assault Rifle (Steyr-Aug)', kind: 'ranged', base: 'fixed', mod: 7, type: 'gun', range: 150, rate: 3, clip: 43, conceal: 'N', burst: true, builtin: true, quirk: 'burst / auto' },
  { id: 'shotgun', short: 'Shotgun', name: 'Shotgun (Ithaca M-37)', kind: 'ranged', base: 'fixed', mod: 8, type: 'gun', range: 20, rate: 1, clip: 6, conceal: 'T', builtin: true },
  { id: 'shotgun_semi', short: 'Semi-auto shotgun', name: 'Shotgun, Semi-auto', kind: 'ranged', base: 'fixed', mod: 8, type: 'gun', range: 20, rate: 3, clip: 9, conceal: 'T', builtin: true },
  { id: 'crossbow', name: 'Crossbow', kind: 'ranged', base: 'fixed', mod: 5, type: 'gun', range: 20, rate: 1, clip: 1, conceal: 'T', stake: true, reload: 5, builtin: true, quirk: 'stakes · 5-turn reload', notes: 'Five turns to reload. Bashing vs Kindred unless head/heart.' },

  // Improvised weapons (Wakeners gear) — each uses the stats of the chart weapon it is "as"
  { id: 'box_cutter', name: 'Box Cutter', kind: 'melee', base: 'str', mod: 1, type: 'L', conceal: 'P', builtin: true, source: 'Wakeners', notes: 'As knife.' },
  { id: 'straight_razor', name: 'Straight Razor', kind: 'melee', base: 'str', mod: 1, type: 'L', conceal: 'P', builtin: true, source: 'Wakeners', notes: 'As knife.' },
  { id: 'tire_iron', name: 'Tire Iron', kind: 'melee', base: 'str', mod: 2, type: 'blunt', conceal: 'T', builtin: true, source: 'Wakeners', quirk: 'lethal to head', notes: 'As club.' },
  { id: 'baseball_bat', name: 'Baseball Bat', kind: 'melee', base: 'str', mod: 2, type: 'blunt', conceal: 'T', builtin: true, source: 'Wakeners', quirk: 'lethal to head', notes: 'As club.' },
  { id: 'fire_axe', name: 'Fire Axe', kind: 'melee', base: 'str', mod: 3, type: 'L', conceal: 'N', builtin: true, source: 'Wakeners', notes: 'As axe.' },
  { id: 'road_flare', short: 'Flare', name: 'Road Flare', kind: 'melee', base: 'fixed', mod: 1, type: 'fire', fireLevels: 1, heat: 5, builtin: true, source: 'Wakeners', quirk: 'fire · no armor', notes: 'Fire the size of a torch: 1 automatic aggravated level per turn, soaked only with Fortitude at difficulty 5.' },

  // Homebrew additions — not in the core charts; stats follow the rulebook's scale
  // (knife Str+1, sword Str+2, axe Str+3; firearm damage by calibre).
  { id: 'katana', name: 'Katana', kind: 'melee', base: 'str', mod: 2, type: 'L', conceal: 'T', homebrew: true, quirk: 'parry +1 die', notes: 'A sword. The balanced blade gives +1 die when parrying.' },
  { id: 'machete', name: 'Machete', kind: 'melee', base: 'str', mod: 2, type: 'L', conceal: 'T', homebrew: true, notes: 'As sword; cheap and common.' },
  { id: 'switchblade', name: 'Switchblade', kind: 'melee', base: 'str', mod: 1, type: 'L', conceal: 'P', homebrew: true, notes: 'As knife, pocket-sized.' },
  { id: 'broken_bottle', name: 'Broken Bottle', kind: 'melee', base: 'str', mod: 1, type: 'L', conceal: 'P', homebrew: true, quirk: 'improvised', notes: 'Improvised; shatters for good on a botch.' },
  { id: 'silver_knife', name: 'Silver Knife', kind: 'melee', base: 'str', mod: 1, type: 'L', conceal: 'J', silver: true, homebrew: true, quirk: 'silver', notes: 'Werewolves cannot soak silver and cannot regenerate it quickly.' },
  { id: 'brass_knuckles', short: 'Knuckles', name: 'Brass Knuckles', kind: 'brawl', base: 'str', mod: 1, type: 'B', conceal: 'P', homebrew: true, quirk: 'uses Brawl', notes: 'Punches for Strength +1 bashing; rolls Dexterity + Brawl.' },
  { id: 'crowbar', name: 'Crowbar', kind: 'melee', base: 'str', mod: 2, type: 'blunt', conceal: 'T', homebrew: true, quirk: 'lethal to head', notes: 'As club; also opens doors and crates.' },
  { id: 'chain', name: 'Chain', kind: 'melee', base: 'str', mod: 1, type: 'blunt', conceal: 'J', homebrew: true, quirk: 'sweep / disarm', notes: 'Suited to the Sweep and Disarm maneuvers.' },
  { id: 'staff', name: 'Staff', kind: 'melee', base: 'str', mod: 1, type: 'blunt', conceal: 'N', homebrew: true, quirk: 'reach · sweep', notes: 'Longer weapon: a fist or knife fighter must close in and loses a die. Suited to Sweep.' },
  { id: 'spear', name: 'Spear', kind: 'melee', base: 'str', mod: 2, type: 'L', conceal: 'N', stake: true, homebrew: true, quirk: 'reach · stakes', notes: 'Longer weapon (a fist or knife fighter loses a die closing in). A wooden spear through the heart stakes like a stake.' },
  { id: 'sledgehammer', short: 'Sledge', name: 'Sledgehammer', kind: 'melee', base: 'str', mod: 3, type: 'blunt', conceal: 'N', diffMod: 1, homebrew: true, quirk: 'two-handed · diff +1', notes: 'Heavy and slow: +1 difficulty to hit. Lethal if aimed at the head.' },
  { id: 'chainsaw', name: 'Chainsaw', kind: 'melee', base: 'fixed', mod: 7, type: 'L', conceal: 'N', diffMod: 1, homebrew: true, quirk: 'loud · diff +1', notes: 'Two-handed and deafening: +1 difficulty. Damage comes from the engine, so Strength and Potence do not add.' },

  { id: 'holdout', short: 'Hold-out .22', name: 'Hold-out Pistol (.22)', kind: 'ranged', base: 'fixed', mod: 3, type: 'gun', range: 10, rate: 3, clip: 6, conceal: 'P', homebrew: true, quirk: 'hides anywhere', notes: 'Tiny and weak; fits in a sock or a sleeve.' },
  { id: 'deagle', short: 'Desert Eagle', name: 'Pistol, Hvy. (Desert Eagle .50)', kind: 'ranged', base: 'fixed', mod: 6, type: 'gun', range: 30, rate: 2, clip: 8, conceal: 'J', homebrew: true, quirk: 'loud · rate 2', notes: 'Hand cannon: hits like a .44 Magnum, kicks too hard for more than two shots a turn.' },
  { id: 'sawed_off', short: 'Sawed-off', name: 'Sawed-off Shotgun', kind: 'ranged', base: 'fixed', mod: 8, type: 'gun', range: 10, rate: 2, clip: 2, conceal: 'J', homebrew: true, quirk: 'both barrels', notes: 'Fits under a jacket. Both barrels can go in one turn (multiple shots), but range is only 10 yards.' },
  { id: 'ak47', short: 'AK-47', name: 'Assault Rifle (AK-47)', kind: 'ranged', base: 'fixed', mod: 7, type: 'gun', range: 100, rate: 3, clip: 31, conceal: 'N', burst: true, homebrew: true, quirk: 'burst / auto', notes: 'Damage from the rulebook\'s automatic-fire example; range and clip are homebrew.' },
  { id: 'compound_bow', short: 'Bow', name: 'Compound Bow', kind: 'ranged', base: 'fixed', mod: 4, type: 'gun', range: 40, rate: 1, clip: 1, conceal: 'N', stake: true, homebrew: true, quirk: 'silent · stakes', notes: 'Silent. Like the crossbow: bashing vs Kindred unless aimed at the head or heart; a wooden arrow through the heart stakes.' },
  { id: 'flare_gun', short: 'Flare gun', name: 'Flare Gun', kind: 'ranged', base: 'fixed', mod: 1, type: 'fire', fireLevels: 1, heat: 7, range: 30, rate: 1, clip: 1, conceal: 'J', homebrew: true, quirk: 'fire · 1 shot', notes: 'A burning flare: 1 automatic aggravated level, Fortitude soak at difficulty 7. Reload takes a turn.' },
  { id: 'taser', name: 'Taser', kind: 'ranged', base: 'fixed', mod: 4, type: 'B', range: 5, rate: 1, clip: 1, conceal: 'P', homebrew: true, quirk: 'stuns mortals', notes: 'Mortals and ghouls who take damage are stunned and lose their next turn. Vampires only take the bashing.' },
  { id: 'thrown_knife', short: 'Thrown knife', name: 'Throwing Knife', kind: 'thrown', base: 'str', mod: 0, type: 'L', range: 10, conceal: 'P', homebrew: true, quirk: 'Dex + Athletics', notes: 'Thrown with Dexterity + Athletics for Strength lethal; about 10 yards.' },
  { id: 'molotov', name: 'Molotov Cocktail', kind: 'thrown', base: 'fixed', mod: 2, type: 'fire', fireLevels: 2, heat: 7, range: 10, conceal: 'J', homebrew: true, quirk: 'fire · single use', notes: 'Burning fuel on half the body: 2 automatic aggravated levels per turn while it burns, Fortitude soak at difficulty 7. One use — drop it from the loadout afterwards.' },

  // Bestiary natural attacks (fixed dice, lethal)
  { id: 'wolf_bite', short: 'Bite & Claw', name: 'Wolf Bite & Claw', kind: 'brawl', base: 'fixed', mod: 4, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'dog_bite', short: 'Bite', name: 'Dog Bite', kind: 'brawl', base: 'fixed', mod: 5, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'dog_claw', short: 'Claw', name: 'Dog Claw', kind: 'brawl', base: 'fixed', mod: 4, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'bear_claw', short: 'Claw', name: 'Bear Claw', kind: 'brawl', base: 'fixed', mod: 7, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'bear_bite', short: 'Bite', name: 'Bear Bite', kind: 'brawl', base: 'fixed', mod: 5, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'cat_claw', short: 'Claw', name: 'Big Cat Claw', kind: 'brawl', base: 'fixed', mod: 4, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'cat_bite', short: 'Bite', name: 'Big Cat Bite', kind: 'brawl', base: 'fixed', mod: 5, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'gator_bite', short: 'Bite', name: 'Alligator Bite', kind: 'brawl', base: 'fixed', mod: 7, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'gator_tail', short: 'Tail Slap', name: 'Alligator Tail Slap', kind: 'brawl', base: 'fixed', mod: 6, type: 'B', builtin: true, quirk: 'bashing', beast: true },
];

/* Catalog categories, in display order. */
const WEAPON_GROUPS = [
  { id: 'blade', label: 'Melee — blades' },
  { id: 'blunt', label: 'Melee — blunt' },
  { id: 'natural', label: 'Natural & brawl' },
  { id: 'fire', label: 'Fire' },
  { id: 'pistol', label: 'Pistols & revolvers', ranged: true },
  { id: 'shotgun', label: 'Shotguns', ranged: true },
  { id: 'rifle', label: 'Rifles', ranged: true },
  { id: 'auto', label: 'Submachine guns & assault rifles', ranged: true },
  { id: 'bow', label: 'Bows & crossbows', ranged: true },
  { id: 'special', label: 'Special', ranged: true },
  { id: 'thrown', label: 'Thrown', ranged: true },
  { id: 'beast', label: 'Animal attacks' },
  { id: 'other', label: 'Other' },
];
function weaponGroup(w) {
  const id = w.id;
  if (w.beast) return 'beast';
  if (w.kind === 'thrown') return 'thrown';
  if (w.type === 'fire') return w.kind === 'ranged' ? 'special' : 'fire';
  if (w.kind === 'brawl') return 'natural';
  if (w.kind === 'melee') return w.type === 'blunt' || w.type === 'B' ? 'blunt' : 'blade';
  if (w.kind === 'ranged') {
    if (w.burst) return 'auto';
    if (/shotgun|sawed/.test(id)) return 'shotgun';
    if (/bow/.test(id)) return 'bow';
    if (/pistol|revolver|holdout|deagle/.test(id)) return 'pistol';
    if (/rifle/.test(id)) return 'rifle';
    return w.type === 'gun' ? 'pistol' : 'special';
  }
  return 'other';
}

/* Maneuvers. trait: [attribute, ability]. dmg: 'weapon' | {base:'str', mod} | 'none' | 'special' */
const MANEUVERS = {
  brawl: [
    { id: 'strike', name: 'Strike', trait: ['dex', 'brawl'], acc: 0, diff: 0, dmg: 'weapon' },
    { id: 'kick', name: 'Kick', trait: ['dex', 'brawl'], acc: 0, diff: 1, dmg: { base: 'str', mod: 1 }, unarmedOnly: true },
    { id: 'clinch', name: 'Clinch (C)', trait: ['str', 'brawl'], acc: 0, diff: 0, dmg: { base: 'str', mod: 0 }, unarmedOnly: true, note: 'Carries over; Str damage each turn. Escape: resisted Str + Brawl.' },
    { id: 'hold', name: 'Hold (C)', trait: ['str', 'brawl'], acc: 0, diff: 0, dmg: 'none', unarmedOnly: true, note: 'No damage; target immobilized until it wins a resisted Str + Brawl.' },
    { id: 'tackle', name: 'Tackle (K)', trait: ['str', 'brawl'], acc: 0, diff: 1, dmg: { base: 'str', mod: 1 }, unarmedOnly: true, note: 'Both roll Dex + Athletics (diff 7) or knockdown. Target +1 diff next turn.' },
    { id: 'sweep', name: 'Sweep (K)', trait: ['dex', 'brawl'], acc: 0, diff: 1, dmg: { base: 'str', mod: 0 }, unarmedOnly: true, note: 'Target rolls Dex + Athletics (diff 8) or knockdown.' },
    { id: 'bite', name: 'Bite (A)', trait: ['dex', 'brawl'], acc: 1, diff: 0, dmg: { base: 'str', mod: 1, type: 'A', natural: true }, unarmedOnly: true, fangs: true, note: 'Requires a successful clinch, hold or tackle the previous turn.' },
  ],
  melee: [
    { id: 'wstrike', name: 'Weapon Strike', trait: ['dex', 'melee'], acc: 0, diff: 0, dmg: 'weapon' },
    { id: 'disarm', name: 'Disarm', trait: ['dex', 'melee'], acc: 0, diff: 1, dmg: 'weapon', note: 'If damage successes exceed target Strength: no damage, target disarmed.' },
    { id: 'msweep', name: 'Sweep (K)', trait: ['dex', 'melee'], acc: 0, diff: 1, dmg: 'weapon', note: 'Staff/chain. Target rolls Dex + Athletics (diff 8) or knockdown.' },
  ],
  ranged: [
    { id: 'shot', name: 'Single Shot', trait: ['dex', 'firearms'], acc: 0, diff: 0, dmg: 'weapon', ammo: 1 },
    { id: 'burst', name: '3-Round Burst', trait: ['dex', 'firearms'], acc: 2, diff: 1, dmg: 'weapon', ammo: 3, needs: 'burst' },
    { id: 'auto', name: 'Automatic Fire', trait: ['dex', 'firearms'], acc: 10, diff: 2, dmg: 'weapon', ammo: 'all', needs: 'burst', noTargeting: true, note: 'Empties clip; clip must be at least half full.' },
    { id: 'strafe', name: 'Strafing', trait: ['dex', 'firearms'], acc: 10, diff: 2, dmg: 'weapon', ammo: 'all', needs: 'burst', note: 'Divide successes among targets in 3 yards (single target gets half). Dodge +1 diff.' },
  ],
  thrown: [
    { id: 'throw', name: 'Throw', trait: ['dex', 'athletics'], acc: 0, diff: 0, dmg: 'weapon' },
  ],
};

const TARGETING = [
  { id: 'none', name: 'No target', diff: 0, dmg: 0 },
  { id: 'medium', name: 'Medium (limb)', diff: 1, dmg: 0 },
  { id: 'small', name: 'Small (hand, head)', diff: 2, dmg: 1, head: true },
  { id: 'precise', name: 'Precise (eye, heart)', diff: 3, dmg: 2, head: true },
];

const RANGES = [
  { id: 'pb', name: 'Point blank (≤2 m)', diff: 4 },
  { id: 'short', name: 'Short range', diff: 6 },
  { id: 'long', name: 'Long range (≤2× range)', diff: 8 },
];

const COVER = [
  { id: 0, name: 'No cover', diff: 0 },
  { id: 1, name: 'Light (prone)', diff: 1 },
  { id: 2, name: 'Good (behind wall)', diff: 2 },
  { id: 3, name: 'Superior (head only)', diff: 3 },
];

const STATUSES = [
  { id: 'delayed', label: 'Delaying', tip: 'Delaying action: may act any time later in the turn, even interrupting slower characters.' },
  { id: 'defending', label: 'Full defense', tip: 'Spending the whole turn defending: full pool on first defense, -1 die cumulative per additional defense.' },
  { id: 'knockdown', label: 'Knocked down', tip: 'Dex + Athletics to rise: success = up but -2 initiative next turn; failure = spend next action rising. Applies -2 at next initiative roll.' },
  { id: 'dazed', label: 'Dazed', tip: 'Must spend next available turn shaking off the attack.' },
  { id: 'clinched', label: 'Clinch/Held', tip: 'Grappled. Escape with a resisted Strength + Brawl roll.' },
  { id: 'immobilized', label: 'Immobilized', tip: '+2 dice to attacks against a struggling target; automatic hits if fully immobilized.' },
  { id: 'blinded', label: 'Blinded', tip: '+2 difficulty on all actions; attackers gain +2 dice.' },
  { id: 'staked', label: 'Staked', tip: 'Paralysed until the stake is removed. Conscious, may use Auspex, cannot move or spend blood.' },
  { id: 'frenzy', label: 'Frenzy', tip: 'Frenzied: ignores wound penalties (werewolves in killing rage, vampires in frenzy).' },
  { id: 'wpIgnore', label: 'WP: ignore wounds', tip: 'Spent a Willpower point to ignore wound penalties this turn.' },
  { id: 'battleForm', label: 'Battle form', tip: 'Werewolf "wolfman" form: Physical Attributes doubled.', kinds: ['werewolf'] },
];

/* Preset antagonists — Chapter Nine.
 * a: [Str, Dex, Sta, Cha, Man, App, Per, Int, Wit]
 * weapons: carried at the start of a fight. favored: other weapons that suit the preset;
 * they head the swap dropdowns on the card, marked with *. */
const PRESETS = [
  // Wakeners (campaign antagonists). a: [Str, Dex, Sta, Cha, Man, App, Per, Int, Wit]
  { id: 'wk_singer', name: 'Thin-Blood Singer', cat: 'Wakeners', kind: 'vampire', gen: '14–15', humanity: '6',
    a: [2, 2, 2, 2, 2, 2, 2, 2, 3],
    abil: 'Alertness 2, Athletics 1, Brawl 1, Dodge 2, Empathy 1, Expression 2, Occult 1, Performance 4, Stealth 2, Streetwise 2',
    disc: 'Obfuscate 1', wp: 6, bp: 8, weapons: [], favored: ['box_cutter'],
    notes: 'Thin blood: pool 10, only 8 usable, every blood cost doubled (Mend = 2 BP). Virtues: Conscience 3, Self-Control 3, Courage 4. The Chant: singing is their action; a live voice triggers the Dread in every non-thin-blood Kindred in earshot (3+ Singers together = strongest form). Keeps singing while hurt; only Incapacitation, torpor or destruction stops the voice. Gutter-proof: no roll for the Dread. Cannot blood bond; Embrace succeeds 1 in 5. Disciplines: none, or one dot (Obfuscate 1 common). Gear: the choir (just a voice, candle, Chant cassette) · the street (box cutter, Walkman) · the raid (boombox or venue sound system; nothing to defend themselves with, on purpose).' },
  { id: 'wk_recruiter', name: 'Thin-Blood Recruiter', cat: 'Wakeners', kind: 'vampire', gen: '14–15', humanity: '7',
    a: [2, 2, 2, 3, 3, 3, 3, 2, 3],
    abil: 'Alertness 2, Dodge 1, Empathy 3, Expression 2, Leadership 1, Occult 1, Performance 2, Streetwise 3, Subterfuge 3',
    disc: 'Presence 1', wp: 6, bp: 8, weapons: [], favored: ['revolver_lt'],
    notes: 'Thin blood: pool 10, only 8 usable, every blood cost doubled. Virtues: Conscience 3, Self-Control 3, Courage 3. The pitch: Charisma + Empathy, diff 6 (5 vs thin-bloods, Caitiff, discarded ghouls) to make a lonely listener feel seen. Not a power. Reports everything: any stranger asking about the preacher reaches a lieutenant within a night. Gutter-proof and thin blood, as the Singer. Presence 1 or none. Gear: the mission (flyers, meal cards, tapes) · just in case (light revolver, never fired) · the list (pager, notebook of names and havens).' },
  { id: 'wk_faithful', name: 'Caitiff Faithful', cat: 'Wakeners', kind: 'vampire', gen: '13', humanity: '5',
    a: [3, 2, 3, 2, 2, 1, 2, 2, 2],
    abil: 'Alertness 2, Athletics 2, Brawl 3, Dodge 2, Drive 1, Firearms 1, Intimidation 2, Melee 2, Performance 1, Stealth 2, Streetwise 3',
    disc: 'Potence 1, Fortitude 1, Celerity 1', wp: 5, bp: 10, weapons: ['tire_iron', 'knife'], favored: ['revolver_lt', 'pistol_lt', 'stake', 'road_flare', 'crowbar', 'molotov'],
    notes: 'The Bound majority: muscle, carriers, bodies in the way. Virtues: Conscience 2, Self-Control 3, Courage 4. Blood 1 per turn. Of the line: most are Bound, Stage Four; when the call comes they go north. Used to the Chant: roll for the Dread like any Kindred, but have sat through it a hundred times. Alt Disciplines: Obfuscate 2, Potence 1. Gear: the street (tire iron, knife) · the armed cell (one gun between them: light revolver or light pistol) · the hunter\'s kit (wooden stake, road flare).' },
  { id: 'wk_lieutenant', name: 'Lieutenant', cat: 'Wakeners', kind: 'vampire', gen: '12', humanity: '5',
    a: [3, 3, 3, 3, 3, 2, 3, 3, 3],
    abil: 'Alertness 3, Athletics 2, Brawl 3, Dodge 3, Expression 3, Firearms 2, Intimidation 3, Leadership 3, Melee 3, Occult 2, Performance 4, Stealth 3, Streetwise 4, Subterfuge 3',
    disc: 'Potence 2, Celerity 1, Obfuscate 2, Presence 1', wp: 7, bp: 11, weapons: ['fire_axe'], favored: ['pistol_hvy'],
    notes: 'Holds the Chant for a borough; the one the coterie should learn by name. 12th-gen Caitiff. Virtues: Conscience 2, Self-Control 4, Courage 5. Blood 1 per turn. Choirmaster: while with the choir, every Singer ignores wound penalties without spending Willpower. Knows one name above, never the Prophet\'s haven. Recurring: the cell spends itself to get them out of the first two fights; make the third count. Gear: the axe (fire axe) · the cop\'s kit (heavy pistol + Kevlar vest, armor 3: set Armor on the card) · the master (master tape, dubbing deck, keys to dead stations).' },
  { id: 'wk_choirmaster', name: 'Thin-Blood Choirmaster', cat: 'Wakeners', kind: 'vampire', gen: '14–15', humanity: '5',
    a: [3, 3, 3, 3, 3, 2, 3, 3, 3],
    abil: 'Alertness 3, Athletics 2, Brawl 3, Dodge 3, Expression 3, Firearms 2, Intimidation 3, Leadership 3, Melee 3, Occult 2, Performance 4, Stealth 3, Streetwise 4, Subterfuge 3',
    disc: 'Presence 1, Obfuscate 1', wp: 7, bp: 8, weapons: ['fire_axe'], favored: ['pistol_hvy'],
    notes: 'The Lieutenant as a thin-blood choirmaster (e.g. Brother Calloway): Presence 1, Obfuscate 1 and nothing else. Thin blood: pool 10, only 8 usable, every blood cost doubled. Choirmaster: while with the choir, every Singer ignores wound penalties without spending Willpower. Knows one name above. Recurring, as the Lieutenant.' },
  { id: 'wk_fallen', name: 'The Fallen', cat: 'Wakeners', kind: 'vampire', gen: '10–11', humanity: '4',
    a: [3, 3, 3, 3, 4, 3, 3, 3, 3],
    abil: 'Alertness 3, Brawl 3, Dodge 3, Etiquette 3, Expression 2, Firearms 2, Intimidation 3, Leadership 2, Melee 3, Occult 2, Politics 2, Streetwise 2, Subterfuge 4',
    disc: '', wp: 7, bp: 12, weapons: ['straight_razor', 'revolver_hvy'],
    notes: 'An ancilla of the King\'s clan who fell far enough that nobody noticed. Rare: one in all of Chapter One is plenty. DISCIPLINES: the King\'s clan Disciplines at 3, 2 and 2 plus one other at 1 — set them with Edit once the clan is chosen. Virtues: Conscience 2, Self-Control 3, Courage 4. Blood pool 12–13, 1 per turn. Far gone: Bound at Stage Four and articulate about it; knows the Court\'s etiquette, faces and havens. A clue in a coat for the single-clan pattern. Gear: old habits (straight razor, heavy revolver not cleaned since the seventies) · old keys · the clan\'s tools.' },
  { id: 'wk_discarded', name: 'Discarded Ghoul', cat: 'Wakeners', kind: 'ghoul', humanity: '6',
    a: [2, 2, 2, 2, 2, 2, 2, 2, 2],
    abil: 'Alertness 2, Brawl 2, Dodge 1, Drive 1, Streetwise 2, Subterfuge 2, Crafts 3',
    disc: 'Potence 1', wp: 3, bp: 2, weapons: ['knife'], favored: ['baseball_bat'],
    notes: 'Cut off by a domitor, fed and collected by the cult, terrified of both (e.g. Eddie Quinn). Old-job skill at 3: Crafts shown; swap for Etiquette, Finance, etc. with Edit. Vitae 1–2 when fed. Withdrawal: a week without vitae = −1 die to everything. Frenzy difficulties two lower than a vampire\'s. Past their lifespan they age to death within days without vitae. Will trade what they know for a mouthful of vitae. Gear: nothing (kitchen knife) · old keys · scared (baseball bat).' },
  { id: 'wk_driver', name: 'Driver and Handler', cat: 'Wakeners', kind: 'ghoul', humanity: '4',
    a: [3, 3, 3, 2, 3, 2, 3, 2, 3],
    abil: 'Alertness 3, Athletics 2, Brawl 3, Dodge 2, Drive 4, Firearms 2, Melee 2, Security 2, Stealth 2, Streetwise 3, Subterfuge 2, Survival 1',
    disc: 'Potence 1, Fortitude 1', wp: 5, bp: 2, weapons: ['sap', 'pistol_lt'],
    notes: 'Serves a Bound Kindred; the daylight work: rented rooms, vans, abductions off the interstate. Daylight: moves the Bound by day in blacked-out box vans, mileage log to the tenth of a mile. Abductions: works from behind (core Ambush rules) with a sap, duct tape and an open van door. Gear: the abduction kit (sap, zip ties, box van) · armed (light pistol) · the Gathering run (cots, blackout film, road atlas with Broken Arrow circled; finding one is a Chapter Three seed).' },
  { id: 'wk_exmil', name: 'Ex-Military Ghoul', cat: 'Wakeners', kind: 'ghoul', humanity: '5',
    a: [3, 3, 3, 2, 2, 2, 3, 2, 3],
    abil: 'Alertness 3, Athletics 2, Brawl 3, Dodge 3, Drive 3, Firearms 4, Intimidation 2, Leadership 1, Medicine 1, Melee 2, Stealth 3, Survival 3',
    disc: 'Potence 1, Fortitude 1', wp: 6, bp: 2, weapons: ['pistol_lt', 'knife'], favored: ['rifle', 'shotgun', 'road_flare'],
    notes: 'Chapter Two\'s ambush: trained and short of everything. Leadership 3 for the team leader. Trained: the only Wakeners who fight as a unit — they flank (+1 die), take rear attacks (+2 dice) and set real ambushes. Under-resourced: every good van and able body is committed to the Gathering. Gear: the good rifle (one per team, scoped: tick Scope in the attack dialog) · the roadblock (shotgun, road flare, spike strip, pickup) · what could be spared (light pistol, hunting knife; one Kevlar vest, armor 3, for the whole team).' },
  // Witch-Hunters
  { id: 'inquisitor', name: 'Inquisitor', cat: 'Witch-Hunters', kind: 'mortal',
    a: [2, 3, 3, 4, 3, 2, 3, 3, 3],
    abil: 'Alertness 2, Brawl 2, Dodge 2, Drive 1, Expression 2, Leadership 3, Melee (sword-cane) 3, Occult 3, Stealth 2, Theology 3',
    wp: 9, humanity: '5–10', weapons: ['sword_cane', 'stake'], favored: ['propane_torch', 'crossbow', 'pistol_lt', 'flare_gun', 'compound_bow'],
    notes: 'Equipment: rosaries, crucifix, Bible. A few have True Faith 1+ (usually Humanity 9+).' },
  { id: 'gov_agent', name: 'Government Agent', cat: 'Witch-Hunters', kind: 'mortal',
    a: [3, 2, 3, 2, 3, 2, 3, 3, 3],
    abil: 'Alertness 3, Athletics 2, Brawl 3, Computer 1, Dodge 3, Drive 3, Firearms 3, Investigation 4, Melee 2, Occult 1, Politics 2, Stealth 2',
    wp: 7, humanity: '6–8', weapons: ['pistol_hvy'], favored: ['club', 'knife', 'shotgun', 'pistol_lt'],
    notes: 'Black suit, cool sunglasses, badge and ID, electronic surveillance devices.' },
  { id: 'arcanum', name: 'Arcanum Scholar', cat: 'Witch-Hunters', kind: 'mortal',
    a: [2, 2, 2, 2, 2, 2, 4, 4, 3],
    abil: 'Academics 4, Computer 3, Dodge 1, Drive 1, Etiquette 2, Expression 2, Investigation 3, Linguistics 2, Melee 1, Occult 4, Science 3',
    wp: 7, humanity: '8', weapons: [], favored: ['knife', 'revolver_lt'],
    notes: 'Laptop, extensive library, sedan, occult paraphernalia, sizable bank account. Not a fighter.' },
  { id: 'enforcer', name: 'Criminal Enforcer', cat: 'Witch-Hunters', kind: 'mortal',
    a: [4, 3, 3, 3, 4, 1, 2, 2, 3],
    abil: 'Alertness 2, Athletics 1, Brawl 3, Dodge 3, Drive 2, Finance 2, Firearms 3, Melee 2, Security 3, Stealth 2, Streetwise 3, Subterfuge 2',
    wp: 6, humanity: '6 (often lower)', weapons: ['smg_small', 'knife'], favored: ['club', 'pistol_hvy', 'shotgun', 'sawed_off', 'brass_knuckles'], armor: 3,
    notes: 'Bulletproof vest, midsized car. A tough, savvy member of the underworld.' },
  { id: 'thug', name: 'Street Thug (Extra)', cat: 'Witch-Hunters', kind: 'mortal', health: 'extra',
    a: [3, 2, 2, 2, 2, 2, 2, 2, 2],
    abil: 'Alertness 1, Brawl 2, Dodge 1, Firearms 1, Melee 2, Streetwise 2, Intimidation 2',
    wp: 3, humanity: '6', weapons: ['knife', 'pistol_lt'], favored: ['club', 'sap', 'revolver_lt', 'brass_knuckles', 'switchblade', 'broken_bottle'],
    notes: 'Derived from the Criminal template ("typical thugs ... much less threatening"). Uses the optional Extras health rule.' },

  // Ghouls
  { id: 'valet', name: 'Trusted Valet', cat: 'Ghouls', kind: 'ghoul',
    a: [2, 3, 2, 3, 3, 4, 3, 3, 3],
    abil: 'Academics 2, Alertness 2, Computer 1, Crafts 2, Dodge 2, Drive 2, Empathy 3, Etiquette 4, Finance 2, Firearms 2, Leadership 2, Linguistics 1, Medicine 2, Melee 2, Occult 1, Subterfuge 3',
    disc: 'Potence 1', wp: 4, bp: 10, humanity: '7', weapons: ['pistol_lt', 'knife'], favored: ['sword_cane', 'pistol_hvy'],
    notes: 'Possibly one other Discipline at 1. Soaks lethal while vitae in system; does not halve bashing.' },
  { id: 'bodyguard', name: 'Ghoul Bodyguard', cat: 'Ghouls', kind: 'ghoul',
    a: [4, 4, 4, 2, 2, 2, 4, 2, 3],
    abil: 'Alertness 4, Athletics 2, Brawl 4, Dodge 3, Drive 2, Firearms 4, Intimidation 3, Investigation 2, Medicine 1, Melee 3, Occult 1, Stealth 3, Streetwise 2',
    disc: 'Fortitude 1, Potence 1', wp: 5, bp: 10, humanity: '5', weapons: ['pistol_hvy', 'club'], favored: ['knife', 'smg_large', 'shotgun'], armor: 2,
    notes: 'Possibly one other Discipline at 1.' },

  // Werewolves
  { id: 'were_young', name: 'Adolescent Werewolf', cat: 'Werewolves', kind: 'werewolf', regen: true,
    a: [3, 3, 3, 2, 2, 2, 3, 2, 3],
    abil: 'Alertness 3, Animal Ken 2, Athletics 2, Brawl 3, Crafts 2, Dodge 2, Firearms 2, Intimidation 3, Investigation 2, Leadership 1, Linguistics 1, Melee 2, Occult 1, Stealth 3, Survival 3',
    disc: 'Celerity 3, Potence 1, Protean 4', wp: 5, humanity: '7', extra: ['Gnosis', 4],
    weapons: ['lupine_claws', 'lupine_bite'],
    notes: 'Attributes are human form; toggle Battle form to double Physical. Regenerates 1 level/turn; silver cannot be soaked or regenerated quickly. Multiple actions like Celerity without blood.' },
  { id: 'were_vet', name: 'Veteran Lupine', cat: 'Werewolves', kind: 'werewolf', regen: true,
    a: [4, 3, 4, 3, 2, 3, 4, 3, 4],
    abil: 'Alertness 3, Animal Ken 3, Athletics 2, Brawl 4, Crafts 2, Dodge 2, Expression 1, Firearms 2, Intimidation 3, Investigation 2, Leadership 1, Linguistics 1, Medicine 1, Melee 3, Occult 3, Stealth 3, Survival 4',
    disc: 'Celerity 4, Potence 2, Protean 4', wp: 7, humanity: '6', extra: ['Gnosis', 6],
    weapons: ['lupine_claws', 'lupine_bite'],
    notes: 'Attributes are human form; toggle Battle form to double Physical. Regenerates 1 level/turn.' },
  { id: 'were_elder', name: 'Elder Shapeshifter', cat: 'Werewolves', kind: 'werewolf', regen: true,
    a: [5, 4, 5, 5, 3, 3, 5, 3, 4],
    abil: 'Alertness 4, Animal Ken 4, Athletics 4, Brawl 5, Crafts 2, Dodge 4, Expression 3, Firearms 2, Intimidation 4, Investigation 2, Leadership 4, Linguistics 1, Medicine 1, Melee 5, Occult 4, Stealth 4, Survival 5',
    disc: 'Celerity 5, Dominate 2, Fortitude 2, Obfuscate 3, Potence 3, Protean 4', wp: 9, humanity: '5', extra: ['Gnosis', 8],
    weapons: ['lupine_claws', 'lupine_bite'],
    notes: 'One other Discipline at 4. Toggle Battle form to double Physical. Regenerates 1 level/turn.' },

  // Magi
  { id: 'cultist', name: 'Young Cultist', cat: 'Magi', kind: 'mage',
    a: [3, 3, 3, 3, 4, 3, 2, 4, 4],
    abil: 'Academics 2, Alertness 3, Athletics 2, Brawl 2, Dodge 2, Drive 2, Empathy 2, Firearms 3, Intimidation 2, Melee 2, Occult 4, Streetwise 3, Subterfuge 3',
    disc: 'Auspex 2, Dominate 2, Presence 1, Protean 1, Thaumaturgy 3', wp: 5, extra: ['Magick pool', 10],
    weapons: ['knife', 'pistol_hvy'], favored: ['pistol_lt', 'revolver_hvy', 'shotgun'],
    notes: 'Mortal: cannot soak lethal/aggravated without magickal armor. Paradox on obvious magick. Kindred with Thaumaturgy may counter with Wits + Occult (diff 6).' },
  { id: 'high_wizard', name: 'High Wizard', cat: 'Magi', kind: 'mage',
    a: [2, 2, 2, 3, 5, 2, 4, 4, 4],
    abil: 'Academics 5, Alertness 3, Dodge 2, Drive 1, Empathy 4, Etiquette 3, Finance 2, Firearms 1, Intimidation 4, Investigation 3, Leadership 2, Linguistics 4, Medicine 2, Occult 5, Subterfuge 3',
    disc: 'Auspex 4, Chimerstry 3, Dominate 2, Fortitude 2, Obfuscate 4, Presence 3, Thaumaturgy 5', wp: 9, extra: ['Magick pool', 12],
    weapons: ['sword_cane'],
    notes: 'Many paths and rituals. Sanctuary, extensive library, ritual instruments.' },
  { id: 'techno', name: 'Technological Abomination', cat: 'Magi', kind: 'mage',
    a: [5, 4, 5, 2, 2, 2, 4, 3, 4],
    abil: 'Alertness 3, Athletics 3, Brawl 3, Computer 4, Crafts 4, Drive 3, Firearms 4, Intimidation 4, Investigation 4, Law 2, Melee 3, Occult 4, Science 3, Security 5, Stealth 2, Streetwise 2',
    disc: 'Auspex 2, Dominate 2, Fortitude 4, Potence 3, Presence 3', wp: 8, extra: ['Blood (poison)', 10],
    weapons: ['assault_rifle'], favored: ['smg_large', 'shotgun', 'pistol_hvy', 'knife'], armor: 4,
    notes: 'Blood is poisonous: one aggravated level per blood point consumed. Body armor, mini-computer, black armored sedan, mirrorshades.' },

  // Faeries
  { id: 'pooka', name: 'Pooka Trickster', cat: 'Faeries', kind: 'faerie',
    a: [2, 5, 2, 4, 5, 2, 3, 2, 2],
    abil: 'Alertness 3, Animal Ken 2, Brawl 3, Dodge 5, Performance 3, Occult 2, Security 2, Stealth 5, Subterfuge 4',
    disc: 'Animalism 2, Auspex 2, Chimerstry 3, Celerity 2, Obfuscate 4, Protean 4', wp: 6, bp: 10, extra: ['Glamour', 6],
    weapons: [], notes: 'Heals as mortal. Soaks lethal; does not halve bashing. Takes aggravated damage only from fire.' },
  { id: 'redcap', name: 'Redcap Warrior', cat: 'Faeries', kind: 'faerie',
    a: [3, 4, 4, 1, 3, 1, 3, 2, 4],
    abil: 'Alertness 3, Athletics 3, Brawl 4, Dodge 2, Intimidation 4, Melee 4, Streetwise 3, Security 2, Stealth 2',
    disc: 'Celerity 3, Fortitude 2, Obfuscate 3, Potence 2', wp: 5, bp: 10, extra: ['Glamour', 5],
    weapons: ['axe'], favored: ['knife', 'club', 'machete', 'chain'], notes: 'Thrives on carnage. Takes aggravated damage only from fire.' },
  { id: 'sidhe', name: 'Sidhe Enchantress', cat: 'Faeries', kind: 'faerie',
    a: [2, 4, 3, 4, 4, 7, 3, 3, 4],
    abil: 'Alertness 2, Athletics 2, Dodge 2, Empathy 3, Etiquette 4, Expression 4, Intimidation 3, Leadership 4, Occult 4, Performance 4, Subterfuge 2',
    disc: 'Celerity 1, Chimerstry 5, Dominate 4, Obfuscate 4, Presence 5', wp: 7, bp: 15, extra: ['Glamour', 10],
    weapons: ['sword'], notes: 'Weaves glamours that leave victims paralysed with fear or awe. Takes aggravated damage only from fire.' },

  // Wraiths (Shadowlands Strength used)
  { id: 'wraith_new', name: 'Recently Deceased', cat: 'Wraiths', kind: 'wraith',
    a: [2, 3, 3, 2, 3, 2, 3, 2, 3],
    abil: 'Academics 1, Alertness 3, Brawl 1, Bureaucracy 2, Computer 2, Dodge 2, Empathy 3, Intimidation 2, Investigation 1, Law 2, Melee 1, Occult 2, Politics 1, Stealth 1, Streetwise 1, Subterfuge 2',
    disc: 'Auspex 1, Chimerstry 1, Dementation 2, Dominate 1, Vicissitude 1', wp: 5, extra: ['Passion', 5],
    weapons: [], notes: 'Strength 0 in the Skinlands / 2 in the Shadowlands (shown). Incorporeal: conventional fights are impossible outside the Shadowlands.' },
  { id: 'spectre', name: 'Spectre', cat: 'Wraiths', kind: 'wraith',
    a: [3, 3, 5, 2, 3, 1, 2, 4, 3],
    abil: 'Alertness 3, Brawl 4, Dodge 4, Intimidation 3, Melee 3, Occult 2, Stealth 2, Streetwise 3, Subterfuge 3',
    disc: 'Auspex 2, Chimerstry 4, Dementation 4, Obfuscate 2, Obtenebration 3, Presence 2, Protean 2, Vicissitude 4', wp: 7, extra: ['Passion', 9],
    weapons: [], notes: 'Strength 0 / 3 (Shadowlands shown). If one requires aid, at least three more answer.' },
  { id: 'old_soul', name: 'Old Soul', cat: 'Wraiths', kind: 'wraith',
    a: [4, 5, 5, 3, 4, 1, 5, 3, 3],
    abil: 'Academics 2, Alertness 3, Brawl 2, Bureaucracy 4, Computer 3, Dodge 3, Empathy 3, Intimidation 3, Investigation 1, Law 2, Linguistics 1, Melee 2, Occult 2, Politics 1, Stealth 3, Streetwise 1, Subterfuge 3',
    disc: 'Auspex 2, Chimerstry 1, Dementation 4, Dominate 3, Presence 2, Thaumaturgy 3, Vicissitude 3', wp: 9, extra: ['Passion', 10],
    weapons: [], notes: 'Strength 0 / 4 (Shadowlands shown). Thaumaturgy: Lure of Flames 3, Movement of the Mind 3.' },

  // Bestiary (Appendix). Wits is not given for animals; estimated for initiative.
  { id: 'wolf', name: 'Wolf', cat: 'Bestiary', kind: 'animal', a: [3, 3, 3, 1, 1, 1, 3, 1, 3],
    abil: 'Alertness 2, Athletics 1, Brawl 3, Dodge 1, Stealth 2', wp: 3, bp: 2,
    health: 'OK,-1,-1,-3,-5,Inc', weapons: ['wolf_bite'], notes: 'Wits estimated. Ghoul animals gain Potence 1 and blood pool 10.' },
  { id: 'dog', name: 'Dog (large hound)', cat: 'Bestiary', kind: 'animal', a: [4, 3, 3, 1, 1, 1, 3, 1, 3],
    abil: 'Alertness 3, Athletics 2, Brawl 3, Dodge 3, Intimidation 3', wp: 5, bp: 2,
    health: 'OK,-1,-1,-2,-2,-5', weapons: ['dog_bite', 'dog_claw'], notes: 'Wits estimated. Trained abilities included.' },
  { id: 'big_cat', name: 'Big Cat (leopard)', cat: 'Bestiary', kind: 'animal', a: [4, 3, 3, 1, 1, 1, 3, 1, 3],
    abil: 'Alertness 3, Athletics 2, Brawl 3', wp: 5, bp: 5,
    health: 'OK,-1,-1,-2,-2,-5,Inc', weapons: ['cat_claw', 'cat_bite'], notes: 'Tiger/lion: Str 5, Sta 4, claw 5, bite 6. Wits estimated.' },
  { id: 'bear', name: 'Bear', cat: 'Bestiary', kind: 'animal', a: [5, 2, 5, 1, 1, 1, 3, 1, 2],
    abil: 'Alertness 3, Brawl 3, Intimidation 2, Stealth 1', wp: 4, bp: 5,
    health: 'OK,OK,OK,-1,-1,-1,-3,-3,-5,Inc', weapons: ['bear_claw', 'bear_bite'], notes: 'Wits estimated.' },
  { id: 'alligator', name: 'Alligator', cat: 'Bestiary', kind: 'animal', a: [4, 2, 4, 1, 1, 1, 3, 1, 2],
    abil: 'Alertness 2, Athletics 2, Brawl 2, Stealth 3', wp: 3, bp: 5, armor: 1,
    health: 'OK,OK,OK,-1,-1,-1,-2,-5,Inc', weapons: ['gator_bite', 'gator_tail'], notes: 'One soak die of armor vs bashing/lethal. Wits estimated.' },

  // Generic Kindred (built from the character-creation baseline, not Chapter Nine)
  { id: 'neonate', name: 'Kindred Neonate', cat: 'Generic Kindred', kind: 'vampire',
    a: [3, 3, 3, 2, 2, 2, 2, 2, 3],
    abil: 'Alertness 2, Athletics 2, Brawl 2, Dodge 2, Firearms 1, Intimidation 2, Melee 2, Stealth 2, Streetwise 2',
    disc: 'Celerity 1, Potence 1, Fortitude 1', wp: 4, bp: 10, gen: 13, humanity: '6',
    weapons: ['knife', 'pistol_lt'], favored: ['club', 'pistol_hvy', 'shotgun'], notes: 'Generic 13th-generation neonate. Spends 1 blood/turn.' },
  { id: 'shovelhead', name: 'Sabbat Shovelhead', cat: 'Generic Kindred', kind: 'vampire',
    a: [3, 2, 3, 1, 1, 1, 2, 1, 2],
    abil: 'Alertness 1, Brawl 3, Dodge 1, Melee 2, Intimidation 2',
    disc: 'Potence 1', wp: 3, bp: 10, gen: 14, humanity: '3', health: 'standard',
    weapons: ['club'], favored: ['knife', 'axe', 'shotgun', 'machete', 'chainsaw', 'molotov'], notes: 'Mass-Embraced cannon fodder. Frenzies easily.' },
];
