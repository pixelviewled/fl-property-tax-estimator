// Address search endpoint. Runs server-side (a Netlify serverless function in
// production) so we avoid browser CORS issues and keep county logic on the server.

import { NextResponse } from "next/server";
import { getCounty } from "../../../lib/counties";
import { parseAddress } from "../../../lib/address";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const countyId = searchParams.get("county") || "polk";

  const parsed = parseAddress(q);
  if (!parsed.number && !parsed.street) {
    return NextResponse.json(
      { error: "Enter at least a street name (e.g. '123 Main St, Lakeland')." },
      { status: 400 }
    );
  }

  const county = getCounty(countyId);
  const where = county.buildWhere(parsed);

  const params = new URLSearchParams({
    where,
    outFields: county.outFields.join(","),
    returnGeometry: "false",
    orderByFields: "PROP_ADRNO",
    resultRecordCount: "25",
    f: "json",
  });

  try {
    const res = await fetch(`${county.endpoint}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `County GIS service returned ${res.status}.` },
        { status: 502 }
      );
    }
    const data = await res.json();
    if (data.error) {
      return NextResponse.json(
        { error: data.error.message || "County GIS query error." },
        { status: 502 }
      );
    }

    const results = (data.features || [])
      .map((f) => county.normalize(f.attributes))
      .filter((p) => p.parcelId);

    return NextResponse.json({ count: results.length, results });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not reach the county GIS service. Try again." },
      { status: 502 }
    );
  }
}
