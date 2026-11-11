import './_no-network.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSlug } from '../src/lib/slugUtils.js';

// ── Slug-generering och normalisering ─────────────────────────────────────────
test('slug: normalisering av svenska tecken och accenter', () => {
  assert.equal(generateSlug('Åkerman H10B & Övrigt Äpple'), 'akerman-h10b-ovrigt-apple');
  assert.equal(generateSlug('Valmet 6400 (Skogsutrustad!)'), 'valmet-6400-skogsutrustad');
  assert.equal(generateSlug('Café & Traktor'), 'cafe-traktor');
});

test('slug: rensar inledande, avslutande och multipla blanksteg samt bindestreck', () => {
  assert.equal(generateSlug('   Janne2000   '), 'janne2000');
  assert.equal(generateSlug('Janne   2000'), 'janne-2000');
  assert.equal(generateSlug('---Janne--2000---'), 'janne-2000');
  assert.equal(generateSlug('Maskin #1 / 2026!'), 'maskin-1-2026');
});

test('slug: hanterar html-entiteter och specialtecken URL-säkert', () => {
  // När en sträng med HTML-entitet som &#x20; skickas in rensas & # ; bort och blir URL-säker
  assert.equal(generateSlug('Janne2000&#x20;'), 'janne2000x20');
  assert.equal(generateSlug('Traktor &amp; Vagn'), 'traktor-amp-vagn');
  assert.equal(generateSlug('Maskin med "citat" & <taggar>'), 'maskin-med-citat-taggar');
});

test('slug: tomma, ogiltiga eller whitespace-strängar ger tom slug', () => {
  assert.equal(generateSlug(''), '');
  assert.equal(generateSlug('   '), '');
  assert.equal(generateSlug('---'), '');
  assert.equal(generateSlug('!@#$%^&*()'), '');
  assert.equal(generateSlug(null), '');
  assert.equal(generateSlug(undefined), '');
});

// ── Simulering av unikhet och krockhantering ──────────────────────────────────
test('slug: unikhetssimulering med excludeId (samma logik som ensureUniqueSlug)', async () => {
  const existingDatabaseRows = [
    { id: 'machine-1', slug: 'valmet-6400' },
    { id: 'machine-2', slug: 'valmet-6400-2' },
    { id: 'machine-3', slug: 'volvo-bm-650' },
  ];

  async function mockEnsureUniqueSlug(baseSlug, excludeId = null) {
    let slug = baseSlug;
    let counter = 2;
    while (true) {
      const match = existingDatabaseRows.find(r => r.slug === slug && (!excludeId || r.id !== excludeId));
      if (!match) {
        return slug;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  // 1. Ny maskin med ledig slug
  assert.equal(await mockEnsureUniqueSlug('ny-traktor'), 'ny-traktor');

  // 2. Ny maskin som krockar med 'valmet-6400' och 'valmet-6400-2' -> får -3
  assert.equal(await mockEnsureUniqueSlug('valmet-6400'), 'valmet-6400-3');

  // 3. Befintlig maskin (machine-1) redigeras och behåller sin egen slug (excludeId)
  assert.equal(await mockEnsureUniqueSlug('valmet-6400', 'machine-1'), 'valmet-6400');

  // 4. Befintlig maskin (machine-3) byter namn till 'valmet-6400' -> krockar och får suffix
  assert.equal(await mockEnsureUniqueSlug('valmet-6400', 'machine-3'), 'valmet-6400-3');
});

// ── Simulering av formulärets slug-beräkning (MachineFormPage) ─────────────────
test('slug: formulärlogik för manuell respektive automatisk slug', () => {
  function computeFinalSlug({ slugManual, slugPreview, formName }) {
    const rawCandidate = slugManual && slugPreview.trim()
      ? slugPreview.trim()
      : (slugPreview.trim() || generateSlug(formName));
    return generateSlug(rawCandidate);
  }

  // A. Ny maskin, autogenereras från namn
  assert.equal(
    computeFinalSlug({ slugManual: false, slugPreview: 'volvo-bm-650', formName: 'Volvo BM 650' }),
    'volvo-bm-650'
  );

  // B. Befintlig maskin vars namn uppdaterades, inte manuellt ändrad
  assert.equal(
    computeFinalSlug({ slugManual: false, slugPreview: 'valmet-6400', formName: 'Valmet 6400' }),
    'valmet-6400'
  );

  // C. Användaren har aktivt angett en manuell slug med konstiga tecken eller mellanslag
  assert.equal(
    computeFinalSlug({ slugManual: true, slugPreview: '  Min Special-Slug! 2026  ', formName: 'Valmet 6400' }),
    'min-special-slug-2026'
  );

  // D. Användaren rensade manuella fältet (tom sträng) -> faller tillbaka på namn
  assert.equal(
    computeFinalSlug({ slugManual: true, slugPreview: '', formName: 'Valmet 6400' }),
    'valmet-6400'
  );
});

