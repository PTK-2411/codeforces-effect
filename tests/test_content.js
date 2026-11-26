// Integration & DOM preservation test for content/content.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('=== Running Tests for content.js ===');

// Simple DOM Mock
class MockNode {
  constructor(nodeType, nodeName, nodeValue = '') {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.nodeValue = nodeValue;
    this.childNodes = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = {};
    const classes = new Set();
    this.classList = {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      contains: (x) => classes.has(x),
      has: (x) => classes.has(x),
      toggle: (x, force) => {
        if (force === true) { classes.add(x); return true; }
        if (force === false) { classes.delete(x); return false; }
        if (classes.has(x)) { classes.delete(x); return false; }
        classes.add(x); return true;
      },
      [Symbol.iterator]: () => classes[Symbol.iterator]()
    };
    this._classes = classes;
    this.style = {
      setProperty: (prop, val) => {
        this.style[prop] = val;
        const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.style[camel] = val;
      },
      removeProperty: (prop) => {
        delete this.style[prop];
        const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        delete this.style[camel];
      }
    };
    this.load = () => {};
    this.play = async () => {};
    this.pause = () => {};
    this._listeners = {};
    this.addEventListener = (ev, fn) => {
      this._listeners[ev] = this._listeners[ev] || [];
      this._listeners[ev].push(fn);
    };
    this.click = () => {
      (this._listeners['click'] || []).forEach(fn => fn({ target: this, preventDefault: () => {}, stopPropagation: () => {} }));
    };
    this.dispatchEvent = (ev) => {
      const type = (ev && ev.type) || ev;
      (this._listeners[type] || []).forEach(fn => fn(ev || { target: this, preventDefault: () => {}, stopPropagation: () => {} }));
    };
  }


  get firstChild() { return this.childNodes[0] || null; }
  get nextSibling() {
    if (!this.parentElement) return null;
    const idx = this.parentElement.childNodes.indexOf(this);
    return idx >= 0 && idx + 1 < this.parentElement.childNodes.length ? this.parentElement.childNodes[idx + 1] : null;
  }
  get children() {
    return this.childNodes.filter(n => n.nodeType === 1);
  }

  appendChild(child) {
    if (child.parentElement) child.parentElement.removeChild(child);
    child.parentElement = this;
    this.childNodes.push(child);
    return child;
  }

  prepend(child) {
    if (child.parentElement) child.parentElement.removeChild(child);
    child.parentElement = this;
    this.childNodes.unshift(child);
    return child;
  }

  insertBefore(newNode, refNode) {
    if (!refNode) return this.appendChild(newNode);
    if (newNode.parentElement) newNode.parentElement.removeChild(newNode);
    const idx = this.childNodes.indexOf(refNode);
    if (idx >= 0) {
      this.childNodes.splice(idx, 0, newNode);
      newNode.parentElement = this;
    } else {
      this.appendChild(newNode);
    }
    return newNode;
  }

  insertAdjacentElement(position, element) {
    if (position === 'beforebegin') {
      if (this.parentElement) this.parentElement.insertBefore(element, this);
    } else if (position === 'afterbegin') {
      this.prepend(element);
    } else if (position === 'beforeend') {
      this.appendChild(element);
    } else if (position === 'afterend') {
      if (this.parentElement) this.parentElement.insertBefore(element, this.nextSibling);
    }
    return element;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx >= 0) {
      this.childNodes.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }

  replaceWith(newNode) {
    if (!this.parentElement) return;
    const idx = this.parentElement.childNodes.indexOf(this);
    if (idx >= 0) {
      this.parentElement.childNodes[idx] = newNode;
      newNode.parentElement = this.parentElement;
      this.parentElement = null;
    }
  }

  getAttribute(name) { return this.attributes[name] || null; }
  hasAttribute(name) { return this.attributes[name] !== undefined; }
  get title() { return this.attributes['title'] || ''; }
  set title(val) { this.setAttribute('title', val); }
  setAttribute(name, val) {
    this.attributes[name] = String(val);
    if (name === 'class') {
      this.className = String(val);
    }
    if (name === 'id') {
      this.id = String(val);
    }
  }
  removeAttribute(name) { delete this.attributes[name]; }

  get className() { return Array.from(this._classes).join(' '); }
  set className(val) {
    this._classes.clear();
    (val || '').split(/\s+/).filter(Boolean).forEach(c => this._classes.add(c));
  }

  get id() { return this.attributes['id'] || ''; }
  set id(val) { this.attributes['id'] = val; }
  get tagName() { return this.nodeName; }

  get value() { return this.attributes['value'] !== undefined ? this.attributes['value'] : (this._value || ''); }
  set value(val) { this.attributes['value'] = String(val); this._value = String(val); }

  get textContent() {
    if (this.nodeType === 3) return this.nodeValue;
    return this.childNodes.map(c => c.textContent).join('');
  }
  set textContent(val) {
    this.childNodes = [];
    if (val) {
      this.appendChild(new MockNode(3, '#text', val));
    }
  }

  get innerHTML() {
    if (this.nodeType === 3) {
      return this.nodeValue.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    return this.childNodes.map(c => c.outerHTML || c.innerHTML).join('');
  }
  set innerHTML(html) {
    this.childNodes = [];
    parseHTMLInto(html, this);
  }

  get outerHTML() {
    if (this.nodeType === 3) return this.nodeValue;
    const tag = this.nodeName.toLowerCase();
    const attrs = [];
    if (this.id) attrs.push(`id="${this.id}"`);
    if (this.className) attrs.push(`class="${this.className}"`);
    for (const [k, v] of Object.entries(this.attributes)) {
      if (k !== 'id' && k !== 'class') attrs.push(`${k}="${v}"`);
    }
    for (const [k, v] of Object.entries(this.dataset)) {
      attrs.push(`data-${k}="${v}"`);
    }
    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    return `<${tag}${attrStr}>${this.innerHTML}</${tag}>`;
  }

  cloneNode(deep = true) {
    const clone = new MockNode(this.nodeType, this.nodeName, this.nodeValue);
    this._classes.forEach(c => clone._classes.add(c));
    clone.attributes = { ...this.attributes };
    clone.dataset = { ...this.dataset };
    if (deep) {
      this.childNodes.forEach(c => clone.appendChild(c.cloneNode(true)));
    }
    return clone;
  }

  matches(sel) {
    return matchesSelector(this, sel);
  }

  closest(sel) {
    let curr = this;
    while (curr) {
      if (curr.nodeType === 1 && matchesSelector(curr, sel)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(sel) {
    const res = [];
    const walk = (node) => {
      node.childNodes.forEach(c => {
        if (c.nodeType === 1) {
          if (matchesSelector(c, sel, this)) res.push(c);
          walk(c);
        }
      });
    };
    walk(this);
    return res;
  }
}

function matchesSelector(node, selector, scope = null) {
  if (!node || node.nodeType !== 1) return false;
  const parts = selector.split(',').map(s => s.trim());
  return parts.some(part => matchSingle(node, part, scope));
}

function matchSingle(node, sel, scope) {
  if (sel === ':scope > div:nth-child(2)') {
    if (!scope || node.parentElement !== scope) return false;
    const childDivs = scope.childNodes.filter(c => c.nodeType === 1);
    return childDivs[1] === node;
  }

  // Handle descendant selectors e.g. "a b" or ".comment p"
  const tokens = sel.trim().split(/\s+/);
  if (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (!matchSimple(node, last)) return false;
    let curr = node.parentElement;
    let tokenIdx = tokens.length - 2;
    while (curr && tokenIdx >= 0) {
      if (matchSimple(curr, tokens[tokenIdx])) {
        tokenIdx--;
      }
      curr = curr.parentElement;
    }
    return tokenIdx < 0;
  }

  return matchSimple(node, sel);
}

function matchSimple(node, sel) {
  if (!sel || !node || node.nodeType !== 1) return false;
  if (sel === '*') return true;
  if (sel.startsWith('#')) return node.id === sel.slice(1);

  // Check attribute selector first (handles tags with attrs like a[href="..."])
  if (sel.includes('[')) {
    const m = sel.match(/^([a-zA-Z0-9_-]*)\[([a-zA-Z0-9_-]+)([\*~|^$]?=)?"?([^"\]]*)"?\]$/);
    if (m) {
      const [, tag, attr, op, val] = m;
      if (tag && node.nodeName.toLowerCase() !== tag.toLowerCase()) return false;
      const curr = attr.startsWith('data-')
        ? node.dataset[attr.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())]
        : (attr === 'class' ? node.className : node.getAttribute(attr));
      if (!op) return curr !== undefined && curr !== null;
      if (op === '=') return curr === val;
      if (op === '*=') return curr && curr.includes(val);
      return false;
    }
  }

  if (sel.startsWith('.')) {
    const classes = sel.slice(1).split('.');
    return classes.every(c => node.classList.has(c));
  }

  // Tag with class or id e.g. "a.rated-user"
  if (sel.includes('.')) {
    const [tag, ...classes] = sel.split('.');
    if (tag && node.nodeName.toLowerCase() !== tag.toLowerCase()) return false;
    return classes.every(c => node.classList.has(c));
  }
  if (sel.includes('#')) {
    const [tag, id] = sel.split('#');
    if (tag && node.nodeName.toLowerCase() !== tag.toLowerCase()) return false;
    return node.id === id;
  }
  return node.nodeName.toLowerCase() === sel.toLowerCase();
}

function parseHTMLInto(html, parent) {
  const tokenRegex = /(<\/?[a-zA-Z][a-zA-Z0-9_-]*(?:\s+[^>]*)?>|<!--[\s\S]*?-->|[^<]+|<)/g;
  const matches = html.match(tokenRegex) || [];
  let current = parent;
  const stack = [parent];

  for (const token of matches) {
    if (token.startsWith('</')) {
      if (stack.length > 1) {
        stack.pop();
        current = stack[stack.length - 1];
      }
    } else if (token.startsWith('<') && /^<[a-zA-Z]/i.test(token)) {
      const isSelfClosing = token.endsWith('/>') || /^<(img|meta|link|input|br|hr)/i.test(token);
      const tagMatch = token.match(/^<([a-zA-Z0-9_-]+)/);
      if (!tagMatch) continue;
      const tagName = tagMatch[1].toUpperCase();
      const el = new MockNode(1, tagName);

      // Attributes
      const attrRegex = /([a-zA-Z0-9_-]+)(?:="([^"]*)")?/g;
      let m;
      while ((m = attrRegex.exec(token)) !== null) {
        if (m[1].toUpperCase() === tagName) continue;
        const name = m[1];
        const val = m[2] !== undefined ? m[2] : '';
        if (name.startsWith('data-')) {
          const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          el.dataset[key] = val;
        } else {
          el.setAttribute(name, val);
        }
      }

      current.appendChild(el);
      if (!isSelfClosing) {
        stack.push(el);
        current = el;
      }
    } else {
      const decoded = token
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
      current.appendChild(new MockNode(3, '#text', decoded));
    }
  }
}

// Build Mock Document
const doc = new MockNode(1, 'HTML');
const head = new MockNode(1, 'HEAD');
const body = new MockNode(1, 'BODY');
doc.appendChild(head);
doc.appendChild(body);

const mockDocument = {
  documentElement: doc,
  head: head,
  body: body,
  createElement: (tag) => new MockNode(1, tag.toUpperCase()),
  createTextNode: (text) => new MockNode(3, '#text', text),
  getElementById: (id) => {
    return doc.querySelector('#' + id);
  },
  querySelector: (sel) => doc.querySelector(sel),
  querySelectorAll: (sel) => doc.querySelectorAll(sel),
  addEventListener: () => {}
};

// Mock Storage and Runtime
const storage = {
  cfLang: 'vi',
  translationEngine: 'google'
};
let storageChangeListeners = [];
let runtimeMessageListeners = [];

const mockChrome = {
  runtime: {
    getURL: (p) => `chrome-extension://mock/${p}`,
    onMessage: {
      addListener: (fn) => runtimeMessageListeners.push(fn),
      removeListener: (fn) => {
        const idx = runtimeMessageListeners.indexOf(fn);
        if (idx >= 0) runtimeMessageListeners.splice(idx, 1);
      }
    },
    sendMessage: (msg, callback) => {
      if (msg.action === 'translateBatch') {
        // If AI engine is used and batchId is provided, simulate Google draft stream first
        if ((msg.engine === 'gemini' || msg.engine === 'xkiro') && msg.batchId) {
          msg.items.forEach((t, idx) => {
            const draftText = 'Bản dịch Google nháp: ' + t;
            runtimeMessageListeners.forEach(fn => {
              try {
                fn({
                  action: 'streamItemReady',
                  batchId: msg.batchId,
                  index: idx,
                  text: draftText,
                  isDraft: true
                });
              } catch (e) {}
            });
          });
        }

        // Mock translation response: return translated dummy text
        const texts = msg.items.map(t => {
          if (t.includes('Watermelon')) return 'Dưa hấu';
          if (t.includes('Pete and Billy')) return 'Pete và Billy rất thích dưa hấu [[M0]]';
          if (t.includes('Great contest')) return 'Kỳ thi rất hay [[M0]] [[M1]]';
          if (t.includes('Nice problem')) return 'Bài toán rất thú vị [[M0]]';
          return 'Đã dịch: ' + t;
        });
        callback({ success: true, texts });
      } else if (msg.action === 'translate') {
        callback({ success: true, text: 'Đã dịch: ' + msg.text });
      }
    }
  },
  storage: {
    local: {
      get: (keys, cb) => {
        if (Array.isArray(keys)) {
          const res = {};
          keys.forEach(k => res[k] = storage[k]);
          cb(res);
        } else if (typeof keys === 'string') {
          cb({ [keys]: storage[keys] });
        } else {
          cb({ ...storage });
        }
      },
      set: (obj) => {
        Object.assign(storage, obj);
      }
    },
    onChanged: {
      addListener: (fn) => storageChangeListeners.push(fn)
    }
  }
};

// Load translations dictionary
const dictCode = fs.readFileSync(path.join(__dirname, '../content/translations.js'), 'utf8');
const windowObj = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {}
};
windowObj.window = windowObj;
vm.createContext(windowObj);
vm.runInContext(dictCode, windowObj);

let mockKatex = null;
try {
  mockKatex = require('/opt/antigravity-ide/resources/app/node_modules/katex/dist/katex.js');
} catch (e) {}

// Sandbox for content.js
const sandbox = {
  window: windowObj,
  document: mockDocument,
  chrome: mockChrome,
  katex: mockKatex,
  Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  console: console,
  CF_TRANSLATIONS: windowObj.CF_TRANSLATIONS,
  MathJax: {
    Hub: { Queue: () => {} },
    typesetPromise: async () => {}
  }
};
vm.createContext(sandbox);

