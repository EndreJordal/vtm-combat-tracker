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

  // Bestiary natural attacks (fixed dice, lethal)
  { id: 'wolf_bite', name: 'Bite & Claw', kind: 'brawl', base: 'fixed', mod: 4, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'dog_bite', name: 'Bite', kind: 'brawl', base: 'fixed', mod: 5, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'dog_claw', name: 'Claw', kind: 'brawl', base: 'fixed', mod: 4, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'bear_claw', name: 'Claw', kind: 'brawl', base: 'fixed', mod: 7, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'bear_bite', name: 'Bite', kind: 'brawl', base: 'fixed', mod: 5, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'cat_claw', name: 'Claw', kind: 'brawl', base: 'fixed', mod: 4, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'cat_bite', name: 'Bite', kind: 'brawl', base: 'fixed', mod: 5, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'gator_bite', name: 'Bite', kind: 'brawl', base: 'fixed', mod: 7, type: 'L', natural: true, builtin: true, beast: true },
  { id: 'gator_tail', name: 'Tail Slap', kind: 'brawl', base: 'fixed', mod: 6, type: 'B', builtin: true, quirk: 'bashing', beast: true },
];

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
  // Witch-Hunters
  { id: 'inquisitor', name: 'Inquisitor', cat: 'Witch-Hunters', kind: 'mortal',
    a: [2, 3, 3, 4, 3, 2, 3, 3, 3],
    abil: 'Alertness 2, Brawl 2, Dodge 2, Drive 1, Expression 2, Leadership 3, Melee (sword-cane) 3, Occult 3, Stealth 2, Theology 3',
    wp: 9, humanity: '5–10', weapons: ['sword_cane', 'stake'], favored: ['propane_torch', 'crossbow', 'pistol_lt'],
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
    wp: 6, humanity: '6 (often lower)', weapons: ['smg_small', 'knife'], favored: ['club', 'pistol_hvy', 'shotgun'], armor: 3,
    notes: 'Bulletproof vest, midsized car. A tough, savvy member of the underworld.' },
  { id: 'thug', name: 'Street Thug (Extra)', cat: 'Witch-Hunters', kind: 'mortal', health: 'extra',
    a: [3, 2, 2, 2, 2, 2, 2, 2, 2],
    abil: 'Alertness 1, Brawl 2, Dodge 1, Firearms 1, Melee 2, Streetwise 2, Intimidation 2',
    wp: 3, humanity: '6', weapons: ['knife', 'pistol_lt'], favored: ['club', 'sap', 'revolver_lt'],
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
    weapons: ['axe'], favored: ['knife', 'club'], notes: 'Thrives on carnage. Takes aggravated damage only from fire.' },
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
    weapons: ['club'], favored: ['knife', 'axe', 'shotgun'], notes: 'Mass-Embraced cannon fodder. Frenzies easily.' },
];
