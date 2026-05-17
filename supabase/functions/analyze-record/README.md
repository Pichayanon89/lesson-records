# analyze-record

Supabase Edge Function สำหรับเรียก Gemini โดยไม่เปิดเผย `GEMINI_API_KEY` ใน GitHub Pages

## Deploy

```powershell
npx supabase login
npx supabase secrets set GEMINI_API_KEY="YOUR_GEMINI_API_KEY" --project-ref dqudvtapdypzngmwaega
npx supabase functions deploy analyze-record --project-ref dqudvtapdypzngmwaega
```

หลัง deploy แล้ว frontend จะเรียก:

```text
https://dqudvtapdypzngmwaega.supabase.co/functions/v1/analyze-record
```

ต้องส่ง `Authorization: Bearer <SUPABASE_ANON_KEY>` และ `apikey: <SUPABASE_ANON_KEY>` จากหน้าเว็บ
