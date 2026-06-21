// Florida ad valorem tax engine for a NEW buyer.
//
// Key idea: when a property sells, the Save Our Homes assessment cap is removed
// and the assessed value resets to just/market value (≈ purchase price) for the
// new owner's first year. So we recompute taxable value from the purchase price,
// apply the new owner's exemptions, and multiply by the parcel's actual millage.
//
// Millage is split into two buckets because some exemptions apply only to
// non-school levies:
//   schoolMills    — uniform countywide (from county config)
//   nonSchoolMills — parcel's blended MILLRATE minus schoolMills
//
// All exemption amounts reflect Florida law as of 2025. They are ESTIMATES — the
// Property Appraiser determines actual eligibility and just value. Every figure
// here is editable in one place so it can be kept current.

const EXEMPTION_RULES = {
  // Homestead: $25k applies to ALL levies; an additional $25k applies to the
  // assessed value between $50k and $75k for NON-SCHOOL levies only.
  homesteadBasic: 25000,
  homesteadAdditional: 25000,
  homesteadAdditionalFloor: 50000,
  // Additional homestead for low-income seniors (65+), non-school only.
  // Polk County + participating municipalities adopt up to $50,000.
  seniorAdditional: 50000,
  // Long-term residency senior exemption: full exemption of the county/municipal
  // (non-school) portion if just value < $250k and 25+ years residence.
  seniorLongTermJustValueCap: 250000,
  // Disabled veteran (10%+ service-connected): flat $5,000, all levies.
  veteranDisabled: 5000,
  // Total & permanent disability (non-veteran): $500, all levies.
  disability500: 500,
  // Legally blind: $500, all levies.
  blind: 500,
  // Widow / widower: $5,000, all levies.
  widow: 5000,
};

function clampSub(value, exemption) {
  return Math.max(value - exemption, 0);
}

/**
 * @param {object} property  normalized property (from counties.normalize)
 * @param {number} purchasePrice  the new buyer's purchase price
 * @param {object} ex  selected exemptions / attestations:
 *   {
 *     homestead, senior, seniorLongTerm, incomeQualified,
 *     veteranDisabled, veteranTotal, combatDisabilityPct,
 *     disability500, disabilityTotal, blind, widow
 *   }
 */