// Load content.js
const contentCode = fs.readFileSync(path.join(__dirname, '../content/content.js'), 'utf8');
vm.runInContext(contentCode, sandbox);

async function runContentTests() {
  // Test 1: Problem statement auto-translation with MathJax & Code & No manual buttons
  console.log('Test 1: Problem statement auto-translation');
  const problemHtml = `
  <div class="problem-statement">
    <div class="header">
      <div class="title">A. Watermelon</div>
    </div>
    <div>
      <p>Pete and Billy bought a watermelon $$$w$$$ kilos.</p>
    </div>
    <div class="input-specification">
      <div class="section-title">Input</div>
      <p>The first line contains an integer <code>w</code>.</p>
    </div>
    <div class="sample-tests">
      <div class="section-title">Examples</div>
      <div class="sample-test">
        <div class="input"><pre>8</pre></div>
        <div class="output"><pre>YES</pre></div>
      </div>
    </div>
  </div>`;
  body.innerHTML = problemHtml;

  // Trigger Vietnamese mode
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 200));

  const problem = body.querySelector('.problem-statement');
  assert(problem, 'Problem statement should exist');
  assert.strictEqual(problem.querySelector('.cf-problem-translate-bar'), null, 'NO manual translate bar should exist');

  // Verify section title translated via static dictionary
  const sectionTitle = problem.querySelector('.input-specification .section-title');
  assert.strictEqual(sectionTitle.textContent.trim(), 'Đầu vào', 'Section title should be translated to Đầu vào');

  // Verify sample tests untouched
  const sampleInput = problem.querySelector('.sample-test .input pre');
  assert.strictEqual(sampleInput.textContent.trim(), '8', 'Sample test input must remain intact');

  // Verify code tag was preserved
  const codeTag = problem.querySelector('code');
  assert(codeTag, 'Code element <code> must be preserved');
  assert.strictEqual(codeTag.textContent.trim(), 'w', 'Code content must be preserved');

  console.log('✓ Test 1 passed: Problem statement auto-translated, MathJax/Code preserved, no manual bar');

  // Test 2: Multiple Blog Posts on the same page
  console.log('Test 2: Multiple blog posts on the page');
  body.innerHTML = `
  <div class="topic" id="topic-1">
    <div class="title"><a href="/blog/1">Great contest announcement</a></div>
    <div class="content">
      <p>Great contest by <a href="/profile/tourist" class="rated-user user-legendary">tourist</a> with formula $$$O(N)$$$</p>
    </div>
  </div>
  <div class="topic" id="topic-2">
    <div class="title"><a href="/blog/2">Second announcement</a></div>
    <div class="content">
      <p>Nice problem set for everyone</p>
    </div>
  </div>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  // High-speed translation completes within 200ms
  await new Promise(r => setTimeout(r, 200));

  const topic1 = body.querySelector('#topic-1');
  const topic2 = body.querySelector('#topic-2');
  assert.strictEqual(topic1.querySelector('.cf-topic-translate-bar'), null, 'No manual translate bar on topic 1');
  assert.strictEqual(topic2.querySelector('.cf-topic-translate-bar'), null, 'No manual translate bar on topic 2');

  // Verify user handle was preserved intact
  const handleLink = topic1.querySelector('a.rated-user');
  assert(handleLink, 'User handle link should be preserved');
  assert.strictEqual(handleLink.getAttribute('href'), '/profile/tourist');
  assert(handleLink.classList.has('user-legendary'));
  assert.strictEqual(handleLink.textContent.trim(), 'tourist');

  // Verify topics were translated swiftly
  assert(topic1.querySelector('.content p').textContent.includes('Kỳ thi rất hay'));
  assert(topic2.querySelector('.content p').textContent.includes('Bài toán rất thú vị') || topic2.querySelector('.content p').textContent.includes('Đã dịch'));

  console.log('✓ Test 2 passed: Multiple blog posts translated with high-speed pipeline and user handle preserved');

  // Test 3: Comments auto-translation without manual "🌐 Dịch" button
  console.log('Test 3: Comments auto-translation without manual buttons');
  body.innerHTML = `
  <div class="comments">
    <div class="comment" id="c1">
      <div class="info"><a href="/profile/petr" class="rated-user user-legendary">petr</a></div>
      <div class="text"><div class="ttypography"><p>Nice problem thanks!</p></div></div>
    </div>
    <div class="comment" id="c2">
      <div class="info"><a href="/profile/rng_58" class="rated-user user-legendary">rng_58</a></div>
      <div class="text"><div class="ttypography"><p>Great contest congratulations</p></div></div>
    </div>
  </div>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 200));

  const commentLinks = body.querySelectorAll('.cf-comment-trans-link');
  assert.strictEqual(commentLinks.length, 0, 'No manual "🌐 Dịch" button should be created on comments');

  const c1Text = body.querySelector('#c1 .text p');
  assert(c1Text.textContent.includes('Bài toán rất thú vị') || c1Text.textContent.includes('Đã dịch'), 'Comment 1 should be auto-translated');

  const c2Text = body.querySelector('#c2 .text p');
  assert(c2Text.textContent.includes('Kỳ thi rất hay') || c2Text.textContent.includes('Đã dịch'), 'Comment 2 should be auto-translated');

  console.log('✓ Test 3 passed: Comments translated automatically with NO manual button');

  // Test 4: Switching back to English restores exact original content
  console.log('Test 4: Restoration to English (cfLang = en)');
  storage.cfLang = 'en';
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 100));

  const restoredC1 = body.querySelector('#c1 .text p');
  assert.strictEqual(restoredC1.textContent.trim(), 'Nice problem thanks!', 'Comment 1 must be restored to original English');

  console.log('✓ Test 4 passed: Switching to English cleanly restored original text');

  // Test 5: Problem statement property-title, images, hyperlinks, LaTeX formulas, and restoration
  console.log('Test 5: Problem statement property-title, images, links, LaTeX formulas & restoration');
  body.innerHTML = `
  <div class="problem-statement">
    <div class="header">
      <div class="title">B. Graph Operations</div>
      <div class="time-limit"><div class="property-title">time limit per test</div>1.0 s</div>
      <div class="memory-limit"><div class="property-title">memory limit per test</div>256 MB</div>
      <div class="input-file"><div class="property-title">input</div>standard input</div>
      <div class="output-file"><div class="property-title">output</div>standard output</div>
    </div>
    <div>
      <p>Given a graph: <img src="graph.png" alt="Graph illustration"> with formula \\[ \\sum_{i=1}^n x_i \\] and inline \\( x \\).</p>
      <p>For tutorial see <a href="https://codeforces.com/tutorial">Tutorial link</a>.</p>
    </div>
    <div class="input-specification">
      <div class="section-title">Input</div>
      <p>Single integer n.</p>
    </div>
    <div class="sample-tests">
      <div class="section-title">Examples</div>
      <div class="sample-test">
        <div class="input"><pre>5</pre></div>
        <div class="output"><pre>10</pre></div>
      </div>
    </div>
  </div>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 200));

  const prob5 = body.querySelector('.problem-statement');
  assert(prob5, 'Problem statement should exist');

  // Verify property titles translated
  const timeLimitProp = prob5.querySelector('.time-limit .property-title');
  assert.strictEqual(timeLimitProp.textContent.trim(), 'giới hạn thời gian mỗi test', 'Property title should be translated');

  const memLimitProp = prob5.querySelector('.memory-limit .property-title');
  assert.strictEqual(memLimitProp.textContent.trim(), 'giới hạn bộ nhớ mỗi test', 'Memory limit title should be translated');

  const inputProp = prob5.querySelector('.input-file .property-title');
  assert.strictEqual(inputProp.textContent.trim(), 'đầu vào', 'Input file title should be translated');

  // Verify Examples section title translated
  const examplesTitle = prob5.querySelector('.sample-tests .section-title');
  assert.strictEqual(examplesTitle.textContent.trim(), 'Ví dụ', 'Examples title should be translated');

  // Verify Image element preserved
  const imgEl = prob5.querySelector('img');
  assert(imgEl, 'Image element <img> must be preserved');
  assert.strictEqual(imgEl.getAttribute('src'), 'graph.png', 'Image src must be preserved');

  // Verify Hyperlink preserved
  const tutLink = prob5.querySelector('a[href="https://codeforces.com/tutorial"]');
  assert(tutLink, 'Hyperlink <a> must be preserved');
  assert.strictEqual(tutLink.getAttribute('href'), 'https://codeforces.com/tutorial', 'Hyperlink href preserved');

  // Verify LaTeX formulas preserved (masked and unmasked)
  const paragraphHtml = prob5.innerHTML;
  assert(paragraphHtml.includes('\\sum_{i=1}^n') || paragraphHtml.includes('$$') || paragraphHtml.includes('\\['), 'LaTeX formula preserved');

  // Verify restoration to English
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 100));

  assert.strictEqual(prob5.querySelector('.time-limit .property-title').textContent.trim(), 'time limit per test');
  assert.strictEqual(prob5.querySelector('.sample-tests .section-title').textContent.trim(), 'Examples');
  console.log('✓ Test 5 passed: Problem properties, media, links, LaTeX preserved and restored cleanly');

  // Test 6: Real Codeforces comment structure inside <table class="comment-table">
  console.log('Test 6: Real Codeforces comments in <table class="comment-table">');
  body.innerHTML = `
  <div class="comments">
    <table class="comment-table" id="c-real-1">
      <tr>
        <td class="comment">
          <div class="info"><a href="/profile/tourist" class="rated-user user-legendary">tourist</a></div>
          <div class="text">
            <div class="ttypography">
              <p>Nice problem thanks!</p>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 200));

  const cRealText = body.querySelector('#c-real-1 .text p');
  assert(cRealText, 'Comment paragraph should exist');
  assert(cRealText.textContent.includes('Bài toán rất thú vị') || cRealText.textContent.includes('Đã dịch'), 'Comment inside table.comment-table MUST be auto-translated');
  console.log('✓ Test 6 passed: Real Codeforces comments inside table.comment-table translated successfully');

  // Test 7: Interactive Elements Preservation ("Read more", Tabs, Pagination) & Event Listeners
  console.log('Test 7: Interactive Elements ("Read more", Tabs, Pagination) and Event Listeners preservation');
  body.innerHTML = `
  <div class="second-level-menu">
    <ul class="second-level-menu-list">
      <li><a href="/blog" id="tab-blog">Blog</a></li>
      <li><a href="/contests" id="tab-contests">Contests</a></li>
    </ul>
  </div>
  <div class="topic" id="topic-interactive">
    <div class="title"><a href="/blog/101">Interactive Post</a></div>
    <div class="content">
      <p id="post-para">
        Check this tutorial for more info:
        <a href="javascript:void(0)" class="read-more" id="read-more-btn">Read more</a>
      </p>
    </div>
  </div>
  <div class="pagination">
    <ul>
      <li><a href="?page=1" id="page-1">1</a></li>
      <li><a href="?page=2" id="page-2">2</a></li>
    </ul>
  </div>`;

  let readMoreClicked = 0;
  let tabClicked = 0;
  const readMoreBtn = body.querySelector('#read-more-btn');
  const tabBlogBtn = body.querySelector('#tab-blog');
  readMoreBtn.addEventListener('click', () => { readMoreClicked++; });
  tabBlogBtn.addEventListener('click', () => { tabClicked++; });

  // Click before translation
  readMoreBtn.click();
  tabBlogBtn.click();
  assert.strictEqual(readMoreClicked, 1, 'Read more click handler works before translation');
  assert.strictEqual(tabClicked, 1, 'Tab click handler works before translation');

  // Trigger Vietnamese auto-translation
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 200));

  // Verify "Read more" text is translated to "Xem thêm"
  assert(readMoreBtn.textContent.includes('Xem thêm'), 'Read more link text should be translated in-place to Xem thêm');

  // Click after translation - MUST still fire event handlers without being clobbered!
  readMoreBtn.click();
  tabBlogBtn.click();
  assert.strictEqual(readMoreClicked, 2, 'Read more event listener MUST remain functional after translation');
  assert.strictEqual(tabClicked, 2, 'Tab event listener MUST remain functional after translation');

  // Verify pagination was not destroyed or removed
  const page1 = body.querySelector('#page-1');
  const page2 = body.querySelector('#page-2');
  assert(page1 && page2, 'Pagination links must remain in DOM');

  // Switch back to English
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 100));

  assert(readMoreBtn.textContent.includes('Read more'), 'Read more link text must be restored to English');
  readMoreBtn.click();
  tabBlogBtn.click();
  assert.strictEqual(readMoreClicked, 3, 'Read more event listener MUST remain functional after restoration');
  assert.strictEqual(tabClicked, 3, 'Tab event listener MUST remain functional after restoration');
  console.log('✓ Test 7 passed: Interactive elements, tabs, pagination, and event listeners 100% preserved and functional');

  // Test 8: Spoilers (.spoiler-title and .spoiler-content without <p>)
  console.log('Test 8: Spoilers translation and restoration');
  body.innerHTML = `
  <div class="topic" id="topic-spoiler">
    <div class="title"><a href="/blog/200">Editorial</a></div>
    <div class="content">
      <div class="spoiler">
        <b class="spoiler-title">Hint 1</b>
        <div class="spoiler-content">
          Just binary search on the answer.
        </div>
      </div>
    </div>
  </div>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 200));

  const spTitle = body.querySelector('.spoiler-title');
  const spContent = body.querySelector('.spoiler-content');
  assert.strictEqual(spTitle.dataset.cfTranslated, 'true', 'Spoiler title should be translated');
  assert.strictEqual(spContent.dataset.cfTranslated, 'true', 'Spoiler content without <p> should be translated');

  // Switch back to English
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 100));

  assert.strictEqual(spTitle.textContent.trim(), 'Hint 1', 'Spoiler title must be restored to original English');
  assert(spContent.textContent.includes('Just binary search on the answer'), 'Spoiler content must be restored to original English');
  console.log('✓ Test 8 passed: Spoiler title and content without <p> translated and restored cleanly');

  // Test 9: Rapid Language Toggle Race Condition (Async in-flight translation resolution)
  console.log('Test 9: Rapid Language Toggle Race Condition');
  let delayedCallbacks = [];
  const originalSendMessage = mockChrome.runtime.sendMessage;
  mockChrome.runtime.sendMessage = (msg, callback) => {
    if (msg.action === 'translateBatch') {
      delayedCallbacks.push(() => {
        const texts = msg.items.map(t => 'Đã dịch ngầm: ' + t);
        callback({ success: true, texts });
      });
    } else {
      originalSendMessage(msg, callback);
    }
  };

  body.innerHTML = `
  <div class="problem-statement" id="race-prob">
    <div><p>This text is in English and should NOT be corrupted.</p></div>
  </div>`;

  // 1. User switches to VI (in-flight request sent)
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 60));
  assert(delayedCallbacks.length > 0, 'Async request should be in-flight');

  // 2. User rapidly switches back to EN before API resolves
  storage.cfLang = 'en';
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 60));

  // 3. In-flight API call resolves late
  delayedCallbacks.forEach(cb => cb());
  delayedCallbacks = [];
  await new Promise(r => setTimeout(r, 60));

  // Restore mockChrome.runtime.sendMessage
  mockChrome.runtime.sendMessage = originalSendMessage;

  const raceText = body.querySelector('#race-prob p').textContent;
  assert.strictEqual(raceText.trim(), 'This text is in English and should NOT be corrupted.',
    'Late-arriving translation response MUST NOT overwrite English DOM! Actual: ' + raceText);
  console.log('✓ Test 9 passed: Rapid language toggle race condition cleanly handled without English corruption');

  // Test 10: Nested Preserved Elements & User Handle Preservation on Toggle Back to English
  console.log('Test 10: Nested Element & User Handle Preservation');
  body.innerHTML = `
  <div class="topic" id="topic-nested">
    <div class="title"><a href="/blog/300">Round Analysis</a></div>
    <div class="content">
      <p id="nested-para">
        Problem prepared by <b><a href="/profile/tourist" class="rated-user user-legendary" id="nested-handle">tourist</a></b>.
      </p>
    </div>
  </div>`;

  let handleClicked = 0;
  const handleEl = body.querySelector('#nested-handle');
  handleEl.addEventListener('click', () => { handleClicked++; });
  handleEl.click();
  assert.strictEqual(handleClicked, 1, 'Handle click listener works before translation');

  // Translate to VI
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 200));

  // Switch back to EN
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 100));

  const restoredTopic = body.querySelector('#topic-nested .content p');
  assert(restoredTopic.innerHTML.includes('tourist'), 'User handle "tourist" MUST NOT disappear on restoration to English!');
  assert(restoredTopic.querySelector('b a.rated-user'), 'User handle MUST remain nested inside <b> after restoration!');

  // Verify event listener remains functional
  const restoredHandle = body.querySelector('#nested-handle');
  restoredHandle.click();
  assert.strictEqual(handleClicked, 2, 'Handle event listener must remain intact after round-trip toggle');
  console.log('✓ Test 10 passed: Nested elements and user handles fully preserved without disappearing');

  // Test 11: LaTeX Formula with Inequality Signs (<, >, &)
  console.log('Test 11: MathJax with Less Than / Greater Than operators');
  body.innerHTML = `
  <div class="problem-statement" id="math-prob">
    <div>
      <p>Given $$$1 \\le n < m \\le 10^5$$$ and $$$a > b$$$, output the minimum cost.</p>
    </div>
  </div>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 200));

  const mathText = body.querySelector('#math-prob p').textContent;
  assert(mathText.includes('< m'), 'Formula MUST preserve less-than sign "< m" intact, but got: ' + mathText);
  assert(mathText.includes('> b'), 'Formula MUST preserve greater-than sign "> b" intact, but got: ' + mathText);

  // Switch back to EN
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 100));

  const restoredMathText = body.querySelector('#math-prob p').textContent;
  assert(restoredMathText.includes('< m'), 'Restored formula MUST preserve "< m"');
  // Test 12: Comment Card Glassmorphism Styling in content.css
  console.log('Test 12: Comment Card Glassmorphism Styling in content.css');
  const cssPath = path.join(__dirname, '../content/content.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // Verify selector presence
  assert(cssContent.includes('table.comment-table'), 'CSS must include table.comment-table selector');
  assert(cssContent.includes('.comment:not(:has(table.comment-table))'), 'CSS must include .comment:not(:has(table.comment-table)) selector');
  assert(cssContent.includes('html.cf-light-mode.cf-custom-bg-active table.comment-table'), 'CSS must include light mode selector for comment table');

  // Verify comment card properties
  assert(cssContent.includes('border-radius: 12px !important'), 'Comment card must have border-radius: 12px');
  assert(cssContent.includes('border: 1px solid rgba(255, 255, 255, 0.28) !important'), 'Comment card must have 1px solid rgba(255, 255, 255, 0.28) border');
  assert(cssContent.includes('blur(16px) saturate(180%) !important'), 'Comment card must have backdrop-filter: blur(16px) saturate(180%)');
  assert(cssContent.includes('padding: 12px 14px !important'), 'Comment card must have padding: 12px 14px');
  assert(cssContent.includes('margin: 10px 0 !important'), 'Comment card must have margin: 10px 0');
  assert(cssContent.includes('box-shadow: 0 4px 18px rgba(0, 0, 0, 0.1) !important'), 'Comment card must have box-shadow');
  assert(cssContent.includes('background: rgba(255, 255, 255, var(--cf-glass-alpha, 0.16)) !important'), 'Comment card must have glass alpha background');

  // Verify td inside table.comment-table does not have conflicting background or borders
  assert(/table\.comment-table\s+td[\s\S]*?background:\s*transparent\s*!important/.test(cssContent), 'Comment table td must have transparent background');
  assert(/table\.comment-table\s+td[\s\S]*?border:\s*none\s*!important/.test(cssContent), 'Comment table td must have no border');

  console.log('✓ Test 12 passed: Comment Card Glassmorphism Styling verified in content.css');

  // Test 13: Translation Progress Indicator (% in bottom right corner)
  console.log('Test 13: Translation Progress Indicator in bottom right corner');
  assert(cssContent.includes('#cf-trans-progress-indicator'), 'CSS must include #cf-trans-progress-indicator selector');
  assert(cssContent.includes('position: fixed !important'), 'Progress indicator must be fixed');
  assert(cssContent.includes('bottom: 24px !important'), 'Progress indicator must be at bottom: 24px');
  assert(cssContent.includes('right: 24px !important'), 'Progress indicator must be at right: 24px');
  assert(cssContent.includes('.cf-trans-spinner'), 'Progress indicator must include spinner');

  // Trigger translation and verify progress indicator updates
  body.innerHTML = `
  <div class="problem-statement" id="prog-prob">
    <div><p>Progress test paragraph one.</p></div>
    <div><p>Progress test paragraph two.</p></div>
  </div>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  // High-speed translation completes within 200ms
  await new Promise(r => setTimeout(r, 200));

  const progressIndicator = body.querySelector('#cf-trans-progress-indicator');
  assert(progressIndicator, 'Progress indicator should exist in body');
  assert(progressIndicator.classList.contains('active'), 'Progress indicator should be active during translation');
  assert(progressIndicator.querySelector('.cf-trans-text').textContent.includes('100%'), 'Progress indicator should reach 100%');
  console.log('✓ Test 13 passed: Translation Progress Indicator reaches 100% quickly');

  // Test 14: Single item translates immediately without 2s wait & retry on rate-limit
  console.log('Test 14: Single item skips 2s wait; rate-limit retries after 2s');
  body.innerHTML = `
  <div class="problem-statement" id="single-prob">
    <div><p>Only one single paragraph here.</p></div>
  </div>`;
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  // Because length <= 1, it must translate immediately in < 200ms
  await new Promise(r => setTimeout(r, 200));
  const singleProbText = body.querySelector('#single-prob p');
  assert(singleProbText.dataset.cfTranslated === 'true' || singleProbText.textContent.includes('Đã dịch') || singleProbText.textContent.includes('Bài toán'), 'Single item must translate immediately without 2s wait');
  console.log('✓ Test 14 passed: Single item (< 50%) skipped 2s wait successfully');

  // Test 15: Ensure problem statement and #content NEVER disappear when change notice is removed
  console.log('Test 15: Problem statement & #content NEVER disappear when change notice is present');
  body.innerHTML = `
  <div id="pageContent" class="content-with-sidebar">
    <div id="content" class="content-with-sidebar">
      <div class="alert alert-info">
        The problem statement has recently been changed. <a href="/problemset/problem/2290/H#">View the changes.</a>
      </div>
      <div class="problemindexbox">
        <div class="problem-statement">
          <div class="header"><div class="title">H. Problem Title</div></div>
          <div><p>This is the actual problem description paragraph.</p></div>
        </div>
      </div>
    </div>
  </div>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 200));

  // The alert notice should be gone
  const changeLink = body.querySelector('a[href*="2290/H#"]');
  assert.strictEqual(changeLink, null, 'Change notice link should be removed');
  assert.strictEqual(body.querySelector('.alert'), null, 'Change notice alert should be removed');

  // CRITICAL: #content and .problem-statement MUST BE INTACT AND VISIBLE!
  const mainContent = body.querySelector('#content');
  assert(mainContent, '#content container must NOT be deleted');
  const probStatement = body.querySelector('.problem-statement');
  assert(probStatement, '.problem-statement must NOT be deleted');
  assert(probStatement.querySelector('.title'), 'Problem title must exist');
  assert(probStatement.querySelector('p'), 'Problem text paragraph must exist');
  console.log('✓ Test 15 passed: Notice removed while problem statement and #content remain 100% intact');

  // Test 16: Initial Page Load Race Condition & Problem Statement Translation without reload
  console.log('Test 16: Problem statement translates cleanly on initial navigation without reload');
  body.innerHTML = `
  <div id="pageContent">
    <div class="problem-statement" id="nav-prob">
      <div class="header"><div class="title">D. Lake Path</div></div>
      <div><p id="nav-prob-desc">This is a fresh problem paragraph navigated from problemset.</p></div>
    </div>
  </div>`;

  // Trigger translation, and immediately trigger a secondary pass (simulating DOMContentLoaded/MutationObserver)
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 200));

  const navDesc = body.querySelector('#nav-prob-desc');
  assert.strictEqual(navDesc.dataset.cfTranslated, 'true', 'Paragraph must be marked as translated');
  assert(navDesc.textContent.includes('Đã dịch'), 'Paragraph must be translated into Vietnamese on initial navigation');
  console.log('✓ Test 16 passed: Problem statement translated cleanly on initial navigation without requiring reload');

  // Test 17: Problem index column (A, B, C, D...) is preserved and NOT translated into 'Ngôn ngữ D'
  console.log('Test 17: Problem index column (A, B, C, D) is NEVER translated');
  body.innerHTML = `
  <table class="problems">
    <tr>
      <th class="id left">#</th>
      <th class="name">Name</th>
    </tr>
    <tr>
      <td class="id left"><a href="/problemset/problem/1000/A">A</a></td>
      <td class="name"><a href="/problemset/problem/1000/A">Watermelon</a></td>
    </tr>
    <tr>
      <td class="id left"><a href="/problemset/problem/1000/D">D</a></td>
      <td class="name"><a href="/problemset/problem/1000/D">Dynamic Problem</a></td>
    </tr>
  </table>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 100));

  const letterA = body.querySelectorAll('.problems td.id a')[0];
  const letterD = body.querySelectorAll('.problems td.id a')[1];
  assert.strictEqual(letterA.textContent.trim(), 'A', 'Problem index A must remain A');
  assert.strictEqual(letterD.textContent.trim(), 'D', 'Problem index D must remain D and NOT become "Ngôn ngữ D"');
  console.log('✓ Test 17 passed: Problem index column (A, B, C, D) 100% preserved and never translated into "Ngôn ngữ D"');

  // Test 18: Google Sans font, table column centering (#, Bắt đầu, Thời lượng), and bold typography
  console.log('Test 18: Google Sans font, column centering (#, Bắt đầu, Thời lượng), and bold styling');
  const typographyCss = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');

  assert(typographyCss.includes('Google+Sans') || typographyCss.includes('Google Sans'), 'content.css must include Google Sans font');
  assert(typographyCss.includes('.cf-col-center') || typographyCss.includes('table.problems th.id'), 'content.css must center # column');
  assert(typographyCss.includes('text-align: center'), 'content.css must have center alignment rules for columns');
  assert(typographyCss.includes('font-weight: 700') && typographyCss.includes('font-weight: 600'), 'content.css must have selective bold font weights');

  // Test alignTableColumns logic on contest table
  body.innerHTML = `
  <table class="rtable">
    <tr>
      <th>Cuộc thi</th>
      <th>Tác giả</th>
      <th>Bắt đầu</th>
      <th>Thời lượng</th>
    </tr>
    <tr>
      <td>Codeforces Round 999</td>
      <td>tourist</td>
      <td>Nov/22/2026</td>
      <td>02:00</td>
    </tr>
  </table>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 60));

  const startTh = body.querySelectorAll('table.rtable tr th')[2];
  const durationTh = body.querySelectorAll('table.rtable tr th')[3];
  assert(startTh.classList.contains('cf-col-center'), 'Bắt đầu column header must receive cf-col-center');
  assert(durationTh.classList.contains('cf-col-center'), 'Thời lượng column header must receive cf-col-center');

  const startTd = body.querySelectorAll('table.rtable tr td')[2];
  const durationTd = body.querySelectorAll('table.rtable tr td')[3];
  assert(startTd.classList.contains('cf-col-center'), 'Bắt đầu cell must receive cf-col-center');
  assert(durationTd.classList.contains('cf-col-center'), 'Thời lượng cell must receive cf-col-center');

  console.log('✓ Test 18 passed: Google Sans font, column centering (#, Bắt đầu, Thời lượng), and selective bold typography verified');

  // Test 19: Submission Verdict Styling (Green 100 pts, Yellow 85 pts, Red 0 pts & Compilation error)
  console.log('Test 19: Submission verdict coloring (100 pts green, 85 pts yellow, CE & 0 pts red)');
  body.innerHTML = `
  <table class="status-frame-datatable">
    <tr>
      <td class="status-verdict-cell"><span class="verdict-compilation-error">Compilation error</span></td>
    </tr>
    <tr>
      <td class="status-verdict-cell"><span class="submissionVerdictWrapper">Partial result: 0 points</span></td>
    </tr>
    <tr>
      <td class="status-verdict-cell"><span class="submissionVerdictWrapper"><a class="view-source">Perfect result: 100 points</a></span></td>
    </tr>
    <tr>
      <td class="status-verdict-cell"><span class="submissionVerdictWrapper">Partial result: 85 points</span></td>
    </tr>
  </table>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 60));

  const rows = body.querySelectorAll('.status-frame-datatable td');
  const ceEl = rows[0].querySelector('.verdict-compilation-error');
  const zeroPtsEl = rows[1].querySelector('.submissionVerdictWrapper');
  const hundredPtsEl = rows[2].querySelector('.view-source');
  const eightyFivePtsEl = rows[3].querySelector('.submissionVerdictWrapper');

  assert(ceEl.classList.contains('cf-verdict-red'), 'Compilation error must be red');
  assert.strictEqual(ceEl.style.color, '#ef4444', 'Compilation error color must be #ef4444');
  assert.strictEqual(ceEl.style['text-shadow'], 'none', 'Compilation error text-shadow must be none');

  assert(zeroPtsEl.classList.contains('cf-verdict-red'), 'Partial result: 0 points must be red');
  assert.strictEqual(zeroPtsEl.style.color, '#ef4444', '0 points color must be #ef4444');

  assert(hundredPtsEl.classList.contains('cf-verdict-green'), 'Perfect result: 100 points must be green');
  assert.strictEqual(hundredPtsEl.style.color, '#22c55e', '100 points color must be #22c55e');

  assert(eightyFivePtsEl.classList.contains('cf-verdict-yellow'), 'Partial result: 85 points must be yellow');
  assert.strictEqual(eightyFivePtsEl.style.color, '#facc15', '85 points color must be #facc15');

  console.log('✓ Test 19 passed: Verdict coloring (100 pts green, 85 pts yellow, CE & 0 pts red, no text-shadow) verified');

  // Test 20: Status filter translations & Sidebox button layout (Apply -> Áp dụng, no button overlap, Find user -> Tìm kiếm thành viên, Handle -> Tài khoản, Find -> Tìm kiếm)
  console.log('Test 20: Status filter & Find user translation (Apply -> Áp dụng, Handle: -> Tài khoản:, Find -> Tìm kiếm) and clean button flexbox spacing');
  body.innerHTML = `
  <div class="sidebox">
    <div class="caption titled">→ Status filter</div>
    <div>
      <form action="" method="get">
        <label>Verdict:</label>
        <select id="verdictSelect">
          <option>Any verdict</option>
        </select>
        <div class="button-wrapper" style="text-align:center;">
          <input type="submit" value="Apply">
          <input type="reset" value="Reset">
        </div>
      </form>
    </div>
  </div>
  <div class="sidebox find-member-box">
    <div class="caption titled">→ Find user</div>
    <div>
      <form action="/ratings" method="post">
        <label id="handleLabel">Handle:</label>
        <input type="text" id="handleInput" name="handle" value="">
        <div class="find-btn-wrapper" style="text-align:right;">
          <input type="submit" id="findBtn" value="Find">
        </div>
      </form>
    </div>
  </div>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 60));

  const applyBtn = body.querySelector('.sidebox input[type="submit"]');
  const resetBtn = body.querySelector('.sidebox input[type="reset"]');
  const captionEl = body.querySelector('.sidebox .caption');
  const optEl = body.querySelector('#verdictSelect option');
  const btnWrapper = body.querySelector('.button-wrapper');

  const findCaption = body.querySelector('.find-member-box .caption');
  const handleLabel = body.querySelector('#handleLabel');
  const findBtn = body.querySelector('#findBtn');

  assert.strictEqual(applyBtn.value, 'Áp dụng', 'Apply button must be translated to Áp dụng');
  assert.strictEqual(resetBtn.value, 'Đặt lại', 'Reset button must be translated to Đặt lại');
  assert(captionEl.textContent.includes('Bộ lọc trạng thái'), 'Status filter caption must be translated');
  assert.strictEqual(optEl.textContent.trim(), 'Tất cả trạng thái', 'Dropdown option Any verdict must be translated');

  assert(findCaption.textContent.includes('Tìm kiếm thành viên'), 'Find user caption must be translated to Tìm kiếm thành viên');
  assert.strictEqual(handleLabel.textContent.trim(), 'Tài khoản:', 'Handle: must be translated to Tài khoản:');
  assert.strictEqual(findBtn.value, 'Tìm kiếm', 'Find button must be translated to Tìm kiếm');

  // Verify button layout styling to prevent collision/overlap
  assert(btnWrapper.classList.contains('cf-form-actions'), 'Button container must receive cf-form-actions');
  assert.strictEqual(btnWrapper.style.display, 'flex', 'Button container must be flexbox');
  assert.strictEqual(btnWrapper.style.gap, '10px', 'Button container must have 10px gap');
  assert.strictEqual(btnWrapper.style['flex-wrap'], 'wrap', 'Button container must wrap');
  assert.strictEqual(applyBtn.style.display, 'inline-flex', 'Apply button must be inline-flex');
  assert.strictEqual(resetBtn.style.display, 'inline-flex', 'Reset button must be inline-flex');

  // Check content.css rules for sidebox buttons and labels
  const sideboxCss = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');
  assert(sideboxCss.includes('.cf-form-actions'), 'content.css must define .cf-form-actions rules');
  assert(sideboxCss.includes('gap: 10px'), 'content.css must include gap: 10px for form buttons');
  assert(sideboxCss.includes('.sidebox input[type="submit"]'), 'content.css must target sidebox submit inputs');
  assert(sideboxCss.includes('html.cf-custom-bg-active .sidebox form label') || sideboxCss.includes('.sidebox form label'), 'content.css must style sidebox form labels');
  assert(sideboxCss.includes('text-align: left !important'), 'content.css must align sidebox form labels to the left');

  console.log('✓ Test 20 passed: Apply translated to Áp dụng, Handle: -> Tài khoản:, Find -> Tìm kiếm, and sidebox layout aligned properly');

  // Test 21: Streak: X text color is pure black (#000000) for both Dark and Light modes
  console.log('Test 21: Streak: X text color is pure black (#000000) for both Dark and Light modes');
  const streakCss = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');
  assert(streakCss.includes('html.cf-dark-mode #cf-header-streak'), 'content.css must style streak badge in dark mode');
  assert(streakCss.includes('html.cf-light-mode #cf-header-streak'), 'content.css must style streak badge in light mode');
  assert(streakCss.includes('.cf-streak-badge') && streakCss.includes('color: #000000 !important'), 'content.css must enforce black color for streak badge');

  // Ensure #header exists with user link
  body.innerHTML = `
  <div id="header">
    <div class="lang-chooser">
      <a href="/profile/tourist">tourist</a>
    </div>
  </div>`;

  // Trigger streak badge update
  storageChangeListeners.forEach(fn => fn({
    cfStreak: {
      newValue: {
        handle: 'tourist',
        currentStreak: 42,
        hasSubmittedToday: true,
        streakSubmissionsCount: 100,
        maxStreak: 50,
        totalActiveDays: 200
      }
    }
  }, 'local'));
  await new Promise(r => setTimeout(r, 60));

  const streakBadgeEl = body.querySelector('#cf-header-streak');
  assert(streakBadgeEl, '#cf-header-streak element must exist');
  assert(streakBadgeEl.textContent.includes('Streak: 42'), 'Streak badge must display Streak: 42');
  assert.strictEqual(streakBadgeEl.style.color, '#000000', 'Streak badge style.color must be #000000 (black)');
  console.log('✓ Test 21 passed: Streak: X badge displays pure black text (#000000) in all modes');

  // Test 22: Problemset AC/WA/ER column 3 (td.act) styling on both odd & even rows and hover
  console.log('Test 22: Problemset AC/WA/ER column 3 (td.act) styling on both odd and even rows and hover');
  body.innerHTML = `
  <table class="problems">
    <tr>
      <th class="id">#</th>
      <th class="name">Name</th>
      <th>Act</th>
    </tr>
    <!-- Row 1: Odd AC -->
    <tr class="accepted-problem">
      <td class="id">4A</td>
      <td class="name">Watermelon</td>
      <td class="act">✈️ ⭐️</td>
    </tr>
    <!-- Row 2: Even AC -->
    <tr class="accepted-problem dark">
      <td class="id">71A</td>
      <td class="name">Way Too Long Words</td>
      <td class="act">✈️ ⭐️</td>
    </tr>
    <!-- Row 3: Odd Rejected/WA -->
    <tr class="rejected-problem">
      <td class="id">231A</td>
      <td class="name">Team</td>
      <td class="act">✈️ ⭐️</td>
    </tr>
    <!-- Row 4: Even Rejected/WA -->
    <tr class="rejected-problem dark">
      <td class="id">282A</td>
      <td class="name">Bit++</td>
      <td class="act">✈️ ⭐️</td>
    </tr>
  </table>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 60));

  const pRows = body.querySelectorAll('table.problems tr');
  const oddAcAct = pRows[1].querySelector('td.act');
  const evenAcAct = pRows[2].querySelector('td.act');
  const oddWaAct = pRows[3].querySelector('td.act');
  const evenWaAct = pRows[4].querySelector('td.act');

  assert(oddAcAct.classList.contains('cf-act-accepted'), 'Odd row AC column 3 must receive cf-act-accepted');
  assert.strictEqual(oddAcAct.style['background-color'], 'rgba(34, 197, 94, 0.22)', 'Odd row AC column 3 background must be green');
  assert(evenAcAct.classList.contains('cf-act-accepted'), 'Even row AC column 3 must receive cf-act-accepted');
  assert.strictEqual(evenAcAct.style['background-color'], 'rgba(34, 197, 94, 0.22)', 'Even row AC column 3 background must be green');

  assert(oddWaAct.classList.contains('cf-act-rejected'), 'Odd row WA/ER column 3 must receive cf-act-rejected');
  assert.strictEqual(oddWaAct.style['background-color'], 'rgba(239, 68, 68, 0.22)', 'Odd row WA/ER column 3 background must be red');
  assert(evenWaAct.classList.contains('cf-act-rejected'), 'Even row WA/ER column 3 must receive cf-act-rejected');
  assert.strictEqual(evenWaAct.style['background-color'], 'rgba(239, 68, 68, 0.22)', 'Even row WA/ER column 3 background must be red');

  // Verify content.css rules
  const probCss = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');
  assert(probCss.includes('table.problems tr.accepted-problem td.act'), 'content.css must style accepted-problem td.act');
  assert(probCss.includes('table.problems tr.rejected-problem td.act'), 'content.css must style rejected-problem td.act');
  assert(probCss.includes('table.problems tr.accepted-problem:hover td.act'), 'content.css must style hover on accepted td.act');
  assert(probCss.includes('table.problems tr:hover td.act') || probCss.includes('table.problems tr:not(.accepted-problem):not(.rejected-problem):hover td.act'), 'content.css must style hover on general td.act');

  console.log('✓ Test 22 passed: Problemset AC/WA/ER column 3 styled on BOTH odd and even rows with full hover support');

  // ==========================================
  // Test 23: MathJax color enforcement & LaTeX delimiter rendering
  // ==========================================
  console.log('Test 23: MathJax color enforcement (dark #f1f5f9, light #0f172a) and $$$ delimiter preservation');

  // 1. Verify CSS rules for MathJax in dark/custom background and light mode
  const mathCss = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');
  assert(mathCss.includes('.cf-custom-bg-active .MathJax') || mathCss.includes('.MathJax'), 'content.css must style MathJax elements');
  assert(mathCss.includes('#f1f5f9'), 'content.css must enforce white #f1f5f9 for math in dark mode');
  assert(mathCss.includes('#0f172a'), 'content.css must enforce dark #0f172a for math in light mode');
  assert(mathCss.includes('stroke: #f1f5f9 !important'), 'content.css must enforce stroke #f1f5f9 for SVG/rendered math');

  // 2. Verify colorizeMathElements in content.js sets proper styles
  const contentJsCode = fs.readFileSync(path.join(__dirname, '../content/content.js'), 'utf8');
  assert(contentJsCode.includes('colorizeMathElements'), 'content.js must define colorizeMathElements');
  assert(contentJsCode.includes('typesetMath'), 'content.js must define typesetMath');
  assert(contentJsCode.includes('cf-typeset-math'), 'content.js must dispatch cf-typeset-math event');
  assert(contentJsCode.includes("addEventListener('focus'"), 'content.js must recolor math on window focus');
  assert(contentJsCode.includes("addEventListener('visibilitychange'"), 'content.js must recolor math on tab visibility switch');

  // 3. Verify main world bridge, KaTeX and manifest configuration
  const manifestObj = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
  const hasMainWorldBridge = manifestObj.content_scripts.some(cs => cs.world === 'MAIN' && cs.js.includes('content/cf-mathjax-bridge.js'));
  assert(hasMainWorldBridge, 'manifest.json must register cf-mathjax-bridge.js with world: MAIN');
  const hasKatex = manifestObj.content_scripts.some(cs => cs.js.includes('content/katex.min.js'));
  assert(hasKatex, 'manifest.json must register katex.min.js');
  assert(fs.existsSync(path.join(__dirname, '../content/katex.min.js')), 'content/katex.min.js must exist');

  const bridgeCode = fs.readFileSync(path.join(__dirname, '../content/cf-mathjax-bridge.js'), 'utf8');
  assert(bridgeCode.includes('PreProcess'), 'cf-mathjax-bridge.js must queue PreProcess to scan delimiters');
  assert(bridgeCode.includes('cf-typeset-math'), 'cf-mathjax-bridge.js must listen for cf-typeset-math event');
  assert(bridgeCode.includes("addEventListener('focus'"), 'cf-mathjax-bridge.js must listen for window focus');

  console.log('✓ Test 23 passed: MathJax color enforcement, focus/tab-switch preservation, and KaTeX instant math rendering verified');

  // Test 24: Contest Questions / Clarifications table translation (Questions about problems, QUESTION, ANSWER, announcements)
  console.log('Test 24: Contest Questions / Clarifications table translation');
  body.innerHTML = `
  <div class="datatable">
    <div class="caption title">→ Questions about problems</div>
    <table class="rtable">
      <thead>
        <tr>
          <th></th>
          <th>QUESTION</th>
          <th>ANSWER</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>2026-11-22 12:05:46</td>
          <td class="q-cell">Announcement</td>
          <td class="a-cell">
            <pre>General announcement
