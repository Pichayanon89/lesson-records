import { corsHeaders, originAllowed } from "../_shared/cors.ts";

const PHOTO_BUCKET = "lesson-photos";

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

function safePathPart(value: string) {
  return value.replace(/[^0-9A-Za-zก-๙._-]/g, "-").replace(/-+/g, "-");
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
    return jsonResponse({ error: "Storage upload service is not configured" }, 500);
  }

  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    return jsonResponse({ error: "Invalid form data" }, 400);
  }

  const file = formData.get("file");
  const recordDate = safePathPart(String(formData.get("record_date") || new Date().toISOString().slice(0, 10)));
  const index = safePathPart(String(formData.get("index") || "1"));

  if (!(file instanceof File)) {
    return jsonResponse({ error: "file is required" }, 400);
  }

  if (!file.type.startsWith("image/")) {
    return jsonResponse({ error: "Only image files are allowed" }, 400);
  }

  if (file.size > 1024 * 1024) {
    return jsonResponse({ error: "Image is still larger than 1 MB after compression" }, 400);
  }

  const objectPath = `${recordDate}/${Date.now()}-${index}.jpg`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${PHOTO_BUCKET}/${objectPath}`;
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
      "Content-Type": "image/jpeg",
      "Cache-Control": "31536000",
      "x-upsert": "false",
    },
    body: await file.arrayBuffer(),
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    return jsonResponse({ error: errorText || "Upload failed" }, uploadResponse.status);
  }

  return jsonResponse({
    path: objectPath,
    publicUrl: `${supabaseUrl}/storage/v1/object/public/${PHOTO_BUCKET}/${objectPath}`,
  });
});
