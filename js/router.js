const ADAPTER_LIST = {
  api: "v1-byte/miko-api-lora",
  server: "v1-byte/miko-server-lora",
  web: "v1-byte/miko-web-lora",
  apk: "v1-byte/miko-apk-lora",
  security: "v1-byte/miko-security-lora",
  coding: "v1-byte/miko-coding-lora"
};

function detectTopic(text){
  if(!text) return "coding";
  const t = text.toLowerCase();
  if(t.match(/\bapi\b|endpoint|express|fastapi|rest api|postman|jwt|bearer/)) return "api";
  if(t.match(/\bvps\b|nginx|docker|ubuntu|pm2|deploy|server|linux|ssl|domain/)) return "server";
  if(t.match(/\breact\b|tailwind|laravel|next\.js|\bweb\b|frontend|vite|html|css/)) return "web";
  if(t.match(/\bapk\b|capacitor|cordova|android studio|gradle|keystore|build apk/)) return "apk";
  if(t.match(/xss|sqli|sql injection|csrf|idor|rce|hack|security|owasp|brute force|rate limit/)) return "security";
  return "coding";
}

// For debugging
function getAdapterForTopic(topic){ return ADAPTER_LIST[topic] || ADAPTER_LIST.coding; }

if(typeof module !== 'undefined') module.exports = { detectTopic, ADAPTER_LIST, getAdapterForTopic };
