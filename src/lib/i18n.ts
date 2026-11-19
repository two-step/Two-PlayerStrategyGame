// i18n — TO_DO item 28 (номер сверен по TO_DO.docx): локализовать сайт, добавить
// белорусский язык и стартовать с него, определять страну локации и спрашивать,
// изменить ли язык просмотра.
//
// Purpose: site localization infrastructure. Belarusian is the DEFAULT starting
// language; IP-geolocation drives a one-time "switch language?" question rendered
// by App.tsx (LanguageGateModal) via I18nContext.
//
// Design invariants:
// - Dictionary keys are the ENGLISH SOURCE STRINGS as they appear in App.tsx
//   (matching apostrophes/quotes exactly). EN needs no dictionary: translate()
//   falls back to the key itself. A missing RU/BY entry degrades to the English
//   key — never throws, never blanks the UI.
// - rules.ts (regression-gated engine file) is NOT touched: engine messages are
//   translated at display time by looking them up in the same dictionary.
// - Style: functions only, no classes, no default exports, no enum (AGENTS.md §5).

/** Available viewing languages, display names in their own language. */
export const LANGS = { EN: "English", RU: "Русский", BY: "Беларуская" } as const

/** Union of supported language codes. */
export type Lang = keyof typeof LANGS

/** TO_DO 28: the site starts in Belarusian regardless of the browser locale. */
export const DEFAULT_LANG: Lang = "BY"

/** localStorage key for the visitor's chosen viewing language. */
export const LANG_STORAGE_KEY = "ps_lang"

/** localStorage key marking that the "change language?" question was answered. */
export const GEO_PROMPT_STORAGE_KEY = "ps_geo_prompt"

/**
 * IP-geolocation endpoint returning `country_code` (e.g. "BY", "RU").
 * Preconditions: free, CORS-open JSON endpoint; overridable via VITE_GEO_URL.
 * Postconditions: a single GET; failures never propagate (see detectCountryCode).
 */
export const GEO_URL: string = import.meta.env.VITE_GEO_URL ?? "https://ipapi.co/json/"

/** Abort budget for the geolocation request, ms. */
export const GEO_TIMEOUT_MS = 5000

/** Country code → suggested viewing language. Anything unmapped suggests EN. */
export const COUNTRY_TO_LANG: Record<string, Lang> = { BY: "BY", RU: "RU" }

// ── Dictionary ───────────────────────────────────────────────────────────────

type Dict = Record<string, { ru: string; be: string }>

/** Core UI: nav, footer, buttons, shared words, engine-reason display strings. */
const COMMON: Dict = {
  "Play": { ru: "Играть", be: "Гуляць" },
  "Figures": { ru: "Фигуры", be: "Фігуры" },
  "Rules": { ru: "Правила", be: "Правілы" },
  "Lore": { ru: "Легенда", be: "Легенда" },
  "Print & Play": { ru: "Печать и игра", be: "Друк і гра" },
  "Profile": { ru: "Профиль", be: "Профіль" },
  "Admin": { ru: "Админ", be: "Адмін" },
  "Sign In": { ru: "Вход", be: "Уваход" },
  "Sign In / Sign Up": { ru: "Вход / Регистрация", be: "Уваход / Рэгістрацыя" },
  "Sign out": { ru: "Выйти", be: "Выйсці" },
  "Music on": { ru: "Музыка включена", be: "Музыка ўключана" },
  "Music off": { ru: "Музыка выключена", be: "Музыка выключана" },
  "News": { ru: "Новости", be: "Навіны" },
  "MUSIC TRACKS": { ru: "МУЗЫКАЛЬНЫЕ ТРЕКИ", be: "МУЗЫЧНЫЯ ТРЭКІ" },
  "Click a page to pick its track in a popup. Pages without a choice play the bundled PuzzleStow theme. Read live by the public player.": { ru: "Кликните на страницу — в попапе выберете её трек. Страницы без выбора играют встроенную тему PuzzleStow. Читается публичным плеером напрямую.", be: "Націсніце на старонку — у папапе абярыце яе трэк. Старонкі без выбару граюць убудаваную тэму PuzzleStow. Чытаецца публічным плэерам непасрэдна." },
  "TRACK LIBRARY": { ru: "БИБЛИОТЕКА ТРЕКОВ", be: "БІБЛІЯТЭКА ТРЭКАЎ" },
  "plays on": { ru: "играет на", be: "грае на" },
  "no URL — track cannot play": { ru: "нет URL — трек не может играть", be: "няма URL — трэк не можа граць" },
  "No tracks yet — the bundled themes play.": { ru: "Треков пока нет — играют встроенные темы.", be: "Трэкаў пакуль няма — граюць убудаваныя тэмы." },
  "PuzzleStow (bundled)": { ru: "PuzzleStow (встроенная)", be: "PuzzleStow (убудаваная)" },
  "audio URL (https://… or /music/file.mp3 served from /public)": { ru: "аудио URL (https://… или /music/file.mp3 из /public)", be: "аўдыё URL (https://… або /music/file.mp3 з /public)" },
  "TRACK FOR": { ru: "ТРЕК ДЛЯ", be: "ТРЭК ДЛЯ" },
  "ENV VARIABLES": { ru: "ENV-ПЕРЕМЕННЫЕ", be: "ENV-ЗМЕННЫЯ" },
  "Stored in .env.local (gitignored), documented in .env.example, inlined by Vite at build time. Secrets must stay out of the database; admin-tunable runtime values belong to CONFIG VARIABLES above.": { ru: "Хранятся в .env.local (в gitignore), задокументированы в .env.example, вшиваются Vite при сборке. Секреты не должны попадать в базу;-admin-настраиваемые значения — в CONFIG VARIABLES выше.", be: "Захоўваюцца ў .env.local (у gitignore), задакументаваны ў .env.example, упісваюцца Vite пры зборцы. Сакрэты не павінны трапляць у базу; admin-наладжвальныя значэнні — у CONFIG VARIABLES вышэй." },
  "required": { ru: "обязательная", be: "абавязковая" },
  "optional": { ru: "опциональная", be: "неабавязковая" },
  "custom": { ru: "своя", be: "свая" },
  "configured ✓": { ru: "задана ✓", be: "задана ✓" },
  "NOT SET": { ru: "НЕ ЗАДАНА", be: "НЕ ЗАДАНА" },
  "Dev/test environment (TO_DO item 6)": { ru: "Дев/тестовая среда (пункт TO_DO 6)", be: "Дэв/тэставае асяроддзе (пункт TO_DO 6)" },
  "row": { ru: "ряд", be: "радок" },
  "column": { ru: "столбец", be: "калонка" },
  "cell": { ru: "клетка", be: "клетка" },
  "cells": { ru: "клеток", be: "клетак" },
  "TRAINING VIEW": { ru: "ТРЕНИРОВОЧНЫЙ ВИД", be: "ТРЭНІРОВАНЧЫ ВЫГЛЯД" },
  "Email confirmed — you are now signed in.": { ru: "Почта подтверждена — вы уже вошли.", be: "Пошта пацверджана — вы ўжо ўвайшлі." },
  "Email address confirmed.": { ru: "Адрес почты подтверждён.", be: "Адрас пошты пацверджаны." },
  // Engine (rules.ts) reason strings — translated at display time only.
  "Placement goes outside the container": { ru: "Установка выходит за пределы контейнера", be: "Устаноўка выходзіць за межы кантэйнера" },
  "Cell already occupied": { ru: "Клетка уже занята", be: "Клетка ўжо занята" },
  "Notation does not match this figure’s reference dots": { ru: "Нотация не совпадает с опорными точками этой фигуры", be: "Натацыя не супадае з апорнымі кропкамі гэтай фігуры" },
  "No support — this placement doesn’t rest on the floor or on any existing piece anywhere": { ru: "Нет опоры — установка не опирается ни на пол, ни на какую-либо установленную фигуру", be: "Няма опоры — устаноўка не абапіраецца ні на падлогу, ні на якую-небудзь усталяваную фігуру" },
  "Cargo can’t reach this spot — a step taller than 3 cells blocks the path from the entrance (build an intermediate step first)": { ru: "Груз не может добраться до этого места — ступень выше 3 клеток перекрывает путь от входа (сначала нарастите промежуточную ступень)", be: "Груз не можа дабрацца да гэтага месца — прыступка вышэй за 3 клеткі перакрывае шлях ад уваходу (спачатку нарасціце прамежкавую прыступку)" },
  "Point {point} is outside the {rows}-row container": { ru: "Точка {point} вне контейнера из {rows} рядов", be: "Кропка {point} па-за кантэйнерам з {rows} радкоў" },
}

