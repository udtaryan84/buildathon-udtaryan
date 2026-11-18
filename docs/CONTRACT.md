# Jaisa Tha: API contract

A dashcam for your rental deposit. Tenant captures each spot of a flat at move-in. At move-out the
app compares the new photo with the old one and says what was already there, what is normal wear
and what is real damage, with a fair deduction in rupees.

Stack: Vite + React (frontend), Netlify Functions (Node 20, ESM), Netlify Blobs (storage), Gemini
API (vision). Key is in env `GEMINI_API_KEY`. Never commit it.

## Ownership (do not edit the other side's files)
- AI side (Opus agent): `netlify/functions/analyse-spot.mjs`, `netlify/functions/compare.mjs`,
  `netlify/lib/*` (prompts, rate card, Gemini client, JSON validation), `netlify/lib/test/*`.
- App side (Sonnet): everything in `src/`, `index.html`, storage functions, config.

## Endpoint 1: POST /api/analyse-spot  (move-in)
Request JSON:
```json
{ "spotName": "Bedroom, north wall", "imageBase64": "<no data: prefix>", "mimeType": "image/jpeg" }
```
Response 200 JSON:
```json
{ "issues": [ { "description": "Scratch about 10 cm on lower left of wall", "severity": "minor" } ] }
```
`severity` is one of `minor | moderate | major`. Empty array if the spot is clean.

## Endpoint 2: POST /api/compare  (move-out)
Request JSON:
```json
{
  "spotName": "Bedroom, north wall",
  "moveIn":  { "imageBase64": "...", "mimeType": "image/jpeg", "issues": [ { "description": "...", "severity": "minor" } ] },
  "moveOut": { "imageBase64": "...", "mimeType": "image/jpeg" }
}
```
Response 200 JSON:
```json
{
  "changes": [
    {
      "description": "Fresh black marker stain on the wall near the switch",
      "category": "damage",
      "reason": "Not visible in the move-in photo and is not caused by ageing or use",
      "cost_min_inr": 800,
      "cost_max_inr": 1500
    }
  ],
  "summary": "One new stain. One scratch was already there."
}
```
`category` is exactly one of `pre_existing | normal_wear | damage`.
- `pre_existing`: present in move-in photo or notes. Cost must be 0.
- `normal_wear`: ordinary ageing or use (dust, light scuffs, faded paint). Cost must be 0.
- `damage`: new and beyond ordinary use. Cost comes from the rate card, never invented.

Errors: non-200 with `{ "error": "short message" }`. Functions must never crash on a bad image.
The model must ignore differences in lighting, camera angle and colour cast.

## Money rule
`cost_min_inr` / `cost_max_inr` come from `netlify/lib/rateCard.mjs` (hardcoded INR table by damage
type, Indian metro prices). Total fair deduction on the frontend = sum of `cost_max_inr`
(upper bound) shown as a range min to max.

## Frontend storage (App side only)
Netlify Blobs: inspections (id, property, landlord WhatsApp, rooms/spots, photo hashes,
timestamps, acknowledgement) and photos. The report link is `/r/:id`.
