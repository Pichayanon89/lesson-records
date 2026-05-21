import { corsHeaders, originAllowed } from "../_shared/cors.ts";

const TABLE_NAME = "lesson_records";
const SAVE_PIN = "4242";

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
};

type SaveRequest = {
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
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function normalizeRecord(input: Record<string, unknown>) {
  const problem = stringValue(input.problem || input.problems);
  const solution = stringValue(input.solution || input.improvements);
  const note = stringValue(input.note);

  if (!note) {
    throw new Error("ยังไม่มีข้อความบันทึกหลังสอน");
  }

  return {
    record_date: stringValue(input.record_date, new Date().toISOString().slice(0, 10)),
    period_label: stringValue(input.period_label),
    teacher_name: stringValue(input.teacher_name, "นายพิชญานนท์ วัจนสุนทร"),
    co_teachers: stringArray(input.co_teachers),
    class_name: stringValue(input.class_name, "ไม่ระบุชั้นเรียน"),
    subject: stringValue(input.subject, "ไม่ระบุวิชา"),
    unit_name: stringValue(input.unit_name, "ไม่ระบุเรื่อง"),
    k_score: null,
    p_score: null,
    a_score: null,
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
    note,
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

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Save service is not configured" }, 500);
  }

  let payload: SaveRequest;

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (String(payload.pin || "").trim() !== SAVE_PIN) {
    return jsonResponse({ error: "PIN ไม่ถูกต้อง" }, 403);
  }

  if (!payload.record || typeof payload.record !== "object") {
    return jsonResponse({ error: "record is required" }, 400);
  }

  let record;

  try {
    record = normalizeRecord(payload.record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid record";
    return jsonResponse({ error: message }, 400);
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${TABLE_NAME}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: JSON.stringify([record]),
  });

  const text = await response.text();

  if (!response.ok) {
    return jsonResponse({ error: text || "Save failed" }, response.status);
  }

  return new Response(text, {
    status: 200,
    headers: jsonHeaders,
  });
});
