"use client";

import { useEffect, useState } from "react";

const terminalStates = new Set(["done", "error", "cancelled"]);
const seconds = (value) => `${Math.floor(Number(value || 0) / 60)}m ${Number(value || 0) % 60}s`;

function OpportunityCard({ item, onDecision }) {
  return <article className="opportunity-card">
    <p className="eyebrow">{item.status}</p>
    <h3>{item.title}</h3>
    {item.why_it_fits && <p>{item.why_it_fits}</p>}
    {item.source_excerpt && <blockquote>“{item.source_excerpt}”</blockquote>}
    <a href={item.url} target="_blank" rel="noreferrer">View source ↗</a>
    {onDecision && <div className="decision-actions"><button className="small-action" onClick={() => onDecision(item, "approved")}>Approve</button><button className="cancel-button" onClick={() => onDecision(item, "rejected")}>Reject</button></div>}
  </article>;
}

export default function OpportunitiesPage() {
  const [warm, setWarm] = useState(false);
  const [password, setPassword] = useState("");
  const [adminMode, setAdminMode] = useState("");
  const [job, setJob] = useState(null);
  const [approved, setApproved] = useState([]);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const isRunning = job?.status === "running";

  async function loadApproved() {
    const response = await fetch("/api/opportunities", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load opportunities.");
    setApproved(payload.opportunities ?? []);
  }

  async function loadPending(secret = password) {
    const response = await fetch("/api/opportunities/pending", { headers: { "x-site-password": secret }, cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load pending opportunities.");
    setPending(payload.opportunities ?? []);
  }

  useEffect(() => { loadApproved().catch((requestError) => setError(requestError.message)); }, []);

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
          if (terminalStates.has(payload.status)) loadPending().catch((requestError) => setError(requestError.message));
        }
      } catch (requestError) { if (live) setError(requestError.message || "Could not check the job."); }
    };
    check();
    const timer = window.setInterval(check, 3_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [isRunning, job?.id, password]);

  async function unlock(event) {
    event.preventDefault();
    setError("");
    setStarting(true);
    try {
      if (adminMode === "manage") {
        await loadPending(password);
      } else {
        const response = await fetch("/api/opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not start the job.");
        setJob({ id: payload.id, status: payload.status, progress: { searches: 0, pageReads: 0, elapsedSeconds: 0, toolCalls: [] } });
      }
      setAdminMode("");
    } catch (requestError) { setError(requestError.message || "Could not continue."); }
    finally { setStarting(false); }
  }

  async function decide(item, status) {
    setError("");
    setPending((current) => current.filter((candidate) => candidate.id !== item.id));
    if (status === "approved") setApproved((current) => [{ ...item, status: "approved", decided_at: new Date().toISOString() }, ...current]);
    try {
      const response = await fetch(`/api/opportunities/items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, status }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update the opportunity.");
      if (status === "approved") setApproved((current) => current.map((candidate) => candidate.id === item.id ? payload.opportunity : candidate));
    } catch (requestError) {
      setPending((current) => [item, ...current]);
      if (status === "approved") setApproved((current) => current.filter((candidate) => candidate.id !== item.id));
      setError(requestError.message || "Could not update the opportunity.");
    }
  }

  const progress = job?.progress;
  return <main className={`site-shell opportunities-shell ${warm ? "warm" : ""}`}>
    <header className="compact-header">
      <a className="wordmark" href="/" aria-label="Aaron Yu home">AY<span>.</span></a>
      <p>Personal corner of the internet · Auckland</p>
      <nav className="site-menu" aria-label="Main navigation"><a href="/">Home</a><a aria-current="page" href="/opportunities">Opportunities</a></nav>
      <button className="warm-toggle" onClick={() => setWarm((current) => !current)} aria-pressed={warm}><span aria-hidden="true">{warm ? "Sun" : "Moon"}</span> {warm ? "Cool mode" : "Warm mode"}</button>
    </header>

    <section className="opportunities-hero">
      <p className="eyebrow">07 / Opportunities</p><h1>Things I might apply for.</h1>
      <p>Current options in music, maths, science, and gaming, checked before they appear here.</p>
      <div className="decision-actions"><button className="refresh-button" onClick={() => setAdminMode("refresh")} disabled={isRunning || starting}>{isRunning ? "Researching…" : "Refresh opportunities"}</button><button className="small-action" onClick={() => setAdminMode("manage")} disabled={starting}>Manage pending</button></div>
      {adminMode && <form className="password-form" onSubmit={unlock}><label htmlFor="site-password">Site password</label><input id="site-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button className="small-action" type="submit" disabled={starting}>{starting ? "Working…" : adminMode === "refresh" ? "Start search" : "Show pending"}</button></form>}
      {error && <p className="request-error" role="alert">{error}</p>}
    </section>

    {job && <section className="job-panel" aria-live="polite"><div><p className="eyebrow">Research status</p><h2>{job.status === "running" ? "Looking for opportunities" : job.status === "done" ? "Research complete" : "Research stopped"}</h2></div><div className="progress-numbers"><span><strong>{progress?.searches ?? 0}</strong> searches</span><span><strong>{progress?.pageReads ?? 0}</strong> pages read</span><span><strong>{seconds(progress?.elapsedSeconds)}</strong> elapsed</span></div></section>}

    <section className="results-section"><div className="results-heading"><p className="eyebrow">Verified and approved</p><h2>Opportunities</h2></div>{approved.length ? <div className="opportunity-cards">{approved.map((item) => <OpportunityCard key={item.id} item={item} />)}</div> : <p className="empty-results">No approved opportunities yet.</p>}</section>
    {password && <section className="results-section"><div className="results-heading"><p className="eyebrow">Private review</p><h2>New opportunities</h2></div>{pending.length ? <div className="opportunity-cards">{pending.map((item) => <OpportunityCard key={item.id} item={item} onDecision={decide} />)}</div> : <p className="empty-results">No new opportunities to review.</p>}</section>}
  </main>;
}
