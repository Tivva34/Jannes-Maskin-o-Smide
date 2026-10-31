// Ren, beroendefri logik för e-postflödet. Delas av Edge Functions (Deno) och lokala tester (node:test).
// Inga nätverksanrop, ingen åtkomst till miljövariabler – allt injiceras.

export const DEFAULT_SENDER_NAME = "Jannes Maskin & Smide";

/**
 * Sanerar ett visningsnamn för From-headern. Tar bort kontrolltecken (inkl. CR/LF) och tecken som
 * kan tolkas som adresssyntax (" < > , ; \), normaliserar whitespace och begränsar längden.
 * Tomt/ogiltigt/ej sträng ger fallback.
 */
export function sanitizeSenderName(raw, fallback = DEFAULT_SENDER_NAME) {
  if (typeof raw !== "string") return fallback;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex -- kontrolltecken ska medvetet tas bort
    .replace(/[\u0000-\u001F\u007F"<>,;\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return cleaned || fallback;
}

/** Normaliserar Message-ID till formen <id>. Returnerar null för tomt värde. */
export function normalizeMessageId(id) {
  if (id === undefined || id === null) return null;
  const s = String(Array.isArray(id) ? id[0] : id).trim();
  if (!s || s === "none") return null;
  return s.startsWith("<") ? s : `<${s}>`;
}

/**
 * Matchar ett inkommande mejl mot ett befintligt ärende via In-Reply-To och därefter References.
 * Reservmatchning på avsändarens e-post ingår medvetet INTE.
 * lookup(messageId) => Promise<{ quoteRequestId: string|null, error?: string|null }>
 * Returnerar { quoteRequestId, matchedOriginalMessageId, error }. error ⇒ anroparen ska lämna mejlet UNSEEN.
 */
export async function resolveThread({ inReplyTo, references }, lookup) {
  if (inReplyTo) {
    const r = await lookup(inReplyTo);
    if (r.error) return { quoteRequestId: null, matchedOriginalMessageId: null, error: r.error };
    if (r.quoteRequestId) {
      return { quoteRequestId: r.quoteRequestId, matchedOriginalMessageId: inReplyTo, error: null };
    }
  }
  if (Array.isArray(references)) {
    for (const ref of references) {
      const r = await lookup(ref);
      if (r.error) return { quoteRequestId: null, matchedOriginalMessageId: null, error: r.error };
      if (r.quoteRequestId) {
        return { quoteRequestId: r.quoteRequestId, matchedOriginalMessageId: ref, error: null };
      }
    }
  }
  return { quoteRequestId: null, matchedOriginalMessageId: null, error: null };
}

/** Postgres unique_violation (t.ex. dubblett på quote_messages.email_message_id). */
export function isDuplicateError(err) {
  return !!err && err.code === "23505";
}

/**
 * Validerar att en bilagesökväg tillhör rätt ärende. Verifierade format:
 *  - admin-uppladdning (QuoteRequestsPanel.handleSendReply): `${quoteRequestId}/${fil}`
 *  - inkommande kundmejl (fetch-incoming-emails): `customer_reply/${quoteRequestId}/${uuid}-${fil}`
 */
export function isValidAttachmentPath(path, quoteRequestId) {
  if (typeof path !== "string" || typeof quoteRequestId !== "string" || !quoteRequestId) return false;
  // eslint-disable-next-line no-control-regex -- kontrolltecken ska medvetet nekas
  if (path.includes("..") || path.includes("\\") || path.startsWith("/") || /[\u0000-\u001F]/.test(path)) return false;
  const rest = path.startsWith(`customer_reply/${quoteRequestId}/`)
    ? path.slice(`customer_reply/${quoteRequestId}/`.length)
    : path.startsWith(`${quoteRequestId}/`)
      ? path.slice(`${quoteRequestId}/`.length)
      : null;
  return !!rest && !rest.includes("/");
}

/**
 * Skickar via transporter och kastar om SMTP misslyckas eller om ingen mottagare accepterades,
 * så att ett meddelande som sparats men inte skickats aldrig rapporteras som skickat.
 */
export async function sendMailChecked(transporter, mail) {
  const info = await transporter.sendMail(mail);
  if (!info || (Array.isArray(info.accepted) && info.accepted.length === 0)) {
    throw new Error("SMTP accepterade ingen mottagare.");
  }
  return info;
}

/** Mappar utfall till e-poststatus som returneras till UI. */
export function emailStatusFor({ configured, sent, testMode }) {
  if (!configured) return "not_configured";
  if (!sent) return "failed";
  return testMode ? "sent_test_mode" : "sent";
}

/**
 * Rensar bort citerad mejlhistorik från vanlig text (svenska/engelska headers, Gmail, Outlook, Apple Mail etc.).
 * Bevarar radbrytningar och all legitim text som användaren faktiskt skrivit.
 * @param {string} rawText
 * @returns {string}
 */
export function stripTextQuotes(rawText) {
  if (typeof rawText !== "string") return "";
  const text = rawText.trim();
  if (!text) return "";

  const patterns = [
    // 1. Svensk rad: "Den tis 27 okt. ... skrev ...:" eller "Den tis 27 okt. ... skrev:"
    /(?:^|\r?\n)[ \t]*Den\s+(?:mån|tis|ons|tor|fre|lör|sön|\d{1,2}|[a-zåäö]+dag)\b[^\n\r]*?(?:\r?\n[^\n\r]*?)?(?:skrev|wrote)[^\n\r]*?:[ \t]*/i,

    // 2. Engelsk rad: "On Tue, Oct 27 ... wrote ...:" eller "... wrote:"
    /(?:^|\r?\n)[ \t]*On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|\d{1,2}|[a-z]+day)\b[^\n\r]*?(?:\r?\n[^\n\r]*?)?(?:wrote|skrev)[^\n\r]*?:[ \t]*/i,

    // 3. Avsändare utan Den/On: "Namn <epost@domän> skrev:"
    /(?:^|\r?\n)[ \t]*[^\n\r<>@]{1,80}\s*<[^\s<>@]+@[^\s<>@]+>\s*(?:skrev|wrote)\s*:[ \t]*/i,

    // 4. Outlook / Exchange
    /(?:^|\r?\n)[ \t]*-{3,}\s*(?:Ursprungligt meddelande|Original Message)\s*-{3,}[ \t]*/i,
    /(?:^|\r?\n)[ \t]*(?:Från|From):\s*[^\n\r]+(?:\r?\n[ \t]*(?:Skickat|Sent|Date|Datum):\s*[^\n\r]+)(?:\r?\n[ \t]*(?:Till|To):\s*[^\n\r]+)(?:\r?\n[ \t]*(?:Ämne|Subject):\s*[^\n\r]+)/i,

    // 5. Lång avgränsningslinje
    /(?:^|\r?\n)[ \t]*_{15,}[ \t]*/,

    // 6. Avslutande block med '>' citattecken (utan header)
    /(?:^|\r?\n)(?:[ \t]*>.*(?:\r?\n|$))+$/
  ];

  let earliestIndex = -1;

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      if (earliestIndex === -1 || match.index < earliestIndex) {
        earliestIndex = match.index;
      }
    }
  }

  if (earliestIndex > 0) {
    const candidate = text.substring(0, earliestIndex).trim();
    if (candidate.length > 0) {
      return candidate;
    }
  }

  return text;
}

