import { loadMissions } from './schema.js';

// Vite includes every matching preset in development and production builds.
const presets = import.meta.glob('./presets/*.json', { eager: true, import: 'default' });
export const missions = loadMissions(Object.values(presets));

