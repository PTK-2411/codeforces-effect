// Unit & Integration Test for background/background.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('=== Running Tests for background.js ===');

// Mock chrome API
const storageData = {};
const messageListeners = [];
const tabMessagesSent = [];

const mockChrome = {
  tabs: {
    sendMessage: async (tabId, msg) => {
      tabMessagesSent.push({ tabId, msg });
    }
  },
  storage: {
    local: {
      get: async (keys) => {
        if (keys === null) return { ...storageData };
        if (typeof keys === 'string') return { [keys]: storageData[keys] };
        if (Array.isArray(keys)) {
          const res = {};
          keys.forEach(k => { res[k] = storageData[k]; });
          return res;
        }
        return { ...storageData };
      },
      set: async (obj) => {
        Object.assign(storageData, obj);
      },
      remove: async (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach(k => delete storageData[k]);
      }
    },
    onChanged: {
      addListener: () => {}
    }
  },
  alarms: {
    create: () => {},
    onAlarm: {
      addListener: () => {}
    }
  },
  runtime: {
    getURL: (path) => `chrome-extension://mock/${path}`,
    getManifest: () => ({
      version: '0.99.0',
      version_name: 'v1.0.0 Alpha'
    }),
    requestUpdateCheck: (cb) => { if (typeof cb === 'function') cb('no_update'); },
    reload: () => {},
    onUpdateAvailable: {
      addListener: () => {}
    },
    onInstalled: {
      addListener: () => {}
    },
    onStartup: {
      addListener: () => {}
    },
    onMessage: {
      addListener: (fn) => {
        messageListeners.push(fn);
      }
    }
  }
};

// Mock fetch
let fetchCalls = [];
let fetchHandler = async (url, opts) => {
  throw new Error('Unhandled fetch');
};

const mockFetch = async (url, opts) => {
  fetchCalls.push({ url, opts });
  return fetchHandler(url, opts);
};

// Set up sandbox
const sandbox = {
  chrome: mockChrome,
  fetch: mockFetch,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  encodeURIComponent: encodeURIComponent,
  URLSearchParams: URLSearchParams,
  URL: URL,
  Array: Array,
  Object: Object,
  Map: Map,
  String: String,
  Number: Number,
  JSON: JSON,
  Error: Error,
  Math: Math,
  parseInt: parseInt,
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  module: { exports: {} }
};

// Read background.js
const code = fs.readFileSync(path.join(__dirname, '../background/background.js'), 'utf8');
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const backgroundModule = sandbox.module.exports;

async function sendMessage(msg, sender = {}) {
  for (const listener of messageListeners) {
    let resolved = false;
    const res = await new Promise((resolve) => {
      const keepOpen = listener(msg, sender, (response) => {
        resolved = true;
        resolve(response);
      });
      if (!keepOpen && !resolved) {
        resolve(undefined);
      }
    });
    if (res !== undefined) return res;
  }
  return null;
}