/** Home page (hero, sections, FAQ, footer) + TIERS descriptions. */
const HOME: Dict = {
  "TWO-PLAYER STRATEGY · PERFECT INFORMATION": { ru: "СТРАТЕГИЯ НА ДВОИХ · ПОЛНАЯ ИНФОРМАЦИЯ", be: "СТРАТЭГІЯ НА ДВОИХ · ПОЎНАЯ ІНФАРМАЦЫЯ" },
  "You don't choose": { ru: "Вы не выбираете", be: "Вы не выбіраеце" },
  "your cargo.": { ru: "свой груз.", be: "свой груз." },
  "Your opponent does.": { ru: "Это делает ваш соперник.", be: "Гэта робіць ваш сапернік." },
  "PuzzleStow is a strategy game of perfect information. 27 fixed figures, sizes 1 to 7 cells. A 15×10 container. Your opponent selects which piece you must place next.":
    { ru: "PuzzleStow — стратегия с полной информацией. 27 фиксированных фигур размером от 1 до 7 клеток. Контейнер 15×10. Соперник выбирает, какую фигуру вам предстоит установить следующей.", be: "PuzzleStow — стратэгія з поўнай інфармацыяй. 27 фіксаваных фігур памерам ад 1 да 7 клетак. Кантэйнер 15×10. Сапернік выбірае, якую фігуру вам трэба ўсталяваць наступнай." },
  "Play Rated": { ru: "Рейтинговая игра", be: "Рэйтынгавая гульня" },
  "Practice": { ru: "Тренировка", be: "Трэніроўка" },
  "Sandbox": { ru: "Песочница", be: "Пясочніца" },
  "SAMPLE MOVE NOTATION": { ru: "ПРИМЕР НОТАЦИИ ХОДА", be: "ПРЫКЛАД НАТАЦЫІ ХОДУ" },
  "figure 7, placed B9→C10": { ru: "фигура 7, установлена B9→C10", be: "фігура 7, усталявана B9→C10" },
  "CONTAINER 15×11 — TRAINING VIEW": { ru: "КОНТЕЙНЕР 15×11 — ТРЕНИРОВОЧНЫЙ ВИД", be: "КАНТЭЙНЕР 15×11 — ТРЭНІРОВАНЧЫ ВЫГЛЯД" },
  "Row A closed": { ru: "Ряд A закрыт", be: "Радок A зачынены" },
  "Placed": { ru: "Установлено", be: "Усталявана" },
  "Entry A0": { ru: "Вход A0", be: "Уваход A0" },
  "This extra row is yours while you're learning to stack. Once you've got it, you'll play on 15×10 like everyone else — and this line becomes the ceiling.":
    { ru: "Этот дополнительный ряд — ваш, пока вы учитесь укладке. Освоите — перейдёте на 15×10, как все, и эта линия станет потолком.", be: "Гэты дадатковы радок — ваш, пакуль вучыцеся ўкладцы. Асвоіце — пераідзеце на 15×10, як усе, і гэтая лінія стане столлю." },
  "INCOMING": { ru: "ВХОДЯЩИЙ", be: "УВАХОДНЫ" },
  "F14 — chosen by opponent": { ru: "F14 — выбрана соперником", be: "F14 — выбрана сапернікам" },
  "WHAT MAKES IT DIFFERENT": { ru: "ЧЕМ ЭТО ОТЛИЧАЕТСЯ", be: "ЧЫМ ГЭТА АДРОЗНІВАЕЦЦА" },
  "Strategy. Geometry. Honest play.": { ru: "Стратегия. Геометрия. Честная игра.", be: "Стратэгія. Геаметрыя. Шчырая гульня." },
  "Most games let you choose your own moves. PuzzleStow inverts this — your opponent selects the piece that enters your container, and you must place it legally. Perfect information means both players see everything. No fog of war. No luck. Only geometry and foresight.":
    { ru: "В большинстве игр вы выбираете свои ходы сами. PuzzleStow переворачивает это — соперник выбирает фигуру, которая входит в ваш контейнер, а установить её по правилам должны вы. Полная информация: оба игрока видят всё. Ни тумана войны, ни удачи. Только геометрия и предвидение.", be: "У большасці гульняў вы выбіраеце свае хады самі. PuzzleStow перагортвае гэта — сапернік выбірае фігуру, якая ўваходзіць у ваш кантэйнер, а ўсталяваць яе па правілах павінны вы. Поўная інфармацыя: абодва гульцы бачаць усё. Ні туману вайны, ні ўдачы. Толькі геаметрыя і прадбачанне." },
  "HOW IT WORKS": { ru: "КАК ЭТО РАБОТАЕТ", be: "ЯК ГЭТА ПРАЦУЕ" },
  "Four rules govern every move": { ru: "Каждый ход определяют четыре правила", be: "Кожны ход вызначаюць чатыры правілы" },
  "Support": { ru: "Опора", be: "Апора" },
  "Steps": { ru: "Ступени", be: "Прыступкі" },
  "Overhang": { ru: "Навес", be: "Навес" },
  "Return Path": { ru: "Путь назад", be: "Шлях назад" },
  "No piece may float. It must rest on base row A or on an already-placed piece.": { ru: "Ни одна фигура не может висеть в воздухе. Она должна опираться на нижний ряд A или на уже установленную фигуру.", be: "Ні адна фігура не можа вісець у паветры. Яна павінна абапірацца на ніжні радок A або на ўжо ўсталяваную фігуру." },
  "Height difference between adjacent columns must not exceed 3 cells.": { ru: "Разница высот соседних столбцов не должна превышать 3 клеток.", be: "Розніца вышынь суседніх калонак не павінна перавышаць 3 клетак." },
  "More than 50% of a piece's area unsupported is not allowed by default. Exceeding it requires the bilateral fair-play exception.": { ru: "По умолчанию запрещено свешивание более 50% площади фигуры. Превышение требует двустороннего согласия — fair play.", be: "Па змаўчанні забаронена звісанне больш за 50% плошчы фігуры. Перавышэнне патрабуе двухбаковай згоды — fair play." },
  "After placing a piece, a passable path back to exit A0 must remain open.": { ru: "После установки фигуры проходимый путь обратно к выходу A0 должен оставаться открытым.", be: "Пасля ўстаноўкі фігуры праходны шлях назад да выхаду A0 павінен заставацца адкрытым." },
  "FIGURE CATALOG": { ru: "КАТАЛОГ ФИГУР", be: "КАТАЛОГ ФІГУР" },
  "27 distinct figures": { ru: "27 разных фигур", be: "27 розных фігур" },
  "Sizes 1 to 7 cells — each with up to 4 orientations.": { ru: "Размеры от 1 до 7 клеток — до 4 ориентаций у каждой.", be: "Памеры ад 1 да 7 клетак — да 4 арыентацый у кожнай." },
  "View all 27 →": { ru: "Все 27 →", be: "Усе 27 →" },
  "QUALIFICATION": { ru: "КВАЛИФИКАЦИЯ", be: "КВАЛІФІКАЦЫЯ" },
  "The Lodar Path": { ru: "Путь Лодара", be: "Шлях Лодара" },
  "Seven tiers of verified ability, earned through rated play alone. No shortcuts, no purchases, no hint engines.": { ru: "Сем ступеней подтверждённого мастерства, которые зарабатываются только рейтинговыми партиями. Без обходных путей, без покупок, без подсказок от движков.", be: "Сем прыступак пацверджанага майстэрства, якія зарабляюцца толькі рэйтынгавымі партыямі. Без абыходных шляхоў, без пакупак, без падказак ад рухавікоў." },
  "Entry level. Learning the rules and all 27 figures.": { ru: "Начальный уровень. Изучение правил и всех 27 фигур.", be: "Пачатковы ўзровень. Вывучэнне правіл і ўсіх 27 фігур." },
  "Understands basic placement and support rules.": { ru: "Понимает базовые правила установки и опоры.", be: "Разумее базавыя правілы ўстаноўкі і опоры." },
  "Applies overhang and step rules. May create leagues.": { ru: "Применяет правила навеса и ступеней. Может создавать лиги.", be: "Прымяняе правілы навеса і прыступак. Можа ствараць лігі." },
  "Reads opponent strategy. Consistent path management.": { ru: "Читает стратегию соперника. Постоянный контроль проходимости.", be: "Чытае стратэгію саперніка. Пастаянны кантроль праходнасці." },
  "Exploits row-closure combinations. Tournament-ready.": { ru: "Использует комбинации закрытия рядов. Готов к турнирам.", be: "Выкарыстоўвае камбінацыі зачынення радкоў. Гатовы да турніраў." },
  "Top 5% of rated players.": { ru: "Топ-5% рейтинговых игроков.", be: "Топ-5% рэйтынгавых гульцоў." },
  "Highest tier. Consulting and Judge roles on PairSec.": { ru: "Высшая ступень. Роли консультанта и Judge на PairSec.", be: "Найвышэйшая прыступка. Ролі кансультанта і Judge на PairSec." },
  "Qualification is your real level of thinking —": { ru: "Квалификация — это ваш реальный уровень мышления —", be: "Кваліфікацыя — гэта ваш рэальны ўзровень мыслення —" },
  "not access to a hint.": { ru: "а не доступ к подсказке.", be: "а не доступ да падказкі." },
  "There is no AI move-advisor in rated play. Not free. Not premium. Not ever. Practice and Sandbox modes offer a built-in algorithmic engine opponent for unrated training only, and are clearly separated from the rated experience at all times.":
    { ru: "В рейтинговых партиях нет ИИ-советника по ходам. Ни бесплатно, ни за деньги. Никогда. Тренировка и Песочница дают встроенного алгоритмического соперника только для нерейтингового обучения и всегда чётко отделены от рейтингового опыта.", be: "У рэйтынгавых партыях няма ІІ-саветніка па ходах. Ні бясплатна, ні за грошы. Ніколі. Трэніроўка і Пясочніца даюць убудаванага алгарытмічнага саперніка толькі для нерэйтынгавага навучання і заўсёды выразна аддзелены ад рэйтынгавага досведу." },
  "If you come from chess or Go and are tired of engine-assisted ratings, PuzzleStow is built for you.": { ru: "Если вы пришли из шахмат или го и устали от рейтингов с движковыми подсказками — PuzzleStow создан для вас.", be: "Калі вы прыйшлі з шахмат ці го і стаміліся ад рэйтынгаў з рухавіковымі падказкамі — PuzzleStow створаны для вас." },
  "GAME MODES": { ru: "РЕЖИМЫ ИГРЫ", be: "РЭЖЫМЫ ГУЛЬНІ" },
  "Three ways to play": { ru: "Три способа играть", be: "Тры спосабы гуляць" },
  "Rated Play": { ru: "Рейтинговая игра", be: "Рэйтынгавая гульня" },
  "TOURNAMENT": { ru: "ТУРНИРНЫЙ", be: "ТУРНІРНЫ" },
  "Affects rating": { ru: "Влияет на рейтинг", be: "Уплывае на рэйтынг" },
  "Two players on a 15×10 container (rows A–J). Your opponent picks your piece. Server-confirmed rules. Results affect your Lodar qualification.": { ru: "Два игрока на контейнере 15×10 (ряды A–J). Соперник выбирает ваши фигуры. Правила подтверждает сервер. Результаты влияют на вашу квалификацию Лодара.", be: "Два гульцы на кантэйнеры 15×10 (рады A–J). Сапернік выбірае вашы фігуры. Правілы пацвярджае сервер. Вынікі ўплываюць на вашу кваліфікацыю Лодара." },
  "UNRATED": { ru: "НЕРЕЙТИНГОВЫЙ", be: "НЕРЭЙТЫНГАВЫ" },
  "No rating effect": { ru: "Не влияет на рейтинг", be: "Не ўплывае на рэйтынг" },
  "Play against the built-in engine opponent on a 15×10 container, mirroring the real game mechanic. Unrated — results do not affect qualification.": { ru: "Играйте против встроенного движка-соперника на контейнере 15×10 по механике настоящей игры. Без рейтинга — результат не влияет на квалификацию.", be: "Гуляйце супраць убудаванага рухавіка-саперніка на кантэйнеры 15×10 па механіцы сапраўднай гульні. Без рэйтынгу — вынік не ўплывае на кваліфікацыю." },
  "FREE": { ru: "СВОБОДНЫЙ", be: "ВОЛЬНЫ" },
  "Free placement on the 15×11 training container (rows A–K). Toggle rule highlights independently. The bold J/K line marks the competitive ceiling.": { ru: "Свободная установка на тренировочном контейнере 15×11 (ряды A–K). Подсветка каждого правила включается отдельно. Жирная линия J/K отмечает потолок соревновательной игры.", be: "Вольная ўстаноўка на трэніровачным кантэйнеры 15×11 (рады A–K). Падсветка кожнага правілы ўключаецца асобна. Тлустая лінія J/K пазначае столю спаборніцкай гульні." },
  "15×11 + J/K line": { ru: "15×11 + линия J/K", be: "15×11 + лінія J/K" },
  "Enter →": { ru: "Войти →", be: "Увайсці →" },
  "FROM THE GAME TO REAL WORK": { ru: "ОТ ИГРЫ К РЕАЛЬНОЙ РАБОТЕ", be: "АД ГУЛЬНІ ДА РЭАЛЬНАЙ ПРАЦЫ" },
  "Your loader persona connects to PairSec": { ru: "Ваш образ грузчика связан с PairSec", be: "Ваш вобраз грузчыка звязаны з PairSec" },
  "The in-game “loader / грузчик” identity ties directly to the “Грузанём!” service on PairSec. MidLod qualification and above converts into verified performer status on the platform.":
    { ru: "Игровой образ «loader / грузчик» напрямую связан с сервисом «Грузанём!» на PairSec. Квалификация MidLod и выше конвертируется в статус подтверждённого исполнителя на платформе.", be: "Гульнявы вобраз «loader / грузчык» напростую звязаны з сэрвісам «Грузанём!» на PairSec. Кваліфікацыя MidLod і вышэй канвертуецца ў статус пацверджанага выканаўцы на платформе." },
  "What is PairSec → pair-sec.com": { ru: "Что такое PairSec → pair-sec.com", be: "Што такое PairSec → pair-sec.com" },
  "QUALIFICATION BRIDGE": { ru: "МОСТ КВАЛИФИКАЦИИ", be: "МОСТ КВАЛІФІКАЦЫІ" },
  "PairSec observer": { ru: "Наблюдатель PairSec", be: "Назіральнік PairSec" },
  "“Грузанём!” performer listing": { ru: "Список исполнителей «Грузанём!»", be: "Спіс выканаўцаў «Грузанём!»" },
  "Verified specialist badge": { ru: "Значок подтверждённого специалиста", be: "Значак пацверджанага спецыяліста" },
  "Judge / Consultant bookings": { ru: "Заказы Judge / консультанта", be: "Заказы Judge / кансультанта" },
  "FAQ": { ru: "ВОПРОСЫ И ОТВЕТЫ", be: "ПЫТАННІ І АДКАЗЫ" },
  "Common questions": { ru: "Частые вопросы", be: "Частыя пытанні" },
  "Is PuzzleStow the same as Tetris?": { ru: "PuzzleStow — это тот же «Тетрис»?", be: "Ці PuzzleStow — гэта той жа «Тэтрыс»?" },
  "No. The only similarity is a rectangular container. PuzzleStow has 27 fixed figures (not 7), rows close in both horizontal and vertical directions, and — most importantly — your opponent chooses which figure you must place. At UnderLodar and Lodar tier there is no time pressure; from MidLod upward, timers and request limits apply (T=7/5/3 min, Li=1/2/3 requests per match).":
    { ru: "Нет. Единственное сходство — прямоугольный контейнер. В PuzzleStow 27 фиксированных фигур (а не 7), ряды закрываются и по горизонтали, и по вертикали, и — главное — соперник выбирает, какую фигуру вам ставить. На уровнях UnderLodar и Lodar нет ограничения времени; с MidLod и выше действуют таймеры и лимиты запросов (T=7/5/3 мин, Li=1/2/3 запроса за матч).", be: "Не. Адзінае падабенства — прастакутны кантэйнер. У PuzzleStow 27 фіксаваных фігур (а не 7), рады зачыняюцца і па гарызанталі, і па вертыкалі, і — галоўнае — сапернік выбірае, якую фігуру вам ставіць. На ўзроўнях UnderLodar і Lodar няма абмежавання часу; з MidLod і вышэй дзейнічаюць таймеры і ліміты запытаў (T=7/5/3 хв, Li=1/2/3 запытаў за матч)." },
  "Can I use AI hints during a rated match?": { ru: "Можно ли пользоваться ИИ-подсказками в рейтинговой партии?", be: "Ці можна карыстацца ІІ-падказкамі ў рэйтынгавай партыі?" },
  "Never. There is no AI move-advisor in rated play — not free, not as a premium feature. Your Lodar qualification reflects your actual thinking, not tool access. Practice and Sandbox modes offer an automated algorithmic engine opponent for unrated training only, and are visually distinct from rated play.":
    { ru: "Никогда. В рейтинговых партиях нет ИИ-советника по ходам — ни бесплатно, ни как премиум-функция. Ваша квалификация Лодара отражает ваше реальное мышление, а не доступ к инструментам. Тренировка и Песочница дают автоматического алгоритмического соперника только для нерейтингового обучения и визуально отделены от рейтинговых партий.", be: "Ніколі. У рэйтынгавых партыях няма ІІ-саветніка па ходах — ні бясплатна, ні як прэміум-функцыя. Ваша кваліфікацыя Лодара адлюстроўвае ваша рэальнае мысленне, а не доступ да інструментаў. Трэніроўка і Пясочніца даюць аўтаматычнага алгарытмічнага саперніка толькі для нерэйтынгавага навучання і візуальна аддзелены ад рэйтынгавых партый." },
  "What is a Lodar qualification?": { ru: "Что такое квалификация Лодара?", be: "Што такое кваліфікацыя Лодара?" },
  "Lodar levels (UnderLodar through ProfiLod) are earned through rated matches. They are a verifiable measure of strategic ability — not a reflection of playtime, purchases, or AI assistance. ProfiLod players are eligible for paid Judge and Consulting roles on PairSec.":
    { ru: "Уровни Лодаров (от UnderLodar до ProfiLod) зарабатываются рейтинговыми партиями. Это проверяемая мера стратегического мастерства — а не отражение времени в игре, покупок или ИИ-помощи. Игроки ProfiLod могут претендовать на платные роли Judge и консультанта на PairSec.", be: "Узроўні Лодараў (ад UnderLodar да ProfiLod) зарабляюцца рэйтынгавымі партыямі. Гэта правяраемая мера стратэгічнага майстэрства — а не адлюстраванне часу ў гульні, пакупак ці ІІ-дапамогі. Гульцы ProfiLod могуць прэтэндаваць на платныя ролі Judge і кансультанта на PairSec." },
  "How do I play without the app?": { ru: "Как играть без приложения?", be: "Як гуляць без прыкладання?" },
  "Print two 15×10 container grids (labelled A–J / 0–14), keep the figure reference table nearby, and record moves in notation. The Print & Play page provides both the 15×10 and 15×11 PDF templates. All you need is a sheet of grid paper and a pen.":
    { ru: "Распечатайте две сетки контейнеров 15×10 (разметка A–J / 0–14), держите таблицу фигур рядом и записывайте ходы нотацией. Страница «Печать и игра» даёт PDF-шаблоны и 15×10, и 15×11. Всё, что нужно, — лист бумаги в клетку и ручка.", be: "Аддрукуйце дзве сеткі кантэйнераў 15×10 (разметка A–J / 0–14), трымайце табліцу фігур побач і запісвайце ходы натацыяй. Старонка «Друк і гра» дае PDF-шаблоны і 15×10, і 15×11. Усё, што трэба, — ліст паперы ў клетку і ручка." },
  "What is PairSec and how does it connect?": { ru: "Что такое PairSec и как он связан с игрой?", be: "Што такое PairSec і як ён звязаны з гульнёй?" },
  "PairSec is a platform for skilled workers. Your in-game loader persona ties directly to the \"Грузанём!\" service there. MidLod and above can convert qualification into performer status. Visit pair-sec.com for details.":
    { ru: "PairSec — платформа для квалифицированных работников. Ваш игровой образ грузчика напрямую связан с сервисом «Грузанём!» там. Квалификация MidLod и выше конвертируется в статус исполнителя. Подробности — на pair-sec.com.", be: "PairSec — платформа для кваліфікаваных работнікаў. Ваш гульнявы вобраз грузчыка напростую звязаны з сэрвісам «Грузанём!» там. Кваліфікацыя MidLod і вышэй канвертуецца ў статус выканаўцы. Падрабязнасці — на pair-sec.com." },
  "How does the fair-play overhang exception work?": { ru: "Как работает fair-play-исключение для навеса?", be: "Як працуе fair-play-выключэнне для навесу?" },
  "By default, more than 50% of a piece's area may not be unsupported after placement. When a move would exceed this threshold, both players must explicitly confirm via an in-game bilateral modal before the exception is applied. It is never automatic, never one-sided.":
    { ru: "По умолчанию после установки не может не иметь опоры более 50% площади фигуры. Когда ход превышает этот порог, оба игрока должны явно подтвердить через игровое двустороннее окно, прежде чем исключение применится. Никогда автоматически, никогда в одностороннем порядке.", be: "Па змаўчанні пасля ўстаноўкі не можа не мець апоры больш за 50% плошчы фігуры. Калі ход перавышае гэты парог, абодва гульцы павінны відавочна пацвердзіць праз гульнявое двухбаковае акно, перш чым выключэнне прыменіцца. Ніколі аўтаматычна, ніколі ў аднабаковым парадку." },
  "Digital version of “Отгрузка” (Shipload). A strategy game for people who think.": { ru: "Цифровая версия «Отгрузки» (Shipload). Стратегическая игра для думающих людей.", be: "Лічбавая версія «Адгрузкі» (Shipload). Стратэгічная гульня для думаючых людзей." },
  "NAVIGATE": { ru: "НАВИГАЦИЯ", be: "НАВІГАЦЫЯ" },
  "ACCOUNT": { ru: "АККАУНТ", be: "АКАЎНТ" },
}

