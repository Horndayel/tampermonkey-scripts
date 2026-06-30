// ==UserScript==
// @name         ChatGPT close Pro promo notices
// @namespace    local
// @version      2.0.0
// @description  Закрывает промо-уведомления ChatGPT о переходе на Pro.
// @author       Horndayel
// @updateURL    https://raw.githubusercontent.com/Horndayel/tampermonkey-scripts/main/chatgpt-close-popup.user.js
// @downloadURL  https://raw.githubusercontent.com/Horndayel/tampermonkey-scripts/main/chatgpt-close-popup.user.js
// @match        https://chatgpt.com/*
// @match        https://*.chatgpt.com/*
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const DEBUG = true;
    const LOG_PREFIX = '[ChatGPT Pro notice closer]';
    const handledNotices = new WeakSet();

    const KNOWN_NOTICES = [
        {
            title: 'Спросите нашу лучшую модель GPT-5.5 Pro',
            text: 'GPT-5.5 Pro оптимизирован для сложных задач'
        },
        {
            title: 'Повысьте точность при работе со сложным кодом',
            text: 'используйте передовую модель Pro для отладки сложных систем'
        }
    ];

    function log(...args) {
        if (DEBUG) console.log(LOG_PREFIX, ...args);
    }

    function normalizedText(element) {
        return (element.innerText || element.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function isVisible(element) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0;
    }

    function matchesKnownNotice(notice) {
        const text = normalizedText(notice);
        return KNOWN_NOTICES.some(function (target) {
            return text.includes(target.title) && text.includes(target.text);
        });
    }

    function matchesComposerPromo(notice) {
        if (!notice.closest('[data-prompt-textarea-header]')) return false;
        if (!notice.querySelector('h3')) return false;

        const closeButton = notice.querySelector('button[data-testid="close-button"]');
        if (!closeButton) return false;

        const actionButton = Array.from(notice.querySelectorAll('button')).find(function (button) {
            return button !== closeButton && (
                button.classList.contains('btn-primary') ||
                button.querySelector('.btn-primary')
            );
        });

        return Boolean(actionButton);
    }

    function closeNotice(notice) {
        if (handledNotices.has(notice) || !isVisible(notice)) return false;
        if (!matchesKnownNotice(notice) && !matchesComposerPromo(notice)) return false;

        const closeButton = notice.querySelector('button[data-testid="close-button"]');
        if (!closeButton || !isVisible(closeButton)) {
            log('Нужное уведомление найдено, но видимая кнопка закрытия отсутствует', notice);
            return false;
        }

        handledNotices.add(notice);
        closeButton.click();
        log('Промо-уведомление закрыто', {
            title: normalizedText(notice.querySelector('h3') || notice),
            structuralMatch: matchesComposerPromo(notice)
        });
        showDebugBadge('Pro notice closed');
        return true;
    }

    function closeTargetNotices() {
        let closed = false;
        const notices = document.querySelectorAll('aside, [role="dialog"]');

        for (const notice of notices) {
            if (closeNotice(notice)) closed = true;
        }

        return closed;
    }

    function showDebugBadge(message) {
        const oldBadge = document.querySelector('#gpt-pro-notice-closer-debug');
        if (oldBadge) oldBadge.remove();

        const badge = document.createElement('div');
        badge.id = 'gpt-pro-notice-closer-debug';
        badge.textContent = message;

        Object.assign(badge.style, {
            position: 'fixed',
            right: '16px',
            bottom: '16px',
            zIndex: '999999',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            pointerEvents: 'none'
        });

        document.body.appendChild(badge);
        window.setTimeout(function () {
            badge.remove();
        }, 3000);
    }

    let scanScheduled = false;

    function scheduleScan() {
        if (scanScheduled) return;
        scanScheduled = true;

        window.requestAnimationFrame(function () {
            scanScheduled = false;
            closeTargetNotices();
        });
    }

    log('Скрипт запущен, версия 2.0.0');
    scheduleScan();

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
