import { createLegacyEngine } from './legacy-engine.js';
import { createEnhancedEngine } from './enhanced-engine.js';

function getEngineNameFromEnv() {
  // URL param has priority
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('engine');
    if (q === 'legacy' || q === 'enhanced') return q;
  } catch {}
  // Local storage fallback
  try {
    const v = localStorage.getItem('pdf-engine');
    if (v === 'legacy' || v === 'enhanced') return v;
  } catch {}
  return 'legacy';
}

export function createEngine(app) {
  const name = getEngineNameFromEnv();
  console.log(`[Engine] Selected engine: ${name}`);
  return name === 'enhanced' ? createEnhancedEngine(app) : createLegacyEngine(app);
}
