import type { Artwork, Obstacle, Wall } from '@/types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function artworkToRect(artwork: Artwork): Rect {
  return { x: artwork.posX, y: artwork.posY, width: artwork.frameWidth, height: artwork.frameHeight };
}

export function obstacleToRect(obstacle: Obstacle): Rect {
  return { x: obstacle.posX, y: obstacle.posY, width: obstacle.width, height: obstacle.height };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

export function calculateArtworkPosition(
  artwork: Pick<Artwork, 'frameWidth' | 'frameHeight' | 'orderIndex'>,
  wall: Wall,
  existingArtworks: Artwork[],
  obstacles: Obstacle[]
): { posX: number; posY: number; centerHeight: number; sightLineDeviation: number } {
  const idealCenterY = wall.sightLineHeight;
  let posX = 10;
  const spacing = 20;

  for (const existing of existingArtworks) {
    const existingRight = existing.posX + existing.frameWidth;
    posX = Math.max(posX, existingRight + spacing);
  }

  let posY = idealCenterY - artwork.frameHeight / 2;
  let attempts = 0;
  const maxAttempts = 50;

  const candidateRect = (): Rect => ({
    x: posX,
    y: posY,
    width: artwork.frameWidth,
    height: artwork.frameHeight,
  });

  while (attempts < maxAttempts) {
    let collided = false;

    for (const obs of obstacles) {
      if (rectsOverlap(candidateRect(), obstacleToRect(obs))) {
        posY = obs.posY - artwork.frameHeight - 5;
        collided = true;
        break;
      }
    }

    if (!collided) {
      for (const existing of existingArtworks) {
        if (rectsOverlap(candidateRect(), artworkToRect(existing))) {
          posY = Math.min(posY, existing.posY - artwork.frameHeight - 5);
          collided = true;
          break;
        }
      }
    }

    if (posY < wall.floorOffset) {
      posY = wall.floorOffset;
      break;
    }

    if (!collided) break;
    attempts += 1;
  }

  const centerHeight = posY + artwork.frameHeight / 2;
  const sightLineDeviation = centerHeight - idealCenterY;

  return { posX, posY, centerHeight, sightLineDeviation };
}

export function detectCollisions(
  artworks: Artwork[],
  obstacles: Obstacle[]
): Map<string, string[]> {
  const collisionMap = new Map<string, string[]>();

  for (let i = 0; i < artworks.length; i++) {
    for (let j = i + 1; j < artworks.length; j++) {
      if (rectsOverlap(artworkToRect(artworks[i]), artworkToRect(artworks[j]))) {
        const a = collisionMap.get(artworks[i].id) || [];
        a.push(artworks[j].id);
        collisionMap.set(artworks[i].id, a);
        const b = collisionMap.get(artworks[j].id) || [];
        b.push(artworks[i].id);
        collisionMap.set(artworks[j].id, b);
      }
    }
  }

  for (const artwork of artworks) {
    for (const obs of obstacles) {
      if (rectsOverlap(artworkToRect(artwork), obstacleToRect(obs))) {
        const existing = collisionMap.get(artwork.id) || [];
        existing.push(`obstacle:${obs.id}`);
        collisionMap.set(artwork.id, existing);
      }
    }
  }

  return collisionMap;
}

export function checkSightLineDeviation(artwork: Artwork, wall: Wall): number {
  const centerHeight = artwork.posY + artwork.frameHeight / 2;
  return centerHeight - wall.sightLineHeight;
}
