# Knowledge Notes Deck

A 13-page technical presentation built from the [knowledge-notes](https://github.com/ljxpython/knowledge-notes) reading site. It turns the site's three content collections into an interactive, chapter-based deck covering LangGraph/LangChain engineering, LangChain v1 Agents, and Deep Agents.

Live demo: https://ljxpython.github.io/knowledge-notes-deck/

This repository is for technical demos and reports. It complements the long-form reading site and does not replace it.

## Start A New Deck

Select **Use this template** on GitHub, then update `deck.json`, `source/`, and `pages/`. Serve the project through HTTP because the player fetches page fragments:

```bash
python3 -m http.server 8753
```

Open `http://localhost:8753/`.

## What Changes Per Deck

- `source/lesson.md`: the structured courseware source.
- `deck.json`: title, sections, page order, page types, and optional module paths.
- `pages/*.html`: generated or authored page fragments.
- `modules/*.js`: only for interactions that the page primitives cannot represent.

The player, CSS tokens, controls, annotation canvases, and validation scripts are reusable infrastructure. Do not place another course's source material in the template's default sample.

See `docs/custom-modules.md` for the required custom-interaction cleanup contract.

## Checks

```bash
npm run check
```

No package installation is required for the checks. Browser animation uses GSAP from CDN; vendor it locally only when offline delivery is required.

## Deployment

Pushes to `main` deploy automatically to GitHub Pages through `.github/workflows/pages.yml`.

## License

MIT. The sample content is original demonstration material.
