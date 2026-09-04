#!/bin/bash
# cache-expiry-check.sh — Prompt cache expiry warning hook
#
# Registered as UserPromptSubmit hook (hooks.json). Runs before every user message.
# Detects that the 1-hour prompt cache has likely expired and either warns or blocks,
# so the user can /clear → /s-continue instead of paying full re-cache cost.
#
# Mode: CC_TOKEN_SAVER_CACHE_GUARD = off (default) | warn | block
#   off   — never check. Default because of Remote Control: a hook "block" is
#           rendered locally and never reaches the remote client, so the guard behaved
#           differently depending on where the user sat. Re-enable the default once
#           Remote Control forwards hook messages.
#   warn  — let the prompt through, but attach additionalContext so Claude opens its
#           reply with one line saying the cache had expired and this turn paid for
#           the full context. Works under Remote Control, where a hook "block" is
#           rendered as a local system/informational message the remote client never
#           receives (bridge/bridgeMessaging.ts isEligibleBridgeMessage); Claude's
#           reply IS forwarded.
#   block — refuse the prompt once with a localized warning; re-sending the same
#           prompt goes through. Saves the $9 re-send, but only a local terminal sees
#           why the prompt was refused.
#
# How it works:
#   0. Machine-injected prompts (task notifications etc.) are exempt — see below
#   1. Reads last assistant timestamp from transcript tail
#   2. If elapsed ≥ 3590s (3600s TTL - 10s buffer): warn or block per mode
#   3. block mode one-time gate: first block sets flag, re-sending the same message approves
#   4. If elapsed < 3590s: approve silently
#
# Input:  JSON via stdin (CC UserPromptSubmitInput)
#   Fields used: transcript_path, session_id, prompt
#
# Output: JSON to stdout
#   { "decision": "approve" }  — allow message through
#   { "decision": "approve", "hookSpecificOutput": { "hookEventName": "UserPromptSubmit",
#     "additionalContext": "..." } }  — warn mode: allow, Claude announces the expiry
#   { "decision": "block", "reason": "..." }  — block mode: refuse with localized warning
#
# Gate flag (block mode): $TMPDIR/claude-cache-warn-{SESSION_ID}
#   Created on first block, removed on second attempt (bypass)
#
# i18n: 23 languages detected from OS $LANG locale
#   en ko ja zh es fr de pt it ru ar hi bn id ms th vi tr pl nl he sv no
#
# Why 3590s, not 3600s:
#   CC's ephemeral_1h cache tier has a 3600s TTL. The 10s buffer accounts for
#   network latency and timestamp drift between client and server.

INPUT=$(cat)
# Extract JSON fields without jq — input is a single-line flat JSON object
TRANSCRIPT=$(echo "$INPUT" | sed -n 's/.*"transcript_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
SESSION_ID=$(echo "$INPUT" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

# --- Machine-injected prompt exemption -------------------------------------
# UserPromptSubmit also fires for prompts CC itself enqueues — most importantly
# <task-notification>, the completion report of a background agent/task
# (LocalAgentTask.tsx → enqueuePendingNotification → executeQueuedInput →
# handlePromptSubmit → processUserInput → executeUserPromptSubmitHooks).
#
# Blocking those is wrong twice over:
#   1. No human is at the keyboard, so the warning has no reader — and the
#      one-time gate never gets its second attempt.
#   2. The notification is consumed off the queue when blocked, so the
#      subagent's report is LOST. Long-running agents (>1h) hit this every time.
#
# Rather than enumerating tags (task-notification, tick, local-command-stdout,
# … — the list grows with each CC release), use the shape: CC injects XML,
# humans type prose. A prompt starting with an XML-ish tag ('<' + a letter) is
# machine-injected, so notification types added by future CC releases are exempt
# automatically without touching this hook. Failure direction is safe: a false
# exemption merely skips a cost warning, while a false block destroys work.
PROMPT_HEAD=$(echo "$INPUT" | sed -n 's/.*"prompt"[[:space:]]*:[[:space:]]*"\(.\{0,32\}\).*/\1/p')
PROMPT_HEAD="${PROMPT_HEAD#\\n}"
PROMPT_HEAD="${PROMPT_HEAD#\\r}"
PROMPT_HEAD="${PROMPT_HEAD#\\t}"
while [ "${PROMPT_HEAD# }" != "$PROMPT_HEAD" ]; do PROMPT_HEAD="${PROMPT_HEAD# }"; done

case "$PROMPT_HEAD" in
  '<'[a-zA-Z]*)
    echo '{"decision":"approve"}'
    exit 0
    ;;
esac
# Belt and suspenders: if the prompt field could not be parsed above, still let
# task notifications through on a raw substring match.
case "$INPUT" in
  *'<task-notification>'*)
    echo '{"decision":"approve"}'
    exit 0
    ;;
