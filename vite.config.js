import { defineConfig } from 'vite';

// Relative asset paths, so the build runs from any folder (itch.io serves games from a subpath).
export default defineConfig({ base: './' });
