import { corsHeaders, originAllowed } from "../_shared/cors.ts";

type LessonRecord = {
  record_date?: string;
  period_label?: string;
  teacher_name?: string;
  co_teachers?: string[];
  class_name?: string;
  subject?: string;
  unit_name?: string;
  learning_result_k?: string;
  learning_result_p?: string;
  learning_result_a?: string;
  problem?: string;
  problems?: string;
  solution?: string;
  improvements?: string;
  media_tags?: string[];
  pa_tags?: string[];
  note?: string;
};

type SummaryRequest = {
  records?: LessonRecord[];
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

function compactRecord(record: LessonRecord, index: number) {
  return {
    no: index + 1,
    date: assertString(record.record_date),
    period: assertString(record.period_label),
    teacher: assertString(record.teacher_name),
    co_teachers: Array.isArray(record.co_teachers) ? record.co_teachers : [],
    class_name: assertString(record.class_name),
    subject: assertString(record.subject),
    unit_name: assertString(record.unit_name),
    k: assertString(record.learning_result_k).slice(0, 320),
    p: assertString(record.learning_result_p).slice(0, 320),
    a: assertString(record.learning_result_a).slice(0, 320),
    problem: assertString(record.problem || record.problems).slice(0, 320),
    solution: assertString(record.solution || record.improvements).slice(0, 320),
    media_tags: Array.isArray(record.media_tags) ? record.media_tags : [],
    pa_tags: Array.isArray(record.pa_tags) ? record.pa_tags : [],
    note: assertString(record.note).slice(0, 280),
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

  const groqApiKey = Deno.env.get("GROQ_API_KEY");

  if (!groqApiKey) {
    return jsonResponse({ error: "GROQ_API_KEY is not configured" }, 500);
  }

  let payload: SummaryRequest;

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const records = Array.isArray(payload.records) ? payload.records.slice(0, 40) : [];

  if (!records.length) {
    return jsonResponse({ error: "records is required" }, 400);
  }

  const prompt = `
คุณคือผู้ช่วยงานวิชาการของครูไทย
ให้วิเคราะห์ข้อมูลบันทึกหลังการจัดการเรียนรู้ แล้วเขียน "สรุปภาพรวม" เป็นภาษาราชการ กระชับ เหมาะสำหรับรายงานบันทึกหลังสอนและหลักฐาน PA

ตอบเป็น JSON เท่านั้น:
{
  "summary": "ย่อหน้าเดียว 5-7 ประโยค ครอบคลุมผลการเรียนรู้ K-P-A จุดเด่น ปัญหาที่พบ แนวทางพัฒนา สื่อ/กิจกรรม และความเชื่อมโยง PA"
}

ข้อกำหนด:
- ห้ามแต่งข้อมูลที่ไม่มีในบันทึก
- ถ้าปัญหาพบน้อยให้ระบุว่าโดยภาพรวมไม่พบปัญหาสำคัญ แต่ยังมีประเด็นที่ควรติดตาม
- ใช้น้ำเสียงทางการ อ่านแล้วนำไปใส่รายงานได้ทันที
- ไม่ใช้ bullet

ข้อมูลบันทึก:
${JSON.stringify(records.map(compactRecord), null, 2)}
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
              content: "คุณคือผู้ช่วยงานวิชาการครูไทย ตอบเป็น JSON object เท่านั้น",
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
      summary: assertString(result.summary),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
