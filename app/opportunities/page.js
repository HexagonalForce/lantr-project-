"use client";

import { useEffect, useState } from "react";

const terminalStates = new Set(["done", "error", "cancelled"]);
const seconds = (value) => `${Math.floor(Number(value || 0) / 60)}m ${Number(value || 0) % 60}s`;

export default function OpportunitiesPage() {
  const [warm, setWarm] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const isRunning = job?.status === "running";

  useEffect(() => {
    if (!isRunning || !job?.id || !password) return undefined;
    let live = true;
    const check = async () => {
      try {
        const response = await fetch(`/api/opportunities/${job.id}`, { headers: { "x-site-password": password }, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not check the job.");
        if (live) {
          setJob(payload);
          if (terminalStates.has(payload.status)) setPassword("");
        }
      } catch (requestError) {
        if (live) setError(requestError.message || "Could not check the job.");
      }
    };
    check();
    const timer = window.setInterval(check, 3_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [isRunning, job?.id, password]);

  async function startJob(event) {
    event.preventDefault();
    setError("");
    setStarting(true);
    try {
      const response = await fetch("/api/opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not start the job.");
      setJob({ id: payload.id, status: payload.status, progress: { searches: 0, pageReads: 0, elapsedSeconds: 0, toolCalls: [] } });
      setShowPassword(false);
    } catch (requestError) {
      setError(requestError.message || "Could not start the job.");
    } finally { setStarting(false); }
  }

  async function cancelJob() {
    if (!job?.id) return;
    setError("");
    try {
      const response = await fetch(`/api/opportunities/${job.id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not cancel the job.");
      setJob(payload);
      setPassword("");
    } catch (requestError) { setError(requestError.message || "Could not cancel the job."); }
  }

  const progress = job?.progress;
  const results = job?.results;
  return <main className={`site-shell opportunities-shell ${warm ? "warm" : ""}`}>
    <header className="compact-header">
      <a className="wordmark" href="/" aria-label="Aaron Yu home">AY<span>.</span></a>
      <p>Personal corner of the internet · Auckland</p>
      <nav className="site-menu" aria-label="Main navigation"><a href="/">Home</a><a aria-current="page" href="/opportunities">Opportunities</a></nav>
      <button className="warm-toggle" type="button" onClick={() => setWarm((current) => !current)} aria-pressed={warm}><span aria-hidden="true">{warm ? "Sun" : "Moon"}</span> {warm ? "Cool mode" : "Warm mode"}</button>
    </header>

    <section className="opportunities-hero">
      <p className="eyebrow">07 / Opportunities</p><h1>Things I might apply for.</h1>
      <p>Current options in music, maths, science, and gaming, checked before they appear here.</p>
      <button className="refresh-button" type="button" onClick={() => setShowPassword((value) => !value)} disabled={isRunning || starting}>{isRunning ? "Researching…" : "Refresh opportunities"}</button>
      {showPassword && !isRunning && <form className="password-form" onSubmit={startJob}><label htmlFor="site-password">Site password</label><input id="site-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button className="small-action" type="submit" disabled={starting}>{starting ? "Starting…" : "Start search"}</button></form>}
      {error && <p className="request-error" role="alert">{error}</p>}
    </section>

    {job && <section className="job-panel" aria-live="polite">
      <div><p className="eyebrow">Research status</p><h2>{job.status === "running" ? "Looking for opportunities" : job.status === "done" ? "Research complete" : "Research stopped"}</h2></div>
      <div className="progress-numbers"><span><strong>{progress?.searches ?? 0}</strong> searches</span><span><strong>{progress?.pageReads ?? 0}</strong> pages read</span><span><strong>{seconds(progress?.elapsedSeconds)}</strong> elapsed</span></div>
      {isRunning && <button className="cancel-button" type="button" onClick={cancelJob}>Cancel</button>}
      {job.error && <p className="request-error">{job.error}</p>}
      <details className="progress-details"><summary>Show research progress</summary>{progress?.toolCalls?.length ? <ul>{progress.toolCalls.map((call, index) => <li key={`${call.type}-${index}`}>{call.type === "open_page" && call.url ? <a href={call.url} target="_blank" rel="noreferrer">Source page</a> : "Web search"}</li>)}</ul> : <p>Waiting for the first tool call.</p>}</details>
    </section>}

    {results && <section className="results-section">
      <div className="results-heading"><p className="eyebrow">Verified results</p><h2>Opportunities</h2></div>
      {results.opportunities?.length ? <div className="opportunity-cards">{results.opportunities.map((item) => <article className="opportunity-card" key={item.url}><p className="eyebrow">{item.organization}</p><h3>{item.title}</h3><p>{item.whyItFits}</p><dl><div><dt>Eligibility</dt><dd>{item.ageEligibility}</dd></div><div><dt>Location</dt><dd>{item.location}</dd></div><div><dt>Availability</dt><dd>{item.availability}</dd></div></dl><blockquote>“{item.sourceExcerpt}”</blockquote><a href={item.url} target="_blank" rel="noreferrer">View source ↗</a></article>)}</div> : <p className="empty-results">{results.notes || "No current verified opportunities were found."}</p>}
      {results.ruledOut?.length > 0 && <details className="ruled-out"><summary>What was ruled out ({results.ruledOut.length})</summary><ul>{results.ruledOut.map((item, index) => <li key={`${item.title}-${index}`}><strong>{item.title}</strong> — {item.reason} {item.source && <a href={item.source} target="_blank" rel="noreferrer">Source ↗</a>}</li>)}</ul></details>}
    </section>}
  </main>;
}
