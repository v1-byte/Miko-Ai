export const TOPICS = Object.freeze(["web", "server", "api", "apk", "security", "coding"]);

const RULES = [
  ["security", /\b(?:security|keamanan|vulnerability|kerentanan|xss|sqli|csrf|idor|rce|owasp|brute\s*force|rate\s*limit|sql\s*injection|pentest|penetration\s*test)\b/i],
  ["apk", /\b(?:apk|android\s*studio|capacitor|cordova|gradle|keystore|play\s*store|android\s*app)\b/i],
  ["server", /\b(?:vps|nginx|docker|ubuntu|pm2|deploy(?:ment)?|server|linux|ssl|tls|domain|dns|systemd)\b/i],
  ["web", /\b(?:react|tailwind|laravel|next\.?(?:js)?|frontend|website|web\s*app|html|css|vite|browser|ui)\b/i],
  ["api", /\b(?:api|endpoint|fastapi|rest|postman|openapi|webhook|express|jwt|oauth|http\s*request)\b/i],
];

/** Classify a prompt into a broad Miko-Ai specialty; defaults to general coding. */
export function detectTopic(value) {
  const text = String(value ?? "").trim();
  if (!text) return "coding";
  for (const [topic, pattern] of RULES) {
    if (pattern.test(text)) return topic;
  }
  return "coding";
}
