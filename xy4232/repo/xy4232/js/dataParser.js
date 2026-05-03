/**
 * 数据解析模块
 * 负责解析各种格式的输入数据
 */

const DataParser = {
    /**
     * 解析展厅平面图JSON
     * @param {string} jsonString - JSON字符串
     * @returns {Object} 解析后的展厅数据
     */
    parseFloorplan(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return this.validateFloorplan(data);
        } catch (error) {
            throw new Error(`展厅平面图解析失败: ${error.message}`);
        }
    },

    /**
     * 验证展厅平面图数据结构
     */
    validateFloorplan(data) {
        const required = ['id', 'name', 'width', 'height', 'walls', 'entrances', 'exits'];
        const missing = required.filter(field => !(field in data));
        
        if (missing.length > 0) {
            throw new Error(`展厅平面图缺少必要字段: ${missing.join(', ')}`);
        }

        if (typeof data.width !== 'number' || data.width <= 0) {
            throw new Error('展厅宽度必须为正数');
        }

        if (typeof data.height !== 'number' || data.height <= 0) {
            throw new Error('展厅高度必须为正数');
        }

        if (!Array.isArray(data.walls)) {
            throw new Error('walls 必须为数组');
        }

        if (!Array.isArray(data.entrances)) {
            throw new Error('entrances 必须为数组');
        }

        if (!Array.isArray(data.exits)) {
            throw new Error('exits 必须为数组');
        }

        return {
            id: data.id,
            name: data.name,
            width: data.width,
            height: data.height,
            walls: data.walls.map(wall => this.validateWall(wall)),
            entrances: data.entrances.map(entrance => this.validateEntrance(entrance)),
            exits: data.exits.map(exit => this.validateExit(exit)),
            corridors: data.corridors ? data.corridors.map(corridor => this.validateCorridor(corridor)) : [],
            fireExits: data.fireExits ? data.fireExits.map(fireExit => this.validateFireExit(fireExit)) : [],
            accessibilityPaths: data.accessibilityPaths ? data.accessibilityPaths.map(path => this.validateAccessibilityPath(path)) : []
        };
    },

    validateWall(wall) {
        if (!wall.start || !wall.end) {
            throw new Error('墙体必须包含 start 和 end 坐标');
        }
        return {
            id: wall.id || `wall_${Date.now()}_${Math.random()}`,
            start: { x: wall.start.x, y: wall.start.y },
            end: { x: wall.end.x, y: wall.end.y },
            height: wall.height || 3,
            thickness: wall.thickness || 0.2,
            type: wall.type || 'normal'
        };
    },

    validateEntrance(entrance) {
        if (!entrance.position) {
            throw new Error('入口必须包含 position 坐标');
        }
        return {
            id: entrance.id || `entrance_${Date.now()}_${Math.random()}`,
            name: entrance.name || '入口',
            position: { x: entrance.position.x, y: entrance.position.y },
            width: entrance.width || 2,
            capacity: entrance.capacity || 100,
            timeSlots: entrance.timeSlots || []
        };
    },

    validateExit(exit) {
        if (!exit.position) {
            throw new Error('出口必须包含 position 坐标');
        }
        return {
            id: exit.id || `exit_${Date.now()}_${Math.random()}`,
            name: exit.name || '出口',
            position: { x: exit.position.x, y: exit.position.y },
            width: exit.width || 2
        };
    },

    validateCorridor(corridor) {
        return {
            id: corridor.id || `corridor_${Date.now()}_${Math.random()}`,
            name: corridor.name || '通道',
            start: { x: corridor.start.x, y: corridor.start.y },
            end: { x: corridor.end.x, y: corridor.end.y },
            width: corridor.width || 2,
            isAccessible: corridor.isAccessible || true
        };
    },

    validateFireExit(fireExit) {
        return {
            id: fireExit.id || `fireExit_${Date.now()}_${Math.random()}`,
            name: fireExit.name || '消防通道',
            position: { x: fireExit.position.x, y: fireExit.position.y },
            width: fireExit.width || 1.5,
            clearZone: fireExit.clearZone || 2
        };
    },

    validateAccessibilityPath(path) {
        return {
            id: path.id || `accessPath_${Date.now()}_${Math.random()}`,
            name: path.name || '无障碍路径',
            start: { x: path.start.x, y: path.start.y },
            end: { x: path.end.x, y: path.end.y },
            width: path.width || 1.5,
            hasRamp: path.hasRamp || false,
            slope: path.slope || 0
        };
    },

    /**
     * 解析展品清单CSV
     * @param {string} csvString - CSV字符串
     * @returns {Array} 解析后的展品数组
     */
    parseExhibits(csvString) {
        try {
            const lines = csvString.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('CSV文件至少需要包含表头和一行数据');
            }

            const headers = this.parseCSVLine(lines[0]);
            const exhibits = [];

            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                if (values.length === 0) continue;

                const exhibit = {};
                headers.forEach((header, index) => {
                    const value = values[index] || '';
                    
                    switch (header.toLowerCase().trim()) {
                        case 'id':
                        case '展品id':
                            exhibit.id = value;
                            break;
                        case 'name':
                        case '展品名称':
                            exhibit.name = value;
                            break;
                        case 'x':
                        case 'x坐标':
                            exhibit.x = parseFloat(value) || 0;
                            break;
                        case 'y':
                        case 'y坐标':
                            exhibit.y = parseFloat(value) || 0;
                            break;
                        case 'width':
                        case '宽度':
                            exhibit.width = parseFloat(value) || 1;
                            break;
                        case 'depth':
                        case '深度':
                            exhibit.depth = parseFloat(value) || 1;
                            break;
                        case 'height':
                        case '高度':
                            exhibit.height = parseFloat(value) || 2;
                            break;
                        case 'popularity':
                        case '热度':
                        case '吸引力':
                            exhibit.popularity = parseFloat(value) || 0.5;
                            break;
                        case 'viewing_time':
                        case '观展时间':
                        case '停留时间':
                            exhibit.viewingTime = parseFloat(value) || 30;
                            break;
                        case 'category':
                        case '类别':
                            exhibit.category = value;
                            break;
                        case 'description':
                        case '描述':
                            exhibit.description = value;
                            break;
                    }
                });

                if (!exhibit.id) {
                    exhibit.id = `exhibit_${Date.now()}_${i}`;
                }

                exhibits.push(this.validateExhibit(exhibit));
            }

            return exhibits;
        } catch (error) {
            throw new Error(`展品清单解析失败: ${error.message}`);
        }
    },

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());

        return result;
    },

    validateExhibit(exhibit) {
        return {
            id: exhibit.id,
            name: exhibit.name || '未命名展品',
            position: { x: exhibit.x || 0, y: exhibit.y || 0 },
            dimensions: {
                width: exhibit.width || 1,
                depth: exhibit.depth || 1,
                height: exhibit.height || 2
            },
            popularity: Math.max(0, Math.min(1, exhibit.popularity || 0.5)),
            viewingTime: Math.max(1, exhibit.viewingTime || 30),
            category: exhibit.category || 'default',
            description: exhibit.description || ''
        };
    },

    /**
     * 解析客流时段表CSV
     */
    parseCrowdSchedule(csvString) {
        try {
            const lines = csvString.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('CSV文件至少需要包含表头和一行数据');
            }

            const headers = this.parseCSVLine(lines[0]);
            const timeSlots = [];

            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                if (values.length === 0) continue;

                const timeSlot = {};
                headers.forEach((header, index) => {
                    const value = values[index] || '';
                    
                    switch (header.toLowerCase().trim()) {
                        case 'id':
                        case '时段id':
                            timeSlot.id = value;
                            break;
                        case 'name':
                        case '时段名称':
                            timeSlot.name = value;
                            break;
                        case 'start_time':
                        case '开始时间':
                        case 'start':
                            timeSlot.startTime = value;
                            break;
                        case 'end_time':
                        case '结束时间':
                        case 'end':
                            timeSlot.endTime = value;
                            break;
                        case 'visitor_count':
                        case '观众数量':
                        case '人数':
                            timeSlot.visitorCount = parseInt(value) || 0;
                            break;
                        case 'entrance':
                        case '入口':
                            timeSlot.entrance = value;
                            break;
                        case 'description':
                        case '描述':
                            timeSlot.description = value;
                            break;
                    }
                });

                if (!timeSlot.id) {
                    timeSlot.id = `timeslot_${Date.now()}_${i}`;
                }

                timeSlots.push(this.validateTimeSlot(timeSlot));
            }

            return timeSlots;
        } catch (error) {
            throw new Error(`客流时段表解析失败: ${error.message}`);
        }
    },

    validateTimeSlot(timeSlot) {
        return {
            id: timeSlot.id,
            name: timeSlot.name || '未命名时段',
            startTime: timeSlot.startTime || '09:00',
            endTime: timeSlot.endTime || '10:00',
            visitorCount: Math.max(0, timeSlot.visitorCount || 0),
            entrance: timeSlot.entrance || null,
            description: timeSlot.description || ''
        };
    },

    /**
     * 解析无障碍通道规则JSON
     */
    parseAccessibilityRules(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return this.validateAccessibilityRules(data);
        } catch (error) {
            throw new Error(`无障碍规则解析失败: ${error.message}`);
        }
    },

    validateAccessibilityRules(data) {
        return {
            maxDetourDistance: data.maxDetourDistance || 50,
            preferredPathWidth: data.preferredPathWidth || 1.5,
            maxSlope: data.maxSlope || 0.083,
            requiredClearZone: data.requiredClearZone || 1.5,
            priorityZones: data.priorityZones ? data.priorityZones.map(zone => ({
                id: zone.id || `zone_${Date.now()}_${Math.random()}`,
                name: zone.name || '优先区域',
                center: { x: zone.center.x, y: zone.center.y },
                radius: zone.radius || 5
            })) : [],
            avoidZones: data.avoidZones ? data.avoidZones.map(zone => ({
                id: zone.id || `avoid_${Date.now()}_${Math.random()}`,
                name: zone.name || '避障区域',
                center: { x: zone.center.x, y: zone.center.y },
                radius: zone.radius || 3
            })) : []
        };
    }
};

// 导出为全局变量
window.DataParser = DataParser;
