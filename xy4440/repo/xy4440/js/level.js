/**
 * 关卡管理模块
 */

(function() {
    const OBJECT_TYPE = window.constants.OBJECT_TYPE;
    const GAME = window.constants.GAME;
    const River = window.objects.River;
    const Shallow = window.objects.Shallow;
    const Student = window.objects.Student;
    const Boat = window.objects.Boat;
    const Rope = window.objects.Rope;
    const SafeZone = window.objects.SafeZone;

// 关卡管理器类
class LevelManager {
    constructor(game) {
        this.game = game;
        this.currentLevel = null;
        this.levels = [];
    }
    
    // 从JSON加载关卡
    loadFromJSON(jsonData) {
        try {
            const levelData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            // 验证关卡数据
            if (!this.validateLevelData(levelData)) {
                throw new Error('关卡数据格式不正确');
            }
            
            // 创建关卡对象
            const level = this.createLevelFromData(levelData);
            
            // 设置为当前关卡
            this.currentLevel = level;
            
            // 将关卡添加到游戏中
            this.applyLevelToGame(level);
            
            return level;
        } catch (error) {
            console.error('加载关卡失败:', error);
            throw error;
        }
    }
    
    // 验证关卡数据
    validateLevelData(data) {
        if (!data || typeof data !== 'object') return false;
        if (!data.id || !data.name) return false;
        if (!data.river && !data.rivers) return false;
        if (!data.students || !Array.isArray(data.students)) return false;
        if (!data.boats || !Array.isArray(data.boats)) return false;
        if (!data.safeZones || !Array.isArray(data.safeZones)) return false;
        
        return true;
    }
    
    // 从数据创建关卡对象
    createLevelFromData(data) {
        const level = {
            id: data.id,
            name: data.name,
            description: data.description || '',
            difficulty: data.difficulty || 'normal',
            timeLimit: data.timeLimit || GAME.TIMEOUT_LIMIT,
            maxTurns: data.maxTurns || GAME.MAX_TURNS,
            
            rivers: [],
            shallows: [],
            students: [],
            boats: [],
            ropes: [],
            safeZones: [],
            
            metadata: data.metadata || {
                createdAt: new Date().toISOString(),
                author: 'Unknown'
            }
        };
        
        // 创建河流
        if (data.rivers && Array.isArray(data.rivers)) {
            for (let i = 0; i < data.rivers.length; i++) {
                const riverData = data.rivers[i];
                const river = new River(
                    `river_${i}`,
                    riverData.x || 0,
                    riverData.y || 0,
                    riverData.width || 800,
                    riverData.height || 600,
                    riverData.flowDirection || 0,
                    riverData.flowSpeed || 1.0
                );
                level.rivers.push(river);
            }
        } else if (data.river) {
            // 兼容单个河流的情况
            const river = new River(
                'river_0',
                data.river.x || 0,
                data.river.y || 0,
                data.river.width || 800,
                data.river.height || 600,
                data.river.flowDirection || 0,
                data.river.flowSpeed || 1.0
            );
            level.rivers.push(river);
        }
        
        // 创建浅滩
        if (data.shallows && Array.isArray(data.shallows)) {
            for (let i = 0; i < data.shallows.length; i++) {
                const shallowData = data.shallows[i];
                const shallow = new Shallow(
                    `shallow_${i}`,
                    shallowData.x || 0,
                    shallowData.y || 0,
                    shallowData.width || 100,
                    shallowData.height || 100
                );
                level.shallows.push(shallow);
            }
        }
        
        // 创建学员
        for (let i = 0; i < data.students.length; i++) {
            const studentData = data.students[i];
            const student = new Student(
                `student_${i}`,
                studentData.x || 100,
                studentData.y || 100,
                studentData.name || `学员${i + 1}`
            );
            
            // 设置额外属性
            if (studentData.health !== undefined) {
                student.health = studentData.health;
            }
            
            level.students.push(student);
        }
        
        // 创建救援艇
        for (let i = 0; i < data.boats.length; i++) {
            const boatData = data.boats[i];
            const boat = new Boat(
                `boat_${i}`,
                boatData.x || 50,
                boatData.y || 50,
                boatData.name || `救援艇${i + 1}`
            );
            
            // 设置额外属性
            if (boatData.energy !== undefined) {
                boat.energy = boatData.energy;
            }
            if (boatData.maxPassengers !== undefined) {
                boat.maxPassengers = boatData.maxPassengers;
            }
            
            level.boats.push(boat);
        }
        
        // 创建救援绳
        if (data.ropes && Array.isArray(data.ropes)) {
            for (let i = 0; i < data.ropes.length; i++) {
                const ropeData = data.ropes[i];
                const rope = new Rope(
                    `rope_${i}`,
                    ropeData.startX || 0,
                    ropeData.startY || 0,
                    ropeData.endX || 100,
                    ropeData.endY || 100
                );
                level.ropes.push(rope);
            }
        }
        
        // 创建安全区
        for (let i = 0; i < data.safeZones.length; i++) {
            const safeZoneData = data.safeZones[i];
            const safeZone = new SafeZone(
                `safeZone_${i}`,
                safeZoneData.x || 1000,
                safeZoneData.y || 350
            );
            
            // 设置额外属性
            if (safeZoneData.radius !== undefined) {
                safeZone.radius = safeZoneData.radius;
                safeZone.x = safeZoneData.x - safeZoneData.radius;
                safeZone.y = safeZoneData.y - safeZoneData.radius;
                safeZone.width = safeZoneData.radius * 2;
                safeZone.height = safeZoneData.radius * 2;
            }
            
            level.safeZones.push(safeZone);
        }
        
        return level;
    }
    
    // 将关卡应用到游戏
    applyLevelToGame(level) {
        // 清空游戏中的所有对象
        this.game.clearAllObjects();
        
        // 添加河流
        for (const river of level.rivers) {
            this.game.addRiver(river);
        }
        
        // 添加浅滩
        for (const shallow of level.shallows) {
            this.game.addShallow(shallow);
        }
        
        // 添加学员
        for (const student of level.students) {
            this.game.addStudent(student);
        }
        
        // 添加救援艇
        for (const boat of level.boats) {
            this.game.addBoat(boat);
        }
        
        // 添加救援绳
        for (const rope of level.ropes) {
            this.game.addRope(rope);
        }
        
        // 添加安全区
        for (const safeZone of level.safeZones) {
            this.game.addSafeZone(safeZone);
        }
        
        // 设置游戏参数
        this.game.timeLimit = level.timeLimit;
        this.game.maxTurns = level.maxTurns;
    }
    
    // 获取当前关卡数据
    getCurrentLevelData() {
        if (!this.currentLevel) return null;
        
        return {
            id: this.currentLevel.id,
            name: this.currentLevel.name,
            description: this.currentLevel.description,
            difficulty: this.currentLevel.difficulty,
            timeLimit: this.currentLevel.timeLimit,
            maxTurns: this.currentLevel.maxTurns,
            
            rivers: this.currentLevel.rivers.map(river => river.toJSON()),
            shallows: this.currentLevel.shallows.map(shallow => shallow.toJSON()),
            students: this.currentLevel.students.map(student => student.toJSON()),
            boats: this.currentLevel.boats.map(boat => boat.toJSON()),
            ropes: this.currentLevel.ropes.map(rope => rope.toJSON()),
            safeZones: this.currentLevel.safeZones.map(safeZone => safeZone.toJSON()),
            
            metadata: this.currentLevel.metadata
        };
    }
    
    // 创建示例关卡
    createSampleLevel() {
        const sampleData = {
            id: 'sample_level_001',
            name: '初级救援训练',
            description: '适合初学者的简单救援场景，包含3名落水学员和2艘救援艇',
            difficulty: 'easy',
            timeLimit: 180,
            maxTurns: 20,
            
            rivers: [
                {
                    x: 100,
                    y: 100,
                    width: 1000,
                    height: 500,
                    flowDirection: 90, // 向右流
                    flowSpeed: 1.5
                }
            ],
            
            shallows: [
                {
                    x: 400,
                    y: 200,
                    width: 150,
                    height: 100
                },
                {
                    x: 700,
                    y: 400,
                    width: 200,
                    height: 120
                }
            ],
            
            students: [
                {
                    x: 300,
                    y: 250,
                    name: '学员A',
                    health: 85
                },
                {
                    x: 600,
                    y: 350,
                    name: '学员B',
                    health: 70
                },
                {
                    x: 800,
                    y: 200,
                    name: '学员C',
                    health: 90
                }
            ],
            
            boats: [
                {
                    x: 150,
                    y: 150,
                    name: '救援艇1号',
                    energy: 100,
                    maxPassengers: 2
                },
                {
                    x: 150,
                    y: 450,
                    name: '救援艇2号',
                    energy: 100,
                    maxPassengers: 2
                }
            ],
            
            ropes: [
                {
                    startX: 500,
                    startY: 100,
                    endX: 500,
                    endY: 600
                }
            ],
            
            safeZones: [
                {
                    x: 1050,
                    y: 350,
                    radius: 60
                }
            ],
            
            metadata: {
                createdAt: new Date().toISOString(),
                author: '系统',
                tags: ['初级', '训练', '多人救援']
            }
        };
        
        return this.loadFromJSON(sampleData);
    }
    
    // 导出关卡为JSON字符串
    exportLevelToJSON(level) {
        const levelData = level || this.currentLevel;
        if (!levelData) return null;
        
        return JSON.stringify({
            id: levelData.id,
            name: levelData.name,
            description: levelData.description,
            difficulty: levelData.difficulty,
            timeLimit: levelData.timeLimit,
            maxTurns: levelData.maxTurns,
            
            rivers: levelData.rivers.map(river => ({
                x: river.x,
                y: river.y,
                width: river.width,
                height: river.height,
                flowDirection: river.flowDirection,
                flowSpeed: river.flowSpeed
            })),
            
            shallows: levelData.shallows.map(shallow => ({
                x: shallow.x,
                y: shallow.y,
                width: shallow.width,
                height: shallow.height
            })),
            
            students: levelData.students.map(student => ({
                x: student.x,
                y: student.y,
                name: student.name,
                health: student.health
            })),
            
            boats: levelData.boats.map(boat => ({
                x: boat.x,
                y: boat.y,
                name: boat.name,
                energy: boat.energy,
                maxPassengers: boat.maxPassengers
            })),
            
            ropes: levelData.ropes.map(rope => ({
                startX: rope.startX,
                startY: rope.startY,
                endX: rope.endX,
                endY: rope.endY
            })),
            
            safeZones: levelData.safeZones.map(safeZone => ({
                x: safeZone.centerX,
                y: safeZone.centerY,
                radius: safeZone.radius
            })),
            
            metadata: levelData.metadata
        }, null, 2);
    }
}

// 导出模块
window.level = {
    LevelManager
};
})();