esac
# ---------------------------------------------------------------------------

WARN_FLAG="${TMPDIR:-${TEMP:-${TMP:-/tmp}}}/claude-cache-warn-${SESSION_ID}"

# Detect language from OS locale
LOCALE_LANG="${LANG%%_*}"
LOCALE_LANG="${LOCALE_LANG%%.*}"

get_expired_msg() {
  local m="$1" s="$2"
  case "$LOCALE_LANG" in
    ko) echo "🚨 캐시 만료 (${m}분 ${s}초 경과)\n\n프롬프트 캐시가 만료되어 이대로 실행하면 전체 컨텍스트를 다시 전송합니다.\n비용이 크게 증가할 수 있습니다.\n\n👉 /context — 현재 컨텍스트 사용량 확인 후 판단\n👉 /clear → /s-continue — 초기화 후 이전 컨텍스트 복원 (권장, 최저비용)\n👉 그냥 다시 보내기 — 현재 상태로 계속 진행 (전체 재캐시 비용 발생)" ;;
    ja) echo "🚨 キャッシュ期限切れ (${m}分${s}秒経過)\n\nプロンプトキャッシュが切れました。このまま実行すると全コンテキストを再送信します。\nコストが大幅に増加する可能性があります。\n\n👉 /context — 現在のコンテキスト使用量を確認してから判断\n👉 /clear → /s-continue — リセット後、以前のコンテキストを復元（推奨、最安）\n👉 再送信 — そのまま続行（全再キャッシュコスト発生）" ;;
    zh) echo "🚨 缓存已过期 (已空闲${m}分${s}秒)\n\n提示缓存已过期，继续将重新发送全部上下文。\n费用可能大幅增加。\n\n👉 /context — 查看当前上下文使用量后再决定\n👉 /clear → /s-continue — 重置后恢复之前的上下文（推荐，费用最低）\n👉 直接重新发送 — 继续当前状态（全量重新缓存费用产生）" ;;
    es) echo "🚨 Caché expirada (${m}m ${s}s inactivo)\n\nLa caché ha expirado. Continuar reenviará todo el contexto.\nEl costo puede aumentar significativamente.\n\n👉 /context — Verificar el uso actual del contexto antes de decidir\n👉 /clear → /s-continue — Reiniciar y restaurar contexto previo (recomendado, menor costo)\n👉 Reenviar — Continuar tal cual (costo total de re-caché incurrido)" ;;
    fr) echo "🚨 Cache expiré (${m}m ${s}s d'inactivité)\n\nLe cache a expiré. Continuer renverra tout le contexte.\nLe coût peut augmenter considérablement.\n\n👉 /context — Vérifier l'utilisation actuelle du contexte avant de décider\n👉 /clear → /s-continue — Réinitialiser puis restaurer le contexte précédent (recommandé, coût minimal)\n👉 Renvoyer — Continuer tel quel (coût total de re-cache engendré)" ;;
    de) echo "🚨 Cache abgelaufen (${m}m ${s}s inaktiv)\n\nDer Cache ist abgelaufen. Fortfahren sendet den gesamten Kontext erneut.\nDie Kosten können erheblich steigen.\n\n👉 /context — Aktuelle Kontextnutzung prüfen, bevor Sie entscheiden\n👉 /clear → /s-continue — Zurücksetzen, dann vorherigen Kontext wiederherstellen (empfohlen, günstigste Option)\n👉 Erneut senden — Fortfahren wie gehabt (volle Re-Cache-Kosten anfallend)" ;;
    pt) echo "🚨 Cache expirado (${m}m ${s}s inativo)\n\nO cache expirou. Continuar reenviará todo o contexto.\nO custo pode aumentar significativamente.\n\n👉 /context — Verificar o uso atual do contexto antes de decidir\n👉 /clear → /s-continue — Reiniciar e restaurar contexto anterior (recomendado, menor custo)\n👉 Reenviar — Continuar como está (custo total de re-cache incorrido)" ;;
    it) echo "🚨 Cache scaduta (${m}m ${s}s inattivo)\n\nLa cache è scaduta. Continuare reinvierà tutto il contesto.\nIl costo potrebbe aumentare notevolmente.\n\n👉 /context — Controlla l'utilizzo attuale del contesto prima di decidere\n👉 /clear → /s-continue — Reimposta e ripristina il contesto precedente (consigliato, costo minimo)\n👉 Reinvia — Continua così com'è (costo totale di re-cache sostenuto)" ;;
    ru) echo "🚨 Кэш истёк (${m}м ${s}с простоя)\n\nКэш истёк. Продолжение отправит весь контекст заново.\nСтоимость может значительно возрасти.\n\n👉 /context — Проверить текущее использование контекста перед принятием решения\n👉 /clear → /s-continue — Сбросить и восстановить предыдущий контекст (рекомендуется, минимальная стоимость)\n👉 Отправить снова — Продолжить как есть (возникнет полная стоимость повторного кэширования)" ;;
    ar) echo "🚨 انتهت صلاحية الذاكرة المؤقتة (${m}د ${s}ث خمول)\n\nانتهت صلاحية الذاكرة المؤقتة. المتابعة ستعيد إرسال كل السياق.\nقد تزداد التكلفة بشكل كبير.\n\n👉 /context — تحقق من استخدام السياق الحالي قبل اتخاذ القرار\n👉 /clear → /s-continue — إعادة التعيين ثم استعادة السياق السابق (موصى به، أقل تكلفة)\n👉 إعادة الإرسال — المتابعة كما هو (تكلفة إعادة التخزين المؤقت الكاملة تُتكبّد)" ;;
    hi) echo "🚨 कैश समाप्त (${m}मि ${s}से निष्क्रिय)\n\nकैश समाप्त हो गया है। जारी रखने पर पूरा संदर्भ दोबारा भेजा जाएगा।\nलागत काफी बढ़ सकती है।\n\n👉 /context — निर्णय लेने से पहले वर्तमान संदर्भ उपयोग जांचें\n👉 /clear → /s-continue — रीसेट करें, फिर पिछला संदर्भ पुनर्स्थापित करें (अनुशंसित, सबसे सस्ता)\n👉 दोबारा भेजें — जारी रखें जैसा है (पूर्ण री-कैश लागत लगेगी)" ;;
    bn) echo "🚨 ক্যাশ মেয়াদোত্তীর্ণ (${m}মি ${s}সে নিষ্ক্রিয়)\n\nক্যাশ মেয়াদোত্তীর্ণ হয়েছে। চালিয়ে যেতে পুরো প্রসঙ্গ পুনরায় পাঠাতে হবে।\n\n👉 /context — সিদ্ধান্ত নেওয়ার আগে বর্তমান প্রসঙ্গ ব্যবহার পরীক্ষা করুন\n👉 /clear → /s-continue — রিসেট করে পূর্ববর্তী প্রসঙ্গ পুনরুদ্ধার করুন (প্রস্তাবিত, সর্বনিম্ন খরচ)\n👉 পুনরায় পাঠান — যেমন আছে চালিয়ে যান (সম্পূর্ণ রি-ক্যাশ খরচ হবে)" ;;
    id) echo "🚨 Cache kedaluwarsa (${m}m ${s}d tidak aktif)\n\nCache telah kedaluwarsa. Melanjutkan akan mengirim ulang seluruh konteks.\nBiaya dapat meningkat secara signifikan.\n\n👉 /context — Periksa penggunaan konteks saat ini sebelum memutuskan\n👉 /clear → /s-continue — Reset lalu pulihkan konteks sebelumnya (disarankan, biaya terendah)\n👉 Kirim ulang — Lanjutkan apa adanya (biaya re-cache penuh timbul)" ;;
    ms) echo "🚨 Cache tamat tempoh (${m}m ${s}s tidak aktif)\n\nCache telah tamat. Meneruskan akan menghantar semula semua konteks.\nKos mungkin meningkat dengan ketara.\n\n👉 /context — Semak penggunaan konteks semasa sebelum membuat keputusan\n👉 /clear → /s-continue — Tetapkan semula lalu pulihkan konteks sebelumnya (disyorkan, kos terendah)\n👉 Hantar semula — Teruskan seperti sedia ada (kos re-cache penuh ditanggung)" ;;
    th) echo "🚨 แคชหมดอายุ (ไม่ใช้งาน ${m}น. ${s}วิ.)\n\nแคชหมดอายุแล้ว ดำเนินการต่อจะส่งบริบททั้งหมดใหม่\nค่าใช้จ่ายอาจเพิ่มขึ้นอย่างมาก\n\n👉 /context — ตรวจสอบการใช้งานบริบทปัจจุบันก่อนตัดสินใจ\n👉 /clear → /s-continue — รีเซ็ตแล้วกู้คืนบริบทก่อนหน้า (แนะนำ, ประหยัดที่สุด)\n👉 ส่งอีกครั้ง — ดำเนินการต่อตามเดิม (เกิดค่าใช้จ่ายรีแคชเต็ม)" ;;
    vi) echo "🚨 Bộ nhớ đệm hết hạn (không hoạt động ${m}p ${s}g)\n\nBộ nhớ đệm đã hết hạn. Tiếp tục sẽ gửi lại toàn bộ ngữ cảnh.\nChi phí có thể tăng đáng kể.\n\n👉 /context — Kiểm tra mức sử dụng ngữ cảnh hiện tại trước khi quyết định\n👉 /clear → /s-continue — Đặt lại rồi khôi phục ngữ cảnh trước đó (khuyến nghị, tiết kiệm nhất)\n👉 Gửi lại — Tiếp tục như hiện tại (chi phí re-cache đầy đủ phát sinh)" ;;
    tr) echo "🚨 Önbellek süresi doldu (${m}dk ${s}sn boşta)\n\nÖnbellek süresi doldu. Devam etmek tüm bağlamı yeniden gönderecektir.\nMaliyet önemli ölçüde artabilir.\n\n👉 /context — Karar vermeden önce mevcut bağlam kullanımını kontrol edin\n👉 /clear → /s-continue — Sıfırla, ardından önceki bağlamı geri yükle (önerilen, en düşük maliyet)\n👉 Tekrar gönder — Olduğu gibi devam et (tam re-cache maliyeti oluşur)" ;;
    pl) echo "🚨 Pamięć podręczna wygasła (${m}m ${s}s bezczynności)\n\nPamięć podręczna wygasła. Kontynuowanie wyśle ponownie cały kontekst.\nKoszt może znacząco wzrosnąć.\n\n👉 /context — Sprawdź bieżące użycie kontekstu przed podjęciem decyzji\n👉 /clear → /s-continue — Zresetuj, potem przywróć poprzedni kontekst (zalecane, najniższy koszt)\n👉 Wyślij ponownie — Kontynuuj jak jest (pełny koszt ponownego cache zostanie naliczony)" ;;
    nl) echo "🚨 Cache verlopen (${m}m ${s}s inactief)\n\nDe cache is verlopen. Doorgaan verstuurt de volledige context opnieuw.\nDe kosten kunnen aanzienlijk stijgen.\n\n👉 /context — Controleer het huidige contextgebruik voordat u beslist\n👉 /clear → /s-continue — Resetten en daarna vorige context herstellen (aanbevolen, laagste kosten)\n👉 Opnieuw verzenden — Doorgaan zoals het is (volledige re-cache kosten gemaakt)" ;;
    he) echo "🚨 המטמון פג תוקף (${m} דקות ${s} שניות ללא פעילות)\n\nמטמון ההנחיה פג תוקף. המשך ישלח מחדש את כל ההקשר.\nהעלות עלולה לעלות משמעותית.\n\n👉 /context — בדוק את השימוש הנוכחי בהקשר לפני קבלת החלטה\n👉 /clear → /s-continue — איפוס ואז שחזור ההקשר הקודם (מומלץ, עלות מינימלית)\n👉 שליחה מחדש — המשך כפי שזה (עלות מלאה של מטמון מחדש תיגרם)" ;;
    sv) echo "🚨 Cache har gått ut (${m}m ${s}s inaktiv)\n\nPrompt-cachen har gått ut. Att fortsätta skickar om hela kontexten.\nKostnaden kan öka avsevärt.\n\n👉 /context — Kontrollera aktuell kontextanvändning innan du bestämmer dig\n👉 /clear → /s-continue — Återställ, sedan återställ tidigare kontext (rekommenderat, lägst kostnad)\n👉 Skicka igen — Fortsätt som det är (full re-cache-kostnad uppstår)" ;;
    no) echo "🚨 Cache utløpt (${m}m ${s}s inaktiv)\n\nPrompt-cachen har utløpt. Å fortsette sender hele konteksten på nytt.\nKostnaden kan øke betydelig.\n\n👉 /context — Sjekk nåværende kontekstbruk før du bestemmer deg\n👉 /clear → /s-continue — Tilbakestill, deretter gjenopprett tidligere kontekst (anbefalt, lavest kostnad)\n👉 Send på nytt — Fortsett som det er (full re-cache-kostnad påløper)" ;;
    en) echo "🚨 Cache expired (${m}m ${s}s idle)\n\nThe prompt cache has expired. Continuing will resend the full context.\nCost may increase significantly.\n\n👉 /context — Check current context usage before deciding\n👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)\n👉 Re-send — Continue as-is (full re-cache cost incurred)" ;;
    *)  echo "🚨 Cache expired (${m}m ${s}s idle)\n\nThe prompt cache has expired. Continuing will resend the full context.\nCost may increase significantly.\n\n👉 /context — Check current context usage before deciding\n👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)\n👉 Re-send — Continue as-is (full re-cache cost incurred)" ;;
  esac
}


