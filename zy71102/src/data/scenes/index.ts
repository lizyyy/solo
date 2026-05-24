import { StationScene } from '../../simulation/types';
import { normalScene } from './normalScene';
import { conflictScene } from './conflictScene';
import { emptyScene } from './emptyScene';

export const scenes: StationScene[] = [normalScene, conflictScene, emptyScene];

export const getSceneById = (id: string): StationScene | undefined => {
  return scenes.find(scene => scene.id === id);
};