/** Figures page. */
const FIGURES: Dict = {
  "All 27 Figures": { ru: "Все 27 фигур", be: "Усе 27 фігур" },
  "Sizes 1 to 7 cells. Figure #25 is the only 7-cell piece (Heptomino-H). Click any figure to see all valid orientations.":
    { ru: "Размеры от 1 до 7 клеток. Фигура #25 — единственная 7-клеточная (Heptomino-H). Нажмите на фигуру, чтобы увидеть все допустимые ориентации.", be: "Памеры ад 1 да 7 клетак. Фігура #25 — адзіная 7-клетачная (Heptomino-H). Націсніце на фігуру, каб убачыць усе дапушчальныя арыентацыі." },
  "ORIENTATIONS ({n} unique)": { ru: "ОРИЕНТАЦИИ ({n} уникальных)", be: "АРЫЕНТАЦЫІ ({n} унікальных)" },
  "BOUNDING BOX ({n}°)": { ru: "ГАБАРИТЫ ({n}°)", be: "ПАМЕРЫ ({n}°)" },
}

/** Rules page. */
const RULES: Dict = {
  "RULES": { ru: "ПРАВИЛА", be: "ПРАВІЛЫ" },
  "Complete Rule Set": { ru: "Полный свод правил", be: "Поўны звод правіл" },
  "All rules are authoritative server-side. The client displays server-confirmed state only — no client-side rules engine. This preserves anti-cheat integrity for all rated play.":
    { ru: "Все правила авторитетны на сервере. Клиент показывает только подтверждённое сервером состояние — никакого клиентского проверщика правил. Это сохраняет античит-целостность всех рейтинговых партий.", be: "Усе правілы аўтарытэтныя на серверы. Кліент паказвае толькі пацверджанае серверам стан — ніякага кліенцкага праверыльніка правіл. Гэта захоўвае антычыт-цэласнасць усіх рэйтынгавых партый." },
  "RULE {n}": { ru: "ПРАВИЛО {n}", be: "ПРАВІЛА {n}" },
  "No piece may float. Every cell must rest on base row A or be supported by a previously placed cell below it.":
    { ru: "Ни одна фигура не может висеть. Каждая клетка должна опираться на нижний ряд A или на клетку ранее установленной фигуры под ней.", be: "Ні адна фігура не можа вісець. Кожная клетка павінна абапірацца на ніжні радок A або на клетку раней усталяванай фігуры пад ёй." },
  "After placement, the server checks each occupied column. Any cell without support — from row A or another piece directly below — is a violation.":
    { ru: "После установки сервер проверяет каждую занятую колонку. Любая клетка без опоры — из ряда A или другой фигуры строго под ней — это нарушение.", be: "Пасля ўстаноўкі сервер правярае кожную занятую калонку. Люба-якая клетка без апоры — з радка A ці іншай фігуры строга пад ёй — гэта парушэнне." },
  "Steps (≤ 3)": { ru: "Ступени (≤ 3)", be: "Прыступкі (≤ 3)" },
  "Steps ≤ 3 are passable. Steps > 3 form a wall that blocks the return path.": { ru: "Ступени ≤ 3 проходимы. Ступени > 3 образуют стену, перекрывающую путь назад.", be: "Прыступкі ≤ 3 праходныя. Прыступкі > 3 утвараюць сцяну, якая перакрывае шлях назад." },
  "More than 50% of a piece's area unsupported after placement is not allowed by default.":
    { ru: "По умолчанию запрещено свешивание более 50% площади фигуры после установки.", be: "Па змаўчанні забаронена звісанне больш за 50% плошчы фігуры пасля ўстаноўкі." },
  "When a placement would exceed the 50% unsupported threshold, the game shows a bilateral confirmation modal. Both players must actively accept before the move registers. It is never automatic or one-sided.":
    { ru: "Когда установка превышает порог в 50% свеса, игра показывает двустороннее окно подтверждения. Оба игрока должны активно согласиться, прежде чем ход будет принят. Никогда автоматически и никогда в одностороннем порядке.", be: "Калі ўстаноўка перавышае парог у 50% звесу, гульня паказвае двухбаковае акно пацвярджэння. Абодва гульцы павінны актыўна пагадзіцца, перш чым ход будзе прыняты. Ніколі аўтаматычна і ніколі ў аднабаковым парадку." },
  "FAIR-PLAY EXCEPTION": { ru: "ИСКЛЮЧЕНИЕ FAIR PLAY", be: "ВЫКЛЮЧЭННЕ FAIR PLAY" },
  "Both players must confirm via bilateral modal before the exception is applied. Never automatic. Never one-sided. Move logged in match history.":
    { ru: "Оба игрока должны подтвердить через двустороннее окно, прежде чем исключение применится. Никогда автоматически. Никогда в одностороннем порядке. Ход фиксируется в истории матча.", be: "Абодва гульцы павінны пацвердзіць праз двухбаковае акно, перш чым выключэнне прыменіцца. Ніколі аўтаматычна. Ніколі ў аднабаковым парадку. Ход фіксуецца ў гісторыі матча." },
  "After every placement, a passable path must exist back to exit point A0.":
    { ru: "После каждой установки должен существовать проходимый путь обратно к точке выхода A0.", be: "Пасля кожнай ўстаноўкі павінен існаваць праходны шлях назад да кропкі выхаду A0." },
  "Evaluated server-side after each move. If all routes to A0 are blocked, the move is illegal.":
    { ru: "Проверяется сервером после каждого хода. Если все маршруты к A0 перекрыты — ход недопустим.", be: "Правяраецца серверам пасля кожнага ходу. Калі ўсе маршруты да A0 перакрытыя — ход недапушчальны." },
  "Row Closure": { ru: "Закрытие рядов", be: "Зачыненне радкоў" },
  "Win by closing 5 full rows (horizontal and/or vertical), or forcing the opponent into an impossible placement.":
    { ru: "Победа — закрыть 5 полных рядов (горизонтальных и/или вертикальных) либо загнать соперника в положение, где установки нет.", be: "Перамога — зачыніць 5 поўных радкоў (гарызантальных і/ці вертыкальных) або загнаць саперніка ў становішча, дзе ўстаноўкі няма." },
  "A full horizontal row (all 15 columns occupied) or a full vertical column (all rows in a column occupied) counts as one closure.":
    { ru: "Полный горизонтальный ряд (заняты все 15 колонок) или полный вертикальный столбец (заняты все ряды столбца) считается одним закрытием.", be: "Поўны гарызантальны радок (занятыя ўсе 15 калонак) або поўны вертыкальны слуп (занятыя ўсе рады слупа) лічыцца адным зачыненнем." },
  "CONTAINER SPECIFICATION": { ru: "СПЕЦИФИКАЦИЯ КОНТЕЙНЕРА", be: "СПЕЦЫФІКАЦЫЯ КАНТЭЙНЕРА" },
  "Rated Play / Practice": { ru: "Рейтинговая игра / Тренировка", be: "Рэйтынгавая гульня / Трэніроўка" },
  "A–J (10 rows)": { ru: "A–J (10 рядов)", be: "A–J (10 радкоў)" },
  "Standard competitive container. All rated matches and practice sessions.": { ru: "Стандартный соревновательный контейнер. Все рейтинговые партии и тренировки.", be: "Стандартны спаборніцкі кантэйнер. Усе рэйтынгавыя партыі і трэніроўкі." },
  "A–K (11 rows)": { ru: "A–K (11 рядов)", be: "A–K (11 радкоў)" },
  "Training container with bold J/K separator — permanent feature, not a placeholder.": { ru: "Тренировочный контейнер с жирной линией-разделителем J/K — постоянный элемент, не заглушка.", be: "Трэніровачны кантэйнер з тлустай лініяй-раздзяляльнікам J/K — пастаянны элемент, не заглушка." },
  "Width": { ru: "Ширина", be: "Шырыня" },
  "15 columns": { ru: "15 колонок", be: "15 калонак" },
  "labeled 0–14": { ru: "пронумерованы 0–14", be: "занумараваны 0–14" },
  "Entry / Exit": { ru: "Вход / выход", be: "Уваход / выхад" },
  "Rows {rows}": { ru: "Ряды {rows}", be: "Рады {rows}" },
  "bottom-left corner": { ru: "нижний левый угол", be: "ніжні левы вугал" },
  "Axis": { ru: "Оси", be: "Восі" },
  "A = floor": { ru: "A = пол", be: "A = падлога" },
  "K = training ceiling": { ru: "K = тренировочный потолок", be: "K = трэніровачны стол" },
  "27 fixed": { ru: "27 фиксированных", be: "27 фіксаваных" },
  "sizes 1–7 cells": { ru: "размеры 1–7 клеток", be: "памеры 1–7 клетак" },
}

/** Lore page. */
const LORE: Dict = {
  "— THE LEGEND OF THE LODARS —": { ru: "— ЛЕГЕНДА О ЛОДАРАХ —", be: "— ЛЕГЕНДА ПРА ЛОДАРАЎ —" },
  "The Legend": { ru: "Легенда", be: "Легенда" },
  "of the Lodars": { ru: "Лодаров", be: "Лодараў" },
  "Long before the first shipping container was forged, the Lodars moved cargo across the great plateaus by a discipline that demanded both geometry and foresight. Each Lodar carried a table of 27 figures — memorized, not written — and a container drawn in chalk on stone.":
    { ru: "Задолго до того, как был выкован первый грузовой контейнер, Лодары переносили грузы через великие плато, следуя дисциплине, требовавшей и геометрии, и предвидения. Каждый Лодар носил таблицу из 27 фигур — выученную наизусть, не записанную — и контейнер, начерченный мелом на камне.", be: "Даўно да таго, як быў выкаваны першы грузавы кантэйнер, Лодары пераносілі грузы праз вялікія пласкагор'і, трымаючыся дысцыпліны, якая патрабавала і геаметрыі, і прадбачання. Кожны Лодар насіў табліцу з 27 фігур — заўчаную на памяць, не запісаную — і кантэйнер, начарчоны мелам на камені." },
  "The opponent's right was the opponent's gift: to choose which shape entered your space. The wisdom of the Lodars was not in avoiding bad pieces — it was in finding the placement that left every path open, every row one step closer to closure.":
    { ru: "Право соперника было подарком соперника: выбирать, какая фигура войдёт в ваше пространство. Мудрость Лодаров была не в том, чтобы избегать плохих фигур, — а в том, чтобы находить установку, оставляющую открытым каждый путь и каждый ряд на шаг ближе к закрытию.", be: "Права саперніка была падарункам саперніка: выбіраць, якая фігура ўвойдзе ў вашу прастору. Мудрасць Лодараў была не ў тым, каб пазбягаць дрэнных фігур, — а ў тым, каб знаходзіць ўстаноўку, якая пакідае адкрытым кожны шлях і кожны радок на крок бліжэй да зачынення." },
  "There were seven ranks among them. An UnderLodar learned the names. A ProfiLod saw the container before the piece was called.":
    { ru: "Среди них было семь рангов. UnderLodar выучивал имена. ProfiLod видел контейнер раньше, чем называли фигуру.", be: "Сярод іх было сем рангаў. UnderLodar вывучаў імёны. ProfiLod бачыў кантэйнер раней, чым называлі фігуру." },
  "“Qualification is your real level of thinking. Not access to a hint.”": { ru: "«Квалификация — это ваш реальный уровень мышления. Не доступ к подсказке.»", be: "«Кваліфікацыя — гэта ваш рэальны ўзровень мыслення. Не доступ да падказкі.»" },
  "— attributed to the first MasterLod": { ru: "— приписывается первому MasterLod", be: "— прыпісваецца першаму MasterLod" },
  "ПРАЛОГ": { ru: "ПРОЛОГ", be: "ПРАЛОГ" },
  "− згарнуць": { ru: "− свернуть", be: "− згарнуць" },
  "+ разгарнуць": { ru: "+ развернуть", be: "+ разгарнуць" },
  "Пасланне ад старажытных Лодараў:": { ru: "Послание от древних Лодаров:", be: "Пасланне ад старажытных Лодараў:" },
  "«Мы спадзяемся, што вам хопіць тысячагоддзя, можа быць, два, каб атрымаць першапачатковыя веды, якія ў канчатковым выніку прывядуць вас да ўсіх сакрэтаў складання рэчаў. Гэтыя 27 прадметаў прадстаўлены вам у выглядзе гульні, у якой удзельнічаюць два гульцы: адзін угадвае і кажа, што трэба пакласці, іншы, ламае галаву над тым, як гэта пакласці, і наадварот. Такі падвойны мазгавы штурм дасць вам вынік хутчэй, чым складанне за ўсё ў адну галаву. Не забывайце пра час, які праходзіць паміж ітэрацыямі складання рэчаў. Дзесьці паскорце працэс, дзесьці прытармазіце ці стабілізуйце.»":
    { ru: "«Мы надеемся, что вам хватит тысячелетия, может быть, двух, чтобы получить первоначальные знания, которые в конечном итоге приведут вас ко всем секретам укладки вещей. Эти 27 предметов представлены вам в виде игры, в которой участвуют два игрока: один угадывает и говорит, что нужно положить, другой ломает голову над тем, как это положить, и наоборот. Такой двойной мозговой штурм даст вам результат быстрее, чем укладка всего в одну голову. Не забывайте о времени, которое проходит между итерациями укладки вещей. Где-то ускорьте процесс, где-то притормозите или стабилизируйте.»", be: "«Мы спадзяемся, што вам хопіць тысячагоддзя, можа быць, два, каб атрымаць першапачатковыя веды, якія ў канчатковым выніку прывядуць вас да ўсіх сакрэтаў складання рэчаў. Гэтыя 27 прадметаў прадстаўлены вам у выглядзе гульні, у якой удзельнічаюць два гульцы: адзін угадвае і кажа, што трэба пакласці, іншы, ламае галаву над тым, як гэта пакласці, і наадварот. Такі падвойны мазгавы штурм дасць вам вынік хутчэй, чым складанне за ўсё ў адну галаву. Не забывайце пра час, які праходзіць паміж ітэрацыямі складання рэчаў. Дзесьці паскорце працэс, дзесьці прытармазіце ці стабілізуйце.»" },
  "The full Legend of the Lodars is an ongoing narrative developed alongside the game's community. Follow the Telegram channel for new chapters.":
    { ru: "Полная Легенда Лодаров — развивающееся повествование, создающееся вместе с сообществом игры. Следите за Telegram-каналом ради новых глав.", be: "Поўная Легенда Лодараў — развіваючаеся апавяданне, якое ствараецца разам з супольнасцю гульні. Сачыце за Telegram-каналам дзеля новых раздзелаў." },
}

