// @ts-nocheck: web app code, kept as written
// Shared outfit-building utilities used by generateOutfit and getTodaysEdit.
// Kept here so both functions use the same garment-type inference and
// completeness validation — no duplicated logic.

export function inferGarmentType(it) {
  if (it.garment_type) return it.garment_type;
  const cat = it.category;
  if (cat === 'tops') return 'top';
  if (cat === 'bottoms') return 'bottom';
  if (cat === 'dresses' || cat === 'co_ord') return 'one_piece';
  if (cat === 'movement_wear' || cat === 'swimwear') {
    const name = (it.name || '').toLowerCase();
    const bottomWords = ['legging', 'short', 'pant', 'trouser', 'tight', 'track', 'jogger', 'skirt'];
    const topWords = ['top', 'tank', 'crop', 'bra', 'singlet', 'tee', 'shirt', 'vest', 'bodysuit'];
    if (bottomWords.some(w => name.includes(w))) return 'bottom';
    if (topWords.some(w => name.includes(w))) return 'top';
    return 'unknown';
  }
  return null;
}

// Hydrate raw item_ids into full item objects, deduplicating by garment_type
// (one top, one bottom, one one_piece) and by category for accessories.
export function hydrateOutfitItems(itemIds, itemMap) {
  const seenGarmentTypes = new Set();
  const seenCategories = new Set();
  return (itemIds || [])
    .map(id => itemMap.get(id))
    .filter(Boolean)
    .filter((it) => {
      const gt = inferGarmentType(it);
      if (gt === 'top' || gt === 'bottom' || gt === 'one_piece') {
        if (seenGarmentTypes.has(gt)) return false;
        seenGarmentTypes.add(gt);
      } else {
        if (seenCategories.has(it.category)) return false;
        seenCategories.add(it.category);
      }
      return true;
    })
    .map(it => ({
      item_id: it.id,
      name: it.name,
      category: it.category,
      image_url: it.image_url,
      brand: it.brand,
    }));
}

// Validate that an outfit has a complete top half + bottom half + enough pieces.
export function isComplete(hydratedItems) {
  const gts = hydratedItems.map(it => inferGarmentType(it));
  const hasTop = gts.includes('top');
  const hasBottom = gts.includes('bottom');
  const hasOnePiece = gts.includes('one_piece');
  const hasTopHalf = hasTop || hasOnePiece;
  const hasBottomHalf = hasBottom || hasOnePiece;
  if (!hasTopHalf || !hasBottomHalf) return false;
  const minItems = hasOnePiece ? 2 : 3;
  return hydratedItems.length >= minItems;
}

// Build a compact inventory array from wardrobe items, with optional wear history.
export function buildInventory(items, wornItemIds) {
  return items.map((it) => ({
    id: it.id,
    name: it.name,
    brand: it.brand || '',
    category: it.category,
    garment_type: inferGarmentType(it),
    color: it.color || '',
    fit: it.fit || '',
    style_tags: it.style_tags || [],
    season: it.season || 'all',
    ...(wornItemIds ? { worn_recently: wornItemIds.has(it.id) } : {}),
  }));
}