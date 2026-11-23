// Codeforces Effect - Background Service Worker
// Handles background media caching (caching videos and images locally for instant playback)

function bufferToDataUrl(buffer, mimeType) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks to prevent stack overflow
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

async function cacheMediaItem(id, url, type) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return;
  // Don't attempt to download YouTube web pages as binary video
  if (url.includes('youtube.com/') || url.includes('youtu.be/')) return;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('[CF Background] Fetch failed with status:', response.status);
      return;
    }

    const blob = await response.blob();
    const mimeType = blob.type || (type === 'video' ? 'video/mp4' : 'image/jpeg');
    const buffer = await blob.arrayBuffer();
    const dataUrl = bufferToDataUrl(buffer, mimeType);

    const cacheKey = 'cf_cache_' + id;
    await chrome.storage.local.set({ [cacheKey]: dataUrl });

    // Update history item to indicate it is now cached locally
    const storage = await chrome.storage.local.get(['bgHistory', 'bgImage', 'bgImageOriginal']);
    let history = storage.bgHistory || [];
    let updated = false;

    history = history.map(item => {
      if (item.id === id || item.url === url) {
        updated = true;
        return { ...item, hasCache: true };
      }
      return item;
    });

    if (updated) {
      // Record hasCache: true in history and save original URL reference.
      // IMPORTANT: Do NOT abruptly overwrite active bgImage with dataUrl while playing on screen.
      // Overwriting bgImage causes chrome.storage.onChanged to trigger on the active page,
      // which reloads the <video> element and interrupts the playing video.
      // Keeping bgImage intact ensures the screen keeps playing smoothly, while subsequent page
      // navigations and reloads immediately use the local cached file (cf_cache_<id>).
      const updates = {
        bgHistory: history,
        bgImageOriginal: url
      };
      await chrome.storage.local.set(updates);
    }

    // Clean up any old orphaned caches (items older than 5th)
    await cleanupOldCaches();
  } catch (err) {
    console.warn('[CF Background] Error caching media:', err);
  }
}

async function cleanupOldCaches() {
  try {
    const storage = await chrome.storage.local.get(null);
    const history = storage.bgHistory || [];
    // Only the top 5 history items are valid
    const validCacheKeys = new Set(history.slice(0, 5).map(h => 'cf_cache_' + h.id));
    const keysToRemove = Object.keys(storage).filter(k => k.startsWith('cf_cache_') && !validCacheKeys.has(k));
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
  } catch (e) {
    // Ignore
  }
}

// Translation Cache (in-memory + persistent storage)
const translationCache = new Map();
const MAX_CACHE_ENTRIES = 5000;
const MAX_PERSISTENT_CACHE_ENTRIES = 500;
let cacheSaveTimer = null;

// Free-tier Gemini models in priority order (latest available to fallback)
// Chế độ tự động: Ưu tiên Gemini 4 Hydrogen -> nếu hết RPM chuyển sang Gemini 3.8 Flash -> nếu hết RPM chuyển sang Gemini 3.5 Flash Lite -> rồi quay vòng lại.
const GEMINI_FREE_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

const geminiModelCooldowns = new Map();

// 256-bit SHA-256 hash token: Khi bài/văn bản đã là tiếng Việt,
// Gemini chỉ in ra mã hash này để tiết kiệm token tối đa.
const ALREADY_VIETNAMESE_HASH = '30ce98fcfad6f96da53639bd33ee5410d16007392a072f53edfde47a1fe66f28';

let geminiQuotaCooldownUntil = 0;


async function initTranslationCache() {
  try {
    const res = await chrome.storage.local.get('cf_translation_cache');
    if (res && res.cf_translation_cache && typeof res.cf_translation_cache === 'object') {
      for (const [k, v] of Object.entries(res.cf_translation_cache)) {
        translationCache.set(k, v);
      }
    }
  } catch (e) {
    console.warn('[CF Translator] Lỗi tải cache từ storage:', e);
  }
}

function saveTranslationCacheDebounced() {
  if (cacheSaveTimer) clearTimeout(cacheSaveTimer);
  cacheSaveTimer = setTimeout(async () => {
    try {
      const obj = {};
      const entries = Array.from(translationCache.entries());
      const toSave = entries.slice(-MAX_PERSISTENT_CACHE_ENTRIES);
      for (const [k, v] of toSave) {
        obj[k] = v;
      }
      await chrome.storage.local.set({ cf_translation_cache: obj });
    } catch (e) {
      console.warn('[CF Translator] Lỗi lưu cache vào storage:', e);
    }
  }, 1000);
}