async function runTests() {
  // Test 1: Google Translate single item
  console.log('Test 1: Google Translate single item');
  fetchCalls = [];
  fetchHandler = async (url) => {
    assert(url.includes('translate.googleapis.com'));
    return {
      ok: true,
      status: 200,
      json: async () => [[['Xin chào', 'Hello']]]
    };
  };

  const res1 = await sendMessage({ action: 'translate', text: 'Hello', engine: 'google' });
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.text, 'Xin chào');
  console.log('✓ Test 1 passed: Google Translate returned translated text');

  // Test 2: In-memory & Persistent Cache verification
  console.log('Test 2: Cache hit test (should not call fetch again)');
  fetchCalls = [];
  const res2 = await sendMessage({ action: 'translate', text: 'Hello', engine: 'google' });
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.text, 'Xin chào');
  assert.strictEqual(fetchCalls.length, 0, 'Fetch should not have been called due to cache');
  console.log('✓ Test 2 passed: Cache hit avoided external API call');

  // Test 3: Gemini translation with Auto Fallback (Gemini 4 Hydrogen -> 3.8 Flash -> 3.5 Flash Lite -> loop back)
  console.log('Test 3: Gemini translation with Auto Fallback (Gemini 4 Hydrogen -> 3.8 Flash -> 3.5 Flash Lite)');
  fetchCalls = [];
  let modelAttempts = [];
  fetchHandler = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('gemini-4-hydrogen:generateContent')) {
      modelAttempts.push('gemini-4-hydrogen');
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Resource exhausted (RPM quota exceeded)' } })
      };
    }
    if (urlStr.includes('gemini-3.8-flash:generateContent')) {
      modelAttempts.push('gemini-3.8-flash');
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Resource exhausted (RPM quota exceeded)' } })
      };
    }
    if (urlStr.includes('gemini-3.5-flash-lite:generateContent')) {
      modelAttempts.push('gemini-3.5-flash-lite');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Độ phức tạp là [[M0]]' }] } }]
        })
      };
    }
    throw new Error('Unexpected model: ' + urlStr);
  };

  const res3 = await sendMessage({
    action: 'translate',
    text: 'Complexity is [[M0]]',
    engine: 'gemini',
    geminiApiKey: 'test-api-key-123'
  });
  assert.strictEqual(res3.success, true);
  assert.strictEqual(res3.text, 'Độ phức tạp là [[M0]]');
  assert.deepStrictEqual(modelAttempts, ['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']);

  // Verify that during cooldown, subsequent request immediately uses 3.5 Flash Lite without re-hitting 429
  modelAttempts = [];
  const res3Next = await sendMessage({
    action: 'translate',
    text: 'Next text to translate',
    engine: 'gemini',
    geminiApiKey: 'test-api-key-123'
  });
  assert.strictEqual(res3Next.success, true);
  assert.strictEqual(modelAttempts[0], 'gemini-3.5-flash-lite', 'Subsequent request during cooldown must directly use available model');

  // Verify that once cooldown expires, it loops back to Gemini 4 Hydrogen
  if (backgroundModule && backgroundModule.geminiModelCooldowns) {
    backgroundModule.geminiModelCooldowns.clear();
  }
  modelAttempts = [];
  await sendMessage({
    action: 'translate',
    text: 'Third text after cooldown reset',
    engine: 'gemini',
    geminiApiKey: 'test-api-key-123'
  });
  assert.strictEqual(modelAttempts[0], 'gemini-4-hydrogen', 'Once cooldown expires, priority must loop back to Gemini 4 Hydrogen');

  console.log('✓ Test 3 passed: Auto Fallback chain (Gemini 4 Hydrogen -> 3.8 Flash -> 3.5 Flash Lite -> Gemini 4 Hydrogen) succeeded');


  // Test 3b: Custom Gemini Model execution
  console.log('Test 3b: Custom Gemini Model execution');
  fetchCalls = [];
  let requestedModel = '';
  fetchHandler = async (url) => {
    const match = String(url).match(/models\/([^:]+):generateContent/);
    if (match) requestedModel = match[1];
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Kết quả từ custom model' }] } }]
      })
    };
  };

  const res3b = await sendMessage({
    action: 'translate',
    text: 'Custom model test',
    engine: 'gemini',
    geminiApiKey: 'test-api-key-123',
    geminiModel: 'custom',
    geminiCustomModel: 'my-custom-model-exp'
  });
  assert.strictEqual(res3b.success, true);
  assert.strictEqual(res3b.text, 'Kết quả từ custom model');
  assert.strictEqual(requestedModel, 'my-custom-model-exp', 'Should call the user-specified custom model');
  console.log('✓ Test 3b passed: Custom model name propagated and used correctly');

  // Test 4: Batch Translation with Gemini (preserves 15 RPM quota)
  console.log('Test 4: Batch Translation with Gemini');
  fetchCalls = [];
  fetchHandler = async (url, opts) => {
    const body = JSON.parse(opts.body);
    const prompt = body.contents[0].parts[0].text;
    assert(prompt.includes('<<<CF_TRANSLATE_ITEM_0>>>'));
    assert(prompt.includes('<<<CF_TRANSLATE_ITEM_1>>>'));
    assert(prompt.includes('YES') && prompt.includes('NO'), 'Prompt must instruct AI to preserve YES/NO output tokens');
    
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: `<<<CF_TRANSLATE_ITEM_0>>>
Đoạn văn thứ nhất [[M0]]
<<<CF_TRANSLATE_ITEM_1>>>
Đoạn văn thứ hai`
            }]
          }
        }]
      })
    };
  };

  const batchItems = ['First paragraph [[M0]]', 'Second paragraph'];
  const res4 = await sendMessage({
    action: 'translateBatch',
    items: batchItems,
    engine: 'gemini',
    geminiApiKey: 'test-api-key-123'
  });

  assert.strictEqual(res4.success, true);
  assert.strictEqual(res4.texts.length, 2);
  assert.strictEqual(res4.texts[0], 'Đoạn văn thứ nhất [[M0]]');
  assert.strictEqual(res4.texts[1], 'Đoạn văn thứ hai');
  assert.strictEqual(fetchCalls.length, 1, 'Batching should send 1 API request for multiple items');
  console.log('✓ Test 4 passed: Batch translation grouped items into 1 prompt and resolved all');

  // Test 4b: Already Vietnamese detection via 256-bit hash to save tokens
  console.log('Test 4b: Already Vietnamese text preserves original content via 256-bit hash');
  fetchCalls = [];
  const vietnameseHash = await backgroundModule.getOrInitAlreadyViHash();
  assert.strictEqual(typeof vietnameseHash, 'string');
  assert.strictEqual(vietnameseHash.length, 64, 'Dynamic hash must be 256 bits (64 hex characters)');
  assert.strictEqual(storageData['cf_already_vi_hash'], vietnameseHash, 'Hash must be stored in chrome.storage.local');

  fetchHandler = async (url, opts) => {
    assert(opts && opts.body, 'Expected Gemini POST request with body');
    const body = JSON.parse(opts.body);
    const userPrompt = body.contents[0].parts[0].text;
    assert(userPrompt.includes(vietnameseHash), 'Prompt must include 256-bit hash code instructions');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: vietnameseHash }]
          }
        }]
      })
    };
  };

  const vietnameseOriginal = 'Cho mảng gồm n số nguyên dương [[M0]]. Hãy tìm độ dài lớn nhất.';
  const res4bSingle = await sendMessage({
    action: 'translate',
    text: vietnameseOriginal,
    engine: 'gemini',
    geminiApiKey: 'my-test-key'
  });
  assert.strictEqual(res4bSingle.success, true);
  assert.strictEqual(res4bSingle.text, vietnameseOriginal, 'Single item returning hash must retain original text');

  // Test 4b batch
  fetchCalls = [];
  fetchHandler = async (url, opts) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: `<<<CF_TRANSLATE_ITEM_0>>> ${vietnameseHash}\n<<<CF_TRANSLATE_ITEM_1>>> Dịch tiếng Anh sang tiếng Việt` }]
          }
        }]
      })
    };
  };
  const res4bBatch = await sendMessage({
    action: 'translateBatch',
    items: ['Bài tập này đã bằng tiếng Việt [[M0]]', 'English problem statement'],
    engine: 'gemini',
    geminiApiKey: 'my-test-key'
  });
  assert.strictEqual(res4bBatch.success, true);
  assert.strictEqual(res4bBatch.texts[0], 'Bài tập này đã bằng tiếng Việt [[M0]]', 'Batch item with hash must retain original text');
  assert.strictEqual(res4bBatch.texts[1], 'Dịch tiếng Anh sang tiếng Việt');
  console.log('✓ Test 4b passed: Already Vietnamese hash token saving verified for single and batch translations');

  // Test 4c: Switching from Google to Gemini re-translates instead of reusing Google translation
  console.log('Test 4c: Switching from Google to Gemini re-translates instead of reusing Google translation');
  const textSample = 'Given an array of integers.';
  fetchCalls = [];
  fetchHandler = async (url) => {
    return {
      ok: true,
      status: 200,
      json: async () => [[['Cho một mảng các số nguyên (bản dịch google thô).', 'Given an array of integers.']]]
    };
  };
  const resGoogle = await sendMessage({
    action: 'translate',
    text: textSample,
    engine: 'google'
  });
  assert.strictEqual(resGoogle.text, 'Cho một mảng các số nguyên (bản dịch google thô).');

  // Now, translate same text with Gemini -> Must call Gemini and get fluent AI translation
  fetchCalls = [];
  fetchHandler = async (url, opts) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: 'Cho một mảng các số nguyên (bản dịch AI trôi chảy).' }]
          }
        }]
      })
    };
  };
  const resGemini = await sendMessage({
    action: 'translate',
    text: textSample,
    engine: 'gemini',
    geminiApiKey: 'my-test-key'
  });
  assert.strictEqual(resGemini.text, 'Cho một mảng các số nguyên (bản dịch AI trôi chảy).', 'Gemini must NOT reuse Google translation cache');
  console.log('✓ Test 4c passed: Switching from Google to Gemini re-translates with AI');

  // Test 4d: xKiro (Mistral) single item translation
  console.log('Test 4d: xKiro (Mistral) single item translation with model mistralai/mistral-small-2603');
  fetchCalls = [];
  fetchHandler = async (url, opts) => {
    assert.strictEqual(url, 'https://api.xkiro.com/v1/chat/completions');
    assert.strictEqual(opts.headers['Authorization'], 'Bearer test-xkiro-key');
    const body = JSON.parse(opts.body);
    assert.strictEqual(body.model, 'mistralai/mistral-small-2603');
    assert(body.messages && body.messages[0].content.includes('Calculate the minimum sum'));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Tính tổng nhỏ nhất'
            }
          }
        ]
      })
    };
  };

  const resXkiro = await sendMessage({
    action: 'translate',
    text: 'Calculate the minimum sum',
    engine: 'xkiro',
    xkiroApiKey: 'test-xkiro-key'
  });
  assert.strictEqual(resXkiro.text, 'Tính tổng nhỏ nhất');
  console.log('✓ Test 4d passed: xKiro single translation verified');

  // Test 4e: xKiro batch translation
  console.log('Test 4e: xKiro batch translation');
  fetchCalls = [];
  fetchHandler = async (url, opts) => {
    assert.strictEqual(url, 'https://api.xkiro.com/v1/chat/completions');
    const body = JSON.parse(opts.body);
    assert.strictEqual(body.model, 'mistralai/mistral-small-2603');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: '<<<CF_TRANSLATE_ITEM_0>>>\nĐầu vào bài toán\n\n<<<CF_TRANSLATE_ITEM_1>>>\nĐầu ra bài toán'
            }
          }
        ]
      })
    };
  };

  const resXkiroBatch = await sendMessage({
    action: 'translateBatch',
    items: ['Problem input', 'Problem output'],
    engine: 'xkiro',
    xkiroApiKey: 'test-xkiro-key'
  });
  assert.deepStrictEqual(resXkiroBatch.texts, ['Đầu vào bài toán', 'Đầu ra bài toán']);
  console.log('✓ Test 4e passed: xKiro batch translation verified');

  // Test 4g: Progressive streamItemReady delivery as AI generates items
  console.log('Test 4g: Progressive streamItemReady delivery as AI generates items');
  tabMessagesSent.length = 0;
  fetchCalls = [];
  fetchHandler = async (url, opts) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: '<<<CF_TRANSLATE_ITEM_0>>>\nĐoạn văn 1 đã dịch\n\n<<<CF_TRANSLATE_ITEM_1>>>\nĐoạn văn 2 đã dịch'
            }
          }
        ]
      })
    };
  };

  const resStreamBatch = await sendMessage({
    action: 'translateBatch',
    batchId: 'stream_test_123',
    items: ['Paragraph 1 to translate', 'Paragraph 2 to translate'],
    engine: 'xkiro',
    xkiroApiKey: 'test-xkiro-key'
  }, { tab: { id: 777 } });

  assert.deepStrictEqual(resStreamBatch.texts, ['Đoạn văn 1 đã dịch', 'Đoạn văn 2 đã dịch']);
  assert.strictEqual(tabMessagesSent.length, 2, 'Should have dispatched 2 real-time progressive stream messages to tab');
  assert.strictEqual(tabMessagesSent[0].tabId, 777);
  assert.strictEqual(tabMessagesSent[0].msg.action, 'streamItemReady');
  assert.strictEqual(tabMessagesSent[0].msg.batchId, 'stream_test_123');
  assert.strictEqual(tabMessagesSent[0].msg.index, 0);
  assert.strictEqual(tabMessagesSent[0].msg.text, 'Đoạn văn 1 đã dịch');
  assert.strictEqual(tabMessagesSent[1].msg.index, 1);
  assert.strictEqual(tabMessagesSent[1].msg.text, 'Đoạn văn 2 đã dịch');
  console.log('✓ Test 4g passed: Progressive streamItemReady delivery verified');

  // Test 5: Test Gemini API Key connection
  console.log('Test 5: testGeminiKey endpoint');
  fetchCalls = [];
  fetchHandler = async (url) => {
    assert(url.includes('models?key=valid-key'));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] }
        ]
      })
    };
  };

  const res5 = await sendMessage({ action: 'testGeminiKey', apiKey: 'valid-key' });
  assert.strictEqual(res5.success, true);
  assert.strictEqual(res5.valid, true);
  assert(res5.models.includes('gemini-2.5-flash'));
  assert(res5.models.includes('gemini-2.0-flash'));
  assert(!res5.models.includes('embedding-001'), 'Only generateContent models should be included');
  console.log('✓ Test 5 passed: testGeminiKey successfully verified key and filtered models');

  // Test 5c: testXKiroKey endpoint
  console.log('Test 5c: testXKiroKey endpoint');
  fetchCalls = [];
  fetchHandler = async (url, opts) => {
    assert.strictEqual(url, 'https://api.xkiro.com/v1/chat/completions');
    assert.strictEqual(opts.headers['Authorization'], 'Bearer valid-xkiro-key');
    const body = JSON.parse(opts.body);
    assert.strictEqual(body.model, 'mistralai/mistral-small-2603');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Hello!' } }]
      })
    };
  };
  const res5c = await sendMessage({ action: 'testXKiroKey', apiKey: 'valid-xkiro-key' });
  assert.strictEqual(res5c.success, true);
  assert.strictEqual(res5c.valid, true);
  assert.strictEqual(res5c.model, 'mistralai/mistral-small-2603');
  console.log('✓ Test 5c passed: testXKiroKey successfully verified xKiro API key');

  // Test 6: Persistent cache debounced saving to storage
  console.log('Test 6: Debounced cache saving to chrome.storage.local');
  await new Promise(r => setTimeout(r, 1200));
  assert(storageData.cf_translation_cache, 'Cache object should be saved in chrome.storage.local');
  assert(storageData.cf_translation_cache['google:Hello'] === 'Xin chào');
  // Test 7: Google Translate long text chunking (>1500 chars without double newlines)
  console.log('Test 7: Long text chunking in Google Translate');
  fetchCalls = [];
  fetchHandler = async (url) => {
    return {
      ok: true,
      status: 200,
      json: async () => [[['Phần dịch chunk.', 'Chunk text.']]]
    };
  };

  const longText = 'A'.repeat(800) + '. ' + 'B'.repeat(800);
  const res7 = await sendMessage({ action: 'translate', text: longText, engine: 'google' });
  assert.strictEqual(res7.success, true);
  assert(fetchCalls.length >= 2, 'Should split >1500 chars text into multiple chunks, calls: ' + fetchCalls.length);
  console.log('✓ Test 7 passed: Long text without double newlines chunked properly');

  // Test 8: Google Translate batch translation via dict-chrome-ex POST (Linguist architecture)
  console.log('Test 8: Google Translate batch translation via dict-chrome-ex POST (Linguist architecture)');
  fetchCalls = [];
  fetchHandler = async (url, opts) => {
    assert(url.includes('translate.googleapis.com'));
    assert(url.includes('client=dict-chrome-ex') || (opts && opts.method === 'POST'), 'Must use Linguist dict-chrome-ex POST endpoint');
    return {
      ok: true,
      status: 200,
      json: async () => [
        ['Quả táo', 'en'],
        ['Quả chuối', 'en']
      ]
    };
  };

  const res8 = await sendMessage({
    action: 'translateBatch',
    items: ['Apple fruit', 'Banana fruit'],
    engine: 'google'
  });
  assert.strictEqual(res8.success, true);
  assert.strictEqual(res8.texts.length, 2);
  assert.strictEqual(res8.texts[0], 'Quả táo');
  assert.strictEqual(res8.texts[1], 'Quả chuối');
  // Crucial: check that only 1 external HTTP request was made instead of 2!
  assert.strictEqual(fetchCalls.length, 1, 'Batch with 2 items must only make 1 combined HTTP request');
  console.log('✓ Test 8 passed: Google Translate batch translated via Linguist dict-chrome-ex in a single call');

  // Test 9: Google Translate fallback when primary dict-chrome-ex encounters error
  console.log('Test 9: Google Translate fallback when primary dict-chrome-ex fails');
  fetchCalls = [];
  let callCount = 0;
  fetchHandler = async (url, opts) => {
    callCount++;
    if (callCount === 1) {
      // Primary dict-chrome-ex call fails
      return { ok: false, status: 500, json: async () => ({}) };
    }
    // Fallback delimiter call succeeds
    const urlObj = new URL(url);
    const q = urlObj.searchParams.get('q') || '';
    const translatedCombined = '[[_CF_0_]]\nNội dung 0\n\n[[_CF_1_]]\nNội dung 1 riêng lẻ';
    return {
      ok: true,
      status: 200,
      json: async () => [[[translatedCombined, q, null, null]]]
    };
  };

  const res9 = await sendMessage({
    action: 'translateBatch',
    items: ['Item zero unique text', 'Item one unique text'],
    engine: 'google'
  });
  assert.strictEqual(res9.success, true);
  assert.strictEqual(res9.texts.length, 2);
  assert.strictEqual(res9.texts[0], 'Nội dung 0');
  assert.strictEqual(res9.texts[1], 'Nội dung 1 riêng lẻ');
  console.log('✓ Test 9 passed: Error fallback succeeded gracefully');

  // Test 10: Multi-Branch Version Scheme & evaluateUpdate
  console.log('Test 10: evaluateUpdate and checkForUpdates endpoint');

  // Scenario 1: Alpha -> Official Release (v1.0.0 Alpha -> v1.0.0)
  const eval1 = sandbox.evaluateUpdate(
    { version: '0.99.0', version_name: 'v1.0.0 Alpha' },
    { version: '1.0.0', version_name: 'v1.0.0' }
  );
  assert.strictEqual(eval1.hasUpdate, true, 'Alpha -> Official should have update');
  assert.strictEqual(eval1.updateType, 'official', 'updateType must be official');
  assert.strictEqual(eval1.isTestToOfficial, true, 'isTestToOfficial must be true');
  assert.strictEqual(eval1.autoUpdate, true, 'Official release must auto-update silently');
  assert.strictEqual(eval1.isSilent, true, 'Official release must auto-update silently');
  assert(eval1.message.includes('chính thức'), 'Message must indicate official release');

  // Scenario 2: Alpha Hotfix for Alpha user (v1.0.0 Alpha -> v1.0.0 Alpha HF.1.0)
  const eval2 = sandbox.evaluateUpdate(
    { version: '0.99.0', version_name: 'v1.0.0 Alpha' },
    { version: '0.99.1', version_name: 'v1.0.0 Alpha HF.1.0' }
  );
  assert.strictEqual(eval2.hasUpdate, true, 'Alpha HF for Alpha user should have update');
  assert.strictEqual(eval2.updateType, 'alpha_hotfix', 'updateType must be alpha_hotfix');
  assert.strictEqual(eval2.autoUpdate, true, 'Alpha HF must auto-update silently for Alpha users');
  assert.strictEqual(eval2.isSilent, true, 'isSilent must be true for Alpha HF');

  // Scenario 2b: Newer Alpha Hotfix (v1.0.0 Alpha HF.1.0 -> v1.0.0 Alpha HF.1.1)
  const eval2b = sandbox.evaluateUpdate(
    { version: '0.99.1', version_name: 'v1.0.0 Alpha HF.1.0' },
    { version: '0.99.2', version_name: 'v1.0.0 Alpha HF.1.1' }
  );
  assert.strictEqual(eval2b.hasUpdate, true);
  assert.strictEqual(eval2b.updateType, 'alpha_hotfix');
  assert.strictEqual(eval2b.autoUpdate, true);

  // Scenario 2c: Stable user should NOT be forced into Alpha HF
  const eval2c = sandbox.evaluateUpdate(
    { version: '1.0.0', version_name: 'v1.0.0' },
    { version: '0.99.1', version_name: 'v1.0.0 Alpha HF.1.0' }
  );
  assert.strictEqual(eval2c.hasUpdate, false, 'Stable user must NOT be forced into Alpha HF');

  // Scenario 3: Stable Hotfix (v1.0.0 -> v1.0.0 HF.1.0)
  const eval3 = sandbox.evaluateUpdate(
    { version: '1.0.0', version_name: 'v1.0.0' },
    { version: '1.0.1', version_name: 'v1.0.0 HF.1.0' }
  );
  assert.strictEqual(eval3.hasUpdate, true, 'Stable HF should have update');
  assert.strictEqual(eval3.updateType, 'stable_hotfix', 'updateType must be stable_hotfix');
  assert.strictEqual(eval3.autoUpdate, true, 'Stable HF must 100% auto-update silently');
  assert.strictEqual(eval3.isSilent, true, 'isSilent must be true');

  // Scenario 3b: Stable Hotfix applied to Alpha user as well
  const eval3b = sandbox.evaluateUpdate(
    { version: '0.99.0', version_name: 'v1.0.0 Alpha' },
    { version: '1.0.1', version_name: 'v1.0.0 HF.1.0' }
  );
  assert.strictEqual(eval3b.hasUpdate, true, 'Stable HF should update Alpha users to hotfixed official');
  assert.strictEqual(eval3b.updateType, 'stable_hotfix');
  assert.strictEqual(eval3b.autoUpdate, true);

  // Scenario 4: New Trial Alpha (v1.0.0 -> v1.1.0 Alpha or v1.0.0 Alpha -> v1.1.0 Alpha)
  const eval4 = sandbox.evaluateUpdate(
    { version: '1.0.0', version_name: 'v1.0.0' },
    { version: '1.0.99', version_name: 'v1.1.0 Alpha' }
  );
  assert.strictEqual(eval4.hasUpdate, true, 'New Alpha trial should be detected');
  assert.strictEqual(eval4.updateType, 'alpha_trial', 'updateType must be alpha_trial');
  assert.strictEqual(eval4.autoUpdate, true, 'Alpha trial must auto-update silently');
  assert.strictEqual(eval4.isSilent, true, 'isSilent must be true');
  assert.strictEqual(eval4.isTrial, true, 'isTrial must be true');

  // Scenario 4b: Alpha Hotfix incrementing z (v1.1.0 Alpha -> v1.1.1 Alpha)
  const eval4b = sandbox.evaluateUpdate(
    { version: '1.1.0', version_name: 'v1.1.0 Alpha' },
    { version: '1.1.1', version_name: 'v1.1.1 Alpha' }
  );
  assert.strictEqual(eval4b.hasUpdate, true, 'Alpha hotfix incrementing z must be detected');
  assert.strictEqual(eval4b.autoUpdate, true, 'Alpha hotfix incrementing z must auto-update');
  assert.strictEqual(eval4b.isSilent, true, 'Alpha hotfix incrementing z must be silent');

  // Scenario 5: Equal or older versions
  const eval5 = sandbox.evaluateUpdate(
    { version: '1.0.0', version_name: 'v1.0.0' },
    { version: '1.0.0', version_name: 'v1.0.0' }
  );
  assert.strictEqual(eval5.hasUpdate, false, 'Same version should have no update');

  const eval5b = sandbox.evaluateUpdate(
    { version: '1.0.0', version_name: 'v1.0.0' },
    { version: '0.99.0', version_name: 'v1.0.0 Alpha' }
  );
  assert.strictEqual(eval5b.hasUpdate, false, 'Stable should not downgrade to Alpha of same version');

  // Test checkForUpdates via message listener
  fetchCalls = [];
  fetchHandler = async (url) => {
    assert(url.includes('raw.githubusercontent.com/PTK-2411/codeforces-effect/main/manifest.json'));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        version: '1.0.0',
        version_name: 'v1.0.0'
      })
    };
  };

  const updateRes = await sendMessage({ action: 'checkForUpdates' });
  assert.strictEqual(updateRes.success, true);
  assert.strictEqual(updateRes.hasUpdate, true, 'Should detect update from Alpha to Official');
  assert.strictEqual(updateRes.updateType, 'official');
  assert.strictEqual(updateRes.isTestToOfficial, true);
  assert.strictEqual(updateRes.remoteVersionName, 'v1.0.0');
  assert.strictEqual(storageData.cfUpdateInfo.hasUpdate, true, 'Should store update info into storage');
  console.log('✓ Test 10 passed: Multi-branch versioning scheme, hotfixes, and trial updates evaluated successfully');

  // Test 11: Background media caching (cacheMedia) and continuous playback preservation
  console.log('Test 11: Background media caching and continuous on-screen playback preservation');
  storageData.bgHistory = [
    {
      id: 'video_test_123',
      url: 'https://example.com/cool-video.mp4',
      type: 'video',
      hasCache: false
    }
  ];
  storageData.bgImage = 'https://example.com/cool-video.mp4';

  fetchHandler = async (url) => {
    if (url.includes('cool-video.mp4')) {
      const dummyBuffer = Buffer.from('mock video binary content 123456');
      return {
        ok: true,
        status: 200,
        blob: async () => ({
          type: 'video/mp4',
          arrayBuffer: async () => dummyBuffer.buffer.slice(dummyBuffer.byteOffset, dummyBuffer.byteOffset + dummyBuffer.byteLength)
        })
      };
    }
    return { ok: false, status: 404 };
  };

  const cacheRes = await sendMessage({
    action: 'cacheMedia',
    id: 'video_test_123',
    url: 'https://example.com/cool-video.mp4',
    type: 'video'
  });
  assert.strictEqual(cacheRes.status, 'started');

  // Wait a moment for background cache processing
  await new Promise(r => setTimeout(r, 100));

  assert(storageData['cf_cache_video_test_123'], 'Local cache cf_cache_video_test_123 must be saved to storage');
  assert(storageData['cf_cache_video_test_123'].startsWith('data:video/mp4;base64,'), 'Cached item must be data:video/mp4;base64');
  assert.strictEqual(storageData.bgHistory[0].hasCache, true, 'bgHistory item must be marked hasCache: true');
  assert.strictEqual(storageData.bgImage, 'https://example.com/cool-video.mp4', 'Active bgImage must NOT be overwritten mid-playback so screen keeps playing');
  assert.strictEqual(storageData.bgImageOriginal, 'https://example.com/cool-video.mp4', 'Original URL reference must be saved in bgImageOriginal');
  console.log('✓ Test 11 passed: Media downloaded locally in background while on-screen playback remains uninterrupted');

  console.log('\nALL background.js TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