/**
 * Rensar citerade block från HTML (t.ex. .gmail_quote, .gmail_extra, blockquote, divRplyFwdMsg).
 * @param {string|null} html
 * @returns {string|null}
 */
export function stripHtmlQuotes(html) {
  if (typeof html !== "string" || !html) return null;
  let cleaned = html;

  cleaned = cleaned.replace(/<div[^>]*class=["'][^"']*\bgmail_quote\b[^"']*["'][^>]*>[\s\S]*$/i, "");
  cleaned = cleaned.replace(/<div[^>]*class=["'][^"']*\bgmail_extra\b[^"']*["'][^>]*>[\s\S]*$/i, "");
  cleaned = cleaned.replace(/<div[^>]*id=["'](?:divRplyFwdMsg|appendonsend)["'][^>]*>[\s\S]*$/i, "");
  cleaned = cleaned.replace(/<hr[^>]*id=["']stopSpelling["'][^>]*>[\s\S]*$/i, "");
  cleaned = cleaned.replace(/<div[^>]*style=["'][^"']*border-top:\s*solid\b[^"']*["'][^>]*>[\s\S]*$/i, "");
  cleaned = cleaned.replace(/<blockquote[^>]*type=["']cite["'][^>]*>[\s\S]*$/i, "");
  cleaned = cleaned.replace(/<blockquote[^>]*class=["'][^"']*\bgmail_quote\b[^"']*["'][^>]*>[\s\S]*$/i, "");
  cleaned = cleaned.replace(/<blockquote[^>]*>[\s\S]*<\/blockquote>\s*$/i, "");
  cleaned = cleaned.replace(/<div[^>]*class=["'][^"']*\byahoo_quoted\b[^"']*["'][^>]*>[\s\S]*$/i, "");

  return cleaned.trim() || null;
}

/**
 * Rensar citerad mejlhistorik från både text och HTML.
 * @param {string|null} text
 * @param {string|null} [html]
 * @returns {{ cleanText: string, cleanHtml: string | null }}
 */
export function stripQuotedReply(text, html = null) {
  const cleanText = stripTextQuotes(text);
  const cleanHtml = html ? stripHtmlQuotes(html) : null;
  return { cleanText, cleanHtml };
}

