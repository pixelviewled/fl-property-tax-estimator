// Plain-node sanity tests (no test framework needed): node test/engine.test.js
const assert = require("assert");
const { POLK } = require("../lib/counties");
const { estimateNewBuyerTax } = require("../lib/tax");

let pass = 0;
const ok = (name, cond) => { assert.ok(cond, name); console.log("  ok  " + name); pass++; };
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;

// Real Polk parcel pulled from the county GIS (Tarvin, Kathleen).
const raw = {
  PARCELID: "222601000010000250", NAME: "TARVIN CHELSEA P",
  PROP_ADRNO: 13411, PROP_ADRDIR: "  ", PROP_ADRSTR: "OLD DADE CITY", PROP_ADRSUF: "RD",
  PROP_UNITNO: "", PROP_CITY: "KATHLEEN", PROP_ZIP: "33849",
  TOTALVAL: 472172, ASSESSVAL: 375092, TAXVAL: 324370, MILLRATE: 12.9289999,
  AMTDUE: 4329.88, HMSTD: "Y", EXDESC: null, OTHEREX: null, HMSTD_VAL: 51411,
  TAXDIST: "90000", DOR_USE_CODE_DESC: "SFR up to 2.49 AC",
};

const prop = POLK.normalize(raw);

console.log("normalize():");
ok("address built", prop.address === "13411 OLD DADE CITY RD");
ok("just value", prop.justValue === 472172);
ok("NAV derived from real bill ≈ $136.10", near(prop.nonAdValorem, 136.1, 0.05));
ok("current ad valorem ≈ $4193.78", near(prop.currentAdValorem, 4193.78, 0.5));
ok("homestead flag read", prop.currentlyHomestead === true);

console.log("estimateNewBuyerTax():");
// Scenario A: $500k purchase, homestead only.
const a = estimateNewBuyerTax(prop, 500000, { homestead: true });
ok("A assessed resets to purchase price", a.assessedValue === 500000);
ok("A non-school taxable = 500k - 50k", a.nonSchoolTaxableValue === 450000);
ok("A school taxable = 500k - 25k", a.schoolTaxableValue === 475000);
// school 475000*5.29/1000 + nonschool 450000*7.639/1000 = 2512.75 + 3437.55
ok("A ad valorem ≈ $5950.30", near(a.adValorem, 5950.3, 0.5));
ok("A NAV unchanged", a.nonAdValorem === prop.nonAdValorem);
ok("A total = adval + nav", near(a.totalEstimatedTax, a.adValorem + a.nonAdValorem));

// Scenario B: no exemptions — full market value taxed at blended millage.
const b = estimateNewBuyerTax(prop, 500000, {});
ok("B ad valorem ≈ 500000*12.929/1000 = 6464.50", near(b.adValorem, 6464.5, 0.5));

// Scenario C: veteran total => full exemption (ad valorem 0, NAV remains).
const c = estimateNewBuyerTax(prop, 500000, { veteranTotal: true });
ok("C ad valorem is 0", c.adValorem === 0);
ok("C total equals NAV only", c.totalEstimatedTax === prop.nonAdValorem);

// Scenario D: homestead + senior (income qualified) adds $50k non-school.
const d = estimateNewBuyerTax(prop, 500000, { homestead: true, senior: true, incomeQualified: true });
ok("D non-school taxable = 500k - 50k - 50k", d.nonSchoolTaxableValue === 400000);

// Scenario E: combat 50% discount halves the ad valorem.
const e = estimateNewBuyerTax(prop, 500000, { homestead: true, combatDisabilityPct: 50 });
ok("E ad valorem is half of A", near(e.adValorem, a.adValorem / 2, 0.5));

// Scenario F: low-value home, homestead wipes out most value.
const f = estimateNewBuyerTax(prop, 60000, { homestead: true });
// non-school: 60000 - 25000 - 10000(=60000-50000) = 25000 ; school: 60000-25000=35000
ok("F non-school taxable = 25000", f.nonSchoolTaxableValue === 25000);
ok("F school taxable = 35000", f.schoolTaxableValue === 35000);

console.log(`\nAll ${pass} assertions passed.`);
