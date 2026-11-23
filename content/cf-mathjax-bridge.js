// Codeforces Effect - MathJax Bridge (Runs in MAIN world context)
// Provides direct, uninhibited access to window.MathJax without CSP restrictions.

(function() {
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
    return;
  }

  function enforceMathColors(root) {
    try {
      const isLight = document.documentElement.classList.contains('cf-light-mode');
      const mathColor = isLight ? '#0f172a' : '#f1f5f9';
      const target = root || document;
      const els = target.querySelectorAll(
        '.MathJax, .MathJax *, .MathJax_Display, .MathJax_Display *, .mjx-chtml, .mjx-chtml *, mjx-container, mjx-container *, .katex, .katex *, .tex-span, .tex-span *, .tex-formula, .tex-formula *, math, math *'
      );
      for (let i = 0; i < els.length; i++) {
        if (els[i].style && els[i].style.setProperty) {
          els[i].style.setProperty('color', mathColor, 'important');
          els[i].style.setProperty('fill', mathColor, 'important');
          els[i].style.setProperty('stroke', mathColor, 'important');
          els[i].style.setProperty('text-shadow', 'none', 'important');
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  function doTypeset(targetId) {
    try {
      let target = targetId ? document.getElementById(targetId) : null;
      if (!target) {
        target = document.querySelector('.problem-statement') || document.body;
      }
      if (!target) return;

      if (window.MathJax) {
        if (window.MathJax.Hub && window.MathJax.Hub.Queue) {
          // PreProcess runs tex2jax to detect $$$...$$$ delimiters
          // Typeset renders math into full SVG / HTML-CSS output
          window.MathJax.Hub.Queue(
            ["PreProcess", window.MathJax.Hub, target],
            ["Typeset", window.MathJax.Hub, target],
            function() {
              enforceMathColors(target);
            }
          );
        } else if (window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([target]).then(function() {
            enforceMathColors(target);
          }).catch(function() {});
        }
        enforceMathColors(target);
      }
    } catch (e) {
      // Ignore
    }
  }

  function scheduleTypeset(targetId) {
    doTypeset(targetId);
    setTimeout(function() { doTypeset(targetId); }, 150);
    setTimeout(function() { doTypeset(targetId); }, 500);
    setTimeout(function() { doTypeset(targetId); }, 1200);
    setTimeout(function() { doTypeset(targetId); }, 2500);
  }

  // Listen to custom event dispatched by isolated world content script
  window.addEventListener('cf-typeset-math', function(e) {
    const targetId = e && e.detail ? e.detail.targetId : null;
    scheduleTypeset(targetId);
  });
  document.addEventListener('cf-typeset-math', function(e) {
    const targetId = e && e.detail ? e.detail.targetId : null;
    scheduleTypeset(targetId);
  });

  // Observe MathJax node insertions to enforce color immediately upon creation
  try {
    const observer = new MutationObserver(function(mutations) {
      let hasMath = false;
      for (let i = 0; i < mutations.length; i++) {
        const added = mutations[i].addedNodes;
        for (let j = 0; j < added.length; j++) {
          const n = added[j];
          if (n.nodeType === 1) {
            if (n.classList && (n.classList.contains('MathJax') || n.classList.contains('MathJax_Display') || n.classList.contains('tex-span'))) {
              hasMath = true;
              break;
            }
            if (n.querySelector && n.querySelector('.MathJax, .tex-span, .MathJax_Display')) {
              hasMath = true;
              break;
            }
          }
        }
        if (hasMath) break;
      }
      if (hasMath) {
        enforceMathColors();
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
    }
  } catch (e) {}

  // Startup hook
  if (window.MathJax && window.MathJax.Hub && window.MathJax.Hub.Register) {
    try {
      window.MathJax.Hub.Register.StartupHook("End", function() {
        enforceMathColors();
      });
      window.MathJax.Hub.Register.MessageHook("End Process", function() {
        enforceMathColors();
      });
    } catch (e) {}
  }

  // Handle focus, tab switch, and window resize
  window.addEventListener('focus', function() {
    enforceMathColors();
  });
  window.addEventListener('resize', function() {
    enforceMathColors();
  });
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      enforceMathColors();
    }
  });
})();
