import { corsHeaders } from "../_shared/cors.ts";

type AnalyzeRequest = {
  subject?: string;
  class_name?: string;
  unit_name?: string;
  raw_text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
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

function cleanGeminiJson(text: string) {
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

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiApiKey) {
    return jsonResponse({ error: "GEMINI_API_KEY is not configured" }, 500);
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
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    const geminiData = await geminiResponse.json() as GeminiResponse;

    if (!geminiResponse.ok) {
      return jsonResponse({
        error: geminiData.error?.message || "Gemini API error",
      }, geminiResponse.status);
    }

    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const result = JSON.parse(cleanGeminiJson(text));

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