# Already warned once → allow through, reset flag
if [ -f "$WARN_FLAG" ]; then
  rm -f "$WARN_FLAG"
  echo '{"decision":"approve"}'
  exit 0
fi

if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  echo '{"decision":"approve"}'
  exit 0
fi

# Get last assistant message timestamp
LAST_TS=$(tail -200 "$TRANSCRIPT" 2>/dev/null \
  | grep '"type":"assistant"' \
  | sed -n 's/.*"timestamp"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
  | tail -1)

if [ -z "$LAST_TS" ]; then
  echo '{"decision":"approve"}'
  exit 0
fi

# Parse timestamp (UTC) and compute elapsed seconds
if date -j -f "%Y-%m-%dT%H:%M:%S" "2000-01-01T00:00:00" "+%s" 2>/dev/null 1>/dev/null; then
  LAST_EPOCH=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "${LAST_TS%%.*}" "+%s")
else
  LAST_EPOCH=$(TZ=UTC date -d "${LAST_TS%%.*}" "+%s" 2>/dev/null)
fi
if [ -z "$LAST_EPOCH" ]; then
  echo '{"decision":"approve"}'
  exit 0
fi

NOW_EPOCH=$(date "+%s")
ELAPSED=$(( NOW_EPOCH - LAST_EPOCH ))
MINS=$(( ELAPSED / 60 ))
SECS=$(( ELAPSED % 60 ))

