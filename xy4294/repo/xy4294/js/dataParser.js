/**
 * 数据解析模块
 * 负责解析各种格式的数据文件：JSON、CSV、JSONL
 */

const DataParser = (function() {
    'use strict';

    /**
     * 解析货架坐标JSON
     * @param {string|Object} data - JSON数据
     * @returns {Object} 解析后的货架数据
     */
    function parseRackCoordinates(data) {
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            
            const racks = [];
            const rackMap = new Map();

            if (parsed.racks && Array.isArray(parsed.racks)) {
                parsed.racks.forEach(rack => {
                    const rackData = {
                        id: rack.id || rack.rackId,
                        name: rack.name || `货架${rack.id}`,
                        area: rack.area || '默认区域',
                        position: {
                            x: rack.position?.x ?? rack.x ?? 0,
                            y: rack.position?.y ?? rack.y ?? 0,
                            z: rack.position?.z ?? rack.z ?? 0
                        },
                        dimensions: {
                            width: rack.dimensions?.width ?? rack.width ?? 2,
                            height: rack.dimensions?.height ?? rack.height ?? 4,
                            depth: rack.dimensions?.depth ?? rack.depth ?? 1
                        },
                        levels: rack.levels || 4,
                        slotsPerLevel: rack.slotsPerLevel || 5,
                        slots: []
                    };

                    if (rack.slots && Array.isArray(rack.slots)) {
                        rackData.slots = rack.slots.map(slot => ({
                            id: slot.id || slot.slotId,
                            level: slot.level || 1,
                            position: slot.position || 1,
                            x: slot.x,
                            y: slot.y,
                            z: slot.z,
                            width: slot.width,
                            height: slot.height,
                            depth: slot.depth,
                            occupied: slot.occupied || false,
                            product: slot.product || null
                        }));
                    } else {
                        for (let level = 1; level <= rackData.levels; level++) {
                            for (let pos = 1; pos <= rackData.slotsPerLevel; pos++) {
                                rackData.slots.push({
                                    id: `${rackData.id}-L${level}-P${pos}`,
                                    level: level,
                                    position: pos,
                                    occupied: false,
                                    product: null
                                });
                            }
                        }
                    }

                    racks.push(rackData);
                    rackMap.set(rackData.id, rackData);
                });
            }

            return {
                metadata: parsed.metadata || {
                    warehouse: parsed.warehouse || '未命名仓库',
                    date: parsed.date || new Date().toISOString().split('T')[0]
                },
                racks: racks,
                rackMap: rackMap,
                areas: [...new Set(racks.map(r => r.area))]
            };
        } catch (error) {
            console.error('解析货架坐标数据失败:', error);
            throw new Error(`货架坐标数据解析错误: ${error.message}`);
        }
    }

    /**
     * 解析温度记录CSV
     * @param {string} csvText - CSV文本内容
     * @returns {Object} 解析后的温度数据
     */
    function parseTemperatureCSV(csvText) {
        try {
            const lines = csvText.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('CSV文件格式错误：至少需要标题行和一行数据');
            }

            const headers = parseCSVLine(lines[0]);
            const tempRecords = [];
            const tempMap = new Map();

            const rackIdIdx = findHeaderIndex(headers, ['rackId', 'rack_id', '货架ID', '货架']);
            const slotIdIdx = findHeaderIndex(headers, ['slotId', 'slot_id', '货位ID', '货位']);
            const levelIdx = findHeaderIndex(headers, ['level', '层级', '层']);
            const positionIdx = findHeaderIndex(headers, ['position', '位置', '排']);
            const tempIdx = findHeaderIndex(headers, ['temperature', 'temp', '温度', '当前温度']);
            const timestampIdx = findHeaderIndex(headers, ['timestamp', 'time', '时间', '记录时间']);
            const areaIdx = findHeaderIndex(headers, ['area', '区域', '库区']);

            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                if (values.length < 2) continue;

                const record = {
                    rackId: rackIdIdx >= 0 ? values[rackIdIdx] : null,
                    slotId: slotIdIdx >= 0 ? values[slotIdIdx] : null,
                    level: levelIdx >= 0 ? parseInt(values[levelIdx]) : null,
                    position: positionIdx >= 0 ? parseInt(values[positionIdx]) : null,
                    temperature: tempIdx >= 0 ? parseFloat(values[tempIdx]) : null,
                    timestamp: timestampIdx >= 0 ? values[timestampIdx] : null,
                    area: areaIdx >= 0 ? values[areaIdx] : null
                };

                if (record.temperature !== null && !isNaN(record.temperature)) {
                    tempRecords.push(record);

                    const key = record.slotId || `${record.rackId}-${record.level}-${record.position}`;
                    if (!tempMap.has(key)) {
                        tempMap.set(key, []);
                    }
                    tempMap.get(key).push(record);
                }
            }

            for (const [key, records] of tempMap) {
                records.sort((a, b) => {
                    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return timeA - timeB;
                });
            }

            const timestamps = [...new Set(tempRecords.filter(r => r.timestamp).map(r => r.timestamp))]
                .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

            return {
                records: tempRecords,
                tempMap: tempMap,
                timestamps: timestamps,
                hasTimestamp: timestamps.length > 0
            };
        } catch (error) {
            console.error('解析温度记录CSV失败:', error);
            throw new Error(`温度记录解析错误: ${error.message}`);
        }
    }

    /**
     * 解析叉车轨迹JSONL
     * @param {string} jsonlText - JSONL文本内容
     * @returns {Object} 解析后的轨迹数据
     */
    function parseForkliftTrajectory(jsonlText) {
        try {
            const lines = jsonlText.trim().split('\n');
            const trajectories = new Map();
            const allPoints = [];

            for (let i = 0; i < lines.length; i++) {
                try {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const point = JSON.parse(line);
                    
                    const forkliftId = point.forkliftId || point.forklift_id || point.vehicleId || '默认叉车';
                    const timestamp = point.timestamp || point.time || null;
                    const x = point.x ?? point.position?.x;
                    const y = point.y ?? point.position?.y;
                    const z = point.z ?? point.position?.z;
                    const speed = point.speed ?? point.velocity ?? 0;
                    const action = point.action || point.status || null;

                    const trajectoryPoint = {
                        forkliftId: forkliftId,
                        timestamp: timestamp,
                        x: x,
                        y: y,
                        z: z,
                        speed: speed,
                        action: action,
                        index: i
                    };

                    allPoints.push(trajectoryPoint);

                    if (!trajectories.has(forkliftId)) {
                        trajectories.set(forkliftId, []);
                    }
                    trajectories.get(forkliftId).push(trajectoryPoint);
                } catch (lineError) {
                    console.warn(`解析第${i + 1}行JSONL失败:`, lineError);
                }
            }

            for (const [forkliftId, points] of trajectories) {
                points.sort((a, b) => {
                    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : a.index;
                    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : b.index;
                    return timeA - timeB;
                });
            }

            const timestamps = [...new Set(allPoints.filter(p => p.timestamp).map(p => p.timestamp))]
                .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

            return {
                trajectories: trajectories,
                allPoints: allPoints,
                forkliftIds: [...trajectories.keys()],
                timestamps: timestamps,
                hasTimestamp: timestamps.length > 0
            };
        } catch (error) {
            console.error('解析叉车轨迹JSONL失败:', error);
            throw new Error(`叉车轨迹解析错误: ${error.message}`);
        }
    }

    /**
     * 解析临期货品清单（支持JSON或CSV）
     * @param {string|Object} data - 数据内容
     * @param {string} format - 数据格式：'json' 或 'csv'
     * @returns {Object} 解析后的临期货品数据
     */
    function parseExpiringProducts(data, format = 'json') {
        try {
            let products = [];
            
            if (format === 'csv' || (typeof data === 'string' && data.includes(','))) {
                products = parseExpiringCSV(typeof data === 'string' ? data : JSON.stringify(data));
            } else {
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                products = parseExpiringJSON(parsed);
            }

            const productMap = new Map();
            products.forEach(product => {
                const key = product.slotId || product.productId || product.id;
                if (key) {
                    productMap.set(key, product);
                }
            });

            return {
                products: products,
                productMap: productMap,
                highPriority: products.filter(p => p.priority === 'high' || (p.daysUntilExpiry && p.daysUntilExpiry <= 1)),
                mediumPriority: products.filter(p => p.priority === 'medium' || (p.daysUntilExpiry && p.daysUntilExpiry > 1 && p.daysUntilExpiry <= 3)),
                lowPriority: products.filter(p => p.priority === 'low' || (p.daysUntilExpiry && p.daysUntilExpiry > 3))
            };
        } catch (error) {
            console.error('解析临期货品清单失败:', error);
            throw new Error(`临期货品清单解析错误: ${error.message}`);
        }
    }

    /**
     * 解析临期货品JSON格式
     */
    function parseExpiringJSON(parsed) {
        const products = [];
        
        if (parsed.products && Array.isArray(parsed.products)) {
            parsed.products.forEach(product => {
                products.push(normalizeExpiringProduct(product));
            });
        } else if (Array.isArray(parsed)) {
            parsed.forEach(product => {
                products.push(normalizeExpiringProduct(product));
            });
        }

        return products;
    }

    /**
     * 解析临期货品CSV格式
     */
    function parseExpiringCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = parseCSVLine(lines[0]);
        const products = [];

        const productIdIdx = findHeaderIndex(headers, ['productId', 'product_id', '货品ID', '商品ID', 'id']);
        const nameIdx = findHeaderIndex(headers, ['name', 'productName', '货品名称', '商品名称']);
        const skuIdx = findHeaderIndex(headers, ['sku', 'SKU', '货号']);
        const slotIdIdx = findHeaderIndex(headers, ['slotId', 'slot_id', '货位ID', '货位']);
        const rackIdIdx = findHeaderIndex(headers, ['rackId', 'rack_id', '货架ID', '货架']);
        const levelIdx = findHeaderIndex(headers, ['level', '层级', '层']);
        const positionIdx = findHeaderIndex(headers, ['position', '位置', '排']);
        const quantityIdx = findHeaderIndex(headers, ['quantity', '数量', '库存']);
        const expiryDateIdx = findHeaderIndex(headers, ['expiryDate', 'expiry_date', '保质期', '到期日期', '到期日']);
        const daysUntilExpiryIdx = findHeaderIndex(headers, ['daysUntilExpiry', 'days_until_expiry', '剩余天数']);
        const priorityIdx = findHeaderIndex(headers, ['priority', '优先级', '紧急程度']);
        const isBlockedIdx = findHeaderIndex(headers, ['isBlocked', 'is_blocked', '是否被堵', '被堵']);

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length < 2) continue;

            const product = {
                productId: productIdIdx >= 0 ? values[productIdIdx] : null,
                name: nameIdx >= 0 ? values[nameIdx] : null,
                sku: skuIdx >= 0 ? values[skuIdx] : null,
                slotId: slotIdIdx >= 0 ? values[slotIdIdx] : null,
                rackId: rackIdIdx >= 0 ? values[rackIdIdx] : null,
                level: levelIdx >= 0 ? parseInt(values[levelIdx]) : null,
                position: positionIdx >= 0 ? parseInt(values[positionIdx]) : null,
                quantity: quantityIdx >= 0 ? parseInt(values[quantityIdx]) : null,
                expiryDate: expiryDateIdx >= 0 ? values[expiryDateIdx] : null,
                daysUntilExpiry: daysUntilExpiryIdx >= 0 ? parseInt(values[daysUntilExpiryIdx]) : null,
                priority: priorityIdx >= 0 ? values[priorityIdx] : null,
                isBlocked: isBlockedIdx >= 0 ? parseBoolean(values[isBlockedIdx]) : false
            };

            if (!product.slotId && product.rackId && product.level !== null && product.position !== null) {
                product.slotId = `${product.rackId}-L${product.level}-P${product.position}`;
            }

            products.push(product);
        }

        return products;
    }

    /**
     * 标准化临期货品对象
     */
    function normalizeExpiringProduct(product) {
        return {
            productId: product.productId || product.product_id || product.id || null,
            name: product.name || product.productName || null,
            sku: product.sku || product.SKU || null,
            slotId: product.slotId || product.slot_id || null,
            rackId: product.rackId || product.rack_id || null,
            level: product.level || null,
            position: product.position || null,
            quantity: product.quantity || 1,
            expiryDate: product.expiryDate || product.expiry_date || null,
            daysUntilExpiry: product.daysUntilExpiry || product.days_until_expiry || null,
            priority: product.priority || calculatePriority(product.daysUntilExpiry),
            isBlocked: product.isBlocked || product.is_blocked || false,
            notes: product.notes || null
        };
    }

    /**
     * 根据剩余天数计算优先级
     */
    function calculatePriority(days) {
        if (days === null || days === undefined) return 'medium';
        if (days <= 1) return 'high';
        if (days <= 3) return 'medium';
        return 'low';
    }

    /**
     * 解析CSV行（处理引号内的逗号）
     */
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
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

    /**
     * 查找标题索引
     */
    function findHeaderIndex(headers, possibleNames) {
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i].toLowerCase().trim();
            if (possibleNames.some(name => header === name.toLowerCase().trim())) {
                return i;
            }
        }
        return -1;
    }

    /**
     * 解析布尔值
     */
    function parseBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const lower = value.toLowerCase().trim();
            return lower === 'true' || lower === 'yes' || lower === '是' || lower === '1';
        }
        return !!value;
    }

    /**
     * 自动检测并解析文件
     * @param {File} file - 文件对象
     * @returns {Promise<Object>} 解析结果
     */
    function parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const content = e.target.result;
                    const fileName = file.name.toLowerCase();
                    let result;
                    let type;

                    if (fileName.includes('rack') || fileName.includes('货架') || fileName.includes('coordinate')) {
                        result = parseRackCoordinates(content);
                        type = 'racks';
                    } else if (fileName.includes('temp') || fileName.includes('温度')) {
                        result = parseTemperatureCSV(content);
                        type = 'temperature';
                    } else if (fileName.includes('forklift') || fileName.includes('轨迹') || fileName.includes('path') || fileName.endsWith('.jsonl')) {
                        result = parseForkliftTrajectory(content);
                        type = 'trajectory';
                    } else if (fileName.includes('expir') || fileName.includes('临期') || fileName.includes('过期')) {
                        if (fileName.endsWith('.csv')) {
                            result = parseExpiringProducts(content, 'csv');
                        } else {
                            result = parseExpiringProducts(content, 'json');
                        }
                        type = 'expiring';
                    } else {
                        if (fileName.endsWith('.jsonl')) {
                            result = parseForkliftTrajectory(content);
                            type = 'trajectory';
                        } else if (fileName.endsWith('.csv')) {
                            try {
                                result = parseTemperatureCSV(content);
                                type = 'temperature';
                            } catch {
                                result = parseExpiringProducts(content, 'csv');
                                type = 'expiring';
                            }
                        } else {
                            try {
                                const parsed = JSON.parse(content);
                                if (parsed.racks || (Array.isArray(parsed) && parsed[0] && parsed[0].id && parsed[0].position)) {
                                    result = parseRackCoordinates(content);
                                    type = 'racks';
                                } else {
                                    result = parseExpiringProducts(content, 'json');
                                    type = 'expiring';
                                }
                            } catch {
                                result = parseForkliftTrajectory(content);
                                type = 'trajectory';
                            }
                        }
                    }

                    resolve({ type, data: result, fileName: file.name });
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = function() {
                reject(new Error('文件读取失败'));
            };

            reader.readAsText(file);
        });
    }

    return {
        parseRackCoordinates,
        parseTemperatureCSV,
        parseForkliftTrajectory,
        parseExpiringProducts,
        parseFile
    };
})();

// 导出到全局
if (typeof window !== 'undefined') {
    window.DataParser = DataParser;
}
