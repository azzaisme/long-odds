import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import { View } from './view.js';
import { Sound } from './audio.js';
import { Game } from './game.js';
import { loadSprites } from './sprites.js';

await Promise.all([document.fonts.load('700 32px "Pixelify Sans"'), document.fonts.load('14px "IBM Plex Mono"')]).catch(() => {});
const view = new View(document.getElementById('game'), await loadSprites());
const game = new Game(view, new Sound());
window.longOdds = game; // handy for inspection from the console
