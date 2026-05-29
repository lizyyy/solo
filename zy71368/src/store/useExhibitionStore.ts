import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Wall, Artwork, Obstacle, HistoryEntry, HistoryAction, HistoryEntityType, HistorySource } from '@/types';
import { generateId } from '@/utils/id';
import { calculateArtworkPosition, detectCollisions } from '@/utils/calculation';

interface ExhibitionState {
  wall: Wall;
  artworks: Artwork[];
  obstacles: Obstacle[];
  history: HistoryEntry[];

  updateWall: (updates: Partial<Wall>, source?: HistorySource) => void;
  addArtwork: (artwork: Omit<Artwork, 'id' | 'wallId' | 'posX' | 'posY' | 'centerHeight' | 'sightLineDeviation' | 'hasCollision' | 'collisionWith' | 'createdAt' | 'updatedAt'>) => void;
  updateArtwork: (id: string, updates: Partial<Artwork>, source?: HistorySource) => void;
  removeArtwork: (id: string) => void;
  addObstacle: (obstacle: Omit<Obstacle, 'id' | 'wallId' | 'createdAt' | 'updatedAt'>) => void;
  updateObstacle: (id: string, updates: Partial<Obstacle>, source?: HistorySource) => void;
  removeObstacle: (id: string) => void;
  calculateAll: () => void;
  moveArtwork: (id: string, posX: number, posY: number) => void;
  clearHistory: () => void;
}

function now(): string {
  return new Date().toISOString();
}

function addHistory(
  history: HistoryEntry[],
  entityType: HistoryEntityType,
  entityId: string,
  action: HistoryAction,
  field: string,
  oldValue: string,
  newValue: string,
  source: HistorySource
): HistoryEntry[] {
  return [
    {
      id: generateId(),
      entityType,
      entityId,
      action,
      field,
      oldValue,
      newValue,
      source,
      timestamp: now(),
    },
    ...history,
  ];
}

const defaultWall: Wall = {
  id: 'default-wall',
  width: 600,
  height: 350,
  floorOffset: 0,
  sightLineHeight: 160,
  createdAt: now(),
  updatedAt: now(),
};

