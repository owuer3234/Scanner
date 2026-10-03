# Ingredient Scanner (PWA)

Scan a barcode → look the product up on Open Food Facts / Open Beauty Facts → instant, offline ingredient analysis against a 4-tier database.

```
index.html            the whole app: CSS, ingredient database, analysis engine, UI
sw.js                 service worker (offline cache)
manifest.webmanifest  PWA manifest
icon*.png, icon.svg   app icons
zxing.min.js          local fallback copy of ZXing, used only if cdnjs is unreachable
```

## Run it

Phones only allow camera access and service workers over **HTTPS**, so host the folder on any static host:

- **GitHub Pages**: push this folder to a repo → Settings → Pages.
- **Netlify Drop**: drag the folder onto app.netlify.com/drop.
- **Cloudflare Pages / Vercel**: deploy as a static site, with no build command.

Local testing: `npx serve .` then open `http://localhost:3000` (localhost counts as secure).

**Install on your phone**
- **iPhone (Safari):** tap Share → Add to Home Screen.
- **Android (Chrome):** use the install icon in the app's top bar, or ⋮ → Install app.

## Editing the ingredient database

Everything is in `<script id="ingredient-db">` inside `index.html`:

- `GROUPS`: shared tier, label, one-sentence "why" and health effects.
- `INGREDIENTS`: `{ group: 'parabens', names: ['Methylparaben', 'E218', ...] }`. Any field can be overridden per entry. The options are `tier`, `why`, `effects`, `exact`, `onlyIn`, `tierIn`, `ethoxylated` and `benzeneRisk`, and they're documented at the top of the block.
- `CLASS_RULES`: pattern rules for chemical classes, such as `-paraben`, `fluoro-`, `-eth` and `dioxane`.
- `SAFE_INGREDIENTS`: known-clean names (tier 4).

Matching ignores case, accents and punctuation (`PEG-100` = `peg 100`, `Aluminium` = `aluminum`). Duplicate names are reported in the browser console as `[ingredient-db]` warnings.

**After you edit, bump `VERSION` in `sw.js`** (e.g. `'v2'`) so installed copies pick up the change.

## How the verdict works

- **AVOID**: anything in Tier 1, including inferred 1,4-dioxane when PEGs or `-eth` ingredients are present.
- **CAUTION**: the worst ingredient is in Tier 2 or 3.
- **CLEAN**: everything is Tier 4.

Names that aren't in the database get handled in one of two ways. A long or chemical-sounding name is flagged Tier 3. Any other name is assumed clean and listed under "Not in database" for you to review.

Tiers reflect a precautionary ruleset, not a medical or regulatory assessment.
