import { Wall } from './Wall.js';
import { Character } from './Character.js';
import { SoundSource } from './SoundSource.js';

export class Maze {
    constructor(data = {}) {
        this.id = data.id || `maze_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.width = data.width ?? 600;
        this.height = data.height ?? 600;
        this.gridSize = data.gridSize ?? 30;
        this.walls = (data.walls || []).map(w => new Wall(w));
        this.characters = (data.characters || []).map(c => new Character(c));
        this.soundSources = (data.soundSources || []).map(s => new SoundSource(s));
        this.hazards = data.hazards || [];
        this.boundaries = data.boundaries ?? true;
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = data.updatedAt || Date.now();
        this.version = data.version ?? 1;
        this.source = data.source || 'manual';
        
        if (this.boundaries) {
            this.addBoundaryWalls();
        }
    }

    addBoundaryWalls() {
        const existingIds = this.walls.map(w => w.id);
        const boundaries = [
            { x1: 0, y1: 0, x2: this.width, y2: 0, material: 'hard', addedInBatch: 'boundary' },
            { x1: this.width, y1: 0, x2: this.width, y2: this.height, material: 'hard', addedInBatch: 'boundary' },
            { x1: this.width, y1: this.height, x2: 0, y2: this.height, material: 'hard', addedInBatch: 'boundary' },
            { x1: 0, y1: this.height, x2: 0, y2: 0, material: 'hard', addedInBatch: 'boundary' }
        ];
        
        boundaries.forEach((b, i) => {
            const id = `boundary_${i}`;
            if (!existingIds.includes(id)) {
                this.walls.push(new Wall({ ...b, id }));
            }
        });
    }

    getPlayer() {
        return this.characters.find(c => c.type === 'player' && c.status === 'active');
    }

    getTrappedTeammates() {
        return this.characters.filter(c => c.type === 'teammate' && c.status === 'trapped');
    }

    getRescuedTeammates() {
        return this.characters.filter(c => c.type === 'teammate' && c.status === 'rescued');
    }

    addWall(wallData) {
        const wall = new Wall(wallData);
        this.walls.push(wall);
        this.updatedAt = Date.now();
        return wall;
    }

    removeWall(wallId) {
        const index = this.walls.findIndex(w => w.id === wallId);
        if (index > -1) {
            const wall = this.walls[index];
            this.walls.splice(index, 1);
            this.updatedAt = Date.now();
            return wall;
        }
        return null;
    }

    updateWall(wallId, updates) {
        const wall = this.walls.find(w => w.id === wallId);
        if (wall) {
            Object.assign(wall, updates);
            wall.updatedAt = Date.now();
            this.updatedAt = Date.now();
            return wall;
        }
        return null;
    }

    addCharacter(characterData) {
        const character = new Character(characterData);
        this.characters.push(character);
        this.updatedAt = Date.now();
        return character;
    }

    removeCharacter(characterId) {
        const index = this.characters.findIndex(c => c.id === characterId);
        if (index > -1) {
            const character = this.characters[index];
            this.characters.splice(index, 1);
            this.updatedAt = Date.now();
            return character;
        }
        return null;
    }

    addSoundSource(sourceData) {
        const source = new SoundSource(sourceData);
        this.soundSources.push(source);
        this.updatedAt = Date.now();
        return source;
    }

    removeSoundSource(sourceId) {
        const index = this.soundSources.findIndex(s => s.id === sourceId);
        if (index > -1) {
            const source = this.soundSources[index];
            this.soundSources.splice(index, 1);
            this.updatedAt = Date.now();
            return source;
        }
        return null;
    }

    isPointInBounds(x, y, margin = 0) {
        return x >= margin && x <= this.width - margin &&
               y >= margin && y <= this.height - margin;
    }

    getWallsByBatch(batchId) {
        return this.walls.filter(w => w.addedInBatch === batchId);
    }

    getCharactersByBatch(batchId) {
        return this.characters.filter(c => c.addedInBatch === batchId);
    }

    getSoundSourcesByBatch(batchId) {
        return this.soundSources.filter(s => s.addedInBatch === batchId);
    }

    getEntityById(id) {
        return this.walls.find(w => w.id === id) ||
               this.characters.find(c => c.id === id) ||
               this.soundSources.find(s => s.id === id);
    }

    toJSON() {
        return {
            id: this.id,
            width: this.width,
            height: this.height,
            gridSize: this.gridSize,
            walls: this.walls.map(w => w.toJSON()),
            characters: this.characters.map(c => c.toJSON()),
            soundSources: this.soundSources.map(s => s.toJSON()),
            hazards: [...this.hazards],
            boundaries: this.boundaries,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            version: this.version,
            source: this.source
        };
    }

    clone() {
        return new Maze(this.toJSON());
    }

    equals(other) {
        if (!(other instanceof Maze)) return false;
        if (this.walls.length !== other.walls.length) return false;
        if (this.characters.length !== other.characters.length) return false;
        if (this.soundSources.length !== other.soundSources.length) return false;
        
        for (let i = 0; i < this.walls.length; i++) {
            if (!this.walls[i].equals(other.walls[i])) return false;
        }
        for (let i = 0; i < this.characters.length; i++) {
            if (!this.characters[i].equals(other.characters[i])) return false;
        }
        for (let i = 0; i < this.soundSources.length; i++) {
            if (!this.soundSources[i].equals(other.soundSources[i])) return false;
        }
        
        return true;
    }

    static generateId() {
        return `maze_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
