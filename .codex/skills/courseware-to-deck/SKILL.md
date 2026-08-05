---
name: courseware-to-deck
description: Transform Markdown or structured courseware into a knowledge-deck-template presentation. Use when a user provides lesson material and wants an interactive, chapter-based static deck with a deck manifest, page fragments, and custom modules only where documented page primitives are insufficient.
---

# Courseware To Deck

Read `docs/courseware-input.md` and `deck.json` before creating content. Produce a short deck brief with audience, narrative arc, claims, and evidence before editing pages.

Use the documented primitives first: cover, narrative, comparison, process, timeline, chart, architecture, decision matrix, and summary. Keep the manifest as the only page order and metadata source. Generate a custom module only for an interaction that a primitive cannot represent; export `init`, attach listeners within it, and return cleanup.

Run `npm run check`, serve through HTTP, and inspect desktop plus mobile before handing off. Do not add a framework, backend, or runtime LLM dependency.
