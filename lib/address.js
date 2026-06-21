// Very forgiving address parser. We only need a house number + street name to
// query the parcel layer; suffixes/directions are matched loosely with LIKE.

const SUFFIXES = new Set([
  "ST", "STREET", "AVE", "AVENUE", "RD", "ROAD", "DR", "DRIVE", "LN", "LANE",
  "CT", "COURT", "BLVD", "BOULEVARD", "WAY", "PL", "PLACE", "TER", "TERRACE",
  "CIR", "CIRCLE", "TRL", "TRAIL", "PKWY", "PARKWAY", "HWY", "HIGHWAY", "LOOP",
]);
const DIRECTIONS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);

function parseAddress(input) {
  const raw = (input || "").trim();
  if (!raw) return { number: null, street: "", city: "" };

  // Split off a trailing city if a comma is present: "123 Main St, Lakeland"
  let city = "";
  let main = raw;
  const comma = raw.indexOf(",");
  if (comma !== -1) {
    main = raw.slice(0, comma).trim();
    city = raw
      .slice(comma + 1)
      .replace(/\bFL\b.*/i, "")
      .replace(/\d{5}(-\d{4})?/, "")
      .trim();
  }

  const tokens = main.split(/\s+/);
  let number = null;
  if (tokens.length && /^\d+$/.test(tokens[0])) {
    number = parseInt(tokens.shift(), 10);
  }

  // Drop a leading direction and trailing suffix/direction so the LIKE match on
  // the street NAME stays broad (the layer stores name separately from suffix).
  const cleaned = tokens.filter((t, i) => {
    const u = t.toUpperCase().replace(/[.,]/g, "");
    if (i === 0 && DIRECTIONS.has(u)) return false;
    if (i === tokens.length - 1 && (SUFFIXES.has(u) || DIRECTIONS.has(u))) return false;
    return true;
  });

  const street = cleaned.join(" ").replace(/[.,]/g, "").trim();
  return { number, street, city };
}

module.exports = { parseAddress };
