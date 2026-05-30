export class Wall {
    constructor(data = {}) {
        this.id = data.id || `wall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.x1 = data.x1 ?? 0;
        this.y1 = data.y1 ?? 0;
        this.x2 = data.x2 ?? 0;
        this.y2 = data.y2 ?? 0;
        this.material = data.material || 'hard';
        this.reflectionCoefficient = data.reflectionCoefficient ?? this.getDefaultReflection();
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = data.updatedAt || Date.now();
        this.addedInBatch = data.addedInBatch || 'initial';
        this.notes = data.notes || '';
    }

    getDefaultReflection() {
        const coefficients = {
            hard: 0.95,
            soft: 0.6,
            absorbent: 0.1
        };
        return coefficients[this.material] ?? 0.95;
    }

    getLength() {
        return Math.sqrt(Math.pow(this.x2 - this.x1, 2) + Math.pow(this.y2 - this.y1, 2));
    }

    getAngle() {
        return Math.atan2(this.y2 - this.y1, this.x2 - this.x1);
    }

    getNormal() {
        const dx = this.x2 - this.x1;
        const dy = this.y2 - this.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        return { x: -dy / len, y: dx / len };
    }

    toJSON() {
        return {
            id: this.id,
            x1: this.x1,
            y1: this.y1,
            x2: this.x2,
            y2: this.y2,
            material: this.material,
            reflectionCoefficient: this.reflectionCoefficient,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            addedInBatch: this.addedInBatch,
            notes: this.notes
        };
    }

    clone() {
        return new Wall(this.toJSON());
    }

    equals(other) {
        if (!(other instanceof Wall)) return false;
        return Math.abs(this.x1 - other.x1) < 0.001 &&
               Math.abs(this.y1 - other.y1) < 0.001 &&
               Math.abs(this.x2 - other.x2) < 0.001 &&
               Math.abs(this.y2 - other.y2) < 0.001 &&
               this.material === other.material;
    }

    static generateId() {
        return `wall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
