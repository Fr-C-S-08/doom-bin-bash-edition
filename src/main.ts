import Phaser from 'phaser';
import { gameConfig } from './game/config';
import { bootstrapGameSave } from './game/save/SaveManager';
import { initPwaInstallPrompt, registerServiceWorker } from './pwa/installPrompt';
import './styles.css';

bootstrapGameSave();
void registerServiceWorker();
initPwaInstallPrompt();

new Phaser.Game(gameConfig);
