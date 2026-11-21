# PuzzleStow — состояние проекта на 2026-11-21

Handoff-документ. Цель: любой новый чат стартует за минуту. Заменяет
`PUZZLESTOW_STATE_2026-11-19.md` (канон §1–2 того документа в силе, перенесён ниже).

**Точечные файлы памяти для агентов:** в репо `docs/memory/` (`MEMORY.md` — индекс,
`project-state.md` — хроника сессий, `project-rules-canonical.md` — канон правил,
`reference-mcp-deepai.md` — настройка MCP в DeepAI Code); копии в
`D:\4work\puzzlestow\artifacts\Memory\` (синхронизируются при доступе).

---

## 1. Пути

| Что | Где |
|---|---|
| Репозиторий сайта | `D:\4work\vc\PuzzleStow\Two-PlayerStrategyGame` (GitHub `two-step/Two-PlayerStrategyGame`, ветка `main`) |
| Артефакты, спеки, концепты | `D:\4work\puzzlestow\artifacts` |
| Telegram-бот (пункт 34) | концепт `artifacts\PuzzleStow_Telegram_Casual_Bot_Concept_last.docx` (ред. 2); ревью `D:\4work\puzzlestow\telegram\PuzzleStow_Telegram_Bot_Visual_Concept_Review_v0.2.docx`; скрипт профиля `tools/telegram/set_bot_profile.ps1` (в репо, токен не хранится) |
| Память проекта (md, для агентов) | в репо `docs/memory/`; копии — `D:\4work\puzzlestow\artifacts\Memory` |
| Вселенная / YouTube / Комиксы | `D:\4work\puzzlestow\Universe` / `...\YouTube` / `...\КОМИКСЫ` |
| PairSec — отдельный проект | `D:\4work\PairSec` |
| Папка OSM/карты | `D:\4work\puzzlestow\PairSec` |
| Геометрия фигур (единственный источник) | `otgruzka_figures.json`: каноническая копия в artifacts; **копия в репо — `tests/fixtures/otgruzka_figures.json`** (приложение фигуры держит инлайн в App.tsx, от файла не зависит) |

## 2. Канон (не менять, читать `docs/memory/project-rules-canonical.md`)

- Ориентация: **A низ / K верх, вход A0 (левый нижний), колонки 0–14 слева направо**. Проговаривать в каждом промпте.
- Контейнер: UnderLodar (rated) 15×11; старшие ранги 15×10; Sandbox/Home hero 15×11.
- Палитра — код источник истины (graphite #1C1F26, stow-blue #1F4F82, lodar-cyan #1FA7A3, green-stow #3BB273, fairplay #D6456F, steel #A3A9B5, light-deck #F5F7FA). Оранжевого нет. Inter + JetBrains Mono.
- Нотация `[id 2 цифры][точка1][точка2]`, фигуры 1 и 16 — одна точка. Фигуры — только контур. Порядок точек: **dot1 = ЛЕВАЯ точка исходной фигуры**, первый клик = dot1, вращение вокруг dot1 до dot2; зеркальную подстановку никогда не подставлять.
- Правила: **44a–h**; движок соперника — **30a–g**. «Ничего не придумываем»;
  тон «называй правило, не человека»; server-authoritative; никакого AI-советника в rated.

## 3. Статус TO_DO (изменение 2026-11-21)

**Sergey отпустил TO_DO.docx как рабочий артефакт** («TO_DO я отпустил») — больше не
сверять нумерацию по файлу и не вести работу «по пунктам TO_DO». Работы теперь
фиксируются здесь и в `docs/memory/`. Историческая привязка имён пунктов (31, 34, 45…)
сохраняется в текстах коммитов и памяти, но контрольная нумерация не поддерживается.

Открытые направления (по факту): телеграм-бот (механика), мобильная архитектура,
PrintPlay Kit (частично сделан — выкройка фигур в app), OSM/карты (PairSec), полная
схема Supabase. Закрыты: локализация, admin, таймеры (дев), правила 44a–h, движок 30a–g,
музыка/новости, MCP-инфраструктура, релиз-автоматизация, тестовые ворота ≥80 %.

## 4. Состояние кода (main, 2026-11-21)

- **Страница «Рейтинговая игра» (было «тест-страницу в игровую», свернуто 2026-11-21):**
  один `GameWorkbench` (variant `dev` / `practice` / `rated`) — DRY:
  - **«Рейтинговая игра»** — очередь рейтинговых партий: тот же layout, всё задизэйблено,
    монета заблокирована, баннер «Рейтинговые партии — против реальных людей», надпись
    «У вас нет запланированных игр.»; без логина — гейт-попап к регистрации (GatedPreview).
  - **«Тренировка»** — партия против движка (easy/medium/hard, выбор до старта, заморозка
    в игре), unrated; сольный self-режим убран 2026-11-21.
  - **Dev/Test** — полный контроль (квалификация, сложность, таймеры, internals).
  - Флаги из `app_config` (`game.timers_enabled` / `game.tier_id` / `game.difficulty`),
    `useGameFlags()` в `siteContent.ts`; миграция
    `supabase/migrations/20261120110000_public_read_game_flags.sql` применена.
  - Переименования i18n: «Рейтинговая игра» / «Рэйтынгавая гульня» (пользователь — регион BY).
- **Баг таймеров исправлен (2026-11-21):** `startLoadTimer` сам инкрементирует
  `setTimersTick`; 1s-тик активен пока `requester !== null && !gameOver`.
- **DevTest layout (2026-11-20):** три вертикальных блока Я/Соперник/Лог, TimerStrip-чипы
  у ScorePanel, INCOMING CARGO напротив контейнера, J/K-разделитель в обеих сетках,
  фикс горизонтального скролла через `.ps-board-wrap` в `index.css`.
- **Пункт 45 (тесты): ЗАКРЫТ 2026-11-20–21.** vitest 5.1.1 + coverage-v8 + ESLint 10
  (ноль предупреждений). Ворота ≥80 % пройдены: **site coverage 80.7 %** (97 тестов;
  auth, profile, fair-play UX, i18n/siteContent, Admin config, Print&Play PDF, Sandbox
  tutorial walk). Коммиты `9120535`…`6e3e430`; механический счётчик —
  `npm run test:coverage:site`.
- **Релиз-автоматизация:** workflow_dispatch + tag-push release workflow; v1.0.1
  выпущена (`2bd2742`); lockfile на все платформы (npm/cli#4828).
- **MCP в DeepAI Code работает (2026-11-20)** — supabase/composio/context7; конфиг в
  `<PI_CODING_AGENT_DIR>\mcp.json`, `exposure: "deferred"`, BOM-ловушка; см.
  `docs/memory/reference-mcp-deepai.md`.
- **Supabase:** миграции music/news (публичное чтение) и game-флагов применены; keys
  `game.*` в `app_config`.
- **Заглушки:** Leagues, Tournaments, Judge, Community.

## 5. Telegram-бот @puzzlestow_bot (запущен 2026-11-21)

- Бот создан у BotFather; коннектор Composio активен (toolkit `telegram`).
- **Настроено и подтверждено:** имя PuzzleStow (getMe), команды `play/cargo/status/
  notation/rules/stop/help` в четырёх локалях (default/en/ru/be, через
  `TELEGRAM_SET_MY_COMMANDS`); описания профиля ru/be/en + about — скриптом
  `tools/telegram/set_bot_profile.ps1` (setMyName/setMyShortDescription/
  setMyDescription/setChatMenuButton type=commands); аватар A загружен (/setuserpic).
- **Ключевые решения (ревью v0.2, проверено по changelog):** Bot API 10.4 (09.11.2026);
  `sendChecklist` недоступен обычному боту (обязателен `business_connection_id`) →
  остаток груза = одно редактируемое сообщение-панель (sendMessage/editMessageText,
  отметки — зеркало сервера); реакции/эффекты — post-MVP (только закрытие ряда/победа);
  голос бота — мужской («грузчик»); язык — авто по `language_code` (be/ru/EN);
  Composio не покрывает профильные методы — прямой Bot API/BotFather.
- **Дальше:** фиксация решений в концепте (ред. 3); текстовый MVP-бот (вебхук/getUpdates,
  сессия партии, парсер хода, панель груза, серверная валидация — та же логика, что на
  сайте). Токен бота в чат не показывать.

## 6. Git (main)

Запушено до `2b8ac6c` (origin/main = `2b8ac6c`); локально на 1 коммит впереди (`6e3e430`,
chore по тестам) — пуш по явному разрешению: `git -c credential.helper=manager push
origin main` (голый `git push` в агентской оболочке не находит креды).
Не закоммичено: `tools/telegram/set_bot_profile.ps1` (скрипт профиля бота) и мусор
`cov*.txt`, `dbg*.txt` в корне (удалить). `.tmp_read/`, `.codex/`, `.vscode/`,
`tmp_engine/` — в `.gitignore`.

## 7. Известные ловушки

- `.docx` читать через `unzip` + парсинг `word/document.xml`; чтение artifacts может
  блокироваться sandbox'ом — тогда спрашивать контент у Sergey.
- PDF-отчёты партий: `node .tmp_read/pdf_text.mjs <путь к pdf>`.
- Dev-сервер: `npm run dev`, порт 8443 strictPort; Sergey запускает сам.
- Не печатать `.env.local` и ключи; веб-fetch GitHub не работает.
- Правки `rules.ts`/`opponentEngine.ts` — коммитить и пушить только по явному разрешению.
- oxfmt (`npm run format`) сломан — не запускать до починки.
- Внешние записи вне репо (artifacts, telegram-папка) sandbox может запретить — класть
  копии в репо и просить Sergey перенести.

*Составлено 2026-11-21. Обновлять при каждом существенном изменении состояния.*