export const useExhibitionStore = create<ExhibitionState>()(
  persist(
    (set, get) => ({
      wall: defaultWall,
      artworks: [],
      obstacles: [],
      history: [],

      updateWall: (updates, source = 'user') => {
        const state = get();
        const oldWall = state.wall;
        const newWall = { ...oldWall, ...updates, updatedAt: now() };
        let history = state.history;

        for (const [key, value] of Object.entries(updates)) {
          if (key === 'updatedAt') continue;
          const oldVal = String(oldWall[key as keyof Wall] ?? '');
          const newVal = String(value);
          if (oldVal !== newVal) {
            history = addHistory(history, 'wall', oldWall.id, 'update', key, oldVal, newVal, source);
          }
        }

        set({ wall: newWall, history });
      },

      addArtwork: (artworkInput) => {
        const state = get();
        const id = generateId();
        const wall = state.wall;
        const pos = calculateArtworkPosition(artworkInput, wall, state.artworks, state.obstacles);

        const newArtwork: Artwork = {
          ...artworkInput,
          id,
          wallId: wall.id,
          posX: pos.posX,
          posY: pos.posY,
          centerHeight: pos.centerHeight,
          sightLineDeviation: pos.sightLineDeviation,
          hasCollision: false,
          collisionWith: [],
          createdAt: now(),
          updatedAt: now(),
        };

        let history = addHistory(
          state.history,
          'artwork',
          id,
          'create',
          'name',
          '',
          artworkInput.name,
          'user'
        );

        const artworks = [...state.artworks, newArtwork];
        const collisions = detectCollisions(artworks, state.obstacles);
        const updatedArtworks = artworks.map((a) => ({
          ...a,
          hasCollision: collisions.has(a.id) && collisions.get(a.id)!.length > 0,
          collisionWith: collisions.get(a.id) || [],
          updatedAt: now(),
        }));

        set({ artworks: updatedArtworks, history });
      },

      updateArtwork: (id, updates, source = 'user') => {
        const state = get();
        const oldArtwork = state.artworks.find((a) => a.id === id);
        if (!oldArtwork) return;

        const newArtwork = { ...oldArtwork, ...updates, updatedAt: now() };
        let history = state.history;

        for (const [key, value] of Object.entries(updates)) {
          if (key === 'updatedAt' || key === 'hasCollision' || key === 'collisionWith') continue;
          const oldVal = String(oldArtwork[key as keyof Artwork] ?? '');
          const newVal = String(value);
          if (oldVal !== newVal) {
            const action: HistoryAction = source === 'auto_calc' ? 'auto_calc' : source === 'collision_fix' ? 'collision_fix' : 'update';
            history = addHistory(history, 'artwork', id, action, key, oldVal, newVal, source);
          }
        }

        const artworks = state.artworks.map((a) => (a.id === id ? newArtwork : a));
        const collisions = detectCollisions(artworks, state.obstacles);
        const updatedArtworks = artworks.map((a) => ({
          ...a,
          hasCollision: collisions.has(a.id) && collisions.get(a.id)!.length > 0,
          collisionWith: collisions.get(a.id) || [],
          updatedAt: now(),
        }));

        set({ artworks: updatedArtworks, history });
      },

      removeArtwork: (id) => {
        const state = get();
        const artwork = state.artworks.find((a) => a.id === id);
        if (!artwork) return;

        const history = addHistory(
          state.history,
          'artwork',
          id,
          'delete',
          'name',
          artwork.name,
          '',
          'user'
        );

        const artworks = state.artworks.filter((a) => a.id !== id);
        const collisions = detectCollisions(artworks, state.obstacles);
        const updatedArtworks = artworks.map((a) => ({
          ...a,
          hasCollision: collisions.has(a.id) && collisions.get(a.id)!.length > 0,
          collisionWith: collisions.get(a.id) || [],
          updatedAt: now(),
        }));

        set({ artworks: updatedArtworks, history });
      },

      addObstacle: (obstacleInput) => {
        const state = get();
        const id = generateId();
        const newObstacle: Obstacle = {
          ...obstacleInput,
          id,
          wallId: state.wall.id,
          createdAt: now(),
          updatedAt: now(),
        };

        const history = addHistory(
          state.history,
          'obstacle',
          id,
          'create',
          'name',
          '',
          obstacleInput.name,
          'user'
        );

        const obstacles = [...state.obstacles, newObstacle];
        const collisions = detectCollisions(state.artworks, obstacles);
        const updatedArtworks = state.artworks.map((a) => ({
          ...a,
          hasCollision: collisions.has(a.id) && collisions.get(a.id)!.length > 0,
          collisionWith: collisions.get(a.id) || [],
          updatedAt: now(),
        }));

        set({ obstacles, artworks: updatedArtworks, history });
      },

      updateObstacle: (id, updates, source = 'user') => {
        const state = get();
        const oldObstacle = state.obstacles.find((o) => o.id === id);
        if (!oldObstacle) return;

        const newObstacle = { ...oldObstacle, ...updates, updatedAt: now() };
        let history = state.history;

        for (const [key, value] of Object.entries(updates)) {
          if (key === 'updatedAt') continue;
          const oldVal = String(oldObstacle[key as keyof Obstacle] ?? '');
          const newVal = String(value);
          if (oldVal !== newVal) {
            history = addHistory(history, 'obstacle', id, 'update', key, oldVal, newVal, source);
          }
        }

        const obstacles = state.obstacles.map((o) => (o.id === id ? newObstacle : o));
        const collisions = detectCollisions(state.artworks, obstacles);
        const updatedArtworks = state.artworks.map((a) => ({
          ...a,
          hasCollision: collisions.has(a.id) && collisions.get(a.id)!.length > 0,
          collisionWith: collisions.get(a.id) || [],
          updatedAt: now(),
        }));

        set({ obstacles, artworks: updatedArtworks, history });
      },

      removeObstacle: (id) => {
        const state = get();
        const obstacle = state.obstacles.find((o) => o.id === id);
        if (!obstacle) return;

        const history = addHistory(
          state.history,
          'obstacle',
          id,
          'delete',
          'name',
          obstacle.name,
          '',
          'user'
        );

        const obstacles = state.obstacles.filter((o) => o.id !== id);
        const collisions = detectCollisions(state.artworks, obstacles);
        const updatedArtworks = state.artworks.map((a) => ({
          ...a,
          hasCollision: collisions.has(a.id) && collisions.get(a.id)!.length > 0,
          collisionWith: collisions.get(a.id) || [],
          updatedAt: now(),
        }));

        set({ obstacles, artworks: updatedArtworks, history });
      },

      calculateAll: () => {
        const state = get();
        const wall = state.wall;
        const sortedArtworks = [...state.artworks].sort((a, b) => a.orderIndex - b.orderIndex);
        const recalculated: Artwork[] = [];
        let history = state.history;

        for (const artwork of sortedArtworks) {
          const pos = calculateArtworkPosition(artwork, wall, recalculated, state.obstacles);
          const oldPosX = String(artwork.posX);
          const oldPosY = String(artwork.posY);
          const newPosX = String(pos.posX);
          const newPosY = String(pos.posY);

          if (oldPosX !== newPosX) {
            history = addHistory(history, 'artwork', artwork.id, 'auto_calc', 'posX', oldPosX, newPosX, 'auto_calc');
          }
          if (oldPosY !== newPosY) {
            history = addHistory(history, 'artwork', artwork.id, 'auto_calc', 'posY', oldPosY, newPosY, 'auto_calc');
          }
          const oldDev = String(artwork.sightLineDeviation);
          const newDev = String(pos.sightLineDeviation);
          if (oldDev !== newDev) {
            history = addHistory(history, 'artwork', artwork.id, 'auto_calc', 'sightLineDeviation', oldDev, newDev, 'auto_calc');
          }

          recalculated.push({
            ...artwork,
            posX: pos.posX,
            posY: pos.posY,
            centerHeight: pos.centerHeight,
            sightLineDeviation: pos.sightLineDeviation,
            updatedAt: now(),
          });
        }

        const collisions = detectCollisions(recalculated, state.obstacles);
        const updatedArtworks = recalculated.map((a) => ({
          ...a,
          hasCollision: collisions.has(a.id) && collisions.get(a.id)!.length > 0,
          collisionWith: collisions.get(a.id) || [],
          updatedAt: now(),
        }));

        set({ artworks: updatedArtworks, history });
      },

      moveArtwork: (id, posX, posY) => {
        const state = get();
        const oldArtwork = state.artworks.find((a) => a.id === id);
        if (!oldArtwork) return;

        let history = state.history;
        if (String(oldArtwork.posX) !== String(posX)) {
          history = addHistory(history, 'artwork', id, 'update', 'posX', String(oldArtwork.posX), String(posX), 'drag');
        }
        if (String(oldArtwork.posY) !== String(posY)) {
          history = addHistory(history, 'artwork', id, 'update', 'posY', String(oldArtwork.posY), String(posY), 'drag');
        }

        const artworks = state.artworks.map((a) =>
          a.id === id
            ? {
                ...a,
                posX,
                posY,
                centerHeight: posY + a.frameHeight / 2,
                sightLineDeviation: posY + a.frameHeight / 2 - state.wall.sightLineHeight,
                updatedAt: now(),
              }
            : a
        );

        const collisions = detectCollisions(artworks, state.obstacles);
        const updatedArtworks = artworks.map((a) => ({
          ...a,
          hasCollision: collisions.has(a.id) && collisions.get(a.id)!.length > 0,
          collisionWith: collisions.get(a.id) || [],
          updatedAt: now(),
        }));

        set({ artworks: updatedArtworks, history });
      },

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'exhibition-store',
    }
  )
);
