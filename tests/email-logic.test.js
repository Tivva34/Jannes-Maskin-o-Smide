import './_no-network.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeSenderName, normalizeMessageId, resolveThread, isDuplicateError,
  isValidAttachmentPath, sendMailChecked, emailStatusFor, DEFAULT_SENDER_NAME,
  stripTextQuotes, stripHtmlQuotes, stripQuotedReply,
} from '../supabase/functions/_shared/email-logic.js';

// ── EMAIL_SENDER_NAME ────────────────────────────────────────────────────────
test('sender: vanligt namn passerar oförändrat', () => {
  assert.equal(sanitizeSenderName('Jannes Maskin & Smide'), 'Jannes Maskin & Smide');
});
test('sender: saknad/tom/icke-sträng ger fallback', () => {
  for (const v of [undefined, null, '', '   ', 42, {}]) assert.equal(sanitizeSenderName(v), DEFAULT_SENDER_NAME);
});
test('sender: CR/LF kan inte injiceras (ingen header-injektion)', () => {
  const out = sanitizeSenderName('Foo\r\nBcc: attacker@example.com');
  assert.ok(!/[\r\n]/.test(out));
  assert.equal(out, 'Foo Bcc: attacker@example.com'); // inga radbrytningar ⇒ ingen ny header
});
test('sender: komma, semikolon, citat, vinkelparenteser och backslash neutraliseras', () => {
  const out = sanitizeSenderName('A, B; "C" <x@y.z> \\');
  assert.ok(!/[,;"<>\\]/.test(out));
});
test('sender: längd begränsas till 100', () => {
  assert.equal(sanitizeSenderName('x'.repeat(500)).length, 100);
});
test('sender: bara otillåtna tecken ger fallback', () => {
  assert.equal(sanitizeSenderName('<>,;"'), DEFAULT_SENDER_NAME);
});
test('sender: eget fallback respekteras', () => {
  assert.equal(sanitizeSenderName('', 'Annat'), 'Annat');
});

// ── Message-ID ───────────────────────────────────────────────────────────────
test('message-id: normaliseras till <id>', () => {
  assert.equal(normalizeMessageId('abc@x'), '<abc@x>');
  assert.equal(normalizeMessageId(' <abc@x> '), '<abc@x>');
  assert.equal(normalizeMessageId(['a@x', 'b@x']), '<a@x>');
});
test('message-id: saknat/"none" ger null (mejlet ska lämnas UNSEEN)', () => {
  for (const v of [undefined, null, '', '  ', 'none']) assert.equal(normalizeMessageId(v), null);
});

// ── Trådmatchning ────────────────────────────────────────────────────────────
function makeStore(map, { failOn } = {}) {
  const calls = [];
  const lookup = async (mid) => {
    calls.push(mid);
    if (failOn && mid === failOn) return { quoteRequestId: null, error: 'db down' };
    return { quoteRequestId: map[mid] ?? null, error: null };
  };
  return { lookup, calls };
}

test('tråd: matchar via In-Reply-To', async () => {
  const s = makeStore({ '<m1@x>': 'Q1' });
  const r = await resolveThread({ inReplyTo: '<m1@x>', references: null }, s.lookup);
  assert.deepEqual(r, { quoteRequestId: 'Q1', matchedOriginalMessageId: '<m1@x>', error: null });
});
test('tråd: faller tillbaka på References och anger vilken referens som matchade', async () => {
  const s = makeStore({ '<m2@x>': 'Q2' });
  const r = await resolveThread({ inReplyTo: '<okänd@x>', references: ['<a@x>', '<m2@x>'] }, s.lookup);
  assert.equal(r.quoteRequestId, 'Q2');
  assert.equal(r.matchedOriginalMessageId, '<m2@x>');
});
test('tråd: omatchat mejl ger quoteRequestId=null (kopplas inte till godtyckligt ärende)', async () => {
  const s = makeStore({ '<m1@x>': 'Q1' });
  const r = await resolveThread({ inReplyTo: '<nej@x>', references: ['<nej2@x>'] }, s.lookup);
  assert.equal(r.quoteRequestId, null);
  assert.equal(r.error, null);
});
test('tråd: mejl utan In-Reply-To/References matchas aldrig (ingen avsändar-reservmatchning)', async () => {
  const s = makeStore({});
  const r = await resolveThread({ inReplyTo: null, references: null }, s.lookup);
  assert.equal(r.quoteRequestId, null);
  assert.equal(s.calls.length, 0);
});
test('tråd: DB-fel returneras som error (mejlet ska lämnas UNSEEN, ej behandlas)', async () => {
  const s = makeStore({}, { failOn: '<m1@x>' });
  const r = await resolveThread({ inReplyTo: '<m1@x>', references: [] }, s.lookup);
  assert.equal(r.error, 'db down');
  assert.equal(r.quoteRequestId, null);
});
test('tråd: DB-fel i References stoppar och tystas inte', async () => {
  const s = makeStore({}, { failOn: '<r2@x>' });
  const r = await resolveThread({ inReplyTo: null, references: ['<r1@x>', '<r2@x>'] }, s.lookup);
  assert.equal(r.error, 'db down');
});

// ── Dubbletter (idempotens) ──────────────────────────────────────────────────
test('dubblett: unique_violation 23505 identifieras, andra fel inte', () => {
  assert.equal(isDuplicateError({ code: '23505' }), true);
  assert.equal(isDuplicateError({ code: '42501' }), false);
  assert.equal(isDuplicateError(null), false);
});
test('dubblett: samma Message-ID behandlat två gånger ger en rad', () => {
  const rows = new Map();
  const insert = (mid) => (rows.has(mid) ? { error: { code: '23505' } } : (rows.set(mid, 1), { error: null }));
  const first = insert('<d@x>');
  const second = insert('<d@x>');
  assert.equal(first.error, null);
  assert.equal(isDuplicateError(second.error), true); // ⇒ koden sätter \Seen utan ny rad
  assert.equal(rows.size, 1);
});

// ── Bilagesökvägar ───────────────────────────────────────────────────────────
const Q = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
test('bilaga: admin-uppladdningens format `<id>/<fil>` accepteras', () => {
  assert.equal(isValidAttachmentPath(`${Q}/1700000000_abc.pdf`, Q), true);
});
test('bilaga: inkommande kundmejlsformat `customer_reply/<id>/<fil>` accepteras', () => {
  assert.equal(isValidAttachmentPath(`customer_reply/${Q}/uuid-fil.png`, Q), true);
});
test('bilaga: annat ärendes fil nekas', () => {
  assert.equal(isValidAttachmentPath(`${OTHER}/x.pdf`, Q), false);
  assert.equal(isValidAttachmentPath(`customer_reply/${OTHER}/x.pdf`, Q), false);
});
test('bilaga: path traversal, absolut sökväg, undermappar och skräp nekas', () => {
  for (const p of [`${Q}/../${OTHER}/x`, `/${Q}/x`, `${Q}/a/b`, `${Q}/`, Q, '', null, undefined, 5, `${Q}\\x`]) {
    assert.equal(isValidAttachmentPath(p, Q), false, String(p));
  }
});

// ── SMTP-fel efter sparat meddelande ─────────────────────────────────────────
test('smtp: lyckad sändning returnerar info', async () => {
  const t = { sendMail: async () => ({ accepted: ['a@b.c'], messageId: '<id@x>' }) };
  assert.equal((await sendMailChecked(t, {})).messageId, '<id@x>');
});
test('smtp: SMTP-fel kastas vidare (rapporteras inte som skickat)', async () => {
  const t = { sendMail: async () => { throw new Error('535 auth failed'); } };
  await assert.rejects(() => sendMailChecked(t, {}), /535/);
});
test('smtp: inga accepterade mottagare behandlas som fel', async () => {
  const t = { sendMail: async () => ({ accepted: [], rejected: ['a@b.c'] }) };
  await assert.rejects(() => sendMailChecked(t, {}), /ingen mottagare/);
});
test('smtp: meddelandet förblir sparat men status blir "failed" (ordning spara → skicka)', async () => {
  const db = [];
  db.push({ id: 1, body: 'svar' });                         // 1. sparas först (som send-quote-reply)
  const t = { sendMail: async () => { throw new Error('timeout'); } };
  let sent = false;
  try { await sendMailChecked(t, {}); sent = true; } catch { /* som catch-grenen i funktionen */ }
  assert.equal(db.length, 1);
  assert.equal(emailStatusFor({ configured: true, sent, testMode: false }), 'failed');
});
test('smtp: statusmappning', () => {
  assert.equal(emailStatusFor({ configured: false, sent: false, testMode: false }), 'not_configured');
  assert.equal(emailStatusFor({ configured: true, sent: true, testMode: false }), 'sent');
  assert.equal(emailStatusFor({ configured: true, sent: true, testMode: true }), 'sent_test_mode');
});

// ── Citeringsrensning (stripTextQuotes & stripHtmlQuotes) ──────────────────────
test('quotes: rensar svenskt Gmail-svar med radbrytning i headern (faktiskt exempel)', () => {
  const raw1 = `Wow\n\nDen tis 27 okt. 2026 22:30Jannes Maskin & Smide <\njannesmaskinosmide@gmail.com> skrev:\n\n> Hej\n>`;
  assert.equal(stripTextQuotes(raw1), 'Wow');

  const raw2 = `Jasså\n\nDen tis 27 okt. 2026 22:42Jannes Maskin & Smide <\njannesmaskinosmide@gmail.com> skrev:\n\n> heja!\n>`;
  assert.equal(stripTextQuotes(raw2), 'Jasså');
});

test('quotes: rensar svenskt format med kl. och "skrev Namn <email>:"', () => {
  const raw = `Tack för snabbt svar!\n\nDen tis 27 okt. 2026 kl. 22:30 skrev Jannes Maskin & Smide <jannesmaskinosmide@gmail.com>:\n> Offertdetaljer`;
  assert.equal(stripTextQuotes(raw), 'Tack för snabbt svar!');
});

test('quotes: rensar engelskt format (On [date] ... wrote:)', () => {
  const raw = `Sounds great to me.\n\nOn Tue, Oct 27, 2026 at 10:30 PM Jannes Maskin & Smide <jannesmaskinosmide@gmail.com> wrote:\n> Hello`;
  assert.equal(stripTextQuotes(raw), 'Sounds great to me.');
});

test('quotes: rensar direkt avsändarattribuering ("Namn <email> skrev:")', () => {
  const raw = `Godkänner offerten.\n\nJannes Maskin & Smide <jannesmaskinosmide@gmail.com> skrev:\n> Hej!`;
  assert.equal(stripTextQuotes(raw), 'Godkänner offerten.');
});

test('quotes: rensar Outlook / Exchange på svenska och engelska', () => {
  const se = `Detta blir toppen.\n\n-----Ursprungligt meddelande-----\nFrån: Jannes Maskin\nSkickat: den 27 okt\nTill: Kund\nÄmne: Re: Offert`;
  assert.equal(stripTextQuotes(se), 'Detta blir toppen.');

  const en = `Approved.\n\n-----Original Message-----\nFrom: Jannes\nSent: Tuesday\nTo: Customer\nSubject: Re: Quote`;
  assert.equal(stripTextQuotes(en), 'Approved.');
});

test('quotes: rensar avslutande > block utan header', () => {
  const raw = `Ja, absolut.\n\n> Fråga från kund\n> Mer text`;
  assert.equal(stripTextQuotes(raw), 'Ja, absolut.');
});

test('quotes: bevarar radbrytningar och legitim text som nämner "skrev", datum eller e-post', () => {
  const legit = `Hej!\n\nDen maskin ni föreslog verkar bra. Jag skrev upp modellnumret igår den 27 okt. 2026.\nKontakta mig på kund@exempel.se så bokar vi leverans på tisdag.\n\nMvh Erik`;
  assert.equal(stripTextQuotes(legit), legit.trim());
});

test('quotes: stripHtmlQuotes rensar .gmail_quote och blockquote', () => {
  const html = `<div dir="auto">Wow</div><br><div class="gmail_quote"><div dir="ltr">Den tis 27 okt. skrev:...</div><blockquote>Tidigare</blockquote></div>`;
  assert.equal(stripHtmlQuotes(html), `<div dir="auto">Wow</div><br>`);
});

test('quotes: stripQuotedReply returnerar både ren text och ren html', () => {
  const text = `Hej!\n\nDen tis 27 okt. 2026 skrev:...:\n> citat`;
  const html = `<div>Hej!</div><blockquote type="cite">citat</blockquote>`;
  const res = stripQuotedReply(text, html);
  assert.equal(res.cleanText, 'Hej!');
  assert.equal(res.cleanHtml, '<div>Hej!</div>');
});

