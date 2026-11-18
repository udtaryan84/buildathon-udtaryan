// Get a schema-valid JSON object from the model, with at most two model calls:
//   call 1, then one retry that is either
//   - a repair retry (the answer was not valid JSON or broke the schema; we send the errors back),
//   - a plain retry (the API rejected the structured output settings), or
//   - a transient retry (rate limit, timeout or network blip).
// If the retry still breaks the schema, keep the valid array items if possible.

import { ModelError } from "./gemini.mjs";
import { parseModelJson, validate, salvageArray } from "./json.mjs";

const MAX_CALLS = 2;

export async function generateStructured({ callModel, system, parts, schema, arrayKey, budgetMs = 25000 }) {
  const started = Date.now();
  const remaining = () => budgetMs - (Date.now() - started);
  let calls = 0;
  let plain = false;
  let extraParts = [];
  let lastParsed = null;
  let lastErrors = [];

  while (calls < MAX_CALLS) {
    const timeoutMs = Math.max(3000, Math.min(20000, remaining() - 500));
    calls += 1;
    let text;
    try {
      const out = await callModel({ system, parts: [...parts, ...extraParts], schema, timeoutMs, plain });
      text = out.text;
    } catch (e) {
      if (!(e instanceof ModelError)) throw e;
      const canRetry = calls < MAX_CALLS && remaining() > 8000;
      if (canRetry && e.kind === "bad_request" && !plain) {
        plain = true;
        extraParts = [{ text: `Reply with only a JSON object that matches this JSON schema:\n${JSON.stringify(schema)}` }];
        continue;
      }
      if (canRetry && ["rate_limit", "upstream", "network", "timeout"].includes(e.kind)) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      throw e;
    }

    const parsed = parseModelJson(text);
    if (parsed.ok) {
      const errors = validate(schema, parsed.value);
      if (errors.length === 0) return { value: parsed.value, calls, repaired: calls > 1 };
      lastParsed = parsed.value;
      lastErrors = errors;
    } else {
      lastErrors = [parsed.error];
    }

    if (calls < MAX_CALLS && remaining() > 8000) {
      extraParts = [
        ...(plain ? extraParts.slice(0, 1) : []),
        {
          text:
            "Your previous answer could not be used because: " +
            lastErrors.slice(0, 6).join("; ") +
            ". Answer again with only one JSON object that follows the schema exactly."
        }
      ];
      continue;
    }
    break;
  }

  if (lastParsed && arrayKey) {
    const salvaged = salvageArray(schema, lastParsed, arrayKey);
    if (salvaged) return { value: salvaged.value, calls, repaired: true, dropped: salvaged.dropped };
  }
  console.error("model output invalid:", lastErrors.slice(0, 6).join("; "));
  throw new ModelError("invalid_output", "the AI gave an unreadable answer, please try again", 502);
}
