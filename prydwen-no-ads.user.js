// ==UserScript==
// @name         Prydwen No Ads
// @namespace    local.prydwen.no-ads
// @version      1.0.0
// @description  Убирает верхние рекламные баннеры Prydwen и отключает видимые рекламные/аналитические вставки.
// @author       Horndayel
// @updateURL    https://raw.githubusercontent.com/Horndayel/tampermonkey-scripts/main/prydwen-no-ads.user.js
// @downloadURL  https://raw.githubusercontent.com/Horndayel/tampermonkey-scripts/main/prydwen-no-ads.user.js
// @match        https://www.prydwen.gg/*
// @match        https://prydwen.gg/*
// @match        https://*.prydwen.gg/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STYLE_ID = 'prydwen-no-ads-style';

  const BLOCKED_URL_RE = /(?:google-analytics|googletagmanager|googlesyndication|doubleclick|adservice|securepubads|fundingchoices|admiral|ramp|\/api\/v1\/ping\/batch|\/api\/v1\/analytics|\/tag(?:[/?#._-]|$))/i;
  const BANNER_IMAGE_RE = /(?:lootbar|_top|\/top_|er_top|banner|promo|sponsor|ad[-_])/i;

  const HIDE_SELECTOR = [
    '[data-banner-location]',
    '[class~="banner-image"]',
    '[class~="banner-alert"]',
    '[class~="banner-text"]',
    '[class~="banner-img"]',
    '[id^="google_ads_"]',
    '[id*="google_ads"]',
    '[id*="admiral" i]',
    '[class*="admiral" i]',
    '[id*="ramp" i]',
    '[class*="ramp" i]',
    'iframe[src*="doubleclick"]',
    'iframe[src*="googlesyndication"]',
    'iframe[src*="googleads"]',
    'iframe[src*="adservice"]',
    'ins.adsbygoogle'
  ].join(',');

  const REMOVE_SELECTOR = [
    '#ramp-pre-init',
    '#admiral-init',
    '#admiral-sdk',
    '#_next-ga-init',
    '#_next-ga',
    'script[src*="google-analytics"]',
    'script[src*="googletagmanager"]',
    'script[src*="googlesyndication"]',
    'script[src*="doubleclick"]',
    'script[src*="securepubads"]',
    'script[src*="adservice"]',
    'script[src*="admiral"]',
    'script[src*="ramp"]',
    'script[src*="/tag"]',
    'link[href*="google-analytics"]',
    'link[href*="googletagmanager"]',
    'link[href*="admiral"]',
    'link[href*="ramp"]',
    'link[href*="/tag"]'
  ].join(',');

  const CSS = `
    [data-banner-location],
    .banner-image,
    .banner-alert,
    .banner-text,
    .banner-img,
    #google_ads_iframe,
    [id^="google_ads_"],
    [id*="google_ads"],
    [id*="admiral" i],
    [class*="admiral" i],
    [id*="ramp" i],
    [class*="ramp" i],
    iframe[src*="doubleclick"],
    iframe[src*="googlesyndication"],
    iframe[src*="googleads"],
    iframe[src*="adservice"],
    ins.adsbygoogle {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      width: 0 !important;
      height: 0 !important;
      max-width: 0 !important;
      max-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      overflow: hidden !important;
    }
  `;

  injectStyles();
  patchMetrics();
  patchDynamicInsertion();
  startCleaner();

  document.addEventListener('DOMContentLoaded', cleanDocument, { once: true });
  window.addEventListener('load', cleanDocument, { once: true });
  window.setInterval(cleanDocument, 1500);

  function injectStyles() {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;

    const append = () => {
      if (document.getElementById(STYLE_ID)) return;
      (document.head || document.documentElement || document).appendChild(style);
    };

    if (document.documentElement) {
      append();
    } else {
      document.addEventListener('readystatechange', append, { once: true });
    }
  }

  function patchMetrics() {
    window.dataLayer = [];
    window.gtag = function () {};
    window.ga = function () {};
    window.adsbygoogle = [];

    window.ramp = {
      que: [],
      passiveMode: true,
      pageReprocess: function () {}
    };

    window.admiral = function () {};
    window.admiral.q = [];
    window.admiral.v = 2;
    window.admiral.s = '0';

    patchFetch();
    patchBeacon();
    patchOpen();
  }

  function patchFetch() {
    if (typeof window.fetch !== 'function') return;

    try {
      const nativeFetch = window.fetch;
      window.fetch = function (input, init) {
        const url = getRequestUrl(input);
        if (isBlockedUrl(url)) {
          return Promise.resolve(new Response(null, { status: 204, statusText: 'No Content' }));
        }

        return nativeFetch.call(this, input, init);
      };
    } catch (_error) {
      // Some browser contexts lock native APIs.
    }
  }

  function patchBeacon() {
    if (!navigator.sendBeacon) return;

    try {
      const nativeBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) {
        if (isBlockedUrl(url)) {
          return true;
        }

        return nativeBeacon(url, data);
      };
    } catch (_error) {
      // Some browser contexts lock native APIs.
    }
  }

  function patchOpen() {
    try {
      const nativeOpen = window.open;
      window.open = function (url, ...args) {
        if (isBannerTarget(url)) {
          return null;
        }

        return nativeOpen.call(this, url, ...args);
      };
    } catch (_error) {
      // Some browser contexts lock native APIs.
    }
  }

  function patchDynamicInsertion() {
    const nativeAppendChild = Node.prototype.appendChild;
    const nativeInsertBefore = Node.prototype.insertBefore;

    Node.prototype.appendChild = function (node) {
      if (shouldBlockNode(node)) {
        return node;
      }

      return nativeAppendChild.call(this, node);
    };

    Node.prototype.insertBefore = function (node, referenceNode) {
      if (shouldBlockNode(node)) {
        return node;
      }

      return nativeInsertBefore.call(this, node, referenceNode);
    };
  }

  function startCleaner() {
    const start = () => {
      if (!document.documentElement) return;

      cleanDocument();

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes') {
            cleanElement(mutation.target);
            continue;
          }

          for (const node of mutation.addedNodes) {
            cleanNode(node);
          }
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'href', 'id', 'class', 'data-banner-location']
      });
    };

    if (document.documentElement) {
      start();
    } else {
      document.addEventListener('readystatechange', start, { once: true });
    }
  }

  function cleanDocument() {
    cleanNode(document);
  }

  function cleanNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) {
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      cleanElement(node);
    }

    for (const element of node.querySelectorAll(`${REMOVE_SELECTOR}, ${HIDE_SELECTOR}, a[href], img[src], iframe[src], script[src], link[href]`)) {
      cleanElement(element);
    }
  }

  function cleanElement(element) {
    if (!(element instanceof Element)) return;

    if (element.matches(REMOVE_SELECTOR) || isBlockedAsset(element)) {
      element.remove();
      return;
    }

    if (element.matches(HIDE_SELECTOR) || isBannerElement(element)) {
      hideElement(element);
    }
  }

  function shouldBlockNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    if (node.matches(REMOVE_SELECTOR) || isBlockedAsset(node)) {
      return true;
    }

    if (node.matches(HIDE_SELECTOR) || isBannerElement(node)) {
      hideElement(node);
      return false;
    }

    cleanNode(node);
    return false;
  }

  function isBlockedAsset(element) {
    const url = element.src || element.href || element.getAttribute('src') || element.getAttribute('href') || '';
    return Boolean(url && isBlockedUrl(url));
  }

  function isBannerElement(element) {
    if (element.hasAttribute('data-banner-location')) return true;
    if (element.closest('[data-banner-location]')) return true;

    const image = element.matches('img') ? element : element.querySelector && element.querySelector('img');
    if (!image) return false;

    const text = `${image.getAttribute('src') || ''} ${image.getAttribute('srcset') || ''} ${image.getAttribute('alt') || ''}`;
    return BANNER_IMAGE_RE.test(text);
  }

  function hideElement(element) {
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('hidden', '');
    element.style.setProperty('display', 'none', 'important');
    element.style.setProperty('visibility', 'hidden', 'important');
    element.style.setProperty('pointer-events', 'none', 'important');

    if (element.getAttribute('role') === 'link') {
      element.removeAttribute('role');
      element.removeAttribute('tabindex');
    }
  }

  function getRequestUrl(input) {
    if (!input) return '';
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    if (input instanceof Request) return input.url;
    return String(input);
  }

  function isBlockedUrl(value) {
    if (!value) return false;

    const text = String(value);
    return BLOCKED_URL_RE.test(text) || BLOCKED_URL_RE.test(safeDecode(text));
  }

  function isBannerTarget(value) {
    if (!value) return false;

    const text = String(value);
    return /lootbar|etheria|adservice|doubleclick|googlesyndication|sponsor|promo/i.test(text);
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch (_error) {
      return value;
    }
  }
})();
