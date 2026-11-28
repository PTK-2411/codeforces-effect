// Unit & DOM test for popup/popup.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('=== Running Tests for popup.js ===');

// Mock Elements Map
const elements = {};
function createMockEl(id, tagName = 'div', type = '') {
  const classes = new Set();
  const el = {
    id,
    tagName: tagName.toUpperCase(),
    type,
    value: '',
    checked: false,
    textContent: '',
    get className() {
      return Array.from(classes).join(' ');
    },
    set className(val) {
      classes.clear();
      String(val || '').split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
    },
    classList: {
      _classes: classes,
      add: function(...c) { c.forEach(x => classes.add(x)); },
      remove: function(...c) { c.forEach(x => classes.delete(x)); },
      contains: function(c) { return classes.has(c); }
    },
    attributes: {},
    dataset: {},
    style: {},
    _listeners: {},
    addEventListener: function(event, fn) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(fn);
    },
    click: function() {
      if (this._listeners['click']) {
        this._listeners['click'].forEach(fn => fn({ preventDefault: () => {}, stopPropagation: () => {} }));
      }
    },
    dispatchEvent: function(event) {
      if (this._listeners[event]) {
        this._listeners[event].forEach(fn => fn({ target: this, key: '' }));
      }
    },
    querySelectorAll: function(sel) {
      return [];
    },
    querySelector: function(sel) {
      return null;
    },
    appendChild: function(c) {},
    pause: function() {},
    play: async function() {},
    load: function() {},
    _src: '',
    get src() { return this._src; },
    set src(val) {
      this._src = val;
      if (this.tagName === 'VIDEO') {
        setTimeout(() => {
          if (this.onloadeddata) this.onloadeddata();
          if (this.onseeked) this.onseeked();
        }, 5);
      }
    }
  };
  elements[id] = el;
  return el;
}

// Create required DOM elements for popup
const ids = [
  'toggle-enabled', 'toggle-codeforces', 'toggle-vjudge', 'toggle-vnoj', 'sites-card', 'controls-section', 'btn-reset',
  'tab-btn-upload', 'tab-btn-url', 'panel-upload', 'panel-url',
  'dropzone', 'file-input', 'empty-state',
  'url-input', 'btn-apply-url', 'url-status',
  'preview-state', 'preview-img', 'preview-video', 'preview-type-badge', 'btn-remove',
  'history-section', 'history-count', 'history-list',
  'blur-slider', 'blur-val', 'overlay-slider', 'overlay-val', 'opacity-slider', 'opacity-val',
  'theme-val', 'theme-options',
  'trans-engine-badge', 'trans-engine-options', 'gemini-key-container', 'gemini-api-key',
  'btn-toggle-key-visibility', 'gemini-model-select', 'gemini-custom-model-container',
  'gemini-custom-model', 'btn-test-gemini', 'gemini-test-status',
  'xkiro-key-container', 'xkiro-api-key', 'btn-toggle-xkiro-visibility',
  'xkiro-model', 'btn-test-xkiro', 'xkiro-test-status',
  'size-options',
  'popup-streak-badge', 'stat-current-streak', 'stat-streak-subs', 'stat-max-streak', 'stat-total-days', 'popup-streak-status',
  'update-banner', 'update-title', 'update-desc', 'update-tag', 'btn-update-now',
  'btn-open-tab', 'btn-open-upload-tab', 'upload-popup-view', 'upload-tab-view',
  'btn-github'
];

ids.forEach(id => createMockEl(id));

// Setup translation engine options pill buttons
const googleBtn = createMockEl('btn-google', 'button');
googleBtn.dataset.engine = 'google';
const geminiBtn = createMockEl('btn-gemini', 'button');
geminiBtn.dataset.engine = 'gemini';
const xkiroBtn = createMockEl('btn-xkiro', 'button');
xkiroBtn.dataset.engine = 'xkiro';
elements['trans-engine-options'].querySelectorAll = (sel) => {
  if (sel === '.pill-btn') return [googleBtn, geminiBtn, xkiroBtn];
  return [];
};

// Setup theme options pill buttons
const darkBtn = createMockEl('btn-dark', 'button');
darkBtn.dataset.theme = 'dark';
const lightBtn = createMockEl('btn-light', 'button');
lightBtn.dataset.theme = 'light';
elements['theme-options'].querySelectorAll = (sel) => {
  if (sel === '.pill-btn') return [darkBtn, lightBtn];
  return [];
};

