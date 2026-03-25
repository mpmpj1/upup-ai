const TEST_PROMPT = 'Hello';
const TEST_SYSTEM_PROMPT = "You are a helpful assistant. Respond with just 'OK' to confirm the API is working.";
function normalizeBaseUrl(baseUrl){ return baseUrl ? baseUrl.trim().replace(/\/+$/,'') : undefined; }
function parseExtraHeaders(value){ if(!value) return {}; if(typeof value === 'object' && !Array.isArray(value)) return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,String(v)])); try { const p = JSON.parse(value); if(p && typeof p === 'object' && !Array.isArray(p)) return Object.fromEntries(Object.entries(p).map(([k,v])=>[k,String(v)])); } catch {} return {}; }
function getOpenAICompatibleEndpoint(provider, options){ const baseUrl = normalizeBaseUrl(options?.baseUrl); if(baseUrl){ if(baseUrl.endsWith('/chat/completions')) return baseUrl; if(baseUrl.endsWith('/v1')||baseUrl.endsWith('/api/v1')) return `${baseUrl}/chat/completions`; return `${baseUrl}/chat/completions`; } return 'https://api.openai.com/v1/chat/completions'; }
async function test(){ const apiKey = process.argv[2]; const model = process.argv[3] || 'gpt-5.4'; const options = { baseUrl: 'https://gmncode.cn/v1', extraHeaders: {}, isOpenAICompatible: true, providerType: 'openai-compatible' };
 const headers = { 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}`, ...parseExtraHeaders(options.extraHeaders) };
 const response = await fetch(getOpenAICompatibleEndpoint('openai', options), { method:'POST', headers, body: JSON.stringify({ model, messages:[{role:'system',content:TEST_SYSTEM_PROMPT},{role:'user',content:TEST_PROMPT}], temperature:0, max_tokens:10 })});
 console.log('status', response.status);
 const text = await response.text();
 console.log(text);
}
 test().catch(err=>{ console.error(err); process.exit(1); });