/** Play / Practice page. */
const PLAY: Dict = {
  "TRAINING SESSION": { ru: "ТРЕНИРОВОЧНАЯ СЕССИЯ", be: "ТРЭНІРОВАНЧАЯ СЕСІЯ" },
  "YOUR TURN": { ru: "ВАШ ХОД", be: "ВАШ ХОД" },
  "RATED": { ru: "РЕЙТИНГ", be: "РЭЙТЫНГ" },
  "PRACTICE": { ru: "ТРЕНИРОВКА", be: "ТРЭНІРОЎКА" },
  "Move {n}": { ru: "Ход {n}", be: "Ход {n}" },
  "vs": { ru: "против", be: "супраць" },
  "engine": { ru: "движок", be: "рухавік" },
  "YOUR CONTAINER": { ru: "ВАШ КОНТЕЙНЕР", be: "ВАШ КАНТЭЙНЕР" },
  "Row closed": { ru: "Ряд закрыт", be: "Радок зачынены" },
  "read-only": { ru: "только просмотр", be: "толькі прагляд" },
  "OPPONENT — {name}": { ru: "СОПЕРНИК — {name}", be: "САПЕРНІК — {name}" },
  "YOUR REMAINING CARGO — figures the opponent can still assign you":
    { ru: "ВАШ ОСТАВШИЙСЯ ГРУЗ — фигуры, которые соперник ещё может назначить вам", be: "ВАШ ЗАСТАВШЫСЯ ГРУЗ — фігуры, якія сапернік яшчэ можа прызначыць вам" },
  "INCOMING CARGO": { ru: "ВХОДЯЩИЙ ГРУЗ", be: "УВАХОДНЫ ГРУЗ" },
  "Drag onto your container, or type notation:": { ru: "Перетащите в контейнер или введите нотацию:", be: "Перацягніце ў кантэйнер або ўвядзіце натацыю:" },
  "e.g. B9C10": { ru: "напр. B9C10", be: "напр. B9C10" },
  "REQUEST — OPPONENT'S REMAINING POOL": { ru: "ЗАПРОС — ОСТАВШИЙСЯ НАБОР СОПЕРНИКА", be: "ЗАПЫТ — ЗАСТАВШЫ НАБОР САПЕРНІКА" },
  "Choose a figure to assign to your opponent. Greyed out = repeat-request restricted.":
    { ru: "Выберите фигуру, которую назначите сопернику. Серое = повторный запрос запрещён.", be: "Выберыце фігуру, якую прызначыце саперніку. Серая = паўторны запыт забаронены." },
  "MOVE HISTORY": { ru: "ИСТОРИЯ ХОДОВ", be: "ГІСТОРЫЯ ХОДАЎ" },
  "You": { ru: "Вы", be: "Вы" },
  "Opp": { ru: "Соп", be: "Сап" },
}

/** Sandbox page + tutorial. */
const SANDBOX: Dict = {
  "SANDBOX": { ru: "ПЕСОЧНИЦА", be: "ПЯСОЧНІЦА" },
  "UNRATED · FREE PLACEMENT · 15×{rows}": { ru: "БЕЗ РЕЙТИНГА · СВОБОДНАЯ УСТАНОВКА · 15×{rows}", be: "БЕЗ РЭЙТЫНГУ · ВОЛЬНАЯ УСТАНОЎКА · 15×{rows}" },
  "TUTORIAL · STEP {step} OF {total}": { ru: "ОБУЧЕНИЕ · ШАГ {step} ИЗ {total}", be: "НАВУЧАННЕ · КРОК {step} З {total}" },
  "Restart tutorial": { ru: "Перезапустить обучение", be: "Перазапусціць навучанне" },
  "← Back": { ru: "← Назад", be: "← Назад" },
  "Skip to free sandbox": { ru: "Пропустить к свободной песочнице", be: "Прапусціць да вольнай пясочніцы" },
  "Clear container": { ru: "Очистить контейнер", be: "Ачысціць кантэйнер" },
  "Reset demo": { ru: "Сбросить демо", be: "Скінуць дэма" },
  "RULE HIGHLIGHTS:": { ru: "ПОДСВЕТКА ПРАВИЛ:", be: "ПАДСВЕТКА ПРАВІЛ:" },
  "Click grid to place selected figure.": { ru: "Нажимайте на поле, чтобы установить выбранную фигуру.", be: "Націскайце на поле, каб усталяваць выбраную фігуру." },
  "TRAINING CONTAINER": { ru: "ТРЕНИРОВОЧНЫЙ КОНТЕЙНЕР", be: "ТРЭНІРОВАНЧЫ КАНТЭЙНЕР" },
  "This extra row is yours while you're learning to stack. Once you've got it, you'll play on 15×10 — and this line becomes the ceiling.":
    { ru: "Этот дополнительный ряд — ваш, пока вы учитесь укладке. Освоите — перейдёте на 15×10, и эта линия станет потолком.", be: "Гэты дадатковы радок — ваш, пакуль вучыцеся ўкладцы. Асвоіце — пераідзеце на 15×10, і гэтая лінія стане столлю." },
  "FIGURE PICKER": { ru: "ВЫБОР ФИГУРЫ", be: "ВЫБАР ФІГУРЫ" },
  "Clear all": { ru: "Очистить всё", be: "Ачысціць усё" },
  "Pick a figure from the bank first.": { ru: "Сначала выберите фигуру из набора.", be: "Спачатку выберыце фігуру з набору." },
  "Click the container to mark the reference point(s) first.": { ru: "Сначала отметьте на контейнере опорные точки.", be: "Спачатку пазначце на кантэйнеры апорныя кропкі." },
  "Invalid: {reason}": { ru: "Недопустимо: {reason}", be: "Недапушчальна: {reason}" },
  "{reason}. In a real match this needs the opponent's fair-play OK — click Place again to confirm you'd still place it here.":
    { ru: "{reason}. В настоящем матче для этого нужно согласие соперника через fair play — нажмите «Установить» ещё раз, чтобы подтвердить, что вы всё равно ставите её сюда.", be: "{reason}. У сапраўдным матчы для гэтага патрэбна згода саперніка праз fair play — націсніце «Усталяваць» яшчэ раз, каб пацвердзіць, што вы ўсё роўна ставіце яе сюды." },
  "Place": { ru: "Установить", be: "Усталяваць" },
  "That notation is for figure {id}, not {label}.": { ru: "Эта нотация для фигуры {id}, а не {label}.", be: "Гэтая натацыя для фігуры {id}, а не {label}." },
  "{label} needs {n} reference point(s) — got {m}.": { ru: "Фигуре {label} нужны {n} опорные точки — а получено {m}.", be: "Фігуры {label} патрэбны {n} апорныя кропкі — а атрымана {m}." },
  "Reset": { ru: "Сброс", be: "Скінуць" },
  "Next →": { ru: "Далее →", be: "Далей →" },
  "STEP 1 OF 10 — THE GOAL": { ru: "ШАГ 1 ИЗ 10 — ЦЕЛЬ", be: "КРОК 1 З 10 — МЭТА" },
  "Stow cargo, close rows and columns": { ru: "Укладывайте груз, закрывайте ряды и столбцы", be: "Укладвайце груз, зачыняйце рады і калонкі" },
  "In a real match your opponent chooses which cargo figure you receive next, and you place it in your container. Fill every cell of a row or a column and it closes — closing 5 rows and/or columns first wins the game. This sandbox skips the opponent: pick any figure, any time, and see how placement really works before you play for real.":
    { ru: "В настоящем матче соперник выбирает, какую фигуру груза вы получите следующей, а вы устанавливаете её в свой контейнер. Заполните каждую клетку ряда или столбца — и он закрывается; кто первым закроет 5 рядов и/или столбцов, тот и выигрывает. Песочница пропускает соперника: выбирайте любую фигуру когда угодно и посмотрите, как установка работает по-настоящему, прежде чем играть всерьёз.", be: "У сапраўдным матчы сапернік выбірае, якую фігуру груза вы атрымаеце наступнай, а вы ўсталёўваеце яе ў свой кантэйнер. Запоўніце кожную клетку радка ці калонкі — і ён зачыняецца; хто першым зачыніць 5 радоў і/ці калонак, той і выйграе. Пясочніца прапускае саперніка: выбірайце любую фігуру калі заўгодна і паглядзіце, як ўстаноўка працуе па-сапраўднаму, перш чым гуляць сур'ёзна." },
  "Start →": { ru: "Начать →", be: "Пачаць →" },
  "STEP 2 OF 10 — ENTRANCE & FIRST PLACEMENT": { ru: "ШАГ 2 ИЗ 10 — ВХОД И ПЕРВАЯ УСТАНОВКА", be: "КРОК 2 З 10 — УВАХОД І ПЕРШАЯ ЎСТАНОЎКА" },
  "The cyan cell is": { ru: "Голубая клетка", be: "Блакітная клетка" },
  "— the entrance. Every piece of cargo must be reachable from here. You've been handed figure":
    { ru: "— вход. Каждая фигура груза должна быть достижима отсюда. Вам выдали фигуру", be: "— уваход. Кожная фігура груза павінна быць дасяжнай адсюль. Вам выдалі фігуру" },
  "a single cell — the simplest placement there is.": { ru: "— одна клетка, самая простая установка из возможных.", be: "— адна клетка, найпрасцейшая ўстаноўка з магчымых." },
  "Click any cell on the bottom row to place it.": { ru: "Нажмите на любую клетку нижнего ряда, чтобы установить её.", be: "Націсніце на любую клетку ніжняга радка, каб усталяваць яе." },
  "STEP 3 OF 10 — NOTATION": { ru: "ШАГ 3 ИЗ 10 — НОТАЦИЯ", be: "КРОК 3 З 10 — НАТАЦЫЯ" },
  "You just recorded your first move": { ru: "Вы только что записали свой первый ход", be: "Вы толькі што запісалі свой першы ход" },
  "That's the figure's number followed by the cell(s) its reference dots landed on — the same notation you'll report to your opponent (or the server records) in a real match. Every figure has 1 or 2 reference dots; a wider figure needs two cells to pin down its rotation, a single-cell figure like this one needs just one.":
    { ru: "Это номер фигуры, за которым следуют клетки, на которые легли её опорные точки, — та же нотация, которую вы будете сообщать сопернику (или которую запишет сервер) в настоящем матче. У каждой фигуры 1 или 2 опорные точки; более широкой фигуре нужны две клетки, чтобы закрепить поворот, а одноклеточной, как эта, достаточно одной.", be: "Гэта нумар фігуры, за якім ідуць клеткі, на якія леглі яе апорныя кропкі, — тая ж натацыя, якую вы паведамляцьме саперніку (ці якую запіша сервер) у сапраўдным матчы. У кожнай фігуры 1 ці 2 апорныя кропкі; шырэйшай фігуры патрэбны дзве клеткі, каб замацаваць паварот, а аднаклетачнай, як гэтая, хопіць адной." },
  "STEP 4 OF 10 — CORE RULES ({cur}/4 — {title})": { ru: "ШАГ 4 ИЗ 10 — ОСНОВНЫЕ ПРАВИЛА ({cur}/4 — {title})", be: "КРОК 4 З 10 — АСНОЎНЫЯ ПРАВІЛЫ ({cur}/4 — {title})" },
  "← Prev rule": { ru: "← Предыдущее правило", be: "← Папярэдняе правіла" },
  "Next rule →": { ru: "Следующее правило →", be: "Наступнае правіла →" },
  "Next step →": { ru: "Следующий шаг →", be: "Наступны крок →" },
  "STEP 5 OF 10 — MEET F15: PLACE BY POINTS": { ru: "ШАГ 5 ИЗ 10 — ЗНАКОМЬТЕСЬ, F15: УСТАНОВКА ПО ТОЧКАМ", be: "КРОК 5 З 10 — ЗНАЁМСТВА З F15: УСТАНОЎКА ПА КРОПКАМ" },
  "needs": { ru: "нужны", be: "патрэбны" },
  "reference points, not one — a single point can't pin down both where and which way an asymmetric shape sits. The first click and the second aren't interchangeable: swap their order and you get a different orientation.":
    { ru: "опорные точки, а не одна — одной точкой нельзя закрепить одновременно и где, и какой стороной лежит несимметричная фигура. Первый и второй клик не взаимозаменяемы: поменяете их местами — получите другую ориентацию.", be: "апорныя кропкі, а не адна — адной кропкай нельга замацаваць адначасова і дзе, і якой стараной ляжыць несіметрычная фігура. Першы і другі клік не ўзаемазамяняльныя: памяняеце іх месцамі — атрымаеце іншую арыентацыю." },
  "Click two cells in the container, in order. Try to place it without walling off any cell — you'll find out right after whether you did.":
    { ru: "Нажмите две клетки в контейнере по порядку. Попробуйте установить фигуру, не замуровав ни одной клетки — сразу после установки узнаете, получилось ли.", be: "Націсніце дзве клеткі ў кантэйнеры па парадку. Паспрабуйце ўсталяваць фігуру, не замураваўшы ніводнай клеткі — адразу пасля ўстаноўкі даведаецеся, ці атрымалася." },
  "This placement walled off {n} cell(s) — they can never receive cargo now. Try Reset for a cleaner spot.":
    { ru: "Эта установка замуровала {n} клетку(и) — груз туда теперь не доставить никогда. Попробуйте «Сброс» и более чистое место.", be: "Гэтая ўстаноўка замуравала {n} клетку(ы) — груз туды цяпер не дастаць ніколі. Паспрабуйце «Скінуць» і больш чыстае месца." },
  "Clean placement — no cells were walled off.": { ru: "Чистая установка — ни одна клетка не замурована.", be: "Чыстая ўстаноўка — ніводна клетка не замуравана." },
  "STEP 6 OF 10 — PLACE BY NOTATION": { ru: "ШАГ 6 ИЗ 10 — УСТАНОВКА ПО НОТАЦИИ", be: "КРОК 6 З 10 — УСТАНОЎКА ПА НАТАЦЫІ" },
  "Same figure, same two reference dots — this time write where they land instead of clicking them. Format: figure id, then each point as a row letter and column number, e.g. {ex}.":
    { ru: "Та же фигура, те же две опорные точки — но теперь запишите, куда они легли, вместо кликов. Формат: номер фигуры, затем каждая точка как буква ряда и номер колонки, напр. {ex}.", be: "Тая ж фігура, тыя ж дзве апорныя кропкі — але цяпер запішыце, куды яны леглі, замест клікаў. Фармат: нумар фігуры, потым кожная кропка як літара радка і нумар калонкі, напр. {ex}." },
  "STEP 7 OF 10 — {phase}": { ru: "ШАГ 7 ИЗ 10 — {phase}", be: "КРОК 7 З 10 — {phase}" },
  "SHIPMENT {n} OF {m}": { ru: "ОТГРУЗКА {n} ИЗ {m}", be: "АДГРУЗКА {n} З {m}" },
  "BONUS {n} OF {m}": { ru: "БОНУС {n} ИЗ {m}", be: "БОНУС {n} З {m}" },
  "ALL SHIPMENTS DONE": { ru: "ВСЕ ОТГРУЗКИ ЗАВЕРШЕНЫ", be: "УСЕ АДГРУЗКІ ЗАВЕРШАНЫ" },
  "Five figures, fed one at a time — just like a real opponent handing you cargo. Place each one, by clicking or by notation, and try to finish all five with {zero} dead cells. Two harder bonus figures follow if you want more practice.":
    { ru: "Пять фигур, по одной за раз — как в настоящем матче, когда соперник передаёт вам груз. Установите каждую — кликами или нотацией — и постарайтесь пройти все пять с {zero} мёртвыми клетками. Дальше — две фигуры посложнее в качестве бонуса, если захотите продолжить.", be: "Пяць фігур, па адной за раз — як у сапраўдным матчы, калі сапернік перадае вам груз. Усталюйце кожную — клікамі ці натацыяй — і паспрабуйце прайсці ўсе пяць з {zero} мёртвымі клеткамі. Далей — дзве фігуры складанейшыя ў якасці бонусу, калі захочаце працягнуць." },
  "zero": { ru: "нулевым числом", be: "нулявым лікам" },
  "Place (click points)": { ru: "Установить (кликами)", be: "Усталяваць (клікамі)" },
  "or type notation, e.g. {ex}": { ru: "или введите нотацию, напр. {ex}", be: "ці ўвядзіце натацыю, напр. {ex}" },
  "Place (from notation)": { ru: "Установить (по нотации)", be: "Усталяваць (па натацыі)" },
  "Dead cells so far: {n}": { ru: "Мёртвых клеток пока: {n}", be: "Мёртвых клетак пакуль: {n}" },
  "Reset last": { ru: "Сбросить последнюю", be: "Скінуць апошнюю" },
  "Reset all": { ru: "Сбросить всё", be: "Скінуць усё" },
  "That one walled off {n} cell(s).": { ru: "Эта установка замуровала {n} клетку(и).", be: "Гэтая ўстаноўка замуравала {n} клетку(ы)." },
  "Clean — no cells walled off.": { ru: "Чисто — ни одна клетка не замурована.", be: "Чыста — ніводна клетка не замуравана." },
  "That placement walled off {n} cell(s). Reset and try another spot for a clean one.":
    { ru: "Эта установка замуровала {n} клетку(и). Сделайте сброс и попробуйте другое место — чистое.", be: "Гэтая ўстаноўка замуравала {n} клетку(ы). Зрабіце скід і паспрабуйце іншае месца — чыстае." },
  "Clean — 0 new dead cells.": { ru: "Чисто — 0 новых мёртвых клеток.", be: "Чыста — 0 новых мёртвых клетак." },
  "STEP 8 OF 10 — CLIMBING (AND CAREFULLY DESCENDING) A TALL STEP": { ru: "ШАГ 8 ИЗ 10 — ПОДЪЁМ (И ОСТОРОЖНЫЙ СПУСК) ПО ВЫСОКОЙ СТУПЕНИ", be: "КРОК 8 З 10 — УЗДЫМ (І АСЯРОДЖНЫ СПУСК) ПА ВЫСОКАЙ ПРЫСТУПЦЫ" },
  "F4 is standing on end in the middle of the container — a wall 4 cells tall, too tall to cross from either side. You can fix the situation by placing a figure to the left of the tall step. You have a repair toolkit — choose the right figure and place it so you can pass further.":
    { ru: "F4 стоит вертикально посреди контейнера — стена высотой 4 клетки, слишком высокая, чтобы перейти её с любой стороны. Исправить ситуацию можно, установив фигуру слева от высокой ступени. У вас есть ремонтный набор — выберите подходящую фигуру и установите её так, чтобы можно было пройти дальше.", be: "F4 стаіць вертыкальна пасярод кантэйнера — сцяна вышынёй 4 клеткі, занадта высокая, каб перайсці яе з любога боку. Выправіць сітуацыю можна, усталяваўшы фігуру злева ад высокай прыступкі. У вас ёсць рамонтны набор — выберыце прыдатную фігуру і ўсталюйце яе так, каб можна было прайсці далей." },
  "The gap is bridged — the space right above the wall is reachable now. Place cargo carefully to the right of the tall step, hanging over open air, to gently set down fragile cargo. Choose the right cargo and reduce the height of the problem:":
    { ru: "Перепад перекрыт — пространство над стеной теперь достижимо. Аккуратно установите груз справа от высокой ступени, свешиваясь над пустотой, чтобы мягко опустить хрупкий груз. Выберите подходящий груз и уменьшите высоту проблемы:", be: "Перапад перакрыты — прастора над сцяной цяпер дасяжная. Асцярожна ўсталюйце груз справа ад высокай прыступкі, звісаючы над пустатай, каб мякка апусціць далікатны груз. Выберыце прыдатны груз і паменшыце вышыню праблемы:" },
  "rests safely right on top of the wall, no risk.": { ru: "спокойно лежит прямо на стене, без риска.", be: "спакойна ляжыць проста на сцяне, без рызыкі." },
  "reaches further but hangs mostly over open air — that needs your fair-play OK, same as the overhang rule from Step 4.":
    { ru: "достаёт дальше, но в основном висит над пустотой — для этого нужно ваше fair-play-согласие, как в правиле навеса из шага 4.", be: "дасягае далей, але пераважна висіць над пустатай — для гэтага патрэбна ваша fair-play-згода, як у правіле навесу з кроку 4." },
  "STEP 9 OF 10 — FAIR PLAY, BOTH WAYS": { ru: "ШАГ 9 ИЗ 10 — FAIR PLAY, В ОБЕ СТОРОНЫ", be: "КРОК 9 З 10 — FAIR PLAY, У АБОДВА БАКІ" },
  "Your opponent can say yes — or no": { ru: "Соперник может согласиться — или отказать", be: "Сапернік можа згодзіцца — або адмовіць" },
  "The same overhang scenario from the rules overview — but this time you see both of your opponent's possible answers, not just the happy path.":
    { ru: "Тот же сценарий навеса из обзора правил — но теперь вы видите оба возможных ответа соперника, а не только благоприятный.", be: "Той жа сцэнарый навесу з агляду правіл — але цяпер вы бачыце абодва магчымыя адказы саперніка, а не толькі спрыяльны." },
  "✓ Opponent confirms": { ru: "✓ Соперник соглашается", be: "✓ Сапернік згодзіцца" },
  "✗ Opponent declines": { ru: "✗ Соперник отказывает", be: "✗ Сапернік адмаўляе" },
  "Placed — both players confirmed it.": { ru: "Установлено — оба игрока подтвердили.", be: "Усталявана — абодва гульцы пацвердзілі." },
  "In a real match, your opponent explicitly agrees to this exact placement before it's allowed — never automatic, never one-sided.":
    { ru: "В настоящем матче соперник явно соглашается именно на эту установку, прежде чем она будет разрешена, — никогда автоматически, никогда в одностороннем порядке.", be: "У сапраўдным матчы сапернік відавочна згаджаецца менавіта на гэтую ўстаноўку, перш чым яна будзе дазволена, — ніколі аўтаматычна, ніколі ў аднабаковым парадку." },
  "See the decline instead →": { ru: "Посмотреть отказ →", be: "Паглядзець адмову →" },
  "Declined — nothing was placed.": { ru: "Отказано — ничего не установлено.", be: "Адмоўлена — нічога не ўсталявана." },
  "Your opponent can also say no. Nothing is placed — you keep the figure and try somewhere else.":
    { ru: "Соперник может и отказать. Ничего не установлено — фигура остаётся у вас, пробуйте другое место.", be: "Сапернік можа і адмовіць. Нічога не ўсталявана — фігура застаецца ў вас, паспрабуйце іншае месца." },
  "See the confirm instead →": { ru: "Посмотреть согласие →", be: "Паглядзець згоду →" },
  "STEP 10 OF 10 — HOW TO ACTUALLY WIN": { ru: "ШАГ 10 ИЗ 10 — КАК В САМОМ ДЕЛЕ ВЫИГРЫВАТЬ", be: "КРОК 10 З 10 — ЯК У САМЫМ ДЗЕЛЕ ВЫЙГРАВАЦЬ" },
  "A few things worth watching for": { ru: "Немного о том, на что стоит обращать внимание", be: "Немнога пра тое, на што варта звяртаць увагу" },
  "— Keep rows in play as long as possible — avoid creating dead cells.": { ru: "— Держите ряды «в игре» как можно дольше — не создавайте мёртвых клеток.", be: "— Трымайце рады «у гульні» як мага даўжэй — не стварайце мёртвых клетак." },
  "— Hand your opponent the more awkward figure when you get to choose.": { ru: "— При выборе передавайте сопернику самую неудобную фигуру.", be: "— Пры выбары перадавайце саперніку самую нязручную фігуру." },
  "— Avoid building tall steps that cost you extra moves to fix later.": { ru: "— Не наращивайте высокие ступени, за которые потом придётся платить лишними ходами.", be: "— Не нарашчайце высокія прыступкі, за якія потым прыйдзецца заплаціць лішнімі ходамі." },
  "— Keep an eye on passability across the whole container.": { ru: "— Следите за проходимостью всего контейнера.", be: "— Сачыце за праходнасцю ўсяго кантэйнера." },
  "— Don't leave narrow bottlenecks.": { ru: "— Не оставляйте узких «бутылочных горлышек».", be: "— Не пакідайце вузкіх «бутэлечных гарлавін»." },
  "Finish tutorial →": { ru: "Завершить обучение →", be: "Завершыць навучанне →" },
  "Your adventure at PuzzleStow has begun": { ru: "Ваше приключение в PuzzleStow началось", be: "Ваша прыгода ў PuzzleStow пачалася" },
  "A long but exciting and interesting road ahead. But the nearest goal is already in sight. Don't stop and go forward. Win ten times first, successfully pass the exam, and advance to the Lodar 15X10 level. Good luck in your promotion on the Lodar staircase!":
    { ru: "Впереди долгая, но увлекательная и интересная дорога. А ближайшая цель уже видна. Не останавливайтесь и идите вперёд. Сначала выиграйте десять раз, успешно сдайте экзамен и переходите на уровень Lodar 15×10. Удачи на лестнице Лодара!", be: "Паперадзе доўгая, але захапляльная і цікавая дарога. А бліжэйшая мэта ўжо відна. Не спыняйцеся і ідзіце наперад. Спачатку выйграйце дзесяць разоў, паспяхова складзеце экзамен і пераходзіце на ўзровень Lodar 15×10. Поспеху на лесвіцы Лодара!" },
  "(The “Новичок” badge itself isn't wired to your profile yet — this screen is a stand-in until that's built.)":
    { ru: "(Значок «Новичок» пока не привязан к профилю — этот экран временный, до внедрения привязки.)", be: "(Значак «Новычок» пакуль не прывязаны да профілю — гэты экран часовы, да ўвядзення прывязкі.)" },
  "Continue to free sandbox →": { ru: "Продолжить в свободной песочнице →", be: "Працягнуць у вольнай пясочніцы →" },
  "SELECTED — {label}": { ru: "ВЫБРАНО — {label}", be: "ВЫБРАНА — {label}" },
  "Click {what} on the container.": { ru: "Нажмите {what} в контейнере.", be: "Націсніце {what} у кантэйнеры." },
  "two cells (its reference dots, in order)": { ru: "две клетки (опорные точки, по порядку)", be: "дзве клеткі (апорныя кропкі, па парадку)" },
  "a cell": { ru: "клетку", be: "клетку" },
  "Reset points": { ru: "Сбросить точки", be: "Скінуць кропкі" },
  "Pick a figure below to start placing.": { ru: "Выберите фигуру ниже, чтобы начать установку.", be: "Выберыце фігуру ніжэй, каб пачаць ўстаноўку." },
  "ALL 27 FIGURES — FREE PLACEMENT": { ru: "ВСЕ 27 ФИГУР — СВОБОДНАЯ УСТАНОВКА", be: "УСЕ 27 ФІГУР — ВОЛЬНАЯ УСТАНОЎКА" },
}