const initCachePromise = initTranslationCache();

function parseGoogleResponseItem(row) {
  if (Array.isArray(row)) {
    if (typeof row[0] === 'string') return row[0];
    if (Array.isArray(row[0])) {
      if (typeof row[0][0] === 'string') return row[0][0];
      return String(row[0][0] || '');
    }
    return String(row[0] || '');
  }
  if (typeof row === 'string') return row;
  return '';
}

// Free Google Translate API with automatic retry on rate-limit (429)
async function translateWithGoogle(text, retries = 2) {
  if (!text || !text.trim()) return '';
  const cleanText = text.trim();

  // If text is unusually large (>1500 chars), split into manageable chunks
  if (cleanText.length > 1500) {
    let chunks = cleanText.split(/\n\n+/);
    if (chunks.length === 1) {
      chunks = cleanText.split(/\n+/);
    }
    if (chunks.length === 1) {
      chunks = [];
      let remaining = cleanText;
      while (remaining.length > 1200) {
        let splitIdx = remaining.lastIndexOf('. ', 1200);
        if (splitIdx === -1) splitIdx = remaining.lastIndexOf(' ', 1200);
        if (splitIdx === -1) splitIdx = 1200;
        else splitIdx += 1;
        chunks.push(remaining.substring(0, splitIdx));
        remaining = remaining.substring(splitIdx).trim();
      }
      if (remaining) chunks.push(remaining);
    }
    if (chunks.length > 1) {
      const translatedParagraphs = [];
      for (const p of chunks) {
        translatedParagraphs.push(await translateWithGoogle(p, retries));
      }
      return translatedParagraphs.join('\n\n');
    }
  }

  // Fast translation via translate_a/t (Linguist architecture)
  try {
    const params = new URLSearchParams();
    params.append('q', cleanText);
    const url = 'https://translate.googleapis.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=vi';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    if (resp.ok) {
      const rawResp = await resp.json();
      if (Array.isArray(rawResp) && rawResp.length > 0) {
        const trans = parseGoogleResponseItem(rawResp[0]);
        if (trans) return trans;
      }
    }
  } catch (err) {
    // fallback below
  }

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t&q=${encodeURIComponent(cleanText)}`;
  let resp;
  try {
    resp = await fetch(url);
  } catch (err) {
    if (retries > 0) {
      console.warn('[CF Translator] Lỗi kết nối Google Translate, đợi 600ms rồi gửi lại request:', err.message);
      await new Promise(r => setTimeout(r, 600));
      return await translateWithGoogle(text, retries - 1);
    }
    throw err;
  }

  if (!resp.ok) {
    if ((resp.status === 429 || resp.status >= 500) && retries > 0) {
      console.warn(`[CF Translator] Google Translate bị limit (HTTP ${resp.status}), đợi 600ms rồi gửi lại request dịch...`);
      await new Promise(r => setTimeout(r, 600));
      return await translateWithGoogle(text, retries - 1);
    }
    throw new Error(`Google Translate lỗi HTTP ${resp.status}`);
  }
  const data = await resp.json();
  if (data && data[0]) {
    return data[0].map(item => item[0]).join('');
  }
  return cleanText;
}

// High-Speed Google Translate Batch Engine (Adopted from Linguist Architecture)
// Uses translate_a/t with client=dict-chrome-ex via POST.
// Sends multiple 'q' parameters in a single request. No delimiters needed, zero 429 rate-limiting.
async function translateBatchWithGoogle(texts, retries = 2) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const cleanTexts = texts.map(t => (t || '').trim());
  if (cleanTexts.length === 0) return [];

  // Primary High-Speed Engine (dict-chrome-ex POST)
  try {
    const params = new URLSearchParams();
    for (const t of cleanTexts) {
      params.append('q', t);
    }
    const url = 'https://translate.googleapis.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=vi';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (resp.ok) {
      const rawResp = await resp.json();
      if (Array.isArray(rawResp)) {
        const results = [];
        for (let i = 0; i < rawResp.length; i++) {
          const trans = parseGoogleResponseItem(rawResp[i]);
          results.push(trans !== undefined && trans !== null && trans !== '' ? trans : cleanTexts[i]);
        }
        if (results.length === cleanTexts.length) {
          return results;
        }
      }
    } else if (resp.status === 429 && retries > 0) {
      await new Promise(r => setTimeout(r, 600));
      return await translateBatchWithGoogle(texts, retries - 1);
    }
  } catch (err) {
    console.warn('[CF Translator] Lỗi dict-chrome-ex batch POST, thử fallback:', err.message);
  }

  // Fallback Engine: Delimiter combined request via translate_a/single
  try {
    const delimiterPrefix = '[[_CF_';
    const delimiterSuffix = '_]]';
    const combined = cleanTexts.map((t, idx) => `${delimiterPrefix}${idx}${delimiterSuffix}\n${t}`).join('\n\n');
    const fallbackUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t&q=${encodeURIComponent(combined)}`;
    const resp = await fetch(fallbackUrl);
    if (resp.ok) {
      const data = await resp.json();
      let translatedCombined = '';
      if (data && data[0]) {
        translatedCombined = data[0].map(item => item[0]).join('');
      }
      const parts = translatedCombined.split(/\[\[\s*_?\s*CF\s*_?\s*(\d+)\s*_?\s*\]\]/i);
      const parsedMap = new Map();
      for (let p = 1; p < parts.length; p += 2) {
        const itemIdx = parseInt(parts[p], 10);
        const itemContent = (parts[p + 1] || '').trim().replace(/^[:\-–—]\s*/, '').trim();
        parsedMap.set(itemIdx, itemContent);
      }
      const results = [];
      for (let i = 0; i < cleanTexts.length; i++) {
        results.push(parsedMap.get(i) || cleanTexts[i]);
      }
      return results;
    }
  } catch (err2) {
    console.warn('[CF Translator] Lỗi Google Translate fallback:', err2.message);
  }

  // Final fallback: individual item calls
  const fallbacks = [];
  for (const t of cleanTexts) {
    try {
      fallbacks.push(await translateWithGoogle(t, 1));
    } catch (e) {
      fallbacks.push(t);
    }
  }
  return fallbacks;
}

