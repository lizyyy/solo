const DataImporter = {
    async parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const results = {};
                    
                    workbook.SheetNames.forEach((sheetName) => {
                        const worksheet = workbook.Sheets[sheetName];
                        results[sheetName] = XLSX.utils.sheet_to_json(worksheet, { header: 'A' });
                    });
                    
                    resolve(results);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },
    
    async parseCSVFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const data = Utils.parseCSV(text);
                    resolve({ Sheet1: data });
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },
    
    async parseJSONFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },
    
    async parseFile(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        
        switch (extension) {
            case 'xlsx':
            case 'xls':
                return await this.parseExcelFile(file);
            case 'csv':
                return await this.parseCSVFile(file);
            case 'json':
                return await this.parseJSONFile(file);
            default:
                throw new Error(`不支持的文件格式: ${extension}`);
        }
    },
    
    parseTrussData(rawData) {
        const trusses = [];
        const allData = this.flattenRawData(rawData);
        
        if (allData.length === 0) {
            return trusses;
        }
        
        const headerRow = this.findHeaderRow(allData);
        if (!headerRow) {
            return this.parseSimpleTrussData(allData);
        }
        
        const columns = this.mapColumns(headerRow);
        
        for (let i = headerRow.rowIndex + 1; i < allData.length; i++) {
            const row = allData[i];
            const truss = this.extractTrussFromRow(row, columns);
            if (truss) {
                const existing = trusses.find(t => t.name === truss.name);
                if (!existing) {
                    trusses.push(truss);
                } else {
                    if (truss.points.length > 0) {
                        existing.points.push(...truss.points);
                    }
                }
            }
        }
        
        return trusses;
    },
    
    parseSimpleTrussData(allData) {
        const trusses = [];
        let currentTruss = null;
        
        for (const row of allData) {
            const values = Object.values(row).filter(v => v !== null && v !== undefined && v !== '');
            if (values.length === 0) continue;
            
            const firstValue = String(values[0]).toLowerCase();
            
            if (firstValue.includes('桁架') || firstValue.includes('truss')) {
                if (currentTruss) trusses.push(currentTruss);
                currentTruss = {
                    id: Utils.generateId('truss'),
                    name: String(values[0]),
                    type: 'box-truss',
                    length: 10,
                    width: 0.5,
                    height: 0.5,
                    position: { x: 0, y: 5, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    points: [],
                };
            } else if (currentTruss && values.length >= 2) {
                const point = {
                    id: Utils.generateId('point'),
                    name: String(values[0] || currentTruss.points.length + 1),
                    position: {
                        x: Utils.parseWeight(values[1]) || 0,
                        y: 5,
                        z: Utils.parseWeight(values[2]) || 0,
                    },
                };
                currentTruss.points.push(point);
            }
        }
        
        if (currentTruss) trusses.push(currentTruss);
        
        if (trusses.length === 0) {
            const defaultTruss = {
                id: Utils.generateId('truss'),
                name: '主桁架',
                type: 'box-truss',
                length: 10,
                width: 0.5,
                height: 0.5,
                position: { x: 0, y: 5, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                points: [],
            };
            
            for (const row of allData) {
                const values = Object.values(row).filter(v => v !== null && v !== undefined && v !== '');
                if (values.length >= 2) {
                    const point = {
                        id: Utils.generateId('point'),
                        name: String(values[0] || defaultTruss.points.length + 1),
                        position: {
                            x: Utils.parseWeight(values[1]) || defaultTruss.points.length * 2 - 4,
                            y: 5,
                            z: Utils.parseWeight(values[2]) || 0,
                        },
                    };
                    defaultTruss.points.push(point);
                }
            }
            
            if (defaultTruss.points.length > 0) {
                trusses.push(defaultTruss);
            }
        }
        
        return trusses;
    },
    
    parseEquipmentData(rawData) {
        const equipment = [];
        const allData = this.flattenRawData(rawData);
        
        if (allData.length === 0) {
            return equipment;
        }
        
        const headerRow = this.findHeaderRow(allData);
        if (!headerRow) {
            return this.parseSimpleEquipmentData(allData);
        }
        
        const columns = this.mapEquipmentColumns(headerRow);
        
        for (let i = headerRow.rowIndex + 1; i < allData.length; i++) {
            const row = allData[i];
            const eq = this.extractEquipmentFromRow(row, columns);
            if (eq) {
                equipment.push(eq);
            }
        }
        
        return equipment;
    },
    
    parseSimpleEquipmentData(allData) {
        const equipment = [];
        
        for (const row of allData) {
            const values = Object.values(row).filter(v => v !== null && v !== undefined && v !== '');
            if (values.length === 0) continue;
            
            const name = String(values[0] || '');
            if (name.toLowerCase().includes('名称') || name.toLowerCase().includes('name')) {
                continue;
            }
            
            let type = 'other';
            const lowerName = name.toLowerCase();
            if (lowerName.includes('灯') || lowerName.includes('light') || lowerName.includes('fixture')) {
                type = 'fixture';
            } else if (lowerName.includes('音箱') || lowerName.includes('speaker') || lowerName.includes('线阵列') || lowerName.includes('line')) {
                type = 'speaker';
            }
            
            equipment.push({
                id: Utils.generateId('eq'),
                name: name,
                type: type,
                weight: Utils.parseWeight(values[1]) || 10,
                mountedOn: null,
                position: { x: 0, y: 5, z: 0 },
                hasSafetyRope: true,
            });
        }
        
        return equipment;
    },
    
    parseHoistData(rawData) {
        const hoists = [];
        const allData = this.flattenRawData(rawData);
        
        if (allData.length === 0) {
            return hoists;
        }
        
        const headerRow = this.findHeaderRow(allData);
        if (!headerRow) {
            return this.parseSimpleHoistData(allData);
        }
        
        const columns = this.mapHoistColumns(headerRow);
        
        for (let i = headerRow.rowIndex + 1; i < allData.length; i++) {
            const row = allData[i];
            const hoist = this.extractHoistFromRow(row, columns);
            if (hoist) {
                hoists.push(hoist);
            }
        }
        
        return hoists;
    },
    
    parseSimpleHoistData(allData) {
        const hoists = [];
        
        for (const row of allData) {
            const values = Object.values(row).filter(v => v !== null && v !== undefined && v !== '');
            if (values.length === 0) continue;
            
            const name = String(values[0] || '');
            if (name.toLowerCase().includes('名称') || name.toLowerCase().includes('name') || name.toLowerCase().includes('葫芦')) {
                continue;
            }
            
            const ratedLoad = Utils.parseWeight(values[1]) || 1000;
            const hasSafetyRope = values.length > 2 ? 
                String(values[2]).toLowerCase().includes('有') || String(values[2]).toLowerCase().includes('是') || String(values[2]).toLowerCase().includes('yes') :
                true;
            
            hoists.push({
                id: Utils.generateId('hoist'),
                name: name || `葫芦 ${hoists.length + 1}`,
                ratedLoad: ratedLoad,
                attachedTo: null,
                position: { x: hoists.length * 8 - 4, y: 8, z: 0 },
                hasSafetyRope: hasSafetyRope,
            });
        }
        
        return hoists;
    },
    
    parseLoadCellData(rawData) {
        const loadCells = [];
        const allData = this.flattenRawData(rawData);
        
        if (allData.length === 0) {
            return loadCells;
        }
        
        const headerRow = this.findHeaderRow(allData);
        if (!headerRow) {
            return this.parseSimpleLoadCellData(allData);
        }
        
        const columns = this.mapLoadCellColumns(headerRow);
        
        for (let i = headerRow.rowIndex + 1; i < allData.length; i++) {
            const row = allData[i];
            const lc = this.extractLoadCellFromRow(row, columns);
            if (lc) {
                loadCells.push(lc);
            }
        }
        
        return loadCells;
    },
    
    parseSimpleLoadCellData(allData) {
        const loadCells = [];
        
        for (const row of allData) {
            const values = Object.values(row).filter(v => v !== null && v !== undefined && v !== '');
            if (values.length === 0) continue;
            
            const name = String(values[0] || '');
            if (name.toLowerCase().includes('名称') || name.toLowerCase().includes('name')) {
                continue;
            }
            
            loadCells.push({
                id: Utils.generateId('loadcell'),
                name: name || `拉力计 ${loadCells.length + 1}`,
                measuredLoad: Utils.parseWeight(values[1]) || 0,
                attachedToHoist: null,
            });
        }
        
        return loadCells;
    },
    
    flattenRawData(rawData) {
        const allData = [];
        
        if (Array.isArray(rawData)) {
            return rawData;
        }
        
        if (typeof rawData === 'object' && rawData !== null) {
            for (const key in rawData) {
                if (Array.isArray(rawData[key])) {
                    allData.push(...rawData[key]);
                }
            }
        }
        
        return allData;
    },
    
    findHeaderRow(data) {
        for (let i = 0; i < Math.min(data.length, 10); i++) {
            const row = data[i];
            const values = Object.values(row).map(v => String(v || '').toLowerCase());
            
            const hasName = values.some(v => v.includes('名称') || v.includes('name') || v.includes('id'));
            const hasPosition = values.some(v => v.includes('位置') || v.includes('position') || v.includes('x') || v.includes('y') || v.includes('z'));
            const hasWeight = values.some(v => v.includes('重量') || v.includes('weight') || v.includes('载荷'));
            
            if (hasName || hasPosition || hasWeight) {
                return { rowIndex: i, data: row };
            }
        }
        
        return null;
    },
    
    mapColumns(headerRow) {
        const columns = {};
        const row = headerRow.data;
        
        for (const key in row) {
            const value = String(row[key] || '').toLowerCase();
            
            if (value.includes('名称') || value.includes('name') || value === 'id') {
                columns.name = key;
            } else if (value.includes('类型') || value.includes('type')) {
                columns.type = key;
            } else if (value.includes('x') || value.includes('x坐标') || value.includes('x轴')) {
                columns.x = key;
            } else if (value.includes('y') || value.includes('y坐标') || value.includes('y轴')) {
                columns.y = key;
            } else if (value.includes('z') || value.includes('z坐标') || value.includes('z轴')) {
                columns.z = key;
            } else if (value.includes('吊点') || value.includes('point')) {
                columns.pointName = key;
            }
        }
        
        return columns;
    },
    
    mapEquipmentColumns(headerRow) {
        const columns = this.mapColumns(headerRow);
        const row = headerRow.data;
        
        for (const key in row) {
            const value = String(row[key] || '').toLowerCase();
            
            if (value.includes('重量') || value.includes('weight') || value.includes('kg')) {
                columns.weight = key;
            } else if (value.includes('安全绳') || value.includes('safety')) {
                columns.hasSafetyRope = key;
            }
        }
        
        return columns;
    },
    
    mapHoistColumns(headerRow) {
        const columns = this.mapColumns(headerRow);
        const row = headerRow.data;
        
        for (const key in row) {
            const value = String(row[key] || '').toLowerCase();
            
            if (value.includes('额定') || value.includes('载荷') || value.includes('rated') || value.includes('load')) {
                columns.ratedLoad = key;
            } else if (value.includes('安全绳') || value.includes('safety')) {
                columns.hasSafetyRope = key;
            } else if (value.includes('连接') || value.includes('attached') || value.includes('吊点')) {
                columns.attachedTo = key;
            }
        }
        
        return columns;
    },
    
    mapLoadCellColumns(headerRow) {
        const columns = this.mapColumns(headerRow);
        const row = headerRow.data;
        
        for (const key in row) {
            const value = String(row[key] || '').toLowerCase();
            
            if (value.includes('测量') || value.includes('读数') || value.includes('measured') || value.includes('reading')) {
                columns.measuredLoad = key;
            } else if (value.includes('葫芦') || value.includes('hoist')) {
                columns.attachedToHoist = key;
            }
        }
        
        return columns;
    },
    
    extractTrussFromRow(row, columns) {
        if (!columns.name && !columns.pointName) return null;
        
        const name = row[columns.name] || row[columns.pointName];
        if (!name) return null;
        
        return {
            id: Utils.generateId('truss'),
            name: String(name),
            type: 'box-truss',
            length: 10,
            width: 0.5,
            height: 0.5,
            position: {
                x: 0,
                y: 5,
                z: 0,
            },
            rotation: { x: 0, y: 0, z: 0 },
            points: [
                {
                    id: Utils.generateId('point'),
                    name: String(row[columns.pointName] || name),
                    position: {
                        x: Utils.parseWeight(row[columns.x]) || 0,
                        y: 5,
                        z: Utils.parseWeight(row[columns.z]) || 0,
                    },
                },
            ],
        };
    },
    
    extractEquipmentFromRow(row, columns) {
        if (!columns.name) return null;
        
        const name = String(row[columns.name] || '');
        if (!name) return null;
        
        let type = 'other';
        const lowerName = name.toLowerCase();
        const typeValue = columns.type ? String(row[columns.type] || '').toLowerCase() : '';
        
        if (lowerName.includes('灯') || lowerName.includes('light') || lowerName.includes('fixture') || 
            typeValue.includes('灯') || typeValue.includes('light')) {
            type = 'fixture';
        } else if (lowerName.includes('音箱') || lowerName.includes('speaker') || lowerName.includes('线阵列') || 
                   typeValue.includes('音箱') || typeValue.includes('speaker')) {
            type = 'speaker';
        }
        
        const hasSafetyRope = columns.hasSafetyRope ? 
            String(row[columns.hasSafetyRope]).toLowerCase().includes('有') || 
            String(row[columns.hasSafetyRope]).toLowerCase().includes('是') ||
            String(row[columns.hasSafetyRope]).toLowerCase().includes('yes') :
            true;
        
        return {
            id: Utils.generateId('eq'),
            name: name,
            type: type,
            weight: Utils.parseWeight(row[columns.weight]) || 10,
            mountedOn: null,
            position: {
                x: Utils.parseWeight(row[columns.x]) || 0,
                y: 5,
                z: Utils.parseWeight(row[columns.z]) || 0,
            },
            hasSafetyRope: hasSafetyRope,
        };
    },
    
    extractHoistFromRow(row, columns) {
        if (!columns.name) return null;
        
        const name = String(row[columns.name] || '');
        if (!name) return null;
        
        const hasSafetyRope = columns.hasSafetyRope ? 
            String(row[columns.hasSafetyRope]).toLowerCase().includes('有') || 
            String(row[columns.hasSafetyRope]).toLowerCase().includes('是') ||
            String(row[columns.hasSafetyRope]).toLowerCase().includes('yes') :
            true;
        
        return {
            id: Utils.generateId('hoist'),
            name: name,
            ratedLoad: Utils.parseWeight(row[columns.ratedLoad]) || 1000,
            attachedTo: row[columns.attachedTo] || null,
            position: {
                x: Utils.parseWeight(row[columns.x]) || 0,
                y: 8,
                z: Utils.parseWeight(row[columns.z]) || 0,
            },
            hasSafetyRope: hasSafetyRope,
        };
    },
    
    extractLoadCellFromRow(row, columns) {
        if (!columns.name) return null;
        
        const name = String(row[columns.name] || '');
        if (!name) return null;
        
        return {
            id: Utils.generateId('loadcell'),
            name: name,
            measuredLoad: Utils.parseWeight(row[columns.measuredLoad]) || 0,
            attachedToHoist: row[columns.attachedToHoist] || null,
        };
    },
};
