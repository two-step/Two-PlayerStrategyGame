# Релиз-автоматизация PuzzleStow

Документ описывает, как выпускается и публикуется релиз сайта (`two-step/Two-PlayerStrategyGame`).
Настроено 2026-11-19/20; первый автоматический релиз — **v1.0.1** (2026-11-20).

## Что делает workflow

`.github/workflows/release.yml` (job `release`, runner `ubuntu-latest`, Node 22):

1. Синхронизирует репозиторий (включая **Git LFS** — треки `src/music/*.mp3` нужны билду).
2. (Режим «кнопки») бампает версию: `npm version X.Y.Z --no-git-tag-version --allow-same-version`,
   коммитит `package.json` + `package-lock.json`, ставит тег `vX.Y.Z` и пушит их в `main`.
3. `npm ci` → `vite build` → zip каталога `dist`.
4. Создаёт GitHub Release `vX.Y.Z` с авто-генерированными нотесами (список коммитов с прошлого тега)
   и прикрепляет `puzzlestow-vX.Y.Z-dist.zip`.

Каждый шаг — чистая функция своего входа: версия, тег и артефакт выводятся из одного места
(`$VERSION` в переменных шага), поэтому повторный запуск той же версии безопасен.

## Режимы запуска

### Режим 1 — «кнопка» (рекомендуемый)

GitHub → репозиторий → **Actions → release → Run workflow** → поле `version` → Run workflow.

- Вводить версию **с префиксом `v`** (`v1.0.2`) или без — workflow нормализует сам.
- Workflow пушит бамп-коммит и тег в `main` сам, отдельно пушить не нужно.
- Повторный запуск той же версии: бамп пропускается («nothing to change»), тег переиспользуется,
  релиз пересоздаётся с актуальным артефактом.

### Режим 2 — пуш тега

Любой пуш тега `v*` в репозиторий запускает тот же пайплайн без бампа версии.

Локально: `git tag v1.0.3 && git push origin v1.0.3`. Версию `package.json` в этом режиме
нужно поднять заранее (или использовать режим 1).

### Режим 3 — запуск из чата (Composio)

Инструмент `GITHUB_CREATE_A_WORKFLOW_DISPATCH_EVENT` (owner `two-step`, repo
`Two-PlayerStrategyGame`, workflow_id `release.yml`, ref `main`, inputs
`{"version": "v1.0.x"}`), затем статус по `GITHUB_LIST_WORKFLOW_RUNS_FOR_A_WORKFLOW`.

## Политика версий

- SemVer: патч — правки правил/движка/UI; минор — новая страница/функция; мажор — смены канона.
- Тег всегда `v`-префиксный; коммит бампа — `release: vX.Y.Z (bump package.json)`.
- Качество — **вне** workflow: батарея регрессий (`tests/regressions/`), `tsc --noEmit`,
  `vite build` гоняются в сессии **до** запуска релиза. Правила/движок коммитятся только
  после регрессий (см. AGENTS.md «готово»).

## Требования и ловушки (проверено на первых пяти прогонах)

1. **Git LFS обязателен в checkout.** `actions/checkout` с `lfs: true` — без него mp3 уезжают
   в билд как pointer-файлы.
2. **npm/cli#4828.** Lockfile, сгенерированный на Windows, не содержит опциональных
   зависимостей других платформ (нативные биндинги rolldown/esbuild) → `npm ci` на
   Linux-раннере падает («Cannot find rolldown-binding.linux-x64-gnu.node»).
   Лекарство уже применено: lockfile перегенерирован командой
   `npm install --cpu=x64 --os=linux --libc=glibc` — теперь он покрывает все платформы
   и `npm ci` в CI работает. **Не перегенерировать lockfile на Windows обычным
   `npm install` без этих флагов** — сломается CI.
3. **Идемпотентность повтора.** `--allow-same-version` + условный коммит + переиспользование
   существующего тега — перезапуск той же версии не падает.
4. **`GITHUB_REF_NAME` в режиме «кнопки» — это имя ветки, а не тег.** Имя/тег релиза
   считаются из поля `version` (env `RELEASE_TAG`), а не из ref.
5. **Пуш из агентской оболочки** работает только с явным хелпером:
   `git -c credential.helper=manager push origin main` (креды держит Git Credential Manager).
6. Concurrency-группа `release-<ref>` не даёт двум релизам одновременно; `cancel-in-progress:
   false` — идущий релиз не рвётся.

## Содержимое релиза

- **Артефакт:** `puzzlestow-vX.Y.Z-dist.zip` — статический билд `dist/` (открыть `index.html`
  через любой статический хостинг).
- **Нотесы:** авто-генерированные (`--generate-notes` — список коммитов с прошлого тега).
  Человеческая часть («What's new») ведётся в `docs/WHATS_NEW.md` и заливается в тело
  релиза вручную/из чата (PATCH `/releases/{id}`).

## Откат релиза

1. Releases → выбрать релиз → Delete (удаляет release; тег остаётся).
2. Удалить тег: `git push origin :refs/tags/vX.Y.Z` (локально и на origin).
3. Откатить бамп-коммит, если нужен: `git revert <bump-commit>` и пуш.
Новый запуск той же версии после этого снова возможен.

## Статусные проверки из чата

- Прогоны: `GITHUB_LIST_WORKFLOW_RUNS_FOR_A_WORKFLOW` (workflow_id `release.yml`).
- Лог упавшего прогона: `GET /repos/two-step/Two-PlayerStrategyGame/actions/runs/<id>/logs`
  (zip; в чате сохраняется во временное хранилище, читается локально).
- Релиз: `GET /releases/tags/vX.Y.Z`.
