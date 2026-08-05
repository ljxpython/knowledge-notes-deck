# Custom Page Modules

Use a custom module only when the documented page primitives cannot communicate the lesson. Add the module path to the page entry in `deck.json`.

```js
export function init({ root, page, deck }) {
  const handler = () => {};
  root.querySelector('button').addEventListener('click', handler);
  return () => root.querySelector('button').removeEventListener('click', handler);
}
```

`init` receives the rendered page root. It may return cleanup; cleanup MUST stop timers, cancel animation frames, and remove listeners. Do not add executable inline scripts to page fragments.
