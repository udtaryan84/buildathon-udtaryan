// POST /api/analyse-spot (move-in). Contract: docs/CONTRACT.md, endpoint 1.
import { runHandler } from "../lib/http.mjs";
import { analyseSpot } from "../lib/analyseSpot.mjs";

export default async (req) => runHandler(req, (body) => analyseSpot(body));

export const config = { path: "/api/analyse-spot" };
