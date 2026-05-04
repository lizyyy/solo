const DataImport = {
    currentPreviewData: null,
    currentImportType: null,

    init: function() {
        this.bindEvents();
    },

    bindEvents: function() {
        const fileInputs = [
            { id: 'agreementFile', type: 'agreement' },
            { id: 'healthFile', type: 'health' },
            { id: 'cageFile', type: 'cage' },
            { id: 'medicationFile', type: 'medication' }
        ];

        fileInputs.forEach(({ id, type }) => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', (e) => this.handleFileSelect(e, type));
            }
        });

        const previewBtns = [
            { id: 'previewAgreementBtn', type: 'agreement' },
            { id: 'previewHealthBtn', type: 'health' },
            { id: 'previewCageBtn', type: 'cage' },
            { id: 'previewMedicationBtn', type: 'medication' }
        ];

        previewBtns.forEach(({ id, type }) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => this.previewData(type));
            }
        });

        const importBtns = [
            { id: 'importAgreementBtn', type: 'agreement' },
            { id: 'importHealthBtn', type: 'health' },
            { id: 'importCageBtn', type: 'cage' },
            { id: 'importMedicationBtn', type: 'medication' }
        ];

        importBtns.forEach(({ id, type }) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => this.confirmImport(type));
            }
        });
    },

    handleFileSelect: function(event, importType) {
        const file = event.target.files[0];
        if (!file) return;

        const infoId = this.getInfoId(importType);
        const infoElement = document.getElementById(infoId);
        
        if (infoElement) {
            infoElement.textContent = `已选择文件: ${file.name} (${this.formatFileSize(file.size)})`;
        }

        const previewBtnId = this.getPreviewBtnId(importType);
        const previewBtn = document.getElementById(previewBtnId);
        if (previewBtn) {
            previewBtn.disabled = false;
        }
    },

    getInfoId: function(importType) {
        const idMap = {
            'agreement': 'agreementInfo',
            'health': 'healthInfo',
            'cage': 'cageInfo',
            'medication': 'medicationInfo'
        };
        return idMap[importType];
    },

    getPreviewBtnId: function(importType) {
        const idMap = {
            'agreement': 'previewAgreementBtn',
            'health': 'previewHealthBtn',
            'cage': 'previewCageBtn',
            'medication': 'previewMedicationBtn'
        };
        return idMap[importType];
    },

    getImportBtnId: function(importType) {
        const idMap = {
            'agreement': 'importAgreementBtn',
            'health': 'importHealthBtn',
            'cage': 'importCageBtn',
            'medication': 'importMedicationBtn'
        };
        return idMap[importType];
    },

    getFileInputId: function(importType) {
        const idMap = {
            'agreement': 'agreementFile',
            'health': 'healthFile',
            'cage': 'cageFile',
            'medication': 'medicationFile'
        };
        return idMap[importType];
    },

    formatFileSize: function(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    previewData: function(importType) {
        const fileInputId = this.getFileInputId(importType);
        const fileInput = document.getElementById(fileInputId);
        
        if (!fileInput || !fileInput.files[0]) {
            Utils.showNotification('请先选择文件', 'warning');
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            const content = e.target.result;
            let parsedData;

            if (file.name.endsWith('.csv')) {
                parsedData = Utils.parseCSV(content);
            } else if (file.name.endsWith('.json')) {
                try {
                    const jsonData = JSON.parse(content);
                    parsedData = {
                        headers: Object.keys(jsonData[0] || {}),
                        data: jsonData
                    };
                } catch (error) {
                    Utils.showNotification('JSON 文件格式错误', 'danger');
                    return;
                }
            } else {
                Utils.showNotification('不支持的文件格式，请使用 CSV 或 JSON', 'warning');
                return;
            }

            this.currentPreviewData = parsedData;
            this.currentImportType = importType;
            
            this.showPreviewTable(parsedData, importType);
            
            const importBtnId = this.getImportBtnId(importType);
            const importBtn = document.getElementById(importBtnId);
            if (importBtn) {
                importBtn.disabled = false;
            }

            Utils.showNotification(`成功解析 ${parsedData.data.length} 条记录`, 'success');
        };

        reader.onerror = () => {
            Utils.showNotification('读取文件失败', 'danger');
        };

        reader.readAsText(file);
    },

    showPreviewTable: function(parsedData, importType) {
        const container = document.getElementById('previewTableContainer');
        if (!container) return;

        if (!parsedData || !parsedData.data || parsedData.data.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>没有数据可显示</p></div>';
            return;
        }

        const typeName = this.getImportTypeName(importType);
        let html = `<p class="preview-info">预览 ${typeName} 数据，共 ${parsedData.data.length} 条记录</p>`;
        html += '<table class="preview-table">';
        
        html += '<thead><tr>';
        parsedData.headers.forEach(header => {
            html += `<th>${header}</th>`;
        });
        html += '</tr></thead>';
        
        html += '<tbody>';
        const displayLimit = 10;
        const displayData = parsedData.data.slice(0, displayLimit);
        
        displayData.forEach(row => {
            html += '<tr>';
            parsedData.headers.forEach(header => {
                const value = row[header] !== undefined ? row[header] : '';
                html += `<td>${value}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        
        if (parsedData.data.length > displayLimit) {
            html += `<p class="more-info">... 还有 ${parsedData.data.length - displayLimit} 条记录未显示</p>`;
        }

        container.innerHTML = html;
    },

    getImportTypeName: function(importType) {
        const nameMap = {
            'agreement': '寄养协议',
            'health': '宠物体重/过敏信息',
            'cage': '笼位表',
            'medication': '每日喂药计划'
        };
        return nameMap[importType] || importType;
    },

    confirmImport: function(importType) {
        if (!this.currentPreviewData || this.currentImportType !== importType) {
            Utils.showNotification('请先预览数据', 'warning');
            return;
        }

        const data = this.currentPreviewData.data;
        
        switch (importType) {
            case 'agreement':
                this.importAgreements(data);
                break;
            case 'health':
                this.importHealthData(data);
                break;
            case 'cage':
                this.importCageData(data);
                break;
            case 'medication':
                this.importMedicationPlans(data);
                break;
            default:
                Utils.showNotification('未知的导入类型', 'danger');
                return;
        }

        this.updateImportStatus(importType, data.length);
        this.runValidators();
        Utils.showNotification(`成功导入 ${data.length} 条 ${this.getImportTypeName(importType)} 数据`, 'success');
    },

    importAgreements: function(data) {
        const importedPets = [];
        
        data.forEach(row => {
            const pet = this.parseAgreementRow(row);
            if (pet && pet.petId) {
                const existingPet = Storage.getPetByPetId(pet.petId);
                if (existingPet) {
                    Storage.updatePet(existingPet.id, pet);
                } else {
                    Storage.addPet(pet);
                }
                importedPets.push(pet);
            }
        });

        Storage.addImportHistory({
            type: 'agreement',
            count: importedPets.length,
            description: `导入了 ${importedPets.length} 条寄养协议`
        });

        return importedPets;
    },

    parseAgreementRow: function(row) {
        const pet = {
            petId: this.getFieldValue(row, ['petId', '宠物ID', 'id', '编号']) || 
                   this.getFieldValue(row, ['ownerName', '主人姓名', '主人']) + '_' + 
                   this.getFieldValue(row, ['petName', '宠物名', '姓名', '名字']),
            petName: this.getFieldValue(row, ['petName', '宠物名', '姓名', '名字']),
            ownerName: this.getFieldValue(row, ['ownerName', '主人姓名', '主人', '联系人']),
            ownerPhone: this.getFieldValue(row, ['ownerPhone', '主人电话', '联系电话', '电话']),
            species: this.getFieldValue(row, ['species', '品种', '种类', '物种']),
            breed: this.getFieldValue(row, ['breed', '品种', '血统']),
            gender: this.getFieldValue(row, ['gender', '性别']),
            birthDate: this.getFieldValue(row, ['birthDate', '出生日期', '生日', '年龄']),
            color: this.getFieldValue(row, ['color', '毛色', '颜色']),
            weight: parseFloat(this.getFieldValue(row, ['weight', '体重'])) || null,
            allergies: this.parseAllergies(this.getFieldValue(row, ['allergies', '过敏', '过敏原', '过敏史'])),
            checkInDate: this.getFieldValue(row, ['checkInDate', '入住日期', '开始日期', '寄养开始']),
            checkOutDate: this.getFieldValue(row, ['checkOutDate', '离开日期', '结束日期', '寄养结束']),
            cageNumber: this.getFieldValue(row, ['cageNumber', '笼位号', '笼号', '笼子编号']),
            specialInstructions: this.getFieldValue(row, ['specialInstructions', '特殊说明', '注意事项', '备注']),
            status: 'active'
        };

        return pet;
    },

    importHealthData: function(data) {
        let updatedCount = 0;
        
        data.forEach(row => {
            const petId = this.getFieldValue(row, ['petId', '宠物ID', 'id', '编号']);
            if (!petId) return;

            const pet = Storage.getPetByPetId(petId);
            if (!pet) {
                const newPet = {
                    petId: petId,
                    petName: this.getFieldValue(row, ['petName', '宠物名', '姓名']) || petId,
                    weight: parseFloat(this.getFieldValue(row, ['weight', '体重'])) || null,
                    allergies: this.parseAllergies(this.getFieldValue(row, ['allergies', '过敏', '过敏原', '过敏史'])),
                    healthNotes: this.getFieldValue(row, ['healthNotes', '健康备注', '健康状况']),
                    status: 'active'
                };
                Storage.addPet(newPet);
                updatedCount++;
            } else {
                const updates = {};
                const weight = parseFloat(this.getFieldValue(row, ['weight', '体重']));
                if (!isNaN(weight)) {
                    updates.weight = weight;
                }
                
                const allergies = this.parseAllergies(this.getFieldValue(row, ['allergies', '过敏', '过敏原', '过敏史']));
                if (allergies && allergies.length > 0) {
                    updates.allergies = allergies;
                }
                
                const healthNotes = this.getFieldValue(row, ['healthNotes', '健康备注', '健康状况']);
                if (healthNotes) {
                    updates.healthNotes = healthNotes;
                }
                
                if (Object.keys(updates).length > 0) {
                    Storage.updatePet(pet.id, updates);
                    updatedCount++;
                }
            }
        });

        Storage.addImportHistory({
            type: 'health',
            count: updatedCount,
            description: `更新了 ${updatedCount} 条宠物体重/过敏信息`
        });

        return updatedCount;
    },

    importCageData: function(data) {
        const importedCages = [];
        
        data.forEach(row => {
            const cage = this.parseCageRow(row);
            if (cage && cage.cageNumber) {
                const existingCage = Storage.getCageByNumber(cage.cageNumber);
                if (existingCage) {
                    Storage.updateCage(existingCage.id, cage);
                } else {
                    Storage.addCage(cage);
                }
                importedCages.push(cage);
            }
        });

        Storage.addImportHistory({
            type: 'cage',
            count: importedCages.length,
            description: `导入了 ${importedCages.length} 条笼位数据`
        });

        return importedCages;
    },

    parseCageRow: function(row) {
        const cageNumber = this.getFieldValue(row, ['cageNumber', '笼位号', '笼号', '笼子编号', '笼位编号']);
        const petIds = this.parsePetIds(this.getFieldValue(row, ['petIds', '宠物ID列表', '宠物', '同笼宠物']));
        
        return {
            cageNumber: cageNumber,
            petIds: petIds,
            location: this.getFieldValue(row, ['location', '位置', '区域']),
            capacity: parseInt(this.getFieldValue(row, ['capacity', '容量', '最大容纳'])) || 2,
            notes: this.getFieldValue(row, ['notes', '备注', '说明']),
            date: this.getFieldValue(row, ['date', '日期']) || Utils.getToday()
        };
    },

    importMedicationPlans: function(data) {
        const importedPlans = [];
        const medications = [];

        data.forEach(row => {
            const plan = this.parseMedicationPlanRow(row);
            if (plan && plan.petId && plan.medicationName) {
                Storage.addMedicationPlan(plan);
                importedPlans.push(plan);

                const existingMed = Storage.getMedicationByName(plan.medicationName);
                if (!existingMed && !medications.find(m => m.name === plan.medicationName)) {
                    medications.push({
                        name: plan.medicationName,
                        category: plan.medicationCategory || '其他',
                        unit: plan.unit || '片',
                        defaultDose: plan.dosePerKg || null,
                        minDose: plan.minDose || null,
                        maxDose: plan.maxDose || null,
                        contraindications: plan.contraindications || [],
                        notes: plan.medicationNotes || ''
                    });
                }
            }
        });

        medications.forEach(med => {
            Storage.addMedication(med);
        });

        Storage.addImportHistory({
            type: 'medication',
            count: importedPlans.length,
            description: `导入了 ${importedPlans.length} 条喂药计划`
        });

        return importedPlans;
    },

    parseMedicationPlanRow: function(row) {
        const petId = this.getFieldValue(row, ['petId', '宠物ID', 'id', '编号']);
        const medicationName = this.getFieldValue(row, ['medicationName', '药品名称', '药品', '药名', '药物']);
        
        if (!petId || !medicationName) return null;

        let dose = parseFloat(this.getFieldValue(row, ['dose', '剂量', '用量']));
        const dosePerKg = parseFloat(this.getFieldValue(row, ['dosePerKg', '每公斤剂量', '单位剂量']));
        const weight = parseFloat(this.getFieldValue(row, ['weight', '体重']));
        
        if (isNaN(dose) && !isNaN(dosePerKg) && !isNaN(weight)) {
            dose = Utils.calculateDose(weight, dosePerKg);
        }

        return {
            petId: petId,
            petName: this.getFieldValue(row, ['petName', '宠物名', '姓名']) || petId,
            medicationName: medicationName,
            medicationCategory: this.getFieldValue(row, ['medicationCategory', '药品分类', '分类', '类别']),
            dose: dose,
            dosePerKg: dosePerKg,
            minDose: parseFloat(this.getFieldValue(row, ['minDose', '最小剂量'])),
            maxDose: parseFloat(this.getFieldValue(row, ['maxDose', '最大剂量'])),
            unit: this.getFieldValue(row, ['unit', '单位', '计量单位']) || '片',
            frequency: this.getFieldValue(row, ['frequency', '频率', '频次', '次数']),
            time: this.getFieldValue(row, ['time', '时间', '喂药时间']),
            shift: this.parseShift(this.getFieldValue(row, ['shift', '班次', '时段'])),
            date: this.getFieldValue(row, ['date', '日期']) || Utils.getToday(),
            route: this.getFieldValue(row, ['route', '给药途径', '途径']),
            instructions: this.getFieldValue(row, ['instructions', '用药说明', '说明', '注意事项']),
            contraindications: this.parseAllergies(this.getFieldValue(row, ['contraindications', '禁忌症', '禁忌'])),
            medicationNotes: this.getFieldValue(row, ['medicationNotes', '药品备注']),
            status: 'pending',
            priority: this.getFieldValue(row, ['priority', '优先级', '重要性']) || 'normal'
        };
    },

    getFieldValue: function(row, possibleKeys) {
        for (const key of possibleKeys) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                return String(row[key]).trim();
            }
            
            for (const rowKey in row) {
                if (rowKey.toLowerCase() === key.toLowerCase() || 
                    rowKey.includes(key) || 
                    key.includes(rowKey)) {
                    if (row[rowKey] !== undefined && row[rowKey] !== null && row[rowKey] !== '') {
                        return String(row[rowKey]).trim();
                    }
                }
            }
        }
        return '';
    },

    parseAllergies: function(value) {
        if (!value) return [];
        
        if (Array.isArray(value)) {
            return value.filter(v => v && v.trim());
        }
        
        const strValue = String(value);
        const separators = [',', ';', '、', '，', '；'];
        
        for (const sep of separators) {
            if (strValue.includes(sep)) {
                return strValue.split(sep).map(s => s.trim()).filter(s => s);
            }
        }
        
        return [strValue.trim()].filter(s => s);
    },

    parsePetIds: function(value) {
        if (!value) return [];
        
        if (Array.isArray(value)) {
            return value.filter(v => v && v.trim());
        }
        
        const strValue = String(value);
        const separators = [',', ';', '、', '，', '；', ' '];
        
        for (const sep of separators) {
            if (strValue.includes(sep)) {
                return strValue.split(sep).map(s => s.trim()).filter(s => s);
            }
        }
        
        return [strValue.trim()].filter(s => s);
    },

    parseShift: function(value) {
        if (!value) return 'morning';
        
        const shiftMap = {
            '早班': 'morning',
            '早上': 'morning',
            '上午': 'morning',
            'morning': 'morning',
            '中班': 'afternoon',
            '中午': 'afternoon',
            '下午': 'afternoon',
            'afternoon': 'afternoon',
            '晚班': 'evening',
            '晚上': 'evening',
            '夜间': 'evening',
            'evening': 'evening',
            'night': 'evening'
        };
        
        return shiftMap[value.trim()] || 'morning';
    },

    updateImportStatus: function(importType, count) {
        const statusList = document.getElementById('importStatusList');
        if (!statusList) return;

        const typeName = this.getImportTypeName(importType);
        const now = Utils.formatDateTime(new Date());
        
        let html = statusList.innerHTML;
        html += `
            <div class="import-status-item">
                <span class="icon">✅</span>
                <div>
                    <strong>${typeName}</strong> - 成功导入 ${count} 条记录
                    <br>
                    <span class="time">${now}</span>
                </div>
            </div>
        `;
        
        statusList.innerHTML = html;
    },

    runValidators: function() {
        if (typeof Validators !== 'undefined' && Validators.runAllChecks) {
            Validators.runAllChecks();
        }
    },

    exportSampleData: function(type) {
        let sampleData;
        
        switch (type) {
            case 'agreement':
                sampleData = [
                    { petId: 'P001', petName: '小白', ownerName: '张三', ownerPhone: '13800138001', species: '狗', breed: '金毛', gender: '公', birthDate: '2020-01-15', weight: 25, checkInDate: Utils.getToday(), checkOutDate: Utils.formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), cageNumber: 'A01', specialInstructions: '性格温顺，喜欢散步' },
                    { petId: 'P002', petName: '咪咪', ownerName: '李四', ownerPhone: '13800138002', species: '猫', breed: '布偶', gender: '母', birthDate: '2021-05-20', weight: 4.5, checkInDate: Utils.getToday(), checkOutDate: Utils.formatDate(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)), cageNumber: 'B02', specialInstructions: '比较胆小，需要安静环境' }
                ];
                break;
            case 'health':
                sampleData = [
                    { petId: 'P001', weight: 25, allergies: '青霉素,花生', healthNotes: '健康状况良好' },
                    { petId: 'P002', weight: 4.5, allergies: '海鲜', healthNotes: '需注意饮食' }
                ];
                break;
            case 'cage':
                sampleData = [
                    { cageNumber: 'A01', petIds: 'P001', location: 'A区', capacity: 2, notes: '大型犬笼' },
                    { cageNumber: 'B02', petIds: 'P002', location: 'B区', capacity: 1, notes: '猫专用笼' }
                ];
                break;
            case 'medication':
                sampleData = [
                    { petId: 'P001', petName: '小白', medicationName: '阿莫西林', medicationCategory: '抗生素', dose: 2, dosePerKg: 0.08, unit: '片', time: '08:00', shift: 'morning', date: Utils.getToday(), instructions: '饭后服用' },
                    { petId: 'P001', petName: '小白', medicationName: '阿莫西林', medicationCategory: '抗生素', dose: 2, dosePerKg: 0.08, unit: '片', time: '20:00', shift: 'evening', date: Utils.getToday(), instructions: '饭后服用' },
                    { petId: 'P002', petName: '咪咪', medicationName: '化毛膏', medicationCategory: '保健品', dose: 5, unit: 'g', time: '12:00', shift: 'afternoon', date: Utils.getToday(), instructions: '直接食用或混在食物中' }
                ];
                break;
            default:
                return;
        }

        const csv = Utils.toCSV(sampleData);
        const filename = `sample_${type}_${Utils.getToday()}.csv`;
        Utils.downloadFile(csv, filename, 'text/csv;charset=utf-8');
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataImport;
}
