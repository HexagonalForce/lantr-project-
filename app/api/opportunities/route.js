import { NextResponse } from "next/server";
import { hasSitePassword, opportunitiesClient, opportunityFields } from "../../../utils/opportunities";

export const runtime = "nodejs";

function configured() {
  return Boolean(process.env.SITE_PASSWORD && process.env.AGENT_URL && process.env.AGENT_SECRET);
}

function serviceUrl(path) {
  return new URL(path, `${process.env.AGENT_URL.replace(/\/$/, "")}/`).toString();
}

export async function GET() {
  try {
    const { data, error } = await opportunitiesClient()
      .from("opportunities")
      .select(opportunityFields)
      .eq("status", "approved")
      .order("found_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ opportunities: data });
  } catch {
    return NextResponse.json({ error: "Approved opportunities are unavailable." }, { status: 503 });
  }
}

export async function POST(request) {
  if (!configured()) return NextResponse.json({ error: "Opportunities refresh is not configured yet." }, { status: 503 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "A site password is required." }, { status: 400 }); }
  if (!hasSitePassword(body?.password)) return NextResponse.json({ error: "That site password is incorrect." }, { status: 401 });

  try {
    const agentResponse = await fetch(serviceUrl("jobs"), {
      method: "POST",
      headers: { AGENT_SECRET: process.env.AGENT_SECRET },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    const payload = await agentResponse.json().catch(() => null);
    if (!agentResponse.ok || !payload?.id) return NextResponse.json({ error: payload?.error || "The agent could not start a job." }, { status: 502 });
    return NextResponse.json({ id: payload.id, status: payload.status });
  } catch {
    return NextResponse.json({ error: "The opportunities agent is unavailable. Try again shortly." }, { status: 503 });
  }
}