// Execute prompt on Gemini API with model fallback sequence
async function executeGeminiPrompt(prompt, apiKey, preferredModel, customModel) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Chưa cấu hình Gemini API Key. Vui lòng mở popup tiện ích để nhập API Key từ aistudio.google.com.');
  }

  const cleanKey = apiKey.trim();
  let targetModel = preferredModel ? preferredModel.trim() : 'auto';
  if (targetModel === 'custom') {
    targetModel = customModel ? customModel.trim() : '';
  }

  const baseModels = [];
  if (targetModel && targetModel !== 'auto') {
    baseModels.push(targetModel);
  }
  for (const m of GEMINI_FREE_MODELS) {
    if (!baseModels.includes(m)) {
      baseModels.push(m);
    }
  }

  // Sắp xếp danh sách model theo cơ chế tự động:
  // Model nào chưa bị hết RPM (không trong cooldown) sẽ được ưu tiên thử trước theo đúng thứ tự:
  // Gemini 4 Hydrogen -> Gemini 3.8 Flash -> Gemini 3.5 Flash Lite...
  // Model nào đang bị hết RPM (429/quota) được đưa về cuối danh sách để khi hết thời gian cooldown sẽ tự động phục hồi quay lại ("rồi qua Gemini 4 Hydrogen").
  const now = Date.now();
  const availableModels = [];
  const coolingDownModels = [];

  for (const m of baseModels) {
    const cd = geminiModelCooldowns.get(m) || 0;
    if (cd > now) {
      coolingDownModels.push(m);
    } else {
      availableModels.push(m);
    }
  }

  const models = availableModels.concat(coolingDownModels);

  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096
          }
        })
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        const errMsg = errJson.error?.message || `Gemini API HTTP ${resp.status}`;

        // Stop immediately on invalid API key
        if (resp.status === 400 && (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.includes('key is invalid'))) {
          throw new Error('Gemini API Key không hợp lệ. Vui lòng kiểm tra lại tại aistudio.google.com.');
        }

        // Nếu hết RPM hoặc vượt quota (429/RESOURCE_EXHAUSTED), kích hoạt cooldown cho model này (~60 giây)
        // và tự động chuyển sang model tiếp theo trong chuỗi (4 Hydrogen -> 3.8 Flash -> 3.5 Flash Lite)
        if (resp.status === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
          geminiModelCooldowns.set(model, Date.now() + 60000);
          console.warn(`[CF Translator] Model ${model} hết RPM (429/quota). Tự động chuyển sang model tiếp theo.`);
        }

        throw new Error(errMsg);
      }

      const resData = await resp.json();
      const output = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (output && output.trim()) {
        geminiQuotaCooldownUntil = 0; // Model succeeded, clear global cooldown
        geminiModelCooldowns.delete(model); // Model succeeded, xóa cooldown nếu có
        let cleaned = output.trim();
        if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
          cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
        }
        return cleaned;
      }
      const finishReason = resData.candidates?.[0]?.finishReason || resData.promptFeedback?.blockReason;
      throw new Error(`Model ${model} không trả về văn bản phản hồi (Lý do: ${finishReason || 'Unknown'})`);
    } catch (err) {
      lastError = err;
      console.warn(`[CF Translator] Model ${model} gặp lỗi:`, err.message);
      if (err.message && err.message.includes('không hợp lệ')) {
        throw err;
      }
      if (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('quota'))) {
        geminiModelCooldowns.set(model, Date.now() + 60000);
      }
    }
  }

  if (lastError && (lastError.message.includes('429') || lastError.message.includes('RESOURCE_EXHAUSTED') || lastError.message.includes('quota'))) {
    geminiQuotaCooldownUntil = Date.now() + 45000;
  }

  throw lastError || new Error('Không thể dịch qua Gemini API');
}


