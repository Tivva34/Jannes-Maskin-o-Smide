import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────
// Hjälpfunktioner för slug
// ─────────────────────────────────────────────────────────────

/**
 * Omvandla ett maskinnamn till en URL-vänlig slug.
 * Hanterar svenska tecken: å→a, ä→a, ö→o
 */
export function generateSlug(name) {
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

/**
 * Säkerställ att en slug är unik i databasen.
 * Om 'massey-ferguson-390t' redan finns returneras 'massey-ferguson-390t-2' osv.
 * Skicka med excludeId för att ignorera den aktuella maskinens egen slug (vid redigering).
 */
export async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    let query = supabase
      .from('machines')
      .select('id')
      .eq('slug', slug);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      // Ingen krock – slug är ledig
      return slug;
    }

    // Krock – prova nästa suffix
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// ─────────────────────────────────────────────────────────────
// CRUD för maskiner
// ─────────────────────────────────────────────────────────────

/**
 * Hämta alla maskiner för admin (alla statusar).
 * Returneras sorterade efter created_at fallande.
 */
export async function getMachines() {
  const { data, error } = await supabase
    .from('machines')
    .select('id, slug, category, name, name_en, type, year, price, status, features, features_en, specs, specs_en, created_at, updated_at, machine_images(*)')
    .order('created_at', { ascending: false });

  if (data) {
    data.forEach(m => {
      if (m.machine_images) {
        m.machine_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
    });
  }

  return { data, error };
}

/**
 * Hämta alla publicerade maskiner för den publika sajten.
 * Sorterade efter created_at fallande.
 */
export async function getPublicMachines() {
  const { data, error } = await supabase
    .from('machines')
    .select('id, slug, category, name, name_en, type, year, price, features, features_en, specs, specs_en, machine_images(*)')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (data) {
    data.forEach(m => {
      if (m.machine_images) {
        m.machine_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
    });
  }

  return { data, error };
}

/**
 * Hämta en enskild maskin via ID (för redigeringsformuläret).
 */
export async function getMachineById(id) {
  const { data, error } = await supabase
    .from('machines')
    .select('*, machine_images(*)')
    .eq('id', id)
    .single();

  if (data && data.machine_images) {
    data.machine_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  return { data, error };
}

/**
 * Hämta en enskild publik maskin via slug.
 */
export async function getMachineBySlug(slug) {
  const { data, error } = await supabase
    .from('machines')
    .select('*, machine_images(*)')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (data && data.machine_images) {
    data.machine_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  return { data, error };
}

/**
 * Hämta liknande maskiner (samma kategori, publicerade, exklusive aktuell maskin).
 */
export async function getSimilarMachines(currentMachineId, category, limitCount = 3) {
  let query = supabase
    .from('machines')
    .select('id, slug, category, name, name_en, type, year, price, machine_images(*)')
    .eq('status', 'published')
    .neq('id', currentMachineId)
    .order('created_at', { ascending: false });
    
  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query.limit(limitCount);

  if (data) {
    data.forEach(m => {
      if (m.machine_images) {
        m.machine_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
    });
  }

  return { data, error };
}

/**
 * Skapa en ny maskin.
 * Genererar och avduplicerar slug automatiskt.
 */
export async function createMachine(fields) {
  const baseSlug = generateSlug(fields.name);
  const slug = await ensureUniqueSlug(baseSlug);

  const { data, error } = await supabase
    .from('machines')
    .insert([{
      slug,
      name:        fields.name.trim(),
      name_en:     fields.name_en?.trim()     || null,
      category:    fields.category?.trim()    || 'other',
      type:        fields.type?.trim()        || null,
      year:        fields.year?.trim()        || null,
      price:       fields.price !== '' ? parseInt(fields.price, 10) : null,
      description: fields.description?.trim() || null,
      description_en: fields.description_en?.trim() || null,
      status:      fields.status             || 'draft',
      features:    fields.features           || [],
      features_en: fields.features_en        || null,
      specs:       fields.specs              || {},
      specs_en:    fields.specs_en           || null,
    }])
    .select()
    .single();

  return { data, error };
}

/**
 * Uppdatera en befintlig maskin.
 * Slug genereras INTE om automatiskt – uppdateras bara om den uttryckligen ändras.
 */
export async function updateMachine(id, fields) {
  const { data, error } = await supabase
    .from('machines')
    .update({
      name:        fields.name.trim(),
      name_en:     fields.name_en?.trim()     || null,
      category:    fields.category?.trim()    || 'other',
      type:        fields.type?.trim()        || null,
      year:        fields.year?.trim()        || null,
      price:       fields.price !== '' && fields.price !== null ? parseInt(fields.price, 10) : null,
      description: fields.description?.trim() || null,
      description_en: fields.description_en?.trim() || null,
      status:      fields.status,
      features:    fields.features            || [],
      features_en: fields.features_en         || null,
      specs:       fields.specs               || {},
      specs_en:    fields.specs_en            || null,
      // updated_at hanteras av databastriggern
    })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

/**
 * Radera en maskin via ID.
 * Rader i machine_images tas bort automatiskt av databasen (ON DELETE CASCADE).
 * Filer i lagringen måste rensas separat (fas 6).
 */
export async function deleteMachine(id) {
  const { error } = await supabase
    .from('machines')
    .delete()
    .eq('id', id);

  return { error };
}

// ─────────────────────────────────────────────────────────────
// Hjälpfunktioner för status
// ─────────────────────────────────────────────────────────────

export const STATUS_OPTIONS = [
  { value: 'draft',     label: 'Utkast',     color: '#6b7277' },
  { value: 'published', label: 'Publicerad', color: '#22c55e' },
  { value: 'reserved',  label: 'Reserverad', color: '#f59e0b' },
  { value: 'sold',      label: 'Såld',       color: '#ef4444' },
];

export function getStatusLabel(status) {
  return STATUS_OPTIONS.find(s => s.value === status)?.label ?? status;
}

export function getStatusColor(status) {
  return STATUS_OPTIONS.find(s => s.value === status)?.color ?? '#6b7277';
}

// ─────────────────────────────────────────────────────────────
// Bildhantering
// ─────────────────────────────────────────────────────────────

const MAX_IMAGE_SIZE_MB = 10;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function uploadMachineImage(machineId, file) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { error: new Error('Ogiltigt filformat. Endast JPEG, PNG, WEBP och GIF är tillåtna.') };
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return { error: new Error(`Filen är för stor. Max ${MAX_IMAGE_SIZE_MB} MB.`) };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const storagePath = `${machineId}/${timestamp}_${randomStr}_${safeName}`;

  // Ladda upp till lagringen (Storage)
  const { error: storageError } = await supabase.storage
    .from('machine-images')
    .upload(storagePath, file, { cacheControl: '3600', upsert: false });

  if (storageError) {
    return { error: storageError };
  }

  const { data: publicUrlData } = supabase.storage
    .from('machine-images')
    .getPublicUrl(storagePath);

  const imageUrl = publicUrlData.publicUrl;

  // Hämta befintliga bilder för att avgöra sort_order och is_primary
  const { data: currentImages } = await supabase
    .from('machine_images')
    .select('sort_order, is_primary')
    .eq('machine_id', machineId);

  const isFirstImage = !currentImages || currentImages.length === 0;
  const nextSortOrder = isFirstImage ? 0 : Math.max(...currentImages.map(i => i.sort_order || 0)) + 1;

  // Infoga i databasen
  const { data: insertedImage, error: dbError } = await supabase
    .from('machine_images')
    .insert([{
      machine_id: machineId,
      image_url: imageUrl,
      storage_path: storagePath,
      sort_order: nextSortOrder,
      is_primary: isFirstImage,
      alt_text: file.name
    }])
    .select()
    .single();

  // Rulla tillbaka filen i lagringen om databasinfogningen misslyckas
  if (dbError) {
    await supabase.storage.from('machine-images').remove([storagePath]);
    return { error: new Error('Databas-fel vid sparning av bild: ' + dbError.message) };
  }

  return { data: insertedImage, error: null };
}

export async function deleteMachineImage(imageId, storagePath) {
  // 1. Radera från databasen först
  const { error: dbError } = await supabase
    .from('machine_images')
    .delete()
    .eq('id', imageId);

  if (dbError) {
    return { error: dbError };
  }

  // 2. Radera från lagringen (Storage)
  const { error: storageError } = await supabase.storage
    .from('machine-images')
    .remove([storagePath]);

  if (storageError) {
    // Om radering från lagringen misslyckas loggas en varning medan databasraden redan är borta.
    // För adminverktyget är detta acceptabelt utan separat bakgrundsjobb.
    console.warn('Failed to delete storage file, but DB row was deleted:', storageError);
  }

  return { error: null };
}

export async function setPrimaryMachineImage(machineId, imageId) {
  // Databastriggern 'enforce_single_primary_image' hanterar nollställning av övriga bilder
  const { data, error } = await supabase
    .from('machine_images')
    .update({ is_primary: true })
    .eq('id', imageId)
    .eq('machine_id', machineId) // säkerhetskontroll
    .select()
    .single();

  return { data, error };
}

export async function updateImageSortOrder(updates) {
  // updates är en lista med objekt: { id: 'uuid', sort_order: number }
  // Uppdateringarna körs parallellt, vilket fungerar bra för normala bildmängder.
  const promises = updates.map(update => 
    supabase
      .from('machine_images')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id)
  );

  const results = await Promise.all(promises);
  const error = results.find(r => r.error)?.error;
  return { error: error || null };
}
