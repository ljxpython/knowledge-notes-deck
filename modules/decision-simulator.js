export function init({ root }) {
  const button = root.querySelector('[data-simulate]'); const state = root.querySelector('[data-state]'); const detail = root.querySelector('[data-detail]');
  const steps = [['MODEL', 'Define the model behavior the task needs.'], ['TOOL', 'Choose one tool signal that can change the path.'], ['STATE', 'Record the resulting state and review trigger.']]; let index = 0;
  function advance() { const [label, text] = steps[index]; state.textContent = label; detail.textContent = text; button.textContent = index === steps.length - 1 ? 'Restart test' : 'Test next signal'; index = (index + 1) % steps.length; if (window.gsap) gsap.fromTo(state, { opacity: .2, y: 8 }, { opacity: 1, y: 0, duration: .28 }); }
  button.addEventListener('click', advance); return () => button.removeEventListener('click', advance);
}
