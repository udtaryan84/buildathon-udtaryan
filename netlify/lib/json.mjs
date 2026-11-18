// Small JSON tools with no dependencies:
// 1. parseModelJson: turn model text into an object, repairing common slips
//    (code fences, chatter around the JSON, trailing commas).
// 2. validate: check a value against the subset of JSON Schema we use
//    (type, properties, required, items, enum, minimum, maximum, maxItems).

/**
 * Parse text that should be JSON. Returns { ok: true, value } or { ok: false, error }.
 */
export function parseModelJson(text) {
  if (typeof text !== "string" || text.trim() === "") {
    return { ok: false, error: "empty model output" };
  }
  const direct = tryParse(text);
  if (direct.ok) return direct;

  let s = text.trim();
  // Strip ```json ... ``` fences.
  s = s.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```\s*$/, "");
  // Keep only the outermost object.
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last > first) s = s.slice(first, last + 1);
  // Remove trailing commas before a closing bracket.
  s = s.replace(/,\s*([}\]])/g, "$1");
  const repaired = tryParse(s);
  if (repaired.ok) return repaired;
  return { ok: false, error: `output is not valid JSON (${direct.error})` };
}

function tryParse(s) {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function typeMatches(expected, v) {
  const actual = typeOf(v);
  if (expected === "number") return actual === "number" || actual === "integer";
  return actual === expected;
}

/**
 * Validate value against schema. Returns a list of error strings (empty = valid).
 */
export function validate(schema, value, path = "$") {
  const errors = [];
  if (!schema || typeof schema !== "object") return errors;

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(t, value))) {
      errors.push(`${path}: expected ${types.join(" or ")}, got ${typeOf(value)}`);
      return errors;
    }
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} is not one of ${schema.enum.join(", ")}`);
  }
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) errors.push(`${path}: below minimum ${schema.minimum}`);
    if (typeof schema.maximum === "number" && value > schema.maximum) errors.push(`${path}: above maximum ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      errors.push(`${path}: more than ${schema.maxItems} items`);
    }
    if (schema.items) {
      value.forEach((item, i) => errors.push(...validate(schema.items, item, `${path}[${i}]`)));
    }
  }
  if (typeOf(value) === "object") {
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push(`${path}.${key}: missing`);
    }
    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (key in value) errors.push(...validate(sub, value[key], `${path}.${key}`));
    }
  }
  return errors;
}

/**
 * Last-resort salvage: if the top level is fine but some array items are broken,
 * keep only the valid items. Returns { value, dropped } or null if not salvageable.
 */
export function salvageArray(schema, value, arrayKey) {
  if (typeOf(value) !== "object" || !Array.isArray(value[arrayKey])) return null;
  const itemSchema = schema.properties?.[arrayKey]?.items;
  const maxItems = schema.properties?.[arrayKey]?.maxItems ?? Infinity;
  const kept = value[arrayKey].filter((item) => validate(itemSchema, item).length === 0).slice(0, maxItems);
  const candidate = { ...value, [arrayKey]: kept };
  if (validate(schema, candidate).length > 0) return null;
  return { value: candidate, dropped: value[arrayKey].length - kept.length };
}
