(function() {
    'use strict';

    const PRICING = {
        types: {
            small: { name: '小型犬', basePrice: 80 },
            medium: { name: '中型犬', basePrice: 120 },
            large: { name: '大型犬', basePrice: 180 },
            cat: { name: '猫咪', basePrice: 100 }
        },
        
        services: {
            bath: { name: '洗澡护理', price: 50 },
            cut: { name: '美容修剪', price: 80 },
            nail: { name: '指甲修剪', price: 30 },
            ear: { name: '耳道清洁', price: 25 }
        },
        
        matLevels: {
            none: { name: '无', multiplier: 1.0, extraCharge: 0 },
            light: { name: '轻度', multiplier: 1.2, extraCharge: 50 },
            medium: { name: '中度', multiplier: 1.5, extraCharge: 120 },
            heavy: { name: '重度', multiplier: 2.0, extraCharge: 250 }
        },
        
        addons: {
            'deep-clean': { name: '深层清洁', price: 60 },
            conditioner: { name: '护毛素护理', price: 40 },
            teeth: { name: '牙齿清洁', price: 50 },
            flea: { name: '除蚤处理', price: 80 }
        }
    };

    const STORAGE_KEY = 'pet_grooming_workspace';
    const EXPORT_KEY = 'pet_grooming_exports';

    let state = {
        pets: [],
        currentEditingId: null,
        lastExportHash: null
    };

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function calculateCosts(data) {
        const typeInfo = PRICING.types[data.type];
        const baseServiceCost = data.services.reduce((sum, service) => {
            return sum + (PRICING.services[service]?.price || 0);
        }, 0);
        
        const baseCost = typeInfo.basePrice + baseServiceCost;
        
        const matInfo = PRICING.matLevels[data.matLevel];
        const matCharge = (baseCost * (matInfo.multiplier - 1)) + matInfo.extraCharge;
        
        const addonCost = data.addons.reduce((sum, addon) => {
            return sum + (PRICING.addons[addon]?.price || 0);
        }, 0);
        
        const total = baseCost + matCharge + addonCost;
        
        return {
            base: baseCost,
            mat: Math.round(matCharge * 100) / 100,
            addon: addonCost,
            total: Math.round(total * 100) / 100
        };
    }

    function validateForm(data) {
        const errors = [];
        
        if (!data.name || data.name.trim().length === 0) {
            errors.push({ field: 'name', message: '请输入宠物名称' });
        }
        
        if (!data.type || !PRICING.types[data.type]) {
            errors.push({ field: 'type', message: '请选择宠物体型' });
        }
        
        if (!data.matLevel || !PRICING.matLevels[data.matLevel]) {
            errors.push({ field: 'matLevel', message: '请选择毛结等级' });
        }
        
        if (data.services.length === 0) {
            errors.push({ field: 'services', message: '请至少选择一项基础服务' });
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    function saveToStorage() {
        const workspaceData = {
            pets: state.pets,
            lastUpdated: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaceData));
    }

    function loadFromStorage() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                state.pets = data.pets || [];
                return true;
            } catch (e) {
                console.error('加载工作区数据失败:', e);
                return false;
            }
        }
        return false;
    }

    function clearWorkspace() {
        if (confirm('确定要清空所有记录吗？此操作不可撤销。')) {
            state.pets = [];
            state.currentEditingId = null;
            saveToStorage();
            renderPetList();
            updateStatistics();
            closeEditor();
        }
    }

    function getFormData() {
        const services = [];
        if (document.getElementById('service-bath').checked) services.push('bath');
        if (document.getElementById('service-cut').checked) services.push('cut');
        if (document.getElementById('service-nail').checked) services.push('nail');
        if (document.getElementById('service-ear').checked) services.push('ear');
        
        const addons = [];
        if (document.getElementById('addon-deep-clean').checked) addons.push('deep-clean');
        if (document.getElementById('addon-conditioner').checked) addons.push('conditioner');
        if (document.getElementById('addon-teeth').checked) addons.push('teeth');
        if (document.getElementById('addon-flea').checked) addons.push('flea');
        
        return {
            name: document.getElementById('pet-name').value.trim(),
            type: document.getElementById('pet-type').value,
            services,
            matLevel: document.getElementById('mat-level').value,
            matDetails: document.getElementById('mat-details').value.trim(),
            addons,
            specialRequests: document.getElementById('special-requests').value.trim()
        };
    }

    function setFormData(data) {
        document.getElementById('pet-name').value = data.name || '';
        document.getElementById('pet-type').value = data.type || '';
        
        document.getElementById('service-bath').checked = data.services?.includes('bath') || false;
        document.getElementById('service-cut').checked = data.services?.includes('cut') || false;
        document.getElementById('service-nail').checked = data.services?.includes('nail') || false;
        document.getElementById('service-ear').checked = data.services?.includes('ear') || false;
        
        document.getElementById('mat-level').value = data.matLevel || '';
        document.getElementById('mat-details').value = data.matDetails || '';
        
        document.getElementById('addon-deep-clean').checked = data.addons?.includes('deep-clean') || false;
        document.getElementById('addon-conditioner').checked = data.addons?.includes('conditioner') || false;
        document.getElementById('addon-teeth').checked = data.addons?.includes('teeth') || false;
        document.getElementById('addon-flea').checked = data.addons?.includes('flea') || false;
        
        document.getElementById('special-requests').value = data.specialRequests || '';
    }

    function clearErrors() {
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(el => {
            el.classList.add('hidden');
            el.textContent = '';
        });
        
        const formGroups = document.querySelectorAll('.form-group');
        formGroups.forEach(el => el.classList.remove('error'));
    }

    function showErrors(errors) {
        clearErrors();
        errors.forEach(error => {
            const errorEl = document.getElementById(`pet-${error.field}-error`) || 
                            document.getElementById(`${error.field}-error`);
            if (errorEl) {
                errorEl.textContent = error.message;
                errorEl.classList.remove('hidden');
                
                const formGroup = errorEl.closest('.form-group');
                if (formGroup) {
                    formGroup.classList.add('error');
                }
            }
        });
    }

    function updatePreview() {
        const data = getFormData();
        const costs = calculateCosts(data);
        
        document.getElementById('preview-base').textContent = `¥${costs.base.toFixed(2)}`;
        document.getElementById('preview-mat').textContent = `¥${costs.mat.toFixed(2)}`;
        document.getElementById('preview-addon').textContent = `¥${costs.addon.toFixed(2)}`;
        document.getElementById('preview-total').textContent = `¥${costs.total.toFixed(2)}`;
    }

    function openEditor(isEdit = false) {
        const editor = document.getElementById('pet-editor');
        const title = document.getElementById('editor-title');
        
        if (isEdit) {
            title.textContent = '编辑宠物';
        } else {
            title.textContent = '添加宠物';
            setFormData({
                services: [],
                addons: []
            });
        }
        
        clearErrors();
        updatePreview();
        editor.classList.remove('hidden');
    }

    function closeEditor() {
        const editor = document.getElementById('pet-editor');
        editor.classList.add('hidden');
        state.currentEditingId = null;
        clearErrors();
    }

    function savePet() {
        const data = getFormData();
        const validation = validateForm(data);
        
        if (!validation.isValid) {
            showErrors(validation.errors);
            return;
        }
        
        const costs = calculateCosts(data);
        
        if (state.currentEditingId) {
            const index = state.pets.findIndex(p => p.id === state.currentEditingId);
            if (index !== -1) {
                state.pets[index] = {
                    ...state.pets[index],
                    ...data,
                    costs,
                    updatedAt: Date.now()
                };
            }
        } else {
            const newPet = {
                id: generateId(),
                ...data,
                costs,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            state.pets.push(newPet);
        }
        
        saveToStorage();
        renderPetList();
        updateStatistics();
        closeEditor();
    }

    function editPet(id) {
        const pet = state.pets.find(p => p.id === id);
        if (pet) {
            state.currentEditingId = id;
            setFormData(pet);
            openEditor(true);
        }
    }

    function deletePet(id) {
        if (confirm('确定要删除这条记录吗？')) {
            state.pets = state.pets.filter(p => p.id !== id);
            saveToStorage();
            renderPetList();
            updateStatistics();
        }
    }

    function formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getMatLevelClass(level) {
        const classes = {
            none: 'mat-level-none',
            light: 'mat-level-light',
            medium: 'mat-level-medium',
            heavy: 'mat-level-heavy'
        };
        return classes[level] || 'mat-level-none';
    }

    function renderPetList() {
        const petList = document.getElementById('pet-list');
        const statusBadge = document.getElementById('workspace-status');
        
        if (state.pets.length === 0) {
            petList.innerHTML = `
                <div class="empty-state">
                    <p>暂无宠物记录，点击"添加宠物"开始</p>
                </div>
            `;
            statusBadge.textContent = '空';
            statusBadge.classList.remove('active');
            return;
        }
        
        statusBadge.textContent = `${state.pets.length} 条记录`;
        statusBadge.classList.add('active');
        
        petList.innerHTML = state.pets.map(pet => {
            const typeInfo = PRICING.types[pet.type];
            const matInfo = PRICING.matLevels[pet.matLevel];
            const servicesNames = pet.services.map(s => PRICING.services[s]?.name).join('、');
            const addonsNames = pet.addons.map(a => PRICING.addons[a]?.name).join('、');
            
            return `
                <div class="pet-card" data-id="${pet.id}">
                    <div class="pet-header">
                        <span class="pet-name">${escapeHtml(pet.name)}</span>
                        <span class="pet-total">¥${pet.costs.total.toFixed(2)}</span>
                    </div>
                    <div class="pet-details">
                        <div class="pet-detail-row">
                            <span class="pet-detail-label">体型：</span>
                            <span class="pet-detail-value">${typeInfo?.name || '未知'}</span>
                        </div>
                        <div class="pet-detail-row">
                            <span class="pet-detail-label">服务项目：</span>
                            <span class="pet-detail-value">${servicesNames || '无'}</span>
                        </div>
                        <div class="pet-detail-row">
                            <span class="pet-detail-label">毛结等级：</span>
                            <span class="pet-detail-value">
                                <span class="mat-level-badge ${getMatLevelClass(pet.matLevel)}">
                                    ${matInfo?.name || '未知'}
                                </span>
                            </span>
                        </div>
                        ${pet.matDetails ? `
                        <div class="pet-detail-row">
                            <span class="pet-detail-label">毛结详情：</span>
                            <span class="pet-detail-value">${escapeHtml(pet.matDetails)}</span>
                        </div>
                        ` : ''}
                        ${addonsNames ? `
                        <div class="pet-detail-row">
                            <span class="pet-detail-label">附加服务：</span>
                            <span class="pet-detail-value">${addonsNames}</span>
                        </div>
                        ` : ''}
                        <div class="pet-detail-row">
                            <span class="pet-detail-label">费用明细：</span>
                            <span class="pet-detail-value">
                                基础¥${pet.costs.base.toFixed(2)} + 
                                毛结¥${pet.costs.mat.toFixed(2)} + 
                                附加¥${pet.costs.addon.toFixed(2)}
                            </span>
                        </div>
                        <div class="pet-detail-row">
                            <span class="pet-detail-label">更新时间：</span>
                            <span class="pet-detail-value">${formatDate(pet.updatedAt)}</span>
                        </div>
                    </div>
                    <div class="pet-actions">
                        <button class="btn btn-edit" onclick="window.app.editPet('${pet.id}')">编辑</button>
                        <button class="btn btn-delete" onclick="window.app.deletePet('${pet.id}')">删除</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function updateStatistics() {
        const count = state.pets.length;
        const total = state.pets.reduce((sum, pet) => sum + pet.costs.total, 0);
        const heavyMatCount = state.pets.filter(pet => pet.matLevel === 'heavy').length;
        const addonCount = state.pets.reduce((sum, pet) => sum + pet.addons.length, 0);
        
        document.getElementById('stat-count').textContent = count;
        document.getElementById('stat-total').textContent = `¥${total.toFixed(2)}`;
        document.getElementById('stat-mat-heavy').textContent = heavyMatCount;
        document.getElementById('stat-addon-count').textContent = addonCount;
    }

    function calculateExportHash() {
        const data = JSON.stringify(state.pets);
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    function generateCSV() {
        const headers = ['编号', '宠物名称', '体型', '服务项目', '毛结等级', '毛结详情', 
                        '附加服务', '特殊要求', '基础费用', '毛结费用', '附加费用', 
                        '总费用', '创建时间', '更新时间'];
        
        const rows = state.pets.map((pet, index) => [
            index + 1,
            pet.name,
            PRICING.types[pet.type]?.name || '',
            pet.services.map(s => PRICING.services[s]?.name).join('、'),
            PRICING.matLevels[pet.matLevel]?.name || '',
            pet.matDetails || '',
            pet.addons.map(a => PRICING.addons[a]?.name).join('、'),
            pet.specialRequests || '',
            pet.costs.base.toFixed(2),
            pet.costs.mat.toFixed(2),
            pet.costs.addon.toFixed(2),
            pet.costs.total.toFixed(2),
            new Date(pet.createdAt).toLocaleString('zh-CN'),
            new Date(pet.updatedAt).toLocaleString('zh-CN')
        ]);
        
        const csvContent = [
            '\uFEFF' + headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        return csvContent;
    }

    function exportRecords() {
        if (state.pets.length === 0) {
            alert('没有可导出的记录');
            return;
        }
        
        const currentHash = calculateExportHash();
        
        if (state.lastExportHash === currentHash) {
            if (!confirm('当前数据与上次导出相同，确定要再次导出吗？')) {
                return;
            }
        }
        
        const csvContent = generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().slice(0, 10);
        link.setAttribute('href', url);
        link.setAttribute('download', `宠物美容记录_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        state.lastExportHash = currentHash;
        
        const exportHistory = JSON.parse(localStorage.getItem(EXPORT_KEY) || '[]');
        exportHistory.push({
            timestamp: Date.now(),
            hash: currentHash,
            recordCount: state.pets.length,
            totalAmount: state.pets.reduce((sum, p) => sum + p.costs.total, 0)
        });
        localStorage.setItem(EXPORT_KEY, JSON.stringify(exportHistory.slice(-20)));
    }

    function bindEvents() {
        document.getElementById('new-pet-btn').addEventListener('click', () => {
            state.currentEditingId = null;
            openEditor(false);
        });
        
        document.getElementById('save-pet-btn').addEventListener('click', savePet);
        document.getElementById('cancel-editor-btn').addEventListener('click', closeEditor);
        document.getElementById('close-editor-btn').addEventListener('click', closeEditor);
        
        document.getElementById('export-btn').addEventListener('click', exportRecords);
        document.getElementById('clear-all-btn').addEventListener('click', clearWorkspace);
        
        const formElements = [
            'pet-name', 'pet-type', 'mat-level', 'mat-details', 'special-requests',
            'service-bath', 'service-cut', 'service-nail', 'service-ear',
            'addon-deep-clean', 'addon-conditioner', 'addon-teeth', 'addon-flea'
        ];
        
        formElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', updatePreview);
                el.addEventListener('change', updatePreview);
            }
        });
    }

    function init() {
        loadFromStorage();
        bindEvents();
        renderPetList();
        updateStatistics();
        
        window.app = {
            editPet,
            deletePet
        };
        
        console.log('宠物美容毛结收费计算器已初始化');
        console.log('工作区记录数:', state.pets.length);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
