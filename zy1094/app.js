import { Utils } from './utils.js';
import { Storage, initializeDefaultTemplates } from './storage.js';
import { Validator, ERROR_CATEGORIES } from './validator.js';
import { SampleData } from './samples.js';

const App = {
    state: {
        currentTemplate: null,
        rawData: null,
        validationResult: null,
        fixQueue: [],
        selectedFixes: new Set(),
        editingField: null,
        editingRule: null,
        editingFieldIndex: -1,
        editingRuleIndex: -1
    },

    elements: {},

    init() {
        this.cacheElements();
        this.bindEvents();
        this.initializeApp();
    },

    cacheElements() {
        this.elements = {
            fileInput: document.getElementById('fileInput'),
            browseBtn: document.getElementById('browseBtn'),
            dropZone: document.getElementById('dropZone'),
            fileInfo: document.getElementById('fileInfo'),
            fileName: document.getElementById('fileName'),
            removeFile: document.getElementById('removeFile'),
            pasteArea: document.getElementById('pasteArea'),
            parsePasteBtn: document.getElementById('parsePasteBtn'),
            loadExampleBtn: document.getElementById('loadExampleBtn'),
            clearAllBtn: document.getElementById('clearAllBtn'),
            templateSelect: document.getElementById('templateSelect'),
            editTemplateBtn: document.getElementById('editTemplateBtn'),
            saveTemplateBtn: document.getElementById('saveTemplateBtn'),
            deleteTemplateBtn: document.getElementById('deleteTemplateBtn'),
            templateEditor: document.getElementById('templateEditor'),
            templateName: document.getElementById('templateName'),
            templateDesc: document.getElementById('templateDesc'),
            fieldList: document.getElementById('fieldList'),
            addFieldBtn: document.getElementById('addFieldBtn'),
            fieldEditor: document.getElementById('fieldEditor'),
            fieldName: document.getElementById('fieldName'),
            fieldAliases: document.getElementById('fieldAliases'),
            fieldType: document.getElementById('fieldType'),
            fieldRequired: document.getElementById('fieldRequired'),
            fieldUnique: document.getElementById('fieldUnique'),
            fieldEnums: document.getElementById('fieldEnums'),
            fieldDateFormat: document.getElementById('fieldDateFormat'),
            fieldAmountUnit: document.getElementById('fieldAmountUnit'),
            dateFormatRow: document.getElementById('dateFormatRow'),
            amountFormatRow: document.getElementById('amountFormatRow'),
            saveFieldBtn: document.getElementById('saveFieldBtn'),
            cancelFieldBtn: document.getElementById('cancelFieldBtn'),
            crossFieldRules: document.getElementById('crossFieldRules'),
            addRuleBtn: document.getElementById('addRuleBtn'),
            ruleEditor: document.getElementById('ruleEditor'),
            ruleType: document.getElementById('ruleType'),
            ruleStartField: document.getElementById('ruleStartField'),
            ruleEndField: document.getElementById('ruleEndField'),
            ruleTotalField: document.getElementById('ruleTotalField'),
            rulePriceField: document.getElementById('rulePriceField'),
            ruleQuantityField: document.getElementById('ruleQuantityField'),
            ruleFormula: document.getElementById('ruleFormula'),
            ruleErrorMessage: document.getElementById('ruleErrorMessage'),
            saveRuleBtn: document.getElementById('saveRuleBtn'),
            cancelRuleBtn: document.getElementById('cancelRuleBtn'),
            dateRuleFields: document.getElementById('dateRuleFields'),
            amountRuleFields: document.getElementById('amountRuleFields'),
            customRuleField: document.getElementById('customRuleField'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            progressStats: document.getElementById('progressStats'),
            rawRowCount: document.getElementById('rawRowCount'),
            rawColCount: document.getElementById('rawColCount'),
            validRowCount: document.getElementById('validRowCount'),
            invalidRowCount: document.getElementById('invalidRowCount'),
            errorTypeCount: document.getElementById('errorTypeCount'),
            totalErrorCount: document.getElementById('totalErrorCount'),
            pendingFixCount: document.getElementById('pendingFixCount'),
            processedFixCount: document.getElementById('processedFixCount'),
            rawTable: document.getElementById('rawTable'),
            standardizedTable: document.getElementById('standardizedTable'),
            errorGroups: document.getElementById('errorGroups'),
            fixQueue: document.getElementById('fixQueue'),
            selectAllFixesBtn: document.getElementById('selectAllFixesBtn'),
            deselectAllFixesBtn: document.getElementById('deselectAllFixesBtn'),
            applySelectedFixesBtn: document.getElementById('applySelectedFixesBtn'),
            ignoreSelectedFixesBtn: document.getElementById('ignoreSelectedFixesBtn'),
            modal: document.getElementById('modal'),
            modalTitle: document.getElementById('modalTitle'),
            modalBody: document.getElementById('modalBody'),
            modalFooter: document.getElementById('modalFooter'),
            modalClose: document.getElementById('modalClose')
        };
    },

    bindEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.querySelectorAll('.view-tab').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });

        this.elements.browseBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.elements.removeFile.addEventListener('click', () => this.clearFile());
        this.elements.parsePasteBtn.addEventListener('click', () => this.parsePastedData());
        
        this.elements.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.elements.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.elements.dropZone.addEventListener('drop', (e) => this.handleDrop(e));
        this.elements.dropZone.addEventListener('click', () => this.elements.fileInput.click());

        this.elements.loadExampleBtn.addEventListener('click', () => this.showExampleSelector());
        this.elements.clearAllBtn.addEventListener('click', () => this.clearAll());

        this.elements.templateSelect.addEventListener('change', (e) => this.selectTemplate(e.target.value));
        this.elements.editTemplateBtn.addEventListener('click', () => this.editCurrentTemplate());
        this.elements.saveTemplateBtn.addEventListener('click', () => this.saveCurrentTemplate());
        this.elements.deleteTemplateBtn.addEventListener('click', () => this.deleteCurrentTemplate());

        this.elements.addFieldBtn.addEventListener('click', () => this.addNewField());
        this.elements.saveFieldBtn.addEventListener('click', () => this.saveField());
        this.elements.cancelFieldBtn.addEventListener('click', () => this.cancelFieldEdit());
        this.elements.fieldType.addEventListener('change', () => this.toggleFieldTypeOptions());

        this.elements.addRuleBtn.addEventListener('click', () => this.addNewRule());
        this.elements.saveRuleBtn.addEventListener('click', () => this.saveRule());
        this.elements.cancelRuleBtn.addEventListener('click', () => this.cancelRuleEdit());
        this.elements.ruleType.addEventListener('change', () => this.toggleRuleTypeOptions());

        this.elements.selectAllFixesBtn.addEventListener('click', () => this.selectAllFixes());
        this.elements.deselectAllFixesBtn.addEventListener('click', () => this.deselectAllFixes());
        this.elements.applySelectedFixesBtn.addEventListener('click', () => this.applySelectedFixes());
        this.elements.ignoreSelectedFixesBtn.addEventListener('click', () => this.ignoreSelectedFixes());

        document.querySelectorAll('.export-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleExport(e.target.closest('.export-btn').dataset.export));
        });

        this.elements.modalClose.addEventListener('click', () => this.closeModal());
        this.elements.modal.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) this.closeModal();
        });
    },

    initializeApp() {
        if (!Storage.available()) {
            this.showNotification('警告：浏览器不支持 LocalStorage，数据将无法持久化保存', 'warning');
        }

        initializeDefaultTemplates();
        this.loadTemplates();
        this.loadDraft();
    },

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
    },

    switchView(viewName) {
        document.querySelectorAll('.view-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });
        document.querySelectorAll('.view-content').forEach(content => {
            content.classList.toggle('active', content.id === `${viewName}-view`);
        });
    },

    handleDragOver(e) {
        e.preventDefault();
        this.elements.dropZone.classList.add('drag-over');
    },

    handleDragLeave(e) {
        e.preventDefault();
        this.elements.dropZone.classList.remove('drag-over');
    },

    handleDrop(e) {
        e.preventDefault();
        this.elements.dropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    },

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    },

    processFile(file) {
        const validTypes = ['.csv', '.json', 'text/csv', 'application/json'];
        const fileName = file.name.toLowerCase();
        
        if (!fileName.endsWith('.csv') && !fileName.endsWith('.json')) {
            this.showNotification('请上传 CSV 或 JSON 文件', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                this.elements.fileName.textContent = file.name;
                this.elements.fileInfo.classList.remove('hidden');
                this.parseContent(content, fileName.endsWith('.json') ? 'json' : 'csv');
            } catch (err) {
                this.showNotification(`文件解析失败：${err.message}`, 'error');
            }
        };
        reader.onerror = () => {
            this.showNotification('文件读取失败', 'error');
        };

        if (fileName.endsWith('.csv')) {
            reader.readAsText(file, 'UTF-8');
        } else {
            reader.readAsText(file, 'UTF-8');
        }
    },

    clearFile() {
        this.elements.fileInput.value = '';
        this.elements.fileInfo.classList.add('hidden');
        this.elements.pasteArea.value = '';
        this.clearData();
    },

    parsePastedData() {
        const content = this.elements.pasteArea.value.trim();
        if (!content) {
            this.showNotification('请先粘贴数据', 'warning');
            return;
        }

        const isJSON = Utils.detectJSON(content);
        try {
            this.parseContent(content, isJSON ? 'json' : 'csv');
        } catch (err) {
            this.showNotification(`数据解析失败：${err.message}`, 'error');
        }
    },

    parseContent(content, format) {
        this.updateProgress(10, '正在解析数据...');
        
        try {
            let data;
            if (format === 'json') {
                data = Utils.parseJSON(content);
            } else {
                data = Utils.parseCSV(content);
            }

            this.state.rawData = data;
            this.updateProgress(30, '数据解析完成');
            this.renderRawTable();
            this.updateProgress(50, '正在进行字段映射和校验...');
            
            if (this.state.currentTemplate) {
                this.runValidation();
            } else {
                this.updateProgress(100, '请先选择或创建导入模板');
                this.showNotification('请先选择或创建一个导入模板', 'warning');
            }
        } catch (err) {
            this.updateProgress(0, '解析失败');
            throw err;
        }
    },

    loadTemplates() {
        const templates = Storage.getTemplates();
        this.elements.templateSelect.innerHTML = '<option value="">-- 新建模板 --</option>';
        
        templates.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.name + (t.isDefault ? ' (默认)' : '');
            this.elements.templateSelect.appendChild(option);
        });

        const settings = Storage.getSettings();
        if (settings.lastTemplateId) {
            this.elements.templateSelect.value = settings.lastTemplateId;
            this.selectTemplate(settings.lastTemplateId);
        }
    },

    selectTemplate(templateId) {
        if (!templateId) {
            this.state.currentTemplate = null;
            this.elements.templateEditor.classList.remove('hidden');
            this.resetTemplateEditor();
            return;
        }

        const template = Storage.getTemplate(templateId);
        if (template) {
            this.state.currentTemplate = Utils.deepClone(template);
            this.elements.templateEditor.classList.remove('hidden');
            this.fillTemplateEditor(template);
            Storage.saveSettings({ lastTemplateId: templateId });
            
            if (this.state.rawData) {
                this.runValidation();
            }
        }
    },

    resetTemplateEditor() {
        this.elements.templateName.value = '';
        this.elements.templateDesc.value = '';
        this.state.currentTemplate = {
            id: '',
            name: '',
            description: '',
            fields: [],
            crossFieldRules: []
        };
        this.renderFieldList();
        this.renderRuleList();
    },

    fillTemplateEditor(template) {
        this.elements.templateName.value = template.name || '';
        this.elements.templateDesc.value = template.description || '';
        this.renderFieldList();
        this.renderRuleList();
    },

    renderFieldList() {
        const fields = this.state.currentTemplate?.fields || [];
        this.elements.fieldList.innerHTML = '';

        if (fields.length === 0) {
            this.elements.fieldList.innerHTML = '<div class="empty-state">暂无字段，请点击下方按钮添加</div>';
            return;
        }

        fields.forEach((field, index) => {
            const item = document.createElement('div');
            item.className = 'field-item';
            item.innerHTML = `
                <div class="field-info">
                    <span class="field-name">${field.name}</span>
                    <span class="field-meta">
                        ${field.type ? `类型: ${Validator.getFieldTypeName(field.type)}` : ''}
                        ${field.required ? ' | 必填' : ''}
                        ${field.unique ? ' | 唯一键' : ''}
                    </span>
                </div>
                <div class="field-actions">
                    <button class="btn btn-secondary" data-action="edit-field" data-index="${index}">编辑</button>
                    <button class="btn btn-danger" data-action="delete-field" data-index="${index}">删除</button>
                </div>
            `;
            this.elements.fieldList.appendChild(item);
        });

        this.elements.fieldList.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const index = parseInt(e.target.dataset.index);
                if (action === 'edit-field') this.editField(index);
                else if (action === 'delete-field') this.deleteField(index);
            });
        });
    },

    renderRuleList() {
        const rules = this.state.currentTemplate?.crossFieldRules || [];
        this.elements.crossFieldRules.innerHTML = '';

        if (rules.length === 0) {
            this.elements.crossFieldRules.innerHTML = '<div class="empty-state">暂无跨列规则</div>';
            return;
        }

        rules.forEach((rule, index) => {
            const item = document.createElement('div');
            item.className = 'rule-item';
            item.innerHTML = `
                <div class="rule-info">
                    <span class="rule-type">${rule.name || '未命名规则'}</span>
                    <span class="rule-desc">${rule.description || this.getRuleTypeDescription(rule.type)}</span>
                </div>
                <div class="field-actions">
                    <button class="btn btn-secondary" data-action="edit-rule" data-index="${index}">编辑</button>
                    <button class="btn btn-danger" data-action="delete-rule" data-index="${index}">删除</button>
                </div>
            `;
            this.elements.crossFieldRules.appendChild(item);
        });

        this.elements.crossFieldRules.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const index = parseInt(e.target.dataset.index);
                if (action === 'edit-rule') this.editRule(index);
                else if (action === 'delete-rule') this.deleteRule(index);
            });
        });
    },

    getRuleTypeDescription(type) {
        const descriptions = {
            'date_order': '检查日期顺序',
            'amount_check': '检查金额 = 单价 × 数量',
            'custom': '自定义公式校验'
        };
        return descriptions[type] || type;
    },

    editCurrentTemplate() {
        this.elements.templateEditor.classList.remove('hidden');
    },

    saveCurrentTemplate() {
        const name = this.elements.templateName.value.trim();
        if (!name) {
            this.showNotification('请输入模板名称', 'error');
            return;
        }

        const template = {
            ...this.state.currentTemplate,
            name,
            description: this.elements.templateDesc.value.trim()
        };

        const saved = Storage.saveTemplate(template);
        this.state.currentTemplate = saved;
        this.loadTemplates();
        this.elements.templateSelect.value = saved.id;
        
        this.showNotification('模板保存成功', 'success');
        
        if (this.state.rawData) {
            this.runValidation();
        }
    },

    deleteCurrentTemplate() {
        if (!this.state.currentTemplate?.id) {
            this.showNotification('当前模板未保存，无法删除', 'warning');
            return;
        }

        if (confirm('确定要删除此模板吗？')) {
            Storage.deleteTemplate(this.state.currentTemplate.id);
            this.state.currentTemplate = null;
            this.loadTemplates();
            this.elements.templateEditor.classList.add('hidden');
            this.showNotification('模板已删除', 'success');
        }
    },

    addNewField() {
        this.state.editingField = {
            id: Utils.generateId(),
            name: '',
            aliases: [],
            type: 'string',
            required: false,
            unique: false,
            enums: [],
            dateFormat: 'auto',
            amountUnit: 'auto'
        };
        this.state.editingFieldIndex = -1;
        this.fillFieldEditor(this.state.editingField);
        this.elements.fieldEditor.classList.remove('hidden');
    },

    editField(index) {
        const fields = this.state.currentTemplate.fields;
        this.state.editingField = Utils.deepClone(fields[index]);
        this.state.editingFieldIndex = index;
        this.fillFieldEditor(this.state.editingField);
        this.elements.fieldEditor.classList.remove('hidden');
    },

    deleteField(index) {
        if (confirm('确定要删除此字段吗？')) {
            this.state.currentTemplate.fields.splice(index, 1);
            this.renderFieldList();
            this.updateRuleFieldSelects();
        }
    },

    fillFieldEditor(field) {
        this.elements.fieldName.value = field.name || '';
        this.elements.fieldAliases.value = (field.aliases || []).join(', ');
        this.elements.fieldType.value = field.type || 'string';
        this.elements.fieldRequired.checked = field.required || false;
        this.elements.fieldUnique.checked = field.unique || false;
        this.elements.fieldEnums.value = (field.enums || []).join(', ');
        this.elements.fieldDateFormat.value = field.dateFormat || 'auto';
        this.elements.fieldAmountUnit.value = field.amountUnit || 'auto';
        this.toggleFieldTypeOptions();
    },

    toggleFieldTypeOptions() {
        const type = this.elements.fieldType.value;
        this.elements.dateFormatRow.style.display = type === 'date' ? 'block' : 'none';
        this.elements.amountFormatRow.style.display = type === 'amount' ? 'block' : 'none';
    },

    saveField() {
        const name = this.elements.fieldName.value.trim();
        if (!name) {
            this.showNotification('请输入字段名称', 'error');
            return;
        }

        const aliasesStr = this.elements.fieldAliases.value.trim();
        const aliases = aliasesStr ? aliasesStr.split(/[,，]/).map(a => a.trim()).filter(a => a) : [];

        const enumsStr = this.elements.fieldEnums.value.trim();
        const enums = enumsStr ? enumsStr.split(/[,，]/).map(e => e.trim()).filter(e => e) : [];

        const field = {
            id: this.state.editingField.id,
            name,
            aliases,
            type: this.elements.fieldType.value,
            required: this.elements.fieldRequired.checked,
            unique: this.elements.fieldUnique.checked,
            enums,
            dateFormat: this.elements.fieldDateFormat.value,
            amountUnit: this.elements.fieldAmountUnit.value
        };

        if (this.state.editingFieldIndex >= 0) {
            this.state.currentTemplate.fields[this.state.editingFieldIndex] = field;
        } else {
            this.state.currentTemplate.fields.push(field);
        }

        this.renderFieldList();
        this.updateRuleFieldSelects();
        this.cancelFieldEdit();
        this.showNotification('字段保存成功', 'success');
    },

    cancelFieldEdit() {
        this.elements.fieldEditor.classList.add('hidden');
        this.state.editingField = null;
        this.state.editingFieldIndex = -1;
    },

    addNewRule() {
        this.state.editingRule = {
            id: Utils.generateId(),
            type: 'date_order',
            name: '',
            description: '',
            startField: '',
            endField: '',
            totalField: '',
            priceField: '',
            quantityField: '',
            formula: '',
            errorMessage: ''
        };
        this.state.editingRuleIndex = -1;
        this.updateRuleFieldSelects();
        this.fillRuleEditor(this.state.editingRule);
        this.elements.ruleEditor.classList.remove('hidden');
    },

    editRule(index) {
        const rules = this.state.currentTemplate.crossFieldRules;
        this.state.editingRule = Utils.deepClone(rules[index]);
        this.state.editingRuleIndex = index;
        this.updateRuleFieldSelects();
        this.fillRuleEditor(this.state.editingRule);
        this.elements.ruleEditor.classList.remove('hidden');
    },

    deleteRule(index) {
        if (confirm('确定要删除此规则吗？')) {
            this.state.currentTemplate.crossFieldRules.splice(index, 1);
            this.renderRuleList();
        }
    },

    updateRuleFieldSelects() {
        const fields = this.state.currentTemplate?.fields || [];
        const dateFields = fields.filter(f => f.type === 'date');
        const amountFields = fields.filter(f => f.type === 'amount' || f.type === 'number');
        const allFields = fields;

        const updateSelect = (select, fieldList) => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">-- 请选择 --</option>';
            fieldList.forEach(f => {
                const option = document.createElement('option');
                option.value = f.id;
                option.textContent = f.name;
                select.appendChild(option);
            });
            if (currentValue) select.value = currentValue;
        };

        updateSelect(this.elements.ruleStartField, dateFields);
        updateSelect(this.elements.ruleEndField, dateFields);
        updateSelect(this.elements.ruleTotalField, amountFields);
        updateSelect(this.elements.rulePriceField, amountFields);
        updateSelect(this.elements.ruleQuantityField, allFields);
    },

    fillRuleEditor(rule) {
        this.elements.ruleType.value = rule.type || 'date_order';
        this.elements.ruleErrorMessage.value = rule.errorMessage || '';
        
        if (this.elements.ruleStartField.querySelector(`option[value="${rule.startField}"]`)) {
            this.elements.ruleStartField.value = rule.startField;
        }
        if (this.elements.ruleEndField.querySelector(`option[value="${rule.endField}"]`)) {
            this.elements.ruleEndField.value = rule.endField;
        }
        if (this.elements.ruleTotalField.querySelector(`option[value="${rule.totalField}"]`)) {
            this.elements.ruleTotalField.value = rule.totalField;
        }
        if (this.elements.rulePriceField.querySelector(`option[value="${rule.priceField}"]`)) {
            this.elements.rulePriceField.value = rule.priceField;
        }
        if (this.elements.ruleQuantityField.querySelector(`option[value="${rule.quantityField}"]`)) {
            this.elements.ruleQuantityField.value = rule.quantityField;
        }
        
        this.elements.ruleFormula.value = rule.formula || '';
        
        this.toggleRuleTypeOptions();
    },

    toggleRuleTypeOptions() {
        const type = this.elements.ruleType.value;
        this.elements.dateRuleFields.style.display = type === 'date_order' ? 'block' : 'none';
        this.elements.amountRuleFields.style.display = type === 'amount_check' ? 'block' : 'none';
        this.elements.customRuleField.style.display = type === 'custom' ? 'block' : 'none';
    },

    saveRule() {
        const type = this.elements.ruleType.value;
        const errorMessage = this.elements.ruleErrorMessage.value.trim();

        let name = '';
        let description = '';
        
        switch (type) {
            case 'date_order':
                const startField = this.state.currentTemplate.fields.find(f => f.id === this.elements.ruleStartField.value);
                const endField = this.state.currentTemplate.fields.find(f => f.id === this.elements.ruleEndField.value);
                name = `日期顺序：${startField?.name || '开始'} → ${endField?.name || '结束'}`;
                description = `检查 ${startField?.name || '开始日期'} 不能晚于 ${endField?.name || '结束日期'}`;
                break;
            case 'amount_check':
                const totalField = this.state.currentTemplate.fields.find(f => f.id === this.elements.ruleTotalField.value);
                const priceField = this.state.currentTemplate.fields.find(f => f.id === this.elements.rulePriceField.value);
                const qtyField = this.state.currentTemplate.fields.find(f => f.id === this.elements.ruleQuantityField.value);
                name = `金额校验：${totalField?.name || '总金额'}`;
                description = `${totalField?.name || '总金额'} = ${priceField?.name || '单价'} × ${qtyField?.name || '数量'}`;
                break;
            case 'custom':
                name = '自定义规则';
                description = this.elements.ruleFormula.value || '自定义公式校验';
                break;
        }

        const rule = {
            id: this.state.editingRule.id,
            type,
            name,
            description,
            startField: this.elements.ruleStartField.value,
            endField: this.elements.ruleEndField.value,
            totalField: this.elements.ruleTotalField.value,
            priceField: this.elements.rulePriceField.value,
            quantityField: this.elements.ruleQuantityField.value,
            formula: this.elements.ruleFormula.value,
            errorMessage: errorMessage || description
        };

        if (this.state.editingRuleIndex >= 0) {
            this.state.currentTemplate.crossFieldRules[this.state.editingRuleIndex] = rule;
        } else {
            this.state.currentTemplate.crossFieldRules.push(rule);
        }

        this.renderRuleList();
        this.cancelRuleEdit();
        this.showNotification('规则保存成功', 'success');
    },

    cancelRuleEdit() {
        this.elements.ruleEditor.classList.add('hidden');
        this.state.editingRule = null;
        this.state.editingRuleIndex = -1;
    },

    runValidation() {
        if (!this.state.rawData || !this.state.currentTemplate) {
            return;
        }

        this.updateProgress(60, '正在进行数据校验...');

        try {
            const result = Validator.validateAll(
                this.state.rawData.headers,
                this.state.rawData.rows,
                this.state.currentTemplate
            );

            this.state.validationResult = result;
            this.state.fixQueue = result.allErrors.map(e => ({
                ...e,
                status: e.status || 'pending'
            }));
            this.state.selectedFixes.clear();

            this.updateProgress(100, '校验完成');
            
            this.renderStandardizedTable();
            this.renderErrorGroups();
            this.renderFixQueue();
            this.updateStats();
            this.autoSaveDraft();
            
        } catch (err) {
            console.error('Validation error:', err);
            this.showNotification(`校验失败：${err.message}`, 'error');
        }
    },

    renderRawTable() {
        const data = this.state.rawData;
        if (!data || !data.headers) return;

        this.elements.rawRowCount.textContent = data.rows.length;
        this.elements.rawColCount.textContent = data.headers.length;

        let theadHTML = '<tr>';
        data.headers.forEach(h => {
            theadHTML += `<th>${this.escapeHTML(h)}</th>`;
        });
        theadHTML += '</tr>';
        this.elements.rawTable.querySelector('thead').innerHTML = theadHTML;

        let tbodyHTML = '';
        data.rows.forEach((row, index) => {
            tbodyHTML += '<tr>';
            data.headers.forEach(h => {
                const value = row[h] !== undefined ? row[h] : '';
                tbodyHTML += `<td>${this.escapeHTML(String(value))}</td>`;
            });
            tbodyHTML += '</tr>';
        });
        this.elements.rawTable.querySelector('tbody').innerHTML = tbodyHTML;
    },

    renderStandardizedTable() {
        const result = this.state.validationResult;
        if (!result) return;

        this.elements.validRowCount.textContent = result.stats.validRows;
        this.elements.invalidRowCount.textContent = result.stats.invalidRows;

        const fields = this.state.currentTemplate.fields;
        
        let theadHTML = '<tr><th>#</th>';
        fields.forEach(f => {
            theadHTML += `<th>${this.escapeHTML(f.name)}</th>`;
        });
        theadHTML += '</tr>';
        this.elements.standardizedTable.querySelector('thead').innerHTML = theadHTML;

        let tbodyHTML = '';
        result.validationResults.forEach((r, index) => {
            const rowClass = r.hasErrors ? 'has-error' : '';
            tbodyHTML += `<tr class="${rowClass}">`;
            tbodyHTML += `<td>${index + 2}</td>`;
            
            fields.forEach(f => {
                const fieldResult = r.fieldResults[f.id];
                const cellErrors = r.errors.filter(e => e.field?.id === f.id);
                let cellClass = '';
                if (cellErrors.length > 0) {
                    cellClass = cellErrors.some(e => e.severity === 'error') ? 'cell-error' : 'cell-warning';
                }
                
                const value = fieldResult?.normalized !== undefined ? fieldResult.normalized : '';
                tbodyHTML += `<td class="${cellClass}">${this.escapeHTML(String(value))}</td>`;
            });
            
            tbodyHTML += '</tr>';
        });
        this.elements.standardizedTable.querySelector('tbody').innerHTML = tbodyHTML;
    },

    renderErrorGroups() {
        const result = this.state.validationResult;
        if (!result) return;

        this.elements.errorTypeCount.textContent = result.stats.errorTypes;
        this.elements.totalErrorCount.textContent = result.stats.totalErrors;

        const container = this.elements.errorGroups;
        container.innerHTML = '';

        if (result.globalErrors && result.globalErrors.length > 0) {
            const globalGroup = this.createErrorGroup('全局错误', result.globalErrors, true);
            container.appendChild(globalGroup);
        }

        for (const [type, errors] of Object.entries(result.errorGroups)) {
            const category = ERROR_CATEGORIES[type];
            const groupName = category ? `${category.icon} ${category.name}` : type;
            const group = this.createErrorGroup(groupName, errors);
            container.appendChild(group);
        }
    },

    createErrorGroup(groupName, errors, isGlobal = false) {
        const group = document.createElement('div');
        group.className = 'error-group expanded';

        const header = document.createElement('div');
        header.className = 'error-group-header';
        header.innerHTML = `
            <div class="error-group-title">
                <span>${groupName}</span>
                <span class="error-count-badge">${errors.length}</span>
            </div>
            <span class="toggle-icon">▼</span>
        `;
        header.addEventListener('click', () => {
            group.classList.toggle('expanded');
            header.querySelector('.toggle-icon').textContent = group.classList.contains('expanded') ? '▼' : '▶';
        });

        const content = document.createElement('div');
        content.className = 'error-group-content';

        errors.forEach(error => {
            const item = document.createElement('div');
            item.className = 'error-item';
            
            let rowInfo = isGlobal ? '全局' : `第 ${error.rowIndex + 2} 行`;
            let fieldInfo = error.field ? `字段：${error.field.name}` : '';
            
            item.innerHTML = `
                <div class="error-item-row">${rowInfo}</div>
                ${fieldInfo ? `<div class="error-item-field">${fieldInfo}</div>` : ''}
                ${error.rawValue !== null && error.rawValue !== undefined ? 
                    `<div class="error-item-value">值：${this.escapeHTML(String(error.rawValue))}</div>` : ''}
                <div class="error-item-message">${this.escapeHTML(error.message)}</div>
            `;
            content.appendChild(item);
        });

        group.appendChild(header);
        group.appendChild(content);
        return group;
    },

    renderFixQueue() {
        const queue = this.state.fixQueue;
        
        const pendingCount = queue.filter(f => f.status === 'pending').length;
        const processedCount = queue.length - pendingCount;
        
        this.elements.pendingFixCount.textContent = pendingCount;
        this.elements.processedFixCount.textContent = processedCount;

        const container = this.elements.fixQueue;
        container.innerHTML = '';

        if (queue.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无待修复的问题</div>';
            return;
        }

        queue.forEach((fix, index) => {
            const item = document.createElement('div');
            item.className = `fix-item ${fix.status}`;
            item.dataset.fixId = fix.id;

            let statusText = '待处理';
            let statusClass = 'pending';
            if (fix.status === 'fixed') {
                statusText = '已修复';
                statusClass = 'fixed';
            } else if (fix.status === 'ignored') {
                statusText = '已忽略';
                statusClass = 'ignored';
            }

            let rowInfo = fix.rowIndex >= 0 ? `第 ${fix.rowIndex + 2} 行` : '全局';
            let fieldInfo = fix.field ? ` - ${fix.field.name}` : '';

            const suggestion = fix.suggestion || {};
            let suggestionHTML = '';
            
            if (suggestion.action === 'select' && suggestion.allowedValues?.length > 0) {
                const options = suggestion.allowedValues.map(v => 
                    `<option value="${this.escapeHTML(v)}">${this.escapeHTML(v)}</option>`
                ).join('');
                suggestionHTML = `
                    <div class="fix-original">
                        <div class="fix-label">当前值：</div>
                        <div class="fix-value current">${this.escapeHTML(String(fix.rawValue || ''))}</div>
                    </div>
                    <div class="fix-suggestion">
                        <div class="fix-label">选择正确值：</div>
                        <select class="fix-select" data-fix-id="${fix.id}">
                            <option value="">-- 请选择 --</option>
                            ${options}
                        </select>
                    </div>
                `;
            } else if (suggestion.action === 'select_unit') {
                const units = suggestion.possibleUnits || [];
                const options = units.map(u => {
                    const label = { yuan: '元', wanyuan: '万元', thousand: '千元', cent: '分' }[u] || u;
                    return `<option value="${u}">${label}</option>`;
                }).join('');
                suggestionHTML = `
                    <div class="fix-original">
                        <div class="fix-label">当前值：</div>
                        <div class="fix-value current">${this.escapeHTML(String(fix.rawValue || ''))}</div>
                    </div>
                    <div class="fix-suggestion">
                        <div class="fix-label">选择单位：</div>
                        <select class="fix-unit-select" data-fix-id="${fix.id}">
                            ${options}
                        </select>
                    </div>
                `;
            } else if (suggestion.action === 'select_format') {
                const formats = suggestion.possibleFormats || [];
                const options = formats.map(f => 
                    `<option value="${f}">${f}</option>`
                ).join('');
                suggestionHTML = `
                    <div class="fix-original">
                        <div class="fix-label">当前值：</div>
                        <div class="fix-value current">${this.escapeHTML(String(fix.rawValue || ''))}</div>
                    </div>
                    <div class="fix-suggestion">
                        <div class="fix-label">选择日期格式：</div>
                        <select class="fix-format-select" data-fix-id="${fix.id}">
                            ${options}
                        </select>
                    </div>
                `;
            } else {
                suggestionHTML = `
                    <div class="fix-original">
                        <div class="fix-label">当前值：</div>
                        <div class="fix-value current">${this.escapeHTML(String(fix.rawValue || ''))}</div>
                    </div>
                    ${suggestion.suggestedValue ? `
                    <div class="fix-suggestion">
                        <div class="fix-label">建议值：</div>
                        <div class="fix-value suggested">${this.escapeHTML(String(suggestion.suggestedValue))}</div>
                    </div>
                    ` : ''}
                    <div class="fix-suggestion">
                        <div class="fix-label">${suggestion.description || '手动输入：'}</div>
                    </div>
                `;
            }

            item.innerHTML = `
                <div class="fix-header">
                    <input type="checkbox" class="fix-checkbox" data-fix-id="${fix.id}" 
                        ${this.state.selectedFixes.has(fix.id) ? 'checked' : ''}
                        ${fix.status !== 'pending' ? 'disabled' : ''}>
                    <span class="fix-index">${index + 1}</span>
                    <div class="fix-info">
                        <div class="fix-row-num">${fix.icon} ${rowInfo}${fieldInfo}</div>
                        <div class="fix-type">${fix.category}</div>
                    </div>
                    <span class="fix-status ${statusClass}">${statusText}</span>
                </div>
                <div class="fix-content">
                    ${suggestionHTML}
                    <div class="fix-actions">
                        <input type="text" class="fix-manual-input" data-fix-id="${fix.id}" 
                            placeholder="手动输入修正值" ${fix.status !== 'pending' ? 'disabled' : ''}>
                        <button class="btn btn-primary" data-action="apply-fix" data-fix-id="${fix.id}"
                            ${fix.status !== 'pending' ? 'disabled' : ''}>应用</button>
                        <button class="btn btn-secondary" data-action="ignore-fix" data-fix-id="${fix.id}"
                            ${fix.status !== 'pending' ? 'disabled' : ''}>忽略</button>
                    </div>
                </div>
            `;
            container.appendChild(item);
        });

        container.querySelectorAll('.fix-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const fixId = e.target.dataset.fixId;
                if (e.target.checked) {
                    this.state.selectedFixes.add(fixId);
                } else {
                    this.state.selectedFixes.delete(fixId);
                }
            });
        });

        container.querySelectorAll('[data-action="apply-fix"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fixId = e.target.dataset.fixId;
                this.applySingleFix(fixId);
            });
        });

        container.querySelectorAll('[data-action="ignore-fix"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fixId = e.target.dataset.fixId;
                this.ignoreSingleFix(fixId);
            });
        });
    },

    applySingleFix(fixId) {
        const fixIndex = this.state.fixQueue.findIndex(f => f.id === fixId);
        if (fixIndex < 0) return;

        const fix = this.state.fixQueue[fixIndex];
        const item = document.querySelector(`[data-fix-id="${fixId}"]`).closest('.fix-item');
        
        let newValue = null;
        
        const select = item.querySelector('.fix-select');
        const unitSelect = item.querySelector('.fix-unit-select');
        const formatSelect = item.querySelector('.fix-format-select');
        const manualInput = item.querySelector('.fix-manual-input');

        if (select && select.value) {
            newValue = select.value;
        } else if (unitSelect && unitSelect.value) {
            const amountResult = Utils.parseAmount(fix.rawValue, unitSelect.value);
            if (amountResult) {
                newValue = Utils.formatAmount(amountResult.normalized, 'yuan');
            }
        } else if (formatSelect && formatSelect.value) {
            const dateResult = Utils.parseDate(fix.rawValue, formatSelect.value);
            if (dateResult) {
                newValue = Utils.formatDate(dateResult.date, 'YYYY-MM-DD');
            }
        } else if (manualInput && manualInput.value.trim()) {
            newValue = manualInput.value.trim();
        } else if (fix.suggestion?.suggestedValue) {
            newValue = fix.suggestion.suggestedValue;
        }

        if (newValue === null || newValue === '') {
            this.showNotification('请输入或选择修正值', 'warning');
            return;
        }

        this.state.fixQueue[fixIndex] = Validator.applyFix(fix, 'manual', newValue);
        this.state.selectedFixes.delete(fixId);
        
        this.applyFixToData(fixIndex, newValue);
        
        this.renderFixQueue();
        this.renderStandardizedTable();
        this.showNotification('修复已应用', 'success');
    },

    ignoreSingleFix(fixId) {
        const fixIndex = this.state.fixQueue.findIndex(f => f.id === fixId);
        if (fixIndex < 0) return;

        this.state.fixQueue[fixIndex] = Validator.ignoreError(this.state.fixQueue[fixIndex]);
        this.state.selectedFixes.delete(fixId);
        
        this.renderFixQueue();
        this.showNotification('已忽略此问题', 'info');
    },

    applyFixToData(fixIndex, newValue) {
        const fix = this.state.fixQueue[fixIndex];
        if (!fix || fix.rowIndex < 0) return;

        const result = this.state.validationResult.validationResults[fix.rowIndex];
        if (!result) return;

        if (fix.field) {
            const mapping = this.state.validationResult.fieldMapping.mapping[fix.field.id];
            if (mapping && mapping.sourceHeader) {
                this.state.rawData.rows[fix.rowIndex][mapping.sourceHeader] = newValue;
            }
        }
    },

    selectAllFixes() {
        this.state.fixQueue.forEach(f => {
            if (f.status === 'pending') {
                this.state.selectedFixes.add(f.id);
            }
        });
        this.renderFixQueue();
    },

    deselectAllFixes() {
        this.state.selectedFixes.clear();
        this.renderFixQueue();
    },

    applySelectedFixes() {
        let applied = 0;
        this.state.selectedFixes.forEach(fixId => {
            const fixIndex = this.state.fixQueue.findIndex(f => f.id === fixId);
            if (fixIndex >= 0 && this.state.fixQueue[fixIndex].status === 'pending') {
                const fix = this.state.fixQueue[fixIndex];
                if (fix.suggestion?.suggestedValue) {
                    this.state.fixQueue[fixIndex] = Validator.applyFix(fix, 'batch', fix.suggestion.suggestedValue);
                    this.applyFixToData(fixIndex, fix.suggestion.suggestedValue);
                    applied++;
                }
            }
        });
        
        this.state.selectedFixes.clear();
        this.renderFixQueue();
        this.renderStandardizedTable();
        this.showNotification(`已批量应用 ${applied} 个修复`, 'success');
    },

    ignoreSelectedFixes() {
        let ignored = 0;
        this.state.selectedFixes.forEach(fixId => {
            const fixIndex = this.state.fixQueue.findIndex(f => f.id === fixId);
            if (fixIndex >= 0 && this.state.fixQueue[fixIndex].status === 'pending') {
                this.state.fixQueue[fixIndex] = Validator.ignoreError(this.state.fixQueue[fixIndex]);
                ignored++;
            }
        });
        
        this.state.selectedFixes.clear();
        this.renderFixQueue();
        this.showNotification(`已忽略 ${ignored} 个问题`, 'info');
    },

    handleExport(type) {
        if (!this.state.validationResult) {
            this.showNotification('请先导入数据并进行校验', 'warning');
            return;
        }

        const result = this.state.validationResult;
        const fields = this.state.currentTemplate.fields;
        const headers = fields.map(f => f.name);

        switch (type) {
            case 'cleaned':
                this.exportCleaned(result, fields, headers);
                break;
            case 'rejects':
                this.exportRejects(result, fields, headers);
                break;
            case 'rules':
                this.exportRules();
                break;
            case 'report':
                this.exportReport();
                break;
        }
    },

    exportCleaned(result, fields, headers) {
        const validRows = result.validResults.map(r => {
            const row = {};
            fields.forEach(f => {
                const fieldResult = r.fieldResults[f.id];
                row[f.name] = fieldResult?.normalized !== undefined ? fieldResult.normalized : '';
            });
            return row;
        });

        const csv = Utils.toCSV(headers, validRows);
        Utils.downloadFile(csv, 'cleaned.csv', 'text/csv');
        this.showNotification('cleaned.csv 已导出', 'success');
    },

    exportRejects(result, fields, headers) {
        const invalidRows = result.invalidResults.map(r => {
            const row = {};
            fields.forEach(f => {
                const fieldResult = r.fieldResults[f.id];
                row[f.name] = fieldResult?.normalized !== undefined ? fieldResult.normalized : '';
            });
            
            const errorMessages = r.errors.map(e => 
                `${e.field?.name || '全局'}: ${e.message}`
            ).join('; ');
            row['_错误信息'] = errorMessages;
            
            return row;
        });

        const csv = Utils.toCSV([...headers, '_错误信息'], invalidRows);
        Utils.downloadFile(csv, 'rejects.csv', 'text/csv');
        this.showNotification('rejects.csv 已导出', 'success');
    },

    exportRules() {
        const data = {
            template: this.state.currentTemplate,
            exportTime: new Date().toISOString(),
            statistics: this.state.validationResult?.stats
        };
        const json = JSON.stringify(data, null, 2);
        Utils.downloadFile(json, 'rules.json', 'application/json');
        this.showNotification('rules.json 已导出', 'success');
    },

    exportReport() {
        const result = this.state.validationResult;
        const template = this.state.currentTemplate;
        const stats = result.stats;
        const errors = this.state.fixQueue;

        const mdReport = this.generateMarkdownReport(template, stats, errors);
        const htmlReport = this.generateHTMLReport(template, stats, errors);

        this.showModal('导出报告', `
            <div style="margin-bottom: 16px;">
                <h4 style="margin-bottom: 8px;">请选择报告格式：</h4>
                <div style="display: flex; gap: 12px;">
                    <button class="btn btn-primary" id="export-md-btn">导出 Markdown</button>
                    <button class="btn btn-primary" id="export-html-btn">导出 HTML</button>
                </div>
            </div>
            <div style="max-height: 400px; overflow: auto; padding: 12px; background: #f5f5f5; border-radius: 4px;">
                <pre style="white-space: pre-wrap; word-wrap: break-word; font-size: 12px;">${this.escapeHTML(mdReport)}</pre>
            </div>
        `, '');

        setTimeout(() => {
            document.getElementById('export-md-btn')?.addEventListener('click', () => {
                Utils.downloadFile(mdReport, 'import-report.md', 'text/markdown');
                this.closeModal();
                this.showNotification('import-report.md 已导出', 'success');
            });
            document.getElementById('export-html-btn')?.addEventListener('click', () => {
                Utils.downloadFile(htmlReport, 'import-report.html', 'text/html');
                this.closeModal();
                this.showNotification('import-report.html 已导出', 'success');
            });
        }, 0);
    },

    generateMarkdownReport(template, stats, errors) {
        const now = new Date().toLocaleString('zh-CN');
        const errorGroups = Utils.groupBy(errors, e => e.category);

        let md = `# 数据导入报告

## 基本信息

| 项目 | 内容 |
|------|------|
| 报告时间 | ${now} |
| 使用模板 | ${template.name} |
| 模板描述 | ${template.description || '-'} |

## 数据统计

| 指标 | 数值 |
|------|------|
| 总行数 | ${stats.totalRows} |
| 有效行数 | ${stats.validRows} |
| 问题行数 | ${stats.invalidRows} |
| 错误类型数 | ${stats.errorTypes} |
| 总错误数 | ${stats.totalErrors} |

## 问题详情

`;

        for (const [category, groupErrors] of Object.entries(errorGroups)) {
            md += `### ${category} (${groupErrors.length} 个)

`;
            groupErrors.slice(0, 50).forEach(e => {
                const row = e.rowIndex >= 0 ? `第 ${e.rowIndex + 2} 行` : '全局';
                const field = e.field ? ` - ${e.field.name}` : '';
                md += `- **${row}${field}**: ${e.message}\n`;
            });
            if (groupErrors.length > 50) {
                md += `- ... 还有 ${groupErrors.length - 50} 个同类问题\n`;
            }
            md += '\n';
        }

        md += `## 修复情况

| 状态 | 数量 |
|------|------|
| 待处理 | ${errors.filter(e => e.status === 'pending').length} |
| 已修复 | ${errors.filter(e => e.status === 'fixed').length} |
| 已忽略 | ${errors.filter(e => e.status === 'ignored').length} |

---

*此报告由「表格导入前哨站」生成*
`;
        return md;
    },

    generateHTMLReport(template, stats, errors) {
        const now = new Date().toLocaleString('zh-CN');
        const errorGroups = Utils.groupBy(errors, e => e.category);

        let errorListHTML = '';
        for (const [category, groupErrors] of Object.entries(errorGroups)) {
            let itemsHTML = '';
            groupErrors.slice(0, 50).forEach(e => {
                const row = e.rowIndex >= 0 ? `第 ${e.rowIndex + 2} 行` : '全局';
                const field = e.field ? ` - ${e.field.name}` : '';
                const severityClass = e.severity === 'error' ? 'error' : 'warning';
                itemsHTML += `<li class="${severityClass}"><strong>${row}${field}</strong>: ${this.escapeHTML(e.message)}</li>`;
            });
            if (groupErrors.length > 50) {
                itemsHTML += `<li class="more">... 还有 ${groupErrors.length - 50} 个同类问题</li>`;
            }
            errorListHTML += `
                <div class="error-section">
                    <h3>${this.escapeHTML(category)} <span class="count">${groupErrors.length}</span></h3>
                    <ul>${itemsHTML}</ul>
                </div>
            `;
        }

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>数据导入报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 40px 20px; }
        h1 { color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 10px; margin-bottom: 20px; }
        h2 { color: #262626; margin: 24px 0 12px; }
        h3 { color: #595959; margin: 16px 0 8px; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { padding: 10px 12px; text-align: left; border: 1px solid #d9d9d9; }
        th { background: #f5f5f5; font-weight: 500; }
        .error-section { margin: 16px 0; padding: 16px; background: #fffbf0; border-radius: 4px; border-left: 4px solid #faad14; }
        .error-section h3 { margin: 0 0 12px; color: #d48806; }
        .count { background: #faad14; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-left: 8px; }
        ul { list-style: none; padding-left: 0; }
        li { padding: 6px 0; border-bottom: 1px solid #ffe58f; }
        li:last-child { border-bottom: none; }
        li.error { color: #ff4d4f; }
        li.warning { color: #faad14; }
        li.more { color: #8c8c8c; font-style: italic; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #d9d9d9; color: #8c8c8c; font-size: 12px; text-align: center; }
        .stats-card { display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0; }
        .stat-item { padding: 16px 24px; background: #e6f7ff; border-radius: 4px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: 600; color: #1890ff; }
        .stat-label { font-size: 12px; color: #595959; margin-top: 4px; }
        .stat-item.warning .stat-value { color: #faad14; }
        .stat-item.warning { background: #fffbe6; }
    </style>
</head>
<body>
    <h1>📋 数据导入报告</h1>
    
    <h2>基本信息</h2>
    <table>
        <tr><th>项目</th><th>内容</th></tr>
        <tr><td>报告时间</td><td>${now}</td></tr>
        <tr><td>使用模板</td><td>${this.escapeHTML(template.name)}</td></tr>
        <tr><td>模板描述</td><td>${this.escapeHTML(template.description || '-')}</td></tr>
    </table>

    <h2>数据统计</h2>
    <div class="stats-card">
        <div class="stat-item"><div class="stat-value">${stats.totalRows}</div><div class="stat-label">总行数</div></div>
        <div class="stat-item"><div class="stat-value">${stats.validRows}</div><div class="stat-label">有效行数</div></div>
        <div class="stat-item warning"><div class="stat-value">${stats.invalidRows}</div><div class="stat-label">问题行数</div></div>
        <div class="stat-item warning"><div class="stat-value">${stats.totalErrors}</div><div class="stat-label">总错误数</div></div>
    </div>

    <h2>问题详情</h2>
    ${errorListHTML || '<p style="color: #52c41a; padding: 16px; background: #f6ffed; border-radius: 4px;">✅ 数据质量良好，无发现问题</p>'}

    <h2>修复情况</h2>
    <table>
        <tr><th>状态</th><th>数量</th></tr>
        <tr><td>待处理</td><td>${errors.filter(e => e.status === 'pending').length}</td></tr>
        <tr><td>已修复</td><td>${errors.filter(e => e.status === 'fixed').length}</td></tr>
        <tr><td>已忽略</td><td>${errors.filter(e => e.status === 'ignored').length}</td></tr>
    </table>

    <div class="footer">
        此报告由「表格导入前哨站」生成 | ${now}
    </div>
</body>
</html>`;
    },

    showExampleSelector() {
        const examples = SampleData.getExamples();
        
        let html = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">';
        examples.forEach(ex => {
            const categoryClass = ex.category === '正常数据' ? 'success' : 'warning';
            html += `
                <div class="example-card" data-example-id="${ex.id}" style="
                    padding: 12px;
                    border: 1px solid #d9d9d9;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                ">
                    <div style="font-weight: 500; margin-bottom: 4px;">${ex.name}</div>
                    <div style="font-size: 12px; color: #8c8c8c;">${ex.description}</div>
                    <div style="margin-top: 8px;">
                        <span style="font-size: 11px; padding: 2px 6px; background: ${ex.category === '正常数据' ? '#f6ffed' : '#fffbe6'}; color: ${ex.category === '正常数据' ? '#52c41a' : '#faad14'}; border-radius: 4px;">${ex.category}</span>
                        <span style="font-size: 11px; padding: 2px 6px; background: #f5f5f5; color: #595959; border-radius: 4px; margin-left: 4px;">${ex.format.toUpperCase()}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        this.showModal('选择示例数据', html, '');

        setTimeout(() => {
            document.querySelectorAll('.example-card').forEach(card => {
                card.addEventListener('click', () => {
                    const exampleId = card.dataset.exampleId;
                    const example = examples.find(e => e.id === exampleId);
                    if (example) {
                        this.elements.pasteArea.value = example.content;
                        this.switchTab('paste');
                        this.closeModal();
                        this.showNotification(`已加载示例：${example.name}`, 'success');
                    }
                });
                card.addEventListener('mouseenter', () => {
                    card.style.borderColor = '#1890ff';
                    card.style.background = '#e6f7ff';
                });
                card.addEventListener('mouseleave', () => {
                    card.style.borderColor = '#d9d9d9';
                    card.style.background = '#fff';
                });
            });
        }, 0);
    },

    updateProgress(percent, text) {
        this.elements.progressFill.style.width = `${percent}%`;
        this.elements.progressText.textContent = text;
        
        if (this.state.validationResult) {
            const stats = this.state.validationResult.stats;
            this.elements.progressStats.textContent = 
                `${stats.validRows}/${stats.totalRows} 行有效 | ${stats.totalErrors} 个问题`;
        }
    },

    updateStats() {
        if (!this.state.validationResult) return;
        const stats = this.state.validationResult.stats;
        
        this.elements.validRowCount.textContent = stats.validRows;
        this.elements.invalidRowCount.textContent = stats.invalidRows;
        this.elements.errorTypeCount.textContent = stats.errorTypes;
        this.elements.totalErrorCount.textContent = stats.totalErrors;
    },

    autoSaveDraft() {
        if (!this.state.rawData) return;
        
        const draft = {
            rawData: this.state.rawData,
            templateId: this.state.currentTemplate?.id,
            validationResult: this.state.validationResult,
            fixQueue: this.state.fixQueue,
            savedAt: new Date().toISOString()
        };
        
        Storage.saveDraft(draft);
    },

    loadDraft() {
        const draft = Storage.getDraft();
        if (!draft) return;

        const proceed = confirm(`检测到未完成的草稿（保存于 ${draft.savedAt}），是否恢复？`);
        if (!proceed) {
            Storage.clearDraft();
            return;
        }

        try {
            this.state.rawData = draft.rawData;
            
            if (draft.templateId) {
                this.elements.templateSelect.value = draft.templateId;
                this.selectTemplate(draft.templateId);
            }

            this.renderRawTable();
            
            if (draft.validationResult) {
                this.state.validationResult = draft.validationResult;
                this.state.fixQueue = draft.fixQueue || [];
                
                this.renderStandardizedTable();
                this.renderErrorGroups();
                this.renderFixQueue();
                this.updateStats();
                this.updateProgress(100, '草稿已恢复');
            }
            
            this.showNotification('草稿已恢复', 'success');
        } catch (err) {
            console.error('Failed to load draft:', err);
            this.showNotification('草稿恢复失败，数据可能已损坏', 'error');
            Storage.clearDraft();
        }
    },

    clearData() {
        this.state.rawData = null;
        this.state.validationResult = null;
        this.state.fixQueue = [];
        this.state.selectedFixes.clear();
        
        this.elements.rawTable.querySelector('thead').innerHTML = '';
        this.elements.rawTable.querySelector('tbody').innerHTML = '';
        this.elements.standardizedTable.querySelector('thead').innerHTML = '';
        this.elements.standardizedTable.querySelector('tbody').innerHTML = '';
        this.elements.errorGroups.innerHTML = '';
        this.elements.fixQueue.innerHTML = '';
        
        this.elements.rawRowCount.textContent = '0';
        this.elements.rawColCount.textContent = '0';
        this.elements.validRowCount.textContent = '0';
        this.elements.invalidRowCount.textContent = '0';
        this.elements.errorTypeCount.textContent = '0';
        this.elements.totalErrorCount.textContent = '0';
        this.elements.pendingFixCount.textContent = '0';
        this.elements.processedFixCount.textContent = '0';
        
        this.updateProgress(0, '等待导入数据...');
        this.elements.progressStats.textContent = '';
        
        Storage.clearDraft();
    },

    clearAll() {
        if (confirm('确定要清空所有数据吗？模板不会被删除。')) {
            this.clearData();
            this.elements.pasteArea.value = '';
            this.showNotification('已清空', 'info');
        }
    },

    showModal(title, bodyHTML, footerHTML) {
        this.elements.modalTitle.textContent = title;
        this.elements.modalBody.innerHTML = bodyHTML;
        this.elements.modalFooter.innerHTML = footerHTML;
        this.elements.modal.classList.remove('hidden');
    },

    closeModal() {
        this.elements.modal.classList.add('hidden');
    },

    showNotification(message, type = 'info') {
        const existing = document.querySelector('.notification-toast');
        if (existing) existing.remove();

        const colors = {
            success: '#52c41a',
            error: '#ff4d4f',
            warning: '#faad14',
            info: '#1890ff'
        };

        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${colors[type] || colors.info};
            color: #fff;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease;
            max-width: 400px;
        `;
        toast.textContent = message;

        document.body.appendChild(toast);

        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3000);
    },

    escapeHTML(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

export default App;
