import {
  GameDirector,
  type GameDirectorDecision,
  type GameDirectorInput,
  type SpawnRequest,
  type SpawnPoint
} from '../../src/game/systems/GameDirector.js';
import type { DirectorConfig } from '../../src/game/systems/DirectorConfig.js';

export class DirectorSystem {
  private readonly director: GameDirector;

  constructor(config?: Partial<DirectorConfig>, spawnPoints?: SpawnPoint[]) {
    this.director = new GameDirector({ config, spawnPoints });
  }

  createOpeningSpawns(): SpawnRequest[] {
    return this.director.createOpeningSpawns();
  }

  update(input: GameDirectorInput): GameDirectorDecision {
    return this.director.update(input);
  }
}
