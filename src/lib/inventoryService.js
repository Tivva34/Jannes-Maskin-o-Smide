import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────
// CRUD för lösöre
// ─────────────────────────────────────────────────────────────

/**
 * Hämta alla lösöresobjekt för admin (alla statusar).
 * Returneras sorterade efter created_at fallande.
 */
export async function getInventoryItems() {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, slug, category, name, name_en, description, description_en, price, status, created_at, updated_at, inventory_images(*)')
    .order('created_at', { ascending: false });

  if (data) {
    data.forEach(item => {
      if (item.inventory_images) {
        item.inventory_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
    });
  }

  return { data, error };
}

/**
 * Hämta alla publicerade lösöresobjekt för den publika sajten.
 * Sorterade efter created_at fallande.
 */
export async function getPublicInventoryItems() {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, slug, category, name, name_en, description, description_en, price, status, inventory_images(*)')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (data) {
    data.forEach(item => {
      if (item.inventory_images) {
        item.inventory_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
    });
  }

  return { data, error };
}

/**
 * Hämta ett enskilt lösöresobjekt via ID (för redigeringsformuläret eller publika detaljer vid behov).
 */
export async function getInventoryItemById(id) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*, inventory_images(*)')
    .eq('id', id)
    .single();

  if (data && data.inventory_images) {
    data.inventory_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  return { data, error };
}

/**
 * Hämta ett enskilt publikt lösöresobjekt via slug ELLER id för bakåtkompatibilitet.
 */
export async function getInventoryItemBySlugOrId(identifier) {
  // Om identifieraren är ett giltigt UUID, försök hämta via ID först
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  
  let data, error;
  
  if (isUuid) {
    ({ data, error } = await supabase
      .from('inventory_items')
      .select('id, slug, category, name, name_en, description, description_en, price, status, inventory_images(*)')
      .eq('id', identifier)
      .eq('status', 'published')
      .single());
  }
  
  // Om det inte är ett UUID eller om UUID-uppslaget misslyckades, försök med slug
  if (!data && !error) {
    ({ data, error } = await supabase
      .from('inventory_items')
      .select('id, slug, category, name, name_en, description, description_en, price, status, inventory_images(*)')
      .eq('slug', identifier)
      .eq('status', 'published')
      .single());
  }

  if (data && data.inventory_images) {
    data.inventory_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  return { data, error };
}

/**
 * Hämta liknande publicerade lösöresobjekt efter kategori.
 */
export async function getSimilarInventoryItems(excludeId, category, limit = 3) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, slug, category, name, name_en, price, status, inventory_images(*)')
    .eq('status', 'published')
    .eq('category', category)
    .neq('id', excludeId)
    .limit(limit);

  if (data) {
    data.forEach(item => {
      if (item.inventory_images) {
        item.inventory_images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
    });
  }

  return { data, error };
}

/**
 * Omvandla ett namn till en URL-vänlig slug.
 */
export function generateSlug(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Säkerställ att en slug är unik i databasen.
 * Skicka med excludeId för att ignorera det aktuella objektets egen slug (vid redigering).
 */
export async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    let query = supabase
      .from('inventory_items')
      .select('id')
      .eq('slug', slug);
      
    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;
    
    if (error || !data || data.length === 0) {
      return slug;
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Skapa ett nytt lösöresobjekt.
 */
export async function createInventoryItem(fields) {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert([{
      name:        fields.name.trim(),
      slug:        fields.slug, // Se till att skicka med slug
      category:    fields.category || 'other',
      name_en:     fields.name_en?.trim() || null,
      description: fields.description?.trim() || null,
      description_en: fields.description_en?.trim() || null,
      price:       fields.price !== '' && fields.price != null ? parseInt(fields.price, 10) : null,
      status:      fields.status || 'draft',
    }])
    .select()
    .single();

  return { data, error };
}

/**
 * Uppdatera ett befintligt lösöresobjekt.
 */
export async function updateInventoryItem(id, fields) {
  const { data, error } = await supabase
    .from('inventory_items')
    .update({
      name:        fields.name.trim(),
      slug:        fields.slug,
      category:    fields.category || 'other',
      name_en:     fields.name_en?.trim() || null,
      description: fields.description?.trim() || null,
      description_en: fields.description_en?.trim() || null,
      price:       fields.price !== '' && fields.price != null ? parseInt(fields.price, 10) : null,
      status:      fields.status,
    })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

/**
 * Radera ett lösöresobjekt via ID.
 * Rader i inventory_images tas bort automatiskt av databasen (ON DELETE CASCADE).
 * Filer i lagringen måste rensas separat.
 */
export async function deleteInventoryItem(id) {
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', id);

  return { error };
}

// ─────────────────────────────────────────────────────────────
// Hjälpfunktioner för status och kategori
// ─────────────────────────────────────────────────────────────

export const INVENTORY_CATEGORIES = [
  { value: 'agriculture',  labelKey: 'inventory.categories.agriculture' },
  { value: 'construction', labelKey: 'inventory.categories.construction' },
  { value: 'workshop',     labelKey: 'inventory.categories.workshop' },
  { value: 'tires',        labelKey: 'inventory.categories.tires' },
  { value: 'parts',        labelKey: 'inventory.categories.parts' },
  { value: 'other',        labelKey: 'inventory.categories.other' },
];

export const INVENTORY_STATUS_OPTIONS = [
  { value: 'draft',     label: 'Utkast',     color: '#6b7277' },
  { value: 'published', label: 'Publicerad', color: '#22c55e' },
  { value: 'reserved',  label: 'Reserverad', color: '#f59e0b' },
  { value: 'sold',      label: 'Såld',       color: '#ef4444' },
];

export function getInventoryStatusLabel(status) {
  return INVENTORY_STATUS_OPTIONS.find(s => s.value === status)?.label ?? status;
}

export function getInventoryStatusColor(status) {
  return INVENTORY_STATUS_OPTIONS.find(s => s.value === status)?.color ?? '#6b7277';
}

// ─────────────────────────────────────────────────────────────
// Bildhantering
// ─────────────────────────────────────────────────────────────

const MAX_IMAGE_SIZE_MB = 10;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function uploadInventoryImage(itemId, file) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { error: new Error('Ogiltigt filformat. Endast JPEG, PNG, WEBP och GIF är tillåtna.') };
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return { error: new Error(`Filen är för stor. Max ${MAX_IMAGE_SIZE_MB} MB.`) };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const storagePath = `${itemId}/${timestamp}_${randomStr}_${safeName}`;

  // Ladda upp till lagringen (Storage)
  const { error: storageError } = await supabase.storage
    .from('inventory-images')
    .upload(storagePath, file, { cacheControl: '3600', upsert: false });

  if (storageError) {
    return { error: storageError };
  }

  const { data: publicUrlData } = supabase.storage
    .from('inventory-images')
    .getPublicUrl(storagePath);

  const imageUrl = publicUrlData.publicUrl;

  // Hämta befintliga bilder för att avgöra sort_order och is_primary
  const { data: currentImages } = await supabase
    .from('inventory_images')
    .select('sort_order, is_primary')
    .eq('item_id', itemId);

  const isFirstImage = !currentImages || currentImages.length === 0;
  const nextSortOrder = isFirstImage ? 0 : Math.max(...currentImages.map(i => i.sort_order || 0)) + 1;

  // Infoga i databasen
  const { data: insertedImage, error: dbError } = await supabase
    .from('inventory_images')
    .insert([{
      item_id: itemId,
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
    await supabase.storage.from('inventory-images').remove([storagePath]);
    return { error: new Error('Databas-fel vid sparning av bild: ' + dbError.message) };
  }

  return { data: insertedImage, error: null };
}

export async function deleteInventoryImage(imageId, storagePath) {
  // 1. Radera från databasen först
  const { error: dbError } = await supabase
    .from('inventory_images')
    .delete()
    .eq('id', imageId);

  if (dbError) {
    return { error: dbError };
  }

  // 2. Radera från lagringen (Storage)
  const { error: storageError } = await supabase.storage
    .from('inventory-images')
    .remove([storagePath]);

  if (storageError) {
    console.warn('Failed to delete storage file, but DB row was deleted:', storageError);
  }

  return { error: null };
}

export async function setPrimaryInventoryImage(itemId, imageId) {
  // Nollställ först alla andra primärbilder för detta objekt
  const { error: unsetError } = await supabase
    .from('inventory_images')
    .update({ is_primary: false })
    .eq('item_id', itemId);

  if (unsetError) return { error: unsetError };

  // Sätt sedan målbilden som primärbild
  const { data, error } = await supabase
    .from('inventory_images')
    .update({ is_primary: true })
    .eq('id', imageId)
    .select()
    .single();

  return { data, error };
}

export async function updateInventoryImageSortOrder(updates) {
  const promises = updates.map(update => 
    supabase
      .from('inventory_images')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id)
  );

  const results = await Promise.all(promises);
  const error = results.find(r => r.error)?.error;
  return { error: error || null };
}
