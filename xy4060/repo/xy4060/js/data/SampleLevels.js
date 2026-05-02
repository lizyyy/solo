var SampleLevels = {
    getLevels: function() {
        return [
            this._createLevel1(),
            this._createLevel2(),
            this._createLevel3(),
            this._createLevel4(),
            this._createLevel5()
        ];
    },
    
    _createLevel1: function() {
        var level = new Level('sample_001', '直线入门');
        level.description = '学习基本的前进指令。让机器人从起点出发，到达检查点。';
        level.mapWidth = 8;
        level.mapHeight = 5;
        level.initialEnergy = 20;
        level._initMap();
        
        level.setCell(1, 2, Constants.CELL_TYPE.START);
        level.setCell(2, 2, Constants.CELL_TYPE.EMPTY);
        level.setCell(3, 2, Constants.CELL_TYPE.EMPTY);
        level.setCell(4, 2, Constants.CELL_TYPE.EMPTY);
        level.setCell(5, 2, Constants.CELL_TYPE.EMPTY);
        level.setCell(6, 2, Constants.CELL_TYPE.CHECKPOINT);
        
        level.startDirection = Constants.DIRECTION.RIGHT;
        
        return level;
    },
    
    _createLevel2: function() {
        var level = new Level('sample_002', '拐弯练习');
        level.description = '学习转向指令。需要左转和右转才能到达检查点。';
        level.mapWidth = 6;
        level.mapHeight = 6;
        level.initialEnergy = 30;
        level._initMap();
        
        level.setCell(1, 1, Constants.CELL_TYPE.START);
        level.setCell(2, 1, Constants.CELL_TYPE.EMPTY);
        level.setCell(3, 1, Constants.CELL_TYPE.EMPTY);
        level.setCell(4, 1, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(4, 2, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(4, 3, Constants.CELL_TYPE.EMPTY);
        level.setCell(3, 3, Constants.CELL_TYPE.EMPTY);
        level.setCell(2, 3, Constants.CELL_TYPE.EMPTY);
        level.setCell(2, 4, Constants.CELL_TYPE.CHECKPOINT);
        
        level.startDirection = Constants.DIRECTION.RIGHT;
        
        return level;
    },
    
    _createLevel3: function() {
        var level = new Level('sample_003', '迷宫初探');
        level.description = '在简单迷宫中找到路径。需要规划行走路线。';
        level.mapWidth = 8;
        level.mapHeight = 8;
        level.initialEnergy = 50;
        level._initMap();
        
        level.setCell(1, 1, Constants.CELL_TYPE.START);
        
        level.setCell(2, 1, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(2, 2, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(2, 3, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(4, 2, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(4, 3, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(4, 4, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(6, 1, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(6, 2, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(6, 3, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(6, 5, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(6, 6, Constants.CELL_TYPE.OBSTACLE);
        
        level.setCell(5, 2, Constants.CELL_TYPE.CHECKPOINT);
        level.setCell(3, 5, Constants.CELL_TYPE.CHECKPOINT);
        level.setCell(6, 4, Constants.CELL_TYPE.CHECKPOINT);
        
        level.startDirection = Constants.DIRECTION.DOWN;
        
        return level;
    },
    
    _createLevel4: function() {
        var level = new Level('sample_004', '取样任务');
        level.description = '学习取样指令。需要在取样点取样，然后到达检查点。';
        level.mapWidth = 8;
        level.mapHeight = 6;
        level.initialEnergy = 40;
        level._initMap();
        
        level.setCell(1, 2, Constants.CELL_TYPE.START);
        level.setCell(3, 2, Constants.CELL_TYPE.SAMPLE);
        level.setCell(5, 2, Constants.CELL_TYPE.SAMPLE);
        level.setCell(6, 4, Constants.CELL_TYPE.CHECKPOINT);
        
        level.setCell(2, 1, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(2, 3, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(4, 1, Constants.CELL_TYPE.OBSTACLE);
        level.setCell(4, 3, Constants.CELL_TYPE.OBSTACLE);
        
        level.startDirection = Constants.DIRECTION.RIGHT;
        
        return level;
    },
    
    _createLevel5: function() {
        var level = new Level('sample_005', '能量管理');
        level.description = '学习使用充电点。路径较长，需要中途充电才能完成。';
        level.mapWidth = 10;
        level.mapHeight = 8;
        level.initialEnergy = 25;
        level._initMap();
        
        level.setCell(1, 1, Constants.CELL_TYPE.START);
        level.setCell(5, 1, Constants.CELL_TYPE.CHARGE);
        level.setCell(8, 1, Constants.CELL_TYPE.CHECKPOINT);
        level.setCell(8, 6, Constants.CELL_TYPE.CHECKPOINT);
        level.setCell(1, 6, Constants.CELL_TYPE.SAMPLE);
        level.setCell(3, 4, Constants.CELL_TYPE.DANGER);
        
        for (var x = 2; x < 8; x++) {
            level.setCell(x, 3, Constants.CELL_TYPE.OBSTACLE);
        }
        
        for (var y = 4; y < 7; y++) {
            level.setCell(6, y, Constants.CELL_TYPE.OBSTACLE);
        }
        
        level.startDirection = Constants.DIRECTION.RIGHT;
        
        return level;
    },
    
    initSampleLevels: function(storage) {
        var existingLevels = storage.loadAllLevels();
        if (existingLevels.length > 0) {
            return false;
        }
        
        var levels = this.getLevels();
        for (var i = 0; i < levels.length; i++) {
            storage.saveLevel(levels[i]);
        }
        
        return true;
    },
    
    getOptimalSolution: function(levelId) {
        var solutions = {
            'sample_001': ['forward', 'forward', 'forward', 'forward', 'forward'],
            'sample_002': ['forward', 'forward', 'turnRight', 'forward', 'forward', 'turnLeft', 'forward', 'forward', 'turnRight', 'forward'],
            'sample_003': ['forward', 'forward', 'turnRight', 'forward', 'forward', 'forward', 'turnRight', 'forward', 'forward', 'turnLeft', 'forward', 'forward', 'forward'],
            'sample_004': ['forward', 'forward', 'sample', 'forward', 'forward', 'sample', 'turnRight', 'forward', 'forward', 'turnLeft', 'forward', 'forward'],
            'sample_005': ['forward', 'forward', 'forward', 'forward', 'charge', 'forward', 'forward', 'forward', 'turnRight', 'forward', 'forward', 'forward', 'turnRight', 'forward', 'forward', 'turnLeft', 'forward', 'forward', 'forward', 'forward', 'turnRight', 'forward', 'forward', 'sample']
        };
        
        if (solutions[levelId]) {
            var queue = new CommandQueue();
            for (var i = 0; i < solutions[levelId].length; i++) {
                queue.add(new Command(solutions[levelId][i]));
            }
            return queue;
        }
        
        return null;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SampleLevels;
}
