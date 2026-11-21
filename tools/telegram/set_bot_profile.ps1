# PuzzleStow — настройка визуального профиля @puzzlestow_bot (Bot API 10.4)
# Что делает: setMyName + setMyShortDescription (ru/be/en) + setMyDescription (ru/be/en)
#             + setChatMenuButton (type=commands).
# Что НЕ делает: фото профиля — только BotFather /setuserpic (загрузить аватар A 1024x1024).
#
# 1) Вставь токен от BotFather в переменную ниже (токен не отправлять в чат).
# 2) Запуск:  pwsh -File set_bot_profile.ps1   или из текущего окна:  .\set_bot_profile.ps1
# 3) Проверка: открой чат с @puzzlestow_bot, удали диалог и открой заново.

$ErrorActionPreference = 'Stop'
$token = '8539231825:AAH-qp8eMK18ZZv4FZN3FqwghUX69BRdis8'
if ($token -eq 'jhk') { Write-Error 'Вставь токен в переменную $token' }

$base = "https://api.telegram.org/bot$token"
function Invoke-Post([string]$method, [hashtable]$fields) {
  $r = Invoke-RestMethod -Method Post -Uri "$base/$method" -Body $fields -ContentType 'application/x-www-form-urlencoded; charset=utf-8'
  if (-not $r.ok) { Write-Error "$method -> $($r | ConvertTo-Json -Compress)" }
  Write-Host "OK  $method"
}

# --- Имя (одно для всех языков; узнаваемость бренда) ---
Invoke-Post 'setMyName' @{ name = 'PuzzleStow' }

# --- About в профиле (короткое описание) ---
Invoke-Post 'setMyShortDescription' @{ language_code = 'ru'; short_description = 'Соперник по «Отгрузке» — детерминированный грузчик-движок. Честные правила, спокойный тон.' }
Invoke-Post 'setMyShortDescription' @{ language_code = 'be'; short_description = 'Сапернік па «Адгрузцы» — дэтэрмінаваны грузчык-рухавік. Чэсныя правілы, спакойны тон.' }
Invoke-Post 'setMyShortDescription' @{ language_code = 'en'; short_description = 'Your stowage opponent - a deterministic engine. Honest rules, calm tone.' }

# --- Описание в пустом чате («Что умеет этот бот?») ---
Invoke-Post 'setMyDescription' @{ language_code = 'ru'; description = 'Называет фигуру — ты кладёшь, потом очередь твоя. Без ИИ, без рейтинга, правила честные.' }
Invoke-Post 'setMyDescription' @{ language_code = 'be'; description = 'Называе фігуру — ты кладзеш, потым чарга твая. Без ІІ, без рэйтынгу, правілы чэсныя.' }
Invoke-Post 'setMyDescription' @{ language_code = 'en'; description = 'I name a piece, you place it, then your turn. No AI, no rating, fair rules.' }

# --- Кнопка меню слева от поля ввода: список команд (там видно /cargo) ---
# Текстовую кнопку «📦 Груз» Telegram в меню не даёт — подписанная кнопка
# появится как постоянная reply-клавиатура, когда бот начнёт партию (рантайм).
Invoke-Post 'setChatMenuButton' @{ menu_button = '{"type":"commands"}' }

Write-Host 'Готово. Проверка: getMe и новый чат с ботом.'