// Single item Gemini translation with fallback to Google Translate
async function translateWithGemini(text, apiKey, preferredModel, customModel) {
  if (geminiQuotaCooldownUntil > Date.now()) {
    return await translateWithGoogle(text);
  }

  const prompt = `You are a professional translator for competitive programming, algorithms, and technical texts.
Translate the following English text to natural, accurate, high-quality Vietnamese.

CRITICAL RULES:
1. Preserve all placeholders like [[M0]], [[M1]], [[M2]], etc., EXACTLY without translating, deleting, or moving them.
2. Preserve all variable names, formulas, numbers, and mathematical notation.
3. If the input text is ALREADY in Vietnamese (tiếng Việt), do NOT translate or repeat it. Output ONLY this exact 256-bit hash code to save tokens:
${ALREADY_VIETNAMESE_HASH}
4. Return ONLY the translated Vietnamese text (or the 256-bit hash code if already in Vietnamese). Do not add any conversational remarks, notes, or markdown formatting backticks.

Text to translate:
${text}`;

  try {
    const output = await executeGeminiPrompt(prompt, apiKey, preferredModel, customModel);
    if (output && output.includes(ALREADY_VIETNAMESE_HASH)) {
      return text;
    }
    return output;
  } catch (err) {
    if (err.message && err.message.includes('không hợp lệ')) {
      throw err;
    }
    console.warn('[CF Translator] Toàn bộ model Gemini thất bại, tự động chuyển sang Google Translate:', err.message);
    return await translateWithGoogle(text);
  }
}


