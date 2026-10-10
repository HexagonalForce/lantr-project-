import { NextResponse } from "next/server";
import { hasSitePassword, opportunitiesClient, opportunityFields } from "../../../../../utils/opportunities";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  if (!hasSitePassword(body.password)) {
    return NextResponse.json({ error: "That site password is incorrect." }, { status: 401 });
  }
  if (!Number.isSafeInteger(Number((await params).id)) || !["approved", "rejected"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid opportunity decision." }, { status: 400 });
  }

  try {
    const { data, error } = await opportunitiesClient()
      .from("opportunities")
      .update({ status: body.status, decided_at: new Date().toISOString() })
      .eq("id", Number((await params).id))
      .eq("status", "new")
      .select(opportunityFields)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "This opportunity is no longer pending." }, { status: 409 });
    return NextResponse.json({ opportunity: data });
  } catch {
    return NextResponse.json({ error: "The opportunity could not be updated." }, { status: 503 });
  }
}
