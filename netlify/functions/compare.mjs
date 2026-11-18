// POST /api/compare (move-out). Contract: docs/CONTRACT.md, endpoint 2.
import { runHandler } from "../lib/http.mjs";
import { compareSpots } from "../lib/compareSpots.mjs";

export default async (req) => runHandler(req, (body) => compareSpots(body));

export const config = { path: "/api/compare" };