/** Rule-overview panels (Sandbox tutorial step 3): per-language structured content. */
export const RULE_OVERVIEW_PANELS: Record<Lang, { title: string; headline: string; body: string; note: string }[]> = {
  EN: [
    { title: "SUPPORT", headline: "Every piece needs something to rest on",
      body: "Nothing in the container may float — every figure must touch the floor, or an already-placed piece, somewhere. Watch what happens when we try to drop a piece straight into empty air:",
      note: "Hard rule — unlike overhang below, there's no fair-play exception for it." },
    { title: "STEPS", headline: "Cargo can't cross a step taller than 3 cells",
      body: "Here the entrance column is stacked 5 cells high. Trying to place a figure past it — straight across that drop — gets rejected, even though the target cell itself is empty and on the floor:",
      note: "A step of 2 or 3 cells is passable; taller than that blocks delivery through it until another placement lowers the gap — the same going up as going down." },
    { title: "OVERHANG & FAIR PLAY", headline: "Most of a piece can hang over empty space — up to a point",
      body: "A figure doesn’t need every cell supported, only enough of it does. Here, one corner of this figure rests on a small ledge; the rest hangs over open air:",
      note: "Over 50% unsupported needs the opponent’s explicit fair-play OK — you’ll walk through exactly how that works, both ways, later in this tutorial." },
    { title: "RETURN PATH", headline: "The very last move can't seal the container shut",
      body: "A placement is refused if it would leave nowhere left to deliver cargo, anywhere in the whole container — here every cell but the entrance is already full, so even a single-cell Mono is rejected if it lands here:",
      note: "This isn't about the figure's size or shape — a Mono is as small as it gets and still can't take this cell. It only guards the literal last reachable cell. Walling off a smaller pocket earlier is legal — those cells simply become permanently dead space." },
  ],
  RU: [
    { title: "ОПОРА", headline: "Каждой фигуре нужно, на что опереться",
      body: "В контейнере ничто не может висеть — каждая фигура где-то обязана касаться пола или уже установленной фигуры. Посмотрите, что происходит, когда мы пытаемся опустить фигуру прямо в пустоту:",
      note: "Жёсткое правило — в отличие от навеса ниже, fair-play-исключения для него нет." },
    { title: "СТУПЕНИ", headline: "Груз не может пересечь ступень выше 3 клеток",
      body: "Здесь колонка входа сложена на высоту 5 клеток. Попытка установить фигуру дальше — прямиком через этот обрыв — отклоняется, хотя сама целевая клетка пуста и лежит на полу:",
      note: "Ступень в 2 или 3 клетки проходима; выше — она блокирует проход, пока другая установка не уменьшит перепад, — и на подъёме, и на спуске." },
    { title: "НАВЕС И FAIR PLAY", headline: "Большая часть фигуры может висеть над пустотой — но лишь до предела",
      body: "Фигуре не обязана иметь опору под каждой клеткой — достаточно достаточной её части. Здесь один угол этой фигуры опирается на небольшой уступ; остальное висит над пустотой:",
      note: "Свес более 50% требует явного fair-play-согласия соперника — чуть позже в этом обучении вы пройдёте, как это работает, в обе стороны." },
    { title: "ПУТЬ НАЗАД", headline: "Самый последний ход не может замуровать контейнер",
      body: "Установка отклоняется, если после неё нигде во всём контейнере не останется места для доставки груза — здесь заполнена каждая клетка, кроме входа, поэтому даже одноклеточный Mono отклоняется, если встаёт сюда:",
      note: "Дело не в размере или форме фигуры — Mono мельче не бывает, и всё же он не может занять эту клетку. Это правило охраняет буквально последнюю достижимую клетку. Замуровать меньший карман раньше — законно: те клетки просто становятся навсегда мёртвым пространством." },
  ],
  BY: [
    { title: "АПОРА", headline: "Кожнай фігуры патрэбна апора",
      body: "У кантэйнеры нішто не можа вісець — кожная фігура дзе-небудзь абавязана дакранацца падлогі ці ўжо ўсталяванай фігуры. Паглядзіце, што адбываецца, калі мы спрабуем апусціць фігуру проста ў пустату:",
      note: "Жорсткае правіла — у адрозненне ад навесу ніжэй, fair-play-выключэння для яго няма." },
    { title: "ПРЫСТУПКІ", headline: "Груз не можа перасекчы прыступку вышэйшай за 3 клеткі",
      body: "Тут калонка ўваходу складзена на вышыню 5 клетак. Спроба ўсталяваць фігуру далей — прама праз гэты абрыў — адхіляецца, хоць сама мэтавая клетка пустая і ляжыць на падлозе:",
      note: "Прыступка ў 2 ці 3 клеткі праходная; вышэй — яна блакуе праход, пакуль іншая ўстаноўка не зменшыць перапад, — і на ўздыме, і на спуску." },
    { title: "НАВЕС І FAIR PLAY", headline: "Большая частка фігуры можа вісець над пустатай — але толькі да мяжы",
      body: "Фігуры не абавязкова мець апору пад кожнай клеткай — хопіць дастатковай яе часткі. Тут адзін вугал гэтай фігуры абапіраецца на невялікую прыступку; астатняе висіць над пустатай:",
      note: "Звіс больш за 50% патрабуе відавочнай fair-play-згоды саперніка — крыху пазней у гэтым навучанні вы пройдзеце, як гэта працуе, у абодва бакі." },
    { title: "ШЛЯХ НАЗАД", headline: "Самы апошні ход не можа замураваць кантэйнер",
      body: "Устаноўка адхіляецца, калі пасля яе нідзе ва ўсім кантэйнеры не застанецца месца для дастаўкі груза — тут запоўнена кожная клетка, акрамя ўваходу, таму нават аднаклетачны Mono адхіляецца, калі становіцца сюды:",
      note: "Справа не ў памеры ці форме фігуры — Mono менш не бывае, і ўсё ж ён не можа заняць гэтую клетку. Гэта правіла ахоўвае літаральна апошнюю дасяжную клетку. Змураваць меншы кішэню раней — законна: тыя клеткі проста становяцца назаўсёды мёртвай прасторай." },
  ],
}

