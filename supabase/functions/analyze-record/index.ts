import { corsHeaders, originAllowed } from "../_shared/cors.ts";

type AnalyzeRequest = {
  subject?: string;
  class_name?: string;
  unit_name?: string;
  raw_text?: string;
};

type GroqResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

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

function cleanModelJson(text: string) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

function assertString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
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

  const groqApiKey = Deno.env.get("GROQ_API_KEY");

  if (!groqApiKey) {
    return jsonResponse({ error: "GROQ_API_KEY is not configured" }, 500);
  }

  let payload: AnalyzeRequest;

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const rawText = assertString(payload.raw_text).trim();

  if (!rawText) {
    return jsonResponse({ error: "raw_text is required" }, 400);
  }

  const prompt = `
คุณคือผู้ช่วยครูไทยระดับประถมศึกษา
หน้าที่ของคุณคือช่วยลดภาระงานครู โดยแปลงข้อความบันทึกหลังสอนแบบภาษาพูดให้เป็นข้อมูลเชิงวิชาการ

โปรดวิเคราะห์ข้อความต่อไปนี้ และตอบกลับเป็น JSON เท่านั้น ห้ามมี markdown ห้ามมีคำอธิบายเพิ่มเติม

รูปแบบ JSON:
{
  "k": "ผลการเรียนรู้ด้านความรู้ เขียนเป็นภาษาทางการ",
  "p": "ผลการเรียนรู้ด้านทักษะ/กระบวนการ เขียนเป็นภาษาทางการ",
  "a": "ผลการเรียนรู้ด้านเจตคติ/คุณลักษณะ เขียนเป็นภาษาทางการ",
  "problem": "ปัญหาที่พบ ถ้าไม่พบให้เขียนว่า ไม่พบปัญหาสำคัญ",
  "solution": "แนวทางแก้ไขหรือติดตามผล",
  "media_tags": ["รายการสื่อที่ใช้"],
  "pa_tags": ["PAด้านที่1", "ActiveLearning", "วัดและประเมินผล"]
}

บริบท:
โรงเรียน: โรงเรียนอนุบาลหนองหานวิทยายน
ชั้นเรียน: ${assertString(payload.class_name, "ไม่ระบุชั้นเรียน")}
วิชา: ${assertString(payload.subject, "ไม่ระบุวิชา")}
เรื่องที่สอน: ${assertString(payload.unit_name, "ไม่ระบุเรื่อง")}

ข้อความบันทึกหลังสอน:
${rawText}
`;

  try {
    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "คุณคือผู้ช่วยครูไทย ตอบเป็น JSON object เท่านั้น ห้ามมี markdown หรือคำอธิบายอื่น",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      },
    );

    const groqData = await groqResponse.json() as GroqResponse;

    if (!groqResponse.ok) {
      return jsonResponse({
        error: groqData.error?.message || "Groq API error",
      }, groqResponse.status);
    }

    const text = groqData.choices?.[0]?.message?.content || "";
    const result = JSON.parse(cleanModelJson(text));

    return jsonResponse({
      k: assertString(result.k),
      p: assertString(result.p),
      a: assertString(result.a),
      problem: assertString(result.problem),
      solution: assertString(result.solution),
      media_tags: Array.isArray(result.media_tags) ? result.media_tags : [],
      pa_tags: Array.isArray(result.pa_tags) ? result.pa_tags : [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
