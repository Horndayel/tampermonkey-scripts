# Tampermonkey scripts

Небольшая коллекция моих скриптов для Tampermonkey.

## Скрипты

- `chatgpt-close-popup.user.js` - закрывает отдельное уведомление о ChatGPT-5 что-то там.
- `fbfind-cleaner.user.js` - убирает рекламу и лишние вставки на fbfind.
- `kinokino-button.user.js` - добавляет кнопку перехода на fbfind со страниц Кинопоиска.

## Установка

Если нет, то установи расширение [Tampermonkey](https://www.tampermonkey.net/).
А так тык для установки:
1. [chatgpt-close-popup.user.js](https://raw.githubusercontent.com/Horndayel/tampermonkey-scripts/main/chatgpt-close-popup.user.js)
2. [fbfind-cleaner.user.js](https://raw.githubusercontent.com/Horndayel/tampermonkey-scripts/main/fbfind-cleaner.user.js)
3. [kinokino-button.user.js](https://raw.githubusercontent.com/Horndayel/tampermonkey-scripts/main/kinokino-button.user.js)

## Как самому обновлять репозиторий

После изменений в файлах открой PowerShell в этой папке и выполни:

```powershell
git status
git add .
git commit -m "Коротко опиши изменения"
git push
```

Что это значит:

- `git status` - показывает, какие файлы изменились.
- `git add .` - добавляет все изменения в будущий коммит.
- `git commit -m "..."` - сохраняет изменения в истории проекта.
- `git push` - отправляет коммит на GitHub.

Если меняешь скрипт, лучше ещё поднять `@version` в его заголовке, чтобы Tampermonkey увидел обновление.
