# PuzzleStow — состояние проекта на 2026-11-19

Handoff-документ. Цель: любой новый чат стартует за минуту. Заменяет
`PUZZLESTOW_STATE_2026-11-17.md` (тот остаётся в силе по канону §1–2; его §3–7 по
git/TO_DO устарели).

**Точечные файлы памяти для агентов:** в репо `docs/memory/` (`MEMORY.md` — индекс,
`project-state.md` — хроника сессий, `project-rules-canonical.md` — канон правил);
копии в `D:\4work\puzzlestow\artifacts\Memory\` (синхронизируются при доступе).

---

## 1. Пути

| Что | Где |
|---|---|
| Репозиторий сайта | `D:\4work\vc\PuzzleStow\Two-PlayerStrategyGame` (GitHub `two-step/Two-PlayerStrategyGame`, ветка `main`) |
| Артефакты, TO_DO, спеки | `D:\4work\puzzlestow\artifacts` |
| Память проекта (md, для агентов) | в репо `docs/memory/`; копии — `D:\4work\puzzlestow\artifacts\Memory` |
| Вселенная / YouTube / Комиксы | `D:\4work\puzzlestow\Universe` / `...\YouTube` / `...\КОМИКСЫ` |
| PairSec — отдельный проект | `D:\4work\PairSec` |
| Папка OSM/карты (пункты 41–42) | `D:\4work\puzzlestow\PairSec` |
| Геометрия фигур (единственный источник) | `otgruzka_figures.json`: каноническая копия в artifacts; **копия в репо — `tests/fixtures/otgruzka_figures.json`** (src/imports удалён 2026-11-19 чисткой; приложение фигуры держит инлайн в App.tsx, от файла не зависит) |

## 2. Канон (не менять, читать `docs/memory/project-rules-canonical.md`)

- Ориентация: **A низ / K верх, вход A0 (левый нижний), колонки 0–14 слева направо**. Проговаривать в каждом промпте.
- Контейнер: UnderLodar (rated) 15×11; старшие ранги 15×10; Sandbox/Home hero 15×11.
- Палитра — код источник истины (graphite #1C1F26, stow-blue #1F4F82, lodar-cyan #1FA7A3, green-stow #3BB273, fairplay #D6456F, steel #A3A9B5, light-deck #F5F7FA). Оранжевого нет. Inter + JetBrains Mono.
- Нотация `[id 2 цифры][точка1][точка2]`, фигуры 1 и 16 — одна точка. Фигуры — только контур. Порядок точек: **dot1 = ЛЕВАЯ точка исходной фигуры**, первый клик = dot1, вращение вокруг dot1 до dot2; зеркальную подстановку никогда не подставлять.
- Правила: **TO_DO 44a–h**; движок соперника — **TO_DO 30a–g**. «Ничего не придумываем»;
  тон «называй правило, не человека»; server-authoritative; никакого AI-советника в rated.

## 3. Состояние кода (main, 2026-11-19)

**Реализовано и закоммичено (`546a802`, 2026-11-19):**
- **Локализация (28)**: EN/RU/BY, BY стартовый; переключатель в Nav живой; IP-детект с
  модалкой «switch viewing language?»; публичные страницы переведены, DevTestPage — EN
  (дев-харнесс); переводы — в `src/lib/i18n.ts` / `I18nContext.tsx`, коммит `5203942`/`21ad2ab`/`9c38449`.
- **Admin page** (`f2e5d82`): конфиг-переменные, музыкальные треки, новостная лента, роль Administrator.
- **Таймеры 43** (`52bf368`): THIS LOAD + TOTAL TIME на DevTestPage; в MVP скорее всего не войдут (решение Sergey).
- **Миграции Supabase** (news-подписки, admin-контент), фиксы recovery-писем и 406-десинка.
- **Правила/движок — пачка сессии 2026-11-19 (отчёты (4)–(11))**, коммит `546a802`:
  - порядок точек left-first + орбита 4 поворотов в `computePlacementFromDots`;
  - силуэтная доставка (own cells + замкнутые карманы свободны), канал опускания
    грузчика (Чебышёв ≤3 + controlled slide), режимы `competent`/`honest44e`,
    ригидное исключение полки (25G11E13), правило **44a «мост над выемкой»**
    (`hoversOverForbiddenNotch` — F25@25H1F3), заливка мёртвых клеток **от входа**
    (потолок закрывает, 44f);
  - движок: pocketStranding, territory loss, row-sacrifice в критическом рельефе,
    desperate fallback без fair-play-pending.
- **Тесты в репо**: `tests/regressions/` (9 скриптов: regress30, verify30, sim30, perf30,
  replay18, regress31 delivery/exit44d/notation, endgame44e) + фикстура геометрии.
  Запуск из корня; TS-скрипты через `node --experimental-transform-types`.

**Заглушки:** Leagues, Tournaments, Judge, Community. Музыка и новостная лента
реализованы 2026-11-19 (пункты 29/33): треки Suno в `src/music/` (PuzzleStow.mp3,
PuzzleStow_Play.mp3), включатель музыки и новостной тикер на `src/lib/useSiteMusic.ts` /
`siteContent.ts` (Supabase-читаемая публично миграция
`supabase/migrations/20261119120000_public_read_music_news.sql`).

**Коммичено и запушено 2026-11-19 (Sergey: «можно мержить, комитить, пушать»):** полнный
плечей-пакет этой сессии — rules.ts (needsFairPlay, стеновой фикс изгиба, система троек
свисания), opponentEngine.ts (ходячая философия, REACH_GAIN, MONO_ONLY_PENALTY,
CEILING/ENTRANCE_PUSH), App.tsx (fair-play UX + музыка), регрессии, память.

## 4. Git (main)

Ветка `main` запушена на origin 2026-11-19 (вариант Б — полный пуш, с явной авторизацией
Sergey на коммит правил/движка).`.tmp_read/`, `.codex/`, `.vscode/`, `tmp_engine/` — в
`.gitignore`.

## 5. TO_DO — актуальная нумерация (номера сверять только по файлу)

DONE (красный): 1–**26, 27**, 29 (музыка), 32, 33 (новостная лента), 35, 37–39,
**30 (движок)**, **43** (таймеры), **44 (правила)**, 46 (AGENTS.md), 47.
OPEN: 31 (тест-страницу в игровую), 34 (телеграм-бот), 36 (архитектура мобильного),
40 (PrintPlay Kit), 41–42 (OSM/карты
— подготовка PairSec), 45 (тесты ≥80 % — vitest/eslint не настроены), 48 (полная схема Supabase).

## 6. Порядок работ (Sergey, 2026-11-19)

1. **Плейтест-цикл 30 (движок):** Sergey играет партии против движка (DevTestPage), шлёт
   PDF-отчёты, сессия правит rules/движок по канону. За день закрыты: порядок точек,
   модель доставки, опускание грузчика, 44e/44d, полка (25G11E13), мост над выемкой
   (F25@25H1F3), мёртвые клетки от входа, стратегия движка (pocketStranding/territory/
   row-sacrifice). Симуляции: партии полные, hard ~1–2 с на ход.
2. Открытые вопросы к Sergey: аномалия «красный→зелёный» F11 после «сбросить» (нужен
   репро: первая клетка, hover-клетка); канон по вертикальной штабелёвке выше зоны
   грузчика (сейчас легальна — F05@05G1C1); предложение логировать отклонённые попытки
   в PDF-отчёт (для отладки красных призраков).
3. Далее по плану 2026-11-17: 45 (vitest + golden set — предусловие коммитов правил),
   29+33, 41+42, 40, 34, 48.
4. oxfmt (`npm run format`) **сломан** — не запускать до починки.

## 7. Известные ловушки

- `.docx` читать через `unzip` + парсинг `word/document.xml`; **в чатах с строгим sandbox
  чтение artifacts может блокироваться — тогда нумерацию TO_DO сверять устно с Sergey.**
- PDF-отчёты партий: `node .tmp_read/pdf_text.mjs <путь к pdf>` (приложение из чата).
- Dev-сервер: `npm run dev`, порт 8443 strictPort; Sergey запускает сам.
- Не печатать `.env.local` и ключ `.mcp.json`. Веб-fetch GitHub не работает.
- Правки `rules.ts`/`opponentEngine.ts` коммитить и пушить только по явному разрешению.
- Word-нумерация TO_DO: саб-списки буквами (30a–g, 44a–h, 46a–f).

*Составлено 2026-11-19. Обновлять при каждом существенном изменении состояния.*
