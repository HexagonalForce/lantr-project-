import { NextResponse } from "next/server";
import { hasSitePassword, opportunitiesClient, opportunityFields } from "../../../../utils/opportunities";

export const runtime = "nodejs";

export async function GET(request) {
  if (!hasSitePassword(request.headers.get("x-site-password"))) {
    return NextResponse.json({ error: "That site password is incorrect." }, { status: 401 });
  }

  try {
    const { data, error } = await opportunitiesClient()
      .from("opportunities")
      .select(opportunityFields)
      .eq("status", "new")
      .order("found_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ opportunities: data });
  } catch {
    return NextResponse.json({ error: "Pending opportunities are unavailable." }, { status: 503 });
  }
}
