# V:TM Combat Tracker

A combat and initiative tracker for **Vampire: The Masquerade Revised Edition**. It is plain HTML, CSS and JavaScript with no build step and no server code.

- **Live:** <https://endrejordal.github.io/vtm-combat-tracker/>
- **Locally:** open `index.html`, or serve the folder (for example `python -m http.server`) and open it in a browser.

All data (players, settings, custom weapons, the current combat) is kept in the browser's `localStorage`, so it survives reloads but stays on that device and in that browser.

---

## Contents

1. [Running a fight](#running-a-fight)
2. [Combatant cards](#combatant-cards)
3. [The attack dialog](#the-attack-dialog)
4. [Settings and house rules](#settings-and-house-rules)
5. [Side panel: enemies, players, custom, dice, log](#side-panel)
6. [Weapons and armor](#weapons-and-armor)
7. [Encounter links (payload reference)](#encounter-links)
8. [Preset antagonists](#preset-antagonists)
9. [Weapon catalog](#weapon-catalog)
10. [Rules reference tables](#rules-reference-tables)
11. [Data, backups and development](#data-backups-and-development)

---

## Running a fight

1. **Add combatants.** Use the side panel's **Enemies** tab to add preset enemies (choose the quantity with **×N**), your saved players (**Add all players**), or a custom combatant.
2. **Initiative.** Initiative is 1d10 + Dexterity + Wits − wound penalty.
   - **Roll NPC initiative** rolls every NPC.
   - Players roll their own dice. Type each player's **total** into the blue box on their card and press **Enter**; the cursor jumps to the next player who is still waiting.
   - **Start ▶** stays disabled until everyone who can act has a score. The status line in the header shows who you are waiting for.
   - To change a score, click it. For an NPC, pressing Enter on an empty box re-rolls it.
3. **The turn.** Press **Next ▶** (or the **N** key) to step through it; **◀** (or **P**) steps back.
   - **Declaration:** players declare, slowest first. NPC declarations stay hidden, so NPCs are skipped.
   - **Actions:** everyone acts from highest to lowest initiative. Ties go to the higher rating; if the ratings are equal too, the characters act at the same time (shown with `=`).
   - **Extra actions:** Celerity actions happen at the end of the turn, in order of initiative rating.
   - **Delay / Act now:** during the action step, **Delay** holds a character's action; **Act now** takes it at any later point.
4. **New turn.** NPCs re-roll and players enter new totals. With *Keep initiative* on, scores carry over instead. Werewolves regenerate one level, and Celerity bought last turn takes effect.
5. **Joining mid-fight (⏸ / ▶).** Every card has a ⏸ button (left of ✎) that moves the combatant to the **Inactive** section below the fight. Set up reinforcements in advance and bench them; they don't block **Start ▶** and can't attack or be targeted. **Roll NPC initiative** rolls inactive NPCs too (and players can enter a total early), so the Inactive section shows where each will slot in, with a green *→ joins after …* badge. Antagonists added from the side panel **after the fight has started** go straight to Inactive with a rolled score. Press **▶** to bring one in at any time:
   - With an initiative score, they slot straight into the order. The character currently acting stays the active one.
   - Without one, **Next ▶** and **New turn** are greyed out and the header says *Roll initiative for … to continue*. A player types their total on their card; for NPCs, **Roll NPC initiative** rolls only those without a score, so nobody else's initiative changes. You can also click their initiative box.
   - If they rolled higher than the character currently acting, their place this turn has already passed: use **Delay → Act now** on their card to have them act straight away.
6. **📝 Notes** (next to the encounter name) opens the combat notes: location, who's who, special circumstances and rules for this fight. A new encounter starts with empty notes you can type into (saved as you type); an encounter link can fill them in. When there are notes they open formatted for reading; **✎ Edit** switches back to editing. A gold dot on the button means the encounter has notes.
7. **Reset combat** keeps everyone but restores health, Willpower, blood, ammo, statuses and initiative, and sets the turn counter back to 1. **End combat** removes everyone.

The header holds the turn controls on the left (**Roll NPC initiative**, ◀, **Next ▶**, **New turn**, **Reset combat**, **End combat**) and ⚔ weapons, 📖 rules and **⚙ Settings** on the right. Its status line always shows what is happening ("▶ Inquisitor acts (15)"); hover it for the full explanation.

## Combatant cards

Each card has three groups:

| Left | Middle | Right |
|---|---|---|
| Name and descriptor (`NPC · Enemy · Vampire · Thin-Blood Singer`) | Willpower and Blood (or another pool such as Gnosis) | Buttons: Delay/Act now, ⏸/▶ deactivate/activate, ✎ edit, ⧉ duplicate, ▾ details, − collapse, ✕ remove |
| Health boxes and current state | Equipment columns: **Unarmed · Melee · Ranged · Armor** | Stat block: attributes, combat Abilities, soak (armor included) and combat Disciplines |
| **+B +L +A** (damage), **−B −L −A** (heal), **Mend** (1 blood heals 1 normal level), **Mend A** (5 blood heals 1 aggravated level) | | |

- **The descriptor** shows who controls the combatant (PC/NPC), their **allegiance** (Ally/Enemy), the creature kind, and the preset name when a preset-based combatant has been renamed: `Vampy McVamperson — NPC · Enemy · Vampire · Thin-Blood Singer`.
- **Allegiance and turncoats:** players start as **Ally** and NPCs as **Enemy**. Click the descriptor to switch either way at any time. The card's border and descriptor show the side in every theme: **blue** = player ally, **green** = NPC ally, **red** = NPC enemy, **magenta** = player turned enemy. The active character glows in its own side colour. The attack dialog offers the other allegiance as targets, so a turncoat can be attacked by former friends and attack them back.
- **Portrait:** set one in the editor (✎) with a path or web address (for example `images/vamp.jpg`, an image in the site's `images` folder) or **Upload…** a picture from your computer. Uploads are cropped and shrunk to a small thumbnail so saved data stays small. The portrait sits under the initiative box on full cards; expanding the card (▾) shows a tall version beside the full stats instead. Collapsed cards show a small thumbnail before the name. Click any of them to see it large.
- **Preset portraits:** every preset has a portrait in `images/presets/` (a full portrait plus a head-and-shoulders thumbnail), shown on the cards and on the left of each row in the **Enemies** list. A combatant's own portrait (set in the editor) wins over the preset's. To change them:
  1. Put the picture in the preset's folder under `portrait-sources/<preset-id> (<name>)/` (any file name; JPG, PNG, WebP or AVIF). That folder holds the originals and is git-ignored.
  2. Run `python -I tools/build_preset_portraits.py`. It crops a full portrait and a thumbnail (finding the head automatically on plain backgrounds; hand-placed crops are in `THUMB_FOCUS`), replaces plain light backgrounds with the dark panel colour (except those in `KEEP_BACKGROUND`), and writes `images/presets/` plus `js/preset-portraits.js`.
  3. Commit `images/presets/` and `js/preset-portraits.js`.
- **Health marks:** ╱ bashing, ✕ lethal, ✱ aggravated. Aggravated damage is always marked above normal damage. Going past Incapacitated means torpor or Final Death for vampires, and death for everyone else.
- **Willpower and Blood:** click a dot to set the value, or use − / +. **Ignore wounds** spends 1 Willpower to ignore wound penalties for a turn. **⚡ Celerity** spends 1 blood for extra actions next turn; werewolves get **⚡ +N actions** instead, which cost no blood.
- **Equipment:** click a weapon to attack with it.
  - The **▾** on a weapon opens the full list for that column. Preset favorites are marked `*` and listed first. **✕ Drop this weapon** is at the bottom.
  - An empty column shows **+ Melee** or **+ Ranged**. To carry a second weapon in a column, use the small **+** that appears on the column's corner when you hover over the card.
  - Ranged weapons show their ammo and a **↻** reload button.
  - The armor box's **▾** changes armor.
- **Details (▾):** shows all Attributes, Abilities and Disciplines, notes, every status toggle, blood boosts to Physical Attributes, and the torpor/dead controls.
- **Collapse (−):** shrinks the card to one 34px line showing initiative, portrait thumbnail, name and buttons.
- **Click to resize:** click any empty part of a card (not a button, field, chip or dot): a collapsed card opens to normal, a normal card collapses, and a fully expanded card goes back to normal. **Double-click** any card to open it fully (the same as ▾).
- **Statuses:** delaying, full defense, knocked down (−2 initiative next turn), dazed, clinched/held, immobilized, blinded, staked, frenzy (ignores wound penalties), Willpower used to ignore wounds, and battle form (werewolves).

## The attack dialog

Click a weapon on a card to open the dialog. It fits a 1536×695 laptop screen without scrolling.

1. **Setup:** choose the weapon, maneuver and target (the target chips show the opposing side; **Show allies too** adds the rest). Then set range, cover, aim point, position (front/flank/rear), extra opponents (close combat), turns spent aiming and scope (ranged), actions this turn and which action this is, extra dice, extra difficulty, and Willpower (+1 automatic success). The calculation lines show exactly how the pool and difficulty were built.
2. **Attack roll:** **🎲 Roll** for a digital roll, or type the successes from physical dice. Ammunition and the Willpower point are spent either way. Each ranged weapon chip has a **↻** to reload it.
3. **Defense:** None, Dodge, Block or Parry. A player target rolls their own dice, so the dialog shows their pool and a box for their successes. An NPC target also gets a 🎲 button.
4. **Damage:** the pool includes extra successes, targeting and Potence. The damage type is converted for the target (for example, a firearm against a vampire becomes bashing). Roll digitally or type the successes.
5. **Soak & apply:** the target's soak pool is worked out from their creature kind, armor and Fortitude. Players type their own soak; with no soak dice, all damage goes through.
   - **Apply damage** applies and closes the dialog.
   - **Apply & new attack** applies and keeps the same setup ready for the next attack.
   - **Roll rest & apply** (NPC targets only) rolls whatever is missing and applies.
   - Dazed, staked and disarmed results are flagged automatically.

## Settings and house rules

Open **⚙ Settings** in the header. A gold dot on the button means at least one house rule is on.

**Appearance:** pick a theme with ◀ / ▶ or click a swatch. All themes are dark: *Camarilla* (crimson and gold, the default), *Tremere* (violet), *Ventrue* (sapphire and silver), *Nosferatu* (sewer moss), *Toreador* (rose), *Sabbat* (ember), *Giovanni* (grave teal) and *Obsidian* (near-black and steel). The damage colours (╱ bashing, ✕ lethal, ✱ aggravated) and blood-red blood pools stay the same in every theme.

| Setting | Effect |
|---|---|
| **Keep initiative** (house rule) | Roll initiative once per combat. Each character keeps their die; wound penalties and knockdown still adjust the score every turn. |
| **Skip declarations** (house rule) | No declaration step; everyone decides on their own turn. Suggested to use with it: defending before your turn uses your action, and pool splits are decided at your first roll. |
| **Keep inactive collapsed** | Only the active character's card is shown in full. You can open others; they collapse again when the next character becomes active. Newcomers join collapsed. |
| **Quick damage buttons roll soak** | The card's +B / +L / +A buttons roll the target's soak first (undead halve bashing) instead of applying the level directly. |

## Side panel

- **Enemies:** every preset, grouped by category and searchable. **×N** sets how many are added per click. "My Enemies" holds combatants you saved from the editor (tick *Save to My Enemies*). Once the fight has started, new enemies go to the Inactive section with a rolled score.
- **Players:** your saved player characters. **Configure…** creates, edits, deletes, and exports or imports them as JSON.
- **Custom:** a full editor for one-off combatants, plus a *quick extra* form (name, Dex + Wits, attack pool, soak, weapon, Extras health).
- **Dice:** roll any pool against a difficulty, a single d10, or an Attribute + Ability roll for a combatant (with or without wound penalties).
- **Log:** every roll, hit, heal and turn, newest first.

## Weapons and armor

- **Catalog (⚔ in the header):** every weapon by category, with damage, type, range, rate, clip, concealment, quirk and source (`core`, `homebrew`, `Bestiary`, or ★ for your own).
- **Damage types:**
  - `B` bashing, `L` lethal, `A` aggravated.
  - `L*` firearm: lethal against mortals, bashing against Kindred unless aimed at the head.
  - `B*` blunt: bashing unless aimed at the head.
  - `A (fire)`: automatic aggravated levels that ignore armor and are soaked with Fortitude only, at the fire's heat difficulty.
- **Quirks** are the short gold notes on weapons (*needs grapple*, *silver*, *stakes*, *burst / auto* …). Silver, staking and fire are enforced in the attack dialog; quirks such as the katana's parry bonus or reach are reminders for the Storyteller.
- **New weapon:** set the name, kind (brawl, melee, ranged, thrown), damage base (Strength + N or fixed dice), damage type, accuracy, difficulty modifier, range, rate, clip, concealment, fire levels and heat difficulty (for fire weapons), and whether it is burst-capable, teeth/claws (armor applies against its aggravated damage), able to stake, or silver. Then add a quirk and notes.
- **Armor:** set it per combatant with the armor box on the card. It adds to soak against bashing, lethal and fangs/claws (not fire or sunlight); its penalty reduces Dexterity pools.

---

## Encounter links

An encounter link opens the tracker with a fight already set up. Write the JSON using the reference below and put it after `#encounter=` in the address.

### URL format

```
https://endrejordal.github.io/vtm-combat-tracker/#encounter=<payload>
```

`<payload>` is either:

- the JSON itself, URL-encoded: `#encounter=%7B%22combatants%22%3A...`. Most browsers accept the raw JSON pasted straight into the address bar and encode it for you, or
- the JSON encoded as **base64url** (UTF-8, `+`→`-`, `/`→`_`, no `=` padding), which gives a shorter, tidier link.

`?encounter=<payload>` in the query string works too. If a combat is already running, the tracker asks before replacing it. After loading, the payload is removed from the address bar.

### Top-level fields

| Field | Type | Meaning |
|---|---|---|
| `v` | number | Format version (currently `1`). Optional. |
| `name` | string | Encounter name shown in the header. |
| `notes` | string or array of strings | Combat notes: location, combatants, special circumstances and rules, shown in the **📝 Notes** dialog. An array is joined with line breaks (easier to write in JSON). Formatting: `# Heading`, `## Subheading`, `- bullet`, `**bold**`, `*italic*`, blank line for a new paragraph. |
| `pcs` | `true` or array | `true` adds **all** of the opener's saved players. An array adds the named ones: `["Anna", "Mikkel"]`. Items can also be [player entries](#player-entries) (objects). |
| `combatants` | array | The fight's entries (presets, players, custom), in any order. `npcs` is accepted as another name for it. |
| `weapons` | array | Custom weapon definitions used by the entries (same fields as the *New weapon* form, plus a unique `id`). They are added to the opener's catalog if that `id` doesn't already exist. |

### Preset entries

```json
{ "preset": "wk_singer", "count": 3 }
```

| Field | Type | Meaning |
|---|---|---|
| `preset` | ID | Required. See [Preset antagonists](#preset-antagonists). Your own saved enemies ("My Enemies") also work, but their IDs exist only in your browser. |
| `count` | 1–50 | How many copies. They are numbered automatically ("Thin-Blood Singer 2" …). |
| `inactive` | boolean | `true` starts them in the **Inactive** section as reinforcements, to be brought in with ▶ during the fight. Works on every entry type. |
| `name` | string | Rename. The descriptor keeps the preset name: `NPC · Vampire · Thin-Blood Singer`. |
| `weapons` | array | **Replaces** the carried loadout. Items are weapon IDs, or `{ "id": "rifle", "ammo": 2 }` to set ammo. |
| `favored` | array of IDs | Extra weapons listed at the top of the swap dropdowns, alongside the preset's own favorites. |
| `armor` | 0–5 | Armor rating (see [Armor](#armor)). |
| `attrs` | array or object | An array of nine numbers **replaces** all Attributes (order: Str, Dex, Sta, Cha, Man, App, Per, Int, Wits). An object such as `{ "dex": 4, "wit": 3 }` changes only those named. Keys: `str dex sta cha man app per int wit`. |
| `abil`, `disc` | string or object | **Replaces** the Abilities / Disciplines: `"Brawl 3, Dodge 2"` or `{ "Brawl": 3 }`. |
| `wp`, `bp` | number | Willpower / blood pool maximum. |
| `allegiance` | `"ally"` / `"enemy"` | Overrides the default (NPCs are enemies). Works on every entry type, so `{ "pc": "Anna", "allegiance": "enemy" }` starts a player on the other side. |
| `kind`, `side`, `health`, `extra`, `gen`, `humanity`, `regen`, `notes`, `portrait` | | As in [custom entries](#custom-entries). |
| state fields | | See [State fields](#state-fields). |

### Player entries

```json
{ "pc": "Celeste Moreau" }
```

The name is matched, ignoring case, against the **opener's** saved players. A player who isn't found is skipped and reported, unless the entry also carries stats (put a `custom` object or template fields in the entry) to use as a fallback.

| Field | Meaning |
|---|---|
| `pc` | Required. The player's name. |
| `weapons`, `armor` | Override the player's saved loadout for this fight. |
| `portrait` | Override the player's saved portrait. |
| `inactive` | `true` starts the player in the Inactive section (for example, someone arriving late). |
| state fields | See [State fields](#state-fields). |

### Custom entries

```json
{ "custom": { "name": "Lasombra Elder", "kind": "vampire", "attrs": [4,4,4,3,4,3,3,3,4],
  "abil": "Brawl 4, Dodge 3, Melee 3", "disc": "Fortitude 3, Potence 2, Obtenebration 4",
  "wp": 8, "bp": 20, "weapons": ["katana"], "favored": ["deagle"] }, "count": 1 }
```

A bare object with a `name` (without the `custom` wrapper) works too. Template fields:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | "Unnamed" | Name (numbered automatically when repeated). |
| `side` | `"npc"` / `"pc"` | `"npc"` | Who controls it: Storyteller (NPC, rolled digitally) or player (PC, enters their own rolls). |
| `allegiance` | `"ally"` / `"enemy"` | by side | Which side it fights on. Players default to ally, NPCs to enemy. |
| `kind` | see [Creature kinds](#creature-kinds) | `"mortal"` | Decides soak, halving, torpor and so on. |
| `attrs` | array of 9, or object | all 1 | Str, Dex, Sta, Cha, Man, App, Per, Int, Wits. Attributes you leave out are 1. |
| `abil` | string or object | none | `"Alertness 2, Brawl 3, Dodge 2, Firearms 2, Melee 2"`. The tracker uses Alertness, Athletics, Brawl, Dodge, Firearms, Melee and Stealth for rolls; the rest is listed for reference. |
| `disc` | string or object | none | `"Celerity 2, Fortitude 1, Potence 1, Dominate 3"`. Celerity, Fortitude and Potence are used automatically. |
| `wp` | number or `{max, cur}` | 0 | Willpower. |
| `bp` | number or `{max, cur}` | 0 | Blood pool (vitae for ghouls; 0 hides it). |
| `extra` | `["Gnosis", 6]` or `{label, max, cur}` | none | Another pool shown on the card (Gnosis, Glamour, Passion …). |
| `gen` | string | none | Generation, shown in details. |
| `humanity` | string | none | Humanity or Path, shown in details. |
| `armor` | 0–5 | 0 | Armor rating. |
| `health` | `"standard"`, `"extra"` or custom string | `"standard"` | See [Health charts](#health-charts). |
| `weapons` | array | none | Weapon IDs or `{ "id": …, "ammo": … }`. Everyone also has Unarmed. |
| `favored` | array of IDs | the starting weapons | Weapons listed first in the swap dropdowns. |
| `regen` | boolean | false | Regenerates one bashing or lethal level per turn (werewolves). |
| `notes` | string | none | Shown in the card's details. |
| `portrait` | string | none | Image path or web address, e.g. `"images/vamp.jpg"`. Uploaded pictures are stored as long `data:` strings; use paths or addresses in links instead. |

### State fields

Any entry can start part-way through a fight:

| Field | Example | Meaning |
|---|---|---|
| `dmg` | `{ "a": 1, "l": 2, "b": 0 }` | Aggravated, lethal and bashing levels already taken. |
| `wp` | `{ "max": 7, "cur": 3 }` | Willpower spent so far (on presets, a plain number sets the maximum). |
| `bp` | `{ "max": 12, "cur": 5 }` | Blood spent so far. |
| `extra` | `{ "label": "Gnosis", "max": 6, "cur": 2 }` | Current value of the other pool. |
| `weapons` | `[{ "id": "pistol_lt", "ammo": 3 }]` | Partly empty magazines. |
| `state` | `"active"`, `"torpor"` or `"dead"` | Out-of-action states. |


### Errors

Unknown preset, player or weapon IDs are skipped. The tracker still loads everything else and lists what it couldn't find in a message ("Loaded "Raid" — not found: nope, weapon "bogus_gun""). An unknown `kind` becomes `mortal`.

### Examples

**A Wakener raid on a club.** Three Singers, a named Lieutenant in his cop's kit, two Faithful carrying the hunter's kit, plus all saved players:

```json
{
  "name": "The Last Waltz",
  "pcs": true,
  "combatants": [
    { "preset": "wk_singer", "count": 3 },
    { "preset": "wk_lieutenant", "name": "Brother Ash", "weapons": ["pistol_hvy", "fire_axe"], "armor": 3 },
    { "preset": "wk_faithful", "count": 2, "weapons": ["stake", "road_flare"] },
    { "preset": "wk_recruiter", "name": "Sister Joy" },
    { "preset": "wk_exmil", "count": 2, "inactive": true }
  ]
}
```

The two ex-military ghouls at the end start **inactive**: reinforcements that come through the loading dock when you press ▶ on their cards.

**With combat notes** (an array keeps long notes readable in JSON):

```json
{
  "name": "Warehouse on Pier 9",
  "notes": [
    "# Warehouse on Pier 9",
    "Abandoned, 40 × 22 yards. Rain on the skylights; the lights are out.",
    "",
    "## Special rules",
    "- Darkness away from the skylights: +1 difficulty on ranged attacks.",
    "- The **Lieutenant** flees at Wounded; the Singers keep singing until Incapacitated.",
    "",
    "## Combatants",
    "- *Brother Ash* holds the office. Three Singers stand in the moonlight."
  ],
  "pcs": true,
  "combatants": [ { "preset": "wk_lieutenant", "name": "Brother Ash" }, { "preset": "wk_singer", "count": 3 } ]
}
```

**A wounded werewolf, already low on Gnosis:**

```json
{ "combatants": [ { "preset": "were_vet", "dmg": { "a": 1, "l": 2, "b": 0 }, "extra": { "label": "Gnosis", "max": 6, "cur": 2 } } ] }
```

**A custom weapon carried by a custom NPC:**

```json
{
  "weapons": [ { "id": "w_cleaver", "name": "Meat Cleaver", "kind": "melee", "base": "str", "mod": 2, "type": "L", "conceal": "J", "quirk": "butcher's tool" } ],
  "combatants": [ { "custom": { "name": "The Butcher", "kind": "ghoul", "attrs": { "str": 4, "dex": 2, "sta": 3, "wit": 2 },
    "abil": "Brawl 2, Melee 3, Intimidation 3", "disc": "Potence 1", "wp": 4, "bp": 2, "weapons": ["w_cleaver"] } } ]
}
```

**The same raid as a link** (base64url):

```
https://endrejordal.github.io/vtm-combat-tracker/#encounter=eyJuYW1lIjoiVGhlIExhc3QgV2FsdHoiLCJwY3MiOnRydWUsImNvbWJhdGFudHMiOlt7InByZXNldCI6IndrX3NpbmdlciIsImNvdW50IjozfV19
```

(That one is shortened: three Singers plus all players. For the complete raid, paste the full JSON after `#encounter=`, or base64url-encode it, e.g. in a browser console: `btoa(unescape(encodeURIComponent(json))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')`.)

---

### Linked from imagineVTT

imagineVTT (`https://endrejordal.github.io/imagineVTT/`) can open the tracker in its own window and run a fight with it: the campaign bible's **Start in imagineVTT** links go through imagineVTT, which hands the encounter (the same payload as above) to the tracker. From then on the tracker reports the fight after every change: imagineVTT shows the order of initiative to the players and saves the whole fight inside its scene, so it can be resumed next week. The header shows **● imagineVTT** while linked.

- Entries may carry a `vtt` object (how the combatant's token looks in imagineVTT: `border`, `color`, `type`, `size`, `label`). The tracker keeps it on the combatant and otherwise ignores it.
- A linked fight carries a `linkId` in the saved combat. imagineVTT only takes the state of the fight that belongs to its scene, so fights run here on their own are never touched. **End combat** ends the link too; imagineVTT keeps its copy and can put it back (**Resume**).
- Only the window imagineVTT opened takes part; other tabs work as before. The code is `js/imagine-link.js`; the design is `docs/combat-link.md` in imagineVTT.

## Preset antagonists

Use the **ID** in encounter links. *Carries* is the loadout a preset starts with; *Also favored* are the extra weapons at the top of its swap dropdowns. Full stats, specials and gear notes are in each card's details (▾). Weapon IDs are listed in the [weapon catalog](#weapon-catalog).

<!-- BEGIN:presets -->
<!-- generated by tools/readme-tables.js; edit js/data.js and re-run -->

#### Wakeners

| ID | Name | Kind | Str/Dex/Sta | Init rtg | Pools | Armor | Health | Disciplines | Carries | Also favored |
|---|---|---|---|---|---|---|---|---|---|---|
| `wk_singer` | Thin-Blood Singer | Vampire | 2/2/2 | 5 | WP 6, BP 8 | 0 | standard | Obfuscate 1 | — | `box_cutter` |
| `wk_recruiter` | Thin-Blood Recruiter | Vampire | 2/2/2 | 5 | WP 6, BP 8 | 0 | standard | Presence 1 | — | `revolver_lt` |
| `wk_faithful` | Caitiff Faithful | Vampire | 3/2/3 | 4 | WP 5, BP 10 | 0 | standard | Potence 1, Fortitude 1, Celerity 1 | `tire_iron` `knife` | `revolver_lt` `pistol_lt` `stake` `road_flare` `crowbar` `molotov` |
| `wk_lieutenant` | Lieutenant | Vampire | 3/3/3 | 6 | WP 7, BP 11 | 0 | standard | Potence 2, Celerity 1, Obfuscate 2, Presence 1 | `fire_axe` | `pistol_hvy` |
| `wk_choirmaster` | Thin-Blood Choirmaster | Vampire | 3/3/3 | 6 | WP 7, BP 8 | 0 | standard | Presence 1, Obfuscate 1 | `fire_axe` | `pistol_hvy` |
| `wk_fallen` | The Fallen | Vampire | 3/3/3 | 6 | WP 7, BP 12 | 0 | standard | — | `straight_razor` `revolver_hvy` | — |
| `wk_discarded` | Discarded Ghoul | Ghoul | 2/2/2 | 4 | WP 3, BP 2 | 0 | standard | Potence 1 | `knife` | `baseball_bat` |
| `wk_driver` | Driver and Handler | Ghoul | 3/3/3 | 6 | WP 5, BP 2 | 0 | standard | Potence 1, Fortitude 1 | `sap` `pistol_lt` | — |
| `wk_exmil` | Ex-Military Ghoul | Ghoul | 3/3/3 | 6 | WP 6, BP 2 | 0 | standard | Potence 1, Fortitude 1 | `pistol_lt` `knife` | `rifle` `shotgun` `road_flare` |

#### Witch-Hunters

| ID | Name | Kind | Str/Dex/Sta | Init rtg | Pools | Armor | Health | Disciplines | Carries | Also favored |
|---|---|---|---|---|---|---|---|---|---|---|
| `inquisitor` | Inquisitor | Mortal | 2/3/3 | 6 | WP 9 | 0 | standard | — | `sword_cane` `stake` | `propane_torch` `crossbow` `pistol_lt` `flare_gun` `compound_bow` |
| `gov_agent` | Government Agent | Mortal | 3/2/3 | 5 | WP 7 | 0 | standard | — | `pistol_hvy` | `club` `knife` `shotgun` `pistol_lt` |
| `arcanum` | Arcanum Scholar | Mortal | 2/2/2 | 5 | WP 7 | 0 | standard | — | — | `knife` `revolver_lt` |
| `enforcer` | Criminal Enforcer | Mortal | 4/3/3 | 6 | WP 6 | 3 | standard | — | `smg_small` `knife` | `club` `pistol_hvy` `shotgun` `sawed_off` `brass_knuckles` |
| `thug` | Street Thug (Extra) | Mortal | 3/2/2 | 4 | WP 3 | 0 | extra | — | `knife` `pistol_lt` | `club` `sap` `revolver_lt` `brass_knuckles` `switchblade` `broken_bottle` |

#### Ghouls

| ID | Name | Kind | Str/Dex/Sta | Init rtg | Pools | Armor | Health | Disciplines | Carries | Also favored |
|---|---|---|---|---|---|---|---|---|---|---|
| `valet` | Trusted Valet | Ghoul | 2/3/2 | 6 | WP 4, BP 10 | 0 | standard | Potence 1 | `pistol_lt` `knife` | `sword_cane` `pistol_hvy` |
| `bodyguard` | Ghoul Bodyguard | Ghoul | 4/4/4 | 7 | WP 5, BP 10 | 2 | standard | Fortitude 1, Potence 1 | `pistol_hvy` `club` | `knife` `smg_large` `shotgun` |

#### Werewolves

| ID | Name | Kind | Str/Dex/Sta | Init rtg | Pools | Armor | Health | Disciplines | Carries | Also favored |
|---|---|---|---|---|---|---|---|---|---|---|
| `were_young` | Adolescent Werewolf | Werewolf | 3/3/3 | 6 | WP 5, Gnosis 4 | 0 | standard | Celerity 3, Potence 1, Protean 4 | `lupine_claws` `lupine_bite` | — |
| `were_vet` | Veteran Lupine | Werewolf | 4/3/4 | 7 | WP 7, Gnosis 6 | 0 | standard | Celerity 4, Potence 2, Protean 4 | `lupine_claws` `lupine_bite` | — |
| `were_elder` | Elder Shapeshifter | Werewolf | 5/4/5 | 8 | WP 9, Gnosis 8 | 0 | standard | Celerity 5, Dominate 2, Fortitude 2, Obfuscate 3, Potence 3, Protean 4 | `lupine_claws` `lupine_bite` | — |

#### Magi

| ID | Name | Kind | Str/Dex/Sta | Init rtg | Pools | Armor | Health | Disciplines | Carries | Also favored |
|---|---|---|---|---|---|---|---|---|---|---|
| `cultist` | Young Cultist | Mage | 3/3/3 | 7 | WP 5, Magick pool 10 | 0 | standard | Auspex 2, Dominate 2, Presence 1, Protean 1, Thaumaturgy 3 | `knife` `pistol_hvy` | `pistol_lt` `revolver_hvy` `shotgun` |
| `high_wizard` | High Wizard | Mage | 2/2/2 | 6 | WP 9, Magick pool 12 | 0 | standard | Auspex 4, Chimerstry 3, Dominate 2, Fortitude 2, Obfuscate 4, Presence 3, Thaumaturgy 5 | `sword_cane` | — |
| `techno` | Technological Abomination | Mage | 5/4/5 | 8 | WP 8, Blood (poison) 10 | 4 | standard | Auspex 2, Dominate 2, Fortitude 4, Potence 3, Presence 3 | `assault_rifle` | `smg_large` `shotgun` `pistol_hvy` `knife` |

#### Faeries

| ID | Name | Kind | Str/Dex/Sta | Init rtg | Pools | Armor | Health | Disciplines | Carries | Also favored |
|---|---|---|---|---|---|---|---|---|---|---|
| `pooka` | Pooka Trickster | Faerie | 2/5/2 | 7 | WP 6, BP 10, Glamour 6 | 0 | standard | Animalism 2, Auspex 2, Chimerstry 3, Celerity 2, Obfuscate 4, Protean 4 | — | — |
| `redcap` | Redcap Warrior | Faerie | 3/4/4 | 8 | WP 5, BP 10, Glamour 5 | 0 | standard | Celerity 3, Fortitude 2, Obfuscate 3, Potence 2 | `axe` | `knife` `club` `machete` `chain` |
| `sidhe` | Sidhe Enchantress | Faerie | 2/4/3 | 8 | WP 7, BP 15, Glamour 10 | 0 | standard | Celerity 1, Chimerstry 5, Dominate 4, Obfuscate 4, Presence 5 | `sword` | — |

#### Wraiths

| ID | Name | Kind | Str/Dex/Sta | Init rtg | Pools | Armor | Health | Disciplines | Carries | Also favored |
|---|---|---|---|---|---|---|---|---|---|---|
| `wraith_new` | Recently Deceased | Wraith | 2/3/3 | 6 | WP 5, Passion 5 | 0 | standard | Auspex 1, Chimerstry 1, Dementation 2, Dominate 1, Vicissitude 1 | — | — |
| `spectre` | Spectre | Wraith | 3/3/5 | 6 | WP 7, Passion 9 | 0 | standard | Auspex 2, Chimerstry 4, Dementation 4, Obfuscate 2, Obtenebration 3, Presence 2, Protean 2, Vicissitude 4 | — | — |
| `old_soul` | Old Soul | Wraith | 4/5/5 | 8 | WP 9, Passion 10 | 0 | standard | Auspex 2, Chimerstry 1, Dementation 4, Dominate 3, Presence 2, Thaumaturgy 3, Vicissitude 3 | — | — |

#### Bestiary

| ID | Name | Kind | Str/Dex/Sta | Init rtg | Pools | Armor | Health | Disciplines | Carries | Also favored |
|---|---|---|---|---|---|---|---|---|---|---|
| `wolf` | Wolf | Animal | 3/3/3 | 6 | WP 3, BP 2 | 0 | OK,-1,-1,-3,-5,Inc | — | `wolf_bite` | — |
| `dog` | Dog (large hound) | Animal | 4/3/3 | 6 | WP 5, BP 2 | 0 | OK,-1,-1,-2,-2,-5 | — | `dog_bite` `dog_claw` | — |
| `big_cat` | Big Cat (leopard) | Animal | 4/3/3 | 6 | WP 5, BP 5 | 0 | OK,-1,-1,-2,-2,-5,Inc | — | `cat_claw` `cat_bite` | — |
| `bear` | Bear | Animal | 5/2/5 | 4 | WP 4, BP 5 | 0 | OK,OK,OK,-1,-1,-1,-3,-3,-5,Inc | — | `bear_claw` `bear_bite` | — |
| `alligator` | Alligator | Animal | 4/2/4 | 4 | WP 3, BP 5 | 1 | OK,OK,OK,-1,-1,-1,-2,-5,Inc | — | `gator_bite` `gator_tail` | — |

#### Generic Kindred

| ID | Name | Kind | Str/Dex/Sta | Init rtg | Pools | Armor | Health | Disciplines | Carries | Also favored |
|---|---|---|---|---|---|---|---|---|---|---|
| `neonate` | Kindred Neonate | Vampire | 3/3/3 | 6 | WP 4, BP 10 | 0 | standard | Celerity 1, Potence 1, Fortitude 1 | `knife` `pistol_lt` | `club` `pistol_hvy` `shotgun` |
| `shovelhead` | Sabbat Shovelhead | Vampire | 3/2/3 | 4 | WP 3, BP 10 | 0 | standard | Potence 1 | `club` | `knife` `axe` `shotgun` `machete` `chainsaw` `molotov` |

<!-- END:presets -->

## Weapon catalog

Every weapon by category. `core` = the rulebook's weapon charts, `homebrew` = additions in the same scale, `Wakeners` = improvised gear from the Wakeners material (each uses the stats of the chart weapon it is "as"), `Bestiary` = animal attacks. Range is in yards (2 yards = 1 square), and long range is double the listed range. Concealment: P pocket, J jacket, T trenchcoat, N not concealable. **Unarmed** (`unarmed`) is always available and doesn't need to be listed.

<!-- BEGIN:weapons -->
<!-- generated by tools/readme-tables.js; edit js/data.js and re-run -->

#### Melee — blades

| ID | Name | Damage | Type | Conceal | Quirk | Source |
|---|---|---|---|---|---|---|
| `knife` | Knife | Str+1 | L | J |  | core |
| `stake` | Stake | Str+1 | L | T | heart: stakes | core |
| `box_cutter` | Box Cutter | Str+1 | L | P |  | Wakeners |
| `straight_razor` | Straight Razor | Str+1 | L | P |  | Wakeners |
| `sword` | Sword | Str+2 | L | T |  | core |
| `sword_cane` | Sword-cane | Str+2 | L | T | concealed | core |
| `axe` | Axe | Str+3 | L | N |  | core |
| `fire_axe` | Fire Axe | Str+3 | L | N |  | Wakeners |
| `switchblade` | Switchblade | Str+1 | L | P |  | homebrew |
| `broken_bottle` | Broken Bottle | Str+1 | L | P | improvised | homebrew |
| `silver_knife` | Silver Knife | Str+1 | L | J | silver | homebrew |
| `katana` | Katana | Str+2 | L | T | parry +1 die | homebrew |
| `machete` | Machete | Str+2 | L | T |  | homebrew |
| `spear` | Spear | Str+2 | L | N | reach · stakes | homebrew |
| `chainsaw` | Chainsaw | 7 | L | N | loud · diff +1 | homebrew |

#### Melee — blunt

| ID | Name | Damage | Type | Conceal | Quirk | Source |
|---|---|---|---|---|---|---|
| `sap` | Sap | Str+1 | B* | P | lethal to head | core |
| `club` | Club | Str+2 | B* | T | lethal to head | core |
| `tire_iron` | Tire Iron | Str+2 | B* | T | lethal to head | Wakeners |
| `baseball_bat` | Baseball Bat | Str+2 | B* | T | lethal to head | Wakeners |
| `chain` | Chain | Str+1 | B* | J | sweep / disarm | homebrew |
| `staff` | Staff | Str+1 | B* | N | reach · sweep | homebrew |
| `crowbar` | Crowbar | Str+2 | B* | T | lethal to head | homebrew |
| `sledgehammer` | Sledgehammer | Str+3 | B* | N | two-handed · diff +1 | homebrew |

#### Natural & brawl

| ID | Name | Damage | Type | Conceal | Quirk | Source |
|---|---|---|---|---|---|---|
| `feral_claws` | Feral Claws | Str+1 | A | — | 1 BP to grow | core |
| `bone_spurs` | Bone Spurs | Str+1 | L | — | Vicissitude | core |
| `lupine_claws` | Lupine Claws | Str+1 | A | — |  | core |
| `lupine_bite` | Lupine Bite | Str+1 | A | — | needs grapple | core |
| `brass_knuckles` | Brass Knuckles | Str+1 | B | P | uses Brawl | homebrew |

#### Fire

| ID | Name | Damage | Type | Conceal | Quirk | Source |
|---|---|---|---|---|---|---|
| `propane_torch` | Propane Torch | 1 auto | A (fire) | — | fire · no armor | core |
| `road_flare` | Road Flare | 1 auto | A (fire) | — | fire · no armor | Wakeners |

#### Pistols & revolvers

| ID | Name | Damage | Type | Range | Rate | Clip | Conceal | Quirk | Source |
|---|---|---|---|---|---|---|---|---|---|
| `revolver_lt` | Revolver, Lt. (.38) | 4 | L* | 12 | 3 | 6 | P |  | core |
| `pistol_lt` | Pistol, Lt. (Glock 17) | 4 | L* | 20 | 4 | 18 | P |  | core |
| `pistol_hvy` | Pistol, Hvy. (Sig P220) | 5 | L* | 30 | 3 | 8 | J |  | core |
| `revolver_hvy` | Revolver, Hvy. (.44 Mag) | 6 | L* | 35 | 2 | 6 | J |  | core |
| `holdout` | Hold-out Pistol (.22) | 3 | L* | 10 | 3 | 6 | P | hides anywhere | homebrew |
| `deagle` | Pistol, Hvy. (Desert Eagle .50) | 6 | L* | 30 | 2 | 8 | J | loud · rate 2 | homebrew |

#### Shotguns

| ID | Name | Damage | Type | Range | Rate | Clip | Conceal | Quirk | Source |
|---|---|---|---|---|---|---|---|---|---|
| `shotgun` | Shotgun (Ithaca M-37) | 8 | L* | 20 | 1 | 6 | T |  | core |
| `shotgun_semi` | Shotgun, Semi-auto | 8 | L* | 20 | 3 | 9 | T |  | core |
| `sawed_off` | Sawed-off Shotgun | 8 | L* | 10 | 2 | 2 | J | both barrels | homebrew |

#### Rifles

| ID | Name | Damage | Type | Range | Rate | Clip | Conceal | Quirk | Source |
|---|---|---|---|---|---|---|---|---|---|
| `rifle` | Rifle (Remington M-700) | 8 | L* | 200 | 1 | 6 | N |  | core |

#### Submachine guns & assault rifles

| ID | Name | Damage | Type | Range | Rate | Clip | Conceal | Quirk | Source |
|---|---|---|---|---|---|---|---|---|---|
| `smg_small` | SMG, Small (Mac-10) | 4 | L* | 25 | 3 (auto) | 31 | J | burst / auto | core |
| `smg_large` | SMG, Large (Uzi) | 4 | L* | 50 | 3 (auto) | 33 | T | burst / auto | core |
| `assault_rifle` | Assault Rifle (Steyr-Aug) | 7 | L* | 150 | 3 (auto) | 43 | N | burst / auto | core |
| `ak47` | Assault Rifle (AK-47) | 7 | L* | 100 | 3 (auto) | 31 | N | burst / auto | homebrew |

#### Bows & crossbows

| ID | Name | Damage | Type | Range | Rate | Clip | Conceal | Quirk | Source |
|---|---|---|---|---|---|---|---|---|---|
| `crossbow` | Crossbow | 5 | L* | 20 | 1 | 1 | T | stakes · 5-turn reload | core |
| `compound_bow` | Compound Bow | 4 | L* | 40 | 1 | 1 | N | silent · stakes | homebrew |

#### Special

| ID | Name | Damage | Type | Range | Rate | Clip | Conceal | Quirk | Source |
|---|---|---|---|---|---|---|---|---|---|
| `flare_gun` | Flare Gun | 1 auto | A (fire) | 30 | 1 | 1 | J | fire · 1 shot | homebrew |
| `taser` | Taser | 4 | B | 5 | 1 | 1 | P | stuns mortals | homebrew |

#### Thrown

| ID | Name | Damage | Type | Range | Rate | Clip | Conceal | Quirk | Source |
|---|---|---|---|---|---|---|---|---|---|
| `thrown_knife` | Throwing Knife | Str | L | 10 | — | — | P | Dex + Athletics | homebrew |
| `molotov` | Molotov Cocktail | 2 auto | A (fire) | 10 | — | — | J | fire · single use | homebrew |

#### Animal attacks

| ID | Name | Damage | Type | Conceal | Quirk | Source |
|---|---|---|---|---|---|---|
| `wolf_bite` | Wolf Bite & Claw | 4 | L | — |  | Bestiary |
| `dog_claw` | Dog Claw | 4 | L | — |  | Bestiary |
| `cat_claw` | Big Cat Claw | 4 | L | — |  | Bestiary |
| `dog_bite` | Dog Bite | 5 | L | — |  | Bestiary |
| `bear_bite` | Bear Bite | 5 | L | — |  | Bestiary |
| `cat_bite` | Big Cat Bite | 5 | L | — |  | Bestiary |
| `gator_tail` | Alligator Tail Slap | 6 | B | — | bashing | Bestiary |
| `bear_claw` | Bear Claw | 7 | L | — |  | Bestiary |
| `gator_bite` | Alligator Bite | 7 | L | — |  | Bestiary |

<!-- END:weapons -->

## Rules reference tables

<!-- BEGIN:reference -->
<!-- generated by tools/readme-tables.js; edit js/data.js and re-run -->

#### Creature kinds

| `kind` | Label | How it takes damage |
|---|---|---|
| `vampire` | Vampire | Soaks bashing and lethal with Stamina + Fortitude; aggravated with Fortitude only. Halves bashing after soak. Firearms do bashing unless aimed at the head. Torpor at Incapacitated + normal damage; Final Death from aggravated. |
| `ghoul` | Ghoul | Soaks bashing; soaks lethal only while it has vitae (blood pool above 0). Aggravated sources count as lethal. Does not halve bashing. |
| `mortal` | Mortal | Soaks bashing only (armor still helps against lethal). Aggravated sources count as lethal. Dies past Incapacitated. |
| `mage` | Mage | As mortal. |
| `werewolf` | Werewolf | Soaks everything with Stamina (not silver). Does not halve bashing. Battle form doubles Physical Attributes (status toggle). |
| `faerie` | Faerie | Soaks lethal; takes aggravated damage only from fire (other aggravated sources count as lethal). Does not halve bashing. |
| `wraith` | Wraith | Soaks lethal. Use Shadowlands Strength for fights. |
| `animal` | Animal | As mortal. Bestiary attacks are fixed dice pools. |

#### Armor

| `armor` | Armor | Soak bonus | Dexterity penalty |
|---|---|---|---|
| `0` | None | — | — |
| `1` | Class One (reinforced clothing) | +1 | — |
| `2` | Class Two (armor T-shirt) | +2 | −1 |
| `3` | Class Three (Kevlar vest) | +3 | −1 |
| `4` | Class Four (flak jacket) | +4 | −2 |
| `5` | Class Five (full riot gear) | +5 | −3 |

#### Health charts

| `health` | Levels |
|---|---|
| `standard` | Bruised, Hurt (-1), Injured (-1), Wounded (-2), Mauled (-2), Crippled (-5), Incapacitated |
| `extra` | Hurt (-1), Maimed (-3), Incapacitated — then dead |
| custom string | Comma-separated penalties: `OK` = no penalty, numbers like `-1`, and `Inc` for Incapacitated, e.g. `"OK,-1,-1,-3,-5,Inc"`. Without `Inc` the creature dies when the last box fills. |

#### Maneuvers (attack dialog)

| Weapon kind | Maneuver | Roll | Acc | Diff | Damage | Ammo | Notes |
|---|---|---|---|---|---|---|---|
| brawl | Strike | Dex + Brawl | — | — | weapon | — |  |
| brawl | Kick | Dex + Brawl | — | +1 | Str+1 | — |  |
| brawl | Clinch (C) | Str + Brawl | — | — | Str | — | Carries over; Str damage each turn. Escape: resisted Str + Brawl. |
| brawl | Hold (C) | Str + Brawl | — | — | none | — | No damage; target immobilized until it wins a resisted Str + Brawl. |
| brawl | Tackle (K) | Str + Brawl | — | +1 | Str+1 | — | Both roll Dex + Athletics (diff 7) or knockdown. Target +1 diff next turn. |
| brawl | Sweep (K) | Dex + Brawl | — | +1 | Str | — | Target rolls Dex + Athletics (diff 8) or knockdown. |
| brawl | Bite (A) | Dex + Brawl | +1 | — | Str+1 A | — | Requires a successful clinch, hold or tackle the previous turn. |
| melee | Weapon Strike | Dex + Melee | — | — | weapon | — |  |
| melee | Disarm | Dex + Melee | — | +1 | weapon | — | If damage successes exceed target Strength: no damage, target disarmed. |
| melee | Sweep (K) | Dex + Melee | — | +1 | weapon | — | Staff/chain. Target rolls Dex + Athletics (diff 8) or knockdown. |
| ranged | Single Shot | Dex + Firearms | — | — | weapon | 1 |  |
| ranged | 3-Round Burst | Dex + Firearms | +2 | +1 | weapon | 3 | burst-capable weapons only |
| ranged | Automatic Fire | Dex + Firearms | +10 | +2 | weapon | whole clip | Empties clip; clip must be at least half full. |
| ranged | Strafing | Dex + Firearms | +10 | +2 | weapon | whole clip | Divide successes among targets in 3 yards (single target gets half). Dodge +1 diff. |
| thrown | Throw | Dex + Athletics | — | — | weapon | — |  |

<!-- END:reference -->

---

## Data, backups and development

- **Storage keys** (`localStorage`): `vtm.pcs` (players), `vtm.combat` (current fight and log), `vtm.settings`, `vtm.customWeapons`, `vtm.customPresets` (My Enemies). Data is per browser and per site address: the live site and a local copy don't share it.
- **Backups:** export players with **Players → Configure… → Export JSON**. A prepared fight can be kept as an encounter link (see above).
- **Several tabs** of the tracker stay in sync automatically.
- **Files:** `index.html`, `css/styles.css`, `js/data.js` (rules data: creature kinds, health charts, armor, weapons, maneuvers and presets), `js/app.js` (the app).
- **Updating this README:** the preset, weapon and reference tables are generated from `js/data.js`. After changing the data, run:

  ```
  node tools/readme-tables.js
  ```

- **Not in the repository:** the rulebook text used as a local reference (copyrighted) and `preview.html`, a local page that shows the tracker in a fixed 1536×695 frame for layout testing.
