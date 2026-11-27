import { View } from './view.js';
import { Sound } from './audio.js';
import { Game } from './game.js';
import { loadSprites } from './sprites.js';

const view = new View(document.getElementById('game'), await loadSprites());
const game = new Game(view, new Sound());
window.longOdds = game; // handy for inspection from the console
