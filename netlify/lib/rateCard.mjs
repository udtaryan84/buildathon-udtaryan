// Hardcoded repair rate card in Indian rupees, per item, for Indian metros
// (Delhi NCR, Mumbai, Bengaluru, Pune, Hyderabad, Chennai) in 2026.
//
// These are estimates for a local contractor or an app based service visit,
// labour plus material, including the minimum visit charge. They are a ceiling
// on what a fair deduction looks like, not a quote. Painting figures follow the
// published per square foot touch-up rates (roughly Rs 12 to 30 per sq ft for
// a 10 x 10 ft wall plus putty and a visit charge).
//
// The model only ever picks a key from this table. Code looks up the money, so
// the model can never invent a rupee figure.

export const RATE_CARD = Object.freeze({
  wall_stain_marker: { label: "Wall stain or marker, crayon or ink marks (clean and patch paint)", min: 500, max: 1500 },
  wall_scratch_dent: { label: "Deep wall scratch, gouge or dent (putty and patch paint)", min: 800, max: 2000 },
  wall_hole_large: { label: "Large hole or broken plaster beyond small nail holes (fill and patch)", min: 400, max: 1200 },
  wall_repaint_full: { label: "Full repaint of one wall (only when patching cannot match)", min: 2000, max: 4500 },
  floor_scratch: { label: "Deep floor scratch or gouge (polish or patch)", min: 1000, max: 3000 },
  floor_stain: { label: "Permanent floor stain that does not clean off", min: 500, max: 2000 },
  tile_crack: { label: "Cracked or chipped floor or wall tile (replace one tile)", min: 800, max: 2500 },
  glass_crack: { label: "Cracked or broken window or door glass pane", min: 1000, max: 3500 },
  mirror_broken: { label: "Cracked or broken mirror", min: 800, max: 2500 },
  door_damage: { label: "Dent, crack or hole in a door or door frame", min: 1500, max: 5000 },
  lock_handle_broken: { label: "Broken lock, latch or door handle", min: 500, max: 1800 },
  switch_socket_broken: { label: "Broken switch, socket or switchboard plate", min: 200, max: 800 },
  light_fixture_broken: { label: "Broken light fitting, fan regulator or fixture", min: 500, max: 2000 },
  plumbing_fixture_broken: { label: "Broken tap, shower, flush or sink fitting", min: 600, max: 2500 },
  cabinet_wardrobe_damage: { label: "Damaged kitchen cabinet, wardrobe door or shutter", min: 1500, max: 5000 },
  furniture_damage: { label: "Damaged landlord furniture (bed, table, chair, shelf)", min: 1500, max: 6000 },
  upholstery_stain_tear: { label: "Stain or tear on sofa, mattress or upholstery", min: 1000, max: 4000 },
  curtain_blind_damage: { label: "Torn or broken curtain, rod or blind", min: 500, max: 2000 },
  burn_mark: { label: "Burn mark on a surface, counter or floor", min: 800, max: 3000 },
  appliance_damage: { label: "Visible physical damage to a landlord appliance", min: 1500, max: 6000 },
  general_repair: { label: "Other small repair not listed above", min: 500, max: 2000 }
});

export const RATE_KEYS = Object.freeze(Object.keys(RATE_CARD));

// The most items of one kind we will charge for in one spot. Stops a model
// mistake (quantity 50) from turning into a huge bill.
export const MAX_QUANTITY = 5;

/**
 * Look up the cost range for a damage type.
 * Unknown keys fall back to general_repair. Quantity is clamped to 1..MAX_QUANTITY.
 * Returns { key, label, cost_min_inr, cost_max_inr }.
 */
export function lookupCost(key, quantity = 1) {
  const safeKey = Object.prototype.hasOwnProperty.call(RATE_CARD, key) ? key : "general_repair";
  const rate = RATE_CARD[safeKey];
  let qty = Number.isFinite(Number(quantity)) ? Math.round(Number(quantity)) : 1;
  qty = Math.min(MAX_QUANTITY, Math.max(1, qty));
  return {
    key: safeKey,
    label: rate.label,
    quantity: qty,
    cost_min_inr: rate.min * qty,
    cost_max_inr: rate.max * qty
  };
}

// One line per key, used inside the prompt so the model knows what each key means.
export function rateCardForPrompt() {
  return RATE_KEYS.map((k) => `- ${k}: ${RATE_CARD[k].label}`).join("\n");
}