// Setup size options pill buttons
const coverBtn = createMockEl('btn-cover', 'button');
coverBtn.dataset.size = 'cover';
elements['size-options'].querySelectorAll = (sel) => {
  if (sel === '.pill-btn') return [coverBtn];
  return [];
};

const btnUpdateNowSpan = createMockEl('btn-update-now-span', 'span');
btnUpdateNowSpan.textContent = 'Cập nhật ngay';
elements['btn-update-now'].querySelector = (sel) => {
  if (sel === 'span') return btnUpdateNowSpan;
  return null;
};

const versionTagEl = createMockEl('version-tag', 'span');
versionTagEl.textContent = 'v1.2.0';

const storage = {};
let storageChangeCallback = null;
const messagesSent = [];
const tabsCreated = [];

const mockChrome = {
  tabs: {
    create: (opts) => { tabsCreated.push(opts); }
  },
  runtime: {
    getURL: (p) => `chrome-extension://mock/${p}`,
    getManifest: () => ({
      version: '1.2.0',
      version_name: 'v1.2.0'
    }),
    sendMessage: (msg, cb) => {
      messagesSent.push(msg);
      if (!cb) cb = () => {};
      if (msg.action === 'testGeminiKey') {
        if (msg.apiKey === 'valid-test-key') {
          cb({ success: true, models: ['gemini-2.5-flash', 'gemini-2.0-flash'] });
        } else {
          cb({ success: false, error: 'API Key không hợp lệ' });
        }
      } else if (msg.action === 'testXKiroKey') {
        if (msg.apiKey === 'valid-xkiro-key') {
          cb({ success: true, model: 'mistralai/mistral-small-2603' });
        } else {
          cb({ success: false, error: 'API Key không hợp lệ' });
        }
      } else if (msg.action === 'testLibreTranslate') {
        if (msg.url && msg.url.includes('libretranslate')) {
          cb({ success: true, translatedText: 'Xin chào' });
        } else {
          cb({ success: false, error: 'Không thể kết nối máy chủ' });
        }
      } else if (msg.action === 'checkForUpdates') {
        cb({
          success: true,
          hasUpdate: true,
          updateType: 'official',
          isTestToOfficial: true,
          currentVersionName: 'v1.0.0 Alpha',
          remoteVersionName: 'v1.0.0',
          repoUrl: 'https://github.com/PTK-2411/oj-effect'
        });
      }
    }
  },
  storage: {
    local: {
      get: (keys, cb) => {
        cb({ ...storage });
      },
      set: (obj) => {
        Object.assign(storage, obj);
      },
      remove: (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach(k => delete storage[k]);
      }
    },
    onChanged: {
      addListener: (fn) => { storageChangeCallback = fn; }
    }
  }
};

const mockDocument = {
  getElementById: (id) => elements[id] || null,
  querySelector: (sel) => {
    if (sel === '.version-tag') return versionTagEl;
    if (sel.startsWith('#')) return elements[sel.slice(1)] || null;
    return null;
  },
  createElement: (tag) => createMockEl('mock-' + Math.random(), tag),
  addEventListener: () => {}
};

const sandbox = {
  window: {},
  document: mockDocument,
  chrome: mockChrome,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  alert: (msg) => {},
  URL: {
    createObjectURL: () => 'blob:mock-video-src',
    revokeObjectURL: () => {}
  },
  FileReader: class {
    readAsDataURL(file) {
      setTimeout(() => {
        if (this.onload) {
          this.onload({
            target: {
              result: (file && file.name && file.name.endsWith('.mp4'))
                ? 'data:video/mp4;base64,AAAAVIDEODATA'
                : 'data:image/jpeg;base64,AAAAIMGDATA'
            }
          });
        }
      }, 5);
    }
  },
  Image: class {
    constructor() { this.onload = null; }
  }
};
vm.createContext(sandbox);

const popupCode = fs.readFileSync(path.join(__dirname, '../popup/popup.js'), 'utf8');
vm.runInContext(popupCode, sandbox);

