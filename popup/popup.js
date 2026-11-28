(() => {
  'use strict';

  // DOM Elements - Header & Main
  const toggleEnabled = document.getElementById('toggle-enabled');
  const toggleCodeforces = document.getElementById('toggle-codeforces');
  const toggleVJudge = document.getElementById('toggle-vjudge');
  const toggleVNOJ = document.getElementById('toggle-vnoj');
  const sitesCard = document.getElementById('sites-card');
  const controlsSection = document.getElementById('controls-section');
  const btnReset = document.getElementById('btn-reset');

  // Source Tabs
  const tabBtnUpload = document.getElementById('tab-btn-upload');
  const tabBtnUrl = document.getElementById('tab-btn-url');
  const panelUpload = document.getElementById('panel-upload');
  const panelUrl = document.getElementById('panel-url');
  const btnOpenTab = document.getElementById('btn-open-tab');
  const btnGithub = document.getElementById('btn-github');
  const btnOpenUploadTab = document.getElementById('btn-open-upload-tab');
  const uploadPopupView = document.getElementById('upload-popup-view');
  const uploadTabView = document.getElementById('upload-tab-view');

  // Upload Panel
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const emptyState = document.getElementById('empty-state');

  // URL Panel
  const urlInput = document.getElementById('url-input');
  const btnApplyUrl = document.getElementById('btn-apply-url');
  const urlStatus = document.getElementById('url-status');

  // Active Preview
  const previewState = document.getElementById('preview-state');
  const previewImg = document.getElementById('preview-img');
  const previewVideo = document.getElementById('preview-video');
  const previewTypeBadge = document.getElementById('preview-type-badge');
  const btnRemove = document.getElementById('btn-remove');

  // History Elements
  const historySection = document.getElementById('history-section');
  const historyCount = document.getElementById('history-count');
  const historyList = document.getElementById('history-list');

  // Sliders
  const blurSlider = document.getElementById('blur-slider');
  const blurVal = document.getElementById('blur-val');
  const overlaySlider = document.getElementById('overlay-slider');
  const overlayVal = document.getElementById('overlay-val');
  const opacitySlider = document.getElementById('opacity-slider');
  const opacityVal = document.getElementById('opacity-val');

  // Theme Mode Options
  const themeVal = document.getElementById('theme-val');
  const themeOptions = document.getElementById('theme-options');
  const themeBtns = themeOptions ? themeOptions.querySelectorAll('.pill-btn') : [];

  // Translation Engine Options
  const transEngineBadge = document.getElementById('trans-engine-badge');
  const transEngineOptions = document.getElementById('trans-engine-options');
  const transEngineBtns = transEngineOptions ? transEngineOptions.querySelectorAll('.pill-btn') : [];
  const geminiKeyContainer = document.getElementById('gemini-key-container');
  const geminiApiKeyInput = document.getElementById('gemini-api-key');
  const btnToggleKeyVisibility = document.getElementById('btn-toggle-key-visibility');
  const geminiModelSelect = document.getElementById('gemini-model-select');
  const geminiCustomModelContainer = document.getElementById('gemini-custom-model-container');
  const geminiCustomModelInput = document.getElementById('gemini-custom-model');
  const btnTestGemini = document.getElementById('btn-test-gemini');
  const geminiTestStatus = document.getElementById('gemini-test-status');
  const xkiroKeyContainer = document.getElementById('xkiro-key-container');
  const xkiroApiKeyInput = document.getElementById('xkiro-api-key');
  const xkiroModelInput = document.getElementById('xkiro-model');
  const btnToggleXkiroVisibility = document.getElementById('btn-toggle-xkiro-visibility');
  const btnTestXkiro = document.getElementById('btn-test-xkiro');
  const xkiroTestStatus = document.getElementById('xkiro-test-status');

  // Size Options
  const sizeOptions = document.getElementById('size-options');
  const pillBtns = sizeOptions.querySelectorAll('.pill-btn');

  // Streak elements
  const popupStreakBadge = document.getElementById('popup-streak-badge');
  const statCurrentStreak = document.getElementById('stat-current-streak');
  const statStreakSubs = document.getElementById('stat-streak-subs');
  const statMaxStreak = document.getElementById('stat-max-streak');
  const statTotalDays = document.getElementById('stat-total-days');
  const popupStreakStatus = document.getElementById('popup-streak-status');

  // Update banner elements
  const updateBanner = document.getElementById('update-banner');
  const updateTitle = document.getElementById('update-title');
  const updateDesc = document.getElementById('update-desc');
  const updateTag = document.getElementById('update-tag');
  const btnUpdateNow = document.getElementById('btn-update-now');

  const DEFAULT_BG = chrome.runtime.getURL('assets/default-bg.webm');
  const DEFAULT_THUMB = chrome.runtime.getURL('assets/default-thumb.jpg');
  const SAMPLE_CAT_BG = chrome.runtime.getURL('assets/chilling-cat.webm');
  const SAMPLE_CAT_THUMB = chrome.runtime.getURL('assets/chilling-cat-thumb.jpg');

  const DEFAULT_SETTINGS = {
    enabled: true,
    enableCodeforces: true,
    enableVJudge: true,
    enableVNOJ: true,
    bgType: 'video',
    bgImage: DEFAULT_BG,
    bgHistory: [
      {
        id: 'default_gargantua_1080p',
        type: 'video',
        url: DEFAULT_BG,
        name: 'Interstellar Gargantua (1080p Full HD)',
        thumbnail: DEFAULT_THUMB,
        hasCache: true,
        timestamp: Date.now()
      },
      {
        id: 'sample_chilling_cat_1080p',
        type: 'video',
        url: SAMPLE_CAT_BG,
        name: 'Chilling Cat (Live Wallpaper)',
        thumbnail: SAMPLE_CAT_THUMB,
        hasCache: true,
        timestamp: Date.now() - 1000
      }
    ],
    blur: 0,
    brightness: 100,
    overlay: 0,
    contentOpacity: 16,
    bgSize: 'cover',
    themeMode: 'dark',
    translationEngine: 'google',
    geminiApiKey: '',
    geminiModel: 'auto',
    geminiCustomModel: '',
    xkiroApiKey: '',
    xkiroModel: 'qwen/qwen3.8-omni-flash:free'
  };

  let currentSettings = { ...DEFAULT_SETTINGS };

  function showAlert(msg) {
    if (typeof alert !== 'undefined') {
      try { alert(msg); } catch (e) {}
    } else {
      console.warn('[CF Alert]', msg);
    }
  }

  function extractYouTubeId(url) {
    if (!url || typeof url !== 'string') return null;
    const regExp = /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  }

  function getYouTubeEmbedUrl(videoId) {
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&iv_load_policy=3&disablekb=1&modestbranding=1&playsinline=1&enablejsapi=1`;
  }

  function isVideoSource(type, url) {
    if (type === 'youtube') return false;
    if (type === 'video') return true;
    if (type === 'image') return false;
    if (!url || typeof url !== 'string') return false;
    if (url.includes('assets/default-bg') || url.includes('assets/chilling-cat')) return true;
    if (extractYouTubeId(url)) return false;
    if (url.startsWith('data:video/')) return true;
    return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url);
  }

  // Helper to optimize large images using canvas
  function processImageFile(file) {
    return new Promise((resolve, reject) => {
      const isGifOrSvg = (file.type === 'image/gif' || file.type === 'image/svg+xml') ||
                         /\.(gif|svg)$/i.test(file.name || '');
      const reader = new FileReader();
      reader.onload = (e) => {
        if (isGifOrSvg) {
          return resolve(e.target.result);
        }
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 2560; // Max 2K resolution
          let width = img.width;
          let height = img.height;
          const needsResize = width > MAX_DIM || height > MAX_DIM;
          const isLarge = file.size > 1.5 * 1024 * 1024;

          if (needsResize || isLarge) {
            if (needsResize) {
              if (width > height) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              } else {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }

            try {
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.90));
            } catch (canvasErr) {
              resolve(e.target.result);
            }
          } else {
            resolve(e.target.result);
          }
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Lỗi khi đọc file.'));
      reader.readAsDataURL(file);
    });
  }

  // Generate thumbnail from an image
  function generateImageThumbnail(imgUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 120;
          canvas.height = Math.round((img.naturalHeight / img.naturalWidth) * 120) || 75;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } catch (e) {
          resolve(imgUrl);
        }
      };
      img.onerror = () => resolve(imgUrl);
      img.src = imgUrl;
    });
  }

  // Generate thumbnail from a video file or URL
  function generateVideoThumbnail(fileOrUrl) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      const isBlob = typeof fileOrUrl !== 'string';
      const srcUrl = isBlob && typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(fileOrUrl) : (typeof fileOrUrl === 'string' ? fileOrUrl : '');
      video.src = srcUrl;

      let finished = false;
      const cleanup = () => {
        if (isBlob && typeof URL !== 'undefined' && URL.revokeObjectURL && srcUrl) {
          try { URL.revokeObjectURL(srcUrl); } catch (e) {}
        }
      };

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          cleanup();
          resolve('');
        }
      }, 3500);

      video.onloadeddata = () => {
        try {
          video.currentTime = Math.min(0.5, (video.duration || 1) / 3);
        } catch (e) {}
      };

      video.onseeked = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 120;
          canvas.height = Math.round((video.videoHeight / video.videoWidth) * 120) || 75;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumb = canvas.toDataURL('image/jpeg', 0.7);
          cleanup();
          resolve(thumb);
        } catch (e) {
          cleanup();
          resolve('');
        }
      };

      video.onerror = () => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          cleanup();
          resolve('');
        }
      };
    });
  }

  function renderPreviewMedia(settings, mediaUrl) {
    previewState.classList.remove('hidden');
    const ytId = extractYouTubeId(mediaUrl);
    const isYouTube = settings.bgType === 'youtube' || Boolean(ytId);
    const isVideo = isYouTube ? false : isVideoSource(settings.bgType, mediaUrl);

    if (isYouTube && ytId) {
      previewTypeBadge.textContent = '🎬 YouTube Video (Lặp lại)';
      previewVideo.classList.add('hidden');
      previewVideo.pause();
      previewImg.classList.remove('hidden');
      previewImg.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    } else if (isVideo) {
      previewTypeBadge.textContent = '🎬 Video nền (Lặp lại)';
      previewImg.classList.add('hidden');
      previewVideo.classList.remove('hidden');

      let resolvedMediaUrl = mediaUrl;
      if (typeof mediaUrl === 'string') {
        if (mediaUrl.includes('assets/chilling-cat')) {
          resolvedMediaUrl = SAMPLE_CAT_BG;
        } else if (mediaUrl.includes('assets/default-bg')) {
          resolvedMediaUrl = DEFAULT_BG;
        }
      }

      if (previewVideo.src !== resolvedMediaUrl) {
        previewVideo.src = resolvedMediaUrl;
        previewVideo.load();
      }
      previewVideo.muted = true;
      previewVideo.loop = true;
      previewVideo.play().catch(() => {});

      if (!previewVideo._cfErrorHandlerAdded) {
        previewVideo._cfErrorHandlerAdded = true;
        previewVideo.addEventListener('error', () => {
          if (previewVideo.src && previewVideo.src.includes('chilling-cat')) {
            const mp4Fallback = chrome.runtime.getURL('assets/chilling-cat.mp4');
            const webmFallback = chrome.runtime.getURL('assets/chilling-cat.webm');
            if (previewVideo.src.endsWith('.webm') && previewVideo.src !== mp4Fallback) {
              previewVideo.src = mp4Fallback;
              previewVideo.load();
              previewVideo.play().catch(() => {});
            } else if (previewVideo.src.endsWith('.mp4') && previewVideo.src !== webmFallback) {
              previewVideo.src = webmFallback;
              previewVideo.load();
              previewVideo.play().catch(() => {});
            }
          }
        });
      }
    } else {
      previewTypeBadge.textContent = '🖼️ Ảnh nền';
      previewVideo.classList.add('hidden');
      previewVideo.pause();
      previewImg.classList.remove('hidden');
      previewImg.src = mediaUrl;
    }
  }

  // Update UI components to match state
  function updateUI(settings) {
    toggleEnabled.checked = settings.enabled !== false;

    if (toggleCodeforces) {
      toggleCodeforces.checked = settings.enableCodeforces !== false;
      toggleCodeforces.disabled = !settings.enabled;
    }
    if (toggleVJudge) {
      toggleVJudge.checked = settings.enableVJudge !== false;
      toggleVJudge.disabled = !settings.enabled;
    }
    if (toggleVNOJ) {
      toggleVNOJ.checked = settings.enableVNOJ !== false;
      toggleVNOJ.disabled = !settings.enabled;
    }

    if (!settings.enabled) {
      controlsSection.classList.add('disabled-opacity');
      if (sitesCard) sitesCard.classList.add('disabled-opacity');
      if (previewState) previewState.classList.add('disabled-opacity');
    } else {
      controlsSection.classList.remove('disabled-opacity');
      if (sitesCard) sitesCard.classList.remove('disabled-opacity');
      if (previewState) previewState.classList.remove('disabled-opacity');
    }

    // Active Background Preview
    if (settings.bgImage && typeof settings.bgImage === 'string' && settings.bgImage.startsWith('cf_cache_')) {
      chrome.storage.local.get([settings.bgImage], (res) => {
        const cached = res && res[settings.bgImage];
        if (cached) {
          renderPreviewMedia(settings, cached);
        }
      });
    } else if (settings.bgImage) {
      renderPreviewMedia(settings, settings.bgImage);
    } else {
      previewState.classList.add('hidden');
      previewVideo.pause();
      previewImg.src = '';
    }

    // Render History (Max 5 items)
    renderHistoryUI(settings.bgHistory || [], settings.bgImage);

    // Sliders
    const blur = settings.blur ?? 0;
    blurSlider.value = blur;
    blurVal.textContent = `${blur}px`;

    const overlay = settings.overlay ?? 0;
    overlaySlider.value = overlay;
    overlayVal.textContent = `${overlay}%`;

    const opacity = settings.contentOpacity ?? 16;
    opacitySlider.value = opacity;
    opacityVal.textContent = `${opacity}%`;

    // Size mode pills
    const size = settings.bgSize || 'cover';
    pillBtns.forEach(btn => {
      if (btn.dataset.size === size) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Theme mode pills (Dark Reader)
    const theme = settings.themeMode || 'dark';
    if (themeVal) themeVal.textContent = theme === 'dark' ? 'Tối' : 'Sáng';
    themeBtns.forEach(btn => {
      if (btn.dataset.theme === theme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Translation Engine pills
    const engine = settings.translationEngine || 'google';
    if (transEngineBadge) {
      if (engine === 'gemini') {
        transEngineBadge.textContent = 'Gemini AI';
      } else if (engine === 'xkiro') {
        transEngineBadge.textContent = 'xKiro';
      } else {
        transEngineBadge.textContent = 'Google';
      }
    }
    transEngineBtns.forEach(btn => {
      if (btn.dataset.engine === engine) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    if (geminiKeyContainer) {
      if (engine === 'gemini') {
        geminiKeyContainer.classList.remove('hidden');
      } else {
        geminiKeyContainer.classList.add('hidden');
      }
    }
    if (xkiroKeyContainer) {
      if (engine === 'xkiro') {
        xkiroKeyContainer.classList.remove('hidden');
      } else {
        xkiroKeyContainer.classList.add('hidden');
      }
    }
    if (geminiApiKeyInput) {
      geminiApiKeyInput.value = settings.geminiApiKey || '';
    }
    if (xkiroApiKeyInput) {
      xkiroApiKeyInput.value = settings.xkiroApiKey || '';
    }
    if (xkiroModelInput) {
      xkiroModelInput.value = settings.xkiroModel || 'qwen/qwen3.8-omni-flash:free';
    }
    const currentModel = settings.geminiModel || 'auto';
    if (geminiModelSelect) {
      const options = Array.from(geminiModelSelect.options || []);
      const exists = options.some(o => o.value === currentModel);
      if (!exists && currentModel && currentModel !== 'custom') {
        const customOption = geminiModelSelect.querySelector ? geminiModelSelect.querySelector('option[value="custom"]') : null;
        const opt = document.createElement('option');
        opt.value = currentModel;
        opt.textContent = `${currentModel} (Đã lưu)`;
        if (customOption && customOption.parentNode) {
          customOption.parentNode.insertBefore(opt, customOption);
        } else if (geminiModelSelect.appendChild) {
          geminiModelSelect.appendChild(opt);
        }
      }
      geminiModelSelect.value = currentModel;
    }

    if (geminiCustomModelInput) {
      geminiCustomModelInput.value = settings.geminiCustomModel || '';
    }
    if (geminiCustomModelContainer) {
      if (currentModel === 'custom') {
        geminiCustomModelContainer.classList.remove('hidden');
      } else {
        geminiCustomModelContainer.classList.add('hidden');
      }
    }

    // Update streak card
    if (settings.cfStreak) {
      updateStreakUI(settings.cfStreak);
    }
  }

  function renderHistoryUI(history, activeUrl) {
    historyList.innerHTML = '';
    const items = (history || []).slice(0, 5);
    historyCount.textContent = `${items.length}/5`;

    if (items.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'history-empty';
      emptyMsg.textContent = 'Chưa có nền nào được lưu trong lịch sử.';
      historyList.appendChild(emptyMsg);
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      const isActive = (currentSettings.bgImageId && item.id === currentSettings.bgImageId) ||
                       (item.url === activeUrl) ||
                       (activeUrl && activeUrl === 'cf_cache_' + item.id);
      card.className = 'history-item' + (isActive ? ' active' : '');
      card.title = `${item.name || (item.type === 'video' ? 'Video nền' : 'Ảnh nền')} - Nhấp để áp dụng ngay`;

      // Thumbnail
      const thumb = document.createElement('img');
      thumb.className = 'history-thumb';
      thumb.alt = item.name || 'History preview';
      thumb.src = item.thumbnail || (item.type === 'image' ? item.url : '');
      card.appendChild(thumb);

      // Type Badge
      const badge = document.createElement('span');
      badge.className = 'history-badge';
      if (item.type === 'youtube') {
        badge.textContent = '▶ YouTube';
      } else if (item.type === 'video') {
        badge.textContent = item.hasCache ? '▶ Video ⚡' : '▶ Video';
      } else {
        badge.textContent = item.hasCache ? 'Ảnh ⚡' : 'Ảnh';
      }
      if (item.hasCache) {
        badge.title = 'Đã lưu cục bộ (phát tức thì offline)';
      }
      card.appendChild(badge);

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'history-del-btn';
      delBtn.title = 'Xóa khỏi lịch sử';
      delBtn.textContent = '×';
      delBtn.onclick = (e) => {
        e.stopPropagation();
        deleteHistoryItem(item.id);
      };
      card.appendChild(delBtn);

      // Click to apply background
      card.onclick = () => {
        selectHistoryItem(item);
      };

      historyList.appendChild(card);
    });
  }

  function updateStreakUI(streak) {
    if (!streak || !streak.handle) {
      popupStreakBadge.textContent = 'Chưa đăng nhập';
      popupStreakStatus.textContent = 'Đăng nhập Codeforces để theo dõi chuỗi nộp bài';
      popupStreakStatus.className = 'streak-msg';
      return;
    }

    statCurrentStreak.textContent = streak.currentStreak ?? 0;
    if (statStreakSubs) {
      statStreakSubs.textContent = streak.streakSubmissionsCount ?? 0;
    }
    statMaxStreak.textContent = streak.maxStreak ?? 0;
    statTotalDays.textContent = streak.totalActiveDays ?? 0;

    popupStreakBadge.textContent = `@${streak.handle}`;

    if (streak.currentStreak > 0) {
      if (streak.hasSubmittedToday) {
        popupStreakStatus.textContent = '✔️ Đã nộp bài hôm nay! Chuỗi đang duy trì rất tốt.';
        popupStreakStatus.className = 'streak-msg done';
      } else {
        popupStreakStatus.textContent = '⏳ Hôm nay chưa nộp bài! Đừng quên nộp để giữ chuỗi.';
        popupStreakStatus.className = 'streak-msg pending';
      }
    } else {
      popupStreakStatus.textContent = '💤 Chuỗi hiện tại: 0 ngày. Hãy nộp một bài để bắt đầu chuỗi mới!';
      popupStreakStatus.className = 'streak-msg';
    }
  }

  function renderUpdateBanner(info) {
    if (!updateBanner) return;
    if (info && info.hasUpdate) {
      updateBanner.style.display = 'flex';
      if (updateTitle) {
        if (info.updateType === 'stable_hotfix') {
          updateTitle.textContent = 'Bản vá khẩn cấp (Hotfix)';
        } else if (info.updateType === 'alpha_hotfix') {
          updateTitle.textContent = 'Bản vá lỗi Alpha (Hotfix)';
        } else if (info.updateType === 'alpha_trial') {
          updateTitle.textContent = 'Bản thử nghiệm mới!';
        } else if (info.isTestToOfficial || info.updateType === 'official') {
          updateTitle.textContent = 'Đã có bản chính thức!';
        } else {
          updateTitle.textContent = 'Có bản cập nhật mới!';
        }
      }
      if (updateDesc) {
        updateDesc.textContent = info.message || (
          info.isTestToOfficial
            ? `Bản chính thức (${info.remoteVersionName}) đã sẵn sàng thay thế bản Alpha hiện tại.`
            : `Đã có phiên bản ${info.remoteVersionName} trên GitHub.`
        );
      }
      if (updateTag) {
        if (info.updateType === 'stable_hotfix') {
          updateTag.textContent = 'HOTFIX';
          updateTag.className = 'update-tag tag-hotfix';
        } else if (info.updateType === 'alpha_hotfix') {
          updateTag.textContent = 'ALPHA HF';
          updateTag.className = 'update-tag tag-hotfix';
        } else if (info.updateType === 'alpha_trial') {
          updateTag.textContent = 'ALPHA';
          updateTag.className = 'update-tag tag-alpha';
        } else if (info.isTestToOfficial || info.updateType === 'official') {
          updateTag.textContent = 'OFFICIAL';
          updateTag.className = 'update-tag tag-official';
        } else {
          updateTag.textContent = info.remoteVersionName || 'NEW';
          updateTag.className = 'update-tag';
        }
      }
      if (btnUpdateNow) {
        const btnSpan = btnUpdateNow.querySelector('span');
        if (btnSpan) {
          btnSpan.textContent = 'Áp dụng ngay';
        }
      }
    } else {
      updateBanner.style.display = 'none';
    }
  }

  function checkUpdates() {
    try {
      const manifest = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) ? chrome.runtime.getManifest() : null;
      const versionEl = document.querySelector('.version-tag');
      if (versionEl && manifest) {
        versionEl.textContent = manifest.version_name || manifest.version || 'v1.2.0';
      }
    } catch (e) {}

    if (typeof chrome === 'undefined' || !chrome.storage) return;
    chrome.storage.local.get(['cfUpdateInfo'], (res) => {
      if (res && res.cfUpdateInfo) {
        renderUpdateBanner(res.cfUpdateInfo);
      }
    });

    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'checkForUpdates' }, (response) => {
          if (chrome.runtime && chrome.runtime.lastError) return;
          if (response && response.success) {
            renderUpdateBanner(response);
          }
        });
      }
    } catch (e) {
      // Ignore
    }
  }

  // Sanitize history array before sending to storage so giant Data URLs aren't duplicated
  function sanitizeHistoryForStorage(history) {
    if (!Array.isArray(history)) return [];
    return history.map(item => {
      if (!item) return item;
      if (item.url && item.url.startsWith('data:') && item.url.length > 50000) {
        return {
          ...item,
          url: 'cf_cache_' + item.id,
          hasCache: true
        };
      }
      return item;
    });
  }

  // Save changes to chrome.storage
  function saveSettings(partial, callback) {
    Object.assign(currentSettings, partial);

    const payload = { ...currentSettings };
    if (payload.bgHistory) {
      payload.bgHistory = sanitizeHistoryForStorage(payload.bgHistory);
    }

    try {
      chrome.storage.local.set(payload, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn('Storage save warning:', chrome.runtime.lastError.message);
        }
        if (typeof callback === 'function') callback();
      });
    } catch (e) {
      console.error('Storage set error:', e);
    }
  }

  // Apply new background and record into history (Max 5 items)
  function applyAndSaveBackground(item) {
    let history = currentSettings.bgHistory || [];
    // Remove if same URL or name already exists
    history = history.filter(h => h.url !== item.url && h.name !== item.name);

    const isData = item.url && item.url.startsWith('data:');
    const isYouTube = item.type === 'youtube';
    const id = Date.now().toString();

    const newItem = {
      id,
      type: item.type,
      url: isData ? ('cf_cache_' + id) : item.url,
      name: item.name || (item.type === 'video' ? 'Video nền' : 'Ảnh nền'),
      thumbnail: item.thumbnail || (item.type === 'image' && !isData ? item.url : ''),
      hasCache: isData,
      timestamp: Date.now()
    };

    // Prepend new background to top
    history.unshift(newItem);

    // If already a Data URL (uploaded file), save to local cache directly
    if (isData) {
      try {
        chrome.storage.local.set({ ['cf_cache_' + id]: item.url }, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.error('Cache save error:', chrome.runtime.lastError.message);
            showAlert('Không thể lưu tệp vào bộ nhớ: ' + chrome.runtime.lastError.message);
          }
        });
      } catch (e) {
        console.error('Cache write failed:', e);
      }
    }

    // Strict limit: at most 6 items. Delete caches of items beyond 6
    if (history.length > 6) {
      const removed = history.slice(6);
      const keysToRemove = removed.map(r => 'cf_cache_' + r.id);
      chrome.storage.local.remove(keysToRemove);
      history = history.slice(0, 6);
    }

    saveSettings({
      bgType: item.type,
      bgImage: item.url,
      bgImageId: id,
      enabled: true,
      bgHistory: history
    });

    updateUI(currentSettings);

    // If online network URL (video/image), kick off background caching in Service Worker
    if (!isData && !isYouTube && item.url.startsWith('http')) {
      try {
        chrome.runtime.sendMessage({
          action: 'cacheMedia',
          id,
          url: item.url,
          type: item.type
        });
      } catch (e) {}
    }
  }

  function selectHistoryItem(item) {
    let targetUrl = item.url;
    if (item.id === 'sample_chilling_cat_1080p' || (targetUrl && targetUrl.includes('assets/chilling-cat'))) {
      targetUrl = SAMPLE_CAT_BG;
    } else if (item.id === 'default_gargantua_1080p' || (targetUrl && targetUrl.includes('assets/default-bg'))) {
      targetUrl = DEFAULT_BG;
    }

    if (item.hasCache || (targetUrl && targetUrl.startsWith('cf_cache_'))) {
      const cacheKey = (targetUrl && targetUrl.startsWith('cf_cache_')) ? targetUrl : ('cf_cache_' + item.id);
      chrome.storage.local.get([cacheKey], (res) => {
        const cached = res && res[cacheKey];
        if (cached) {
          saveSettings({
            bgType: item.type,
            bgImage: cached,
            bgImageOriginal: targetUrl,
            bgImageId: item.id,
            enabled: true
          });
          currentSettings.bgImage = cached;
          currentSettings.bgImageId = item.id;
          updateUI(currentSettings);
        } else if (targetUrl && !targetUrl.startsWith('cf_cache_')) {
          saveSettings({
            bgType: item.type,
            bgImage: targetUrl,
            bgImageId: item.id,
            enabled: true
          });
          currentSettings.bgImage = targetUrl;
          currentSettings.bgImageId = item.id;
          updateUI(currentSettings);
        }
      });
    } else {
      saveSettings({
        bgType: item.type,
        bgImage: targetUrl,
        bgImageId: item.id,
        enabled: true
      });
      currentSettings.bgImage = targetUrl;
      currentSettings.bgImageId = item.id;
      updateUI(currentSettings);

      if (!item.url.startsWith('data:') && item.type !== 'youtube' && item.url.startsWith('http')) {
        try {
          chrome.runtime.sendMessage({
            action: 'cacheMedia',
            id: item.id,
            url: item.url,
            type: item.type
          });
        } catch (e) {}
      }
    }
  }

  function deleteHistoryItem(id) {
    chrome.storage.local.remove(['cf_cache_' + id]);
    let history = (currentSettings.bgHistory || []).filter(h => h.id !== id);
    saveSettings({ bgHistory: history });
    renderHistoryUI(history, currentSettings.bgImage);
  }

  // Load saved settings on popup open
  chrome.storage.local.get(null, (items) => {
    if (items && items.contentOpacity && items.contentOpacity > 35) {
      items.contentOpacity = 16;
      chrome.storage.local.set({ contentOpacity: 16 });
    }

    currentSettings = { ...DEFAULT_SETTINGS, ...items };

    // If currently using the YouTube link of 784dsKVrdjQ or no background, upgrade to the local 1080p video!
    if (!currentSettings.bgImage || (typeof currentSettings.bgImage === 'string' && currentSettings.bgImage.includes('784dsKVrdjQ'))) {
      currentSettings.bgType = 'video';
      currentSettings.bgImage = DEFAULT_BG;
      chrome.storage.local.set({ bgType: 'video', bgImage: DEFAULT_BG });
    }

    // Automatic migration & normalization for bundled video backgrounds:
    if (typeof currentSettings.bgImage === 'string') {
      if (currentSettings.bgImage.includes('assets/chilling-cat')) {
        if (currentSettings.bgImage !== SAMPLE_CAT_BG || currentSettings.bgType !== 'video') {
          currentSettings.bgImage = SAMPLE_CAT_BG;
          currentSettings.bgType = 'video';
          chrome.storage.local.set({ bgType: 'video', bgImage: SAMPLE_CAT_BG });
        }
      } else if (currentSettings.bgImage.includes('assets/default-bg')) {
        if (currentSettings.bgImage !== DEFAULT_BG || currentSettings.bgType !== 'video') {
          currentSettings.bgImage = DEFAULT_BG;
          currentSettings.bgType = 'video';
          chrome.storage.local.set({ bgType: 'video', bgImage: DEFAULT_BG });
        }
      }
    }

    // Ensure default samples (Gargantua 1080p & Chilling Cat) are in history
    let history = currentSettings.bgHistory || [];
    let historyChanged = false;

    // Migrate any legacy/outdated sample URLs in history to current bundled assets
    history.forEach(h => {
      if (h.id === 'sample_chilling_cat_1080p' || (h.url && h.url.includes('assets/chilling-cat'))) {
        if (h.url !== SAMPLE_CAT_BG || h.thumbnail !== SAMPLE_CAT_THUMB) {
          h.url = SAMPLE_CAT_BG;
          h.thumbnail = SAMPLE_CAT_THUMB;
          historyChanged = true;
        }
      }
      if (h.id === 'default_gargantua_1080p' || (h.url && h.url.includes('assets/default-bg'))) {
        if (h.url !== DEFAULT_BG || h.thumbnail !== DEFAULT_THUMB) {
          h.url = DEFAULT_BG;
          h.thumbnail = DEFAULT_THUMB;
          historyChanged = true;
        }
      }
    });

    if (!history.some(h => h.url === DEFAULT_BG || h.id === 'default_gargantua_1080p')) {
      history.unshift({
        id: 'default_gargantua_1080p',
        type: 'video',
        url: DEFAULT_BG,
        name: 'Interstellar Gargantua (1080p Full HD)',
        thumbnail: DEFAULT_THUMB,
        hasCache: true,
        timestamp: Date.now()
      });
      historyChanged = true;
    }
    if (!history.some(h => h.url === SAMPLE_CAT_BG || h.id === 'sample_chilling_cat_1080p')) {
      history.push({
        id: 'sample_chilling_cat_1080p',
        type: 'video',
        url: SAMPLE_CAT_BG,
        name: 'Chilling Cat (Live Wallpaper)',
        thumbnail: SAMPLE_CAT_THUMB,
        hasCache: true,
        timestamp: Date.now() - 1000
      });
      historyChanged = true;
    }
    if (history.length > 6) {
      history = history.slice(0, 6);
      historyChanged = true;
    }
    if (historyChanged) {
      currentSettings.bgHistory = history;
      chrome.storage.local.set({ bgHistory: history });
    }

    updateUI(currentSettings);
    checkUpdates();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.cfStreak) {
      updateStreakUI(changes.cfStreak.newValue);
    }
    if (area === 'local' && changes.cfUpdateInfo) {
      renderUpdateBanner(changes.cfUpdateInfo.newValue);
    }
  });

  // Toggle master enable/disable
  toggleEnabled.addEventListener('change', () => {
    saveSettings({ enabled: toggleEnabled.checked });
    updateUI(currentSettings);
  });

  if (toggleCodeforces) {
    toggleCodeforces.addEventListener('change', () => {
      saveSettings({ enableCodeforces: toggleCodeforces.checked });
      updateUI(currentSettings);
    });
  }

  if (toggleVJudge) {
    toggleVJudge.addEventListener('change', () => {
      saveSettings({ enableVJudge: toggleVJudge.checked });
      updateUI(currentSettings);
    });
  }

  if (toggleVNOJ) {
    toggleVNOJ.addEventListener('change', () => {
      saveSettings({ enableVNOJ: toggleVNOJ.checked });
      updateUI(currentSettings);
    });
  }

  // Source Tabs Navigation
  tabBtnUpload.addEventListener('click', () => {
    tabBtnUpload.classList.add('active');
    tabBtnUrl.classList.remove('active');
    panelUpload.classList.remove('hidden');
    panelUrl.classList.add('hidden');
  });

  tabBtnUrl.addEventListener('click', () => {
    tabBtnUrl.classList.add('active');
    tabBtnUpload.classList.remove('active');
    panelUrl.classList.remove('hidden');
    panelUpload.classList.add('hidden');
  });

  // Dedicated Tab for File Upload (avoids Chromium closing popup on file picker focus loss)
  function openDedicatedTab() {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html?tab=upload') });
    }
  }

  // Open GitHub Repository
  function openGithubRepo() {
    const ghUrl = 'https://github.com/PTK-2411/oj-effect';
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: ghUrl });
    } else if (typeof window !== 'undefined') {
      window.open(ghUrl, '_blank');
    }
  }

  if (btnOpenTab) btnOpenTab.addEventListener('click', openDedicatedTab);
  if (btnGithub) btnGithub.addEventListener('click', openGithubRepo);
  if (btnOpenUploadTab) {
    btnOpenUploadTab.addEventListener('click', (e) => {
      e.stopPropagation();
      openDedicatedTab();
    });
  }
  if (uploadPopupView) {
    uploadPopupView.addEventListener('click', () => {
      openDedicatedTab();
    });
  }

  const isDedicatedTab = (typeof window !== 'undefined' && window.location && window.location.search && (window.location.search.includes('tab=1') || window.location.search.includes('tab=upload'))) ||
                         (typeof window !== 'undefined' && window.innerWidth > 450);
  if (isDedicatedTab && typeof document !== 'undefined' && document.body) {
    if (document.body.classList) document.body.classList.add('is-tab');
    if (uploadPopupView && uploadPopupView.classList) uploadPopupView.classList.add('hidden');
    if (uploadTabView && uploadTabView.classList) uploadTabView.classList.remove('hidden');
    if (btnOpenTab) btnOpenTab.style.display = 'none';
  } else {
    if (uploadPopupView && uploadPopupView.classList) uploadPopupView.classList.remove('hidden');
    if (uploadTabView && uploadTabView.classList) uploadTabView.classList.add('hidden');
  }

  function setDropzoneLoading(loading, message) {
    if (!dropzone) return;
    const titleEl = dropzone.querySelector ? dropzone.querySelector('.upload-title') : null;
    const subEl = dropzone.querySelector ? dropzone.querySelector('.upload-sub') : null;
    if (loading) {
      dropzone.classList.add('loading');
      if (titleEl) {
        if (!titleEl._origText) titleEl._origText = titleEl.textContent;
        titleEl.textContent = message || '⏳ Đang xử lý tệp...';
      }
      if (subEl) {
        if (!subEl._origText) subEl._origText = subEl.textContent;
        subEl.textContent = 'Vui lòng chờ trong giây lát';
      }
    } else {
      dropzone.classList.remove('loading');
      if (titleEl && titleEl._origText) {
        titleEl.textContent = titleEl._origText;
        delete titleEl._origText;
      }
      if (subEl && subEl._origText) {
        subEl.textContent = subEl._origText;
        delete subEl._origText;
      }
    }
  }

  // File selection handling (Image & Video)
  async function handleFile(file) {
    if (!file) return;

    const fileName = (file.name || '').toLowerCase();
    const isVideo = (file.type && file.type.startsWith('video/')) ||
                    /\.(mp4|webm|mov|mkv|m4v|ogg)$/i.test(fileName);
    const isImage = (file.type && file.type.startsWith('image/')) ||
                    /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)$/i.test(fileName);

    if (!isVideo && !isImage) {
      showAlert('Vui lòng chọn tệp hình ảnh (JPG, PNG, GIF, WebP) hoặc video (MP4, WebM).');
      return;
    }

    if (isVideo && file.size > 40 * 1024 * 1024) {
      showAlert('Kích thước video tải lên từ máy nên dưới 40MB để đảm bảo hiệu năng và không vượt quá giới hạn bộ nhớ của trình duyệt.\n\nNếu video lớn hơn, bạn hãy chuyển sang tab "Nhập liên kết" (dán link YouTube hoặc URL trực tiếp) nhé!');
      return;
    }

    if (isImage && file.size > 25 * 1024 * 1024) {
      showAlert('Kích thước ảnh quá lớn (>25MB). Vui lòng chọn ảnh dung lượng nhỏ hơn.');
      return;
    }

    setDropzoneLoading(true, isVideo ? '⏳ Đang nạp video...' : '⏳ Đang tối ưu hóa ảnh...');

    try {
      if (isVideo) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const videoDataUrl = e.target.result;
            const thumb = await generateVideoThumbnail(file);
            applyAndSaveBackground({
              type: 'video',
              url: videoDataUrl,
              name: file.name,
              thumbnail: thumb
            });
          } catch (readErr) {
            console.error(readErr);
            showAlert('Đã xảy ra lỗi khi xử lý video.');
          } finally {
            setDropzoneLoading(false);
          }
        };
        reader.onerror = () => {
          setDropzoneLoading(false);
          showAlert('Không thể đọc tệp video từ máy.');
        };
        reader.readAsDataURL(file);
      } else {
        const dataUrl = await processImageFile(file);
        const thumb = await generateImageThumbnail(dataUrl);
        applyAndSaveBackground({
          type: 'image',
          url: dataUrl,
          name: file.name,
          thumbnail: thumb
        });
        setDropzoneLoading(false);
      }
    } catch (err) {
      console.error(err);
      setDropzoneLoading(false);
      showAlert('Đã xảy ra lỗi khi tải tệp lên: ' + (err.message || err));
    }
  }

  dropzone.addEventListener('click', () => {
    if (dropzone.classList.contains('loading')) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
    try { fileInput.value = ''; } catch (err) {}
  });

  // Drag and Drop
  ['dragenter', 'dragover'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // Handle URL Link input
  async function handleUrlInput() {
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      urlStatus.textContent = '⚠️ Vui lòng dán liên kết ảnh, video hoặc YouTube hợp lệ.';
      urlStatus.className = 'url-status-hint error';
      return;
    }

    if (!/^https?:\/\//i.test(rawUrl)) {
      urlStatus.textContent = '⚠️ Đường dẫn phải bắt đầu bằng http:// hoặc https://';
      urlStatus.className = 'url-status-hint error';
      return;
    }

    urlStatus.textContent = '⏳ Đang kiểm tra liên kết...';
    urlStatus.className = 'url-status-hint';

    const ytId = extractYouTubeId(rawUrl);

    if (ytId) {
      // YouTube Link detected
      const type = 'youtube';
      const thumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      const name = `YouTube (${ytId})`;

      applyAndSaveBackground({
        type,
        url: rawUrl,
        name,
        thumbnail: thumb
      });

      urlStatus.textContent = '✔️ Đã áp dụng video YouTube làm nền thành công!';
      urlStatus.className = 'url-status-hint success';
      urlInput.value = '';

      setTimeout(() => {
        urlStatus.textContent = 'Hỗ trợ link YouTube, video trực tiếp (.mp4, .webm) hoặc ảnh';
        urlStatus.className = 'url-status-hint';
      }, 3500);
      return;
    }

    const isVideo = isVideoSource(null, rawUrl);
    const type = isVideo ? 'video' : 'image';

    let name = type === 'video' ? 'Video liên kết' : 'Ảnh liên kết';
    try {
      const parsed = new URL(rawUrl);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        name = decodeURIComponent(parts[parts.length - 1]);
      }
    } catch (e) {}

    // Apply immediately to screen so video starts playing with 0ms delay!
    applyAndSaveBackground({
      type,
      url: rawUrl,
      name,
      thumbnail: type === 'image' ? rawUrl : ''
    });

    urlStatus.textContent = type === 'video'
      ? '✔️ Đã phát video làm nền! Đang tải ngầm về máy để lưu cục bộ...'
      : '✔️ Đã áp dụng nền thành công! Đang tải ngầm về máy...';
    urlStatus.className = 'url-status-hint success';
    urlInput.value = '';

    // Generate thumbnail asynchronously in background without blocking video playback
    (async () => {
      let thumb = '';
      try {
        if (type === 'video') {
          thumb = await generateVideoThumbnail(rawUrl);
        } else {
          thumb = await generateImageThumbnail(rawUrl);
        }
        if (thumb) {
          const hist = (currentSettings.bgHistory || []).map(h => {
            if (h.url === rawUrl && !h.thumbnail) {
              return { ...h, thumbnail: thumb };
            }
            return h;
          });
          saveSettings({ bgHistory: hist });
          renderHistoryUI(hist, currentSettings.bgImage);
        }
      } catch (e) {}
    })();

    setTimeout(() => {
      urlStatus.textContent = 'Hỗ trợ link YouTube, video trực tiếp (.mp4, .webm) hoặc ảnh';
      urlStatus.className = 'url-status-hint';
    }, 4000);
  }

  btnApplyUrl.addEventListener('click', handleUrlInput);
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUrlInput();
    }
  });

  // Button actions
  btnRemove.addEventListener('click', (e) => {
    e.stopPropagation();
    saveSettings({ bgImage: null, bgImageId: null });
    updateUI(currentSettings);
    fileInput.value = '';
  });

  btnReset.addEventListener('click', () => {
    saveSettings({
      blur: DEFAULT_SETTINGS.blur,
      overlay: DEFAULT_SETTINGS.overlay,
      contentOpacity: DEFAULT_SETTINGS.contentOpacity,
      bgSize: DEFAULT_SETTINGS.bgSize,
      themeMode: DEFAULT_SETTINGS.themeMode,
      enableCodeforces: true,
      enableVJudge: true,
      enableVNOJ: true
    });
    updateUI(currentSettings);
  });

  // Sliders input events
  blurSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    blurVal.textContent = `${val}px`;
    saveSettings({ blur: val });
  });

  overlaySlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    overlayVal.textContent = `${val}%`;
    saveSettings({ overlay: val });
  });

  opacitySlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    opacityVal.textContent = `${val}%`;
    saveSettings({ contentOpacity: val });
  });

  // Background size pills
  pillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const size = btn.dataset.size;
      pillBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      saveSettings({ bgSize: size });
    });
  });

  // Theme mode pills (Dark Reader)
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.theme;
      themeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (themeVal) themeVal.textContent = mode === 'dark' ? 'Tối' : 'Sáng';
      saveSettings({ themeMode: mode });
    });
  });

  // Translation Engine pills
  transEngineBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const engine = btn.dataset.engine;
      transEngineBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (transEngineBadge) {
        if (engine === 'gemini') {
          transEngineBadge.textContent = 'Gemini AI';
        } else if (engine === 'xkiro') {
          transEngineBadge.textContent = 'xKiro';
        } else {
          transEngineBadge.textContent = 'Google';
        }
      }
      if (geminiKeyContainer) {
        if (engine === 'gemini') {
          geminiKeyContainer.classList.remove('hidden');
        } else {
          geminiKeyContainer.classList.add('hidden');
        }
      }
      if (xkiroKeyContainer) {
        if (engine === 'xkiro') {
          xkiroKeyContainer.classList.remove('hidden');
        } else {
          xkiroKeyContainer.classList.add('hidden');
        }
      }
      saveSettings({ translationEngine: engine });
    });
  });

  // Gemini API Key & Options
  if (btnToggleKeyVisibility && geminiApiKeyInput) {
    btnToggleKeyVisibility.addEventListener('click', () => {
      const isPass = geminiApiKeyInput.type === 'password';
      geminiApiKeyInput.type = isPass ? 'text' : 'password';
      btnToggleKeyVisibility.textContent = isPass ? '🙈' : '👁️';
    });
  }

  if (geminiApiKeyInput) {
    geminiApiKeyInput.addEventListener('input', (e) => {
      saveSettings({ geminiApiKey: e.target.value.trim() });
      if (geminiTestStatus) geminiTestStatus.textContent = '';
    });
  }

  if (geminiModelSelect) {
    geminiModelSelect.addEventListener('change', (e) => {
      const model = e.target.value;
      if (geminiCustomModelContainer) {
        if (model === 'custom') {
          geminiCustomModelContainer.classList.remove('hidden');
        } else {
          geminiCustomModelContainer.classList.add('hidden');
        }
      }
      saveSettings({ geminiModel: model });
      if (geminiTestStatus) geminiTestStatus.textContent = '';
    });
  }

  if (geminiCustomModelInput) {
    geminiCustomModelInput.addEventListener('input', (e) => {
      saveSettings({ geminiCustomModel: e.target.value.trim() });
    });
  }

  if (btnTestGemini) {
    btnTestGemini.addEventListener('click', () => {
      const apiKey = geminiApiKeyInput ? geminiApiKeyInput.value.trim() : '';
      if (!apiKey) {
        if (geminiTestStatus) {
          geminiTestStatus.textContent = '⚠️ Chưa nhập API Key';
          geminiTestStatus.className = 'url-status-hint error';
        }
        return;
      }

      if (geminiTestStatus) {
        geminiTestStatus.textContent = '⏳ Đang kiểm tra...';
        geminiTestStatus.className = 'url-status-hint';
      }

      chrome.runtime.sendMessage({ action: 'testGeminiKey', apiKey }, (response) => {
        if (!geminiTestStatus) return;
        if (response && response.success) {
          geminiTestStatus.textContent = '✔️ Kết nối thành công!';
          geminiTestStatus.className = 'url-status-hint success';
          if (Array.isArray(response.models) && response.models.length > 0 && geminiModelSelect) {
            const existingVals = new Set(Array.from(geminiModelSelect.options || []).map(o => o.value));
            const customOption = geminiModelSelect.querySelector ? geminiModelSelect.querySelector('option[value="custom"]') : null;
            response.models.forEach(m => {
              if (!existingVals.has(m) && m) {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = `${m} (Khả dụng từ tài khoản)`;
                if (customOption && customOption.parentNode) {
                  customOption.parentNode.insertBefore(opt, customOption);
                } else if (geminiModelSelect.appendChild) {
                  geminiModelSelect.appendChild(opt);
                }
                existingVals.add(m);
              }
            });
          }
        } else {
          const err = (response && response.error) || 'Không thể kết nối';
          geminiTestStatus.textContent = `❌ ${err.slice(0, 45)}`;
          geminiTestStatus.className = 'url-status-hint error';
        }
      });
    });
  }

  // xKiro API Key & Options
  if (btnToggleXkiroVisibility && xkiroApiKeyInput) {
    btnToggleXkiroVisibility.addEventListener('click', () => {
      const isPass = xkiroApiKeyInput.type === 'password';
      xkiroApiKeyInput.type = isPass ? 'text' : 'password';
      btnToggleXkiroVisibility.textContent = isPass ? '🙈' : '👁️';
    });
  }

  if (xkiroApiKeyInput) {
    xkiroApiKeyInput.addEventListener('input', (e) => {
      saveSettings({ xkiroApiKey: e.target.value.trim() });
      if (xkiroTestStatus) xkiroTestStatus.textContent = '';
    });
  }

  if (xkiroModelInput) {
    xkiroModelInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      saveSettings({ xkiroModel: val || 'qwen/qwen3.8-omni-flash:free' });
      if (xkiroTestStatus) xkiroTestStatus.textContent = '';
    });
  }

  if (btnTestXkiro) {
    btnTestXkiro.addEventListener('click', () => {
      const apiKey = xkiroApiKeyInput ? xkiroApiKeyInput.value.trim() : '';
      const model = (xkiroModelInput && xkiroModelInput.value.trim()) || currentSettings.xkiroModel || 'qwen/qwen3.8-omni-flash:free';
      if (!apiKey) {
        if (xkiroTestStatus) {
          xkiroTestStatus.textContent = '⚠️ Chưa nhập API Key';
          xkiroTestStatus.className = 'url-status-hint error';
        }
        return;
      }

      if (xkiroTestStatus) {
        xkiroTestStatus.textContent = '⏳ Đang kiểm tra...';
        xkiroTestStatus.className = 'url-status-hint';
      }

      chrome.runtime.sendMessage({ action: 'testXKiroKey', apiKey, model }, (response) => {
        if (!xkiroTestStatus) return;
        if (response && response.success) {
          xkiroTestStatus.textContent = '✔️ Kết nối thành công!';
          xkiroTestStatus.className = 'url-status-hint success';
        } else {
          const err = (response && response.error) || 'Không thể kết nối';
          xkiroTestStatus.textContent = `❌ ${err.slice(0, 45)}`;
          xkiroTestStatus.className = 'url-status-hint error';
        }
      });
    });
  }
  if (btnUpdateNow) {
    btnUpdateNow.addEventListener('click', () => {
      const btnSpan = btnUpdateNow.querySelector('span');
      if (btnSpan) btnSpan.textContent = 'Đang tải lại...';
      btnUpdateNow.disabled = true;

      if (typeof chrome !== 'undefined' && chrome.runtime) {
        if (chrome.runtime.reload) {
          try {
            chrome.runtime.reload();
            return;
          } catch (e) {}
        }
        if (chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'triggerAutoUpdate' }, () => {
            if (typeof window !== 'undefined' && window.close) {
              window.close();
            }
          });
        }
      }
    });
  }
})();
