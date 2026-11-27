import { View } from './view.js';
import { Sound } from './audio.js';
import { Game } from './game.js';

const view = new View(document.getElementById('game'));
const game = new Game(view, new Sound());
window.longOdds = game; // handy for inspection from the console