// Unified Single Translation Handler
async function handleTranslation(text, engine, geminiApiKey, geminiModel, geminiCustomModel) {
  if (!text || !text.trim()) return '';
  await initCachePromise;

  const eng = engine === 'gemini' ? 'gemini' : 'google';
  const cacheKey = `${eng}:${text.trim()}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  let result = '';
  if (eng === 'gemini' && geminiApiKey) {
    try {
      result = await translateWithGemini(text, geminiApiKey, geminiModel, geminiCustomModel);
    } catch (err) {
      console.warn('[CF Translator] Gemini lỗi, fallback sang Google Translate:', err.message);
      result = await translateWithGoogle(text);
    }
  } else {
    result = await translateWithGoogle(text);
  }

  if (translationCache.size > MAX_CACHE_ENTRIES) {
    const firstKey = translationCache.keys().next().value;
    translationCache.delete(firstKey);
  }
  translationCache.set(cacheKey, result);
  saveTranslationCacheDebounced();
  return result;
}

// Unified Batch Translation Handler
async function handleBatchTranslation(items, engine, geminiApiKey, geminiModel, geminiCustomModel) {
  if (!Array.isArray(items) || items.length === 0) return [];
  await initCachePromise;

  const eng = engine === 'gemini' ? 'gemini' : 'google';
  const results = new Array(items.length);
  const uncachedIndices = [];

  // Check cache first
  items.forEach((item, index) => {
    const text = (item || '').trim();
    if (!text) {
      results[index] = '';
      return;
    }
    const cacheKey = `${eng}:${text}`;
    if (translationCache.has(cacheKey)) {
      results[index] = translationCache.get(cacheKey);
    } else {
      uncachedIndices.push(index);
    }
  });

  if (uncachedIndices.length === 0) {
    return results;
  }

  const isGeminiActive = eng === 'gemini' && geminiApiKey && geminiQuotaCooldownUntil <= Date.now();

  if (isGeminiActive) {
    // Process in batches of up to 12 items to preserve quota and avoid 429 limits
    const BATCH_SIZE = 12;
    for (let i = 0; i < uncachedIndices.length; i += BATCH_SIZE) {
      const batchIndices = uncachedIndices.slice(i, i + BATCH_SIZE);
      const batchTexts = batchIndices.map(idx => items[idx].trim());

      if (batchTexts.length === 1) {
        try {
          const trans = await translateWithGemini(batchTexts[0], geminiApiKey, geminiModel, geminiCustomModel);
          translationCache.set(`${eng}:${batchTexts[0]}`, trans);
          results[batchIndices[0]] = trans;
        } catch (err) {
          try {
            const trans = await translateWithGoogle(batchTexts[0]);
            translationCache.set(`${eng}:${batchTexts[0]}`, trans);
            results[batchIndices[0]] = trans;
          } catch (e) {
            results[batchIndices[0]] = batchTexts[0];
          }
        }
        continue;
      }

      const delimiterPrefix = '<<<CF_TRANSLATE_ITEM_';
      const delimiterSuffix = '>>>';
      const promptBody = batchTexts.map((t, idx) => `${delimiterPrefix}${idx}${delimiterSuffix}\n${t}`).join('\n\n');

      const fullPrompt = `You are a professional translator for competitive programming, algorithms, and technical texts.
Translate each of the numbered English text items below to natural, accurate, high-quality Vietnamese.

CRITICAL RULES:
1. Preserve all placeholders like [[M0]], [[M1]], [[M2]], etc., EXACTLY without translating, deleting, or moving them.
2. Preserve all variable names, formulas, numbers, and mathematical notation.
3. If any item is ALREADY in Vietnamese (tiếng Việt), do NOT translate or repeat that item. Output its delimiter followed ONLY by this exact 256-bit hash code to save tokens:
${ALREADY_VIETNAMESE_HASH}
4. For each item, output the exact delimiter "${delimiterPrefix}N${delimiterSuffix}" followed by the translated Vietnamese text (or the 256-bit hash code if already Vietnamese) for item N.
5. Return ONLY the translated items with their delimiters. Do not add any conversational remarks, notes, or markdown formatting backticks.

Text items to translate:
${promptBody}`;

      try {
        const batchOutput = await executeGeminiPrompt(fullPrompt, geminiApiKey, geminiModel, geminiCustomModel);
        const parts = batchOutput.split(/<?<?<?\s*CF_TRANSLATE_ITEM_(\d+)\s*>?\>?>?/i);
        const parsedMap = new Map();
        for (let p = 1; p < parts.length; p += 2) {
          const itemIdx = parseInt(parts[p], 10);
          const itemContent = (parts[p + 1] || '').trim().replace(/^[:\-–—]\s*/, '').trim();
          parsedMap.set(itemIdx, itemContent);
        }

        for (let b = 0; b < batchIndices.length; b++) {
          const origIdx = batchIndices[b];
          const text = batchTexts[b];
          let trans = parsedMap.get(b);
          if (trans && trans.includes(ALREADY_VIETNAMESE_HASH)) {
            trans = text;
          }
          if (!trans) {
            trans = await translateWithGoogle(text).catch(() => text);
          }
          translationCache.set(`${eng}:${text}`, trans);
          results[origIdx] = trans;
        }
      } catch (err) {
        console.warn('[CF Translator] Batch Gemini thất bại, tự động chuyển Google Translate batch:', err.message);
        // Fall back directly to Google Translate batch
        const transList = await translateBatchWithGoogle(batchTexts);
        for (let b = 0; b < batchIndices.length; b++) {
          const origIdx = batchIndices[b];
          const text = batchTexts[b];
          const trans = transList[b] || text;
          translationCache.set(`${eng}:${text}`, trans);
          results[origIdx] = trans;
        }
      }
    }
  } else {
    // Google Translate: Chunk into groups of up to 35 items or 4500 chars (Linguist architecture)
    // Combines multiple items into single POST request via dict-chrome-ex to avoid rate limits
    const chunks = [];
    let curChunk = [];
    let curLen = 0;
    for (const idx of uncachedIndices) {
      const text = items[idx].trim();
      if (curChunk.length >= 35 || (curLen + text.length > 4500 && curChunk.length > 0)) {
        chunks.push(curChunk);
        curChunk = [];
        curLen = 0;
      }
      curChunk.push(idx);
      curLen += text.length + 15;
    }
    if (curChunk.length > 0) chunks.push(curChunk);

    for (let c = 0; c < chunks.length; c++) {
      const batchIndices = chunks[c];
      const batchTexts = batchIndices.map(idx => items[idx].trim());
      const transList = await translateBatchWithGoogle(batchTexts);
      for (let b = 0; b < batchIndices.length; b++) {
        const origIdx = batchIndices[b];
        const text = batchTexts[b];
        const trans = transList[b] || text;
        translationCache.set(`${eng}:${text}`, trans);
        results[origIdx] = trans;
      }
      if (c < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 40));
      }
    }
  }

  saveTranslationCacheDebounced();
  return results;
}

// Test Gemini API key & fetch available models
async function testGeminiConnection(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Vui lòng nhập API Key.');
  }
  const cleanKey = apiKey.trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const errJson = await resp.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  const availableModels = (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name ? m.name.replace(/^models\//, '') : '');
  return { valid: true, models: availableModels };
}

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.action === 'cacheMedia') {
    cacheMediaItem(message.id, message.url, message.type);
    sendResponse({ status: 'started' });
  } else if (message && message.action === 'cleanupCaches') {
    cleanupOldCaches();
    sendResponse({ status: 'done' });
  } else if (message && message.action === 'translate') {
    handleTranslation(
      message.text,
      message.engine,
      message.geminiApiKey,
      message.geminiModel,
      message.geminiCustomModel
    )
      .then(translatedText => {
        sendResponse({ success: true, text: translatedText });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep message channel open for async response
  } else if (message && message.action === 'translateBatch') {
    handleBatchTranslation(
      message.items,
      message.engine,
      message.geminiApiKey,
      message.geminiModel,
      message.geminiCustomModel
    )
      .then(translatedItems => {
        sendResponse({ success: true, texts: translatedItems });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  } else if (message && message.action === 'testGeminiKey') {
    testGeminiConnection(message.apiKey)
      .then(info => {
        sendResponse({ success: true, ...info });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  } else if (message && message.action === 'checkForUpdates') {
    checkForUpdates()
      .then(res => {
        sendResponse(res);
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
  return true;
});

// Periodic or change-triggered cache pruning
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.bgHistory) {
    cleanupOldCaches();
  }
});

// =========================================================
// Automatic Version & Update Checking (TEST -> Official)
// =========================================================

const GITHUB_REPO_URL = 'https://github.com/PTK-2411/codeforces-effect';
const GITHUB_RAW_MANIFEST_URL = 'https://raw.githubusercontent.com/PTK-2411/codeforces-effect/main/manifest.json';
const GITHUB_DOWNLOAD_URL = 'https://github.com/PTK-2411/codeforces-effect/archive/refs/heads/main.zip';

/**
 * Quy ước đặt tên phiên bản (Version Scheme):
 * 1. vX.Y.Z Alpha: Bản thử nghiệm tính năng mới.
 * 2. vX.Y.Z Alpha HF.a.b: Bản Hotfix sửa lỗi khẩn cấp cho nhánh Alpha.
 * 3. vX.Y.Z: Bản chính thức (Stable) — loại bỏ hoàn toàn chữ Alpha.
 * 4. vX.Y.Z HF.a.b: Bản Hotfix sửa lỗi khẩn cấp cho bản chính thức.
 */
function parseVersion(vStr, vFallbackNum = '0.0.0') {
  const raw = String(vStr || '').trim();

  // 1. Phân loại nhánh: Alpha (thử nghiệm) hoặc Stable (chính thức)
  // Hỗ trợ cả từ khóa "TEST" cũ để tương thích ngược
  const isAlpha = /\b(alpha|test)\b/i.test(raw);

  // 2. Phân loại Hotfix: chứa HF hoặc HF.a.b
  const hfMatch = raw.match(/\bHF(?:\.|\s+)?(\d+)(?:\.(\d+))?/i);
  const isHotfix = Boolean(hfMatch);
  const hfMajor = hfMatch ? (parseInt(hfMatch[1], 10) || 0) : 0;
  const hfMinor = hfMatch && hfMatch[2] !== undefined ? (parseInt(hfMatch[2], 10) || 0) : 0;

  // 3. Trích xuất Semantic Version cơ sở [major, minor, patch]
  let semver = [0, 0, 0];
  const semverMatch = raw.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (semverMatch) {
    semver = [
      parseInt(semverMatch[1], 10) || 0,
      parseInt(semverMatch[2], 10) || 0,
      parseInt(semverMatch[3], 10) || 0
    ];
  } else if (vFallbackNum) {
    const fallbackMatch = String(vFallbackNum).match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    if (fallbackMatch) {
      semver = [
        parseInt(fallbackMatch[1], 10) || 0,
        parseInt(fallbackMatch[2], 10) || 0,
        parseInt(fallbackMatch[3], 10) || 0
      ];
    }
  }

  return {
    raw,
    semver,
    isAlpha,
    isHotfix,
    hf: [hfMajor, hfMinor]
  };
}

function compareSemver(s1, s2) {
  for (let i = 0; i < 3; i++) {
    const n1 = s1[i] || 0;
    const n2 = s2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

function compareHf(h1, h2) {
  for (let i = 0; i < 2; i++) {
    const n1 = h1[i] || 0;
    const n2 = h2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

function compareVersions(v1, v2) {
  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);
  const semCmp = compareSemver(p1.semver, p2.semver);
  if (semCmp !== 0) return semCmp;

  // Thứ bậc khi cùng semver:
  // Alpha (1) < Alpha HF (2) < Stable (3) < Stable HF (4)
  const rank = (p) => {
    if (p.isAlpha && !p.isHotfix) return 1;
    if (p.isAlpha && p.isHotfix) return 2;
    if (!p.isAlpha && !p.isHotfix) return 3;
    return 4;
  };
  const r1 = rank(p1);
  const r2 = rank(p2);
  if (r1 > r2) return 1;
  if (r1 < r2) return -1;
  if (p1.isHotfix && p2.isHotfix) {
    return compareHf(p1.hf, p2.hf);
  }
  return 0;
}

function evaluateUpdate(currentManifest, remoteManifest) {
  const currentVer = currentManifest?.version || '0.99.0';
  const currentName = currentManifest?.version_name || currentVer;
  const remoteVer = remoteManifest?.version || '1.0.0';
  const remoteName = remoteManifest?.version_name || remoteVer;

  const curr = parseVersion(currentName, currentVer);
  const remote = parseVersion(remoteName, remoteVer);

  const semCmp = compareSemver(remote.semver, curr.semver);

  const makeResult = (hasUpdate, updateType, autoUpdate, isSilent, isTestToOfficial, isTrial, message) => ({
    hasUpdate,
    updateType,
    autoUpdate,
    isSilent,
    isTestToOfficial,
    isTrial,
    currentVersionName: currentName,
    remoteVersionName: remoteName,
    remoteVersion: remoteVer,
    message
  });

  // Nếu remote có semver nhỏ hơn hẳn current -> không cập nhật
  if (semCmp < 0) {
    return makeResult(false, null, false, false, false, false, '');
  }

  // =========================================================================
  // TRƯỜNG HỢP 2B: Bản Stable Hotfix (chỉ chứa HF, không có Alpha)
  // Quy ước: Tự động cập nhật ngầm 100% cho MỌI người dùng (cả Stable & Alpha)
  // =========================================================================
  if (!remote.isAlpha && remote.isHotfix) {
    let isNewer = false;
    if (semCmp > 0) {
      isNewer = true;
    } else {
      // Cùng semver: nếu current là Alpha hoặc Stable thường -> remote HF mới hơn
      if (curr.isAlpha || !curr.isHotfix) {
        isNewer = true;
      } else {
        // Cả hai đều là Stable HF -> so sánh số hotfix
        isNewer = compareHf(remote.hf, curr.hf) > 0;
      }
    }

    if (isNewer) {
      return makeResult(
        true,
        'stable_hotfix',
        true,  // autoUpdate
        true,  // isSilent
        curr.isAlpha,
        false,
        `Bản vá lỗi khẩn cấp chính thức (${remoteName}). Tiện ích đã tự động cập nhật ngầm.`
      );
    }
    return makeResult(false, null, false, false, false, false, '');
  }

  // =========================================================================
  // TRƯỜNG HỢP 1: Bản chính thức mới (Stable Release - không chứa Alpha, không HF)
  // Quy ước: Kéo toàn bộ người dùng (kể cả đang ở nhánh Alpha) về bản chính thức
  // =========================================================================
  if (!remote.isAlpha && !remote.isHotfix) {
    let isNewer = false;
    if (semCmp > 0) {
      isNewer = true;
    } else if (semCmp === 0) {
      // Cùng semver: nếu current là Alpha thì bản chính thức mới hơn
      if (curr.isAlpha) {
        isNewer = true;
      }
    }

    if (isNewer) {
      return makeResult(
        true,
        'official',
        false,
        false,
        curr.isAlpha,
        false,
        curr.isAlpha
          ? `Đã có bản chính thức (${remoteName}) thay thế bản Alpha hiện tại!`
          : `Đã có bản chính thức mới (${remoteName})!`
      );
    }
    return makeResult(false, null, false, false, false, false, '');
  }

  // =========================================================================
  // TRƯỜNG HỢP 2A: Bản Alpha Hotfix (chứa cả Alpha VÀ HF)
  // Quy ước: Người dùng ở Alpha tự động cập nhật ngầm; người dùng ở Stable không bị ép
  // =========================================================================
  if (remote.isAlpha && remote.isHotfix) {
    // Nếu người dùng đang ở Stable: KHÔNG ép cập nhật bản Alpha HF
    if (!curr.isAlpha) {
      return makeResult(false, null, false, false, false, false, '');
    }

    // Người dùng đang ở Alpha: kiểm tra xem remote có mới hơn không
    let isNewer = false;
    if (semCmp > 0) {
      isNewer = true;
    } else if (semCmp === 0) {
      if (!curr.isHotfix) {
        isNewer = true;
      } else {
        isNewer = compareHf(remote.hf, curr.hf) > 0;
      }
    }

    if (isNewer) {
      return makeResult(
        true,
        'alpha_hotfix',
        true,  // autoUpdate
        true,  // isSilent
        false,
        false,
        `Bản vá lỗi khẩn cấp cho nhánh Alpha (${remoteName}). Tiện ích đã tự động cập nhật ngầm.`
      );
    }
    return makeResult(false, null, false, false, false, false, '');
  }

  // =========================================================================
  // TRƯỜNG HỢP 3: Bản thử nghiệm mới (Alpha thông thường - không chứa HF)
  // Quy ước: Chỉ hiện thông báo hỏi ý kiến (người dùng tự bấm "Trải nghiệm thử")
  // =========================================================================
  if (remote.isAlpha && !remote.isHotfix) {
    let isNewer = false;
    if (semCmp > 0) {
      isNewer = true;
    } else if (semCmp === 0) {
      // Cùng semver: Alpha thường không thể mới hơn Alpha HF hay Stable
      isNewer = false;
    }

    if (isNewer) {
      return makeResult(
        true,
        'alpha_trial',
        false, // autoUpdate = false (không tự động ép)
        false,
        false,
        true,  // isTrial = true
        `Đã có bản thử nghiệm mới (${remoteName}). Bạn có muốn trải nghiệm thử không?`
      );
    }
    return makeResult(false, null, false, false, false, false, '');
  }

  return makeResult(false, null, false, false, false, false, '');
}

async function checkForUpdates() {
  try {
    const currentManifest = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest)
      ? chrome.runtime.getManifest()
      : { version: '0.99.0', version_name: 'v1.0.0 Alpha' };

    const resp = await fetch(`${GITHUB_RAW_MANIFEST_URL}?t=${Date.now()}`);
    if (!resp.ok) {
      return { success: false, error: `GitHub HTTP ${resp.status}` };
    }
    const remoteManifest = await resp.json();
    const evaluation = evaluateUpdate(currentManifest, remoteManifest);

    const updateInfo = {
      ...evaluation,
      repoUrl: GITHUB_REPO_URL,
      downloadUrl: GITHUB_DOWNLOAD_URL,
      checkedAt: Date.now()
    };

    if (evaluation.hasUpdate && evaluation.autoUpdate) {
      updateInfo.autoUpdated = true;
      updateInfo.appliedAt = Date.now();
      if (typeof chrome !== 'undefined' && chrome.runtime?.requestUpdateCheck) {
        try {
          chrome.runtime.requestUpdateCheck(() => {});
        } catch (e) {}
      }
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ cfUpdateInfo: updateInfo });
    }
    return { success: true, ...updateInfo };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

if (typeof chrome !== 'undefined' && chrome.runtime) {
  if (chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(() => {
      checkForUpdates().catch(() => {});
    });
  }
  if (chrome.runtime.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
      checkForUpdates().catch(() => {});
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    bufferToDataUrl,
    parseVersion,
    compareSemver,
    compareHf,
    compareVersions,
    evaluateUpdate,
    checkForUpdates,
    ALREADY_VIETNAMESE_HASH,
    geminiModelCooldowns,
    GEMINI_FREE_MODELS
  };
}
