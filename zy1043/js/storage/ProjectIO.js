/**
 * 项目导入导出管理器
 */

const ProjectIO = {
    createProjectData(warehouse, pickingOrder = null) {
        const project = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            warehouse: warehouse.toJSON()
        };
        
        if (pickingOrder) {
            project.pickingOrder = pickingOrder.toJSON();
        }
        
        return project;
    },
    
    exportProject(warehouse, pickingOrder = null) {
        return this.createProjectData(warehouse, pickingOrder);
    },
    
    createExampleWarehouse() {
        const warehouse = new Warehouse({
            name: '示例仓库',
            length: 20,
            width: 15,
            height: 5,
            gridSize: 1,
            minAisleWidth: 1.2
        });
        
        const entrance1 = new Entrance({
            name: '主入口',
            x: 0,
            z: -7,
            length: 3,
            width: 1,
            height: 0.5,
            isDefaultStart: true
        });
        warehouse.addObject(entrance1);
        
        const entrance2 = new Entrance({
            name: '出库口',
            x: 0,
            z: 7,
            length: 3,
            width: 1,
            height: 0.5,
            isDefaultEnd: true
        });
        warehouse.addObject(entrance2);
        
        const forbidden = new ForbiddenZone({
            name: '柱子区域',
            x: 0,
            z: 0,
            length: 1.5,
            width: 1.5,
            height: 0.2,
            reason: '建筑结构柱，不可放置货架'
        });
        warehouse.addObject(forbidden);
        
        const shelfSlots1 = [
            { slot: 'A-01-A1', sku: 'SKU001' },
            { slot: 'A-01-A2', sku: 'SKU002' },
            { slot: 'A-01-B1', sku: 'SKU003' },
            { slot: 'A-01-B2', sku: 'SKU004' }
        ];
        
        const shelf1 = new Shelf({
            name: '货架 A-01',
            x: -5,
            z: -3,
            length: 3,
            width: 1,
            height: 2.5,
            color: 0x3b82f6,
            slots: shelfSlots1
        });
        warehouse.addObject(shelf1);
        
        const shelf2 = new Shelf({
            name: '货架 A-02',
            x: -5,
            z: 3,
            length: 3,
            width: 1,
            height: 2.5,
            color: 0x3b82f6,
            slots: [
                { slot: 'A-02-A1', sku: 'SKU005' },
                { slot: 'A-02-A2', sku: 'SKU006' }
            ]
        });
        warehouse.addObject(shelf2);
        
        const shelf3 = new Shelf({
            name: '货架 B-01',
            x: 5,
            z: -3,
            length: 3,
            width: 1,
            height: 2.5,
            color: 0x8b5cf6,
            slots: [
                { slot: 'B-01-A1', sku: 'SKU007' },
                { slot: 'B-01-A2', sku: 'SKU008' }
            ]
        });
        warehouse.addObject(shelf3);
        
        const shelf4 = new Shelf({
            name: '货架 B-02',
            x: 5,
            z: 3,
            length: 3,
            width: 1,
            height: 2.5,
            color: 0x8b5cf6,
            slots: [
                { slot: 'B-02-A1', sku: 'SKU009' },
                { slot: 'B-02-A2', sku: 'SKU010' }
            ]
        });
        warehouse.addObject(shelf4);
        
        const zone = new Zone({
            name: '快消品区',
            x: -5,
            z: 0,
            length: 5,
            width: 10,
            height: 0.1,
            color: 0x10b981,
            zoneType: 'fast_moving'
        });
        warehouse.addObject(zone);
        
        return {
            warehouse: warehouse,
            pickingOrder: this.createSamplePickingOrder()
        };
    },
    
    loadProject(projectData) {
        const result = this.importProject(projectData);
        if (!result.isValid) {
            throw new Error(result.errors[0]?.message || '项目数据无效');
        }
        return result.warehouse;
    },
    
    importProject(projectData) {
        const result = {
            isValid: true,
            errors: [],
            warehouse: null,
            pickingOrder: null
        };
        
        const validation = DataValidator.validateProject(projectData);
        if (!validation.isValid) {
            result.isValid = false;
            result.errors = validation.errors;
            return result;
        }
        
        try {
            if (projectData.warehouse) {
                result.warehouse = Warehouse.fromJSON(projectData.warehouse);
            } else if (projectData.objects) {
                result.warehouse = new Warehouse(Constants.DEFAULT_WAREHOUSE);
                projectData.objects.forEach(obj => {
                    result.warehouse.addObject(obj);
                });
            }
            
            if (projectData.pickingOrder) {
                result.pickingOrder = PickingOrder.fromJSON(projectData.pickingOrder);
            }
            
        } catch (e) {
            result.isValid = false;
            result.errors.push({
                type: '解析错误',
                message: `导入失败: ${e.message}`
            });
        }
        
        return result;
    },
    
    exportToJSON(warehouse, pickingOrder = null) {
        const project = this.exportProject(warehouse, pickingOrder);
        return JSON.stringify(project, null, 2);
    },
    
    importFromJSON(jsonString) {
        try {
            const projectData = JSON.parse(jsonString);
            return this.importProject(projectData);
        } catch (e) {
            return {
                isValid: false,
                errors: [{
                    type: '格式错误',
                    message: `JSON 解析失败: ${e.message}`
                }],
                warehouse: null,
                pickingOrder: null
            };
        }
    },
    
    downloadProject(warehouse, pickingOrder = null, filename = null) {
        const json = this.exportToJSON(warehouse, pickingOrder);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `warehouse-project-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    },
    
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                resolve(e.target.result);
            };
            
            reader.onerror = (e) => {
                reject(new Error('读取文件失败'));
            };
            
            reader.readAsText(file);
        });
    },
    
    async importFromFile(file) {
        try {
            const text = await this.readFileAsText(file);
            
            if (file.name.endsWith('.json')) {
                return this.importFromJSON(text);
            } else if (file.name.endsWith('.csv')) {
                const data = Utils.parseCSV(text);
                return {
                    isValid: true,
                    errors: [],
                    isPickingData: true,
                    pickingData: data,
                    format: 'csv'
                };
            } else {
                return {
                    isValid: false,
                    errors: [{
                        type: '格式错误',
                        message: '不支持的文件格式，仅支持 .json 和 .csv'
                    }]
                };
            }
            
        } catch (e) {
            return {
                isValid: false,
                errors: [{
                    type: '读取错误',
                    message: e.message
                }]
            };
        }
    },
    
    createSampleWarehouse() {
        const warehouse = new Warehouse({
            name: '示例仓库',
            length: 20,
            width: 15
        });
        
        const entrance1 = new Entrance({
            name: '主入口',
            x: 0,
            z: -7,
            length: 3,
            width: 1,
            isDefaultStart: true
        });
        warehouse.addObject(entrance1);
        
        const entrance2 = new Entrance({
            name: '出库口',
            x: 0,
            z: 7,
            length: 3,
            width: 1,
            isDefaultEnd: true
        });
        warehouse.addObject(entrance2);
        
        const forbidden = new ForbiddenZone({
            name: '柱子区域',
            x: 0,
            z: 0,
            length: 1.5,
            width: 1.5,
            reason: '建筑结构柱，不可放置货架'
        });
        warehouse.addObject(forbidden);
        
        const shelfSlots1 = [
            { slot: 'A-01-A1', sku: 'SKU001' },
            { slot: 'A-01-A2', sku: 'SKU002' },
            { slot: 'A-01-B1', sku: 'SKU003' },
            { slot: 'A-01-B2', sku: 'SKU004' }
        ];
        
        const shelf1 = new Shelf({
            name: '货架 A-01',
            x: -5,
            z: -3,
            length: 3,
            width: 1,
            height: 2.5,
            color: 0x3b82f6,
            slots: shelfSlots1
        });
        warehouse.addObject(shelf1);
        
        const shelf2 = new Shelf({
            name: '货架 A-02',
            x: -5,
            z: 3,
            length: 3,
            width: 1,
            height: 2.5,
            color: 0x3b82f6,
            slots: [
                { slot: 'A-02-A1', sku: 'SKU005' },
                { slot: 'A-02-A2', sku: 'SKU006' }
            ]
        });
        warehouse.addObject(shelf2);
        
        const shelf3 = new Shelf({
            name: '货架 B-01',
            x: 5,
            z: -3,
            length: 3,
            width: 1,
            height: 2.5,
            color: 0x8b5cf6,
            slots: [
                { slot: 'B-01-A1', sku: 'SKU007' },
                { slot: 'B-01-A2', sku: 'SKU008' }
            ]
        });
        warehouse.addObject(shelf3);
        
        const shelf4 = new Shelf({
            name: '货架 B-02',
            x: 5,
            z: 3,
            length: 3,
            width: 1,
            height: 2.5,
            color: 0x8b5cf6,
            slots: [
                { slot: 'B-02-A1', sku: 'SKU009' },
                { slot: 'B-02-A2', sku: 'SKU010' }
            ]
        });
        warehouse.addObject(shelf4);
        
        const zone = new Zone({
            name: '快消品区',
            x: -5,
            z: 0,
            length: 5,
            width: 10,
            color: 0x10b981,
            zoneType: 'fast_moving'
        });
        warehouse.addObject(zone);
        
        return warehouse;
    },
    
    createSamplePickingOrder() {
        return new PickingOrder({
            name: '示例拣货单 - 2024-01-15',
            items: [
                { orderNo: 'ORD20240115001', sku: 'SKU001', quantity: 10, shelfSlot: 'A-01-A1' },
                { orderNo: 'ORD20240115001', sku: 'SKU003', quantity: 5, shelfSlot: 'A-01-B1' },
                { orderNo: 'ORD20240115002', sku: 'SKU005', quantity: 20, shelfSlot: 'A-02-A1' },
                { orderNo: 'ORD20240115002', sku: 'SKU007', quantity: 8, shelfSlot: 'B-01-A1' },
                { orderNo: 'ORD20240115003', sku: 'SKU009', quantity: 15, shelfSlot: 'B-02-A1' }
            ]
        });
    },
    
    getSamplePickingJSON() {
        const data = [
            { "orderNo": "ORD20240115001", "sku": "SKU001", "quantity": 10, "shelfSlot": "A-01-A1" },
            { "orderNo": "ORD20240115001", "sku": "SKU003", "quantity": 5, "shelfSlot": "A-01-B1" },
            { "orderNo": "ORD20240115002", "sku": "SKU005", "quantity": 20, "shelfSlot": "A-02-A1" },
            { "orderNo": "ORD20240115002", "sku": "SKU007", "quantity": 8, "shelfSlot": "B-01-A1" },
            { "orderNo": "ORD20240115003", "sku": "SKU009", "quantity": 15, "shelfSlot": "B-02-A1" }
        ];
        return JSON.stringify(data, null, 2);
    },
    
    getSamplePickingCSV() {
        return `orderNo,sku,quantity,shelfSlot
ORD20240115001,SKU001,10,A-01-A1
ORD20240115001,SKU003,5,A-01-B1
ORD20240115002,SKU005,20,A-02-A1
ORD20240115002,SKU007,8,B-01-A1
ORD20240115003,SKU009,15,B-02-A1`;
    }
};
