import "server-only";
import { createClient } from "@supabase/supabase-js";

export function hasSitePassword(value) {
  return Boolean(process.env.SITE_PASSWORD) && value === process.env.SITE_PASSWORD;
}

export function opportunitiesClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error("Opportunities data is not configured.");
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const opportunityFields = "id,title,url,source_excerpt,why_it_fits,status,found_at,decided_at";
