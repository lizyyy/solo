const DataStore = {
    rooms: [],
    materials: [],
    purchases: [],
    changes: [],
    calculatedData: null,
    risks: [],
    
    init: function() {
        const saved = Storage.loadDraft();
        if (saved) {
            this.rooms = saved.rooms || [];
            this.materials = saved.materials || [];
            this.purchases = saved.purchases || [];
            this.changes = saved.changes || [];
            this.recalculate();
        }
    },
    
    loadRooms: function(data) {
        this.rooms = data.map(row => ({
            id: row.id || Utils.generateId(),
            name: row.name || row.房间名称 || '',
            width: Utils.parseNumber(row.width || row.宽度 || 0),
            length: Utils.parseNumber(row.length || row.长度 || 0),
            height: Utils.parseNumber(row.height || row.高度 || 0),
            area: Utils.parseNumber(row.area || row.面积 || 0),
            perimeter: Utils.parseNumber(row.perimeter || row.周长 || 0),
            notes: row.notes || row.备注 || ''
        }));
        
        this.rooms.forEach(room => {
            if (!room.area && room.width && room.length) {
                room.area = room.width * room.length;
            }
            if (!room.perimeter && room.width && room.length) {
                room.perimeter = 2 * (room.width + room.length);
            }
        });
        
        this.recalculate();
    },
    
    loadMaterials: function(data) {
        this.materials = data.map(row => ({
            id: row.id || Utils.generateId(),
            name: row.name || row.材料名称 || '',
            type: row.type || row.类型 || '',
            specification: row.specification || row.规格 || '',
            unitPrice: Utils.parseNumber(row.unitPrice || row.单价 || 0),
            unit: row.unit || row.单位 || Utils.getMaterialUnit(row.type || row.类型),
            lossRate: Utils.parseNumber(row.lossRate || row.损耗率 || 0),
            coverageArea: Utils.parseNumber(row.coverageArea || row.覆盖面积 || 0),
            coverageLength: Utils.parseNumber(row.coverageLength || row.覆盖长度 || 0),
            coveragePerUnit: Utils.parseNumber(row.coveragePerUnit || row.每单位覆盖 || 0),
            hasExpiry: (row.hasExpiry || row.是否有保质期 || '') === 'true' || 
                       (row.hasExpiry || row.是否有保质期 || '') === true,
            expiryDays: Utils.parseNumber(row.expiryDays || row.保质期天数 || 0),
            isAdhesive: (row.isAdhesive || row.是否为胶水 || '') === 'true' ||
                        (row.isAdhesive || row.是否为胶水 || '') === true,
            isAccessory: (row.isAccessory || row.是否为辅料 || '') === 'true' ||
                         (row.isAccessory || row.是否为辅料 || '') === true,
            notes: row.notes || row.备注 || ''
        }));
        
        this.recalculate();
    },
    
    loadPurchases: function(data) {
        this.purchases = data.map(row => ({
            id: row.id || Utils.generateId(),
            materialId: row.materialId || row.材料ID || '',
            materialName: row.materialName || row.材料名称 || '',
            batchNo: row.batchNo || row.批次号 || '',
            colorNo: row.colorNo || row.色号 || '',
            quantity: Utils.parseNumber(row.quantity || row.数量 || 0),
            unit: row.unit || row.单位 || '',
            unitPrice: Utils.parseNumber(row.unitPrice || row.单价 || 0),
            totalPrice: Utils.parseNumber(row.totalPrice || row.总价 || 0),
            purchaseDate: row.purchaseDate || row.采购日期 || '',
            expiryDate: row.expiryDate || row.到期日期 || '',
            supplier: row.supplier || row.供应商 || '',
            notes: row.notes || row.备注 || ''
        }));
        
        this.purchases.forEach(p => {
            if (!p.totalPrice && p.quantity && p.unitPrice) {
                p.totalPrice = p.quantity * p.unitPrice;
            }
        });
        
        this.recalculate();
    },
    
    loadChanges: function(data) {
        this.changes = data.map(row => ({
            id: row.id || Utils.generateId(),
            roomId: row.roomId || row.房间ID || '',
            roomName: row.roomName || row.房间名称 || '',
            materialId: row.materialId || row.材料ID || '',
            materialName: row.materialName || row.材料名称 || '',
            changeDate: row.changeDate || row.变更日期 || '',
            changeType: row.changeType || row.变更类型 || '',
            reason: row.reason || row.变更原因 || '',
            originalWidth: Utils.parseNumber(row.originalWidth || row.原宽度 || 0),
            originalLength: Utils.parseNumber(row.originalLength || row.原长度 || 0),
            originalArea: Utils.parseNumber(row.originalArea || row.原面积 || 0),
            originalPerimeter: Utils.parseNumber(row.originalPerimeter || row.原周长 || 0),
            newWidth: Utils.parseNumber(row.newWidth || row.新宽度 || 0),
            newLength: Utils.parseNumber(row.newLength || row.新长度 || 0),
            newArea: Utils.parseNumber(row.newArea || row.新面积 || 0),
            newPerimeter: Utils.parseNumber(row.newPerimeter || row.新周长 || 0),
            areaDifference: Utils.parseNumber(row.areaDifference || row.面积差 || 0),
            perimeterDifference: Utils.parseNumber(row.perimeterDifference || row.周长差 || 0),
            notes: row.notes || row.备注 || ''
        }));
        
        this.recalculate();
    },
    
    addRoom: function(room) {
        room.id = room.id || Utils.generateId();
        this.rooms.push(room);
        this.recalculate();
    },
    
    updateRoom: function(id, updates) {
        const index = this.rooms.findIndex(r => r.id === id);
        if (index !== -1) {
            this.rooms[index] = { ...this.rooms[index], ...updates };
            this.recalculate();
        }
    },
    
    deleteRoom: function(id) {
        this.rooms = this.rooms.filter(r => r.id !== id);
        this.recalculate();
    },
    
    addMaterial: function(material) {
        material.id = material.id || Utils.generateId();
        this.materials.push(material);
        this.recalculate();
    },
    
    updateMaterial: function(id, updates) {
        const index = this.materials.findIndex(m => m.id === id);
        if (index !== -1) {
            this.materials[index] = { ...this.materials[index], ...updates };
            this.recalculate();
        }
    },
    
    deleteMaterial: function(id) {
        this.materials = this.materials.filter(m => m.id !== id);
        this.recalculate();
    },
    
    addPurchase: function(purchase) {
        purchase.id = purchase.id || Utils.generateId();
        this.purchases.push(purchase);
        this.recalculate();
    },
    
    updatePurchase: function(id, updates) {
        const index = this.purchases.findIndex(p => p.id === id);
        if (index !== -1) {
            this.purchases[index] = { ...this.purchases[index], ...updates };
            this.recalculate();
        }
    },
    
    deletePurchase: function(id) {
        this.purchases = this.purchases.filter(p => p.id !== id);
        this.recalculate();
    },
    
    addChange: function(change) {
        change.id = change.id || Utils.generateId();
        this.changes.push(change);
        this.recalculate();
    },
    
    updateChange: function(id, updates) {
        const index = this.changes.findIndex(c => c.id === id);
        if (index !== -1) {
            this.changes[index] = { ...this.changes[index], ...updates };
            this.recalculate();
        }
    },
    
    deleteChange: function(id) {
        this.changes = this.changes.filter(c => c.id !== id);
        this.recalculate();
    },
    
    recalculate: function() {
        this.calculatedData = Calculator.calculateAll(
            this.rooms,
            this.materials,
            this.purchases,
            this.changes
        );
        this.risks = RiskDetector.detectAll(this.calculatedData, this.purchases, this.materials);
    },
    
    getRoomMaterials: function(roomId) {
        if (!this.calculatedData) return [];
        return this.calculatedData.roomMaterials.filter(rm => rm.roomId === roomId);
    },
    
    getMaterialRooms: function(materialId) {
        if (!this.calculatedData) return [];
        return this.calculatedData.roomMaterials.filter(rm => rm.materialId === materialId);
    },
    
    getMaterialPurchases: function(materialId) {
        return this.purchases.filter(p => p.materialId === materialId);
    },
    
    getRoomChanges: function(roomId) {
        return this.changes.filter(c => c.roomId === roomId);
    },
    
    getMaterialTypeSummary: function() {
        if (!this.calculatedData) return [];
        
        const typeMap = {};
        this.calculatedData.materialSummary.forEach(ms => {
            const material = this.materials.find(m => m.id === ms.materialId);
            const type = material?.type || '其他';
            
            if (!typeMap[type]) {
                typeMap[type] = {
                    type,
                    totalRequired: 0,
                    totalPurchased: 0,
                    totalShortage: 0,
                    totalSurplus: 0,
                    materials: []
                };
            }
            
            typeMap[type].totalRequired += ms.totalRequired;
            typeMap[type].totalPurchased += ms.totalPurchased;
            typeMap[type].totalShortage += Math.max(0, ms.totalRequired - ms.totalPurchased);
            typeMap[type].totalSurplus += Math.max(0, ms.totalPurchased - ms.totalRequired);
            typeMap[type].materials.push(ms);
        });
        
        return Object.values(typeMap);
    },
    
    exportData: function() {
        return {
            rooms: this.rooms,
            materials: this.materials,
            purchases: this.purchases,
            changes: this.changes,
            calculatedData: this.calculatedData,
            risks: this.risks,
            exportedAt: new Date().toISOString()
        };
    },
    
    importData: function(data) {
        if (data.rooms) this.rooms = data.rooms;
        if (data.materials) this.materials = data.materials;
        if (data.purchases) this.purchases = data.purchases;
        if (data.changes) this.changes = data.changes;
        this.recalculate();
    }
};

window.DataStore = DataStore;
