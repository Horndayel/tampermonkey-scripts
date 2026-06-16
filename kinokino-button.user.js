// ==UserScript==
// @name         Kinopoisk -> KinoKino button
// @namespace    local.sitebutton.kinokino
// @version      1.2.0
// @description  Adds a KinoKino navigation button to Kinopoisk film and series pages.
// @author       Horndayel
// @updateURL    https://raw.githubusercontent.com/Horndayel/tampermonkey-scripts/main/kinokino-button.user.js
// @downloadURL  https://raw.githubusercontent.com/Horndayel/tampermonkey-scripts/main/kinokino-button.user.js
// @match        https://www.kinopoisk.ru/film/*
// @match        https://www.kinopoisk.ru/series/*
// @match        https://kinopoisk.ru/film/*
// @match        https://kinopoisk.ru/series/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_ID = 'sitebutton-kinokino-link';
  const BUTTON_CLASS = 'sitebutton-kinokino-button';
  const TARGET_HOST = 'kinokino.vip';

  const css = `
    .${BUTTON_CLASS} {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      gap: 8px;
      min-width: 116px;
      min-height: 52px;
      max-height: 52px;
      padding: 14px 26px 14px 22px;
      border: 0;
      border-radius: 52px;
      outline: none;
      background: var(--primary-gradient, linear-gradient(135deg, #f50 69.93%, #d6bb00 100%));
      color: #fff;
      font-family: inherit;
      font-size: 16px;
      font-weight: var(--kp-ui-kit-button-font-weight, 600);
      font-style: normal;
      line-height: 18px;
      letter-spacing: 0;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      transition: background 200ms ease, transform 200ms ease;
    }

    .${BUTTON_CLASS}:focus-visible,
    .${BUTTON_CLASS}:hover {
      transform: scale(1.05);
      background: var(--primary-gradient-intense, linear-gradient(135deg, #eb4e00 69.91%, #c5ac00 100%));
    }

    .${BUTTON_CLASS}:active {
      transform: scale(0.98);
    }

    .${BUTTON_CLASS}:focus-visible {
      outline: none;
    }

    .${BUTTON_CLASS} svg {
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
      fill: currentColor;
    }

    @media (max-width: 640px) {
      .${BUTTON_CLASS} {
        width: 52px;
        min-width: 52px;
        padding: 0;
      }

      .${BUTTON_CLASS} span {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
    }
  `;

  function addStyles() {
    if (document.getElementById(`${BUTTON_ID}-styles`)) {
      return;
    }

    const style = document.createElement('style');
    style.id = `${BUTTON_ID}-styles`;
    style.textContent = css;
    document.head.append(style);
  }

  function buildTargetUrl() {
    const url = new URL(window.location.href);
    url.protocol = 'https:';
    url.hostname = TARGET_HOST;
    url.port = '';
    return url.toString();
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 1 &&
      rect.height > 1 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  }

  function isPageChrome(element) {
    return Boolean(element.closest('header, nav, footer'));
  }

  function getVisibleControls(container) {
    return Array
      .from(container.querySelectorAll('button, a[href]'))
      .filter((control) => control.id !== BUTTON_ID && isVisible(control) && !isPageChrome(control));
  }

  function isActionsContainer(container) {
    const controls = getVisibleControls(container);

    return (
      isVisible(container) &&
      !isPageChrome(container) &&
      controls.length >= 1 &&
      controls.length <= 4
    );
  }

  function findActionsContainer() {
    const containers = Array
      .from(document.querySelectorAll('[class*="styles_buttonsContainer__"]'))
      .filter(isActionsContainer);

    return (
      containers.find((container) => container.querySelector('[data-test-id="Watch"], .kinopoisk-watch-online-button')) ||
      containers[0] ||
      null
    );
  }

  function createButton() {
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.className = BUTTON_CLASS;
    button.type = 'button';
    button.title = 'Open this page on kinokino.vip';
    button.setAttribute('aria-label', 'Open on KinoKino');
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5.14v13.72c0 .78.86 1.26 1.53.85l10.04-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z"></path>
      </svg>
      <span>Смотреть</span>
    `;
    button.addEventListener('click', () => {
      window.location.assign(buildTargetUrl());
    });

    return button;
  }

  function placeButton() {
    if (!document.body || !document.head) {
      return;
    }

    addStyles();

    const existingButton = document.getElementById(BUTTON_ID);
    const container = findActionsContainer();
    if (!container) {
      return;
    }

    const button = existingButton || createButton();
    button.dataset.href = buildTargetUrl();

    if (button.parentElement !== container) {
      container.append(button);
    }
  }

  function schedulePlaceButton() {
    window.clearTimeout(schedulePlaceButton.timer);
    schedulePlaceButton.timer = window.setTimeout(placeButton, 120);
  }

  placeButton();

  const observer = new MutationObserver(schedulePlaceButton);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener('popstate', schedulePlaceButton);
})();