async function runPopupTests() {
  // Test 1: Switch translation engine to Gemini
  console.log('Test 1: Switching translation engine to Gemini');
  geminiBtn.click();
  assert.strictEqual(storage.translationEngine, 'gemini', 'Storage should record translationEngine as gemini');
  assert.strictEqual(elements['trans-engine-badge'].textContent, 'Gemini AI');
  assert(!elements['gemini-key-container'].classList.contains('hidden'), 'gemini-key-container should be visible');
  console.log('✓ Test 1 passed: Switched to Gemini and container shown');

  // Test 2: Input Gemini API Key
  console.log('Test 2: Input and store Gemini API Key');
  elements['gemini-api-key'].value = 'valid-test-key';
  elements['gemini-api-key'].dispatchEvent('input');
  assert.strictEqual(storage.geminiApiKey, 'valid-test-key', 'API key should be saved to storage');
  console.log('✓ Test 2 passed: Gemini API Key stored in storage');

  // Test 3: Toggle Key Visibility
  console.log('Test 3: Toggle key visibility');
  elements['gemini-api-key'].type = 'password';
  elements['btn-toggle-key-visibility'].click();
  assert.strictEqual(elements['gemini-api-key'].type, 'text');
  elements['btn-toggle-key-visibility'].click();
  assert.strictEqual(elements['gemini-api-key'].type, 'password');
  console.log('✓ Test 3 passed: API key visibility toggle works');

  // Test 4: Select Model & Custom Model
  console.log('Test 4: Gemini model selection');
  elements['gemini-model-select'].value = 'gemini-3.5-flash-lite';
  elements['gemini-model-select'].dispatchEvent('change');
  assert.strictEqual(storage.geminiModel, 'gemini-3.5-flash-lite');

  // Select custom model
  elements['gemini-model-select'].value = 'custom';
  elements['gemini-model-select'].dispatchEvent('change');
  assert(!elements['gemini-custom-model-container'].classList.contains('hidden'), 'custom model container should be visible');
  elements['gemini-custom-model'].value = 'gemini-custom-exp';
  elements['gemini-custom-model'].dispatchEvent('input');
  assert.strictEqual(storage.geminiCustomModel, 'gemini-custom-exp');
  console.log('✓ Test 4 passed: Model select and custom model input saved to storage');


  // Test 5: Test Gemini connection button
  console.log('Test 5: Test connection button with valid key');
  elements['gemini-api-key'].value = 'valid-test-key';
  elements['btn-test-gemini'].click();
  assert(elements['gemini-test-status'].textContent.includes('Kết nối thành công'), 'Status should show success');

  // Test connection button with invalid key
  console.log('Test 5b: Test connection button with invalid key');
  elements['gemini-api-key'].value = 'wrong-key';
  elements['btn-test-gemini'].click();
  assert(elements['gemini-test-status'].textContent.includes('❌') || elements['gemini-test-status'].textContent.includes('không hợp lệ'), 'Status should show error');
  console.log('✓ Test 5 passed: Connection test correctly updates UI');

  // Test 6: Switch back to Google Translate
  console.log('Test 6: Switch back to Google Translate engine');
  googleBtn.click();
  assert.strictEqual(storage.translationEngine, 'google');
  assert(elements['gemini-key-container'].classList.contains('hidden'), 'gemini container should be hidden');
  assert(elements['xkiro-key-container'].classList.contains('hidden'), 'xkiro container should be hidden');
  assert.strictEqual(elements['trans-engine-badge'].textContent, 'Google');
  console.log('✓ Test 6 passed: Switched back to Google Translate engine successfully');

  // Test 6b: Switch to xKiro engine & test connection & custom model input
  console.log('Test 6b: Switch to xKiro engine, custom model input, toggle visibility and test connection');
  xkiroBtn.click();
  assert.strictEqual(storage.translationEngine, 'xkiro', 'Storage should record translationEngine as xkiro');
  assert.strictEqual(elements['trans-engine-badge'].textContent, 'xKiro');
  assert(!elements['xkiro-key-container'].classList.contains('hidden'), 'xkiro container should be visible');
  assert(elements['gemini-key-container'].classList.contains('hidden'), 'gemini container should be hidden');
  assert.strictEqual(elements['xkiro-model'].value, 'qwen/qwen3.8-omni-flash:free', 'Default xKiro model must be qwen/qwen3.8-omni-flash:free');

  // Input custom xKiro model
  elements['xkiro-model'].value = 'openai/gpt-4o-mini';
  elements['xkiro-model'].dispatchEvent('input');
  assert.strictEqual(storage.xkiroModel, 'openai/gpt-4o-mini', 'Custom xKiro model input must be saved to storage');

  // Input xKiro API key
  elements['xkiro-api-key'].value = 'valid-xkiro-key';
  elements['xkiro-api-key'].dispatchEvent('input');
  assert.strictEqual(storage.xkiroApiKey, 'valid-xkiro-key');

  // Toggle xKiro key visibility
  elements['xkiro-api-key'].type = 'password';
  elements['btn-toggle-xkiro-visibility'].click();
  assert.strictEqual(elements['xkiro-api-key'].type, 'text');

  // Test xKiro connection button
  elements['btn-test-xkiro'].click();
  assert(elements['xkiro-test-status'].textContent.includes('Kết nối thành công'), 'xKiro status should show success');
  console.log('✓ Test 6b passed: xKiro engine selection, key storage and connection test verified');

  // Test 7: Multi-Branch Update banner display & version tag
  console.log('Test 7: Update banner display across branch update scenarios');

  // Verify version tag
  assert(versionTagEl.textContent.includes('v1.2.0'), 'Version tag in header must display v1.2.0');

  // Scenario 1: Official release banner
  if (storageChangeCallback) {
    storageChangeCallback({
      cfUpdateInfo: {
        newValue: {
          hasUpdate: true,
          updateType: 'official',
          isTestToOfficial: true,
          currentVersionName: 'v1.0.0 Alpha',
          remoteVersionName: 'v1.0.0',
          repoUrl: 'https://github.com/PTK-2411/oj-effect'
        }
      }
    }, 'local');
  }

  assert.strictEqual(elements['update-banner'].style.display, 'flex', 'Update banner should be visible');
  assert(elements['update-title'].textContent.includes('Đã có bản chính thức'), 'Title should notify official version');
  assert.strictEqual(elements['update-tag'].textContent, 'OFFICIAL');
  assert(elements['update-tag'].classList.contains('tag-official'));
  assert.strictEqual(btnUpdateNowSpan.textContent, 'Áp dụng ngay');

  // Scenario 2: Stable Hotfix banner (Automatic background update)
  if (storageChangeCallback) {
    storageChangeCallback({
      cfUpdateInfo: {
        newValue: {
          hasUpdate: true,
          updateType: 'stable_hotfix',
          autoUpdate: true,
          isSilent: true,
          currentVersionName: 'v1.0.0',
          remoteVersionName: 'v1.0.0 HF.1.0',
          repoUrl: 'https://github.com/PTK-2411/oj-effect'
        }
      }
    }, 'local');
  }
  assert.strictEqual(elements['update-title'].textContent, 'Bản vá khẩn cấp (Hotfix)');
  assert.strictEqual(elements['update-tag'].textContent, 'HOTFIX');
  assert(elements['update-tag'].classList.contains('tag-hotfix'));
  assert.strictEqual(btnUpdateNowSpan.textContent, 'Áp dụng ngay');

  // Scenario 3: Alpha Hotfix banner
  if (storageChangeCallback) {
    storageChangeCallback({
      cfUpdateInfo: {
        newValue: {
          hasUpdate: true,
          updateType: 'alpha_hotfix',
          autoUpdate: true,
          isSilent: true,
          currentVersionName: 'v1.0.0 Alpha',
          remoteVersionName: 'v1.0.0 Alpha HF.1.0',
          repoUrl: 'https://github.com/PTK-2411/oj-effect'
        }
      }
    }, 'local');
  }
  assert.strictEqual(elements['update-title'].textContent, 'Bản vá lỗi Alpha (Hotfix)');
  assert.strictEqual(elements['update-tag'].textContent, 'ALPHA HF');
  assert(elements['update-tag'].classList.contains('tag-hotfix'));
  assert.strictEqual(btnUpdateNowSpan.textContent, 'Áp dụng ngay');

  // Scenario 4: Alpha Trial banner
  if (storageChangeCallback) {
    storageChangeCallback({
      cfUpdateInfo: {
        newValue: {
          hasUpdate: true,
          updateType: 'alpha_trial',
          autoUpdate: true,
          isTrial: true,
          currentVersionName: 'v1.0.0',
          remoteVersionName: 'v1.1.0 Alpha',
          repoUrl: 'https://github.com/PTK-2411/oj-effect'
        }
      }
    }, 'local');
  }
  assert.strictEqual(elements['update-title'].textContent, 'Bản thử nghiệm mới!');
  assert.strictEqual(elements['update-tag'].textContent, 'ALPHA');
  assert(elements['update-tag'].classList.contains('tag-alpha'));
  assert.strictEqual(btnUpdateNowSpan.textContent, 'Áp dụng ngay');

  // Verify clicking btn-update-now triggers reload / loading state
  elements['btn-update-now'].click();
  assert.strictEqual(elements['btn-update-now'].disabled, true);
  assert.strictEqual(btnUpdateNowSpan.textContent, 'Đang tải lại...');

  // Scenario 5: No update (banner hidden)
  if (storageChangeCallback) {
    storageChangeCallback({
      cfUpdateInfo: {
        newValue: {
          hasUpdate: false
        }
      }
    }, 'local');
  }
  assert.strictEqual(elements['update-banner'].style.display, 'none', 'Banner should be hidden when hasUpdate is false');

  console.log('✓ Test 7 passed: Update banner and tag styling correctly adapt to Official, Hotfix, and Trial releases');

  // Test 8: Apply video URL link with immediate screen playback and background caching
  console.log('Test 8: Video URL input applies immediately to screen and triggers background cache');
  const urlInputEl = elements['url-input'];
  const btnApplyUrlEl = elements['btn-apply-url'];
  const urlStatusEl = elements['url-status'];

  urlInputEl.value = 'https://example.com/beautiful-space.mp4';
  btnApplyUrlEl.click();

  // Allow immediate event handlers to complete
  await new Promise(r => setTimeout(r, 50));

  assert.strictEqual(storage.bgImage, 'https://example.com/beautiful-space.mp4', 'bgImage must be immediately applied');
  assert.strictEqual(storage.bgType, 'video', 'bgType must be video');
  assert(urlStatusEl.textContent.includes('Đã phát video làm nền! Đang tải ngầm'), 'Status must indicate immediate video playback with background caching');
  assert(messagesSent.some(m => m.action === 'cacheMedia' && m.url === 'https://example.com/beautiful-space.mp4' && m.type === 'video'), 'cacheMedia message must be dispatched to background service worker');
  console.log('✓ Test 8 passed: Video URL applied immediately to screen with background download dispatched');

  // Test 9: Local video/image upload from computer with extension fallback (e.g. Linux empty mime type)
  console.log('Test 9: Local video upload from machine with empty file.type and extension fallback');
  const dropzoneEl = elements['dropzone'];
  const fileInputEl = elements['file-input'];

  let fileInputClicked = false;
  fileInputEl.click = () => { fileInputClicked = true; };

  dropzoneEl.click();
  assert.strictEqual(fileInputClicked, true, 'Clicking dropzone must trigger fileInput.click()');

  // Simulate picking a local .mp4 video on Linux where file.type is ""
  const mockVideoFile = {
    name: 'space_journey.mp4',
    type: '',
    size: 5 * 1024 * 1024 // 5MB
  };

  fileInputEl.value = 'C:\\fakepath\\space_journey.mp4';
  if (fileInputEl._listeners['change']) {
    fileInputEl._listeners['change'].forEach(fn => fn({
      target: {
        files: [mockVideoFile]
      }
    }));
  }

  assert.strictEqual(fileInputEl.value, '', 'fileInput.value must be reset to allow re-selecting the same file');

  // Allow FileReader and async thumbnail/save to complete
  await new Promise(r => setTimeout(r, 60));

  assert.strictEqual(storage.bgType, 'video', 'Local .mp4 file must be recognized as video even with empty file.type');
  assert(storage.bgImage && storage.bgImage.startsWith('data:video/mp4;base64,'), 'bgImage must be set to video data URL');
  assert(storage.bgHistory && storage.bgHistory.length > 0, 'bgHistory must record the uploaded file');

  const cacheKey = 'cf_cache_' + storage.bgImageId;
  assert(storage[cacheKey], 'Uploaded video payload must be cached under cf_cache_ ID in local storage');
  console.log('✓ Test 9 passed: Local file upload with extension fallback and storage caching verified');

  // Test 10: Dedicated tab buttons open popup in full tab to prevent Chromium blur closing
  console.log('Test 10: Dedicated tab opening prevents Chromium focus loss popup destruction');
  const btnOpenTabEl = elements['btn-open-tab'];
  const btnOpenUploadTabEl = elements['btn-open-upload-tab'];

  btnOpenTabEl.click();
  assert(tabsCreated.some(t => t.url && t.url.includes('popup.html?tab=upload')), 'btn-open-tab must create dedicated tab with popup.html?tab=upload');

  btnOpenUploadTabEl.click();
  assert.strictEqual(tabsCreated.length, 2, 'btn-open-upload-tab must create dedicated tab');
  console.log('✓ Test 10 passed: Dedicated tab buttons correctly open full tab to prevent popup auto-close');

  // Test 11: GitHub repository button opens OJ Effect repo
  console.log('Test 11: GitHub repository button opens OJ Effect repo');
  const btnGithubEl = elements['btn-github'];
  assert(btnGithubEl, 'btn-github must exist in popup');
  btnGithubEl.click();
  assert(tabsCreated.some(t => t.url === 'https://github.com/PTK-2411/oj-effect'), 'btn-github must open https://github.com/PTK-2411/oj-effect');
  console.log('✓ Test 11 passed: GitHub button opens oj-effect repository');

  // Test 12: Target sites toggle switches for Codeforces, VJudge and VNOJ
  console.log('Test 12: Target sites toggle switches for Codeforces, VJudge and VNOJ');
  const toggleCodeforcesEl = elements['toggle-codeforces'];
  const toggleVJudgeEl = elements['toggle-vjudge'];
  const toggleVNOJEl = elements['toggle-vnoj'];
  assert(toggleCodeforcesEl, 'toggle-codeforces element must exist in popup');
  assert(toggleVJudgeEl, 'toggle-vjudge element must exist in popup');
  assert(toggleVNOJEl, 'toggle-vnoj element must exist in popup');

  // Verify initial state
  assert.strictEqual(toggleCodeforcesEl.checked, true, 'toggle-codeforces should be checked by default');
  assert.strictEqual(toggleVJudgeEl.checked, true, 'toggle-vjudge should be checked by default');
  assert.strictEqual(toggleVNOJEl.checked, true, 'toggle-vnoj should be checked by default');

  // Toggle Codeforces off
  toggleCodeforcesEl.checked = false;
  toggleCodeforcesEl.dispatchEvent('change');
  assert.strictEqual(storage['enableCodeforces'], false, 'Toggling Codeforces off should update storage.enableCodeforces to false');

  // Toggle VJudge off
  toggleVJudgeEl.checked = false;
  toggleVJudgeEl.dispatchEvent('change');
  assert.strictEqual(storage['enableVJudge'], false, 'Toggling VJudge off should update storage.enableVJudge to false');

  // Toggle VNOJ off
  toggleVNOJEl.checked = false;
  toggleVNOJEl.dispatchEvent('change');
  assert.strictEqual(storage['enableVNOJ'], false, 'Toggling VNOJ off should update storage.enableVNOJ to false');

  // Toggle back on
  toggleCodeforcesEl.checked = true;
  toggleCodeforcesEl.dispatchEvent('change');
  assert.strictEqual(storage['enableCodeforces'], true, 'Toggling Codeforces on should update storage.enableCodeforces to true');

  toggleVJudgeEl.checked = true;
  toggleVJudgeEl.dispatchEvent('change');
  assert.strictEqual(storage['enableVJudge'], true, 'Toggling VJudge on should update storage.enableVJudge to true');

  toggleVNOJEl.checked = true;
  toggleVNOJEl.dispatchEvent('change');
  assert.strictEqual(storage['enableVNOJ'], true, 'Toggling VNOJ on should update storage.enableVNOJ to true');

  console.log('✓ Test 12 passed: Target sites toggle switches for Codeforces, VJudge and VNOJ verified');

  console.log('\nALL popup.js TESTS PASSED SUCCESSFULLY!');
}

runPopupTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
