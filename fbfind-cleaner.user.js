// ==UserScript==
// @name         FBFind Cleaner
// @namespace    local.fbfind.cleaner
// @version      1.0.0
// @description  Убирает рекламу, Telegram-промо и лишние сторонние вставки на fbfind.
// @author       local
// @match        https://fbfind.top/*
// @match        https://www.fbfind.top/*
// @match        http://fbfind.top/*
// @match        http://www.fbfind.top/*
// @match        https://fbphdplay.top/*
// @match        https://*.fbphdplay.top/*
// @match        http://fbphdplay.top/*
// @match        http://*.fbphdplay.top/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const BLOCKED_URL_RE = /(?:t\.me|telegram\.me|telegram\.org|bit\.ly\/3K3CIoi|101partners|mc\.yandex\.ru|counter\.yadro\.ru|liveinternet\.ru|yadro\.ru|adfox|doubleclick|googlesyndication|adservice|\/s\.js(?:[?#]|$))/i;
    const SAFE_SCRIPT_HOST_RE = /(?:^|\.)fbfind\.top$|(?:^|\.)fbphdplay\.top$/i;

    const HIDE_SELECTOR = [
        '#tgWrapper',
        '#TopAdMb',
        '#movie_video',
        '.topAdPad',
        '.adDown',
        '.brand',
        'a[href*="t.me"]',
        'a[href*="telegram"]',
        'a[href*="bit.ly/3K3CIoi"]',
        'a[href*="101partners"]',
        'img[src*="tgimg"]',
        'img[src*="tglogo"]',
        '.rmp-ad-container',
        '.rmp-ad-vast-video-player',
        '.rmp-ad-container-icons',
        '.rmp-ad-container-skip',
        '.rmp-ad-non-linear-container',
        '.rmp-ad-click-ui-mobile',
        '[class*="telegram" i]',
        '[id*="telegram" i]'
    ].join(',');

    const REMOVE_SELECTOR = [
        'script[src*="mc.yandex.ru"]',
        'script[src*="counter.yadro.ru"]',
        'script[src*="liveinternet"]',
        'script[src*="/s.js"]',
        'img[src*="mc.yandex.ru"]',
        'img[src*="counter.yadro.ru"]',
        'iframe[src*="101partners"]'
    ].join(',');

    const STYLE_TEXT = `
        #tgWrapper,
        #TopAdMb,
        #movie_video,
        .topAdPad,
        .adDown,
        .brand,
        a[href*="t.me"],
        a[href*="telegram"],
        a[href*="bit.ly/3K3CIoi"],
        a[href*="101partners"],
        img[src*="tgimg"],
        img[src*="tglogo"],
        .rmp-ad-container,
        .rmp-ad-vast-video-player,
        .rmp-ad-container-icons,
        .rmp-ad-container-skip,
        .rmp-ad-non-linear-container,
        .rmp-ad-click-ui-mobile,
        [class*="telegram" i],
        [id*="telegram" i] {
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

        html,
        body {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            overflow: hidden !important;
            background: #000 !important;
        }

        .wrapper,
        .mainContainer,
        .content,
        .kinobox,
        .kinobox_section,
        .kinobox_container,
        .kinobox_iframe_container {
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
        }

        .kinobox_iframe,
        .kinobox iframe {
            width: 100% !important;
            height: 100% !important;
        }
    `;

    let cleanerStarted = false;

    injectStyles();
    blockNoisyApis();
    patchDynamicInsertions();
    document.addEventListener('click', blockBadClicks, true);
    bootCleaner();
    document.addEventListener('DOMContentLoaded', cleanDocument, { once: true });

    function startCleaner() {
        if (cleanerStarted || !document.documentElement) return;
        cleanerStarted = true;

        cleanDocument();

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    cleanNode(node);
                }
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        window.addEventListener('load', cleanDocument, { once: true });
        window.setInterval(cleanDocument, 1500);
    }

    function bootCleaner() {
        if (document.documentElement) {
            startCleaner();
            return;
        }

        document.addEventListener('readystatechange', startCleaner, { once: true });
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.id = 'fbfind-cleaner-style';
        style.textContent = STYLE_TEXT;

        const append = () => {
            if (document.getElementById(style.id)) return;
            (document.head || document.documentElement || document).appendChild(style);
        };

        if (document.documentElement) {
            append();
        } else {
            document.addEventListener('readystatechange', append, { once: true });
        }
    }

    function blockNoisyApis() {
        window.ym = function () {};

        const nativeOpen = window.open;
        window.open = function (url, ...args) {
            if (isBlockedUrl(url)) {
                return null;
            }

            return nativeOpen.call(this, url, ...args);
        };
    }

    function patchDynamicInsertions() {
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

    function cleanDocument() {
        cleanNode(document);
    }

    function cleanNode(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) {
            return;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            neutralizeElement(node);
        }

        for (const element of node.querySelectorAll(REMOVE_SELECTOR)) {
            element.remove();
        }

        for (const element of node.querySelectorAll(HIDE_SELECTOR)) {
            hideElement(element);
        }

        for (const element of node.querySelectorAll('a, img, iframe, script, source, link')) {
            neutralizeElement(element);
        }
    }

    function neutralizeElement(element) {
        if (!(element instanceof Element)) return;

        if (element.matches(REMOVE_SELECTOR)) {
            element.remove();
            return;
        }

        if (element.matches(HIDE_SELECTOR)) {
            hideElement(element);
            return;
        }

        const url = getElementUrl(element);
        if (!url || !isBlockedUrl(url)) return;

        if (element.tagName === 'SCRIPT' || element.tagName === 'IFRAME' || element.tagName === 'IMG') {
            element.remove();
            return;
        }

        hideElement(element);
    }

    function hideElement(element) {
        element.setAttribute('aria-hidden', 'true');
        element.setAttribute('hidden', '');
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.setProperty('pointer-events', 'none', 'important');

        if (element.tagName === 'A') {
            element.removeAttribute('href');
            element.removeAttribute('target');
            element.setAttribute('tabindex', '-1');
        }
    }

    function shouldBlockNode(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }

        if (node.matches(REMOVE_SELECTOR)) {
            return true;
        }

        if (node.matches(HIDE_SELECTOR)) {
            hideElement(node);
            return false;
        }

        if (node.tagName === 'SCRIPT') {
            return shouldBlockScript(node.src);
        }

        const url = getElementUrl(node);
        if (url && isBlockedUrl(url)) {
            hideElement(node);
            return false;
        }

        cleanNode(node);
        return false;
    }

    function blockBadClicks(event) {
        const target = event.target instanceof Element ? event.target : null;
        const link = target && target.closest('a[href]');

        if (!link || !isBlockedUrl(link.href)) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        hideElement(link);
    }

    function getElementUrl(element) {
        return element.currentSrc || element.src || element.href || element.getAttribute('src') || element.getAttribute('href') || '';
    }

    function isBlockedUrl(value) {
        if (!value) return false;

        const text = String(value);
        return BLOCKED_URL_RE.test(text) || BLOCKED_URL_RE.test(safeDecode(text));
    }

    function shouldBlockScript(src) {
        if (!src) return false;
        if (isBlockedUrl(src)) return true;

        try {
            const url = new URL(src, location.href);
            return !SAFE_SCRIPT_HOST_RE.test(url.hostname);
        } catch (_error) {
            return false;
        }
    }

    function safeDecode(value) {
        try {
            return decodeURIComponent(value);
        } catch (_error) {
            return value;
        }
    }
})();
