import { corsHeaders, originAllowed } from "../_shared/cors.ts";

const TABLE_NAME = "lesson_records";

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!originAllowed(req)) {
    return jsonResponse({ error: "Origin not allowed" }, 403);
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "List service is not configured" }, 500);
  }

  const url = `${supabaseUrl}/rest/v1/${TABLE_NAME}?select=*&order=record_date.desc.nullslast,created_at.desc`;
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
      "Content-Type": "application/json",
    },
  });
  const text = await response.text();

  if (!response.ok) {
    return jsonResponse({ error: text || "Load failed" }, response.status);
  }

  return new Response(text, {
    status: 200,
    headers: jsonHeaders,
  });
});