# Under 3590s → cache still alive
if [ "$ELAPSED" -lt 3590 ]; then
  echo '{"decision":"approve"}'
  exit 0
fi

# 3590s+ → cache expired (3600s TTL - 10s buffer). Mode decides what happens.
MODE="${CC_TOKEN_SAVER_CACHE_GUARD:-off}"
case "$MODE" in
  block)
    MSG=$(get_expired_msg "$MINS" "$SECS")
    touch "$WARN_FLAG"
    # Escape for JSON
    MSG_JSON=$(echo "$MSG" | sed 's/"/\\"/g')
    echo "{\"decision\":\"block\",\"reason\":\"${MSG_JSON}\"}"
    ;;
  warn)
    # warn. Model-facing, so English; Claude answers in the user's language.
    CTX="[super-token-saver] The prompt cache expired: the last reply was ${MINS}m ${SECS}s ago and the cache TTL is 1 hour, so this turn paid for the whole context again. Open your reply with ONE short line in the user's language that says this the way a colleague would mention it in passing, not as a system notice. Meaning to convey: idle ${MINS} min, cache gone, this turn cost the full context; next time after an hour-plus break, /clear then /s-continue is the cheap way back. English example of the tone: 'Heads-up: ${MINS} min idle, so the cache was gone and this turn paid for the whole context. After an hour-plus break, /clear then /s-continue is cheaper.' Do not translate that literally; write it naturally. Then answer the prompt normally. Do not repeat this notice in later turns."
    echo "{\"decision\":\"approve\",\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"${CTX}\"}}"
    ;;
  *)
    # off (default) and any unknown value: never check.
    echo '{"decision":"approve"}'
    ;;
esac