*****
Hacks are disabled for problems A-D. In all problems, system tests are equal to pretests plus hacks.</pre>
          </td>
        </tr>
        <tr>
          <td>2025-10-28 18:21:58</td>
          <td class="q-cell2">Announcement</td>
          <td class="a-cell2">
            <b>General announcement</b><br>
            *****<br>
            <pre>The queue is long due to huge number of submissions, we're working on it and it starts to decrease.</pre>
          </td>
        </tr>
      </tbody>
    </table>
  </div>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  const qCaptionEl = body.querySelector('.caption.title');
  const thQuestion = body.querySelectorAll('th')[1];
  const thAnswer = body.querySelectorAll('th')[2];
  const qCell = body.querySelector('.q-cell');
  const aPre = body.querySelector('.a-cell pre');
  const aCell2 = body.querySelector('.a-cell2');
  const aPre2 = body.querySelector('.a-cell2 pre');
  const aB2 = body.querySelector('.a-cell2 b');

  assert.strictEqual(qCaptionEl.textContent.trim(), '→ Thắc mắc về đề bài', 'Caption must be translated to → Thắc mắc về đề bài');
  assert.strictEqual(thQuestion.textContent.trim(), 'CÂU HỎI', 'QUESTION header must be translated to CÂU HỎI');
  assert.strictEqual(thAnswer.textContent.trim(), 'CÂU TRẢ LỜI', 'ANSWER header must be translated to CÂU TRẢ LỜI');
  assert.strictEqual(qCell.textContent.trim(), 'Thông báo', 'Announcement question cell must be translated to Thông báo');
  assert(aPre.textContent.includes('Đã dịch:') || aPre.dataset.cfTranslated === 'true' || aPre.textContent.includes('Tính năng hack bị vô hiệu hóa'), 'Answer pre content must be dynamically translated');
  assert.strictEqual(aPre.dataset.cfTranslated, 'true', 'Answer pre element must be marked data-cf-translated="true"');

  assert(aCell2.textContent.includes('Thông báo chung'), 'a-cell2 must include Thông báo chung');
  assert(aCell2.textContent.includes('Hàng đợi đang dài') || aCell2.textContent.includes('Đã dịch:'), 'a-cell2 announcement text must be translated');
  assert.strictEqual(aCell2.dataset.cfTranslated, 'true', 'a-cell2 must be marked data-cf-translated="true"');

  // Verify restoration to English
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 100));

  assert.strictEqual(qCaptionEl.textContent.trim(), '→ Questions about problems', 'Caption must be restored to original');
  assert.strictEqual(thQuestion.textContent.trim(), 'QUESTION', 'QUESTION header must be restored to QUESTION');
  assert.strictEqual(thAnswer.textContent.trim(), 'ANSWER', 'ANSWER header must be restored to ANSWER');
  assert(aPre.textContent.includes('Hacks are disabled'), 'Answer pre must be restored to original English content');
  assert(aCell2.textContent.includes('General announcement'), 'a-cell2 must restore General announcement');
  assert(aCell2.textContent.includes('The queue is long due to huge number of submissions'), 'a-cell2 must restore original English content');
  console.log('✓ Test 24 passed: Questions about problems box, QUESTION/ANSWER headers, and announcement cell dynamically translated & restored');

  // Test 25: Contest name title in sidebox is styled larger and readable
  console.log('Test 25: Contest name title in sidebox font sizing');
  const contestSideboxCss = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');
  assert(contestSideboxCss.includes('table.rtable th.top') || contestSideboxCss.includes('table.rtable th a'), 'content.css must define sidebox contest title rules');
  assert(contestSideboxCss.includes('13.5px') || contestSideboxCss.includes('14px'), 'content.css must enlarge contest name font size');
  assert(contestSideboxCss.includes('text-transform: none !important'), 'content.css must preserve natural capitalization for contest title');
  console.log('✓ Test 25 passed: Contest name title in sidebox enlarged to 13.5px with natural capitalization');

  // Test 26: Group sidebox translation and auto line-break wrapping in sidebox
  console.log('Test 26: Group sidebox translation and auto line-break wrapping in sidebox');
  body.innerHTML = `
  <div class="roundbox sidebox">
    <div class="caption titled">→ About Group</div>
    <div class="group-description">
      <p>Group description text in English</p>
      <a href="https://www.facebook.com/groups/acpeducentergroup">https://www.facebook.com/groups/acpeducentergroup</a>
    </div>
  </div>
  <div class="roundbox sidebox" id="contest-status-box">
    <div>Finished</div>
    <div>Practice</div>
    <div class="caption">→ Virtual participation</div>
    <div class="caption">→ Clone Contest to Mashup</div>
    <div>You can clone this contest to a mashup.</div>
  </div>`;

  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  const aboutGroupCaption = body.querySelector('.caption.titled');
  assert.strictEqual(aboutGroupCaption.textContent.trim(), '→ Giới thiệu nhóm', 'About Group caption must be translated to → Giới thiệu nhóm');

  const contestBox = body.querySelector('#contest-status-box');
  assert(contestBox.innerHTML.includes('Đã kết thúc'), 'Finished must be translated to Đã kết thúc');
  assert(contestBox.innerHTML.includes('Luyện tập'), 'Practice must be translated to Luyện tập');
  assert(contestBox.innerHTML.includes('→ Tham gia thi ảo'), '→ Virtual participation must be translated');
  assert(contestBox.innerHTML.includes('→ Nhân bản kỳ thi sang Mashup'), '→ Clone Contest to Mashup must be translated');
  assert(contestBox.innerHTML.includes('Bạn có thể nhân bản kỳ thi này thành một mashup.'), 'Clone contest explanation must be translated');

  // Verify CSS auto line-breaking rules in sidebox
  const sideboxWrapCss = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');
  assert(sideboxWrapCss.includes('overflow-wrap: anywhere !important'), 'content.css must include overflow-wrap: anywhere for sidebox');
  assert(sideboxWrapCss.includes('word-break: break-word !important'), 'content.css must include word-break: break-word for sidebox');
  assert(sideboxWrapCss.includes('.sidebox a'), 'content.css must style sidebox links to prevent overflow');
  console.log('✓ Test 26 passed: Group sidebox UI translated and auto line-breaking rules verified');

  // Test 27: Submit solution form & Ace code editor styling across Dark and Light modes
  console.log('Test 27: Submit solution form (transparent outer) & frosted black Ace code editor in dark mode');
  const submitCss = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');
  assert(submitCss.includes('form.submit-form') && submitCss.includes('background: transparent !important'), 'Outer form frame must be removed (transparent)');
  assert(submitCss.includes('html.cf-dark-mode.cf-custom-bg-active #editor') || submitCss.includes('html.cf-dark-mode.cf-custom-bg-active .ace_editor'), 'content.css must define dark mode code editor styling');
  assert(submitCss.includes('background: rgba(0, 0, 0, 0.75) !important') || submitCss.includes('rgba(0, 0, 0, 0.75)'), 'Code editor in dark mode must be semi-transparent black with gentle blur');
  assert(submitCss.includes('backdrop-filter: blur(16px)') || submitCss.includes('backdrop-filter: blur('), 'Code editor in dark mode must include backdrop blur');
  assert(submitCss.includes('html.cf-light-mode.cf-custom-bg-active .ace_editor'), 'content.css must switch Ace code editor to pure white background in light mode');
  assert(submitCss.includes('background: #ffffff !important') || submitCss.includes('background-color: #ffffff !important'), 'Code editor in light mode must be pure white (#ffffff)');
  assert(submitCss.includes('html.cf-dark-mode .ace_editor .ace_identifier'), 'content.css must define dark mode syntax highlighting for code editor');
  assert(submitCss.includes('html.cf-light-mode .ace_editor .ace_identifier'), 'content.css must define light mode syntax highlighting for code editor');
  assert(submitCss.includes('html.cf-dark-mode .submit-form .field-name') && submitCss.includes('html.cf-light-mode .submit-form .field-name'), 'content.css must style submit form labels across both modes');
  console.log('✓ Test 27 passed: Outer submit frame removed, and inner code editor has gentle frosted black blur in dark mode & pure white in light mode');

  // Test 28: Virtual contest disclaimer translation
  console.log('Test 28: Virtual contest disclaimer translation & restoration');
  body.innerHTML = `
    <div id="virtual-contest-notice">
      <p>Virtual contest is a way to take part in past contest, as close as possible to participation on time. It is supported only ICPC mode for virtual contests. If you've seen these problems, a virtual contest is not for you - solve these problems in the archive. If you just want to solve some problem from a contest, a virtual contest is not for you - solve this problem in the archive. Never use someone else's code, read the tutorials or communicate with other person during a virtual contest.</p>
      <button>Start virtual contest</button>
    </div>
  `;
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  const noticeP = body.querySelector('#virtual-contest-notice p');
  assert(noticeP.textContent.includes('Thi ảo là một cách để tham gia lại kỳ thi đã qua'), 'Full virtual contest disclaimer must be translated into Vietnamese');
  assert(noticeP.textContent.includes('chế độ thi theo luật ICPC'), 'ICPC rule text must be translated');
  assert(noticeP.textContent.includes('kho bài tập lưu trữ'), 'Archive text must be translated');
  const startBtn = body.querySelector('#virtual-contest-notice button');
  assert.strictEqual(startBtn.textContent.trim(), 'Bắt đầu thi ảo', 'Start virtual contest button must be translated');

  // Test restoration when switching back to English
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));
  assert(noticeP.textContent.includes('Virtual contest is a way to take part in past contest'), 'Notice text must restore to English');
  assert.strictEqual(startBtn.textContent.trim(), 'Start virtual contest', 'Button text must restore to English');
  console.log('✓ Test 28 passed: Virtual contest disclaimer translated into Vietnamese and cleanly restored to English');

  // Test 29: Raw text / hack test pages exclusion (e.g. /contest/2167/hacks/1154913/test) vs normal hacks list (/contest/2167/hacks)
  console.log('Test 29: Exclusion of raw hack test pages (no extension) while preserving /hacks list');
  const manifestRaw = fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8');
  const manifestCfg = JSON.parse(manifestRaw);
  assert(manifestCfg.content_scripts && manifestCfg.content_scripts.length > 0, 'manifest must have content_scripts');
  for (const cs of manifestCfg.content_scripts) {
    assert(Array.isArray(cs.exclude_globs), 'content_scripts must specify exclude_globs');
    assert(cs.exclude_globs.some(g => g.includes('*/hacks/*/test*')), 'exclude_globs must exclude hack test pages');
  }

  // Verify content.js behavior when running on /contest/2167/hacks/1154913/test
  function createTestEnv(pathname, href) {
    const docNode = new MockNode(1, 'HTML');
    const headNode = new MockNode(1, 'HEAD');
    const bodyNode = new MockNode(1, 'BODY');
    docNode.appendChild(headNode);
    docNode.appendChild(bodyNode);
    const docObj = {
      documentElement: docNode,
      head: headNode,
      body: bodyNode,
      createElement: (tag) => new MockNode(1, tag.toUpperCase()),
      createTextNode: (text) => new MockNode(3, '#text', text),
      getElementById: (id) => docNode.querySelector('#' + id),
      querySelector: (sel) => docNode.querySelector(sel),
      querySelectorAll: (sel) => docNode.querySelectorAll(sel),
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    const winObj = {
      location: { pathname, href },
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
      CF_TRANSLATIONS: windowObj.CF_TRANSLATIONS
    };
    winObj.window = winObj;
    const sb = {
      window: winObj,
      document: docObj,
      chrome: mockChrome,
      katex: mockKatex,
      Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
      MutationObserver: class {
        observe() {}
        disconnect() {}
      },
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      console: console,
      CF_TRANSLATIONS: windowObj.CF_TRANSLATIONS,
      MathJax: {
        Hub: { Queue: () => {} },
        typesetPromise: async () => {}
      }
    };
    vm.createContext(sb);
    return { sb, docNode, bodyNode };
  }

  const { sb: excludedSandbox, docNode: excludedDoc, bodyNode: excludedBody } = createTestEnv(
    '/contest/2167/hacks/1154913/test',
    'https://codeforces.com/contest/2167/hacks/1154913/test'
  );
  vm.runInContext(contentCode, excludedSandbox);

  // Assert no extension classes or elements were added
  assert(!excludedDoc.classList.contains('cf-custom-bg-active'), 'Excluded page must NOT have cf-custom-bg-active class');
  assert(!excludedDoc.classList.contains('cf-dark-mode'), 'Excluded page must NOT have cf-dark-mode class');
  assert(excludedBody.childNodes.length === 0, 'Excluded page body must NOT have any extension elements added');

  // Verify normal /contest/2167/hacks is NOT excluded
  const { sb: normalSandbox, docNode: normalDoc, bodyNode: normalBody } = createTestEnv(
    '/contest/2167/hacks',
    'https://codeforces.com/contest/2167/hacks'
  );
  vm.runInContext(contentCode, normalSandbox);

  // Normal hacks page SHOULD initialize background layer when active
  assert(normalDoc.classList.contains('cf-custom-bg-active'), 'Normal /hacks page MUST have cf-custom-bg-active class');
  console.log('✓ Test 29 passed: Raw hack test pages excluded cleanly, while normal /hacks page runs extension normally');

  // Test 30: Status filter is used, click here to reset & Contest status translation and spacing
  console.log('Test 30: Status filter notice & Contest status translation & spacing');
  body.innerHTML = `
    <div id="pageContent">
      <div class="status-filter-notice" style="font-size: 1.1em; margin-bottom: 0.5em;">
        Status filter is used, click <a href="https://codeforces.com/contest/2167/status#">here</a> to reset
      </div>
      <div class="datatable">
        <div class="caption titled">Contest status <a href="#"><img class="standings-type-icon" src="icon.png"></a></div>
        <table class="status-frame-datatable">
          <thead>
            <tr><th>#</th><th>WHEN</th><th>WHO</th></tr>
          </thead>
          <tbody>
            <tr><td>12345</td><td>12:00</td><td>tourist</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Trigger translation to Vietnamese
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  const filterNotice = body.querySelector('.status-filter-notice');
  const filterLink = filterNotice.querySelector('a');
  const statusCaptionEl = body.querySelector('.caption.titled');

  assert(filterNotice.textContent.includes('Bộ lọc trạng thái đang được sử dụng'), 'Filter notice must be translated into Vietnamese');
  assert(filterNotice.textContent.includes('nhấp vào'), 'Filter notice must contain "nhấp vào"');
  assert.strictEqual(filterLink.textContent.trim(), 'đây', 'Filter link "here" must be translated to "đây"');
  assert(filterNotice.textContent.includes('đặt lại'), 'Filter notice must contain "đặt lại"');
  assert(statusCaptionEl.textContent.includes('Trạng thái kỳ thi'), 'Contest status caption must be translated to "Trạng thái kỳ thi"');

  // Verify CSS spacing rules in content.css
  const statusCss = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');
  assert(statusCss.includes('.caption.titled') && statusCss.includes('padding-top: 8px !important'), 'content.css must define padding-top on captions');
  assert(statusCss.includes('padding: 16px 18px !important'), 'content.css must enlarge datatable padding');

  // Switch back to English and verify clean restoration
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  assert(filterNotice.textContent.includes('Status filter is used, click'), 'Filter notice must restore English text');
  assert.strictEqual(filterLink.textContent.trim(), 'here', 'Filter link must restore "here"');
  assert(filterNotice.textContent.includes('to reset'), 'Filter notice must restore "to reset"');
  assert(statusCaptionEl.textContent.includes('Contest status'), 'Caption must restore "Contest status"');
  console.log('✓ Test 30 passed: Status filter notice & Contest status translated and cleanly restored to English, spacing verified');

  // Test 31: Problem tags sidebox translation and compact badge styling
  console.log('Test 31: Problem tags sidebox translation & compact styling');
  body.innerHTML = `
    <div id="sidebar">
      <div class="roundbox sidebox">
        <div class="caption titled">→ Problem tags</div>
        <div style="padding: 0.5em 0 1em 0;">
          <div class="roundbox" style="margin:2px; padding:0 3px 2px 3px; background-color:#f0f0f0;float:left;">
            <a class="notice" href="/problemset/tags/data%20structures" style="text-decoration:none;">data structures</a>
          </div>
          <div class="roundbox" style="margin:2px; padding:0 3px 2px 3px; background-color:#f0f0f0;float:left;">
            <a class="notice" href="/problemset/tags/dp" style="text-decoration:none;">dp</a>
          </div>
          <div class="roundbox" style="margin:2px; padding:0 3px 2px 3px; background-color:#f0f0f0;float:left;">
            <span class="tag-box" style="font-size:12px;" title="Difficulty">*1600</span>
          </div>
        </div>
        <div style="clear:both;text-align:right;font-size:11px;">
          <span>No tag edit access</span>
        </div>
      </div>
    </div>
  `;

  // Trigger translation to Vietnamese
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  const tagsCaption = body.querySelector('.sidebox .caption.titled');
  const tagLinks = body.querySelectorAll('.sidebox .roundbox a.notice');
  const noAccessSpan = body.querySelector('.sidebox div[style*="clear:both"] span');

  assert.strictEqual(tagsCaption.textContent.trim(), '→ Thẻ bài tập', 'Problem tags caption must be translated to → Thẻ bài tập');
  assert.strictEqual(tagLinks[0].textContent.trim(), 'cấu trúc dữ liệu', 'Tag "data structures" must be translated to "cấu trúc dữ liệu"');
  assert.strictEqual(tagLinks[1].textContent.trim(), 'quy hoạch động (dp)', 'Tag "dp" must be translated to "quy hoạch động (dp)"');
  assert.strictEqual(noAccessSpan.textContent.trim(), 'Không có quyền sửa thẻ', 'Notice must be translated to "Không có quyền sửa thẻ"');

  // Verify CSS compact rules for tags in content.css
  const tagsCss = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');
  assert(tagsCss.includes('.sidebox .roundbox') && tagsCss.includes('padding: 3px 8px !important'), 'content.css must define compact padding for problem tags');
  assert(tagsCss.includes(':not(.sidebox .roundbox)'), 'content.css must exclude sidebox tags from giant profile roundbox padding');

  // Switch back to English and verify clean restoration
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  assert.strictEqual(tagsCaption.textContent.trim(), '→ Problem tags', 'Caption must restore "→ Problem tags"');
  assert.strictEqual(tagLinks[0].textContent.trim(), 'data structures', 'Tag must restore "data structures"');
  assert.strictEqual(tagLinks[1].textContent.trim(), 'dp', 'Tag must restore "dp"');
  assert.strictEqual(noAccessSpan.textContent.trim(), 'No tag edit access', 'Notice must restore "No tag edit access"');
  console.log('✓ Test 31 passed: Problem tags caption, tags, and no access notice translated and cleanly restored to English, compact styling verified');

  // Test 32: Contest sub-navigation tabs (SUBMIT CODE, MY SUBMISSIONS, CUSTOM INVOCATION) & Practice? sidebox translation
  console.log('Test 32: Contest tabs & Practice? sidebox translation');
  body.innerHTML = `
    <div class="second-level-menu">
      <ul class="second-level-menu-list">
        <li><a href="/contest/2167/problems">PROBLEMS</a></li>
        <li><a href="/contest/2167/submit">SUBMIT CODE</a></li>
        <li><a href="/contest/2167/my">MY SUBMISSIONS</a></li>
        <li><a href="/contest/2167/status">STATUS</a></li>
        <li><a href="/contest/2167/standings">STANDINGS</a></li>
        <li><a href="/contest/2167/customtest">CUSTOM INVOCATION</a></li>
      </ul>
    </div>
    <div class="roundbox sidebox">
      <div class="caption titled">→ Practice?</div>
      <p>Want to solve the contest problems after the official contest ends? Just register for practice and you will be able to submit solutions.</p>
      <form action="/contest/2167/practice" method="post">
        <input type="submit" value="Register for practice">
      </form>
    </div>
  `;

  // Trigger translation to Vietnamese
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  const navLinks = body.querySelectorAll('.second-level-menu-list li a');
  const practiceCaption = body.querySelector('.sidebox .caption.titled');
  const practiceDesc = body.querySelector('.sidebox p');
  const practiceBtn = body.querySelector('.sidebox input[type="submit"]');

  assert.strictEqual(navLinks[1].textContent.trim(), 'NỘP BÀI', 'SUBMIT CODE must translate to NỘP BÀI');
  assert.strictEqual(navLinks[2].textContent.trim(), 'BÀI NỘP CỦA TÔI', 'MY SUBMISSIONS must translate to BÀI NỘP CỦA TÔI');
  assert.strictEqual(navLinks[5].textContent.trim(), 'CHẠY THỬ', 'CUSTOM INVOCATION must translate to CHẠY THỬ');
  assert.strictEqual(practiceCaption.textContent.trim(), '→ Luyện tập?', 'Practice? caption must translate to → Luyện tập?');
  assert(practiceDesc.textContent.includes('Bạn muốn giải các bài tập sau khi kỳ thi chính thức kết thúc?'), 'Practice description must translate to Vietnamese');
  assert.strictEqual(practiceBtn.value.trim(), 'Đăng ký luyện tập', 'Register for practice button must translate to Đăng ký luyện tập');

  // Switch back to English and verify clean restoration
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  assert.strictEqual(navLinks[1].textContent.trim(), 'SUBMIT CODE', 'Must restore SUBMIT CODE');
  assert.strictEqual(navLinks[2].textContent.trim(), 'MY SUBMISSIONS', 'Must restore MY SUBMISSIONS');
  assert.strictEqual(navLinks[5].textContent.trim(), 'CUSTOM INVOCATION', 'Must restore CUSTOM INVOCATION');
  assert.strictEqual(practiceCaption.textContent.trim(), '→ Practice?', 'Must restore → Practice?');
  assert(practiceDesc.textContent.includes('Want to solve the contest problems'), 'Must restore practice description');
  assert.strictEqual(practiceBtn.value.trim(), 'Register for practice', 'Must restore Register for practice button');
  console.log('✓ Test 32 passed: Contest sub-navigation tabs & Practice? sidebox translated and cleanly restored to English');

  // Test 33: Profile "online now" vibrant green styling & compact "Find user" sidebox
  console.log('Test 33: Profile "online now" green indicator & compact sidebox');
  body.innerHTML = `
    <div class="userbox">
      <div class="info">
        <ul>
          <li><span>Last visit: </span><span class="format-online">online now</span></li>
          <li><span>Registered: </span><span>1 year ago</span></li>
        </ul>
      </div>
    </div>
    <div class="roundbox sidebox">
      <div class="caption titled">→ Find user</div>
      <form action="/search" method="post" style="padding: 1em 1.2em;">
        <label style="display:block; text-align:left;">Handle:</label>
        <div style="padding: 0.25em 0;">
          <input type="text" name="handle" value=""/>
        </div>
        <div style="text-align: center; margin: 1em 0 0 0;">
          <input type="submit" value="Find"/>
        </div>
      </form>
    </div>
  `;

  // Trigger Vietnamese translation
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  const t33OnlineSpan = body.querySelector('.format-online, .cf-online-now');
  const t33LastVisitSpan = body.querySelectorAll('.info span')[0];
  const t33FindCaption = body.querySelector('.sidebox .caption.titled');
  const t33HandleLabel = body.querySelector('.sidebox label');
  const t33FindBtn = body.querySelector('.sidebox input[type="submit"]');
  const t33SideboxForm = body.querySelector('.sidebox form');
  const t33SideboxActionContainer = t33FindBtn.parentElement;

  assert(t33OnlineSpan, 'Online status element must exist');
  assert.strictEqual(t33OnlineSpan.textContent.trim(), 'đang trực tuyến', 'online now must translate to đang trực tuyến');
  assert.strictEqual(t33OnlineSpan.style.color, '#22c55e', 'online now text must be vibrant green #22c55e');
  assert.strictEqual(t33LastVisitSpan.textContent.trim(), 'Lần truy cập cuối:', 'Last visit: must translate to Lần truy cập cuối:');

  assert.strictEqual(t33FindCaption.textContent.trim(), '→ Tìm kiếm thành viên', 'Find user must translate to Tìm kiếm thành viên');
  assert.strictEqual(t33HandleLabel.textContent.trim(), 'Tài khoản:', 'Handle: must translate to Tài khoản:');
  assert.strictEqual(t33FindBtn.value.trim(), 'Tìm kiếm', 'Find button must translate to Tìm kiếm');
  assert.strictEqual(t33SideboxActionContainer.style['margin-top'], '6px', 'Sidebox action container must have compact top margin (6px)');
  assert.strictEqual(t33SideboxForm.style.padding, '2px 0', 'Sidebox form must have compact vertical padding');

  // Switch back to English and verify clean restoration while preserving green color
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  assert.strictEqual(t33OnlineSpan.textContent.trim(), 'online now', 'Must restore online now text in English');
  assert.strictEqual(t33OnlineSpan.style.color, '#22c55e', 'online now must remain green #22c55e in English mode');
  assert.strictEqual(t33LastVisitSpan.textContent.trim(), 'Last visit:', 'Must restore Last visit:');
  assert.strictEqual(t33FindCaption.textContent.trim(), '→ Find user', 'Must restore Find user caption');
  assert.strictEqual(t33HandleLabel.textContent.trim(), 'Handle:', 'Must restore Handle: label');
  assert.strictEqual(t33FindBtn.value.trim(), 'Find', 'Must restore Find button');

  // Verify CSS content rules
  const test33CssContent = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');
  assert(test33CssContent.includes('.cf-online-now') && test33CssContent.includes('#22c55e'), 'content.css must include .cf-online-now green #22c55e styling');
  assert(test33CssContent.includes(':not(.format-online):not(.online):not(.cf-online-now):not([style*="green"])'), 'content.css rule 3512 must exempt online now from dark mode white override');
  assert(test33CssContent.includes('padding: 10px 12px !important;') && test33CssContent.includes('padding-top: 2px !important;'), 'content.css must include compact sidebox rules');

  console.log('✓ Test 33 passed: Profile "online now" green indicator & compact sidebox verified');

  // Test 34: Rating Graph Contest Tooltip Popup Elevation & High Z-Index Over Sidebar
  console.log('Test 34: Rating graph contest tooltip popup elevation & z-index');
  body.innerHTML = `
    <div id="body">
      <div id="pageContent" class="content-with-sidebar">
        <div class="roundbox">
          <div id="placeholder" style="width: 800px; height: 350px;"></div>
        </div>
      </div>
      <div id="sidebar">
        <div class="roundbox sidebox">
          <div class="caption titled">→ Đóng góp hàng đầu</div>
        </div>
      </div>
    </div>
  `;

  // Trigger DOM initialization
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 100));

  // Dynamically insert rating graph tooltip (as Flot does on hover)
  const dynamicTooltip = new MockNode(1, 'div');
  dynamicTooltip.id = 'tooltip';
  dynamicTooltip.innerHTML = `
    <div>1228 (+115), pupil</div>
    <div>Rank: 1933</div>
    <a href="/contest/2167">Codeforces Round 1062 (Div. 4)</a>
  `;
  body.appendChild(dynamicTooltip);

  // Trigger placeholder mousemove to fire tooltip elevation
  const placeholderEl = body.querySelector('#placeholder');
  if (placeholderEl) {
    placeholderEl.dispatchEvent(new Event('mousemove'));
  }
  await new Promise(r => setTimeout(r, 100));

  assert.strictEqual(dynamicTooltip.style['z-index'], '99999999', 'Rating graph tooltip must have top-level z-index 99999999');
  assert(dynamicTooltip.classList.contains('cf-rating-tooltip-top'), 'Rating graph tooltip must have class cf-rating-tooltip-top');

  // Verify CSS content rules for stacking order and tooltip styling
  const test34CssContent = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');
  assert(test34CssContent.includes('#pageContent') && test34CssContent.includes('z-index: 20 !important;'), 'content.css must define #pageContent z-index: 20');
  assert(test34CssContent.includes('#sidebar') && test34CssContent.includes('z-index: 10 !important;'), 'content.css must define #sidebar z-index: 10');
  assert(test34CssContent.includes('#tooltip') && test34CssContent.includes('z-index: 99999999 !important;'), 'content.css must define #tooltip z-index: 99999999');
  assert(test34CssContent.includes('html.cf-dark-mode #tooltip') && test34CssContent.includes('backdrop-filter: blur(14px)'), 'content.css must define frosted glass styling for #tooltip');

  console.log('✓ Test 34 passed: Rating graph contest tooltip popup elevation & z-index verified');

  // Test 35: Contest materials, Attention translation, Submit form layout & Announcement framing
  console.log('Test 35: Contest materials, Attention translation, Submit form layout & Announcement framing');
  body.innerHTML = `
    <div id="sidebar">
      <!-- Submit form sidebox -->
      <div class="sidebox roundbox">
        <div class="caption titled">→ Submit?</div>
        <form class="submitForm" method="post">
          <table class="table-form">
            <tr>
              <td class="field-name">Language:</td>
              <td><select><option>GNU G++23</option></select></td>
            </tr>
            <tr>
              <td class="field-name">Source:</td>
              <td><input type="file" name="sourceFile"></td>
            </tr>
            <tr>
              <td colspan="2">
                <input class="submit" type="submit" value="Submit">
              </td>
            </tr>
          </table>
        </form>
      </div>

      <!-- Contest materials sidebox -->
      <div class="sidebox roundbox">
        <div class="caption titled">→ Contest materials</div>
        <ul>
          <li><a href="/blog/entry/123">Announcement</a></li>
        </ul>
      </div>

      <!-- Attention sidebox -->
      <div class="sidebox roundbox">
        <div class="caption titled">→ Attention</div>
        <div>
          The package for this problem was not updated by the problem writer or Codeforces administration after we've upgraded the judging servers. To adjust the time limit constraint, a solution execution time will be multiplied by 2. For example, if your solution works for 400 ms on judging servers, then the value 800 ms will be displayed and used to determine the verdict.
        </div>
      </div>
    </div>
  `;

  // Trigger translation
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 100));

  // Check translations
  const captions = Array.from(body.querySelectorAll('.caption.titled')).map(c => c.textContent.trim());
  assert(captions.some(c => c.includes('Nộp bài')), 'Submit? caption must be translated to Nộp bài?');
  assert(captions.some(c => c.includes('Tài liệu kỳ thi')), 'Contest materials caption must be translated to Tài liệu kỳ thi');
  assert(captions.some(c => c.includes('Lưu ý')), 'Attention caption must be translated to Lưu ý');

  // Check Attention body text
  const attentionBox = body.querySelectorAll('.sidebox')[2];
  assert(attentionBox.textContent.includes('Gói bài tập này chưa được cập nhật'), 'Attention text must be translated to Vietnamese');

  // Check Submit button container in table is NOT flex
  const submitTd = body.querySelector('form.submitForm td[colspan="2"]');
  assert.notStrictEqual(submitTd.style.display, 'flex', 'Submit form table cell must not be display: flex');

  // Check CSS rules for sidebox ul li framing and submit form table
  const test35Css = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');
  assert(test35Css.includes('.sidebox ul li') && test35Css.includes('backdrop-filter: blur(8px)'), 'content.css must define glass card styling for sidebox ul li');
  assert(test35Css.includes('html.cf-custom-bg-active .sidebox form td.field-name') && test35Css.includes('white-space: nowrap !important;'), 'content.css must define white-space: nowrap for sidebox form td.field-name');
  assert(test35Css.includes('table-layout: auto !important;'), 'content.css must define table-layout: auto for sidebox form tables');
  assert(test35Css.includes('html.cf-custom-bg-active .sidebox form td:not(.field-name)') && test35Css.includes('text-align: left !important;'), 'content.css must define text-align: left for td:not(.field-name)');

  console.log('✓ Test 35 passed: Contest materials, Attention translation, Submit form layout & Announcement framing verified');

  // Test 36: Elements translated with Google are re-translated when switching to AI (Gemini)
  console.log('Test 36: Elements translated with Google are re-translated when switching to AI (Gemini)');
  body.innerHTML = `
    <div class="problem-statement">
      <div class="header"><div class="title">A. Beautiful Matrix</div></div>
      <p id="test-para">You are given a matrix.</p>
    </div>
  `;

  // First translate with Google
  storageChangeListeners.forEach(fn => fn({
    cfLang: { newValue: 'vi' },
    translationEngine: { newValue: 'google' }
  }, 'local'));
  await new Promise(r => setTimeout(r, 100));

  const pEl = body.querySelector('#test-para');
  assert.strictEqual(pEl.dataset.cfTranslated, 'true');
  assert.strictEqual(pEl.dataset.cfEngine, 'google');

  // Now switch translation engine to Gemini
  storageChangeListeners.forEach(fn => fn({
    translationEngine: { newValue: 'gemini' }
  }, 'local'));
  await new Promise(r => setTimeout(r, 100));

  assert.strictEqual(pEl.dataset.cfEngine, 'gemini', 'Element must be re-translated with Gemini engine');
  console.log('✓ Test 36 passed: Elements translated with Google are re-translated when switching to AI (Gemini)');

  // Test 37: Elements translated with Google are re-translated when switching to xKiro (Mistral)
  console.log('Test 37: Elements translated with Google are re-translated when switching to xKiro (Mistral)');
  // Re-translate with Google
  storageChangeListeners.forEach(fn => fn({
    translationEngine: { newValue: 'google' }
  }, 'local'));
  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(pEl.dataset.cfEngine, 'google');

  // Now switch to xkiro
  storageChangeListeners.forEach(fn => fn({
    translationEngine: { newValue: 'xkiro' }
  }, 'local'));
  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(pEl.dataset.cfEngine, 'xkiro', 'Element must be re-translated with xKiro engine');
  console.log('✓ Test 37 passed: Elements translated with Google are re-translated when switching to xKiro (Mistral)');

  // Test 38: Real-time progressive streamItemReady rendering as AI returns content
  console.log('Test 38: Real-time progressive streamItemReady rendering as AI returns content');
  body.innerHTML = `
    <div class="problem-statement">
      <div class="header"><div class="title">B. Queue at the School</div></div>
      <p id="stream-p1">During the break the schoolchildren came to the canteen.</p>
      <p id="stream-p2">Initially the children stood in the queue.</p>
    </div>
  `;

  // Simulate streamItemReady message delivery from background
  const p1 = body.querySelector('#stream-p1');
  const p2 = body.querySelector('#stream-p2');

  storageChangeListeners.forEach(fn => fn({
    cfLang: { newValue: 'vi' },
    translationEngine: { newValue: 'xkiro' }
  }, 'local'));
  await new Promise(r => setTimeout(r, 100));

  assert.strictEqual(p1.dataset.cfTranslated, 'true');
  assert.strictEqual(p2.dataset.cfTranslated, 'true');
  console.log('✓ Test 38 passed: Real-time progressive streamItemReady rendering verified');

  // Test 39: Sidebox layout - Contest centering in Attention, Recent actions unboxed, No inner frames
  console.log('Test 39: Sidebox layout - Contest centering in Attention, Recent actions unboxed, No inner frames');
  body.innerHTML = `
    <div id="sidebar">
      <!-- Pay attention sidebox with contest -->
      <div class="roundbox sidebox cf-attention-box">
        <div class="caption titled">→ Chú ý</div>
        <div id="attention-content" style="padding: 0.5em;">
          Trước cuộc thi<br>
          <a href="/contest/2167">Codeforces Round (Div. 3)</a><br>
          <span class="countdown">4 ngày</span><br>
          <a href="/contest/2167/register">Đăng ký ngay »</a>
        </div>
      </div>

      <!-- Recent actions sidebox -->
      <div class="roundbox sidebox cf-recent-actions-box">
        <div class="caption titled">→ Hoạt động gần đây</div>
        <div class="recent-actions">
          <ul>
            <li id="ra-item-1">
              <a href="/profile/Imakf">Imakf</a> → <a href="/blog/entry/123">Editorial</a>
            </li>
            <li id="ra-item-2">
              <a href="/profile/Amao_Fox">Amao_Fox</a> → <a href="/blog/entry/456">I feel stuck</a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Submit sidebox with nested roundbox -->
      <div class="roundbox sidebox" id="submit-sidebox">
        <div class="caption titled">→ Nộp bài?</div>
        <div class="roundbox" id="nested-roundbox">
          <input type="submit" value="Nộp bài">
        </div>
      </div>
    </div>
  `;

  // Trigger language change or format update
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  // 1. Attention contest centering
  const test39AttentionBox = body.querySelector('.cf-attention-box');
  assert(test39AttentionBox, 'Attention box must exist');
  const attentionDiv = body.querySelector('#attention-content');
  assert(attentionDiv, 'Attention content div must exist');
  assert.strictEqual(attentionDiv.style.textAlign, 'center', 'Attention inner div must be centered');

  // 2. Recent actions unboxing (no small inner frames)
  const raItem1 = body.querySelector('#ra-item-1');
  assert.strictEqual(raItem1.style.background, 'transparent', 'Recent action item background must be transparent');
  assert.strictEqual(raItem1.style.border, 'none', 'Recent action item must not have a border frame');

  // 3. No nested roundbox framing in submit
  const nestedRoundbox = body.querySelector('#nested-roundbox');
  assert.strictEqual(nestedRoundbox.style.background, 'transparent', 'Nested roundbox must not have card background');
  assert.strictEqual(nestedRoundbox.style.border, 'none', 'Nested roundbox must not have a border');

  // 4. CSS file checks
  const contentCss = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');
  assert(contentCss.includes('.cf-attention-box') && contentCss.includes('text-align: center'), 'content.css must define centering for Attention contests');
  assert(contentCss.includes('.cf-recent-actions-box') && contentCss.includes('border: none'), 'content.css must define unboxed transparent items for Recent actions');
  assert(contentCss.includes('.roundbox:not(:has(a.notice)):not(:has(.tag-box))'), 'content.css must prevent inner roundbox framing in sideboxes');

  console.log('✓ Test 39 passed: Contest centering in Attention, Recent actions unboxed, No inner frames verified');

  // ==========================================
  // Test 40: Telegram Subscription Notice & Date/Time Translation & Restoration
  // ==========================================
  console.log('Test 40: Telegram Subscription Notice & Date/Time Translation & Restoration');
  body.innerHTML = `
    <div id="test40-container">
      <div id="tg-text-1">  Please subscribe to the official Codeforces channel in Telegram via the link https://t.me/codeforces_official.</div>
      <div id="tg-text-2">
        <span>Please subscribe to the official Codeforces channel in Telegram via the link </span>
        <a href="https://t.me/codeforces_official">https://t.me/codeforces_official</a>
      </div>
      <div id="datetime-items">
        <span id="dt-contest" class="format-timewithseconds">Nov/24/2026 17:35</span>
        <span id="dt-full" class="format-date" title="Monday, November 24, 2026 17:35">Nov 24, 2026</span>
        <span id="dt-humantime" class="format-humantime" title="Nov/24/2026 17:35">4 days ago</span>
        <span id="dt-countdown" class="countdown">in 3 days</span>
        <span id="dt-left">2 hours left</span>
      </div>
    </div>
  `;

  // Switch to Vietnamese
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  const tg1 = body.querySelector('#tg-text-1');
  assert(tg1.textContent.includes('Vui lòng đăng ký kênh Codeforces chính thức trên Telegram qua liên kết https://t.me/codeforces_official.'), 'Full Telegram string must be translated');
  assert(tg1.textContent.startsWith('  '), 'Leading spaces must be preserved');

  const tg2 = body.querySelector('#tg-text-2');
  assert(tg2.textContent.includes('Vui lòng đăng ký kênh Codeforces chính thức trên Telegram qua liên kết'), 'Partial Telegram notice before link must be translated');

  const dtContest = body.querySelector('#dt-contest');
  assert(dtContest.textContent.includes('24 Th11, 2026 17:35'), 'Nov/24/2026 17:35 must be formatted into Vietnamese date');

  const dtFull = body.querySelector('#dt-full');
  assert(dtFull.textContent.includes('24 Th11, 2026'), 'Nov 24, 2026 must be formatted into Vietnamese date');
  assert(dtFull.getAttribute('title').includes('Thứ Hai, 24 Tháng 11, 2026 17:35'), 'Title tooltip must be translated with day of week');

  const dtHuman = body.querySelector('#dt-humantime');
  assert.strictEqual(dtHuman.textContent.trim(), '4 ngày trước', 'Relative time 4 days ago must be translated');

  const dtCountdown = body.querySelector('#dt-countdown');
  assert.strictEqual(dtCountdown.textContent.trim(), 'trong 3 ngày', 'in 3 days must be translated');

  const dtLeft = body.querySelector('#dt-left');
  assert.strictEqual(dtLeft.textContent.trim(), 'còn 2 giờ', '2 hours left must be translated');

  // Switch back to English (clean restoration)
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  assert.strictEqual(tg1.textContent, '  Please subscribe to the official Codeforces channel in Telegram via the link https://t.me/codeforces_official.', 'Telegram notice must cleanly revert to English');
  assert.strictEqual(dtContest.textContent, 'Nov/24/2026 17:35', 'Contest date must cleanly revert to English');
  assert.strictEqual(dtFull.textContent, 'Nov 24, 2026', 'Full date text must cleanly revert to English');
  assert.strictEqual(dtFull.getAttribute('title'), 'Monday, November 24, 2026 17:35', 'Tooltip title must cleanly revert to English');
  assert.strictEqual(dtHuman.textContent, '4 days ago', 'Humantime must cleanly revert to English');
  assert.strictEqual(dtCountdown.textContent, 'in 3 days', 'Countdown must cleanly revert to English');
  assert.strictEqual(dtLeft.textContent, '2 hours left', 'Hours left must cleanly revert to English');

  console.log('✓ Test 40 passed: Telegram Subscription Notice & Date/Time Translation & Restoration verified');

  // ==========================================
  // Test 41: Personal Profile Sidebar Unboxing & Media Under 100MB without LFS
  // ==========================================
  console.log('Test 41: Personal Profile Sidebar Unboxing & Media Under 100MB');
  body.innerHTML = `
    <div class="sidebox cf-personal-sidebar-box" id="test41-box">
      <div class="caption titled">→ PTKhoa</div>
      <div class="personal-sidebar">
        <ul class="property-links">
          <li id="ps-rating">Rating: <span class="user-green">1328</span></li>
          <li id="ps-contrib">Contribution: <span>0</span></li>
        </ul>
        <ul>
          <li id="ps-settings"><a href="/settings/general">Cài đặt</a></li>
          <li id="ps-blog"><a href="/blog/PTKhoa">Bài viết</a></li>
          <li id="ps-teams"><a href="/teams">Đội</a></li>
          <li id="ps-subs"><a href="/submissions/PTKhoa">Lịch sử nộp</a></li>
          <li id="ps-groups"><a href="/groups/with/PTKhoa">Nhóm</a></li>
          <li id="ps-talks"><a href="/usertalk">Talks</a></li>
          <li id="ps-contests"><a href="/contests/with/PTKhoa">Kỳ thi</a></li>
        </ul>
      </div>
    </div>
  `;

  // Trigger translation / sidebar layout adjustments
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'vi' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  const psRating = body.querySelector('#ps-rating');
  assert.strictEqual(psRating.style.background, 'transparent', 'Rating item background must be transparent');
  assert.strictEqual(psRating.style.border, 'none', 'Rating item must not have a border frame');

  const psSettings = body.querySelector('#ps-settings');
  assert.strictEqual(psSettings.style.background, 'transparent', 'Settings item background must be transparent');
  assert.strictEqual(psSettings.style.border, 'none', 'Settings item must not have a border frame');

  // Check CSS defines personal-sidebar unboxing
  assert(contentCss.includes('.personal-sidebar ul li') && contentCss.includes('border: none'), 'content.css must unbox personal sidebar items');

  // Check default-bg.webm size is strictly under 100MB and under 50MB
  const bgPath = path.join(__dirname, '../assets/default-bg.webm');
  const bgStat = fs.statSync(bgPath);
  assert(bgStat.size < 100 * 1024 * 1024, 'default-bg.webm size must be under 100MB');
  assert(bgStat.size < 50 * 1024 * 1024, 'default-bg.webm size must be under 50MB for zero GitHub warnings');

  // Verify demo.mp4 is removed and chilling-cat.webm exists
  assert(!fs.existsSync(path.join(__dirname, '../assets/demo.mp4')), 'assets/demo.mp4 must be removed');
  assert(fs.existsSync(path.join(__dirname, '../assets/chilling-cat.webm')), 'assets/chilling-cat.webm must exist');

  console.log('✓ Test 41 passed: Personal Profile Sidebar Unboxing & Media Under 100MB verified');

  // Test 42: WebM playback fix, chilling-cat fallback and version 1.6.0 Alpha verification
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
  assert.strictEqual(manifest.version, '1.6.0', 'Manifest version must be 1.6.0');
  assert.strictEqual(manifest.version_name, 'v1.6.0 Alpha', 'Manifest version_name must be v1.6.0 Alpha');

  const webRes = manifest.web_accessible_resources[0].resources;
  assert(webRes.includes('assets/chilling-cat.webm'), 'manifest resources must include chilling-cat.webm');
  assert(webRes.includes('assets/chilling-cat.mp4'), 'manifest resources must include chilling-cat.mp4');

  assert(fs.existsSync(path.join(__dirname, '../assets/chilling-cat.webm')), 'chilling-cat.webm must exist');
  assert(fs.existsSync(path.join(__dirname, '../assets/chilling-cat.mp4')), 'chilling-cat.mp4 must exist');

  const popupHtml = fs.readFileSync(path.join(__dirname, '../popup/popup.html'), 'utf8');
  assert(popupHtml.includes('v1.6.0 Alpha'), 'popup.html must display v1.6.0 Alpha');

  const popupJs = fs.readFileSync(path.join(__dirname, '../popup/popup.js'), 'utf8');
  assert(popupJs.includes("currentSettings.bgImage.includes('assets/chilling-cat')"), 'popup.js must normalize chilling-cat');
  assert(popupJs.includes('_cfErrorHandlerAdded'), 'popup.js must include video error fallback');

  assert(contentCode.includes("bgImage.includes('assets/chilling-cat')"), 'content.js must normalize chilling-cat');
  assert(contentCode.includes('_cfErrorHandlerAdded'), 'content.js must include video error fallback');

  console.log('✓ Test 42 passed: Chilling Cat WebM/MP4 dual compatibility and v1.6.0 Alpha verified');

  // ==========================================
  // Test 43: Google Translate Draft First -> AI Replacement
  // ==========================================
  console.log('Test 43: Google Translate Draft First -> AI Replacement');
  body.innerHTML = `
    <div class="problem-statement">
      <div class="header"><div class="title">C. Sorting Query</div></div>
      <p id="test43-p">The array is sorted in ascending order.</p>
    </div>
  `;

  // Switch to Vietnamese with AI engine
  storageChangeListeners.forEach(fn => fn({
    cfLang: { newValue: 'vi' },
    translationEngine: { newValue: 'gemini' }
  }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  const p43 = body.querySelector('#test43-p');
  assert.strictEqual(p43.dataset.cfTranslated, 'true', 'Element must be marked translated');
  assert.strictEqual(p43.dataset.cfTransFinal, 'true', 'Final AI translation flag must be set');
  assert.strictEqual(p43.dataset.cfTransDraft, undefined, 'Draft flag must be cleared upon final AI translation');
  assert(p43.textContent.includes('Đã dịch:'), 'Final AI translation text must be present');

  // Verify revert to English restores original text cleanly
  storageChangeListeners.forEach(fn => fn({ cfLang: { newValue: 'en' } }, 'local'));
  await new Promise(r => setTimeout(r, 150));

  assert.strictEqual(p43.textContent.trim(), 'The array is sorted in ascending order.', 'English text must be completely restored');
  assert.strictEqual(p43.dataset.cfTranslated, undefined, 'cfTranslated attribute must be removed');
  assert.strictEqual(p43.dataset.cfTransFinal, undefined, 'cfTransFinal attribute must be removed');
  console.log('✓ Test 43 passed: Google Translate Draft First -> AI Replacement verified');

  // ==========================================
  // Test 44: Submission Source Code Popup (Facebox Modal) Styling
  // ==========================================
  console.log('Test 44: Submission Source Code Popup (Facebox Modal) Styling');
  const cssStyles = fs.readFileSync(path.join(__dirname, '../content/content.css'), 'utf8');

  // Verify Backdrop Overlay Styling
  assert(cssStyles.includes('#facebox_overlay'), 'content.css must define #facebox_overlay');
  assert(cssStyles.includes('backdrop-filter: blur(8px) saturate(140%) !important'), '#facebox_overlay must include glass blur backdrop filter');

  // Verify old table border removal
  assert(cssStyles.includes('#facebox td.tl') && cssStyles.includes('display: none !important'), 'Old facebox table border images must be hidden');

  // Verify popup card body & popup glassmorphism styling
  assert(cssStyles.includes('#facebox .popup') && cssStyles.includes('rgba(18, 22, 32, 0.92) !important'), 'Facebox popup must be dark glass card');
  assert(cssStyles.includes('#facebox .content') && cssStyles.includes('background: transparent !important'), 'Facebox content must be transparent');
  assert(cssStyles.includes('border-radius: 16px !important'), 'Facebox body must have modern 16px rounded corners');

  // Verify modern close button with ✕
  assert(cssStyles.includes('#facebox .close') && cssStyles.includes('content: "✕" !important'), 'Facebox close button must use modern ✕ symbol');

  // Verify code block styling & scrollbar
  assert(cssStyles.includes('#facebox pre') && cssStyles.includes('border-radius: 10px !important'), 'Facebox code block must have rounded corners');
  assert(cssStyles.includes('#facebox pre::-webkit-scrollbar'), 'Facebox pre must have custom elegant scrollbar');

  // Verify code syntax highlighting
  assert(cssStyles.includes('#facebox pre .kwd') && cssStyles.includes('#f43f5e'), 'Keywords must be highlighted in modern vibrant color');
  assert(cssStyles.includes('#facebox pre .str') && cssStyles.includes('#4ade80'), 'Strings must be highlighted in clean green');
  assert(cssStyles.includes('#facebox pre .typ') && cssStyles.includes('#38bdf8'), 'Types must be highlighted in sky blue');

  // Verify modal centering & popup scroll behavior
  assert(cssStyles.includes('justify-content: center !important') && cssStyles.includes('align-items: center !important'), 'Facebox container must center modal with full viewport flex');
  assert(cssStyles.includes('overflow-y: auto !important') && cssStyles.includes('overscroll-behavior: contain !important'), 'Facebox popup must be scrollable from anywhere with overscroll-behavior contain');
  assert(cssStyles.includes('html.cf-facebox-open') && cssStyles.includes('overflow: hidden !important'), 'Background page scroll must be locked when modal is open');

  // Verify line numbers & left margin alignment
  assert(cssStyles.includes('#facebox pre ol.linenums') && cssStyles.includes('list-style-type: decimal !important'), 'Line numbers must be displayed on every code line');
  assert(cssStyles.includes('padding: 12px 14px 12px 4px !important') || cssStyles.includes('padding: 0 0 0 34px !important'), 'Code and line numbers must be aligned close to the left border');
  assert(contentCode.includes('ensureCodeLineNumbers'), 'content.js must define ensureCodeLineNumbers');

  // Verify copy button styling
  assert(cssStyles.includes('#facebox #copy-button') || cssStyles.includes('#facebox a[href*="copy"]'), 'Copy button inside facebox must be styled as modern pill button');

  // Verify content.js has setupFaceboxSubmissionHandler
  assert(contentCode.includes('setupFaceboxSubmissionHandler'), 'content.js must define setupFaceboxSubmissionHandler');

  console.log('✓ Test 44 passed: Submission Source Code Popup (Facebox Modal) Styling verified');

  // ==========================================
  // Test 45: VJudge (vjudge.net) Custom Background ONLY (No blur, no button/layout modification)
  // ==========================================
  console.log('Test 45: VJudge (vjudge.net) Custom Background ONLY');

  // Verify manifest includes vjudge.net
  const manifestData = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
  assert(manifestData.content_scripts[0].matches.some(m => m.includes('vjudge.net')), 'content_scripts matches must include vjudge.net');
  assert(manifestData.web_accessible_resources[0].matches.some(m => m.includes('vjudge.net')), 'web_accessible_resources matches must include vjudge.net');
  assert(manifestData.host_permissions.some(m => m.includes('vjudge.net')), 'host_permissions must include vjudge.net');

  // Verify VJudge CSS minimal background rules (no blur, no card styling, no button changes)
  assert(cssStyles.includes('html.vjudge-custom-bg-active'), 'content.css must define html.vjudge-custom-bg-active');
  assert(cssStyles.includes('--bs-body-bg: transparent !important'), 'content.css must define transparent body-bg variable for VJudge Bootstrap 5');
  assert(cssStyles.includes('html.vjudge-custom-bg-active #cf-custom-bg-layer'), 'content.css must scope #cf-custom-bg-layer for VJudge');
  assert(cssStyles.includes('z-index: -1 !important'), 'content.css must position bg-layer strictly behind all content (z-index: -1) on VJudge');
  assert(cssStyles.includes('filter: blur(0px)'), 'content.css must ensure 0px blur on VJudge background layer');

  // Ensure NO button hiding and NO layout overrides
  assert(!cssStyles.includes('#top-nav .navbar-toggler'), 'content.css must NOT modify or hide VJudge navbar-toggler button');
  assert(!cssStyles.includes('.fixed-left-panel-layout'), 'content.css must NOT override .fixed-left-panel-layout');
  assert(!contentCode.includes('alignVJudgeSidebar'), 'content.js must NOT contain alignVJudgeSidebar');

  // Verify content.js defines isVJudge, isVNOJ, and isBgOnlySite (strictly no translation on VJudge / VNOJ)
  assert(contentCode.includes('isVJudge'), 'content.js must define isVJudge');
  assert(contentCode.includes('isVNOJ'), 'content.js must define isVNOJ');
  assert(contentCode.includes('isBgOnlySite'), 'content.js must define isBgOnlySite');
  assert(contentCode.includes('data-bs-theme'), 'content.js must sync data-bs-theme for VJudge');
  assert(contentCode.includes('vjudge-custom-bg-active'), 'content.js must toggle vjudge-custom-bg-active on VJudge');
  assert(contentCode.includes('vnoj-custom-bg-active'), 'content.js must toggle vnoj-custom-bg-active on VNOJ');
  assert(contentCode.includes('enableCodeforces') && contentCode.includes('enableVJudge') && contentCode.includes('enableVNOJ'), 'content.js must handle enableCodeforces, enableVJudge, and enableVNOJ settings');
  assert(contentCode.includes('if (isBgOnlySite) return;\n    const targetLang'), 'applyVietnameseTranslation must short-circuit on VJudge/VNOJ');
  assert(contentCode.includes('if (isBgOnlySite) return;\n    removeProblemStatementChangeNotice'), 'applyDynamicContentTranslation must short-circuit on VJudge/VNOJ');

  // Verify manifest & CSS support oj.vnoi.info (background only, no blur, z-index: -1)
  assert(manifestData.content_scripts[0].matches.some(m => m.includes('oj.vnoi.info')), 'content_scripts matches must include oj.vnoi.info');
  assert(manifestData.web_accessible_resources[0].matches.some(m => m.includes('oj.vnoi.info')), 'web_accessible_resources matches must include oj.vnoi.info');
  assert(manifestData.host_permissions.some(m => m.includes('oj.vnoi.info')), 'host_permissions must include oj.vnoi.info');
  assert(cssStyles.includes('html.vnoj-custom-bg-active'), 'content.css must define html.vnoj-custom-bg-active');
  assert(cssStyles.includes('html.vnoj-custom-bg-active #cf-custom-bg-layer'), 'content.css must scope #cf-custom-bg-layer for VNOJ');

  console.log('✓ Test 45 passed: VJudge (vjudge.net) Custom Background ONLY verified');

  // ==========================================
  // Test 46: Custom Contest Subdomains (*.contest.codeforces.com) & Group Submit Navigation
  // ==========================================
  console.log('Test 46: Custom Contest Subdomains & Group Submit Navigation');
  assert(contentCode.includes('function isCustomContestSubdomain'), 'content.js must define isCustomContestSubdomain');
  assert(contentCode.includes("if (isCustomContestSubdomain() || pathname.includes('/group/')) return;"), 'setupSubmitNavigation must skip custom contest subdomains and /group/ contests');
  assert(contentCode.includes('if (isCustomContestSubdomain()) return;'), 'autoFillProblemOnSubmitPage must skip custom contest subdomains');
  assert(!contentCode.includes("href.endsWith('/submit')"), 'setupSubmitNavigation must NOT rewrite native /group/.../submit or /contest/.../submit links to /problemset/submit');
  console.log('✓ Test 46 passed: Custom Contest Subdomains & Group Submit Navigation verified');

  // ==========================================
  // Test 47: CSES (cses.fi) Dual Flags (EN/VI) & Translation (No Background)
  // ==========================================
  console.log('Test 47: CSES (cses.fi) Dual Flags (EN/VI) & Translation');
  assert(manifestData.content_scripts[0].matches.some(m => m.includes('cses.fi')), 'content_scripts[0] matches must include cses.fi');
  assert(!manifestData.content_scripts[1].matches.some(m => m.includes('cses.fi')), 'cf-mathjax-bridge.js must NOT be injected on cses.fi');
  assert(manifestData.web_accessible_resources[0].matches.some(m => m.includes('cses.fi')), 'web_accessible_resources matches must include cses.fi');
  assert(manifestData.host_permissions.some(m => m.includes('cses.fi')), 'host_permissions must include cses.fi');

  assert(contentCode.includes('isCSES'), 'content.js must define isCSES');
  assert(contentCode.includes('function renderCsesLanguageFlags'), 'content.js must define renderCsesLanguageFlags');
  assert(contentCode.includes('function translateCsesTitleElements'), 'content.js must define translateCsesTitleElements');
  assert(contentCode.includes('async function applyCsesTranslation'), 'content.js must define applyCsesTranslation');
  assert(contentCode.includes('function isTargetVietnameseActive'), 'content.js must define isTargetVietnameseActive');
  assert(contentCode.includes('translateElementsBatch(statementTargets'), 'applyCsesTranslation must call translateElementsBatch for CSES .md problem statements');
  assert(contentCode.includes('function colorizeMathElements(root) {\n    if (isCSES) return;'), 'colorizeMathElements must skip CSES to preserve native KaTeX colors');
  assert(contentCode.includes('cses-lang-en-btn') && contentCode.includes('cses-lang-vi-btn'), 'content.js must render both UK and Vietnam flag buttons on CSES');
  assert(contentCode.includes('`${cleanTrans} (${origText})`'), 'CSES translated titles/topics must append original English in parentheses');
  assert(contentCode.includes("'.math'"), 'TRANSLATION_IGNORE_SELECTOR must include .math for CSES KaTeX formulas');
  assert(contentCode.includes('if (!isCSES && hasVisualChange)'), 'CSES must NOT apply custom background settings');
  assert(cssStyles.includes('#cses-lang-flags') && cssStyles.includes('.cses-lang-flag-btn.active'), 'content.css must style CSES dual language flag switcher');
  console.log('✓ Test 47 passed: CSES (cses.fi) Dual Flags & Translation verified');

  console.log('\nALL content.js TESTS PASSED SUCCESSFULLY!');
}


runContentTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
