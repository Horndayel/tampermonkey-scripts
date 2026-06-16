// ==UserScript==
// @name         ChatGPT close only GPT-5.5 Pro notice
// @namespace    local
// @version      1.0
// @description  Закрывает только уведомление "Спросите нашу лучшую модель GPT-5.5 Pro"
// @match        https://chatgpt.com/*
// @match        https://*.chatgpt.com/*
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const DEBUG = true;

    const TARGET_TITLE = 'Спросите нашу лучшую модель GPT-5.5 Pro';
    const TARGET_TEXT = 'GPT-5.5 Pro оптимизирован для сложных задач';

    function log(...args) {
        if (DEBUG) {
            console.log('[GPT-5.5 Pro notice closer]', ...args);
        }
    }

    function isVisible(el) {
        if (!el) return false;

        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0
        );
    }

    function closeTargetNotice() {
        const notices = document.querySelectorAll('aside');

        for (const notice of notices) {
            if (!isVisible(notice)) continue;

            const text = notice.innerText || notice.textContent || '';

            const isTargetNotice =
                text.includes(TARGET_TITLE) &&
                text.includes(TARGET_TEXT);

            if (!isTargetNotice) continue;

            const closeButton = notice.querySelector(
                'button[data-testid="close-button"][aria-label="Закрыть"]'
            );

            if (!closeButton) {
                log('Нужная плашка найдена, но кнопка закрытия не найдена');
                return false;
            }

            closeButton.click();
            log('Плашка GPT-5.5 Pro закрыта');
            showDebugBadge('GPT-5.5 Pro notice closed');

            return true;
        }

        return false;
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
            borderRadius: '10px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            pointerEvents: 'none'
        });

        document.body.appendChild(badge);

        setTimeout(() => {
            badge.remove();
        }, 3000);
    }

    log('Скрипт запущен');

    closeTargetNotice();

    const observer = new MutationObserver(() => {
        closeTargetNotice();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();