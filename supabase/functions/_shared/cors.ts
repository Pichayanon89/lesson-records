export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const allowedOrigins = new Set([
  "https://pichayanon89.github.io",
  "http://127.0.0.1:8766",
  "http://localhost:8766",
]);

export function originAllowed(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || allowedOrigins.has(origin);
}