/** Gated preview (signed-out pages). */
const GATED: Dict = {
  "Sign in to play Practice": { ru: "Войдите, чтобы играть в Тренировку", be: "Увайдзіце, каб гуляць у Трэніроўку" },
  "Practice runs against the built-in algorithmic engine — unrated, for training. Sign in to unlock it.":
    { ru: "Тренировка проходит против встроенного алгоритмического движка — без рейтинга, для обучения. Войдите, чтобы открыть.", be: "Трэніроўка ідзе супраць убудаванага алгарытмічнага рухавіка — без рэйтынгу, для навучання. Увайдзіце, каб адчыніць." },
  "An unrated match against the algorithmic engine, at your chosen difficulty": { ru: "Нерейтинговый матч против алгоритмического движка, на выбранной вами сложности", be: "Нерэйтынгавы матч супраць алгарытмічнага рухавіка, на выбранай вамі складанасці" },
  "The same rules and validation as a real match, with nothing at stake": { ru: "Те же правила и проверки, что в настоящем матче, но без ставок", be: "Тыя ж правілы і праверкі, што ў сапраўдным матчы, але без стаўак" },
  "A live log of every move, with PDF export when the match ends": { ru: "Живая история каждого хода, с экспортом в PDF по окончании матча", be: "Жывая гісторыя кожнага ходу, з экспартам у PDF па заканчэнні матча" },
  "Sign in to use the Sandbox": { ru: "Войдите, чтобы открыть Песочницу", be: "Увайдзіце, каб адчыніць Пясочніцу" },
  "Free placement, rule highlights, and a step-by-step tutorial — sign in to start experimenting.":
    { ru: "Свободная установка, подсветка правил и пошаговое обучение — войдите, чтобы начать эксперименты.", be: "Вольная ўстаноўка, падсветка правіл і пакрокавае навучанне — увайдзіце, каб пачаць эксперыменты." },
  "A 4-step guided tutorial: your first placement, notation, and the step-height rule explained live": { ru: "Обучающий тур из 4 шагов: первая установка, нотация и правило высоты ступеней с живыми примерами", be: "Навучальны тур з 4 крокаў: першая ўстаноўка, натацыя і правіла вышыні прыступак з жывымі прыкладамі" },
  "Free placement of all 27 figures afterward, with no limits or scoring": { ru: "После обучения — свободная установка всех 27 фигур, без ограничений и подсчёта очков", be: "Пасля навучання — вольная ўстаноўка ўсіх 27 фігур, без абмежаванняў і падліку ачкоў" },
  "Toggleable highlights for every placement rule (support, steps, overhang, return path)": { ru: "Включаемые подсветки для каждого правила установки (опора, ступени, навес, путь назад)", be: "Уключальныя падсветкі для кожнага правілы ўстаноўкі (апора, прыступкі, навес, шлях назад)" },
}

/** Auth page. */
const AUTH: Dict = {
  "Password updated": { ru: "Пароль обновлён", be: "Пароль абноўлены" },
  "Your new password is set. You're already signed in with it.": { ru: "Новый пароль установлен. Вы уже вошли с ним.", be: "Новы пароль усталяваны. Вы ўжо ўвайшлі з ім." },
  "Continue": { ru: "Продолжить", be: "Працягнуць" },
  "Link expired": { ru: "Ссылка устарела", be: "Спасылка састарэла" },
  "This password reset link has expired or was already used. Request a new one from the sign-in page.":
    { ru: "Ссылка сброса пароля устарела или уже была использована. Запросите новую на странице входа.", be: "Спасылка скіду пароля састарэла ці ўжо была выкарыстана. Запытайце новую на старонцы ўваходу." },
  "Back to sign in": { ru: "Вернуться ко входу", be: "Вярнуцца да ўваходу" },
  "Preparing password reset…": { ru: "Подготавливаем сброс пароля…", be: "Рыхтуем скід пароля…" },
  "Verifying your reset link, one moment…": { ru: "Проверяем ссылку сброса, минуту…", be: "Правяраем спасылку скіду, хвіліну…" },
  "Set a new password": { ru: "Задайте новый пароль", be: "Задайце новы пароль" },
  "Choose a new password for your account.": { ru: "Выберите новый пароль для своего аккаунта.", be: "Выберыце новы пароль для свайго акаўнта." },
  "New password": { ru: "Новый пароль", be: "Новы пароль" },
  "Confirm new password": { ru: "Подтвердите новый пароль", be: "Пацвердзіце новы пароль" },
  "Minimum 8 characters": { ru: "Минимум 8 символов", be: "Мінімум 8 сімвалаў" },
  "Passwords do not match": { ru: "Пароли не совпадают", be: "Паралі не супадаюць" },
  "Saving…": { ru: "Сохраняем…", be: "Захоўваем…" },
  "Save new password": { ru: "Сохранить новый пароль", be: "Захаваць новы пароль" },
  "Check your email": { ru: "Проверьте почту", be: "Праверце пошту" },
  "We sent a password reset link to {email}. Follow it to choose a new password.":
    { ru: "Мы отправили ссылку сброса пароля на {email}. Перейдите по ней, чтобы задать новый пароль.", be: "Мы адправілі спасылку скіду пароля на {email}. Перайдзіце па ёй, каб задатаць новы пароль." },
  "Reset your password": { ru: "Сброс пароля", be: "Скінуць пароль" },
  "Enter your email and we'll send you a reset link.": { ru: "Введите почту, и мы отправим вам ссылку сброса.", be: "Увядзіце пошту, і мы адправім вам спасылку скіду." },
  "Email": { ru: "Почта", be: "Пошта" },
  "Sending…": { ru: "Отправляем…", be: "Адпраўляем…" },
  "Send reset link": { ru: "Отправить ссылку сброса", be: "Адправіць спасылку скіду" },
  "Enter a valid email address": { ru: "Введите корректный адрес почты", be: "Увядзіце карэктны адрас пошты" },
  "We sent a confirmation link to {email}. Follow it to activate your account.":
    { ru: "Мы отправили ссылку подтверждения на {email}. Перейдите по ней, чтобы активировать аккаунт.", be: "Мы адправілі спасылку пацверджання на {email}. Перайдзіце па ёй, каб актываваць акаўнт." },
  "Resend (available after 60s)": { ru: "Отправить снова (доступно через 60 с)", be: "Адправіць зноў (даступна праз 60 с)" },
  "Required": { ru: "Обязательное поле", be: "Абавязковае поле" },
  "You must agree to the rules to continue": { ru: "Чтобы продолжить, нужно согласиться с правилами", be: "Каб працягнуць, трэба згодзіцца з правіламі" },
  "This email is already used": { ru: "Эта почта уже занята", be: "Гэтая пошта ўжо занята" },
  "Incorrect email or password": { ru: "Неверная почта или пароль", be: "Няправільная пошта ці пароль" },
  "Sign in": { ru: "Войти", be: "Увайсці" },
  "Signing in…": { ru: "Входим…", be: "Уваходзім…" },
  "New here?": { ru: "Впервые здесь?", be: "Упершыню тут?" },
  "Create an account": { ru: "Создать аккаунт", be: "Стварыць акаўнт" },
  "Password": { ru: "Пароль", be: "Пароль" },
  "Forgot password?": { ru: "Забыли пароль?", be: "Забылі пароль?" },
  "Continue with Telegram": { ru: "Продолжить с Telegram", be: "Працягнуць з Telegram" },
  "(optional)": { ru: "(необязательно)", be: "(неабавязкова)" },
  "Telegram login links your account for quick access from the WebView. Email login is the primary method.":
    { ru: "Вход через Telegram привязывает аккаунт для быстрого доступа из WebView. Основной способ — почта.", be: "Уваход праз Telegram прывязвае акаўнт для хуткага доступу з WebView. Асноўны спосаб — пошта." },
  "Create Account": { ru: "Создать аккаунт", be: "Стварыць акаўнт" },
  "Creating account…": { ru: "Создаём аккаунт…", be: "Ствараем акаўнт…" },
  "Already registered?": { ru: "Уже зарегистрированы?", be: "Ужо зарэгістраваны?" },
  "First Name": { ru: "Имя", be: "Імя" },
  "Last Name": { ru: "Фамилия", be: "Прозвішча" },
  "Nickname": { ru: "Ник", be: "Мянушка" },
  "Optional": { ru: "Необязательно", be: "Неабавязкова" },
  "Use nickname on PuzzleStow": { ru: "Использовать ник на PuzzleStow", be: "Выкарыстоўваць мянушку на PuzzleStow" },
  "Your nickname replaces your display name on leaderboards, match history, and badges — in PuzzleStow only, not on PairSec service bookings.":
    { ru: "Ник заменяет ваше отображаемое имя в таблицах лидеров, истории матчей и значках — только на PuzzleStow, не в заказах услуг PairSec.", be: "Мянушка замяняе адлюстраванае імя ў табліцах лідараў, гісторыі матчаў і значках — толькі на PuzzleStow, не ў заказах паслуг PairSec." },
  "Confirm Password": { ru: "Подтвердите пароль", be: "Пацвердзіце пароль" },
  "I have read and agree to the game rules and terms of use": { ru: "Я прочитал(а) и согласен(на) с правилами игры и условиями использования", be: "Я прачытаў(ла) і згодзен(на) з правіламі гульні і ўмовамі карыстання" },
  "Send me news and updates about PuzzleStow": { ru: "Присылать мне новости и обновления PuzzleStow", be: "Дасылаць мне навіны і абнаўленні PuzzleStow" },
}

/** Profile page. */
const PROFILE: Dict = {
  "Loading your profile…": { ru: "Загружаем ваш профиль…", be: "Загружаем ваш профіль…" },
  "Couldn't load your profile: {err}": { ru: "Не удалось загрузить профиль: {err}", be: "Не ўдалося загрузіць профіль: {err}" },
  "Retry": { ru: "Повторить", be: "Паўтарыць" },
  "PROFILE": { ru: "ПРОФИЛЬ", be: "ПРОФІЛЬ" },
  "Account Settings": { ru: "Настройки аккаунта", be: "Налады акаўнта" },
  "IDENTITY": { ru: "ЛИЧНОСТЬ", be: "АСОБА" },
  "Avatar": { ru: "Аватар", be: "Аватар" },
  "Uploading…": { ru: "Загружаем…", be: "Загружаем…" },
  "Change avatar": { ru: "Сменить аватар", be: "Змяніць аватар" },
  "DISPLAY NAME": { ru: "ОТОБРАЖАЕМОЕ ИМЯ", be: "АДЛЮСТРАВАНАЕ ІМЯ" },
  "NICKNAME": { ru: "НИК", be: "МЯНУШКА" },
  "Use nickname": { ru: "Использовать ник", be: "Выкарыстоўваць мянушку" },
  "When checked, your nickname replaces your display name on PuzzleStow leaderboards, match history, profile cards, and Lodar Path badges.":
    { ru: "Если включено, ник заменяет отображаемое имя в таблицах лидеров PuzzleStow, истории матчей, карточках профиля и значках Пути Лодара.", be: "Калі ўключана, мянушка замяняе адлюстраванае імя ў табліцах лідараў PuzzleStow, гісторыі матчаў, картках профілю і значках Шляху Лодара." },
  "SHOWN AS IN PUZZLESTOW": { ru: "КАК ОТОБРАЖАЕТСЯ В PUZZLESTOW", be: "ЯК АДЛЮСТРОЎВАЕЦЦА Ў PUZZLESTOW" },
  "PAIRSEC SCOPE NOTE": { ru: "ПРИМЕЧАНИЕ О ГРАНИЦАХ В PAIRSEC", be: "ЗАЎВАГА ПРА МЕЖЫ Ў PAIRSEC" },
  "This nickname toggle applies to PuzzleStow display only. It does not affect how your identity is shown for PairSec service bookings — PairSec's trust model relies on transparent identity for in-person services.":
    { ru: "Переключатель ника действует только на отображение в PuzzleStow. Он не влияет на то, как ваша личность показывается в заказах услуг PairSec — модель доверия PairSec опирается на прозрачную личность при очных услугах.", be: "Пераключальнік мянушкі дзейнічае толькі на адлюстраванне ў PuzzleStow. Ён не ўплывае на тое, як ваша асоба паказваецца ў заказах паслуг PairSec — мадэль даверу PairSec абапіраецца на празрыстую асобу пры вочных паслугах." },
  "Send me news and updates": { ru: "Присылать новости и обновления", be: "Дасылаць навіны і абнаўленні" },
  "Same subscription set at Sign Up — toggle it on or off any time, then Save Changes.":
    { ru: "Та же подписка, что и при регистрации — переключайте в любое время, затем «Сохранить изменения».", be: "Тая ж падпіска, што і пры рэгістрацыі — пераключайце калі заўгодна, потым «Захаваць змены»." },
  "Save Changes": { ru: "Сохранить изменения", be: "Захаваць змены" },
  "Cancel": { ru: "Отмена", be: "Скасаванне" },
  "Tier {n} of {m}": { ru: "Ступень {n} из {m}", be: "Прыступка {n} з {m}" },
  "Could not update avatar": { ru: "Не удалось обновить аватар", be: "Не ўдалося абнавіць аватар" },
}

