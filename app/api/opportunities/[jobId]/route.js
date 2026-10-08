import { NextResponse } from "next/server";

export const runtime = "nodejs";

function validPassword(value) { return Boolean(process.env.SITE_PASSWORD) && value === process.env.SITE_PASSWORD; }
function validId(value) { return /^[0-9a-f-]{36}$/i.test(value); }
function serviceUrl(path) { return new URL(path, `${process.env.AGENT_URL.replace(/\/$/, "")}/`).toString(); }

export async function GET(request, { params }) {
  const { jobId } = await params;
  if (!validPassword(request.headers.get("x-site-password"))) return NextResponse.json({ error: "That site password is incorrect." }, { status: 401 });
  if (!process.env.AGENT_URL || !validId(jobId)) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  try {
    const agentResponse = await fetch(serviceUrl(`jobs/${jobId}`), { cache: "no-store", signal: AbortSignal.timeout(12_000) });
    const payload = await agentResponse.json().catch(() => null);
    return NextResponse.json(payload ?? { error: "The agent returned an invalid response." }, { status: agentResponse.status });
  } catch {
    return NextResponse.json({ error: "The opportunities agent is unavailable." }, { status: 503 });
  }
}
