export class Character {
    constructor(data = {}) {
        this.id = data.id || `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = data.type || 'player';
        this.x = data.x ?? 50;
        this.y = data.y ?? 50;
        this.status = data.status || (this.type === 'teammate' ? 'trapped' : 'active');
        this.health = data.health ?? 100;
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

    move(dx, dy) {
        this.x += dx;
        this.y += dy;
        this.updatedAt = Date.now();
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this.updatedAt = Date.now();
        if (this.health <= 0) {
            this.status = this.type === 'teammate' ? 'lost' : 'defeated';
        }
        return this.health;
    }

    heal(amount) {
        this.health = Math.min(100, this.health + amount);
        this.updatedAt = Date.now();
        return this.health;
    }

    rescue() {
        if (this.type === 'teammate' && this.status === 'trapped') {
            this.status = 'rescued';
            this.updatedAt = Date.now();
            return true;
        }
        return false;
    }

    distanceTo(other) {
        return Math.sqrt(Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2));
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            status: this.status,
            health: this.health,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            addedInBatch: this.addedInBatch,
            notes: this.notes
        };
    }

    clone() {
        return new Character(this.toJSON());
    }

    equals(other) {
        if (!(other instanceof Character)) return false;
        return Math.abs(this.x - other.x) < 0.001 &&
               Math.abs(this.y - other.y) < 0.001 &&
               this.type === other.type &&
               this.status === other.status;
    }

    static generateId() {
        return `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
