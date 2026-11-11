/**
 * Hjälpfunktioner för slug-generering och URL-normalisering.
 */

/**
 * Omvandla ett namn eller rå text till en URL-vänlig slug.
 * Hanterar svenska tecken: å→a, ä→a, ö→o
 * Hanterar accenter: é, è, ê→e
 * Tar bort specialtecken och normaliserar blanksteg/bindestreck.
 */
export function generateSlug(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é|è|ê/g, 'e')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

