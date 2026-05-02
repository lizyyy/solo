// 数据解析模块
const Parser = {
    // 解析展柜尺寸JSON
    parseCaseJson: function(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            // 验证基本结构
            if (!data || !data.cases || !Array.isArray(data.cases)) {
                throw new Error('展柜数据格式错误：缺少cases数组');
            }
            
            const cases = data.cases.map((caseItem, index) => {
                if (!caseItem.id) {
                    caseItem.id = `case_${index + 1}`;
                }
                
                // 验证必要字段
                const requiredFields = ['width', 'height', 'depth'];
                const missingFields = requiredFields.filter(field => !(field in caseItem));
                if (missingFields.length > 0) {
                    throw new Error(`展柜 ${caseItem.id} 缺少必要字段: ${missingFields.join(', ')}`);
                }
                
                // 处理位置信息
                if (!caseItem.position) {
                    caseItem.position = { x: 0, y: 0 };
                }
                
                // 处理玻璃信息
                if (!caseItem.glass) {
                    caseItem.glass = {
                        front: true,
                        reflectivity: 0.08 // 默认反射率 8%
                    };
                }
                
                // 处理说明牌位置
                if (!caseItem.infoPanel) {
                    caseItem.infoPanel = {
                        position: { x: caseItem.width / 2, y: caseItem.height * 0.8 },
                        width: 0.3,
                        height: 0.2,
                        angle: 0 // 相对于展柜的角度
                    };
                }
                
                return caseItem;
            });
            
            return {
                success: true,
                data: {
                    cases: cases,
                    metadata: data.metadata || {}
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // 解析灯具角度CSV
    parseLightsCsv: function(csvString) {
        try {
            const lines = csvString.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('CSV文件格式错误：需要至少包含表头和一行数据');
            }
            
            // 解析表头
            const headers = this.parseCsvLine(lines[0]);
            
            // 验证必要列
            const requiredColumns = ['id', 'x', 'y', 'z', 'angle_x', 'angle_y', 'angle_z', 'intensity', 'beam_angle'];
            const missingColumns = requiredColumns.filter(col => !headers.includes(col));
            
            // 允许一些常见的别名
            const columnAliases = {
                'id': ['id', '灯ID', '灯具ID', 'light_id'],
                'x': ['x', 'x坐标', 'x_position', 'pos_x'],
                'y': ['y', 'y坐标', 'y_position', 'pos_y'],
                'z': ['z', 'z坐标', 'z_position', 'pos_z'],
                'angle_x': ['angle_x', 'x角度', 'x_angle', 'tilt'],
                'angle_y': ['angle_y', 'y角度', 'y_angle', 'pan'],
                'angle_z': ['angle_z', 'z角度', 'z_angle', 'roll'],
                'intensity': ['intensity', '强度', '照度', 'brightness'],
                'beam_angle': ['beam_angle', '光束角', 'beam_width', 'spread']
            };
            
            // 建立列映射
            const columnMap = {};
            for (const [target, aliases] of Object.entries(columnAliases)) {
                const foundIndex = headers.findIndex(header => 
                    aliases.some(alias => header.toLowerCase().includes(alias.toLowerCase()))
                );
                if (foundIndex !== -1) {
                    columnMap[target] = foundIndex;
                }
            }
            
            // 检查是否有必要列
            const actualMissing = requiredColumns.filter(col => !(col in columnMap));
            if (actualMissing.length > 0 && missingColumns.length > 0) {
                // 尝试更宽松的匹配
                const relaxedColumns = ['id', 'x', 'y', 'angle_x', 'intensity', 'beam_angle'];
                const relaxedMissing = relaxedColumns.filter(col => !(col in columnMap));
                if (relaxedMissing.length > 0) {
                    throw new Error(`CSV缺少必要列: ${relaxedMissing.join(', ')}。必要列包括: id, x, y, angle_x, intensity, beam_angle`);
                }
            }
            
            // 解析数据行
            const lights = [];
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCsvLine(lines[i]);
                if (values.length === 0 || values.every(v => v.trim() === '')) {
                    continue; // 跳过空行
                }
                
                const light = {
                    id: values[columnMap.id] || `light_${i}`,
                    position: {
                        x: parseFloat(values[columnMap.x]) || 0,
                        y: parseFloat(values[columnMap.y]) || 0,
                        z: parseFloat(values[columnMap.z]) || 2.0 // 默认高度2米
                    },
                    angle: {
                        x: parseFloat(values[columnMap.angle_x]) || 45, // 默认倾斜角45度
                        y: parseFloat(values[columnMap.angle_y]) || 0,
                        z: parseFloat(values[columnMap.angle_z]) || 0
                    },
                    intensity: parseFloat(values[columnMap.intensity]) || 1000, // 默认强度1000 lux
                    beamAngle: parseFloat(values[columnMap.beam_angle]) || 30 // 默认光束角30度
                };
                
                // 可选字段
                if (columnMap.color_temp !== undefined) {
                    light.colorTemp = parseFloat(values[columnMap.color_temp]) || 5000;
                }
                if (columnMap.case_id !== undefined) {
                    light.caseId = values[columnMap.case_id];
                }
                
                lights.push(light);
            }
            
            return {
                success: true,
                data: {
                    lights: lights,
                    headerMapping: columnMap
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // 解析文物材质表CSV
    parseMaterialsCsv: function(csvString) {
        try {
            const lines = csvString.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('材质表CSV格式错误');
            }
            
            const headers = this.parseCsvLine(lines[0]);
            
            // 列映射
            const columnMap = {};
            const columnAliases = {
                'id': ['id', '文物ID', 'artifact_id'],
                'name': ['name', '名称', '文物名称', 'artifact_name'],
                'material': ['material', '材质', '材料'],
                'max_illuminance': ['max_illuminance', '最大照度', '照度上限', 'illuminance_limit'],
                'sensitivity': ['sensitivity', '光敏等级', '光敏度'],
                'case_id': ['case_id', '展柜ID', '所属展柜']
            };
            
            for (const [target, aliases] of Object.entries(columnAliases)) {
                const foundIndex = headers.findIndex(header => 
                    aliases.some(alias => header.toLowerCase().includes(alias.toLowerCase()))
                );
                if (foundIndex !== -1) {
                    columnMap[target] = foundIndex;
                }
            }
            
            // 解析数据
            const artifacts = [];
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCsvLine(lines[i]);
                if (values.length === 0 || values.every(v => v.trim() === '')) {
                    continue;
                }
                
                const artifact = {
                    id: values[columnMap.id] || `artifact_${i}`,
                    name: values[columnMap.name] || `文物 ${i}`,
                    material: values[columnMap.material] || '未知',
                    maxIlluminance: parseFloat(values[columnMap.max_illuminance]) || 500, // 默认500 lux
                    sensitivity: values[columnMap.sensitivity] || '中等'
                };
                
                if (columnMap.case_id !== undefined) {
                    artifact.caseId = values[columnMap.case_id];
                }
                
                // 根据材质设置默认照度限制
                const materialLimits = {
                    '纸': 50, '纸张': 50, 'paper': 50,
                    '丝绸': 50, '丝织品': 50, 'silk': 50,
                    '皮革': 150, 'leather': 150,
                    '油画': 200, 'oil': 200,
                    '木质': 300, 'wood': 300,
                    '陶瓷': 500, 'ceramic': 500,
                    '金属': 1000, 'metal': 1000,
                    '宝石': 2000, 'gem': 2000, 'jewelry': 2000
                };
                
                const materialLower = artifact.material.toLowerCase();
                for (const [materialKey, limit] of Object.entries(materialLimits)) {
                    if (materialLower.includes(materialKey.toLowerCase())) {
                        artifact.maxIlluminance = limit;
                        break;
                    }
                }
                
                artifacts.push(artifact);
            }
            
            return {
                success: true,
                data: {
                    artifacts: artifacts
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // 解析观众动线JSON
    parsePathsJson: function(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (!data || !data.paths || !Array.isArray(data.paths)) {
                throw new Error('动线数据格式错误：缺少paths数组');
            }
            
            const paths = data.paths.map((path, index) => {
                if (!path.id) {
                    path.id = `path_${index + 1}`;
                }
                
                if (!path.points || !Array.isArray(path.points)) {
                    throw new Error(`动线 ${path.id} 缺少points数组`);
                }
                
                // 验证每个点
                path.points = path.points.map((point, pIndex) => {
                    if (!point.x !== undefined && !point.y !== undefined) {
                        throw new Error(`动线 ${path.id} 的点 ${pIndex} 缺少x或y坐标`);
                    }
                    return {
                        x: point.x,
                        y: point.y,
                        z: point.z || 1.6, // 默认眼高1.6米
                        name: point.name || `点${pIndex + 1}`
                    };
                });
                
                // 动线类型
                path.type = path.type || 'main';
                path.description = path.description || '';
                
                return path;
            });
            
            return {
                success: true,
                data: {
                    paths: paths,
                    metadata: data.metadata || {}
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // 辅助函数：解析CSV行（处理引号）
    parseCsvLine: function(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    // 转义的引号
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }
};