function estimateNewBuyerTax(property, purchasePrice, ex = {}) {
  const notes = [];
  const schoolMills = property.schoolMills;
  const nonSchoolMills = Math.max(property.currentMillRate - schoolMills, 0);

  // New assessed value = just/market value. Use the purchase price the buyer
  // entered; fall back to the county's just value if none provided.
  const justValue =
    purchasePrice && purchasePrice > 0 ? purchasePrice : property.justValue;
  const assessed = justValue;

  // --- Full exemptions short-circuit everything ---
  const fullExemption =
    (ex.veteranTotal && true) || (ex.disabilityTotal && true);
  if (fullExemption) {
    if (ex.veteranTotal)
      notes.push("Total & permanent service-connected disability (or surviving spouse): full exemption from ad valorem tax.");
    if (ex.disabilityTotal)
      notes.push("Total & permanent disability (e.g. quadriplegic, or qualifying income-limited): full exemption from ad valorem tax.");
    return buildResult({
      property, justValue, assessed, schoolMills, nonSchoolMills,
      schoolTaxable: 0, nonSchoolTaxable: 0, combatPct: 0, notes,
      appliedExemptions: ["Full exemption"],
    });
  }

  // --- Build per-bucket exemption totals ---
  let schoolExemption = 0;
  let nonSchoolExemption = 0;
  const applied = [];

  if (ex.homestead) {
    const basic = Math.min(EXEMPTION_RULES.homesteadBasic, assessed);
    schoolExemption += basic;
    nonSchoolExemption += basic;
    let extra = 0;
    if (assessed > EXEMPTION_RULES.homesteadAdditionalFloor) {
      extra = Math.min(
        EXEMPTION_RULES.homesteadAdditional,
        assessed - EXEMPTION_RULES.homesteadAdditionalFloor
      );
      nonSchoolExemption += extra; // non-school only
    }
    applied.push(`Homestead ($${basic.toLocaleString()} all levies${extra ? ` + $${extra.toLocaleString()} non-school` : ""})`);
    notes.push("Homestead also caps future assessment growth at 3%/yr (Save Our Homes) starting the year after purchase.");

    if (ex.senior && ex.incomeQualified) {
      if (ex.seniorLongTerm && justValue < EXEMPTION_RULES.seniorLongTermJustValueCap) {
        nonSchoolExemption = assessed; // wipes out non-school taxable
        applied.push("Senior long-term residency (full non-school exemption)");
      } else {
        nonSchoolExemption += EXEMPTION_RULES.seniorAdditional;
        applied.push(`Senior additional ($${EXEMPTION_RULES.seniorAdditional.toLocaleString()} non-school)`);
      }
    } else if (ex.senior && !ex.incomeQualified) {
      notes.push("Senior exemption requires meeting the annual household-income limit; not applied because income eligibility was not confirmed.");
    }
  } else if (ex.senior) {
    notes.push("Senior exemptions require an active Homestead exemption; not applied.");
  }

  // Flat exemptions apply to ALL levies (both buckets).
  if (ex.veteranDisabled) {
    schoolExemption += EXEMPTION_RULES.veteranDisabled;
    nonSchoolExemption += EXEMPTION_RULES.veteranDisabled;
    applied.push(`Disabled veteran ($${EXEMPTION_RULES.veteranDisabled.toLocaleString()})`);
  }
  if (ex.disability500) {
    schoolExemption += EXEMPTION_RULES.disability500;
    nonSchoolExemption += EXEMPTION_RULES.disability500;
    applied.push(`Total/permanent disability ($${EXEMPTION_RULES.disability500} )`);
  }
  if (ex.blind) {
    schoolExemption += EXEMPTION_RULES.blind;
    nonSchoolExemption += EXEMPTION_RULES.blind;
    applied.push(`Legally blind ($${EXEMPTION_RULES.blind})`);
  }
  if (ex.widow) {
    schoolExemption += EXEMPTION_RULES.widow;
    nonSchoolExemption += EXEMPTION_RULES.widow;
    applied.push(`Widow/widower ($${EXEMPTION_RULES.widow.toLocaleString()})`);
  }

  const schoolTaxable = clampSub(assessed, schoolExemption);
  const nonSchoolTaxable = clampSub(assessed, nonSchoolExemption);

  // Combat-related disability discount (65+): a percentage discount on the tax
  // itself, applied after exemptions, to all levies.
  let combatPct = 0;
  if (ex.combatDisabilityPct && Number(ex.combatDisabilityPct) > 0) {
    combatPct = Math.min(Number(ex.combatDisabilityPct), 100);
    applied.push(`Combat-related disability discount (${combatPct}%)`);
  }

  return buildResult({
    property, justValue, assessed, schoolMills, nonSchoolMills,
    schoolTaxable, nonSchoolTaxable, combatPct, notes,
    appliedExemptions: applied.length ? applied : ["None"],
  });
}

function buildResult({
  property, justValue, assessed, schoolMills, nonSchoolMills,
  schoolTaxable, nonSchoolTaxable, combatPct, notes, appliedExemptions,
}) {
  const schoolTax = (schoolTaxable * schoolMills) / 1000;
  const nonSchoolTax = (nonSchoolTaxable * nonSchoolMills) / 1000;
  let adValorem = schoolTax + nonSchoolTax;
  if (combatPct > 0) adValorem = adValorem * (1 - combatPct / 100);

  const nonAdValorem = property.nonAdValorem;
  const total = adValorem + nonAdValorem;

  return {
    justValue: r2(justValue),
    assessedValue: r2(assessed),
    schoolMills: r3(schoolMills),
    nonSchoolMills: r3(nonSchoolMills),
    totalMills: r3(schoolMills + nonSchoolMills),
    schoolTaxableValue: r2(schoolTaxable),
    nonSchoolTaxableValue: r2(nonSchoolTaxable),
    adValorem: r2(adValorem),
    nonAdValorem: r2(nonAdValorem),
    totalEstimatedTax: r2(total),
    appliedExemptions,
    notes,
    // For side-by-side comparison with the current owner's bill:
    current: {
      taxableValue: property.currentTaxableValue,
      adValorem: property.currentAdValorem,
      nonAdValorem: property.nonAdValorem,
      total: property.currentAmountDue,
      millRate: property.currentMillRate,
    },
  };
}

const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;

module.exports = { estimateNewBuyerTax, EXEMPTION_RULES };
