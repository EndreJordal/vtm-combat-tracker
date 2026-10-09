# V:TM Combat Tracker

A combat and initiative tracker for *Vampire: The Masquerade Revised Edition*. It's plain HTML, CSS and JS with no build step. Open `index.html`, or serve the folder with something like `python -m http.server`.

## Features
- **Turn flow from Chapter Six.** Initiative is 1d10 + Dex + Wits − wound penalty, re-rolled every turn. Ties go to the higher rating, then act simultaneously. The slowest character declares first, then everyone acts from fastest to slowest. Characters can delay. Celerity and other multiple actions happen at the end of the turn.
- **Health tracking.** Bashing, lethal and aggravated damage go on the standard 7-level chart, the optional "Extras" chart, or a custom chart. Aggravated damage is always marked above normal damage. The tracker handles torpor and Final Death. You can damage or heal any type, and vampires can heal with blood.
- **Attack wizard.** It covers maneuvers, range, cover, targeting, flank/rear bonuses, multiple opponents, multiple actions, aiming and Willpower. It then walks through defense (dodge, block, parry), damage (extra successes, Potence) and soak. Soak depends on the creature type: undead halve bashing damage, mortals can't soak lethal, firearms do bashing damage to Kindred, fire ignores armor, and werewolves soak with Stamina. It also flags dazed, staked and disarmed results.
- **Preset antagonists.** Every Chapter Nine template is included, along with a few Bestiary animals and generic Kindred. Each preset comes with a weapon loadout that you can change under **Edit → Weapon loadout**.
- **Weapon catalog.** Includes the Melee and Ranged Weapons Charts. You can add your own weapons, and they're saved in localStorage.
- **Players.** Set up your player characters under **Players**. They're saved in localStorage and you can add them to any combat in one click.
- **Encounter links.** Use **Share link** to get a URL that starts the current encounter.

## Encounter link payload
`index.html#encounter=<base64url(JSON)>`. Plain JSON also works: `#encounter={"combatants":[...]}`.

```json
{
  "v": 1,
  "name": "Warehouse ambush",
  "pcs": true,
  "combatants": [
    { "preset": "inquisitor", "count": 2 },
    { "preset": "gov_agent", "name": "Agent Smith", "weapons": ["shotgun", "knife"], "armor": 3 },
    { "preset": "were_vet", "dmg": { "b": 0, "l": 2, "a": 0 } },
    { "pc": "Anna" },
    { "custom": { "name": "Lasombra Elder", "kind": "vampire",
        "attrs": [4,4,4,3,4,3,3,3,4], "abil": "Brawl 4, Dodge 3, Melee 3",
        "disc": "Fortitude 3, Potence 2, Obtenebration 4",
        "wp": 8, "bp": 20, "weapons": ["sword"] } }
  ]
}
```

- `pcs`: `true` adds all saved players. You can also give a list of names, for example `["Anna", "Mikkel"]`.
- `attrs` order: Str, Dex, Sta, Cha, Man, App, Per, Int, Wits.
- `kind`: vampire, ghoul, mortal, mage, werewolf, faerie, wraith or animal.
- `health`: `standard`, `extra`, or a custom chart such as `"OK,-1,-2,-5,Inc"`.
- Preset entries accept the same override fields as custom combatants.
- If a link uses custom weapons, their definitions are embedded under `"weapons": [...]`.

The **Share link** dialog lists every preset ID and weapon ID. You can also edit the JSON there and rebuild the link.
