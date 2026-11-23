(() => {
  'use strict';

  function isExcludedPage() {
    try {
      const path = (window.location && window.location.pathname) ? window.location.pathname : '';
      if (/\/hacks\/[^\/]+\/test(?:\/|$)/i.test(path)) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  if (isExcludedPage()) {
    try {
      const docEl = document.documentElement;
      if (docEl) {
        docEl.classList.remove('cf-custom-bg-active');
        docEl.classList.remove('cf-dark-mode');
        docEl.classList.remove('cf-light-mode');
      }
      const layer = document.getElementById('cf-custom-bg-layer');
      if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    } catch (e) {}
    return;
  }

  let bgLayer = null;
  let bgImgEl = null;
  let bgVideoEl = null;
  let bgYtEl = null;

  function isCloudflareChallenge() {
    if (typeof window._cf_chl_opt !== 'undefined') return true;
    if (document.title && (
      document.title.includes('Just a moment') ||
      document.title.includes('Attention Required') ||
      document.title.includes('Cloudflare')
    )) {
      return true;
    }
    if (document.getElementById('challenge-running') || 
        document.getElementById('challenge-form') || 
        document.getElementById('challenge-stage') ||
        document.getElementById('cf-wrapper') ||
        document.getElementById('challenge-error-text') ||
        document.querySelector('.cf-turnstile') ||
        document.querySelector('[id*="challenge"]')) {
      return true;
    }
    if (document.querySelector('script[src*="challenge-platform"]')) {
      return true;
    }
    const mainWrap = document.querySelector('.main-wrapper > .main-content');
    if (mainWrap && !document.getElementById('header') && !document.getElementById('body')) {
      return true;
    }
    return false;
  }

  function teardownForCloudflare() {
    const docEl = document.documentElement;
    docEl.classList.remove('cf-custom-bg-active');
    docEl.classList.remove('cf-dark-mode');
    docEl.classList.remove('cf-light-mode');
    docEl.style.removeProperty('--cf-bg-url');
    docEl.style.removeProperty('--cf-bg-blur');
    docEl.style.removeProperty('--cf-bg-brightness');
    docEl.style.removeProperty('--cf-bg-overlay');
    docEl.style.removeProperty('--cf-bg-size');
    docEl.style.removeProperty('--cf-bg-repeat');
    docEl.style.removeProperty('--cf-bg-video-fit');
    docEl.style.removeProperty('--cf-glass-alpha');
    docEl.style.removeProperty('--cf-content-opacity');

    const layer = document.getElementById('cf-custom-bg-layer');
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    bgLayer = null;
    bgImgEl = null;
    bgVideoEl = null;
    bgYtEl = null;

    const themeBtn = document.getElementById('cf-theme-toggle-btn');
    if (themeBtn && themeBtn.parentNode) themeBtn.parentNode.removeChild(themeBtn);

    if (document.body) {
      document.body.style.removeProperty('background');
      document.body.style.removeProperty('background-color');
      document.body.style.removeProperty('color');
    }
  }

  function attachBgLayer() {
    if (isCloudflareChallenge()) return;
    if (!bgLayer || !document.body) return;
    if (bgLayer.parentNode !== document.body || document.body.firstChild !== bgLayer) {
      document.body.prepend(bgLayer);
    }
  }

  function ensureBgLayer() {
    if (isCloudflareChallenge()) return null;
    if (!document.body) {
      return null;
    }

    if (bgLayer && bgLayer.parentNode === document.body) {
      return { bgLayer, bgImgEl, bgVideoEl, bgYtEl };
    }

    let existing = document.getElementById('cf-custom-bg-layer');
    if (existing) {
      bgLayer = existing;
      bgImgEl = existing.querySelector('.cf-bg-img');
      bgVideoEl = existing.querySelector('.cf-bg-video');
      bgYtEl = existing.querySelector('.cf-bg-youtube');
      attachBgLayer();
      return { bgLayer, bgImgEl, bgVideoEl, bgYtEl };
    }

    bgLayer = document.createElement('div');
    bgLayer.id = 'cf-custom-bg-layer';
    bgLayer.setAttribute('aria-hidden', 'true');

    bgImgEl = document.createElement('div');
    bgImgEl.className = 'cf-bg-img';

    bgVideoEl = document.createElement('video');
    bgVideoEl.className = 'cf-bg-video';
    bgVideoEl.autoplay = true;
    bgVideoEl.loop = true;
    bgVideoEl.muted = true;
    bgVideoEl.defaultMuted = true;
    bgVideoEl.playsInline = true;
    bgVideoEl.setAttribute('autoplay', '');
    bgVideoEl.setAttribute('loop', '');
    bgVideoEl.setAttribute('muted', '');
    bgVideoEl.setAttribute('playsinline', '');

    bgYtEl = document.createElement('iframe');
    bgYtEl.className = 'cf-bg-youtube';
    bgYtEl.setAttribute('frameborder', '0');
    bgYtEl.setAttribute('allow', 'autoplay; encrypted-media');
    bgYtEl.setAttribute('tabindex', '-1');
    bgYtEl.setAttribute('aria-hidden', 'true');

    const overlayEl = document.createElement('div');
    overlayEl.className = 'cf-bg-overlay';

    bgLayer.appendChild(bgImgEl);
    bgLayer.appendChild(bgVideoEl);
    bgLayer.appendChild(bgYtEl);
    bgLayer.appendChild(overlayEl);

    document.body.prepend(bgLayer);

    return { bgLayer, bgImgEl, bgVideoEl, bgYtEl };
  }

  // Auto-resume background video if tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && bgVideoEl && bgVideoEl.style.display !== 'none' && bgVideoEl.paused) {
      bgVideoEl.play().catch(() => {});
    }
  });

  function extractYouTubeId(url) {
    if (!url || typeof url !== 'string') return null;
    const regExp = /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  }

  function getYouTubeEmbedUrl(videoId) {
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&iv_load_policy=3&disablekb=1&modestbranding=1&playsinline=1&enablejsapi=1`;
  }

  const DEFAULT_BG = chrome.runtime.getURL('assets/default-bg.mp4');

  function isVideoSource(type, url) {
    if (type === 'video') return true;
    if (type === 'image') return false;
    if (!url || typeof url !== 'string') return false;
    if (url.includes('assets/default-bg.mp4')) return true;
    if (url.startsWith('data:video/')) return true;
    return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url);
  }

  let lastSettings = null;
  let bodyWaitRegistered = false;

  function applySettings(settings) {
    if (isCloudflareChallenge()) return;
    lastSettings = settings;
    let {
      enabled = true,
      bgType = 'video',
      bgImage = DEFAULT_BG,
      bgHistory = [],
      blur = 0,
      brightness = 100,
      overlay = 0,
      contentOpacity = 16,
      bgSize = 'cover',
      themeMode = 'dark'
    } = settings || {};

    // If bgImage is empty or was the YouTube 784dsKVrdjQ link, use the downloaded 1080p video
    if (!bgImage || (typeof bgImage === 'string' && bgImage.includes('784dsKVrdjQ'))) {
      bgImage = DEFAULT_BG;
      bgType = 'video';
    }

    const docEl = document.documentElement;

    if (!enabled || !bgImage) {
      docEl.classList.remove('cf-custom-bg-active');
      docEl.classList.remove('cf-dark-mode');
      docEl.classList.remove('cf-light-mode');
      docEl.style.removeProperty('--cf-bg-url');
      docEl.style.removeProperty('--cf-bg-blur');
      docEl.style.removeProperty('--cf-bg-brightness');
      docEl.style.removeProperty('--cf-bg-overlay');
      docEl.style.removeProperty('--cf-bg-size');
      docEl.style.removeProperty('--cf-bg-repeat');
      docEl.style.removeProperty('--cf-bg-video-fit');
      docEl.style.removeProperty('--cf-glass-alpha');
      docEl.style.removeProperty('--cf-content-opacity');

      const themeBtn = document.getElementById('cf-theme-toggle-btn');
      if (themeBtn && themeBtn.parentNode) {
        themeBtn.parentNode.removeChild(themeBtn);
      }

      if (bgYtEl) {
        bgYtEl.removeAttribute('src');
      }

      if (bgVideoEl) {
        bgVideoEl.pause();
        bgVideoEl.removeAttribute('src');
      }

      if (bgLayer && bgLayer.parentNode) {
        bgLayer.parentNode.removeChild(bgLayer);
        bgLayer = null;
        bgImgEl = null;
        bgVideoEl = null;
        bgYtEl = null;
      }
      return;
    }

    // Calculate glass alpha strictly between 0.05 and 0.32 so it is NEVER opaque white
    let alpha = 0.16;
    if (typeof contentOpacity === 'number') {
      if (contentOpacity > 40) {
        alpha = 0.16;
      } else {
        alpha = Math.max(0.05, Math.min(0.32, contentOpacity / 100));
      }
    }

    // Set common CSS custom properties on documentElement immediately
    docEl.style.setProperty('--cf-bg-blur', `${blur}px`);
    docEl.style.setProperty('--cf-bg-brightness', `${brightness / 100}`);
    docEl.style.setProperty('--cf-bg-overlay', `${overlay / 100}`);
    docEl.style.setProperty('--cf-glass-alpha', `${alpha}`);
    docEl.style.setProperty('--cf-content-opacity', `${alpha}`);

    // If document.body is not yet created by the parser, wait for it
    if (!document.body) {
      if (!bodyWaitRegistered) {
        bodyWaitRegistered = true;
        document.addEventListener('DOMContentLoaded', () => {
          if (!isCloudflareChallenge() && lastSettings) {
            applySettings(lastSettings);
          }
        }, { once: true });
      }
      return;
    }

    // Activate custom background class
    docEl.classList.add('cf-custom-bg-active');

    // Apply Dark Reader or Light mode
    const isDark = themeMode !== 'light';
    docEl.classList.toggle('cf-dark-mode', isDark);
    docEl.classList.toggle('cf-light-mode', !isDark);
    renderThemeToggle(isDark ? 'dark' : 'light');

    // Ensure layer elements exist inside document.body
    ensureBgLayer();

    // If bgImage is a direct local cache reference (e.g. cf_cache_12345), resolve it immediately
    if (bgImage && typeof bgImage === 'string' && bgImage.startsWith('cf_cache_')) {
      chrome.storage.local.get([bgImage], (res) => {
        const cachedMedia = res && res[bgImage];
        if (cachedMedia && lastSettings) {
          applySettings({ ...lastSettings, bgImage: cachedMedia });
        }
      });
      return;
    }

    const ytId = extractYouTubeId(bgImage);
    const isYouTube = bgType === 'youtube' || Boolean(ytId);
    const isVideo = isYouTube ? false : isVideoSource(bgType, bgImage);

    // If online video/image has a cached local copy, seamlessly upgrade to cached local copy
    if (!isYouTube && bgImage && bgImage.startsWith('http')) {
      const historyItem = (bgHistory || []).find(h => h.url === bgImage || (h.id && bgImage.includes(h.id)));
      if (historyItem) {
        if (historyItem.hasCache) {
          chrome.storage.local.get(['cf_cache_' + historyItem.id], (res) => {
            const cached = res['cf_cache_' + historyItem.id];
            if (cached) {
              if (isVideo && bgVideoEl) {
                // If video is not currently playing, use cached local file immediately
                if (bgVideoEl.paused || !bgVideoEl.currentTime) {
                  if (bgVideoEl.src !== cached) {
                    bgVideoEl.src = cached;
                    bgVideoEl._cfMediaUrl = bgImage;
                    bgVideoEl.load();
                    bgVideoEl.play().catch(() => {});
                  }
                } else {
                  // If video is actively playing on screen, NEVER cut it off mid-playback.
                  // Stage cached copy to seamlessly take over on next loop.
                  bgVideoEl._cfPendingCacheSrc = cached;
                }
              } else if (!isVideo && !isYouTube) {
                docEl.style.setProperty('--cf-bg-url', `url("${cached}")`);
              }
            }
          });
        } else {
          // First time loading from network: trigger background caching for subsequent visits
          try {
            chrome.runtime.sendMessage({
              action: 'cacheMedia',
              id: historyItem.id,
              url: bgImage,
              type: isVideo ? 'video' : 'image'
            });
          } catch (e) {}
        }
      }
    }

    if (isYouTube && ytId) {
      // Setup YouTube Iframe Background
      if (bgImgEl) bgImgEl.style.display = 'none';
      if (bgVideoEl) {
        bgVideoEl.style.display = 'none';
        bgVideoEl.pause();
      }
      if (bgYtEl) {
        bgYtEl.style.display = 'block';
        const embedUrl = getYouTubeEmbedUrl(ytId);
        if (bgYtEl.src !== embedUrl) {
          bgYtEl.src = embedUrl;
        }
      }
    } else if (isVideo) {
      // Setup Video background
      if (bgYtEl) {
        bgYtEl.style.display = 'none';
        bgYtEl.removeAttribute('src');
      }
      if (bgImgEl) bgImgEl.style.display = 'none';
      if (bgVideoEl) {
        bgVideoEl.style.display = 'block';
        const videoFit = bgSize === 'contain' ? 'contain' : 'cover';
        docEl.style.setProperty('--cf-bg-video-fit', videoFit);
        bgVideoEl.style.objectFit = videoFit;

        const isCurrentSameSrc = (bgVideoEl.src === bgImage) ||
          (bgVideoEl._cfMediaUrl && (bgVideoEl._cfMediaUrl === bgImage || (lastSettings && lastSettings.bgImageOriginal === bgVideoEl._cfMediaUrl)));

        if (!isCurrentSameSrc) {
          bgVideoEl.src = bgImage;
          bgVideoEl._cfMediaUrl = bgImage;
          bgVideoEl.load();
        }
        bgVideoEl.muted = true;
        bgVideoEl.defaultMuted = true;
        bgVideoEl.loop = true;
        bgVideoEl.autoplay = true;
        bgVideoEl.playsInline = true;
        bgVideoEl.play().catch(() => {});

        if (!bgVideoEl._cfLoopListenerAdded) {
          bgVideoEl._cfLoopListenerAdded = true;
          bgVideoEl.addEventListener('ended', () => {
            if (bgVideoEl._cfPendingCacheSrc) {
              bgVideoEl.src = bgVideoEl._cfPendingCacheSrc;
              bgVideoEl._cfPendingCacheSrc = null;
              bgVideoEl.load();
              bgVideoEl.play().catch(() => {});
            }
          });
        }
      }
    } else {
      // Setup Image background
      if (bgYtEl) {
        bgYtEl.style.display = 'none';
        bgYtEl.removeAttribute('src');
      }
      if (bgVideoEl) {
        bgVideoEl.style.display = 'none';
        bgVideoEl.pause();
      }
      if (bgImgEl) {
        bgImgEl.style.display = 'block';
      }

      docEl.style.setProperty('--cf-bg-url', `url("${bgImage}")`);

      if (bgSize === 'repeat') {
        docEl.style.setProperty('--cf-bg-size', 'auto');
        docEl.style.setProperty('--cf-bg-repeat', 'repeat');
      } else {
        docEl.style.setProperty('--cf-bg-size', bgSize);
        docEl.style.setProperty('--cf-bg-repeat', 'no-repeat');
      }
    }

    replaceCodeforcesLogo(themeMode);
  }

  // =========================================================
  // Replace Codeforces Header Logo with Transparent Logo
  // In Dark Mode, use codeforces-logo-dark.png (white text)
  // In Light Mode, use codeforces-logo.png (dark text)
  // =========================================================

  function replaceCodeforcesLogo(themeMode) {
    try {
      const mode = themeMode || (lastSettings && lastSettings.themeMode) || 'dark';
      const isDark = mode === 'dark';
      const logoFile = isDark ? 'codeforces-logo-dark.png' : 'codeforces-logo.png';
      const logoUrl = chrome.runtime.getURL(logoFile);
      const header = document.getElementById('header') || document;
      const selectors = [
        '#header a[href="/"] img',
        '#header a[href*="codeforces"] img',
        '#header img[title*="Codeforces"]',
        '#header img[alt*="Codeforces"]',
        '#header img[src*="codeforces-sponsored"]',
        '#header img[src*="codeforces-logo"]',
        '#header img[src*="codeforces.png"]',
        'img[src*="codeforces-sponsored"]'
      ];

      const logos = header.querySelectorAll(selectors.join(','));
      logos.forEach(img => {
        if (!img.src || !img.src.includes(logoFile)) {
          img.src = logoUrl;
          img.removeAttribute('srcset');
          img.style.setProperty('max-height', '65px', 'important');
          img.style.setProperty('height', 'auto', 'important');
          img.style.setProperty('width', 'auto', 'important');
          img.style.setProperty('background', 'transparent', 'important');
          img.style.setProperty('background-color', 'transparent', 'important');
          img.style.setProperty('border', 'none', 'important');
          img.style.setProperty('box-shadow', 'none', 'important');
        }
      });

      const headerDiv = document.querySelector('#header > div:first-child, #header ._logo_div');
      if (headerDiv) {
        headerDiv.style.setProperty('background', 'transparent', 'important');
        headerDiv.style.setProperty('background-color', 'transparent', 'important');
      }
    } catch (e) {
      // Ignore
    }
  }

  // =========================================================
  // Streak Tracker based on userActivityGraph & Codeforces API
  // =========================================================

  let activeDetailCard = null;

  function toLocalDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function findLoggedInUser() {
    const header = document.getElementById('header');
    if (!header) return null;

    // 1. Look in .lang-chooser
    const langChooser = header.querySelector('.lang-chooser');
    if (langChooser) {
      const links = langChooser.querySelectorAll('a[href*="/profile/"]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/profile\/([a-zA-Z0-9_\-\.]+)/i);
        if (match) {
          const handle = match[1];
          if (!['enter', 'register', 'logout'].includes(handle.toLowerCase())) {
            return handle;
          }
        }
      }
    }

    // 2. Look anywhere in header for profile link accompanied by logout
    const allLinks = header.querySelectorAll('a[href*="/profile/"]');
    for (const link of allLinks) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/profile\/([a-zA-Z0-9_\-\.]+)/i);
      if (match) {
        const handle = match[1];
        if (!['enter', 'register', 'logout'].includes(handle.toLowerCase())) {
          return handle;
        }
      }
    }

    return null;
  }

  function parseDatesAndCountsFromProfileScripts() {
    const counts = {};
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const content = s.textContent || '';
      if (content.includes('userActivityGraph') || content.includes('DataTable')) {
        const dateRegex = /new\s+Date\s*\(\s*(\d{4})\s*,\s*(\d+)\s*,\s*(\d+)\s*\)(?:\s*,\s*(\d+))?/g;
        let match;
        while ((match = dateRegex.exec(content)) !== null) {
          const y = parseInt(match[1], 10);
          const m = parseInt(match[2], 10) + 1;
          const d = parseInt(match[3], 10);
          const c = match[4] ? parseInt(match[4], 10) : 1;
          const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          counts[dStr] = Math.max(counts[dStr] || 0, c);
        }
      }
    }

    const graph = document.getElementById('userActivityGraph');
    if (graph) {
      const rects = graph.querySelectorAll('rect');
      rects.forEach(r => {
        const d = r.getAttribute('data-date');
        const countAttr = r.getAttribute('data-count');
        const c = countAttr ? parseInt(countAttr, 10) : 1;
        if (d) {
          counts[d] = Math.max(counts[d] || 0, isNaN(c) ? 1 : c);
        }
      });
    }

    return counts;
  }

  function computeStreak(countByDate) {
    const now = new Date();
    const todayStr = toLocalDateStr(now);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = toLocalDateStr(yesterday);

    const hasSubmittedToday = Boolean(countByDate[todayStr] && countByDate[todayStr] > 0);
    const hasSubmittedYesterday = Boolean(countByDate[yesterdayStr] && countByDate[yesterdayStr] > 0);

    let currentStreak = 0;
    let streakSubmissionsCount = 0;

    if (hasSubmittedToday) {
      let cur = new Date(now.getTime());
      while (countByDate[toLocalDateStr(cur)] > 0) {
        currentStreak++;
        streakSubmissionsCount += countByDate[toLocalDateStr(cur)];
        cur = new Date(cur.getTime() - 24 * 60 * 60 * 1000);
      }
    } else if (hasSubmittedYesterday) {
      // Streak alive from yesterday, but today not yet submitted
      let cur = new Date(yesterday.getTime());
      while (countByDate[toLocalDateStr(cur)] > 0) {
        currentStreak++;
        streakSubmissionsCount += countByDate[toLocalDateStr(cur)];
        cur = new Date(cur.getTime() - 24 * 60 * 60 * 1000);
      }
    } else {
      currentStreak = 0;
      streakSubmissionsCount = 0;
    }

    // Max streak calculation
    const activeDates = Object.keys(countByDate).filter(d => countByDate[d] > 0).sort();
    let maxStreak = 0;
    let tempStreak = 0;
    let prev = null;

    for (const dStr of activeDates) {
      const [y, m, d] = dStr.split('-').map(Number);
      const curDate = new Date(y, m - 1, d);

      if (!prev) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((curDate - prev) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      maxStreak = Math.max(maxStreak, tempStreak);
      prev = curDate;
    }

    return {
      currentStreak,
      streakSubmissionsCount,
      maxStreak,
      hasSubmittedToday,
      hasSubmittedYesterday,
      totalActiveDays: activeDates.length,
      lastChecked: now.getTime(),
      todayStr
    };
  }

  async function updateStreakForHandle(handle, forceFetch = false) {
    if (!handle || isCloudflareChallenge()) return null;

    // Check storage cache
    const stored = await new Promise(res => {
      chrome.storage.local.get(['cfStreak'], r => res(r.cfStreak || null));
    });

    const isCurrentHandle = stored && stored.handle === handle;
    const isRecent = stored && (Date.now() - stored.lastChecked < 30 * 60 * 1000); // 30 mins cache

    if (isCurrentHandle && isRecent && !forceFetch) {
      renderStreakBadge(stored);
      return stored;
    }

    // Combine counts from profile graph and Codeforces API
    const countByDate = parseDatesAndCountsFromProfileScripts();

    try {
      const res = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=1000`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && Array.isArray(data.result)) {
          for (const sub of data.result) {
            if (sub.creationTimeSeconds) {
              const d = new Date(sub.creationTimeSeconds * 1000);
              const dStr = toLocalDateStr(d);
              countByDate[dStr] = (countByDate[dStr] || 0) + 1;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Codeforces API fetch error:', e);
      if (stored) {
        renderStreakBadge(stored);
        return stored;
      }
    }

    const streakData = computeStreak(countByDate);
    streakData.handle = handle;

    chrome.storage.local.set({ cfStreak: streakData });
    renderStreakBadge(streakData);
    return streakData;
  }

  function renderThemeToggle(themeMode) {
    if (isCloudflareChallenge()) return;
    const header = document.getElementById('header');
    if (!header) return;

    let btn = document.getElementById('cf-theme-toggle-btn');
    const isDark = themeMode !== 'light';
    const icon = isDark ? '🌙' : '☀️';
    const title = isDark ? 'Đang bật Giao diện Tối (Dark Reader). Bấm để chuyển sang Sáng' : 'Đang bật Giao diện Sáng. Bấm để chuyển sang Tối (Dark Reader)';

    if (!btn) {
      btn = document.createElement('span');
      btn.id = 'cf-theme-toggle-btn';
      btn.className = 'cf-theme-toggle-btn';
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        chrome.storage.local.get(['themeMode'], (res) => {
          const current = res.themeMode || 'dark';
          const next = current === 'dark' ? 'light' : 'dark';
          chrome.storage.local.set({ themeMode: next });
        });
      };
    }

    btn.textContent = icon;
    btn.title = title;

    const streakBadge = document.getElementById('cf-header-streak');
    if (streakBadge && streakBadge.parentNode) {
      if (btn.nextSibling !== streakBadge) {
        streakBadge.insertAdjacentElement('beforebegin', btn);
      }
    } else {
      const profileLink = header.querySelector('a[href*="/profile/"]');
      if (profileLink && btn.nextSibling !== profileLink) {
        profileLink.insertAdjacentElement('beforebegin', btn);
      }
    }
  }

  // =========================================================
  // Vietnamese Language Flag & UI Translation Engine
  // =========================================================

  let currentCfLang = 'vi';
  let currentTranslationEngine = 'google';
  let currentGeminiApiKey = '';
  let currentGeminiModel = 'auto';
  let currentGeminiCustomModel = '';
  let translateObserver = null;
  let translateDebounceTimer = null;
  let currentTranslationSession = 1;
  const contentTranslationCache = new Map();

  function getCachedTranslation(key) {
    if (!key) return null;
    return contentTranslationCache.get(`${currentTranslationEngine}:${key}`) || null;
  }

  function setCachedTranslation(key, val) {
    if (!key || !val) return;
    if (contentTranslationCache.size >= 2500) {
      const oldestKey = contentTranslationCache.keys().next().value;
      contentTranslationCache.delete(oldestKey);
    }
    contentTranslationCache.set(`${currentTranslationEngine}:${key}`, val);
  }

  // Selective exclusion rules for machine translation (Google Translate / Gemini)
  const TRANSLATION_IGNORE_SELECTOR = [
    // Basic tags
    'meta', 'link', 'script', 'noscript', 'style', 'code', 'pre', 'textarea', 'time', 'kbd',
    'svg', 'g', 'ruby', 'rt', 'rp', 'math', 'd-math', 'samp',
    'img', 'video', 'audio', 'iframe', 'canvas', 'picture', 'br',
    // Elements requesting to disable translation
    '.notranslate', '[contenteditable="true"]', '[translate=no]',
    // Social sharing buttons
    '.social-share', '.share-nav', '[data-toolbar=share]', '.o-share',
    // Code elements
    '.prism-code', '.enlighter-code', '.rc-CodeBlock', '[role=code]', 'table.highlight',
    // Navigation, tabs, pagination & interactive widgets
    '.pagination', '.second-level-menu', '.second-level-menu-list', '.round-box-tab', '[role="tab"]', '[role="tablist"]',
    'button', '[role="button"]',
    // Hypothesis
    'hypothesis-highlight', '.hypothesis-highlight',
    // Icons
    '.material-icons', 'material-icon', 'span[class^="material-symbols-"]', '.google-symbols', 'i.fa', 'i[class^="fa-"]',
    // Math, Formulas & TeX
    'visuallyhidden', '.visuallyhidden', '.MathJax', '.MathJax_Preview', '.MathJax_Display', '.katex', '.mwe-math-element', 'mjx-container',
    'tex-span', '.tex-span', 'mjx-math', '.tex-formula', 'script[type*="math"]',
    // Codeforces specific interactive & excluded components
    '.sample-test', '.input', '.output', '.test-example-line',
    'a[href*="/profile/"]', 'a[class*="user-"]', 'a[class*="rated-"]', '[class*="user-"]', '[class*="rated-"]', '.rated-user',
    '#cf-theme-toggle-btn', '#cf-header-streak', '#cf-lang-vn-btn',
    '.cf-translate-toggle-btn', '.cf-problem-translate-bar', '.cf-topic-translate-bar', '.cf-comment-trans-link',
    // Problem index columns (A, B, C, D...)
    'td.id', 'th.id', '.id.left', 'td.id.left', 'th.id.left', 'table.problems td.id', 'table.problems th.id', 'table.rtable td.id', 'table.rtable th.id'
  ].join(', ');


  function renderVietnameseFlag(cfLang) {
    if (isCloudflareChallenge()) return;
    const header = document.getElementById('header');
    if (!header) return;

    const langChooser = header.querySelector('.lang-chooser');
    if (!langChooser) return;

    const flagContainer = langChooser.querySelector('div:first-child') || langChooser;

    const lang = cfLang !== undefined ? cfLang : currentCfLang;
    currentCfLang = lang;
    const isVi = lang === 'vi';

    let btn = document.getElementById('cf-lang-vn-btn');
    if (!btn) {
      btn = document.createElement('a');
      btn.id = 'cf-lang-vn-btn';
      btn.href = 'javascript:void(0)';

      const img = document.createElement('img');
      img.src = chrome.runtime.getURL('assets/vietnam.png');
      img.alt = 'Tiếng Việt';
      btn.appendChild(img);
    }

    // Luôn chuyển sang Tiếng Việt khi bấm cờ Việt Nam (không toggle)
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentCfLang !== 'vi') {
        currentCfLang = 'vi';
        chrome.storage.local.set({ cfLang: 'vi' });
        btn.className = 'active';
        btn.title = 'Giao diện Tiếng Việt';
        applyVietnameseTranslation(true);
      }
    };

    const img = btn.querySelector('img');
    if (img) {
      const targetSrc = chrome.runtime.getURL('assets/vietnam.png');
      if (!img.src || !img.src.includes('vietnam.png')) {
        img.src = targetSrc;
      }
      img.style.setProperty('width', '24.5px', 'important');
      img.style.setProperty('height', '16.5px', 'important');
      img.style.setProperty('max-width', '24.5px', 'important');
      img.style.setProperty('max-height', '16.5px', 'important');
      img.style.setProperty('object-fit', 'cover', 'important');
      img.style.setProperty('vertical-align', 'middle', 'important');
    }

    btn.style.setProperty('display', 'inline-block', 'important');
    btn.style.setProperty('vertical-align', 'middle', 'important');
    btn.style.setProperty('position', 'relative', 'important');
    btn.style.setProperty('top', '-0.5px', 'important');
    btn.style.setProperty('margin-left', '4px', 'important');
    btn.style.setProperty('cursor', 'pointer', 'important');
    btn.style.setProperty('line-height', '1', 'important');

    btn.className = isVi ? 'active' : '';
    btn.title = isVi ? 'Giao diện Tiếng Việt' : 'Chuyển sang Tiếng Việt';

    const ruLink = langChooser.querySelector('a[href*="locale=ru"]') || langChooser.querySelector('a[href*="locale="]:last-of-type');
    if (ruLink && ruLink.parentNode) {
      if (btn.previousElementSibling !== ruLink) {
        ruLink.insertAdjacentElement('afterend', btn);
      }
    } else if (!btn.parentNode) {
      flagContainer.appendChild(btn);
    }

    // Khi bấm vào cờ Anh hoặc Nga, chuyển về chế độ gốc (tắt giao diện Tiếng Việt)
    const otherFlags = langChooser.querySelectorAll('a[href*="locale="]');
    otherFlags.forEach(link => {
      link.style.setProperty('display', 'inline-block', 'important');
      link.style.setProperty('vertical-align', 'middle', 'important');
      const otherImg = link.querySelector('img');
      if (otherImg) {
        otherImg.style.setProperty('vertical-align', 'middle', 'important');
      }
      if (!link.dataset.cfLangHooked) {
        link.dataset.cfLangHooked = 'true';
        link.addEventListener('click', () => {
          currentCfLang = 'en';
          chrome.storage.local.set({ cfLang: 'en' });
          const vnBtn = document.getElementById('cf-lang-vn-btn');
          if (vnBtn) {
            vnBtn.className = '';
            vnBtn.title = 'Chuyển sang Tiếng Việt';
          }
          applyVietnameseTranslation(false);
        });
      }
    });
  }

  function translateNode(node, enable, dict) {
    if (!node) return;

    if (node.nodeType === Node.ELEMENT_NODE) {
      // Exclude posts, comments, problem statement, codeblocks, math, user handles, problem index columns
      if (node.matches && (
        node.matches('.problem-statement, .sample-test, .topic, .blog-entry, .comment, .comments, .comment-table, pre, code, .ace_editor, .katex, math, a[href*="/profile/"], [class*="user-"], [class*="rated-"], #cf-theme-toggle-btn, #cf-header-streak, #cf-lang-vn-btn, .cf-comment-trans-link, .cf-problem-translate-bar, .cf-topic-translate-bar, td.id, th.id, .id.left, td.id.left, th.id.left, table.problems td.id, table.problems th.id, table.rtable td.id, table.rtable th.id')
      )) {
        return;
      }
      if (node.closest && (
        node.closest('.problem-statement, .sample-test, .topic, .blog-entry, .comment, .comments, .comment-table, pre, code, .ace_editor, .katex, math, a[href*="/profile/"], [class*="user-"], [class*="rated-"], td.id, th.id, .id.left, td.id.left, th.id.left, table.problems td.id, table.problems th.id, table.rtable td.id, table.rtable th.id')
      )) {
        return;
      }

      // Input placeholders & submit buttons
      if (node.tagName === 'INPUT') {
        if (!enable) {
          if (node.dataset.cfOrigVal) {
            node.value = node.dataset.cfOrigVal;
            delete node.dataset.cfOrigVal;
          }
          if (node.dataset.cfOrigPh) {
            node.setAttribute('placeholder', node.dataset.cfOrigPh);
            delete node.dataset.cfOrigPh;
          }
          return;
        }
        const val = (node.value || '').replace(/\u00A0/g, ' ').trim();
        const normVal = val.replace(/\s+/g, ' ');
        const transVal = dict[val] || dict[normVal] || dict[val.toLowerCase()];
        if (transVal) {
          if (!node.dataset.cfOrigVal) node.dataset.cfOrigVal = node.value;
          node.value = transVal;
        }
        const ph = (node.getAttribute('placeholder') || '').replace(/\u00A0/g, ' ').trim();
        const normPh = ph.replace(/\s+/g, ' ');
        const transPh = dict[ph] || dict[normPh] || dict[ph.toLowerCase()];
        if (transPh) {
          if (!node.dataset.cfOrigPh) node.dataset.cfOrigPh = ph;
          node.setAttribute('placeholder', transPh);
        }
        return;
      }

      // Buttons
      if (node.tagName === 'BUTTON') {
        if (!enable) {
          if (node.dataset.cfOrigText) {
            node.textContent = node.dataset.cfOrigText;
            delete node.dataset.cfOrigText;
          }
        } else {
          const btnVal = (node.textContent || node.value || '').replace(/\u00A0/g, ' ').trim();
          const transBtn = dict[btnVal] || dict[btnVal.toLowerCase()];
          if (transBtn) {
            if (!node.dataset.cfOrigText) node.dataset.cfOrigText = node.textContent;
            node.textContent = transBtn;
          }
        }
      }

      // Select dropdown options
      if (node.tagName === 'OPTION') {
        if (!enable) {
          if (node.dataset.cfOrigText) {
            node.textContent = node.dataset.cfOrigText;
            delete node.dataset.cfOrigText;
          }
        } else {
          const optVal = (node.textContent || '').replace(/\u00A0/g, ' ').trim();
          const transOpt = dict[optVal] || dict[optVal.replace(/:$/, '')] || dict[optVal.toLowerCase()];
          if (transOpt) {
            if (!node.dataset.cfOrigText) node.dataset.cfOrigText = node.textContent;
            node.textContent = transOpt;
          }
        }
      }
    }

    if (node.nodeType === Node.TEXT_NODE) {
      if (enable) {
        if (node._cfOrigText !== undefined) return;
        const text = node.nodeValue.replace(/\u00A0/g, ' ').trim();
        if (!text) return;
        const normalized = text.replace(/\s+/g, ' ');
        const normalizedApos = normalized.replace(/[\u2018\u2019]/g, "'");
        const translated = dict[text] || dict[normalized] || dict[normalizedApos] || dict[text.toLowerCase()] || dict[normalized.toLowerCase()] || dict[normalizedApos.toLowerCase()];
        if (translated) {
          node._cfOrigText = node.nodeValue;
          const matchLeading = node.nodeValue.match(/^\s*/);
          const matchTrailing = node.nodeValue.match(/\s*$/);
          const leading = matchLeading ? matchLeading[0] : '';
          const trailing = matchTrailing ? matchTrailing[0] : '';
          node.nodeValue = leading + translated + trailing;
        }
      } else {
        if (node._cfOrigText !== undefined) {
          node.nodeValue = node._cfOrigText;
          delete node._cfOrigText;
        }
      }
      return;
    }

    let child = node.firstChild;
    while (child) {
      const next = child.nextSibling;
      translateNode(child, enable, dict);
      child = next;
    }
  }

  // =========================================================
  // Dynamic Content Translator (Problem, Blog Posts & Comments)
  // Preserving math, code, tags, and formatting via placeholder masking
  // =========================================================

  let typesetTimer = null;
  const typesetTargets = new Set();

  function colorizeMathElements(root) {
    try {
      const container = root || document;
      const isLight = document.documentElement.classList.contains('cf-light-mode');
      const mathColor = isLight ? '#0f172a' : '#f1f5f9';
      const els = container.querySelectorAll(
        '.MathJax, .MathJax *, .MathJax_Display, .MathJax_Display *, .mjx-chtml, .mjx-chtml *, mjx-container, mjx-container *, .katex, .katex *, .tex-span, .tex-span *, .tex-formula, .tex-formula *, math, math *'
      );
      els.forEach(el => {
        if (el.style && el.style.setProperty) {
          el.style.setProperty('color', mathColor, 'important');
          el.style.setProperty('fill', mathColor, 'important');
          el.style.setProperty('stroke', mathColor, 'important');
          el.style.setProperty('text-shadow', 'none', 'important');
        }
      });
    } catch (e) {
      // Ignore
    }
  }

  // Ensure math remains bright on tab switch, window focus, or resize
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('focus', () => {
      colorizeMathElements();
    });
    window.addEventListener('resize', () => {
      colorizeMathElements();
    });
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        colorizeMathElements();
      }
    });
  }

  function typesetMath(container) {
    const el = container || document.querySelector('.problem-statement') || document.body;
    if (el) {
      if (!el.id) {
        el.id = 'cf-math-' + Math.random().toString(36).substring(2, 9);
      }
      typesetTargets.add(el.id);
    }

    // Immediately enforce bright math styling on any already-rendered math
    colorizeMathElements(document);

    if (typesetTimer) clearTimeout(typesetTimer);
    typesetTimer = setTimeout(() => {
      const ids = Array.from(typesetTargets);
      typesetTargets.clear();

      // 1. Dispatch custom event to MAIN world bridge (unrestricted by CSP)
      ids.forEach(id => {
        try {
          window.dispatchEvent(new CustomEvent('cf-typeset-math', { detail: { targetId: id } }));
          document.dispatchEvent(new CustomEvent('cf-typeset-math', { detail: { targetId: id } }));
        } catch (e) {}
      });

      // 2. Direct injection fallback with nonce preservation
      try {
        const script = document.createElement('script');
        const existingScript = document.querySelector('script[nonce]');
        if (existingScript && existingScript.nonce) {
          script.nonce = existingScript.nonce;
        } else if (existingScript && existingScript.getAttribute('nonce')) {
          script.setAttribute('nonce', existingScript.getAttribute('nonce'));
        }

        script.textContent = `
          (function() {
            function enforceMathColor(root) {
              try {
                var isLight = document.documentElement.classList.contains("cf-light-mode");
                var col = isLight ? "#0f172a" : "#f1f5f9";
                var target = root || document;
                var els = target.querySelectorAll(".MathJax, .MathJax *, .MathJax_Display, .MathJax_Display *, .mjx-chtml, .mjx-chtml *, mjx-container, mjx-container *, .katex, .katex *, .tex-span, .tex-span *, .tex-formula, .tex-formula *, math, math *");
                for (var i = 0; i < els.length; i++) {
                  if (els[i].style) {
                    els[i].style.setProperty("color", col, "important");
                    els[i].style.setProperty("fill", col, "important");
                    els[i].style.setProperty("text-shadow", "none", "important");
                  }
                }
              } catch(e) {}
            }

            function doTypeset() {
              try {
                if (window.MathJax) {
                  var targets = [];
                  var ids = ${JSON.stringify(ids)};
                  if (ids && ids.length) {
                    ids.forEach(function(id) {
                      var t = document.getElementById(id);
                      if (t) targets.push(t);
                    });
                  }
                  if (targets.length === 0) {
                    var pStmt = document.querySelector(".problem-statement");
                    if (pStmt) targets.push(pStmt);
                    else targets.push(document.body);
                  }

                  targets.forEach(function(target) {
                    if (window.MathJax.Hub && window.MathJax.Hub.Queue) {
                      window.MathJax.Hub.Queue(
                        ["PreProcess", window.MathJax.Hub, target],
                        ["Typeset", window.MathJax.Hub, target],
                        function() { enforceMathColor(target); }
                      );
                    } else if (window.MathJax.typesetPromise) {
                      window.MathJax.typesetPromise([target]).then(function() {
                        enforceMathColor(target);
                      }).catch(function(){});
                    }
                  });
                  enforceMathColor();
                }
              } catch(e) {}
            }

            doTypeset();
            setTimeout(doTypeset, 200);
            setTimeout(doTypeset, 600);
            setTimeout(doTypeset, 1500);
          })();
        `;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
      } catch (e) {}

      // Also enforce in content script world
      colorizeMathElements(document);
    }, 60);
  }

  function translateInteractiveText(node, dict) {
    if (!node || node.nodeType !== 1) return;
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const orig = child.nodeValue;
        const trimmed = orig.trim();
        const norm = trimmed.replace(/\s+/g, ' ');
        const trans = dict[trimmed] || dict[norm];
        if (trans) {
          if (child._cfOrigText === undefined) child._cfOrigText = orig;
          const matchLeading = orig.match(/^\s*/);
          const matchTrailing = orig.match(/\s*$/);
          const leading = matchLeading ? matchLeading[0] : '';
          const trailing = matchTrailing ? matchTrailing[0] : '';
          child.nodeValue = leading + trans + trailing;
        }
      }
    }
  }

  function restoreInteractiveText(node) {
    if (!node || node.nodeType !== 1) return;
    for (const child of node.childNodes) {
      if (child.nodeType === 3 && child._cfOrigText !== undefined) {
        child.nodeValue = child._cfOrigText;
        delete child._cfOrigText;
      }
    }
    if (node.querySelectorAll) {
      node.querySelectorAll('*').forEach(desc => {
        for (const child of desc.childNodes) {
          if (child.nodeType === 3 && child._cfOrigText !== undefined) {
            child.nodeValue = child._cfOrigText;
            delete child._cfOrigText;
          }
        }
      });
    }
  }

  function updateTextNodeDirect(el, transText) {
    if (!el) return;
    let updated = false;
    for (const child of el.childNodes) {
      if (child.nodeType === 3 && child.nodeValue.trim()) {
        if (child._cfOrigVal === undefined) child._cfOrigVal = child.nodeValue;
        child.nodeValue = transText;
        updated = true;
        break;
      }
    }
    if (!updated) {
      if (el._cfOrigVal === undefined) el._cfOrigVal = el.textContent;
      el.textContent = transText;
    }
  }

  function restoreTextNodeDirect(el) {
    if (!el) return;
    for (const child of el.childNodes) {
      if (child.nodeType === 3 && child._cfOrigVal !== undefined) {
        child.nodeValue = child._cfOrigVal;
        delete child._cfOrigVal;
      }
    }
    if (el._cfOrigVal !== undefined) {
      el.textContent = el._cfOrigVal;
      delete el._cfOrigVal;
    }
  }

  function restoreElementToOriginal(el) {
    if (!el) return;
    if (el._cfPlaceholders && el._cfPlaceholders.length > 0) {
      el._cfPlaceholders.forEach(phItem => {
        const phNodes = Array.isArray(phItem) ? phItem : (phItem && phItem.nodeType ? [phItem] : []);
        phNodes.forEach(ph => {
          if (ph && ph.nodeType && ph._cfOrigParent && ph._cfOrigParent !== el) {
            if (ph._cfOrigNextSibling && ph._cfOrigParent.childNodes && ph._cfOrigParent.childNodes.includes(ph._cfOrigNextSibling)) {
              if (ph.parentElement) ph.parentElement.removeChild(ph);
              if (ph._cfOrigParent.insertBefore) {
                try {
                  ph._cfOrigParent.insertBefore(ph, ph._cfOrigNextSibling);
                } catch (e) {
                  ph._cfOrigParent.appendChild(ph);
                }
              } else {
                ph.parentElement = ph._cfOrigParent;
                const idx = ph._cfOrigParent.childNodes.indexOf(ph._cfOrigNextSibling);
                ph._cfOrigParent.childNodes.splice(idx, 0, ph);
              }
            } else {
              ph._cfOrigParent.appendChild(ph);
            }
            delete ph._cfOrigParent;
            delete ph._cfOrigNextSibling;
          }
        });
      });
      delete el._cfPlaceholders;
    }

    if (el._cfOrigChildNodes && el._cfOrigChildNodes.length > 0) {
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
      el._cfOrigChildNodes.forEach(child => {
        el.appendChild(child);
      });
    } else if (el._cfOrigContentHTML !== undefined) {
      el.innerHTML = el._cfOrigContentHTML;
    }

    restoreTextNodeDirect(el);
    restoreInteractiveText(el);
    delete el.dataset.cfTranslated;
    delete el.dataset.cfTransPending;
    delete el.dataset.cfEngine;
  }

  // Translation Progress Indicator (Góc phải dưới)
  let activeTranslationTasks = 0;
  let completedTranslationTasks = 0;
  let progressHideTimer = null;

  function ensureProgressIndicator() {
    if (!document.body) return null;
    let indicator = document.getElementById('cf-trans-progress-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'cf-trans-progress-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      indicator.innerHTML = '<div class="cf-trans-spinner"></div><span class="cf-trans-text">0%</span>';
      document.body.appendChild(indicator);
    }
    return indicator;
  }

  function updateTranslationProgress(completed, total) {
    if (currentCfLang !== 'vi') {
      hideTranslationProgress();
      return;
    }
    const indicator = ensureProgressIndicator();
    if (!indicator) return;

    if (total <= 0) {
      hideTranslationProgress();
      return;
    }

    if (progressHideTimer) {
      clearTimeout(progressHideTimer);
      progressHideTimer = null;
    }

    const pct = Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
    const textEl = indicator.querySelector('.cf-trans-text');
    const spinnerEl = indicator.querySelector('.cf-trans-spinner');

    if (pct < 100) {
      if (spinnerEl) spinnerEl.style.display = 'block';
      if (textEl) textEl.textContent = `${pct}%`;
      indicator.classList.add('active');
    } else {
      if (spinnerEl) spinnerEl.style.display = 'none';
      if (textEl) textEl.innerHTML = '<span class="cf-trans-check">✓</span> 100%';
      indicator.classList.add('active');

      progressHideTimer = setTimeout(() => {
        indicator.classList.remove('active');
        activeTranslationTasks = 0;
        completedTranslationTasks = 0;
      }, 1200);
    }
  }

  function hideTranslationProgress() {
    if (progressHideTimer) {
      clearTimeout(progressHideTimer);
      progressHideTimer = null;
    }
    activeTranslationTasks = 0;
    completedTranslationTasks = 0;
    const indicator = document.getElementById('cf-trans-progress-indicator');
    if (indicator) {
      indicator.classList.remove('active');
    }
  }

  // Batch dynamic translator with MathJax, Code, and Handle preservation
  async function translateElementsBatch(elements, engine, geminiApiKey, geminiModel) {
    if (!elements || elements.length === 0) return;

    const batchSession = currentTranslationSession;
    const validItems = [];
    const dict = window.CF_TRANSLATIONS || {};
    const interactiveSel = 'a, button, [role="button"], [role="tab"], .read-more, .disclosure-link';

    function applyTranslationToItem(item, transText) {
      if (!item || !item.el || !transText || !transText.trim()) return;
      if (item.isInteractive) {
        updateTextNodeDirect(item.el, transText);
        item.el.dataset.cfTranslated = 'true';
        item.el.dataset.cfEngine = currentTranslationEngine;
        return;
      }

      // Reconstruct children preserving live DOM nodes and event listeners
      const parts = transText.split(/(\[{1,2}\s*[Mm]\s*\d+\s*\]{1,2})/g);
      while (item.el.firstChild) {
        item.el.removeChild(item.el.firstChild);
      }

      for (const part of parts) {
        if (!part) continue;
        const match = part.match(/\[{1,2}\s*[Mm]\s*(\d+)\s*\]{1,2}/);
        if (match) {
          const pIdx = parseInt(match[1], 10);
          const ph = item.placeholders ? item.placeholders[pIdx] : null;
          if (Array.isArray(ph)) {
            // Bundled nodes, e.g. [.MathJax, script[type="math"]]
            ph.forEach(node => {
              if (node && node.nodeType) item.el.appendChild(node);
            });
          } else if (ph && ph.nodeType) {
            // Re-insert live element directly with intact event listeners and math rendering
            item.el.appendChild(ph);
          } else if (typeof ph === 'string') {
            const decoded = ph
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");

            if (/<[a-z][\s\S]*>/i.test(ph)) {
              // Contains HTML tags
              const span = document.createElement('span');
              span.innerHTML = ph;
              while (span.firstChild) {
                item.el.appendChild(span.firstChild);
              }
            } else {
              // Check if it is a LaTeX math formula: $$$...$$$, $$...$$, \(...\), \[...\], etc.
              let mathTex = null;
              let isDisplay = false;
              const trimmed = decoded.trim();
              if (trimmed.startsWith('$$$') && trimmed.endsWith('$$$') && trimmed.length >= 6) {
                mathTex = trimmed.slice(3, -3);
              } else if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length >= 4) {
                mathTex = trimmed.slice(2, -2);
                isDisplay = true;
              } else if (trimmed.startsWith('\\(') && trimmed.endsWith('\\)') && trimmed.length >= 4) {
                mathTex = trimmed.slice(2, -2);
              } else if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]') && trimmed.length >= 4) {
                mathTex = trimmed.slice(2, -2);
                isDisplay = true;
              }

              let renderedWithKatex = false;
              const katexObj = typeof katex !== 'undefined' ? katex : (window.katex || null);
              if (mathTex !== null && katexObj && typeof katexObj.renderToString === 'function') {
                try {
                  const renderedHtml = katexObj.renderToString(mathTex, {
                    throwOnError: false,
                    displayMode: isDisplay
                  });
                  const mathSpan = document.createElement('span');
                  mathSpan.className = isDisplay ? 'tex-formula katex-display-wrapper' : 'tex-formula';
                  mathSpan.innerHTML = renderedHtml;
                  item.el.appendChild(mathSpan);
                  renderedWithKatex = true;
                } catch (kErr) {
                  // Fall back
                }
              }

              if (!renderedWithKatex) {
                // Kept as visible text so formulas NEVER disappear, and MathJax can render them
                item.el.appendChild(document.createTextNode(decoded));
              }
            }
          } else {
            item.el.appendChild(document.createTextNode(part));
          }
        } else {
          item.el.appendChild(document.createTextNode(part));
        }
      }
      item.el._cfPlaceholders = item.placeholders;
      item.el.dataset.cfTranslated = 'true';
      item.el.dataset.cfEngine = currentTranslationEngine;
    }

    for (const el of elements) {
      if (!el) continue;
      // When translating with AI, if element was previously translated with Google, restore it so AI can re-translate fluently
      if (el.dataset.cfTranslated === 'true' && currentTranslationEngine === 'gemini' && el.dataset.cfEngine === 'google') {
        restoreElementToOriginal(el);
      }
      if (el.dataset.cfTransPending === 'true' || el.dataset.cfTranslated === 'true') continue;

      const isQuestionTarget = Boolean(el.closest && el.closest('[data-cf-questions-table="true"], .questions-table, table.questions, .contest-questions table'));
      if (!isQuestionTarget) {
        if (el.matches && el.matches(TRANSLATION_IGNORE_SELECTOR)) continue;
        if (el.closest && el.closest(TRANSLATION_IGNORE_SELECTOR)) continue;
      } else {
        if (el.matches && el.matches('script, style, .MathJax_Preview, a[href*="/profile/"], .rated-user')) continue;
        if (el.closest && el.closest('script, style, .MathJax_Preview, a[href*="/profile/"], .rated-user')) continue;
      }

      const isInteractive = el.tagName === 'A' || el.tagName === 'BUTTON' || (el.matches && el.matches(interactiveSel));

      if (isInteractive) {
        const text = (el.textContent || '').trim();
        const norm = text.replace(/\s+/g, ' ');
        if (dict[text] || dict[norm]) {
          if (el._cfOrigContentHTML === undefined) {
            el._cfOrigContentHTML = el.innerHTML;
          }
          translateInteractiveText(el, dict);
          el.dataset.cfTranslated = 'true';
          continue;
        }
      }

      if (el._cfOrigContentHTML === undefined) {
        el._cfOrigContentHTML = el.innerHTML;
      }
      if (el._cfOrigChildNodes === undefined && el.childNodes) {
        el._cfOrigChildNodes = Array.from(el.childNodes);
      }

      if (isInteractive) {
        const textToTranslate = (el.textContent || '').trim();
        if (!textToTranslate) continue;

        // Check content memory cache for 0ms instant render
        const cached = getCachedTranslation(textToTranslate);
        if (cached) {
          updateTextNodeDirect(el, cached);
          el.dataset.cfTranslated = 'true';
          el.dataset.cfEngine = currentTranslationEngine;
          continue;
        }

        el.dataset.cfTransPending = 'true';
        validItems.push({
          el,
          isInteractive: true,
          text: textToTranslate,
          placeholders: []
        });
        continue;
      }

      // Container element: preserve live DOM instances of interactive elements, media, and rendered math
      const preservedSel = isQuestionTarget
        ? 'script, style, .MathJax_Preview, a[href*="/profile/"], .rated-user, ' + interactiveSel
        : TRANSLATION_IGNORE_SELECTOR + ', ' + interactiveSel;

      // Filter out internal MathJax helper nodes so only the primary rendered math container is preserved
      const isTopPreserved = (node, root) => {
        // If it is MathJax_Preview, ignore it (MathJax hidden preview)
        if (node.classList && node.classList.contains('MathJax_Preview')) return false;
        // If it is script[type*="math"], ignore it if preceded by .MathJax (bundled together)
        if (node.tagName === 'SCRIPT' && node.previousElementSibling && node.previousElementSibling.classList && node.previousElementSibling.classList.contains('MathJax')) return false;

        let p = node.parentElement;
        while (p && p !== root) {
          if (p.matches && (p.matches(preservedSel))) return false;
          p = p.parentElement;
        }
        return true;
      };

      const livePreserved = Array.from(el.querySelectorAll(preservedSel)).filter(n => isTopPreserved(n, el));
      const clone = el.cloneNode(true);

      // Clean up internal MathJax helper nodes in clone so they don't produce extra placeholders
      clone.querySelectorAll('.MathJax_Preview').forEach(p => p.remove());
      clone.querySelectorAll('.MathJax + script[type*="math"]').forEach(s => s.remove());

      const clonePreserved = Array.from(clone.querySelectorAll(preservedSel)).filter(n => isTopPreserved(n, clone));
      const placeholders = [];

      clonePreserved.forEach((cloneNode, idx) => {
        const liveNode = livePreserved[idx];
        if (liveNode) {
          if (liveNode._cfOrigParent === undefined) {
            liveNode._cfOrigParent = liveNode.parentElement;
            liveNode._cfOrigNextSibling = liveNode.nextSibling;
          }
          translateInteractiveText(liveNode, dict);
          // If this is .MathJax and has an adjacent companion script, bundle them together
          if (liveNode.classList && liveNode.classList.contains('MathJax') &&
              liveNode.nextElementSibling && liveNode.nextElementSibling.tagName === 'SCRIPT' &&
              liveNode.nextElementSibling.getAttribute && liveNode.nextElementSibling.getAttribute('type') &&
              liveNode.nextElementSibling.getAttribute('type').includes('math')) {
            const companionScript = liveNode.nextElementSibling;
            if (companionScript._cfOrigParent === undefined) {
              companionScript._cfOrigParent = companionScript.parentElement;
              companionScript._cfOrigNextSibling = companionScript.nextSibling;
            }
            placeholders[idx] = [liveNode, companionScript];
          } else {
            placeholders[idx] = liveNode;
          }
        } else {
          placeholders[idx] = cloneNode;
        }
        const marker = document.createTextNode(` [[M${idx}]] `);
        cloneNode.replaceWith(marker);
      });

      // 2. Mask TeX patterns in text
      let htmlContent = clone.innerHTML;
      htmlContent = htmlContent.replace(/\${3}([\s\S]*?)\${3}/g, (match) => {
        const idx = placeholders.length;
        placeholders.push(match);
        return ` [[M${idx}]] `;
      });
      htmlContent = htmlContent.replace(/\${2}([\s\S]*?)\${2}/g, (match) => {
        const idx = placeholders.length;
        placeholders.push(match);
        return ` [[M${idx}]] `;
      });
      htmlContent = htmlContent.replace(/\\\[([\s\S]*?)\\\]/g, (match) => {
        const idx = placeholders.length;
        placeholders.push(match);
        return ` [[M${idx}]] `;
      });
      htmlContent = htmlContent.replace(/\\\(([\s\S]*?)\\\)/g, (match) => {
        const idx = placeholders.length;
        placeholders.push(match);
        return ` [[M${idx}]] `;
      });
      clone.innerHTML = htmlContent;

      const textToTranslate = clone.textContent.trim();
      if (!textToTranslate || /^(\[\s*\[\s*M\s*\d+\s*\]\s*\]\s*)+$/i.test(textToTranslate)) {
        continue;
      }

      // If text exists in static dictionary, apply immediately
      const normText = textToTranslate.replace(/\s+/g, ' ');
      if (dict[textToTranslate] || dict[normText]) {
        el.innerHTML = dict[textToTranslate] || dict[normText];
        el.dataset.cfTranslated = 'true';
        continue;
      }

      // Check in-memory fast cache first for 0ms instantaneous render
      const cached = getCachedTranslation(textToTranslate) || getCachedTranslation(normText);
      if (cached) {
        applyTranslationToItem({ el, isInteractive: false, text: textToTranslate, placeholders }, cached);
        continue;
      }

      el.dataset.cfTransPending = 'true';
      validItems.push({
        el,
        isInteractive: false,
        text: textToTranslate,
        placeholders
      });
    }

    if (validItems.length === 0) return;

    activeTranslationTasks += validItems.length;
    updateTranslationProgress(completedTranslationTasks, activeTranslationTasks);

    async function processItems(itemsToProcess, isRetry = false) {
      const BATCH_CHUNK_SIZE = 25;
      for (let c = 0; c < itemsToProcess.length; c += BATCH_CHUNK_SIZE) {
        if (currentCfLang !== 'vi' || batchSession !== currentTranslationSession) return;
        const chunk = itemsToProcess.slice(c, c + BATCH_CHUNK_SIZE);
        try {
          const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              action: 'translateBatch',
              items: chunk.map(item => item.text),
              engine: engine || currentTranslationEngine,
              geminiApiKey: geminiApiKey || currentGeminiApiKey,
              geminiModel: geminiModel || currentGeminiModel,
              geminiCustomModel: currentGeminiCustomModel
            }, resolve);
          });

          // Guard against race conditions: if language was switched or session was invalidated, abort DOM mutation
          if (currentCfLang !== 'vi' || batchSession !== currentTranslationSession) {
            chunk.forEach(item => {
              (item.placeholders || []).forEach(ph => {
                if (ph && ph.nodeType) {
                  restoreInteractiveText(ph);
                  if (ph._cfOrigParent && ph._cfOrigParent !== item.el) {
                    if (ph.parentElement && ph.parentElement !== ph._cfOrigParent) {
                      ph._cfOrigParent.appendChild(ph);
                    }
                    delete ph._cfOrigParent;
                    delete ph._cfOrigNextSibling;
                  }
                }
              });
            });
            activeTranslationTasks = Math.max(0, activeTranslationTasks - chunk.length);
            return;
          }

          if (response && response.success && Array.isArray(response.texts)) {
            response.texts.forEach((transText, i) => {
              const item = chunk[i];
              if (!item) return;
              if (transText && transText.trim()) {
                setCachedTranslation(item.text, transText);
                applyTranslationToItem(item, transText);
              }
            });
          }
        } catch (err) {
          console.warn('[CF Translator] Lỗi dịch batch phần tử:', err);
        } finally {
          chunk.forEach(item => {
            delete item.el.dataset.cfTransPending;
          });
          if (!isRetry && currentCfLang === 'vi' && batchSession === currentTranslationSession) {
            completedTranslationTasks += chunk.length;
            updateTranslationProgress(completedTranslationTasks, activeTranslationTasks);
          }
        }

        // Micro-pause (25ms) between chunks for fluid non-blocking UI rendering
        if (c + BATCH_CHUNK_SIZE < itemsToProcess.length) {
          await new Promise(r => setTimeout(r, 25));
        }
      }
    }

    // Process uncached items through streamlined pipeline without artificial blocking
    await processItems(validItems);

    // If any items were rate-limited or failed, retry once with exponential breather
    const uncompleted = validItems.filter(item => item.el.dataset.cfTranslated !== 'true');
    if (uncompleted.length > 0 && currentCfLang === 'vi' && batchSession === currentTranslationSession) {
      await new Promise(r => setTimeout(r, 800));
      if (currentCfLang === 'vi' && batchSession === currentTranslationSession) {
        uncompleted.forEach(item => { item.el.dataset.cfTransPending = 'true'; });
        await processItems(uncompleted, true);
        uncompleted.forEach(item => { delete item.el.dataset.cfTransPending; });
      }
    }
  }


  // Single element translation (uses batch internally)
  async function translateElement(el, engine, geminiApiKey) {
    return translateElementsBatch([el], engine, geminiApiKey, currentGeminiModel);
  }

  async function translateProblemStatements(enable) {
    removeProblemStatementChangeNotice();
    const problems = document.querySelectorAll('.problem-statement');
    if (problems.length === 0) return;

    // Remove any manual translate bars
    document.querySelectorAll('.cf-problem-translate-bar').forEach(b => b.remove());

    if (!enable) {
      problems.forEach(problem => {
        problem.dataset.cfShowVi = 'false';
        const transOrPendingEls = problem.querySelectorAll('[data-cf-translated="true"], [data-cf-trans-pending="true"]');
        transOrPendingEls.forEach(el => {
          restoreElementToOriginal(el);
        });
        problem.querySelectorAll('.input-file, .output-file').forEach(fileEl => {
          Array.from(fileEl.childNodes).forEach(node => {
            if (node.nodeType === 3 && node._cfOrigText !== undefined) {
              node.nodeValue = node._cfOrigText;
              delete node._cfOrigText;
            }
          });
        });
        typesetMath(problem);
      });
      return;
    }

    const dict = window.CF_TRANSLATIONS || {};
    const allTargets = [];

    problems.forEach(problem => {
      problem.dataset.cfShowVi = 'true';

      // 1. Header properties: title, property titles, input/output specifications
      const title = problem.querySelector('.header .title');
      if (title && !title.dataset.cfTranslated) {
        allTargets.push(title);
      }

      problem.querySelectorAll('.header .property-title').forEach(pt => {
        if (!pt.dataset.cfTranslated) allTargets.push(pt);
      });

      // Standard input / output values in file blocks
      ['.input-file', '.output-file'].forEach(cls => {
        const fileEl = problem.querySelector(cls);
        if (fileEl) {
          Array.from(fileEl.childNodes).forEach(node => {
            if (node.nodeType === 3) {
              const val = (node.nodeValue || '').trim();
              if (val && dict[val]) {
                if (node._cfOrigText === undefined) {
                  node._cfOrigText = node.nodeValue;
                }
                const matchLeading = node.nodeValue.match(/^\s*/);
                const matchTrailing = node.nodeValue.match(/\s*$/);
                node.nodeValue = (matchLeading ? matchLeading[0] : '') + dict[val] + (matchTrailing ? matchTrailing[0] : '');
              }
            }
          });
        }
      });

      // 2. Section titles (e.g. Input, Output, Examples, Note)
      problem.querySelectorAll('.section-title').forEach(st => {
        if (!st.dataset.cfTranslated) allTargets.push(st);
      });

      // 3. Problem body elements (excluding sample-test pre blocks)
      const targets = Array.from(problem.querySelectorAll('p, li, blockquote, dt, dd')).filter(el => {
        if (el.closest('.sample-test, .cf-problem-translate-bar')) return false;
        const text = (el.textContent || '').trim().toLowerCase();
        if (
          text.includes('problem statement has recently been changed') ||
          text.includes('view the changes') ||
          text.includes('đề bài gần đây đã được thay đổi') ||
          text.includes('xem các thay đổi') ||
          text.includes('условие задачи было недавно изменено') ||
          text.includes('посмотреть изменения')
        ) {
          el.style.setProperty('display', 'none', 'important');
          el.remove();
          return false;
        }
        return true;
      });
      allTargets.push(...targets);

      // 4. Fallback for problem statement description or specifications if they have no <p> or <li>
      ['.input-specification', '.output-specification', '.note'].forEach(cls => {
        const specEl = problem.querySelector(cls);
        if (specEl && !specEl.querySelector('p, li') && !specEl.dataset.cfTranslated) {
          Array.from(specEl.childNodes).forEach(node => {
            if (node.nodeType === 1 && !node.classList.contains('section-title') && !node.dataset.cfTranslated) {
              allTargets.push(node);
            }
          });
        }
      });

      const childDivs = Array.from(problem.children).filter(c => c.tagName === 'DIV');
      if (childDivs.length >= 2) {
        const descDiv = childDivs[1];
        if (descDiv && !descDiv.classList.contains('header') && !descDiv.querySelector('p, li') && !descDiv.dataset.cfTranslated) {
          allTargets.push(descDiv);
        }
      }
    });

    await translateElementsBatch(allTargets, currentTranslationEngine, currentGeminiApiKey, currentGeminiModel);
    problems.forEach(problem => {
      typesetMath(problem);
    });
    removeProblemStatementChangeNotice();
  }

  async function translateBlogPosts(enable) {
    const topics = document.querySelectorAll('.topic, .blog-entry');
    if (topics.length === 0) return;

    // Remove any manual topic translate bars
    document.querySelectorAll('.cf-topic-translate-bar').forEach(b => b.remove());

    if (!enable) {
      topics.forEach(topic => {
        topic.dataset.cfShowVi = 'false';
        const transOrPendingEls = topic.querySelectorAll('[data-cf-translated="true"], [data-cf-trans-pending="true"]');
        transOrPendingEls.forEach(el => {
          restoreElementToOriginal(el);
        });
        typesetMath(topic);
      });
      return;
    }

    const allTargets = [];
    topics.forEach(topic => {
      topic.dataset.cfShowVi = 'true';
      // Blog title
      const title = topic.querySelector('.title a, h3 a, .title');
      if (title && !title.dataset.cfTranslated) {
        allTargets.push(title);
      }
      // Blog body
      const content = topic.querySelector('.content, .ttypography') || topic;
      let targets = Array.from(content.querySelectorAll('p, li, blockquote, h1, h2, h3, h4, h5, h6, .spoiler-title')).filter(el => {
        if (el.closest(TRANSLATION_IGNORE_SELECTOR)) return false;
        return true;
      });

      // Spoilers without <p>
      content.querySelectorAll('.spoiler-content').forEach(sc => {
        if (!sc.querySelector('p, li') && !sc.closest(TRANSLATION_IGNORE_SELECTOR) && !sc.dataset.cfTranslated) {
          targets.push(sc);
        }
      });

      // Fallback if no paragraph or heading elements exist
      if (targets.length === 0) {
        const typo = topic.querySelector('.ttypography');
        if (typo && !typo.closest(TRANSLATION_IGNORE_SELECTOR) && !typo.dataset.cfTranslated) {
          targets = [typo];
        } else if (content && !content.closest(TRANSLATION_IGNORE_SELECTOR) && !content.dataset.cfTranslated) {
          targets = [content];
        }
      }

      allTargets.push(...targets);
    });

    await translateElementsBatch(allTargets, currentTranslationEngine, currentGeminiApiKey, currentGeminiModel);
    topics.forEach(topic => {
      typesetMath(topic);
    });
  }

  async function translateComments(enable) {
    const comments = document.querySelectorAll('.comment, .comment-table');
    if (comments.length === 0) return;

    // Always remove any manual translation buttons
    document.querySelectorAll('.cf-comment-trans-link').forEach(link => link.remove());

    if (!enable) {
      comments.forEach(comment => {
        comment.dataset.cfShowVi = 'false';
        const transOrPendingEls = comment.querySelectorAll('[data-cf-translated="true"], [data-cf-trans-pending="true"]');
        transOrPendingEls.forEach(el => {
          restoreElementToOriginal(el);
        });
        typesetMath(comment);
      });
      return;
    }

    const allTargets = [];
    comments.forEach(comment => {
      comment.dataset.cfShowVi = 'true';
      const textContainer = comment.querySelector('.text, .content, .ttypography') || comment;
      let paras = Array.from(textContainer.querySelectorAll('p, li, blockquote, .spoiler-title')).filter(el => {
        if (el.closest(TRANSLATION_IGNORE_SELECTOR)) return false;
        return true;
      });

      // Spoilers without <p> in comments
      textContainer.querySelectorAll('.spoiler-content').forEach(sc => {
        if (!sc.querySelector('p, li') && !sc.closest(TRANSLATION_IGNORE_SELECTOR) && !sc.dataset.cfTranslated) {
          paras.push(sc);
        }
      });

      if (paras.length === 0) {
        const typo = comment.querySelector('.ttypography');
        if (typo && !typo.closest(TRANSLATION_IGNORE_SELECTOR) && !typo.dataset.cfTranslated) {
          paras = [typo];
        } else {
          const textEl = comment.querySelector('.text');
          if (textEl && !textEl.closest(TRANSLATION_IGNORE_SELECTOR) && !textEl.dataset.cfTranslated) {
            paras = [textEl];
          }
        }
      }
      allTargets.push(...paras);
    });

    await translateElementsBatch(allTargets, currentTranslationEngine, currentGeminiApiKey, currentGeminiModel);
    comments.forEach(comment => {
      typesetMath(comment);
    });
  }

  async function translateGeneralDynamicContent(enable) {
    const containers = Array.from(document.querySelectorAll('.round-announcement, .for-problem, .spoiler-content, .spoiler-title'));

    // Group descriptions inside About Group sideboxes
    document.querySelectorAll('.sidebox, .roundbox').forEach(box => {
      const caption = box.querySelector('.caption, .caption.title, h4');
      if (caption) {
        const text = (caption.textContent || '').trim().toLowerCase();
        if (text.includes('about group') || text.includes('giới thiệu nhóm') || text.includes('về nhóm') || text.includes('thông tin nhóm') || text.includes('attention') || text.includes('lưu ý')) {
          const contentDivs = Array.from(box.querySelectorAll('div:not(.caption):not(.top-links)'));
          if (contentDivs.length > 0) {
            const mainDiv = contentDivs[0];
            if (!containers.includes(mainDiv)) containers.push(mainDiv);
          }
        }
      }
    });

    if (containers.length === 0) return;

    if (!enable) {
      containers.forEach(c => {
        if (c.dataset.cfTranslated || c.dataset.cfTransPending) {
          restoreElementToOriginal(c);
        }
        const transOrPendingEls = c.querySelectorAll ? c.querySelectorAll('[data-cf-translated="true"], [data-cf-trans-pending="true"]') : [];
        transOrPendingEls.forEach(el => {
          restoreElementToOriginal(el);
        });
        typesetMath(c);
      });
      return;
    }

    const allTargets = [];
    containers.forEach(c => {
      if (c.classList && c.classList.contains('spoiler-title')) {
        if (!c.dataset.cfTranslated) allTargets.push(c);
        return;
      }
      let targets = Array.from(c.querySelectorAll('p, li, blockquote, h1, h2, h3, h4')).filter(el => {
        if (el.closest(TRANSLATION_IGNORE_SELECTOR)) return false;
        return true;
      });
      if (targets.length === 0 && !c.dataset.cfTranslated && (c.textContent || '').trim()) {
        targets = [c];
      }
      allTargets.push(...targets);
    });

    await translateElementsBatch(allTargets, currentTranslationEngine, currentGeminiApiKey, currentGeminiModel);
    containers.forEach(c => {
      typesetMath(c);
    });
  }

  function getContestQuestionTables() {
    const tables = [];
    // 1. Direct class matches
    document.querySelectorAll('.questions-table, table.questions, .contest-questions table, .clarifications table').forEach(t => {
      if (!tables.includes(t)) tables.push(t);
    });

    // 2. Container datatable / roundbox with "Questions about problems" caption
    document.querySelectorAll('.datatable, .roundbox, div').forEach(box => {
      const caption = box.querySelector('.caption, .caption.title, .caption.titled, .title, h3, h4');
      if (caption) {
        const text = (caption.textContent || '').trim().toLowerCase();
        if (text.includes('questions about problems') || text.includes('thắc mắc về đề bài') || text.includes('câu hỏi về đề bài')) {
          const t = box.querySelector('table');
          if (t && !tables.includes(t)) tables.push(t);
        }
      }
    });

    // 3. Any table having th headers or first-row cells matching QUESTION and ANSWER
    document.querySelectorAll('table').forEach(t => {
      if (tables.includes(t)) return;
      const ths = Array.from(t.querySelectorAll('th, tr:first-child td'));
      const hasQuestion = ths.some(th => /^(question|câu hỏi|thắc mắc)$/i.test((th.textContent || '').trim()));
      const hasAnswer = ths.some(th => /^(answer|câu trả lời|trả lời|giải đáp)$/i.test((th.textContent || '').trim()));
      if (hasQuestion && hasAnswer) {
        tables.push(t);
      }
    });

    return tables;
  }

  async function translateContestQuestions(enable) {
    const tables = getContestQuestionTables();
    if (tables.length === 0) return;

    if (!enable) {
      tables.forEach(table => {
        const transOrPendingEls = table.querySelectorAll('[data-cf-translated="true"], [data-cf-trans-pending="true"]');
        transOrPendingEls.forEach(el => {
          restoreElementToOriginal(el);
        });
        delete table.dataset.cfQuestionsTable;
        typesetMath(table);
      });
      return;
    }

    const allTargets = [];
    tables.forEach(table => {
      table.dataset.cfQuestionsTable = 'true';
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length === 0) return;

      const headerRow = rows[0];
      const ths = Array.from(headerRow.querySelectorAll('th, td'));

      let questionIdx = -1;
      let answerIdx = -1;

      ths.forEach((th, idx) => {
        const txt = (th.textContent || '').trim();
        if (/^(question|câu hỏi|thắc mắc)$/i.test(txt)) questionIdx = idx;
        if (/^(answer|câu trả lời|trả lời|giải đáp)$/i.test(txt)) answerIdx = idx;
      });

      if (questionIdx === -1 && answerIdx === -1) {
        if (rows.length > 1) {
          const sampleTds = rows[1].querySelectorAll('td');
          if (sampleTds.length === 3) {
            questionIdx = 1;
            answerIdx = 2;
          } else if (sampleTds.length >= 4) {
            questionIdx = 2;
            answerIdx = 3;
          }
        }
      }

      for (let i = 1; i < rows.length; i++) {
        const tds = rows[i].querySelectorAll('td');
        const candidateCells = [];
        if (questionIdx >= 0 && tds[questionIdx]) candidateCells.push(tds[questionIdx]);
        if (answerIdx >= 0 && tds[answerIdx]) candidateCells.push(tds[answerIdx]);

        candidateCells.forEach(cell => {
          if (cell.dataset.cfTranslated === 'true') return;

          // If the cell is ONLY a single text node that was already translated by translateNode
          if (cell.childNodes.length === 1 && cell.firstChild && cell.firstChild._cfOrigText !== undefined) {
            cell.dataset.cfTranslated = 'true';
            return;
          }

          // If cell text matches dictionary directly, apply immediately
          const dict = window.CF_TRANSLATIONS || {};
          const text = (cell.textContent || '').trim();
          const normText = text.replace(/\s+/g, ' ');
          if (dict[text] || dict[normText] || dict[text.toLowerCase()]) {
            if (cell._cfOrigContentHTML === undefined) cell._cfOrigContentHTML = cell.innerHTML;
            cell.textContent = dict[text] || dict[normText] || dict[text.toLowerCase()];
            cell.dataset.cfTranslated = 'true';
            return;
          }

          // If any child element matches dictionary directly (e.g. <b>General announcement</b> or pre)
          cell.querySelectorAll('b, strong, span, h4, h5, pre, p, div').forEach(child => {
            if (child.dataset.cfTranslated === 'true') return;
            const cText = (child.textContent || '').trim();
            const cNorm = cText.replace(/\s+/g, ' ');
            if (dict[cText] || dict[cNorm] || dict[cText.toLowerCase()]) {
              if (child._cfOrigContentHTML === undefined) child._cfOrigContentHTML = child.innerHTML;
              child.textContent = dict[cText] || dict[cNorm] || dict[cText.toLowerCase()];
              child.dataset.cfTranslated = 'true';
            }
          });

          let targets = Array.from(cell.querySelectorAll('p, pre, code, blockquote, .ttypography')).filter(el => {
            if (el.matches && el.matches('script, style, .MathJax_Preview, a[href*="/profile/"]')) return false;
            if (el.dataset.cfTranslated === 'true') return false;
            return (el.textContent || '').trim().length > 0;
          });
          if (targets.length === 0) {
            if ((cell.textContent || '').trim() && cell.dataset.cfTranslated !== 'true') {
              targets = [cell];
            }
          }
          allTargets.push(...targets);
        });
      }
    });

    await translateElementsBatch(allTargets, currentTranslationEngine, currentGeminiApiKey, currentGeminiModel);
    tables.forEach(table => {
      typesetMath(table);
    });
  }

  async function applyDynamicContentTranslation(enable) {
    removeProblemStatementChangeNotice();
    document.querySelectorAll('.cf-comment-trans-link, .cf-problem-translate-bar, .cf-topic-translate-bar').forEach(el => el.remove());

    if (!enable) {
      hideTranslationProgress();
      await Promise.all([
        translateProblemStatements(false),
        translateBlogPosts(false),
        translateComments(false),
        translateGeneralDynamicContent(false),
        translateContestQuestions(false)
      ]);
      return;
    }

    // Concurrent translation: Problem statements, blog posts, comments, announcements, contest questions
    await Promise.all([
      translateProblemStatements(true),
      translateBlogPosts(true),
      translateComments(true),
      translateGeneralDynamicContent(true),
      translateContestQuestions(true)
    ]);
  }

  function translateSideboxTitles(enable, dict) {
    if (!dict) dict = window.CF_TRANSLATIONS || {};
    const captions = document.querySelectorAll('.sidebox .caption, .sidebox .caption.titled, .roundbox .caption, .caption.titled');
    captions.forEach(caption => {
      Array.from(caption.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          if (enable) {
            if (node._cfOrigText !== undefined) return;
            const text = node.nodeValue.replace(/\u00A0/g, ' ').trim();
            if (!text) return;
            const norm = text.replace(/\s+/g, ' ');
            const normApos = norm.replace(/[\u2018\u2019]/g, "'");
            const trans = dict[text] || dict[norm] || dict[normApos] || dict[text.toLowerCase()] || dict[norm.toLowerCase()] || dict[normApos.toLowerCase()];
            if (trans) {
              node._cfOrigText = node.nodeValue;
              const matchLeading = node.nodeValue.match(/^\s*/);
              const matchTrailing = node.nodeValue.match(/\s*$/);
              const leading = matchLeading ? matchLeading[0] : '';
              const trailing = matchTrailing ? matchTrailing[0] : '';
              node.nodeValue = leading + trans + trailing;
            }
          } else {
            if (node._cfOrigText !== undefined) {
              node.nodeValue = node._cfOrigText;
              delete node._cfOrigText;
            }
          }
        }
      });
    });
  }

  let isAutoTranslating = false;

  async function applyVietnameseTranslation(isVi) {
    const targetLang = isVi ? 'vi' : 'en';
    const langChanged = (currentCfLang !== targetLang);
    currentCfLang = targetLang;
    if (langChanged) {
      currentTranslationSession++;
    }
    const session = currentTranslationSession;
    removeProblemStatementChangeNotice();

    if (!isVi) {
      hideTranslationProgress();
    }

    const dict = window.CF_TRANSLATIONS || {};
    const rootEl = document.body;
    if (rootEl) {
      translateNode(rootEl, isVi, dict);
    }
    translateSideboxTitles(isVi, dict);

    // Dynamic translation for problems, posts, comments, announcements
    await applyDynamicContentTranslation(isVi);
    alignTableColumns();
    styleSubmissionVerdicts();
    fixSideboxFormButtons();
    styleProblemsetRows();
    highlightOnlineStatus();
    setupRatingTooltipHandler();

    // If language was switched or session was invalidated while awaiting, do not proceed with state updates
    if (session !== currentTranslationSession || (isVi && currentCfLang !== 'vi') || (!isVi && currentCfLang === 'vi')) {
      return;
    }

    if (isVi) {
      if (!translateObserver) {
        translateObserver = new MutationObserver((mutations) => {
          if (isAutoTranslating || currentCfLang !== 'vi') return;
          const hasRelevantMutation = (mutations || []).some(m => {
            if (!m.addedNodes || m.addedNodes.length === 0) return false;
            for (let i = 0; i < m.addedNodes.length; i++) {
              const node = m.addedNodes[i];
              if (node.nodeType === 1) {
                if (node.id === 'cf-trans-progress-indicator' || (node.classList && node.classList.contains('cf-trans-progress'))) continue;
                if (node.matches && (node.matches(TRANSLATION_IGNORE_SELECTOR) || node.matches('.MathJax, mjx-container, math, .katex'))) continue;
                if (node.closest && (node.closest(TRANSLATION_IGNORE_SELECTOR) || node.closest('.MathJax, mjx-container, math, .katex'))) continue;
                if (node.dataset && (node.dataset.cfTranslated === 'true' || node.dataset.cfTransPending === 'true')) continue;
                return true;
              }
            }
            return false;
          });
          if (!hasRelevantMutation) return;

          if (translateDebounceTimer) clearTimeout(translateDebounceTimer);
          translateDebounceTimer = setTimeout(async () => {
            if (currentCfLang !== 'vi' || !document.body || isAutoTranslating) return;
            isAutoTranslating = true;
            try {
              removeProblemStatementChangeNotice();
              translateNode(document.body, true, window.CF_TRANSLATIONS || {});
              translateSideboxTitles(true, window.CF_TRANSLATIONS || {});
              await applyDynamicContentTranslation(true);
              alignTableColumns();
              styleSubmissionVerdicts();
              fixSideboxFormButtons();
            } finally {
              isAutoTranslating = false;
            }
          }, 300);
        });
        const target = document.body;
        if (target) {
          translateObserver.observe(target, { childList: true, subtree: true });
        }
      }
    } else {
      if (translateObserver) {
        translateObserver.disconnect();
        translateObserver = null;
      }
      if (translateDebounceTimer) {
        clearTimeout(translateDebounceTimer);
        translateDebounceTimer = null;
      }
      // Safety net: restore any remaining translated or pending elements across the page
      document.querySelectorAll('[data-cf-translated="true"], [data-cf-trans-pending="true"]').forEach(el => {
        restoreElementToOriginal(el);
      });
    }
  }


  function renderStreakBadge(streakData) {
    if (!streakData || isCloudflareChallenge()) return;

    const header = document.getElementById('header');
    if (!header) return;

    // Find profile link in lang-chooser or anywhere in header
    let profileLink = null;
    const links = header.querySelectorAll('a[href*="/profile/"]');
    for (const l of links) {
      const href = l.getAttribute('href') || '';
      if (href.toLowerCase().includes(`/profile/${streakData.handle.toLowerCase()}`)) {
        profileLink = l;
        break;
      }
    }
    if (!profileLink && links.length > 0) {
      profileLink = links[0];
    }
    if (!profileLink) return;

    // 1. Inject or update badge right to the LEFT (before) of the user's name in the header
    let badge = document.getElementById('cf-header-streak');
    const badgeText = `🔥 Streak: ${streakData.currentStreak}`;

    if (badge && badge.textContent === badgeText && badge.nextSibling === profileLink) {
      return; // Already cleanly rendered, do not trigger DOM mutations
    }

    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'cf-header-streak';
      badge.className = 'cf-streak-badge';
    }
    // Ensure badge is positioned to the left of username
    if (badge.nextSibling !== profileLink) {
      profileLink.insertAdjacentElement('beforebegin', badge);
    }

    badge.className = 'cf-streak-badge';
    if (badge.style && badge.style.setProperty) {
      badge.style.setProperty('color', '#000000', 'important');
    }
    if (streakData.currentStreak > 0 && streakData.hasSubmittedToday) {
      badge.classList.add('streak-done');
      badge.title = `Chuỗi nộp bài: ${streakData.currentStreak} (Đã nộp bài hôm nay ✔️). Bấm để xem chi tiết!`;
    } else {
      badge.classList.add('streak-gray');
      if (streakData.currentStreak > 0) {
        badge.title = `Chuỗi nộp bài: ${streakData.currentStreak} (Hôm nay chưa nộp bài ⏳). Bấm để xem chi tiết!`;
      } else {
        badge.title = `Chuỗi nộp bài: 0 (Chưa nộp bài). Bấm để xem chi tiết!`;
      }
    }

    badge.innerHTML = badgeText;

    badge.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      showStreakDetailCard(badge, streakData);
    };

    // 2. Also update menu item if present
    const menuUl = header.querySelector('.main-menu-list ul, .menu-box ul');
    if (menuUl) {
      let menuStreak = document.getElementById('cf-menu-streak-item');
      if (!menuStreak) {
        menuStreak = document.createElement('li');
        menuStreak.id = 'cf-menu-streak-item';
        menuUl.appendChild(menuStreak);
      }
      menuStreak.innerHTML = `<a href="/profile/${streakData.handle}" title="Bấm để xem biểu đồ userActivityGraph trong profile">🔥 Streak: ${streakData.currentStreak}</a>`;
      const menuStreakLink = menuStreak.querySelector('a');
      if (menuStreakLink && menuStreakLink.style && menuStreakLink.style.setProperty) {
        menuStreakLink.style.setProperty('color', '#000000', 'important');
      }
    }
  }

  function showStreakDetailCard(badgeEl, streakData) {
    if (activeDetailCard) {
      activeDetailCard.remove();
      activeDetailCard = null;
      return;
    }

    const card = document.createElement('div');
    card.id = 'cf-streak-detail-card';

    const rect = badgeEl.getBoundingClientRect();
    card.style.top = `${rect.bottom + window.scrollY + 6}px`;
    card.style.left = `${Math.max(10, rect.right + window.scrollX - 260)}px`;

    const statusNotice = streakData.hasSubmittedToday
      ? `<div class="streak-status-notice done">✔️ Đã nộp bài hôm nay! Tiếp tục phát huy nhé!</div>`
      : `<div class="streak-status-notice pending">⏳ Hôm nay chưa nộp bài! Hãy nộp bài để giữ chuỗi!</div>`;

    const streakColor = (streakData.hasSubmittedToday && streakData.currentStreak > 0) ? '#ea580c' : '#64748b';

    card.innerHTML = `
      <div class="streak-card-header">
        <span>⚡ Chuỗi nộp Codeforces</span>
        <span style="font-size: 11px; color: #64748b;">@${streakData.handle}</span>
      </div>
      <div class="streak-card-body">
        <div class="streak-row">
          <span class="streak-label">Chuỗi hiện tại:</span>
          <span class="streak-val" style="color: ${streakColor}; font-size: 13px;">🔥 ${streakData.currentStreak}</span>
        </div>
        <div class="streak-row">
          <span class="streak-label">Bài nộp trong chuỗi:</span>
          <span class="streak-val" style="color: #2563eb; font-weight: 700;">📝 ${streakData.streakSubmissionsCount ?? 0} bài</span>
        </div>
        <div class="streak-row">
          <span class="streak-label">Kỷ lục dài nhất:</span>
          <span class="streak-val">🏆 ${streakData.maxStreak}</span>
        </div>
        <div class="streak-row">
          <span class="streak-label">Tổng số ngày nộp:</span>
          <span class="streak-val">📅 ${streakData.totalActiveDays} ngày</span>
        </div>
        ${statusNotice}
      </div>
      <div class="streak-card-footer">
        <button id="cf-streak-refresh-btn" class="streak-btn-refresh">🔄 Làm mới</button>
        <a href="/profile/${streakData.handle}" class="streak-profile-link">Xem Activity Graph →</a>
      </div>
    `;

    document.body.appendChild(card);
    activeDetailCard = card;

    const refreshBtn = card.querySelector('#cf-streak-refresh-btn');
    if (refreshBtn) {
      refreshBtn.onclick = async (e) => {
        e.stopPropagation();
        refreshBtn.textContent = 'Đang tải...';
        const updated = await updateStreakForHandle(streakData.handle, true);
        if (updated) {
          card.remove();
          activeDetailCard = null;
          showStreakDetailCard(badgeEl, updated);
        }
      };
    }

    const closeHandler = (e) => {
      if (!card.contains(e.target) && e.target !== badgeEl) {
        card.remove();
        activeDetailCard = null;
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  function initStreakTracker() {
    if (isCloudflareChallenge()) return;
    chrome.storage.local.get(['cfStreak'], (res) => {
      if (res.cfStreak) {
        renderStreakBadge(res.cfStreak);
      }
    });

    const handle = findLoggedInUser();
    if (handle) {
      updateStreakForHandle(handle);
    }
  }

  // MutationObserver to ensure header badge renders as soon as #header exists
  let headerObserver = null;
  function startHeaderObserver() {
    if (headerObserver || isCloudflareChallenge()) return;
    if (document.getElementById('cf-header-streak')) return;

    headerObserver = new MutationObserver(() => {
      const header = document.getElementById('header');
      if (header) {
        renderVietnameseFlag(currentCfLang);
        const handle = findLoggedInUser();
        if (handle) {
          chrome.storage.local.get(['cfStreak'], (res) => {
            if (res.cfStreak && res.cfStreak.handle === handle) {
              renderStreakBadge(res.cfStreak);
              if (document.getElementById('cf-header-streak') && headerObserver) {
                headerObserver.disconnect();
                headerObserver = null;
              }
            }
          });
        }
      }
    });

    const target = document.body || document.documentElement;
    if (target) {
      headerObserver.observe(target, {
        childList: true,
        subtree: true
      });
    }
  }

  // =========================================================
  // Problem Code Auto-link and Auto-fill on Submit Navigation
  // =========================================================

  function getCurrentProblem() {
    const pathname = (window.location && window.location.pathname) || '';
    // Match /problemset/problem/:contestId/:problemIndex (e.g. /problemset/problem/1/A)
    const matchProblemset = pathname.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/i);
    if (matchProblemset) {
      return {
        type: 'problemset',
        contestId: matchProblemset[1],
        problemIndex: matchProblemset[2].toUpperCase(),
        code: `${matchProblemset[1]}${matchProblemset[2].toUpperCase()}`
      };
    }
    // Match /contest/:contestId/problem/:problemIndex (e.g. /contest/1137/problem/A)
    const matchContest = pathname.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
    if (matchContest) {
      return {
        type: 'contest',
        contestId: matchContest[1],
        problemIndex: matchContest[2].toUpperCase(),
        code: `${matchContest[1]}${matchContest[2].toUpperCase()}`
      };
    }
    // Match /gym/:gymId/problem/:problemIndex
    const matchGym = pathname.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
    if (matchGym) {
      return {
        type: 'gym',
        contestId: matchGym[1],
        problemIndex: matchGym[2].toUpperCase(),
        code: `${matchGym[1]}${matchGym[2].toUpperCase()}`
      };
    }
    return null;
  }

  function setupSubmitNavigation() {
    const prob = getCurrentProblem();
    if (!prob) return;

    function updateLinks() {
      const links = document.querySelectorAll(
        'a[href="/problemset/submit"], a[href^="/problemset/submit?"], .second-level-menu a[href*="submit"]'
      );
      links.forEach(link => {
        const href = link.getAttribute('href') || '';
        if (href.includes('/problemset/submit') || href.endsWith('/submit')) {
          link.setAttribute('href', `/problemset/submit?problem=${encodeURIComponent(prob.code)}`);
        }
      });
    }

    updateLinks();
    document.addEventListener('DOMContentLoaded', updateLinks);

    const target = document.querySelector('.second-level-menu') || document.body || document.documentElement;
    if (target) {
      const menuObserver = new MutationObserver(updateLinks);
      menuObserver.observe(target, { childList: true, subtree: true });
    }

    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a');
      if (a && a.textContent && a.textContent.trim().toUpperCase() === 'SUBMIT') {
        const href = a.getAttribute('href') || '';
        if (href.includes('/problemset/submit') && !href.includes('problem=')) {
          e.preventDefault();
          window.location.href = `/problemset/submit?problem=${encodeURIComponent(prob.code)}`;
        }
      }
    }, true);
  }

  function autoFillProblemOnSubmitPage() {
    const pathname = (window.location && window.location.pathname) || '';
    if (!pathname.includes('/submit')) return;

    const search = (window.location && window.location.search) || '';
    const params = new URLSearchParams(search);
    const problemParam = params.get('problem') || params.get('submittedProblemCode');
    if (!problemParam) return;

    const targetCode = problemParam.trim().toUpperCase();

    function fillField() {
      // Input on /problemset/submit
      const input = document.querySelector('input[name="submittedProblemCode"]') ||
                    document.querySelector('input#submittedProblemCode');
      if (input) {
        if (input.value !== targetCode) {
          input.value = targetCode;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }
        return true;
      }

      // Dropdown on /contest/:id/submit
      const select = document.querySelector('select[name="submittedProblemIndex"]');
      if (select) {
        for (const opt of select.options) {
          if (opt.value.toUpperCase() === targetCode || opt.text.toUpperCase().startsWith(targetCode)) {
            select.value = opt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
      }
      return false;
    }

    if (!fillField()) {
      const container = document.getElementById('pageContent') || document.body || document.documentElement;
      if (container) {
        const observer = new MutationObserver((mutations, obs) => {
          if (fillField()) {
            obs.disconnect();
          }
        });
        observer.observe(container, { childList: true, subtree: true });
      }
      document.addEventListener('DOMContentLoaded', fillField);
      setTimeout(fillField, 200);
      setTimeout(fillField, 600);
      setTimeout(fillField, 1500);
    }
  }

  function removeProblemStatementChangeNotice() {
    try {
      // 1. Target diff / change links ("View the changes.")
      const links = document.querySelectorAll('a');
      links.forEach(a => {
        const text = (a.textContent || '').trim().toLowerCase();
        if (
          text.includes('view the changes') ||
          text.includes('xem các thay đổi') ||
          text.includes('посмотреть изменения')
        ) {
          // If the link is inside a dedicated alert or notice container, remove that alert container only
          const noticeContainer = a.closest('.alert, .diff-notifier, .problem-statement-changed');
          if (
            noticeContainer &&
            noticeContainer.id !== 'pageContent' &&
            noticeContainer.id !== 'content' &&
            !noticeContainer.classList.contains('content-with-sidebar') &&
            !noticeContainer.classList.contains('problem-statement') &&
            !noticeContainer.classList.contains('problemindexbox') &&
            !noticeContainer.classList.contains('ttypography')
          ) {
            noticeContainer.style.setProperty('display', 'none', 'important');
            noticeContainer.remove();
          } else {
            // Otherwise remove only the immediate paragraph or the link itself
            const p = a.closest('p');
            if (
              p &&
              p.id !== 'pageContent' &&
              p.id !== 'content' &&
              !p.classList.contains('problem-statement') &&
              !p.classList.contains('ttypography') &&
              !p.classList.contains('problemindexbox')
            ) {
              p.style.setProperty('display', 'none', 'important');
              p.remove();
            } else {
              a.style.setProperty('display', 'none', 'important');
              a.remove();
            }
          }
        }
      });

      // 2. Target notice text containers (without diff link)
      const noticeCandidates = document.querySelectorAll('.alert, p, span, div.notice');
      noticeCandidates.forEach(el => {
        // Absolutely protected containers
        if (
          el.id === 'pageContent' ||
          el.id === 'content' ||
          el.classList.contains('content-with-sidebar') ||
          el.classList.contains('problem-statement') ||
          el.classList.contains('problemindexbox') ||
          el.classList.contains('ttypography')
        ) {
          return;
        }

        const text = (el.textContent || '').trim().toLowerCase();
        if (
          (text.includes('problem statement has recently been changed') ||
           text.includes('đề bài gần đây đã được thay đổi') ||
           text.includes('условие задачи было недавно изменено')) &&
          text.length < 250 // Notice messages are short, never an entire section or article!
        ) {
          const alertBox = el.closest('.alert') || el;
          if (
            alertBox &&
            alertBox.id !== 'pageContent' &&
            alertBox.id !== 'content' &&
            !alertBox.classList.contains('content-with-sidebar') &&
            !alertBox.classList.contains('problem-statement') &&
            !alertBox.classList.contains('problemindexbox') &&
            !alertBox.classList.contains('ttypography')
          ) {
            alertBox.style.setProperty('display', 'none', 'important');
            alertBox.remove();
          }
        }
      });
    } catch (e) {
      // Ignore
    }
  }

  function removeLavaLampBack() {
    try {
      const backs = document.querySelectorAll('li.back, li.backLava, .backLava');
      backs.forEach(el => el.remove());
    } catch (e) {
      // Ignore
    }
  }

  function alignTableColumns() {
    try {
      const tables = document.querySelectorAll('table.rtable, table.problems, .contests-table table, .datatable table');
      tables.forEach(table => {
        const headerRow = table.querySelector('tr');
        if (!headerRow) return;
        const ths = headerRow.querySelectorAll('th, td');
        const centerIndices = new Set();
        ths.forEach((th, idx) => {
          const text = (th.textContent || '').trim().toLowerCase();
          if (
            text === '#' || text === 'id' ||
            text.includes('bắt đầu') || text.includes('start') ||
            text.includes('thời lượng') || text.includes('thời gian') || text.includes('length') || text.includes('duration') ||
            th.classList.contains('id')
          ) {
            centerIndices.add(idx);
            th.classList.add('cf-col-center');
          }
        });
        if (centerIndices.size > 0) {
          table.querySelectorAll('tr').forEach(row => {
            const cells = row.children;
            centerIndices.forEach(idx => {
              if (cells[idx]) {
                cells[idx].classList.add('cf-col-center');
              }
            });
          });
        }
      });
    } catch (e) {
      // Ignore
    }
  }

  function styleSubmissionVerdicts(root) {
    try {
      const container = root || document;

      function applyVerdictStyle(el) {
        if (!el) return;
        const text = (el.textContent || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!text) return;

        let verdictType = null;
        let colorHex = null;

        // 1. Red: Compilation error OR 0 points
        if (
          text.includes('compilation error') ||
          text.includes('lỗi biên dịch') ||
          /partial\s*result:\s*0(\.0+)?\s*points?/i.test(text) ||
          /kết\s*quả\s*một\s*phần:\s*0(\.0+)?\s*điểm/i.test(text) ||
          /:\s*0(\.0+)?\s*points?/i.test(text) ||
          /:\s*0(\.0+)?\s*điểm/i.test(text)
        ) {
          verdictType = 'red';
          colorHex = '#ef4444';
        }
        // 2. Green: Perfect result (100 points, Accepted)
        else if (
          /perfect\s*result/i.test(text) ||
          /100\s*points?/i.test(text) ||
          /100\s*điểm/i.test(text) ||
          text.includes('kết quả hoàn hảo') ||
          text === 'accepted' ||
          text.startsWith('accepted')
        ) {
          verdictType = 'green';
          colorHex = '#22c55e';
        }
        // 3. Yellow: Partial result (85 points, 51 points, 7.5 points, 10 points > 0)
        else if (
          /partial\s*result/i.test(text) ||
          text.includes('kết quả một phần') ||
          /:\s*[1-9]\d*(\.\d+)?\s*points?/i.test(text) ||
          /:\s*[1-9]\d*(\.\d+)?\s*điểm/i.test(text)
        ) {
          verdictType = 'yellow';
          colorHex = '#facc15';
        }

        if (verdictType && colorHex) {
          const className = `cf-verdict-${verdictType}`;
          const allNodes = [el, ...Array.from(el.querySelectorAll ? el.querySelectorAll('a, span, b, font, div') : [])];
          allNodes.forEach(node => {
            node.classList.remove('cf-verdict-green', 'cf-verdict-yellow', 'cf-verdict-red');
            node.classList.add(className);
            if (node.style && node.style.setProperty) {
              node.style.setProperty('color', colorHex, 'important');
              node.style.setProperty('text-shadow', 'none', 'important');
              node.style.setProperty('font-weight', '700', 'important');
            }
          });
          if (el.parentElement && (el.parentElement.classList.contains('submissionVerdictWrapper') || el.parentElement.tagName === 'TD')) {
            el.parentElement.classList.remove('cf-verdict-green', 'cf-verdict-yellow', 'cf-verdict-red');
            el.parentElement.classList.add(className);
            if (el.parentElement.style && el.parentElement.style.setProperty) {
              el.parentElement.style.setProperty('color', colorHex, 'important');
              el.parentElement.style.setProperty('text-shadow', 'none', 'important');
              el.parentElement.style.setProperty('font-weight', '700', 'important');
            }
          }
        }
      }

      // 1. Scan ALL tables and identify verdict column
      const allTables = container.querySelectorAll('table');
      allTables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        if (!rows || rows.length === 0) return;
        const headerRow = rows[0];
        const ths = headerRow.querySelectorAll('th, td');
        let verdictColIdx = -1;
        ths.forEach((th, idx) => {
          const hText = (th.textContent || '').replace(/\u00A0/g, ' ').trim().toLowerCase();
          if (
            hText === 'verdict' ||
            hText.includes('trạng thái') ||
            hText.includes('kết quả') ||
            (th.classList && th.classList.contains('status-verdict-cell'))
          ) {
            verdictColIdx = idx;
          }
        });

        if (verdictColIdx >= 0) {
          rows.forEach((row, rIdx) => {
            if (rIdx === 0) return;
            const cell = row.children[verdictColIdx];
            if (cell && cell.tagName === 'TD') {
              applyVerdictStyle(cell);
            }
          });
        }
      });

      // 2. Scan all verdict wrappers, links and status cells across container
      const targets = container.querySelectorAll(
        '.submissionVerdictWrapper, [class*="verdict-"], td.status-verdict-cell, a.view-source, td[data-submissionId], td[submissionid], [submissionverdict]'
      );
      targets.forEach(applyVerdictStyle);

      // 3. Fallback scan on table cells that contain points or result keywords
      const candidateCells = container.querySelectorAll('td');
      candidateCells.forEach(cell => {
        const cellText = cell.textContent || '';
        if (
          /points?/i.test(cellText) ||
          /điểm/i.test(cellText) ||
          /perfect\s*result/i.test(cellText) ||
          /partial\s*result/i.test(cellText) ||
          /compilation\s*error/i.test(cellText) ||
          /lỗi\s*biên\s*dịch/i.test(cellText)
        ) {
          applyVerdictStyle(cell);
        }
      });

      // Observe container for live AJAX verdict updates
      if (typeof MutationObserver !== 'undefined' && container && !container._cfVerdictObserved) {
        container._cfVerdictObserved = true;
        const obs = new MutationObserver(() => {
          styleSubmissionVerdicts(container);
        });
        obs.observe(container, { childList: true, subtree: true, characterData: true });
      }
    } catch (e) {
      // Ignore
    }
  }

  function fixSideboxFormButtons() {
    try {
      const sideboxButtons = document.querySelectorAll(
        '.sidebox form input[type="submit"], .sidebox form input[type="button"], .sidebox form input[type="reset"], .sidebox form button, .sidebox form a[href*="reset"], .sidebox form a[href*="setup"], .sidebox form a.button'
      );
      if (!sideboxButtons || sideboxButtons.length === 0) return;

      const parentSet = new Set();
      sideboxButtons.forEach((btn) => {
        btn.classList.add('cf-sidebox-btn');

        // Translate Apply, Reset, and Find buttons cleanly
        const text = (btn.value || btn.textContent || '').replace(/\u00A0/g, ' ').trim().toLowerCase();
        if (text === 'apply' || text === 'áp dụng') {
          const trans = currentCfLang === 'vi' ? 'Áp dụng' : 'Apply';
          if (btn.tagName === 'INPUT') btn.value = trans;
          else btn.textContent = trans;
        } else if (text === 'reset' || text === 'đặt lại') {
          const trans = currentCfLang === 'vi' ? 'Đặt lại' : 'Reset';
          if (btn.tagName === 'INPUT') btn.value = trans;
          else btn.textContent = trans;
        } else if (text === 'find' || text === 'tìm kiếm') {
          const trans = currentCfLang === 'vi' ? 'Tìm kiếm' : 'Find';
          if (btn.tagName === 'INPUT') btn.value = trans;
          else btn.textContent = trans;
        }

        if (btn.style && btn.style.setProperty) {
          btn.style.setProperty('position', 'static', 'important');
          btn.style.setProperty('top', 'auto', 'important');
          btn.style.setProperty('bottom', 'auto', 'important');
          btn.style.setProperty('left', 'auto', 'important');
          btn.style.setProperty('right', 'auto', 'important');
          btn.style.setProperty('float', 'none', 'important');
          btn.style.setProperty('clear', 'none', 'important');
          btn.style.setProperty('margin', '2px auto', 'important');
          btn.style.setProperty('padding', '4px 18px', 'important');
          btn.style.setProperty('display', 'inline-flex', 'important');
          btn.style.setProperty('justify-content', 'center', 'important');
          btn.style.setProperty('align-items', 'center', 'important');
          btn.style.setProperty('box-sizing', 'border-box', 'important');
          btn.style.setProperty('vertical-align', 'middle', 'important');
          btn.style.setProperty('height', 'auto', 'important');
          btn.style.setProperty('min-height', '28px', 'important');
          btn.style.setProperty('line-height', 'normal', 'important');
        }

        let container = btn.parentElement;
        if (container && container.tagName === 'A') container = container.parentElement;
        if (container && !parentSet.has(container)) {
          parentSet.add(container);
          if (container.tagName === 'TD') {
            if (container.style && container.style.setProperty) {
              container.style.setProperty('text-align', 'center', 'important');
              container.style.setProperty('vertical-align', 'middle', 'important');
              container.style.setProperty('padding', '8px 0 2px 0', 'important');
              container.style.setProperty('width', '100%', 'important');
            }
          } else {
            container.classList.add('cf-form-actions');
            if (container.style && container.style.setProperty) {
              container.style.setProperty('display', 'flex', 'important');
              container.style.setProperty('flex-direction', 'row', 'important');
              container.style.setProperty('flex-wrap', 'wrap', 'important');
              container.style.setProperty('justify-content', 'center', 'important');
              container.style.setProperty('align-items', 'center', 'important');
              container.style.setProperty('gap', '10px', 'important');
              container.style.setProperty('margin-top', '6px', 'important');
              container.style.setProperty('margin-bottom', '2px', 'important');
              container.style.setProperty('line-height', 'normal', 'important');
              container.style.setProperty('height', 'auto', 'important');
              container.style.setProperty('min-height', 'auto', 'important');
              container.style.setProperty('max-height', 'none', 'important');
              container.style.setProperty('overflow', 'visible', 'important');
              container.style.setProperty('width', '100%', 'important');
              container.style.setProperty('box-sizing', 'border-box', 'important');
            }
          }
        }
      });

      // Ensure form labels, inputs and text in sidebox forms are cleanly left-aligned with compact vertical spacing
      const sideboxForms = document.querySelectorAll('.sidebox form');
      sideboxForms.forEach((form) => {
        if (form.style && form.style.setProperty) {
          form.style.setProperty('text-align', 'left', 'important');
          form.style.setProperty('padding', '2px 0', 'important');
          form.style.setProperty('margin', '0', 'important');
        }
        Array.from(form.children).forEach((child) => {
          if (!child.classList.contains('cf-form-actions') && !child.querySelector('input[type="submit"], input[type="reset"], button')) {
            if (child.style && child.style.setProperty) {
              child.style.setProperty('text-align', 'left', 'important');
              child.style.setProperty('padding', '1px 0', 'important');
              child.style.setProperty('margin', '0', 'important');
            }
          }
        });
        const formTds = form.querySelectorAll('td');
        formTds.forEach((td) => {
          if (!td.querySelector('input[type="submit"], input[type="button"], button') && !td.getAttribute('colspan')) {
            if (td.style && td.style.setProperty) {
              td.style.setProperty('text-align', 'left', 'important');
            }
          }
        });
        const formSelects = form.querySelectorAll('select');
        formSelects.forEach((sel) => {
          if (sel.style && sel.style.setProperty) {
            sel.style.setProperty('width', '100%', 'important');
            sel.style.setProperty('max-width', '100%', 'important');
            sel.style.setProperty('float', 'none', 'important');
            sel.style.setProperty('text-align', 'left', 'important');
            sel.style.setProperty('margin', '0', 'important');
          }
        });
        const formFileInputs = form.querySelectorAll('input[type="file"]');
        formFileInputs.forEach((inp) => {
          if (inp.style && inp.style.setProperty) {
            inp.style.setProperty('width', '100%', 'important');
            inp.style.setProperty('max-width', '100%', 'important');
            inp.style.setProperty('float', 'none', 'important');
            inp.style.setProperty('text-align', 'left', 'important');
            inp.style.setProperty('margin', '0', 'important');
          }
        });
        const labels = form.querySelectorAll('label, .label');
        labels.forEach((lbl) => {
          if (lbl.style && lbl.style.setProperty) {
            lbl.style.setProperty('display', 'block', 'important');
            lbl.style.setProperty('text-align', 'left', 'important');
            lbl.style.setProperty('float', 'none', 'important');
            lbl.style.setProperty('clear', 'both', 'important');
            lbl.style.setProperty('margin-top', '2px', 'important');
            lbl.style.setProperty('margin-bottom', '3px', 'important');
          }
        });
        const inputs = form.querySelectorAll('input[type="text"]');
        inputs.forEach((inp) => {
          if (inp.style && inp.style.setProperty) {
            inp.style.setProperty('margin-top', '2px', 'important');
            inp.style.setProperty('margin-bottom', '4px', 'important');
            inp.style.setProperty('height', '30px', 'important');
            inp.style.setProperty('min-height', '30px', 'important');
            inp.style.setProperty('padding', '4px 8px', 'important');
          }
        });
      });
    } catch (e) {
      // Ignore
    }
  }

  function highlightOnlineStatus(root) {
    try {
      const scope = root || document;
      const candidates = scope.querySelectorAll
        ? scope.querySelectorAll('.format-online, .online, .cf-online-now, span[style*="green"], .info span, .userbox span, .personal-sidebar span, li span')
        : [];
      candidates.forEach((el) => {
        const txt = (el.textContent || '').replace(/\u00A0/g, ' ').trim().toLowerCase();
        if (
          el.classList.contains('format-online') ||
          el.classList.contains('online') ||
          el.classList.contains('cf-online-now') ||
          txt === 'online now' ||
          txt === 'đang trực tuyến' ||
          (el.getAttribute('style') && el.getAttribute('style').includes('green'))
        ) {
          el.classList.add('cf-online-now');
          if (el.style && el.style.setProperty) {
            el.style.setProperty('color', '#22c55e', 'important');
            el.style.setProperty('font-weight', '700', 'important');
            el.style.setProperty('text-shadow', 'none', 'important');
          }
        }
      });
    } catch (e) {
      // silent fallback
    }
  }

  function styleProblemsetRows(container = document) {
    try {
      const problemTables = container.querySelectorAll('table.problems');
      problemTables.forEach(table => {
        const thName = table.querySelector('th.name');
        if (thName && currentCfLang === 'vi') {
          thName.textContent = 'Tên bài tập';
        }

        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          const isAccepted =
            row.classList.contains('accepted-problem') ||
            row.classList.contains('highlighted-problem') ||
            !!row.querySelector('.accepted-problem') ||
            !!row.querySelector('td.act.accepted-problem') ||
            !!row.querySelector('td.act[style*="rgb(212"]') ||
            !!row.querySelector('td.act[style*="#d4edda"]') ||
            !!row.querySelector('td.act[style*="#dfeebe"]') ||
            !!row.querySelector('td.act[style*="#e6f9d4"]');

          const isRejected =
            row.classList.contains('rejected-problem') ||
            !!row.querySelector('.rejected-problem') ||
            !!row.querySelector('td.act.rejected-problem') ||
            !!row.querySelector('td.act[style*="rgb(255"]') ||
            !!row.querySelector('td.act[style*="#ef"]') ||
            !!row.querySelector('td.act[style*="#ffe"]');

          const cells = row.children;
          const actCell = row.querySelector('td.act') || (cells.length >= 3 && cells[2].tagName === 'TD' ? cells[2] : null);

          if (actCell && actCell.style && actCell.style.setProperty) {
            if (isAccepted) {
              row.classList.add('accepted-problem');
              actCell.classList.add('cf-act-accepted');
              actCell.classList.remove('cf-act-rejected');
              actCell.style.setProperty('background-color', 'rgba(34, 197, 94, 0.22)', 'important');
              actCell.style.setProperty('color', '#22c55e', 'important');
            } else if (isRejected) {
              row.classList.add('rejected-problem');
              actCell.classList.add('cf-act-rejected');
              actCell.classList.remove('cf-act-accepted');
              actCell.style.setProperty('background-color', 'rgba(239, 68, 68, 0.22)', 'important');
              actCell.style.setProperty('color', '#ef4444', 'important');
            } else {
              actCell.classList.remove('cf-act-accepted', 'cf-act-rejected');
            }
          }
        });
      });
    } catch (e) {
      // Ignore
    }
  }

  function setupRatingTooltipHandler() {
    try {
      const elevateTooltip = (tip) => {
        if (!tip) return;
        tip.classList.add('cf-rating-tooltip-top');
        if (tip.style && tip.style.setProperty) {
          tip.style.setProperty('z-index', '99999999', 'important');
          tip.style.setProperty('pointer-events', 'auto', 'important');
        }
      };

      // Watch for dynamically inserted #tooltip or flot tooltip
      const targetBody = document.body;
      if (typeof MutationObserver !== 'undefined' && targetBody && !targetBody._cfTooltipObserved) {
        targetBody._cfTooltipObserved = true;
        const tooltipObserver = new MutationObserver((mutations) => {
          for (let i = 0; i < mutations.length; i++) {
            const added = mutations[i].addedNodes;
            if (!added) continue;
            for (let j = 0; j < added.length; j++) {
              const node = added[j];
              if (node.nodeType === 1) {
                if (
                  node.id === 'tooltip' ||
                  (node.id && node.id.includes('tooltip')) ||
                  (node.classList && (node.classList.contains('flot-tooltip') || node.classList.contains('flotTip')))
                ) {
                  elevateTooltip(node);
                }
                const nested = node.querySelectorAll ? node.querySelectorAll('#tooltip, .flot-tooltip, .flotTip, div[id*="tooltip"]') : [];
                nested.forEach(elevateTooltip);
              }
            }
          }
        });
        tooltipObserver.observe(targetBody, { childList: true, subtree: true });
      }

      // Also bind hover events on #placeholder rating graph container
      const placeholder = document.getElementById('placeholder');
      if (placeholder && !placeholder._cfTooltipBound) {
        placeholder._cfTooltipBound = true;
        const handleGraphHover = () => {
          const tips = document.querySelectorAll('#tooltip, .flot-tooltip, .flotTip, div[id*="tooltip"]');
          tips.forEach(elevateTooltip);
        };
        placeholder.addEventListener('mousemove', handleGraphHover, { passive: true });
        placeholder.addEventListener('mouseenter', handleGraphHover, { passive: true });
      }

      // Initial check for any existing tooltip
      const existingTips = document.querySelectorAll('#tooltip, .flot-tooltip, .flotTip, div[id*="tooltip"]');
      existingTips.forEach(elevateTooltip);
    } catch (e) {
      // silent fallback
    }
  }

  let isInitialized = false;

  function checkAndInit() {
    if (isCloudflareChallenge()) {
      teardownForCloudflare();
      return;
    }
    if (!document.getElementById('header') && !document.getElementById('body') && !document.getElementById('pageContent') && !document.body) {
      return;
    }
    attachBgLayer();
    removeLavaLampBack();
    removeProblemStatementChangeNotice();
    setupSubmitNavigation();
    autoFillProblemOnSubmitPage();
    replaceCodeforcesLogo();
    initStreakTracker();
    setupRatingTooltipHandler();
    alignTableColumns();
    styleSubmissionVerdicts();
    fixSideboxFormButtons();
    styleProblemsetRows();
    highlightOnlineStatus();
    setupRatingTooltipHandler();
    colorizeMathElements();

    if (!isInitialized) {
      isInitialized = true;
      chrome.storage.local.get([
        'enabled',
        'bgType',
        'bgImage',
        'bgHistory',
        'blur',
        'brightness',
        'overlay',
        'contentOpacity',
        'bgSize',
        'themeMode',
        'cfLang',
        'translationEngine',
        'geminiApiKey',
        'geminiModel',
        'geminiCustomModel'
      ], (result) => {
        applySettings(result);
        if (result && result.themeMode) {
          replaceCodeforcesLogo(result.themeMode);
        }
        currentTranslationEngine = (result && result.translationEngine) || 'google';
        currentGeminiApiKey = (result && result.geminiApiKey) || '';
        currentGeminiModel = (result && result.geminiModel) || 'auto';
        currentGeminiCustomModel = (result && result.geminiCustomModel) || '';
        const lang = (result && result.cfLang) || 'vi';
        currentCfLang = lang;
        renderVietnameseFlag(lang);
        applyVietnameseTranslation(lang === 'vi');
        alignTableColumns();
        styleSubmissionVerdicts();
        fixSideboxFormButtons();
        styleProblemsetRows();
        highlightOnlineStatus();
        colorizeMathElements();
      });
    } else {
      alignTableColumns();
      styleSubmissionVerdicts();
      fixSideboxFormButtons();
      styleProblemsetRows();
      colorizeMathElements();
      if (currentCfLang === 'vi') {
        applyDynamicContentTranslation(true);
      }
    }
  }

  // Handle Cloudflare challenge vs Codeforces initialization
  if (isCloudflareChallenge()) {
    teardownForCloudflare();
    const cfObserver = new MutationObserver(() => {
      if (!isCloudflareChallenge() && (document.getElementById('header') || document.getElementById('body') || document.getElementById('pageContent') || document.body)) {
        cfObserver.disconnect();
        startHeaderObserver();
        checkAndInit();
      }
    });
    cfObserver.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    const initObserver = new MutationObserver(() => {
      if (isCloudflareChallenge()) {
        teardownForCloudflare();
      } else if (document.getElementById('header') || document.getElementById('body') || document.getElementById('pageContent') || document.body) {
        initObserver.disconnect();
        startHeaderObserver();
        checkAndInit();
      }
    });
    initObserver.observe(document.documentElement, { childList: true, subtree: true });

    if (document.getElementById('header') || document.getElementById('body') || document.getElementById('pageContent') || document.body) {
      initObserver.disconnect();
      startHeaderObserver();
      checkAndInit();
    }
  }

  function showCfToast(message, duration = 3000) {
    if (typeof document === 'undefined' || !document.body) return;
    let toast = document.getElementById('cf-bg-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'cf-bg-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('visible');
    }, duration);
  }

  function setupPageDragAndDrop() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window._cfDragAndDropInit) return;
    window._cfDragAndDropInit = true;

    let dragCounter = 0;
    let overlayEl = null;

    function getOrCreateOverlay() {
      if (!overlayEl) {
        overlayEl = document.getElementById('cf-bg-drop-overlay');
        if (!overlayEl && document.body) {
          overlayEl = document.createElement('div');
          overlayEl.id = 'cf-bg-drop-overlay';
          overlayEl.innerHTML = `
            <div class="cf-bg-drop-content">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <p class="cf-drop-title">Thả ảnh hoặc video vào đây để đặt làm hình nền</p>
              <p class="cf-drop-sub">Hỗ trợ MP4, WebM, JPG, PNG, GIF, WebP</p>
            </div>
          `;
          document.body.appendChild(overlayEl);
        }
      }
      return overlayEl;
    }

    window.addEventListener('dragenter', (e) => {
      if (e.dataTransfer && e.dataTransfer.types) {
        const types = Array.from(e.dataTransfer.types || []);
        if (types.includes('Files')) {
          dragCounter++;
          const el = getOrCreateOverlay();
          if (el) el.classList.add('visible');
        }
      }
    });

    window.addEventListener('dragover', (e) => {
      if (e.dataTransfer && e.dataTransfer.types) {
        const types = Array.from(e.dataTransfer.types || []);
        if (types.includes('Files')) {
          e.preventDefault();
        }
      }
    });

    window.addEventListener('dragleave', (e) => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if (overlayEl) overlayEl.classList.remove('visible');
      }
    });

    window.addEventListener('drop', (e) => {
      dragCounter = 0;
      if (overlayEl) overlayEl.classList.remove('visible');

      if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
      const file = e.dataTransfer.files[0];
      const name = (file.name || '').toLowerCase();
      const isVideo = (file.type && file.type.startsWith('video/')) || /\.(mp4|webm|mov|mkv|m4v|ogg)$/i.test(name);
      const isImage = (file.type && file.type.startsWith('image/')) || /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)$/i.test(name);

      if (!isVideo && !isImage) return;
      e.preventDefault();

      if (isVideo && file.size > 40 * 1024 * 1024) {
        showCfToast('⚠️ Kích thước video quá lớn (>40MB). Vui lòng chọn tệp nhỏ hơn.', 4000);
        return;
      }

      showCfToast(isVideo ? '⏳ Đang nạp video nền...' : '⏳ Đang áp dụng ảnh nền...', 4000);

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const id = Date.now().toString();
        const type = isVideo ? 'video' : 'image';

        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
          applySettings({ bgType: type, bgImage: dataUrl, enabled: true });
          showCfToast('✔️ Đã áp dụng hình nền!', 3000);
          return;
        }

        chrome.storage.local.get(null, (allSettings) => {
          let history = (allSettings && allSettings.bgHistory) || [];
          history = history.filter(h => h.url !== dataUrl);
          history.unshift({
            id,
            type,
            url: 'cf_cache_' + id,
            name: file.name,
            thumbnail: '',
            hasCache: true,
            timestamp: Date.now()
          });
          if (history.length > 5) {
            const removed = history.slice(5);
            chrome.storage.local.remove(removed.map(r => 'cf_cache_' + r.id));
            history = history.slice(0, 5);
          }

          chrome.storage.local.set({
            ['cf_cache_' + id]: dataUrl,
            bgType: type,
            bgImage: dataUrl,
            bgImageId: id,
            enabled: true,
            bgHistory: history
          }, () => {
            showCfToast(isVideo ? '🎬 Đã áp dụng video nền mới!' : '🖼️ Đã áp dụng ảnh nền mới!', 3000);
          });
        });
      };
      reader.onerror = () => {
        showCfToast('❌ Không thể đọc tệp từ máy.', 3000);
      };
      reader.readAsDataURL(file);
    });
  }

  // Handle DOM ready and page restoration (BFCache / navigation)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!isCloudflareChallenge()) {
        startHeaderObserver();
        checkAndInit();
        if (currentCfLang === 'vi') {
          applyDynamicContentTranslation(true);
        }
        alignTableColumns();
        styleSubmissionVerdicts();
        fixSideboxFormButtons();
        styleProblemsetRows();
        highlightOnlineStatus();
        setupPageDragAndDrop();
      } else {
        teardownForCloudflare();
      }
    });
  } else {
    if (!isCloudflareChallenge()) {
      startHeaderObserver();
      checkAndInit();
      if (currentCfLang === 'vi') {
        applyDynamicContentTranslation(true);
      }
      alignTableColumns();
      styleSubmissionVerdicts();
      fixSideboxFormButtons();
      styleProblemsetRows();
      highlightOnlineStatus();
      setupPageDragAndDrop();
    }
  }

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pageshow', (event) => {
      if (event.persisted && !isCloudflareChallenge()) {
        checkAndInit();
        if (currentCfLang === 'vi') {
          applyDynamicContentTranslation(true);
        }
      }
    });

    window.addEventListener('popstate', () => {
      checkAndInit();
      if (currentCfLang === 'vi') {
        applyDynamicContentTranslation(true);
      }
    });
  }

  document.addEventListener('mouseover', (e) => {
    if (e.target && e.target.closest && e.target.closest('.second-level-menu, .second-level-menu-list, ul')) {
      removeLavaLampBack();
    }
  }, { passive: true });

  // Listen for changes from popup or background
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local') {
      // CRITICAL PERFORMANCE GUARD: Ignore background translation cache updates to prevent broadcast loops
      if (changes.cf_translation_cache) {
        return;
      }

      if (changes.cfStreak && changes.cfStreak.newValue) {
        renderStreakBadge(changes.cfStreak.newValue);
      }

      if (changes.translationEngine) {
        const newEng = changes.translationEngine.newValue || 'google';
        const changed = newEng !== currentTranslationEngine;
        currentTranslationEngine = newEng;
        if (changed && currentCfLang === 'vi') {
          currentTranslationSession++;
          if (newEng === 'gemini') {
            // Restore any Google-translated elements so AI translates them fluently
            document.querySelectorAll('[data-cf-engine="google"]').forEach(el => {
              restoreElementToOriginal(el);
            });
          }
          await applyDynamicContentTranslation(false);
          await applyDynamicContentTranslation(true);
        }
      }

      if (changes.geminiApiKey) {
        currentGeminiApiKey = changes.geminiApiKey.newValue || '';
      }

      if (changes.geminiModel) {
        currentGeminiModel = changes.geminiModel.newValue || 'auto';
      }

      if (changes.geminiCustomModel) {
        currentGeminiCustomModel = changes.geminiCustomModel.newValue || '';
      }

      if (changes.cfLang) {
        const newLang = changes.cfLang.newValue || 'en';
        currentCfLang = newLang;
        renderVietnameseFlag(newLang);
        applyVietnameseTranslation(newLang === 'vi');
      }

      // Sync visual theme & background settings ONLY when a visual setting actually changed
      const visualKeys = [
        'enabled',
        'bgType',
        'bgImage',
        'bgHistory',
        'blur',
        'brightness',
        'overlay',
        'contentOpacity',
        'bgSize',
        'themeMode'
      ];
      const hasVisualChange = visualKeys.some(k => changes[k] !== undefined);
      if (hasVisualChange) {
        chrome.storage.local.get(visualKeys, (result) => {
          applySettings(result);
        });
      }
    }
  });
})();
