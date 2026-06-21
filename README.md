# Florida Property Tax Estimator

A free, open-source web app that estimates Florida property taxes **for a new buyer**:
search a property by address, enter your purchase price, and see the ad valorem tax
recalculated after the sale, plus the **actual** non-ad valorem charges pulled from
county records, with support for Homestead, Senior, Veteran, and Disability exemptions.

**Currently live for Polk County.** Orange and Osceola are scaffolded to drop in next
(see "Adding a county" below).

No paid APIs. Stack: **Next.js + Node** (deployable free on Netlify).

There are two ways to run this:

- **`standalone.html`** — a single self-contained file. Open it in any browser (or host
  it on any static host / Netlify Drop) and it works immediately, calling the Polk County
  GIS via JSONP. No build, no server.
- **The Next.js app** — the full version with a serverless API route. Deploy free on Netlify.

---

## How it works

| Requirement | How it's met (free) |
|---|---|
| Search by address | Queries the Polk County Property Appraiser's public **ArcGIS REST** layer — no API key, no cost. |
| Enter purchase price | The price becomes the new owner's just/market value base. |
| Recalculate ad valorem | On sale, the **Save Our Homes** cap is removed and assessed value resets to market. We recompute taxable value, apply your exemptions, and multiply by the parcel's actual current millage. |
| Actual non-ad valorem | Derived from the parcel's official current bill: `NAV = AMTDUE - (current taxable x current millage)`. No scraping. A link to the Tax Collector is provided for the exact itemized lines. |
| Exemptions | Homestead, Senior (low-income + long-term residency), Disabled Veteran, Veteran total disability, Total/permanent disability, Legally blind, Widow/Widower, and combat-disability discount — encoded as Florida 2025 rules in `lib/tax.js`. |

### Why the millage is split (school vs non-school)
Some exemptions (the extra $25k homestead and the senior exemption) apply only to
**non-school** levies. The app uses Polk's **countywide school millage (5.29 mills)** —
set in `lib/counties.js` — to split the parcel's blended rate and apply those
exemptions correctly. Update this number each year.

---

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Test the tax engine

```bash
node test/engine.test.js
```

Runs 18 assertions, including the non-ad-valorem derivation and every exemption path,
validated against a real Polk County parcel.

---

## Deploy free on Netlify

Yes — Netlify runs Next.js (including the API route as a serverless function) out of the box.

1. In Netlify: **Add new site -> Import an existing project** -> pick this repo.
2. Netlify auto-detects Next.js. Defaults are correct (`netlify.toml` is included):
   - Build command: `npm run build`
   - It installs `@netlify/plugin-nextjs` automatically.
3. Deploy. You get a public `https://<your-site>.netlify.app` URL.

(Alternatively, drag `standalone.html` onto https://app.netlify.com/drop for an instant static deploy.)

---

## Adding a county (Orange / Osceola)

Both counties publish the same kind of free ArcGIS REST parcel layer:

- Orange: https://data-ocpw.opendata.arcgis.com/
- Osceola: https://data-ocpagis.opendata.arcgis.com/

To add one, add an entry to `COUNTIES` in `lib/counties.js` with its `endpoint`,
`schoolMills`, and field mapping (`buildWhere`, `outFields`, `normalize`). Then flip the
county to `active: true` in `app/page.js`. The UI and tax engine are county-agnostic.

---

## Important: this is an estimate

The County Property Appraiser determines actual just value and exemption eligibility; the
Tax Collector sets the final bill. Non-ad valorem charges are assumed unchanged for the
new owner, and early-payment discounts can slightly affect the derived figure. Verify any
number against the official county sources before relying on it.

### Data sources
- Polk County Property Appraiser GIS: `https://gis.polk-county.net/server/rest/services/Map_Property_Appraiser/FeatureServer/1`
- Polk County Tax Collector (itemized bills & millage): https://www.polktaxes.com/
