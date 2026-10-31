/**
 * Hjälpfunktioner för e-posthantering i frontend.
 */

/**
 * Rensar citerad mejlhistorik (svenska/engelska format, Gmail, Outlook, Apple Mail etc.).
 * Bevarar all ny text och dess radbrytningar.
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
