// ==UserScript==
// @name         TP-Link No Redirect
// @namespace    local.tplink.no-redirect
// @version      1.0.0
// @description  Не дает странице роутера уводить с 192.168.0.1 на tplinkwifi.net.
// @author       Horndayel
// @updateURL    https://raw.githubusercontent.com/Horndayel/tampermonkey-scripts/main/tplink-no-redirect.user.js
// @downloadURL  https://raw.githubusercontent.com/Horndayel/tampermonkey-scripts/main/tplink-no-redirect.user.js
// @match        http://192.168.0.1/*
// @match        https://192.168.0.1/*
// @match        http://tplinkwifi.net/*
// @match        https://tplinkwifi.net/*
// @match        http://www.tplinkwifi.net/*
// @match        https://www.tplinkwifi.net/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const ROUTER_HOST = '192.168.0.1';
  const REDIRECT_HOSTS = new Set(['tplinkwifi.net', 'www.tplinkwifi.net']);
  const LOOP_KEY = 'tplink-no-redirect-attempts';
  const LOOP_WINDOW_MS = 8000;
  const MAX_RETURN_ATTEMPTS = 3;

  if (isRedirectHost(location.hostname)) {
    returnToRouterIp();
    return;
  }

  patchNavigation();
  cleanDocument();

  if (document.documentElement) {
    observeDocument();
  } else {
    document.addEventListener('readystatechange', observeDocument, { once: true });
  }

  document.addEventListener('click', blockRedirectClick, true);
  document.addEventListener('submit', rewriteRedirectForm, true);
  document.addEventListener('DOMContentLoaded', cleanDocument, { once: true });
  window.addEventListener('load', cleanDocument, { once: true });
  window.setInterval(cleanDocument, 1000);

  function returnToRouterIp() {
    if (!canTryReturn()) {
      showLoopNotice();
      return;
    }

    const target = rewriteUrlToRouterIp(location.href);
    location.replace(target);
  }

  function canTryReturn() {
    const now = Date.now();
    const stored = readLoopState();
    const state = now - stored.startedAt > LOOP_WINDOW_MS
      ? { startedAt: now, attempts: 0 }
      : stored;

    state.attempts += 1;

    try {
      sessionStorage.setItem(LOOP_KEY, JSON.stringify(state));
    } catch (_error) {
      return true;
    }

    return state.attempts <= MAX_RETURN_ATTEMPTS;
  }

  function readLoopState() {
    try {
      return JSON.parse(sessionStorage.getItem(LOOP_KEY)) || { startedAt: 0, attempts: 0 };
    } catch (_error) {
      return { startedAt: 0, attempts: 0 };
    }
  }

  function patchNavigation() {
    patchWindowOpen();
    patchHistory('pushState');
    patchHistory('replaceState');
    patchLocationMethod('assign');
    patchLocationMethod('replace');
  }

  function patchWindowOpen() {
    const nativeOpen = window.open;
    window.open = function (url, ...args) {
      if (isTplinkUrl(url)) {
        return nativeOpen.call(this, rewriteUrlToRouterIp(url), ...args);
      }

      return nativeOpen.call(this, url, ...args);
    };
  }

  function patchHistory(method) {
    const nativeMethod = history[method];
    if (typeof nativeMethod !== 'function') return;

    history[method] = function (state, title, url) {
      const nextUrl = isTplinkUrl(url) ? rewriteUrlToRouterIp(url) : url;
      return nativeMethod.call(this, state, title, nextUrl);
    };
  }

  function patchLocationMethod(method) {
    try {
      const nativeMethod = Location.prototype[method];
      if (typeof nativeMethod !== 'function') return;

      Object.defineProperty(Location.prototype, method, {
        configurable: true,
        value(url) {
          const nextUrl = isTplinkUrl(url) ? rewriteUrlToRouterIp(url) : url;
          return nativeMethod.call(this, nextUrl);
        },
      });
    } catch (_error) {
      // В некоторых браузерах Location защищен от переопределения.
    }
  }

  function observeDocument() {
    if (!document.documentElement) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          cleanNode(node);
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'src', 'action', 'content'],
    });
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

    for (const element of node.querySelectorAll('a[href], area[href], link[href], form[action], iframe[src], script[src], meta[http-equiv]')) {
      cleanElement(element);
    }
  }

  function cleanElement(element) {
    if (!(element instanceof Element)) return;

    if (isMetaRefreshToTplink(element)) {
      element.remove();
      return;
    }

    rewriteAttribute(element, 'href');
    rewriteAttribute(element, 'action');

    if ((element.tagName === 'IFRAME' || element.tagName === 'SCRIPT') && isTplinkUrl(element.getAttribute('src'))) {
      element.remove();
    }
  }

  function rewriteAttribute(element, attribute) {
    const value = element.getAttribute(attribute);
    if (!isTplinkUrl(value)) return;

    element.setAttribute(attribute, rewriteUrlToRouterIp(value));
  }

  function blockRedirectClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const link = target && target.closest('a[href], area[href]');
    if (!link || !isTplinkUrl(link.href)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(rewriteUrlToRouterIp(link.href));
  }

  function rewriteRedirectForm(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !isTplinkUrl(form.action)) return;

    form.action = rewriteUrlToRouterIp(form.action);
  }

  function isMetaRefreshToTplink(element) {
    const httpEquiv = element.getAttribute('http-equiv') || '';
    const content = element.getAttribute('content') || '';

    return element.tagName === 'META' &&
      httpEquiv.toLowerCase() === 'refresh' &&
      isTplinkUrl(content);
  }

  function isTplinkUrl(value) {
    if (!value) return false;

    try {
      const url = new URL(String(value), location.href);
      return isRedirectHost(url.hostname);
    } catch (_error) {
      return /tplinkwifi\.net/i.test(String(value));
    }
  }

  function rewriteUrlToRouterIp(value) {
    const url = new URL(String(value || location.href), location.href);
    url.protocol = 'http:';
    url.hostname = ROUTER_HOST;
    url.port = '';
    return url.toString();
  }

  function isRedirectHost(hostname) {
    return REDIRECT_HOSTS.has(String(hostname || '').toLowerCase());
  }

  function showLoopNotice() {
    document.documentElement.style.background = '#111';

    document.addEventListener('DOMContentLoaded', () => {
      document.body.innerHTML = `
        <main style="box-sizing:border-box;display:grid;min-height:100vh;place-items:center;margin:0;padding:24px;background:#111;color:#fff;font:16px/1.5 Arial,sans-serif;">
          <section style="max-width:560px;">
            <h1 style="margin:0 0 12px;font-size:24px;">TP-Link все равно редиректит</h1>
            <p style="margin:0 0 16px;color:#d8d8d8;">Скрипт несколько раз вернул страницу на 192.168.0.1, но роутер снова отправил браузер на tplinkwifi.net. Похоже, это серверный редирект прошивки, его нельзя полностью отменить через userscript.</p>
            <a href="http://192.168.0.1/" style="color:#8ab4ff;">Открыть 192.168.0.1 еще раз</a>
          </section>
        </main>
      `;
    }, { once: true });
  }
})();
