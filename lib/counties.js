// County data adapters.
//
// Each county exposes a free ArcGIS REST FeatureServer published by its Property
// Appraiser. We query it directly (no API key, no cost). To add Orange or Osceola
// later, add another entry here with its endpoint + field mapping and a normalize()
// function — the rest of the app is county-agnostic.

const POLK = {
  id: "polk",
  name: "Polk County",
  // Free ArcGIS REST layer published by the Polk County Property Appraiser.
  endpoint:
    "https://gis.polk-county.net/server/rest/services/Map_Property_Appraiser/FeatureServer/1/query",
  // Countywide school millage (uniform across the county). Used to split the
  // homestead exemption (the extra $25k applies to non-school levies only).
  // Source: Polk County School Board 2025-26 certified millage = 5.29 mills
  // (RLE 3.042 + discretionary 0.748 + capital 1.5). Update each year.
  schoolMills: 5.29,
  // Where a buyer can view the official, itemized tax bill (incl. exact NAV lines).
  taxCollectorBillUrl: (parcelId) =>
    `https://www.polktaxes.com/searchpublicrecords.aspx`,
  // Build a WHERE clause from a parsed address.
  buildWhere(parsed) {
    const clauses = [];
    if (parsed.number) clauses.push(`PROP_ADRNO = ${parsed.number}`);
    if (parsed.street) {
      const safe = parsed.street.replace(/'/g, "''").toUpperCase();
      clauses.push(`UPPER(PROP_ADRSTR) LIKE '%${safe}%'`);
    }
    if (parsed.city) {
      const safeCity = parsed.city.replace(/'/g, "''").toUpperCase();
      clauses.push(`UPPER(PROP_CITY) LIKE '%${safeCity}%'`);
    }
    return clauses.length ? clauses.join(" AND ") : "1=0";
  },
  outFields: [
    "PARCELID", "NAME",
    "PROP_ADRNO", "PROP_ADRDIR", "PROP_ADRSTR", "PROP_ADRSUF", "PROP_UNITNO",
    "PROP_CITY", "PROP_ZIP",
    "TOTALVAL", "ASSESSVAL", "TAXVAL", "MILLRATE", "AMTDUE",
    "HMSTD", "EXDESC", "OTHEREX", "HMSTD_VAL", "TAXDIST",
    "DOR_USE_CODE_DESC",
  ],
  // Turn a raw ArcGIS attribute bag into our normalized property shape.
  normalize(a) {
    const addressParts = [
      a.PROP_ADRNO,
      (a.PROP_ADRDIR || "").trim(),
      (a.PROP_ADRSTR || "").trim(),
      (a.PROP_ADRSUF || "").trim(),
      (a.PROP_UNITNO || "").trim() ? `# ${(a.PROP_UNITNO || "").trim()}` : "",
    ].filter(Boolean);

    const justValue = num(a.TOTALVAL);
    const taxableNow = num(a.TAXVAL);
    const millRate = num(a.MILLRATE);
    const amountDue = num(a.AMTDUE);

    // Derive the ACTUAL non-ad valorem charge from the official current bill:
    //   amount due  =  (current taxable x current millage)  +  non-ad valorem
    // so NAV = amountDue - currentAdValorem. This pulls the real NAV total from
    // county records without scraping the tax-collector site.
    const currentAdValorem = (taxableNow * millRate) / 1000;
    let nonAdValorem = amountDue - currentAdValorem;
    // Guard against rounding / early-payment discount noise.
    if (!isFinite(nonAdValorem) || nonAdValorem < 0) nonAdValorem = 0;
    nonAdValorem = Math.round(nonAdValorem * 100) / 100;

    return {
      county: this.id,
      countyName: this.name,
      parcelId: a.PARCELID,
      owner: (a.NAME || "").trim(),
      address: addressParts.join(" ").replace(/\s+/g, " ").trim(),
      city: (a.PROP_CITY || "").trim(),
      zip: (a.PROP_ZIP || "").trim(),
      useCode: (a.DOR_USE_CODE_DESC || "").trim(),
      taxDistrict: (a.TAXDIST || "").trim(),
      justValue,                       // market value = new buyer's starting base
      currentAssessedValue: num(a.ASSESSVAL), // SOH-capped (current owner)
      currentTaxableValue: taxableNow,
      currentMillRate: millRate,
      schoolMills: this.schoolMills,
      currentAmountDue: amountDue,
      currentAdValorem: round2(currentAdValorem),
      nonAdValorem,                    // actual, derived from the official bill
      currentlyHomestead: (a.HMSTD || "").trim().toUpperCase() === "Y",
      currentExemptions: (a.EXDESC || "").trim(),
      billUrl: this.taxCollectorBillUrl(a.PARCELID),
    };
  },
};

const COUNTIES = { polk: POLK };

function num(v) {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

function getCounty(id) {
  return COUNTIES[id] || POLK;
}

module.exports = { COUNTIES, getCounty, POLK };
