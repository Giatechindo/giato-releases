// Re-renders any <i data-lucide="..."> placeholders added to the DOM after the initial page render
// (lucide only scans the DOM once on its own script load). Every module that injects icon markup via
// innerHTML calls this afterwards.
export function renderIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}
