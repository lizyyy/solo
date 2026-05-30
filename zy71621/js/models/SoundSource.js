export class SoundSource {
    constructor(data = {}) {
        this.id = data.id || `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.x = data.x ?? 50;
        this.y = data.y ?? 50;
        this.direction = data.direction ?? 0;
        this.frequency = data.frequency ?? 2000;
        this.amplitude = data.amplitude ?? 1.0;
        this.pulseDuration = data.pulseDuration ?? 50;
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = data.updatedAt || Date.now();
        this.addedInBatch = data.addedInBatch || 'initial';
        this.notes = data.notes || '';
    }

    getPosition() {
        return { x: this.x, y: this.y };
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.updatedAt = Date.now();
    }

    getDirectionRadians() {
        return (this.direction * Math.PI) / 180;
    }

    getWavelength(soundSpeed = 343) {
        return soundSpeed / this.frequency;
    }

    getPeriod() {
        return 1 / this.frequency;
    }

    toJSON() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            direction: this.direction,
            frequency: this.frequency,
            amplitude: this.amplitude,
            pulseDuration: this.pulseDuration,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            addedInBatch: this.addedInBatch,
            notes: this.notes
        };
    }

    clone() {
        return new SoundSource(this.toJSON());
    }

    equals(other) {
        if (!(other instanceof SoundSource)) return false;
        return Math.abs(this.x - other.x) < 0.001 &&
               Math.abs(this.y - other.y) < 0.001 &&
               Math.abs(this.direction - other.direction) < 0.001 &&
               Math.abs(this.frequency - other.frequency) < 0.001 &&
               Math.abs(this.amplitude - other.amplitude) < 0.001;
    }

    static generateId() {
        return `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
