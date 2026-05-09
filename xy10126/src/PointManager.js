export class PointManager {
    constructor() {
        this.points = new Map();
        this.nextId = 1;
    }
    
    addPoint(x, y, z, name = null, type = 'normal') {
        const id = this.nextId++;
        const point = {
            id,
            x,
            y,
            z,
            name: name || `P${id}`,
            type,
            isVisited: false,
            isMarked: false,
            markReason: ''
        };
        this.points.set(id, point);
        return point;
    }
    
    addRandomPoint() {
        const x = (Math.random() - 0.5) * 90;
        const y = Math.random() * 18;
        const z = (Math.random() - 0.5) * 90;
        return this.addPoint(x, y, z);
    }
    
    getPoint(id) {
        return this.points.get(id);
    }
    
    getAllPoints() {
        return Array.from(this.points.values());
    }
    
    updatePointPosition(id, x, y, z) {
        const point = this.points.get(id);
        if (point) {
            point.x = x;
            point.y = y;
            point.z = z;
            return point;
        }
        return null;
    }
    
    removePoint(id) {
        this.points.delete(id);
    }
    
    clearAllPoints() {
        this.points.clear();
        this.nextId = 1;
    }
    
    markPoint(id, reason = '') {
        const point = this.points.get(id);
        if (point) {
            point.isMarked = true;
            point.markReason = reason || `异常标记 - 点位 ${point.name}`;
            return point;
        }
        return null;
    }
    
    unmarkPoint(id) {
        const point = this.points.get(id);
        if (point) {
            point.isMarked = false;
            point.markReason = '';
            return point;
        }
        return null;
    }
    
    clearMarks() {
        this.points.forEach(point => {
            point.isMarked = false;
            point.markReason = '';
        });
    }
    
    setPointVisited(id, visited = true) {
        const point = this.points.get(id);
        if (point) {
            point.isVisited = visited;
            return point;
        }
        return null;
    }
    
    resetAllVisited() {
        this.points.forEach(point => {
            point.isVisited = false;
        });
    }
    
    getMarkedPoints() {
        return this.getAllPoints().filter(p => p.isMarked);
    }
    
    getUnvisitedPoints() {
        return this.getAllPoints().filter(p => !p.isVisited);
    }
    
    getCount() {
        return this.points.size;
    }
    
    generateDemoData() {
        this.clearAllPoints();
        
        const pipeline1 = [
            { x: -40, y: 5, z: -40 },
            { x: -20, y: 5, z: -35 },
            { x: 0, y: 5, z: -30 },
            { x: 20, y: 5, z: -25 },
            { x: 40, y: 5, z: -20 }
        ];
        
        const pipeline2 = [
            { x: -40, y: 10, z: 0 },
            { x: -20, y: 10, z: 0 },
            { x: 0, y: 10, z: 0 },
            { x: 20, y: 10, z: 0 },
            { x: 40, y: 10, z: 0 }
        ];
        
        const pipeline3 = [
            { x: -40, y: 15, z: 40 },
            { x: -20, y: 15, z: 35 },
            { x: 0, y: 15, z: 30 },
            { x: 20, y: 15, z: 25 },
            { x: 40, y: 15, z: 20 }
        ];
        
        const allPipelines = [pipeline1, pipeline2, pipeline3];
        const names = ['给水管', '燃气管', '排水管'];
        
        allPipelines.forEach((pipeline, idx) => {
            pipeline.forEach((pos, pIdx) => {
                this.addPoint(
                    pos.x,
                    pos.y,
                    pos.z,
                    `${names[idx]}-${pIdx + 1}`
                );
            });
        });
        
        return this.getAllPoints();
    }
    
    exportData() {
        return {
            points: this.getAllPoints(),
            nextId: this.nextId
        };
    }
    
    importData(data) {
        this.points.clear();
        data.points.forEach(p => {
            this.points.set(p.id, { ...p });
        });
        this.nextId = data.nextId;
    }
}