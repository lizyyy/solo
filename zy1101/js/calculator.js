const Calculator = {
    calculateAll: function(rooms, materials, purchases, changes) {
        const result = {
            roomMaterials: [],
            materialSummary: [],
            roomSummary: []
        };
        
        rooms.forEach(room => {
            const roomChanges = changes.filter(c => c.roomId === room.id);
            const effectiveRoom = this.applyChangesToRoom(room, roomChanges);
            
            materials.forEach(material => {
                const roomMaterial = this.calculateRoomMaterial(
                    effectiveRoom,
                    material,
                    purchases,
                    roomChanges
                );
                
                if (roomMaterial.required > 0) {
                    result.roomMaterials.push(roomMaterial);
                }
            });
            
            result.roomSummary.push({
                roomId: room.id,
                roomName: room.name,
                originalArea: room.area,
                effectiveArea: effectiveRoom.area,
                originalPerimeter: room.perimeter,
                effectivePerimeter: effectiveRoom.perimeter,
                changeCount: roomChanges.length
            });
        });
        
        materials.forEach(material => {
            const roomMaterials = result.roomMaterials.filter(rm => rm.materialId === material.id);
            const materialPurchases = purchases.filter(p => p.materialId === material.id);
            
            const totalRequired = roomMaterials.reduce((sum, rm) => sum + rm.totalRequired, 0);
            const totalPurchased = materialPurchases.reduce((sum, p) => sum + p.quantity, 0);
            const totalCost = materialPurchases.reduce((sum, p) => sum + (p.totalPrice || 0), 0);
            
            result.materialSummary.push({
                materialId: material.id,
                materialName: material.name,
                materialType: material.type,
                unit: material.unit,
                totalRequired: totalRequired,
                totalPurchased: totalPurchased,
                shortage: Math.max(0, totalRequired - totalPurchased),
                surplus: Math.max(0, totalPurchased - totalRequired),
                totalCost: totalCost,
                roomMaterials: roomMaterials,
                purchases: materialPurchases
            });
        });
        
        return result;
    },
    
    applyChangesToRoom: function(room, changes) {
        let effectiveRoom = {
            ...room,
            effectiveArea: room.area,
            effectivePerimeter: room.perimeter,
            changeHistory: []
        };
        
        const relevantChanges = changes
            .filter(c => !c.materialId || c.materialId === '')
            .sort((a, b) => new Date(a.changeDate) - new Date(b.changeDate));
        
        relevantChanges.forEach(change => {
            if (change.newArea > 0) {
                effectiveRoom.effectiveArea = change.newArea;
                effectiveRoom.effectivePerimeter = change.newPerimeter || effectiveRoom.effectivePerimeter;
            }
            effectiveRoom.changeHistory.push(change);
        });
        
        return effectiveRoom;
    },
    
    calculateRoomMaterial: function(effectiveRoom, material, purchases, roomChanges) {
        const materialChanges = roomChanges.filter(c => 
            c.materialId === material.id || 
            c.materialName === material.name
        );
        
        let area = effectiveRoom.effectiveArea || effectiveRoom.area;
        let perimeter = effectiveRoom.effectivePerimeter || effectiveRoom.perimeter;
        
        materialChanges.sort((a, b) => new Date(a.changeDate) - new Date(b.changeDate));
        materialChanges.forEach(change => {
            if (change.newArea > 0) area = change.newArea;
            if (change.newPerimeter > 0) perimeter = change.newPerimeter;
        });
        
        const baseRequired = this.calculateBaseQuantity(material, area, perimeter);
        const lossRequired = this.calculateWithLoss(baseRequired, material.lossRate);
        const totalRequired = this.roundUpToPurchaseUnit(lossRequired, material);
        
        const materialPurchases = purchases.filter(p => 
            p.materialId === material.id || 
            p.materialName === material.name
        );
        
        const totalPurchased = materialPurchases.reduce((sum, p) => sum + p.quantity, 0);
        
        const shortage = Math.max(0, totalRequired - totalPurchased);
        const surplus = Math.max(0, totalPurchased - totalRequired);
        
        const status = this.getStatus(totalRequired, totalPurchased);
        
        return {
            roomId: effectiveRoom.id,
            roomName: effectiveRoom.name,
            materialId: material.id,
            materialName: material.name,
            materialType: material.type,
            unit: material.unit,
            
            area: area,
            perimeter: perimeter,
            originalArea: effectiveRoom.area,
            originalPerimeter: effectiveRoom.perimeter,
            
            baseRequired: baseRequired,
            lossRate: material.lossRate,
            lossRequired: lossRequired,
            totalRequired: totalRequired,
            
            totalPurchased: totalPurchased,
            shortage: shortage,
            surplus: surplus,
            
            status: status,
            changeCount: materialChanges.length,
            changes: materialChanges,
            purchases: materialPurchases,
            
            calculationDetails: {
                area: area,
                perimeter: perimeter,
                material: material,
                baseRequired: baseRequired,
                lossRate: material.lossRate,
                lossRequired: lossRequired,
                totalRequired: totalRequired,
                steps: this.getCalculationSteps(material, area, perimeter, baseRequired, lossRequired, totalRequired)
            }
        };
    },
    
    calculateBaseQuantity: function(material, area, perimeter) {
        const type = material.type;
        
        if (material.coveragePerUnit > 0) {
            if (['瓷砖', '地板', '壁纸', '玻璃'].includes(type)) {
                return area / material.coveragePerUnit;
            }
            if (['踢脚线'].includes(type)) {
                return perimeter / material.coveragePerUnit;
            }
        }
        
        switch (type) {
            case '瓷砖':
            case '地板':
            case '壁纸':
            case '玻璃':
                return area;
            case '踢脚线':
                return perimeter;
            case '乳胶漆':
                const coverageArea = material.coverageArea || 5;
                const coats = 2;
                return Math.ceil((area * coats) / coverageArea);
            case '木门':
            case '五金':
            case '胶水':
            case '辅料':
            case '水泥':
            case '沙子':
                return 1;
            default:
                return area;
        }
    },
    
    calculateWithLoss: function(quantity, lossRate) {
        if (!lossRate || lossRate <= 0) return quantity;
        return quantity * (1 + lossRate / 100);
    },
    
    roundUpToPurchaseUnit: function(quantity, material) {
        const type = material.type;
        
        if (['乳胶漆', '胶水', '辅料', '水泥', '沙子', '木门', '五金'].includes(type)) {
            return Math.ceil(quantity);
        }
        
        return Utils.roundUp(quantity, 2);
    },
    
    getStatus: function(required, purchased) {
        const difference = purchased - required;
        const percentage = required > 0 ? (difference / required) * 100 : 0;
        
        if (percentage < -10) {
            return 'shortage';
        } else if (percentage > 30) {
            return 'surplus';
        }
        return 'balanced';
    },
    
    getCalculationSteps: function(material, area, perimeter, baseRequired, lossRequired, totalRequired) {
        const steps = [];
        
        steps.push({
            label: `房间面积`,
            value: `${Utils.formatNumber(area)} ㎡`,
            detail: `宽度 × 长度 = ${area} ㎡`
        });
        
        if (['踢脚线'].includes(material.type)) {
            steps.push({
                label: `房间周长`,
                value: `${Utils.formatNumber(perimeter)} 米`,
                detail: `2 × (宽度 + 长度) = ${perimeter} 米`
            });
        }
        
        steps.push({
            label: `基础需求量`,
            value: `${Utils.formatNumber(baseRequired)} ${material.unit}`,
            detail: this.getBaseCalculationDetail(material, area, perimeter)
        });
        
        if (material.lossRate > 0) {
            steps.push({
                label: `加损耗 (${material.lossRate}%)`,
                value: `${Utils.formatNumber(lossRequired)} ${material.unit}`,
                detail: `${Utils.formatNumber(baseRequired)} × (1 + ${material.lossRate}%) = ${Utils.formatNumber(lossRequired)}`
            });
        }
        
        steps.push({
            label: `最终需采购量`,
            value: `${Utils.formatNumber(totalRequired)} ${material.unit}`,
            detail: '向上取整到可购买单位'
        });
        
        return steps;
    },
    
    getBaseCalculationDetail: function(material, area, perimeter) {
        switch (material.type) {
            case '瓷砖':
            case '地板':
            case '壁纸':
            case '玻璃':
                if (material.coveragePerUnit > 0) {
                    return `面积 ÷ 每单位覆盖 = ${area} ÷ ${material.coveragePerUnit} = ${Utils.formatNumber(area / material.coveragePerUnit)}`;
                }
                return `按面积计算: ${area} ㎡`;
            case '踢脚线':
                if (material.coveragePerUnit > 0) {
                    return `周长 ÷ 每单位覆盖 = ${perimeter} ÷ ${material.coveragePerUnit} = ${Utils.formatNumber(perimeter / material.coveragePerUnit)}`;
                }
                return `按周长计算: ${perimeter} 米`;
            case '乳胶漆':
                const coverageArea = material.coverageArea || 5;
                const coats = 2;
                return `(面积 × 涂刷次数) ÷ 每桶覆盖 = (${area} × ${coats}) ÷ ${coverageArea} = ${Math.ceil((area * coats) / coverageArea)} 桶`;
            case '木门':
            case '五金':
                return '按件数计算';
            case '胶水':
            case '辅料':
            case '水泥':
            case '沙子':
                return '按包装单位估算';
            default:
                return '按面积计算';
        }
    }
};

window.Calculator = Calculator;
