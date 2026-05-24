import { corsHeaders, originAllowed } from "../_shared/cors.ts";

const TABLE_NAME = "lesson_records";

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
};

type ManageRequest = {
  action?: "update" | "delete";
  id?: string;
  pin?: string;
  record?: Record<string, unknown>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function normalizePatch(input: Record<string, unknown>) {
  const problem = stringValue(input.problem || input.problems);
  const solution = stringValue(input.solution || input.improvements);

  return {
    record_date: stringValue(input.record_date),
    period_label: stringValue(input.period_label),
    teacher_name: stringValue(input.teacher_name, "นายพิชญานนท์ วัจนสุนทร"),
    co_teachers: stringArray(input.co_teachers),
    class_name: stringValue(input.class_name, "ไม่ระบุชั้นเรียน"),
    subject: stringValue(input.subject, "ไม่ระบุวิชา"),
    unit_name: stringValue(input.unit_name, "ไม่ระบุเรื่อง"),
    learning_result_k: stringValue(input.learning_result_k),
    learning_result_p: stringValue(input.learning_result_p),
    learning_result_a: stringValue(input.learning_result_a),
    problem,
    solution,
    problems: problem,
    improvements: solution,
    media_tags: stringArray(input.media_tags),
    pa_tags: stringArray(input.pa_tags),
    activity_photo_urls: stringArray(input.activity_photo_urls),
    activity_photo_count: stringArray(input.activity_photo_urls).length,
    note: stringValue(input.note),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!originAllowed(req)) {
    return jsonResponse({ error: "Origin not allowed" }, 403);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  const savePin = Deno.env.get("SAVE_PIN");

  if (!supabaseUrl || !serviceRoleKey || !savePin) {
    return jsonResponse({ error: "Manage service is not configured" }, 500);
  }

  let payload: ManageRequest;

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (String(payload.pin || "").trim() !== savePin) {
    return jsonResponse({ error: "PIN ไม่ถูกต้อง" }, 403);
  }

  if (!payload.id) {
    return jsonResponse({ error: "id is required" }, 400);
  }

  const encodedId = encodeURIComponent(payload.id);
  const baseUrl = `${supabaseUrl}/rest/v1/${TABLE_NAME}?id=eq.${encodedId}`;
  const headers = {
    "Authorization": `Bearer ${serviceRoleKey}`,
    "apikey": serviceRoleKey,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
  };

  if (payload.action === "delete") {
    const response = await fetch(baseUrl, {
      method: "DELETE",
      headers,
    });
    const text = await response.text();

    if (!response.ok) {
      return jsonResponse({ error: text || "Delete failed" }, response.status);
    }

    return new Response(text || "[]", { status: 200, headers: jsonHeaders });
  }

  if (payload.action === "update") {
    if (!payload.record || typeof payload.record !== "object") {
      return jsonResponse({ error: "record is required" }, 400);
    }

    const patch = normalizePatch(payload.record);
    const response = await fetch(baseUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
    });
    const text = await response.text();

    if (!response.ok) {
      return jsonResponse({ error: text || "Update failed" }, response.status);
    }

    return new Response(text, { status: 200, headers: jsonHeaders });
  }

  return jsonResponse({ error: "Unsupported action" }, 400);
});
