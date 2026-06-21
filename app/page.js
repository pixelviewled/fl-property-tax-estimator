"use client";

import { useMemo, useState } from "react";
import { estimateNewBuyerTax } from "../lib/tax";

const fmt = (n) =>
  "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) =>
  "$" + Math.round(Number(n) || 0).toLocaleString("en-US");

const COUNTY_TABS = [
  { id: "polk", name: "Polk", active: true },
  { id: "orange", name: "Orange", active: false },
  { id: "osceola", name: "Osceola", active: false },
];

const DEFAULT_EX = {
  homestead: false,
  senior: false,
  incomeQualified: false,
  seniorLongTerm: false,
  veteranDisabled: false,
  veteranTotal: false,
  combatDisabilityPct: "",
  disability500: false,
  disabilityTotal: false,
  blind: false,
  widow: false,
};

export default function Home() {
  const [county] = useState("polk");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(null);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [ex, setEx] = useState(DEFAULT_EX);

  async function runSearch(e) {
    e && e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setResults(null);
    setSelected(null);
    try {
      const res = await fetch(`/api/search?county=${county}&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed.");
      setResults(data.results);
      if (data.results.length === 1) selectProperty(data.results[0]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  function selectProperty(p) {
    setSelected(p);
    setResults(null);
    setPurchasePrice(String(p.justValue || ""));
  }

  const estimate = useMemo(() => {
    if (!selected) return null;
    const price = parseFloat(String(purchasePrice).replace(/[^0-9.]/g, "")) || 0;
    return estimateNewBuyerTax(selected, price, {
      ...ex,
      combatDisabilityPct: parseFloat(ex.combatDisabilityPct) || 0,
    });
  }, [selected, purchasePrice, ex]);

  const set = (k) => (e) =>
    setEx((prev) => ({ ...prev, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const delta = estimate ? estimate.totalEstimatedTax - selected.currentAmountDue : 0;

  return (
    <div className="wrap">
      <header className="hero">
        <h1>Florida Property Tax Estimator</h1>
        <p>
          Search a property, enter what you'd pay for it, and see the estimated taxes for you as the
          new owner — ad valorem recalculated after the sale, plus the actual non-ad valorem charges
          pulled from county records.
        </p>
      </header>

      <div className="county-tabs">
        {COUNTY_TABS.map((c) => (
          <button
            key={c.id}
            className={`${c.id === county ? "active" : ""} ${c.active ? "" : "soon"}`}
            disabled={!c.active}
            title={c.active ? "" : "Coming soon"}
          >
            {c.name} County{c.active ? "" : " · soon"}
          </button>
        ))}
      </div>

      {/* SEARCH */}
      <div className="card">
        <form onSubmit={runSearch}>
          <label htmlFor="q">
            Search by property address <span className="hint">(Polk County)</span>
          </label>
          <div className="row">
            <input
              id="q"
              type="text"
              placeholder="e.g. 13411 Old Dade City Rd, Kathleen"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: "3 1 320px" }}
            />
            <button type="submit" disabled={searching} style={{ flex: "0 0 auto" }}>
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
        </form>
        {error && <div className="error">{error}</div>}

        {results && results.length === 0 && (
          <div className="error">No matching parcels found. Try just the street name, or add a city.</div>
        )}
        {results && results.length > 1 && (
          <ul className="results-list">
            {results.map((p) => (
              <li key={p.parcelId} onClick={() => selectProperty(p)}>
                <span>
                  <span className="addr">{p.address || "(no situs address)"}</span>
                  <br />
                  <span className="sub">
                    {p.city} {p.zip} · {p.owner} · Parcel {p.parcelId}
                  </span>
                </span>
                <span className="sub">{fmt0(p.justValue)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* SELECTED PROPERTY */}
      {selected && (
        <>
          <div className="card">
            <h3 className="section-title">{selected.address || "Selected parcel"}</h3>
            <div className="kv"><span className="k">Parcel ID</span><span className="v">{selected.parcelId}</span></div>
            <div className="kv"><span className="k">Owner of record</span><span className="v">{selected.owner || "—"}</span></div>
            <div className="kv"><span className="k">Use</span><span className="v">{selected.useCode || "—"}</span></div>
            <div className="kv"><span className="k">Just (market) value</span><span className="v">{fmt0(selected.justValue)}</span></div>
            <div className="kv"><span className="k">Current assessed (SOH-capped)</span><span className="v">{fmt0(selected.currentAssessedValue)}</span></div>
            <div className="kv"><span className="k">Current taxable value</span><span className="v">{fmt0(selected.currentTaxableValue)}</span></div>
            <div className="kv"><span className="k">Current total millage</span><span className="v">{selected.currentMillRate.toFixed(4)}</span></div>
            <div className="kv"><span className="k">Current exemptions on file</span><span className="v">{selected.currentExemptions || (selected.currentlyHomestead ? "Homestead" : "None")}</span></div>
            <div className="kv">
              <span className="k">Actual non-ad valorem (this year)</span>
              <span className="v">{fmt(selected.nonAdValorem)}</span>
            </div>
            <div className="kv"><span className="k">Current owner's total bill</span><span className="v">{fmt(selected.currentAmountDue)}</span></div>
          </div>

          {/* INPUTS */}
          <div className="card">
            <h3 className="section-title">Your purchase &amp; exemptions</h3>
            <label htmlFor="price">
              Purchase price <span className="hint">— resets the assessed value to market for you, the new owner</span>
            </label>
            <input
              id="price"
              type="text"
              inputMode="numeric"
              value={purchasePrice ? Number(String(purchasePrice).replace(/[^0-9.]/g, "")).toLocaleString("en-US") : ""}
              onChange={(e) => setPurchasePrice(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder={fmt0(selected.justValue)}
              style={{ maxWidth: 240 }}
            />

            <div style={{ height: 18 }} />
            <label>Exemptions you expect to qualify for</label>
            <div className="exemptions">
              <Chk label="Homestead" desc="Primary residence. $25k all levies + up to $25k more on non-school." checked={ex.homestead} onChange={set("homestead")} />
              <Chk label="Widow / Widower" desc="$5,000 exemption." checked={ex.widow} onChange={set("widow")} />
              <Chk label="Senior (65+) low-income" desc="Requires Homestead + income limit. Up to $50k on non-school." checked={ex.senior} onChange={set("senior")} />
              <Chk label="Disabled veteran (10%+)" desc="$5,000 service-connected disability exemption." checked={ex.veteranDisabled} onChange={set("veteranDisabled")} />
              <Chk label="Veteran — total &amp; permanent" desc="Service-connected total disability or surviving spouse: full exemption." checked={ex.veteranTotal} onChange={set("veteranTotal")} />
              <Chk label="Legally blind" desc="$500 exemption." checked={ex.blind} onChange={set("blind")} />
              <Chk label="Total &amp; permanent disability" desc="Quadriplegic / qualifying income-limited: full exemption." checked={ex.disabilityTotal} onChange={set("disabilityTotal")} />
              <Chk label="Disability ($500)" desc="Total/permanent disability $500 exemption." checked={ex.disability500} onChange={set("disability500")} />
            </div>

            {ex.senior && (
              <div className="sub-field">
                <Chk small label="I meet the household income limit" desc="Required for the senior exemption." checked={ex.incomeQualified} onChange={set("incomeQualified")} />
                <Chk small label="Long-term residency (25+ yrs, home value < $250k)" desc="Full exemption of the county/municipal portion." checked={ex.seniorLongTerm} onChange={set("seniorLongTerm")} />
              </div>
            )}

            <div className="sub-field" style={{ paddingLeft: 0, marginTop: 14 }}>
              <label htmlFor="combat">
                Combat-related disability discount (65+){" "}
                <span className="hint">— % discount equal to your disability rating</span>
              </label>
              <input id="combat" type="number" min="0" max="100" placeholder="0" value={ex.combatDisabilityPct} onChange={set("combatDisabilityPct")} />
              <span className="hint"> %</span>
            </div>
          </div>

          {/* RESULTS */}
          {estimate && (
            <div className="card">
              <h3 className="section-title">Estimated taxes for you (new owner)</h3>
              <div className="kv"><span className="k">New assessed / just value</span><span className="v">{fmt0(estimate.assessedValue)}</span></div>
              <div className="kv"><span className="k">Taxable — non-school</span><span className="v">{fmt0(estimate.nonSchoolTaxableValue)}</span></div>
              <div className="kv"><span className="k">Taxable — school</span><span className="v">{fmt0(estimate.schoolTaxableValue)}</span></div>
              <div className="kv"><span className="k">Millage (school {estimate.schoolMills} + non-school {estimate.nonSchoolMills})</span><span className="v">{estimate.totalMills}</span></div>

              <div className="totals">
                <div className="kv" style={{ borderBottom: "1px dashed #6ee7b7" }}>
                  <span className="k">Ad valorem (recalculated)</span><span className="v">{fmt(estimate.adValorem)}</span>
                </div>
                <div className="kv" style={{ borderBottom: "1px dashed #6ee7b7" }}>
                  <span className="k">Non-ad valorem (actual, from county bill)</span><span className="v">{fmt(estimate.nonAdValorem)}</span>
                </div>
                <div className="grand">
                  <span className="k">Estimated annual tax</span>
                  <span className="v">{fmt(estimate.totalEstimatedTax)}</span>
                </div>
              </div>

              <div className="compare">
                <div className="box">
                  <h4>Current owner pays</h4>
                  <div className="amt">{fmt(selected.currentAmountDue)}</div>
                </div>
                <div className="box">
                  <h4>You would pay (est.)</h4>
                  <div className="amt">{fmt(estimate.totalEstimatedTax)}</div>
                  <div className={`delta ${delta >= 0 ? "up" : "down"}`}>
                    {delta >= 0 ? "▲ " : "▼ "}
                    {fmt(Math.abs(delta))} {delta >= 0 ? "more" : "less"} per year
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                {estimate.appliedExemptions.map((x, i) => (
                  <span className="tag" key={i}>{x}</span>
                ))}
              </div>

              {estimate.notes.length > 0 && (
                <ul className="notes">
                  {estimate.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}

              <p className="notes" style={{ marginTop: 12 }}>
                Want the exact, itemized bill (every non-ad valorem line)?{" "}
                <a href={selected.billUrl} target="_blank" rel="noreferrer">
                  Look up this parcel at the Polk County Tax Collector →
                </a>
              </p>
            </div>
          )}
        </>
      )}

      <p className="disclaimer">
        <strong>Estimate only.</strong> This tool recalculates ad valorem tax by removing the Save Our
        Homes cap (assessed value resets to market value when a property changes hands) and applying
        the parcel's actual current millage. Non-ad valorem assessments are derived from the property's
        current official tax amount and assumed unchanged for the new owner; early-payment discounts can
        affect that figure slightly. Exemption amounts reflect Florida law as of 2025 and assume you
        qualify — the County Property Appraiser determines actual eligibility, just value, and final
        millage. The school-vs-non-school millage split uses Polk's countywide school millage (5.29) to
        apply the additional homestead and senior exemptions correctly. Verify any number against the
        official county Property Appraiser and Tax Collector before relying on it. Data: Polk County
        Property Appraiser public GIS (free, no API key).
      </p>
    </div>
  );
}

function Chk({ label, desc, checked, onChange, small }) {
  return (
    <label className="chk" style={small ? { background: "transparent", border: 0, padding: "4px 0" } : undefined}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>
        {label}
        {desc && <span className="desc">{desc}</span>}
      </span>
    </label>
  );
}