/** Admin page. */
const ADMIN: Dict = {
  "Sign in required.": { ru: "Требуется вход.", be: "Патрабуецца ўваход." },
  "This page is restricted to Administrators.": { ru: "Эта страница доступна только Администраторам.", be: "Гэтая старонка даступная толькі Адміністратарам." },
  "ADMIN": { ru: "АДМИН", be: "АДМІН" },
  "Site Content": { ru: "Содержимое сайта", be: "Змесціва сайта" },
  "CONFIG VARIABLES": { ru: "ПЕРЕМЕННЫЕ КОНФИГУРАЦИИ", be: "ЗМЕННЫЯ КАНФІГУРАЦЫІ" },
  "Free-form key/value pairs for whatever needs parking without a schema change. Not yet read by any page.":
    { ru: "Свободные пары ключ/значение для всего, что нужно припарковать без изменения схемы. Пока не читается ни одной страницей.", be: "Вольныя пары ключ/значэнне для ўсяго, што трэба спаркаваць без змены схемы. Пакуль не чытаецца ніводнай старонкай." },
  "Loading…": { ru: "Загрузка…", be: "Загрузка…" },
  "Save": { ru: "Сохранить", be: "Захаваць" },
  "Delete": { ru: "Удалить", be: "Выдаліць" },
  "No config variables yet.": { ru: "Переменных конфигурации пока нет.", be: "Зменных канфігурацыі пакуль няма." },
  "value": { ru: "значение", be: "значэнне" },
  "description": { ru: "описание", be: "апісанне" },
  "key": { ru: "ключ", be: "ключ" },
  "Key is required": { ru: "Ключ обязателен", be: "Ключ абавязковы" },
  "Key already exists": { ru: "Такой ключ уже есть", be: "Такі ключ ужо ёсць" },
  "Add": { ru: "Добавить", be: "Дадаць" },
  "MUSIC TRACKS": { ru: "МУЗЫКАЛЬНЫЕ ТРЕКИ", be: "МУЗЫЧНЫЯ ТРЭКІ" },
  "Which track is assigned to which page, and which one is current. Not yet wired to a real player.":
    { ru: "Какой трек назначен какой странице и какой сейчас текущий. Пока не подключено к настоящему плееру.", be: "Які трэк прызначаны якой старонцы і які цяпер бягучы. Пакуль не падключана да сапраўднага плеера." },
  "title": { ru: "название", be: "назва" },
  "audio URL": { ru: "URL аудио", be: "URL аўдыя" },
  "page": { ru: "страница", be: "старонка" },
  "No tracks yet.": { ru: "Треков пока нет.", be: "Трэкаў пакуль няма." },
  "Title is required": { ru: "Название обязательно", be: "Назва абавязковая" },
  "page (optional)": { ru: "страница (необязательно)", be: "старонка (неабавязкова)" },
  "Add track": { ru: "Добавить трек", be: "Дадаць трэк" },
  "NEWS LINE": { ru: "НОВОСТНАЯ ЛЕНТА", be: "НАВІННАЯ ЛЕНТА" },
  "Items for the news-line ticker. Not yet displayed on any public page.":
    { ru: "Элементы бегущей новостной ленты. Пока не показываются ни на одной публичной странице.", be: "Элементы навіннай стужкі. Пакуль не паказваюцца ні на адной публічнай старонцы." },
  "message": { ru: "сообщение", be: "паведамленне" },
  "No news items yet.": { ru: "Новостей пока нет.", be: "Навін пакуль няма." },
  "Message is required": { ru: "Сообщение обязательно", be: "Паведамленне абавязковае" },
  "new news item message": { ru: "текст новой новости", be: "тэкст новай навіны" },
}

/** Print & Play page. */
const PRINTPLAY: Dict = {
  "PRINT & PLAY": { ru: "ПЕЧАТЬ И ИГРА", be: "ДРУК І ГРА" },
  "Play on Paper": { ru: "Игра на бумаге", be: "Гульня на паперы" },
  "“All you need is a sheet of grid paper and a pen.”": { ru: "«Всё, что нужно, — лист бумаги в клетку и ручка.»", be: "«Усё, што трэба, — ліст паперы ў клетку і ручка.»" },
  "PuzzleStow can be played entirely without the app. Print two container grids, keep the figure table nearby, and play face-to-face or by correspondence.":
    { ru: "В PuzzleStow можно играть полностью без приложения. Распечатайте две сетки контейнеров, держите таблицу фигур рядом и играйте лицом к лицу или по переписке.", be: "У PuzzleStow можна гуляць цалкам без прыкладання. Аддрукуйце дзве сеткі кантэйнераў, трымайце табліцу фігур побач і гуляйце вочы ці па перапісцы." },
  "Draw two containers": { ru: "Начертите два контейнера", be: "Начарчыце два кантэйнеры" },
  "Each player draws their 15×10 grid on squared paper, labeling columns 0–14 along the bottom and rows A–J on the right. Mark A0 (bottom-left) as the entry point.":
    { ru: "Каждый игрок чертит свою сетку 15×10 на бумаге в клетку, подписывая колонки 0–14 снизу и ряды A–J справа. Отметьте A0 (левый нижний угол) как точку входа.", be: "Кожны гулец чарціць сваю сетку 15×10 на паперы ў клетку, подпісваючы калонкі 0–14 знізу і рады A–J справа. Пазначце A0 (ніжні левы вугал) як кропку ўваходу." },
  "Mark coordinates": { ru: "Согласуйте координаты", be: "Сагадуйце каардынаты" },
  "Agree on a move notation format — e.g. [figureId][col1][row1][col2][row2]. Record every move in writing so both players can verify the game state at any time.":
    { ru: "Согласуйте формат нотации ходов — напр. [idФигуры][кол1][ряд1][кол2][ряд2]. Записывайте каждый ход письменно, чтобы оба игрока могли в любой момент проверить состояние партии.", be: "Сагадуйце фармат натацыі ходаў — напр. [idФігуры][кал1][рад1][кал2][рад2]. Запісвайце кожны ход пісьмова, каб абодва гульцы маглі ў любы момант праверыць стан партыі." },
  "Keep the figure table nearby": { ru: "Держите таблицу фигур рядом", be: "Трымайце табліцу фігур побач" },
  "Print the 27-figure reference sheet (included in the PDF). Your opponent names a figure ID; you find it in the table and place it in your container.":
    { ru: "Распечатайте справочник 27 фигур (входит в PDF). Соперник называет номер фигуры; вы находите её в таблице и устанавливаете в свой контейнер.", be: "Аддрукуйце даведнік 27 фігур (уваходзіць у PDF). Сапернік называе нумар фігуры; вы знаходзіце яе ў табліцы і ўсталёўваеце ў свой кантэйнер." },
  "Container Templates": { ru: "Шаблоны контейнеров", be: "Шаблоны кантэйнераў" },
  "COMPETITIVE": { ru: "СОРЕВНОВАТЕЛЬНЫЙ", be: "СПАБОРНІЦКІ" },
  "TRAINING": { ru: "ТРЕНИРОВОЧНЫЙ", be: "ТРЭНІРОВАНЧЫ" },
  "Used in all rated matches and practice sessions. Rows A–J (10 rows). The official container for qualification play.":
    { ru: "Используется во всех рейтинговых партиях и тренировках. Ряды A–J (10 рядов). Официальный контейнер квалификационной игры.", be: "Выкарыстоўваецца ва ўсіх рэйтынгавых партыях і трэніроўках. Рады A–J (10 радкоў). Афіцыйны кантэйнер кваліфікацыйнай гульні." },
  "Rated Play · Practice": { ru: "Рейтинговая игра · Тренировка", be: "Рэйтынгавая гульня · Трэніроўка" },
  "Sandbox · Learning": { ru: "Песочница · Обучение", be: "Пясочніца · Навучанне" },
  "Includes the extra row K with the bold J/K separator line. Recommended while learning to stack. The line marks the competitive ceiling.":
    { ru: "Включает дополнительный ряд K с жирной линией-разделителем J/K. Рекомендуется, пока учитесь укладке. Линия отмечает потолок соревновательной игры.", be: "Уключае дадатковы радок K з тлустай лініяй-раздзяляльнікам J/K. Рэкамендуецца, пакуль вучыцеся ўкладцы. Лінія пазначае столю спаборніцкай гульні." },
  "Download PDF — {name}": { ru: "Скачать PDF — {name}", be: "Спампаваць PDF — {name}" },
  "FIGURE REFERENCE": { ru: "СПРАВОЧНИК ФИГУР", be: "ДАВЕДНІК ФІГУР" },
  "All 27 Figures — Quick Reference Sheet": { ru: "Все 27 фигур — краткий справочный лист", be: "Усе 27 фігур — кароткі даведачны ліст" },
  "Download Complete Pack (Rules + Both Templates + Figures)": { ru: "Скачать полный комплект (Правила + оба шаблона + фигуры)", be: "Спампаваць поўны камплект (Правілы + абодва шаблоны + фігуры)" },
  "Note: after drawing a placed figure in the container, write its figure number inside the shape.":
    { ru: "Примечание: после отрисовки установленной фигуры в контейнере впишите её номер внутрь контура.", be: "Заўвага: калі намалявалі ўсталяваную фігуру ў кантэйнеры, упішыце яе нумар унутр контуру." },
  "15×10 Standard": { ru: "15×10 Стандартный", be: "15×10 Стандартны" },
  "15×11 Beginner": { ru: "15×11 Начальный", be: "15×11 Пачатковы" },
}

/** Dev/test page (TO_DO 6-8 harness): fully translated, PDF export stays EN (jsPDF built-in fonts cannot render Cyrillic). */
const DEVTEST: Dict = {
  "DEV / TEST ENVIRONMENT — local engine only, not the production server (TO_DO.docx items 6-8)":
    { ru: "ДЕВ / ТЕСТОВАЯ СРЕДА — только локальный движок, не продакшн-сервер (пункты 6-8 TO_DO.docx)", be: "ДЭВ / ТЭСТАВАЕ АСЯРОДДЗЕ — толькі лакальны рухавік, не прадакшн-сервер (пункты 6-8 TO_DO.docx)" },
  "waiting for a load request…": { ru: "ожидание запроса на загрузку…", be: "чаканне запыту на загрузку…" },
  "THIS LOAD": { ru: "ЭТА ЗАГРУЗКА", be: "ГЭТА ЗАГРУЗКА" },
  "TOTAL TIME": { ru: "ОБЩЕЕ ВРЕМЯ", be: "АГУЛЬНЫ ЧАС" },
  "YOU — LOAD TIMER": { ru: "ВЫ — ТАЙМЕР ЗАГРУЗКИ", be: "ВЫ — ТАЙМЕР ЗАГРУЗКІ" },
  "OPPONENT — LOAD TIMER": { ru: "СОПЕРНИК — ТАЙМЕР ЗАГРУЗКИ", be: "САПЕРНІК — ТАЙМЕР ЗАГРУЗКІ" },
  "request received — running until you send yours": { ru: "запрос получен — идёт до отсылки вашего", be: "запыт атрыманы — ідзе да адсылкі вашага" },
  "request received — running until they send theirs": { ru: "запрос получен — идёт до отсылки ихнего", be: "запыт атрыманы — ідзе да адсылкі іхняга" },
  "QUALIFICATION (TEST)": { ru: "КВАЛИФИКАЦИЯ (ТЕСТ)", be: "КВАЛІФІКАЦЫЯ (ТЭСТ)" },
  "15×11 (training)": { ru: "15×11 (тренировочный)", be: "15×11 (трэніровачны)" },
  "15×10 (competitive)": { ru: "15×10 (соревновательный)", be: "15×10 (спаборніцкі)" },
  "Container size follows qualification: UnderLodar plays 15×11 (row K exposed); Lodar and above play the standard 15×10. Changing this starts a new game.":
    { ru: "Размер контейнера следует квалификации: UnderLodar играет 15×11 (ряд K открыт); Lodar и выше — стандартные 15×10. Смена запускает новую партию.", be: "Памер кантэйнера ідзе за кваліфікацыяй: UnderLodar гуляе 15×11 (радок K адкрыты); Lodar і вышэй — стандартныя 15×10. Змена запускае новую партыю." },
  "OPPONENT DIFFICULTY": { ru: "СЛОЖНОСТЬ СОПЕРНИКА", be: "Складанасць САПЕРНІКА" },
  "Easy (~15% target win rate)": { ru: "Легко (~15% целевой вероятности победы)", be: "Лёгка (~15% мэтавай імавернасці перамогі)" },
  "Medium (~30% target win rate)": { ru: "Средне (~30% целевой вероятности победы)", be: "Сярэдне (~30% мэтавай імавернасці перамогі)" },
  "Hard (~55% target win rate)": { ru: "Сложно (~55% целевой вероятности победы)", be: "Цяжка (~55% мэтавай імавернасці перамогі)" },
  "Easy": { ru: "Легко", be: "Лёгка" },
  "Medium": { ru: "Средне", be: "Сярэдне" },
  "Hard": { ru: "Сложно", be: "Цяжка" },
  "WHO ENTERS FIRST": { ru: "КТО ЗАХОДИТ ПЕРВЫМ", be: "ХТО ЗАХОДЗІЦЬ ПЕРШЫ" },
  "Flipping… (5s)": { ru: "Бросаем… (5 с)", be: "Кідаем… (5 с)" },
  "Flipped": { ru: "Брошено", be: "Кінута" },
  "Flip the coin": { ru: "Бросить монету", be: "Кінуць манету" },
  "Nothing requested yet.": { ru: "Запросов пока не было.", be: "Запытаў пакуль не было." },
  "Request notation, e.g. {ex}:": { ru: "Нотация запроса, напр. {ex}:", be: "Натацыя запыту, напр. {ex}:" },
  "figure id + point(s)": { ru: "номер фигуры + точка(и)", be: "нумар фігуры + кропка(ы)" },
  "Response:": { ru: "Ответ:", be: "Адказ:" },
  "LOG": { ru: "ЖУРНАЛ", be: "ЖУРНАЛ" },
  "Fair-play requests (TO_DO 44c): IN = received from the opponent, OUT = sent by you — approved/declined per the game protocol":
    { ru: "Fair-play-запросы (TO_DO 44c): IN = полученные от соперника, OUT = отправленные вами — одобрено/отклонено по протоколу игры", be: "Fair-play-запыты (TO_DO 44c): IN = атрыманыя ад саперніка, OUT = адпраўленыя вамі — ухвалена/адмоўлена па пратаколе гульні" },
  "FAIR PLAY — IN {a}✓/{b}✗ · OUT {c}✓/{d}✗": { ru: "FAIR PLAY — IN {a}✓/{b}✗ · OUT {c}✓/{d}✗", be: "FAIR PLAY — IN {a}✓/{b}✗ · OUT {c}✓/{d}✗" },
  "Export (PDF)": { ru: "Экспорт (PDF)", be: "Экспарт (PDF)" },
  "show engine internals": { ru: "показать внутренности движка", be: "паказаць нутрасьць рухавіка" },
  "hide engine internals": { ru: "скрыть внутренности движка", be: "схаваць нутрасьць рухавіка" },
  "New game": { ru: "Новая партия", be: "Новая партыя" },
  "YOUR CONTAINER — {rows} rows, {n} closed": { ru: "ВАШ КОНТЕЙНЕР — {rows} рядов, {n} закрыто", be: "ВАШ КАНТЭЙНЕР — {rows} радкоў, {n} зачынена" },
  "point 1, then point 2 — point 1 is the figure's own fixed dot and sets the rotation": { ru: "точку 1, затем точку 2 — точка 1 — собственная фиксированная точка фигуры, она задаёт поворот", be: "кропку 1, потым кропку 2 — кропка 1 — уласная фіксаваная кропка фігуры, яна задае паварот" },
  "a point": { ru: "точку", be: "кропку" },
  "Click {what} below to fill the request field ({click}/{need})": { ru: "Нажмите {what} ниже, чтобы заполнить поле запроса ({click}/{need})", be: "Націсніце {what} ніжэй, каб запоўніць поле запыту ({click}/{need})" },
  "clear": { ru: "очистить", be: "ачысціць" },
  "Win ten times first, successfully pass the exam, and advance to the Lodar 15X10 level":
    { ru: "Сначала выиграйте десять раз, успешно сдайте экзамен и переходите на уровень Lodar 15×10", be: "Спачатку выйграйце дзесяць разоў, паспяхова складзеце экзамен і пераходзіце на ўзровень Lodar 15×10" },
  "OPPONENT CONTAINER — {n} closed · {diff}": { ru: "КОНТЕЙНЕР СОПЕРНИКА — {n} закрыто · {diff}", be: "КАНТЭЙНЕР САПЕРНІКА — {n} зачынена · {diff}" },
  "PICKED BY OPPONENT — view only, your 27": { ru: "ВЫБРАНО СОПЕРНИКОМ — только просмотр, ваши 27", be: "ВЫБРАНА САПЕРНІКАМ — толькі прагляд, вашы 27" },
  "(already placed in your container)": { ru: "(уже установлена в вашем контейнере)", be: "(ужо ўсталявана ў вашым кантэйнеры)" },
  "(still available for the opponent to assign you)": { ru: "(ещё может быть назначена вам соперником)", be: "(яшчэ можа быць прызначана вам сапернікам)" },
  "PICKED BY YOU — your own 27": { ru: "ВЫБИРАЕТЕ ВЫ — ваш собственный 27", be: "ВЫБІРАЕЦЕ ВЫ — ваш уласны 27" },
  " — click one to choose": { ru: " — нажмите фигуру, чтобы выбрать", be: " — націсніце фігуру, каб выбраць" },
  "(already requested for the opponent)": { ru: "(уже запрошена для соперника)", be: "(ужо запытана для саперніка)" },
  "(repeat-request blocked)": { ru: "(повторный запрос запрещён)", be: "(паўторны запыт забаронены)" },
  "(not your turn to request)": { ru: "(сейчас не ваш ход запрашивать)", be: "(зараз не ваш ход запытваць)" },
  "Flip the coin to decide who requests first.": { ru: "Бросьте монету, чтобы решить, кто запрашивает первым.", be: "Кіньце манету, каб вырашыць, хто запытвае першым." },
  "Flipping…": { ru: "Бросаем…", be: "Кідаем…" },
  "Coin: you enter first — the opponent requests your first figure.": { ru: "Монета: вы заходите первым — соперник запрашивает вашу первую фигуру.", be: "Манета: вы заходзіце першым — сапернік запытвае вашу першую фігуру." },
  "Coin: opponent enters first — pick a figure to request for them.": { ru: "Монета: соперник заходит первым — выберите фигуру, которую запросите для него.", be: "Манета: сапернік заходзіць першым — выберыце фігуру, якую запытаеце для яго." },
  "Waiting for the opponent to request a figure from you…": { ru: "Ждём, пока соперник запросит фигуру у вас…", be: "Чакаем, пакуль сапернік запытае фігуру ў вас…" },
  "Placed. Choose a figure to request for the opponent.": { ru: "Установлено. Выберите фигуру, которую запросите для соперника.", be: "Усталявана. Выберыце фігуру, якую запытаеце для саперніка." },
  "You win — the opponent has no legal placement for that figure.": { ru: "Вы победили — у соперника нет легальной установки для этой фигуры.", be: "Вы перамаглі — у саперніка няма легальнай ўстаноўкі для гэтай фігуры." },
  "Opponent wins — 5 rows/columns closed.": { ru: "Победил соперник — закрыто 5 рядов/столбцов.", be: "Перамог сапернік — зачынена 5 радкоў/калонак." },
  "Opponent wins — you have no legal placement for the requested figure.": { ru: "Победил соперник — у вас нет легальной установки для запрошенной фигуры.", be: "Перамог сапернік — у вас няма легальнай ўстаноўкі для запытанай фігуры." },
  "Opponent wins — you have no figure left that you are allowed to request.": { ru: "Победил соперник — у вас не осталось фигур, которые вы вправе запросить.", be: "Перамог сапернік — у вас не засталося фігур, якія вы маеце права запытаць." },
  "You lose — this load sealed your way back to the container exit (rule: the loader must be able to return to A0).":
    { ru: "Вы проиграли — эта загрузка замуровала вам путь назад к выходу из контейнера (правило: грузчик должен иметь возможность вернуться к A0).", be: "Вы прайгралі — гэтая загрузка замуравала вам шлях назад да выхаду з кантэйнера (правіла: грузчык павінен мець магчымасць вярнуцца да A0)." },
  "You win — 5 rows/columns closed.": { ru: "Вы победили — закрыто 5 рядов/столбцов.", be: "Вы перамаглі — зачынена 5 радкоў/калонак." },
  "Draw — all 27 figures placed, equal rows/columns closed.": { ru: "Ничья — все 27 фигур установлены, рядов/столбцов закрыто поровну.", be: "Нічыя — усе 27 фігур усталяваны, радкоў/калонак зачынена пароўну." },
  "You win — more rows/columns closed when cargo ran out.": { ru: "Вы победили — к концу груза закрыто больше рядов/столбцов.", be: "Вы перамаглі — да канца грузу зачынена больш радкоў/калонак." },
  "Opponent wins — more rows/columns closed when cargo ran out.": { ru: "Победил соперник — к концу груза закрыто больше рядов/столбцов.", be: "Перамог сапернік — да канца грузу зачынена больш радкоў/калонак." },
  "no legal placement": { ru: "нет легальной установки", be: "няма легальнай ўстаноўкі" },
  "no figure left to request": { ru: "не осталось фигур для запроса", be: "не засталося фігур для запыту" },
  "You request {fig} for the opponent.": { ru: "Вы запрашиваете {fig} для соперника.", be: "Вы запытваеце {fig} для саперніка." },
  "Opponent requests {fig} from you.": { ru: "Соперник запрашивает {fig} у вас.", be: "Сапернік запытвае {fig} у вас." },
  "Opponent: {msg}": { ru: "Соперник: {msg}", be: "Сапернік: {msg}" },
  "Game started — {date} {time}": { ru: "Партия начата — {date} {time}", be: "Партыя пачата — {date} {time}" },
  "Coin flip: you go first.": { ru: "Монета: вы заходите первым.", be: "Манета: вы заходзіце першым." },
  "Coin flip: opponent goes first.": { ru: "Монета: соперник заходит первым.", be: "Манета: сапернік заходзіць першым." },
  "Game ended — {date} {time} — Final score {y}:{o} — {msg}": { ru: "Партия окончена — {date} {time} — Финальный счёт {y}:{o} — {msg}", be: "Партыя скончана — {date} {time} — Фінальны лік {y}:{o} — {msg}" },
  "Fair-play check ({pct}% unsupported): opponent says \"{msg}\"": { ru: "Fair-play-проверка ({pct}% свеса): соперник отвечает: «{msg}»", be: "Fair-play-праверка ({pct}% звесу): сапернік адказвае: «{msg}»" },
  "opponent agreed via fair play. Submit again to confirm.": { ru: "соперник согласился через fair play. Отправьте ещё раз для подтверждения.", be: "сапернік згодзіўся праз fair play. Адпраўце яшчэ раз для пацверджання." },
  "opponent declined fair play. Choose a different placement.": { ru: "соперник отклонил fair play. Выберите другую установку.", be: "сапернік адхіліў fair play. Выберыце іншую ўстаноўку." },
  "{player} — {date} {time} — spent {dur} — placed {fig} at {notation}{closed} — Score {y}:{o}":
    { ru: "{player} — {date} {time} — потрачено {dur} — установлена {fig} на {notation}{closed} — Счёт {y}:{o}", be: "{player} — {date} {time} — патрачана {dur} — усталявана {fig} на {notation}{closed} — Лік {y}:{o}" },
  " — {closed}": { ru: " — {closed}", be: " — {closed}" },
  "Row {letter} closed": { ru: "Ряд {letter} закрыт", be: "Радок {letter} зачынены" },
  "Column {n} closed": { ru: "Столбец {n} закрыт", be: "Калонка {n} зачынена" },
  "notation is for figure {id}, but {label} was requested": { ru: "нотация для фигуры {id}, а запрошена {label}", be: "натацыя для фігуры {id}, а запытана {label}" },
  "Opponent": { ru: "Соперник", be: "Сапернік" },
  "SCORE": { ru: "СЧЁТ", be: "ЛІК" },
  "View only": { ru: "Только просмотр", be: "Толькі прагляд" },
}

/** Closed set of engine/opponent phrases (opponentEngine.ts) and dynamic rules.ts
 *  errors, translated AT DISPLAY TIME — engine files are regression-gated (TO_DO 45). */
const ENGINE_TEXT: Record<string, { ru: string; be: string }> = {
  "Requesting {fig}.": { ru: "Запрашиваю {fig}.", be: "Запытваю {fig}." },
  "Send over {fig} next.": { ru: "Передайте мне следующим {fig}.", be: "Перадайце мне наступным {fig}." },
  "Load {fig}.": { ru: "Грузите {fig}.", be: "Грузіце {fig}." },
  "Agreed — leave it as is.": { ru: "Согласен — оставляем как есть.", be: "Згодны — пакідаем як ёсць." },
  "Fine by me, that's fair play.": { ru: "Меня устраивает — это честная игра.", be: "Мяне ўладжвае — гэта fair play." },
  "No — replace it under the 50% rule.": { ru: "Нет — поставьте в другом месте по правилу 50%.", be: "Не — паставьце ў іншым месцы па правіле 50%." },
  "I've got nowhere to put that. Your point.": { ru: "Мне некуда это поставить. Ваш ход.", be: "Мне няма куды гэта паставіць. Ваш ход." },
  "Placed.": { ru: "Установлено.", be: "Усталявана." },
  "Expected format [2-digit figure id][point][point?], e.g. 07B9C10":
    { ru: "Ожидается формат [двузначный номер фигуры][точка][точка?], напр. 07B9C10", be: "Чакаецца фармат [двухзначны нумар фігуры][кропка][кропка?], напр. 07B9C10" },
}

/** Dynamic engine strings: regex captures re-inserted as t() params. */
const ENGINE_PATTERNS: { re: RegExp; key: string; params: string[] }[] = [
  { re: /^Point (.+) is outside the (\d+)-row container$/, key: "Point {point} is outside the {rows}-row container", params: ["point", "rows"] },
]

/**
 * Translates a closed-set engine message at display time (EN fallback = message itself).
 * Preconditions: msg comes from opponentEngine phrases or rules.ts errors (see above).
 * Postconditions: never throws; unknown messages pass through untranslated.
 */
export function translateEngineText(lang: Lang, msg: string): string {
  for (const p of ENGINE_PATTERNS) {
    const m = msg.match(p.re)
    if (m) {
      const params: Record<string, string> = {}
      p.params.forEach((name, idx) => { params[name] = m[idx + 1] })
      const out = translate(lang, p.key, params)
      if (out !== p.key) return out
    }
  }
  const direct = ENGINE_TEXT[msg]
  if (direct) return lang === "EN" ? msg : (direct[lang === "RU" ? "ru" : "be"] ?? msg)
  return msg
}

/** Language gate modal (geo-detection question). All texts render in the SUGGESTED language. */
const GATE: Dict = {
  "Language": { ru: "Язык", be: "Мова" },
  "Detected region: international. Switch viewing language to English?":
    { ru: "Определён регион: международный. Переключить язык просмотра на English?", be: "Вызначаны рэгіён: міжнародны. Пераключыць мову прагляду на English?" },
  "Detected region: Russia. Switch viewing language to Russian?":
    { ru: "Определён регион: Россия. Переключить язык просмотра на Русский?", be: "Вызначаны рэгіён: Расія. Пераключыць мову прагляду на Рускую?" },
  "Detected region: Belarus. Switch viewing language to Belarusian?":
    { ru: "Определён регион: Беларусь. Переключить язык просмотра на Беларускую?", be: "Вызначаны рэгіён: Беларусь. Пераключыць мову прагляду на Беларускую?" },
  "Yes, switch": { ru: "Да, переключить", be: "Так, пераключыць" },
  "Keep current language": { ru: "Оставить текущий язык", be: "Пакінуць бягучую мову" },
}

/** Merged dictionary: EN key → { ru, be }. */
const ALL: Dict = {
  ...COMMON, ...HOME, ...FIGURES, ...RULES, ...LORE, ...PLAY, ...SANDBOX,
  ...GATED, ...AUTH, ...PROFILE, ...ADMIN, ...PRINTPLAY, ...DEVTEST, ...GATE,
}

/** Lookup per language; EN is empty (translate falls back to the key itself). */
export const DICT: Record<Lang, Record<string, string>> = {
  EN: {},
  RU: Object.fromEntries(Object.entries(ALL).map(([k, v]) => [k, v.ru])),
  BY: Object.fromEntries(Object.entries(ALL).map(([k, v]) => [k, v.be])),
}

/**
 * Translates an English source key into `lang`, interpolating `{name}` params.
 * Preconditions: key is the exact EN string used in App.tsx.
 * Postconditions: returns a non-empty string; unknown key/params degrade to EN.
 */
export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const text = DICT[lang][key] ?? key
  if (!params) return text
  return Object.entries(params).reduce(
    (acc, [p, v]) => acc.split(`{${p}}`).join(String(v)),
    text,
  )
}

/**
 * Reads the stored viewing language from localStorage.
 * Postconditions: always returns a valid Lang; absent/invalid/corrupted → DEFAULT_LANG.
 */
export function loadStoredLang(): Lang {
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY)
    const stored = v === "BE" ? "BY" : v // migration: pre-rename code
    return stored != null && stored in LANGS ? (stored as Lang) : DEFAULT_LANG
  } catch {
    return DEFAULT_LANG
  }
}

/** Persists the chosen viewing language; failures (private mode) keep a session-only choice. */
export function saveStoredLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // ignore: session-only choice
  }
}

/** True when the geo language question was already answered in this browser. */
export function geoPromptAnswered(): boolean {
  try {
    return window.localStorage.getItem(GEO_PROMPT_STORAGE_KEY) != null
  } catch {
    return true // cannot persist → do not nag repeatedly
  }
}

/** Marks the geo language question as answered. */
export function markGeoPromptAnswered(): void {
  try {
    window.localStorage.setItem(GEO_PROMPT_STORAGE_KEY, "done")
  } catch {
    // ignore
  }
}

/**
 * Fetches the visitor's country code by IP.
 * Preconditions: none; may run offline.
 * Postconditions: resolves an uppercase ISO-3166 alpha-2 code or null; NEVER rejects.
 */
export async function detectCountryCode(): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), GEO_TIMEOUT_MS)
    const res = await fetch(GEO_URL, { signal: ctrl.signal })
    window.clearTimeout(timer)
    if (!res.ok) return null
    const json = (await res.json()) as { country_code?: string; countryCode?: string }
    const code = json.country_code ?? json.countryCode ?? null
    return code != null ? code.toUpperCase() : null
  } catch {
    return null
  }
}

/**
 * Maps a country code to the suggested viewing language.
 * Postconditions: unknown/null → "EN" (never throws).
 */
export function langForCountry(code: string | null): Lang {
  if (code == null) return "EN"
  return COUNTRY_TO_LANG[code.toUpperCase()] ?? "EN"
}

/** BCP-47 tag for `<html lang>` (Belarusian is "be" per ISO 639-1, not the "BY" country code). */
export function htmlLangTag(lang: Lang): string {
  return lang === "BY" ? "be" : lang.toLowerCase()
}
