const app = {
    currentDishId: null,
    currentElderId: null,
    currentRuleId: null,
    currentPlan: null,

    init() {
        this.setupNavigation();
        this.setupEventListeners();
        this.setDefaultDate();
        this.refreshAllViews();
    },

    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
                
                btn.classList.add('active');
                const sectionId = btn.dataset.section;
                document.getElementById(sectionId).classList.add('active');

                if (sectionId === 'plan') {
                    this.refreshElderSelects();
                } else if (sectionId === 'export') {
                    this.refreshPlanList();
                    this.refreshElderSelects();
                }
            });
        });
    },

    setupEventListeners() {
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });
    },

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('plan-date').value = today;
        document.getElementById('export-start-date').value = today;
        document.getElementById('export-end-date').value = today;
    },

    refreshAllViews() {
        this.refreshDashboardStats();
        this.refreshDishesTable();
        this.refreshEldersTable();
        this.refreshRulesTable();
        this.refreshElderSelects();
        this.refreshPlanList();
    },

    refreshDashboardStats() {
        document.getElementById('dishes-count').textContent = dataStore.getDishes().length;
        document.getElementById('elders-count').textContent = dataStore.getElders().length;
        document.getElementById('rules-count').textContent = dataStore.getRules().length;
        document.getElementById('plans-count').textContent = dataStore.getPlans().length;
    },

    loadSampleData(type) {
        const confirmed = confirm(type === 'success' 
            ? '确定要加载"顺利样例"数据吗？这会覆盖当前所有数据。'
            : '确定要加载"拦截/待复核样例"数据吗？这会覆盖当前所有数据。');
        
        if (confirmed) {
            dataStore.loadSample(type);
            this.refreshAllViews();
            alert(type === 'success' 
                ? '✅ 已加载顺利样例数据！\n\n这个样例展示了：\n- 3位老人档案\n- 10道营养菜品\n- 3个基础忌口规则\n\n可以直接进入"配餐计划"进行测试，结果应该都是顺利通过的。'
                : '⚠️ 已加载拦截/待复核样例数据！\n\n这个样例展示了：\n- 3位有严格饮食限制的老人\n- 8道可能触发拦截的菜品\n- 4个严格忌口规则\n\n进入"配餐计划"测试时，应该会看到拦截或待复核的结果。');
        }
    },

    clearAllData() {
        if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
            dataStore.clear();
            this.refreshAllViews();
            alert('所有数据已清空！');
        }
    },

    openDishModal(dishId = null) {
        this.currentDishId = dishId;
        const modal = document.getElementById('dish-modal');
        const title = document.getElementById('dish-modal-title');
        
        if (dishId) {
            const dish = dataStore.getDishById(dishId);
            if (dish) {
                title.textContent = '编辑菜品';
                document.getElementById('dish-name').value = dish.name;
                document.getElementById('dish-category').value = dish.category;
                document.getElementById('dish-salt').value = dish.salt;
                document.getElementById('dish-protein').value = dish.protein;
                document.getElementById('dish-cost').value = dish.cost;
                document.getElementById('dish-ingredients').value = (dish.ingredients || []).join(',');
                document.getElementById('dish-description').value = dish.description || '';
            }
        } else {
            title.textContent = '新增菜品';
            this.resetDishForm();
        }
        
        modal.classList.add('active');
    },

    closeDishModal() {
        document.getElementById('dish-modal').classList.remove('active');
        this.currentDishId = null;
        this.resetDishForm();
    },

    resetDishForm() {
        document.getElementById('dish-name').value = '';
        document.getElementById('dish-category').value = 'main';
        document.getElementById('dish-salt').value = '';
        document.getElementById('dish-protein').value = '';
        document.getElementById('dish-cost').value = '';
        document.getElementById('dish-ingredients').value = '';
        document.getElementById('dish-description').value = '';
    },

    saveDish() {
        const name = document.getElementById('dish-name').value.trim();
        const category = document.getElementById('dish-category').value;
        const salt = parseFloat(document.getElementById('dish-salt').value) || 0;
        const protein = parseFloat(document.getElementById('dish-protein').value) || 0;
        const cost = parseFloat(document.getElementById('dish-cost').value) || 0;
        const ingredientsStr = document.getElementById('dish-ingredients').value.trim();
        const ingredients = ingredientsStr ? ingredientsStr.split(',').map(s => s.trim()).filter(s => s) : [];
        const description = document.getElementById('dish-description').value.trim();

        if (!name) {
            alert('请输入菜品名称！');
            return;
        }

        const dish = { name, category, salt, protein, cost, ingredients, description };

        if (this.currentDishId) {
            dataStore.updateDish(this.currentDishId, dish);
        } else {
            dataStore.addDish(dish);
        }

        this.closeDishModal();
        this.refreshDishesTable();
        this.refreshDashboardStats();
    },

    refreshDishesTable() {
        const tbody = document.getElementById('dishes-table-body');
        const dishes = dataStore.getDishes();

        if (dishes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <div class="empty-state-icon">🍳</div>
                        <div class="empty-state-text">暂无菜品，请先添加菜品</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = dishes.map(dish => `
            <tr>
                <td><strong>${dish.name}</strong></td>
                <td>${CONSTANTS.CATEGORY_MAP[dish.category]}</td>
                <td>${dish.salt}</td>
                <td>${dish.protein}</td>
                <td>¥${dish.cost.toFixed(2)}</td>
                <td>${(dish.ingredients || []).join('、')}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-primary btn-sm" onclick="app.openDishModal('${dish.id}')">编辑</button>
                        <button class="btn btn-danger btn-sm" onclick="app.deleteDish('${dish.id}')">删除</button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    deleteDish(id) {
        if (confirm('确定要删除这个菜品吗？')) {
            dataStore.deleteDish(id);
            this.refreshDishesTable();
            this.refreshDashboardStats();
        }
    },

    openElderModal(elderId = null) {
        this.currentElderId = elderId;
        const modal = document.getElementById('elder-modal');
        const title = document.getElementById('elder-modal-title');
        const rulesSelect = document.getElementById('elder-rules');

        const rules = dataStore.getRules();
        rulesSelect.innerHTML = rules.map(rule => `
            <option value="${rule.id}">${rule.name} (${CONSTANTS.RULE_TYPE_MAP[rule.type]})</option>
        `).join('');

        if (elderId) {
            const elder = dataStore.getElderById(elderId);
            if (elder) {
                title.textContent = '编辑老人档案';
                document.getElementById('elder-name').value = elder.name;
                document.getElementById('elder-gender').value = elder.gender;
                document.getElementById('elder-age').value = elder.age;
                document.getElementById('elder-weight').value = elder.weight;
                document.getElementById('elder-budget').value = elder.budget;
                document.getElementById('elder-preference').value = elder.preference;
                document.getElementById('elder-notes').value = elder.notes || '';

                Array.from(rulesSelect.options).forEach(opt => {
                    opt.selected = (elder.ruleIds || []).includes(opt.value);
                });
            }
        } else {
            title.textContent = '新增老人';
            this.resetElderForm();
        }

        modal.classList.add('active');
    },

    closeElderModal() {
        document.getElementById('elder-modal').classList.remove('active');
        this.currentElderId = null;
        this.resetElderForm();
    },

    resetElderForm() {
        document.getElementById('elder-name').value = '';
        document.getElementById('elder-gender').value = 'male';
        document.getElementById('elder-age').value = '';
        document.getElementById('elder-weight').value = '';
        document.getElementById('elder-budget').value = '';
        document.getElementById('elder-preference').value = 'normal';
        document.getElementById('elder-notes').value = '';
        document.getElementById('elder-rules').selectedIndex = -1;
    },

    saveElder() {
        const name = document.getElementById('elder-name').value.trim();
        const gender = document.getElementById('elder-gender').value;
        const age = parseInt(document.getElementById('elder-age').value) || 60;
        const weight = parseFloat(document.getElementById('elder-weight').value) || 60;
        const budget = parseFloat(document.getElementById('elder-budget').value) || 15;
        const preference = document.getElementById('elder-preference').value;
        const notes = document.getElementById('elder-notes').value.trim();

        const rulesSelect = document.getElementById('elder-rules');
        const ruleIds = Array.from(rulesSelect.selectedOptions).map(opt => opt.value);

        if (!name) {
            alert('请输入老人姓名！');
            return;
        }

        const elder = { name, gender, age, weight, budget, preference, ruleIds, notes };

        if (this.currentElderId) {
            dataStore.updateElder(this.currentElderId, elder);
        } else {
            dataStore.addElder(elder);
        }

        this.closeElderModal();
        this.refreshEldersTable();
        this.refreshElderSelects();
        this.refreshDashboardStats();
    },

    refreshEldersTable() {
        const tbody = document.getElementById('elders-table-body');
        const elders = dataStore.getElders();
        const rulesMap = {};
        dataStore.getRules().forEach(r => rulesMap[r.id] = r.name);

        if (elders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        <div class="empty-state-icon">👴</div>
                        <div class="empty-state-text">暂无老人档案，请先添加</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = elders.map(elder => {
            const elderRules = (elder.ruleIds || []).map(id => rulesMap[id]).filter(Boolean);
            return `
            <tr>
                <td><strong>${elder.name}</strong></td>
                <td>${CONSTANTS.GENDER_MAP[elder.gender]}</td>
                <td>${elder.age}</td>
                <td>${elder.weight}kg</td>
                <td>¥${elder.budget.toFixed(2)}</td>
                <td>${CONSTANTS.PREFERENCE_MAP[elder.preference]}</td>
                <td>${elderRules.length > 0 ? elderRules.join('、') : '-'}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-primary btn-sm" onclick="app.openElderModal('${elder.id}')">编辑</button>
                        <button class="btn btn-danger btn-sm" onclick="app.deleteElder('${elder.id}')">删除</button>
                    </div>
                </td>
            </tr>
        `}).join('');
    },

    deleteElder(id) {
        if (confirm('确定要删除这个老人档案吗？')) {
            dataStore.deleteElder(id);
            this.refreshEldersTable();
            this.refreshElderSelects();
            this.refreshDashboardStats();
        }
    },

    openRuleModal(ruleId = null) {
        this.currentRuleId = ruleId;
        const modal = document.getElementById('rule-modal');
        const title = document.getElementById('rule-modal-title');

        if (ruleId) {
            const rule = dataStore.getRuleById(ruleId);
            if (rule) {
                title.textContent = '编辑忌口规则';
                document.getElementById('rule-name').value = rule.name;
                document.getElementById('rule-type').value = rule.type;
                document.getElementById('rule-avoid').value = (rule.avoid || []).join(',');
                document.getElementById('rule-include').value = (rule.include || []).join(',');
                document.getElementById('rule-description').value = rule.description || '';
            }
        } else {
            title.textContent = '新增忌口规则';
            this.resetRuleForm();
        }

        modal.classList.add('active');
    },

    closeRuleModal() {
        document.getElementById('rule-modal').classList.remove('active');
        this.currentRuleId = null;
        this.resetRuleForm();
    },

    resetRuleForm() {
        document.getElementById('rule-name').value = '';
        document.getElementById('rule-type').value = 'allergy';
        document.getElementById('rule-avoid').value = '';
        document.getElementById('rule-include').value = '';
        document.getElementById('rule-description').value = '';
    },

    saveRule() {
        const name = document.getElementById('rule-name').value.trim();
        const type = document.getElementById('rule-type').value;
        const avoidStr = document.getElementById('rule-avoid').value.trim();
        const includeStr = document.getElementById('rule-include').value.trim();
        const description = document.getElementById('rule-description').value.trim();

        const avoid = avoidStr ? avoidStr.split(',').map(s => s.trim()).filter(s => s) : [];
        const include = includeStr ? includeStr.split(',').map(s => s.trim()).filter(s => s) : [];

        if (!name) {
            alert('请输入规则名称！');
            return;
        }

        if (avoid.length === 0 && include.length === 0) {
            alert('请至少输入一个规避食材或包含食材！');
            return;
        }

        const rule = { name, type, avoid, include, description };

        if (this.currentRuleId) {
            dataStore.updateRule(this.currentRuleId, rule);
        } else {
            dataStore.addRule(rule);
        }

        this.closeRuleModal();
        this.refreshRulesTable();
        this.refreshDashboardStats();
    },

    refreshRulesTable() {
        const tbody = document.getElementById('rules-table-body');
        const rules = dataStore.getRules();

        if (rules.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <div class="empty-state-text">暂无忌口规则，请先添加</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = rules.map(rule => `
            <tr>
                <td><strong>${rule.name}</strong></td>
                <td><span class="rule-type-badge ${rule.type}">${CONSTANTS.RULE_TYPE_MAP[rule.type]}</span></td>
                <td>${(rule.avoid || []).join('、') || '-'}</td>
                <td>${rule.description || '-'}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-primary btn-sm" onclick="app.openRuleModal('${rule.id}')">编辑</button>
                        <button class="btn btn-danger btn-sm" onclick="app.deleteRule('${rule.id}')">删除</button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    deleteRule(id) {
        if (confirm('确定要删除这个忌口规则吗？关联的老人档案将自动取消关联此规则。')) {
            dataStore.deleteRule(id);
            this.refreshRulesTable();
            this.refreshEldersTable();
            this.refreshDashboardStats();
        }
    },

    refreshElderSelects() {
        const elders = dataStore.getElders();
        const options = elders.map(e => `<option value="${e.id}">${e.name} (${e.age}岁)</option>`).join('');
        
        document.getElementById('plan-elder-select').innerHTML = `<option value="">请选择老人</option>${options}`;
        document.getElementById('export-elder-select').innerHTML = `<option value="">请选择老人</option>${options}`;
    },

    generateMealPlan() {
        const elderId = document.getElementById('plan-elder-select').value;
        const date = document.getElementById('plan-date').value;
        const mealType = document.getElementById('plan-meal-type').value;

        if (!elderId) {
            alert('请先选择一位老人！');
            return;
        }

        if (!date) {
            alert('请选择用餐日期！');
            return;
        }

        const elder = dataStore.getElderById(elderId);
        const dishes = dataStore.getDishes();

        if (!elder) {
            alert('老人信息不存在！');
            return;
        }

        if (dishes.length === 0) {
            alert('菜品库为空，请先添加菜品！');
            return;
        }

        const result = mealGenerator.generateMealPlan(elder, dishes, date, mealType);
        this.currentPlan = result;

        this.renderMealPlanResult(result);
    },

    renderMealPlanResult(result) {
        const container = document.getElementById('meal-plan-result');
        const plan = result.bestPlan;

        if (!plan) {
            container.innerHTML = `
                <div class="plan-card">
                    <div class="plan-status blocked">
                        <div class="plan-status-icon">❌</div>
                        <div class="plan-status-text">
                            <h4>无法生成配餐方案</h4>
                            <p>请检查菜品库是否有足够的菜品，或调整忌口规则</p>
                        </div>
                    </div>
                </div>
            `;
            container.style.display = 'block';
            return;
        }

        const statusInfo = this.getStatusInfo(plan.status);
        const proteinStatus = this.getProteinStatus(plan.totalProtein, result.proteinTarget);
        const saltStatus = plan.totalSalt <= result.saltLimit ? 'success' : 'error';
        const costStatus = plan.totalCost <= result.budget ? 'success' : 'warning';

        const elder = dataStore.getElderById(plan.elderId);
        const rules = dataStore.getRulesByIds(elder?.ruleIds || []);

        let html = `
            <div class="plan-card">
                <div class="plan-status ${plan.status}">
                    <div class="plan-status-icon">${statusInfo.icon}</div>
                    <div class="plan-status-text">
                        <h4>${statusInfo.title}</h4>
                        <p>${statusInfo.message}</p>
                    </div>
                </div>
                <div class="plan-details">
                    <div class="plan-section">
                        <h4>📋 方案说明</h4>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                            <p><strong>老人：</strong>${plan.elderName} (${elder?.age}岁, ${elder?.weight}kg)</p>
                            <p><strong>日期：</strong>${plan.date} | <strong>时段：</strong>${CONSTANTS.MEAL_TYPE_MAP[plan.mealType]}</p>
                            ${rules.length > 0 ? `<p><strong>关联忌口：</strong>${rules.map(r => r.name).join('、')}</p>` : ''}
                        </div>
                    </div>

                    <div class="plan-section">
                        <h4>🍽️ 推荐菜品</h4>
                        <div class="dishes-list">
                            ${plan.dishes.map(dish => `
                                <div class="dish-item">
                                    <div class="dish-info">
                                        <span class="dish-name">${dish.name}</span>
                                        <span class="dish-badge">${CONSTANTS.CATEGORY_MAP[dish.category]}</span>
                                        <div class="dish-meta">
                                            盐: ${dish.salt}g | 蛋白: ${dish.protein}g | 成本: ¥${dish.cost.toFixed(2)}
                                        </div>
                                        ${dish.ingredients?.length > 0 ? `<div class="dish-meta">食材: ${dish.ingredients.join('、')}</div>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="plan-section">
                        <h4>📊 营养与成本汇总</h4>
                        <div class="nutrition-summary">
                            <div class="nutrition-item ${saltStatus}">
                                <div class="nutrition-label">总盐量</div>
                                <div class="nutrition-value">${plan.totalSalt}g</div>
                                <div class="nutrition-target">目标: ≤${result.saltLimit}g</div>
                            </div>
                            <div class="nutrition-item ${proteinStatus}">
                                <div class="nutrition-label">总蛋白质</div>
                                <div class="nutrition-value">${plan.totalProtein}g</div>
                                <div class="nutrition-target">目标: ${result.proteinTarget.mealLow}-${result.proteinTarget.mealHigh}g</div>
                            </div>
                            <div class="nutrition-item ${costStatus}">
                                <div class="nutrition-label">总成本</div>
                                <div class="nutrition-value">¥${plan.totalCost.toFixed(2)}</div>
                                <div class="nutrition-target">预算: ¥${result.budget.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
        `;

        if (plan.blockedReasons.length > 0) {
            html += `
                    <div class="plan-blocked">
                        <h5>🚫 拦截原因</h5>
                        <ul>
                            ${plan.blockedReasons.map(r => `<li>${r}</li>`).join('')}
                        </ul>
                    </div>
            `;
        }

        if (plan.issues.length > 0) {
            html += `
                    <div class="plan-issues">
                        <h5>⚠️ 待复核问题</h5>
                        <ul>
                            ${plan.issues.map(r => `<li>${r}</li>`).join('')}
                        </ul>
                    </div>
            `;
        }

        if (plan.warnings.length > 0) {
            html += `
                    <div class="plan-issues" style="background: #d1ecf1; border: 1px solid #bee5eb;">
                        <h5 style="color: #0c5460;">💡 提示信息</h5>
                        <ul style="color: #0c5460;">
                            ${plan.warnings.map(r => `<li>${r}</li>`).join('')}
                        </ul>
                    </div>
            `;
        }

        if (result.alternatives && result.alternatives.length > 0) {
            html += `
                    <div class="alternatives-section">
                        <h4>🔄 替代方案对比</h4>
                        ${this.renderComparisonTable(result, plan)}
                    </div>
            `;
        }

        html += `
                    <div class="plan-actions">
                        <button class="btn btn-primary" onclick="app.saveCurrentPlan()">💾 保存方案</button>
                        <button class="btn btn-secondary" onclick="app.exportCurrentPlan()">📤 导出当前方案</button>
                        <button class="btn btn-warning" onclick="app.clearPlanResult()">🔄 重新生成</button>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        container.style.display = 'block';
    },

    getStatusInfo(status) {
        switch (status) {
            case 'success':
                return {
                    icon: '✅',
                    title: '方案通过验证',
                    message: '所有营养指标、成本和忌口规则均已满足，可以直接执行。'
                };
            case 'warning':
                return {
                    icon: '⚠️',
                    title: '方案待复核',
                    message: '存在需要人工确认的问题，请查看下方详情后决定是否执行。'
                };
            case 'blocked':
                return {
                    icon: '🚫',
                    title: '方案被拦截',
                    message: '存在严重问题，不可执行。请查看拦截原因并调整菜品或规则。'
                };
            default:
                return { icon: '❓', title: '未知状态', message: '' };
        }
    },

    getProteinStatus(actual, target) {
        if (actual < target.mealLow) return 'warning';
        if (actual > target.mealHigh) return 'success';
        return 'success';
    },

    renderComparisonTable(result, bestPlan) {
        const allPlans = [bestPlan, ...result.alternatives];
        const compared = mealGenerator.comparePlans(allPlans, result.proteinTarget, result.saltLimit, result.budget);

        return `
            <div class="comparison-section">
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>方案</th>
                            <th>菜品数</th>
                            <th>盐量(g)</th>
                            <th>蛋白(g)</th>
                            <th>成本(元)</th>
                            <th>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${compared.map((plan, idx) => `
                            <tr>
                                <td>${idx === 0 ? '⭐ 推荐' : `方案${idx + 1}`}</td>
                                <td>${plan.dishes.length}</td>
                                <td class="${plan.comparison.salt.status === 'good' ? 'best' : ''}">
                                    ${plan.totalSalt}
                                    ${plan.comparison.salt.status === 'good' ? ' ✓' : ''}
                                </td>
                                <td class="${plan.comparison.protein.status === 'good' ? 'best' : ''}">
                                    ${plan.totalProtein}
                                    ${plan.comparison.protein.status === 'good' ? ' ✓' : ''}
                                </td>
                                <td class="${plan.comparison.cost.status === 'good' ? 'best' : ''}">
                                    ${plan.totalCost.toFixed(2)}
                                    ${plan.comparison.cost.status === 'good' ? ' ✓' : ''}
                                </td>
                                <td>
                                    <span class="status-badge ${plan.status}">
                                        ${plan.status === 'success' ? '通过' : plan.status === 'warning' ? '待复核' : '拦截'}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    saveCurrentPlan() {
        if (!this.currentPlan || !this.currentPlan.bestPlan) {
            alert('没有可保存的配餐方案！');
            return;
        }

        const plan = { ...this.currentPlan.bestPlan };
        plan.dishes = plan.dishes.map(d => d.id);
        plan.proteinTarget = this.currentPlan.proteinTarget;
        plan.saltLimit = this.currentPlan.saltLimit;
        plan.budget = this.currentPlan.budget;

        dataStore.addPlan(plan);
        this.refreshDashboardStats();
        this.refreshPlanList();
        alert('✅ 配餐方案已保存！');
    },

    clearPlanResult() {
        document.getElementById('meal-plan-result').style.display = 'none';
        this.currentPlan = null;
    },

    refreshPlanList() {
        const tbody = document.getElementById('plans-table-body');
        const plans = dataStore.getPlans();
        const dishesMap = {};
        dataStore.getDishes().forEach(d => dishesMap[d.id] = d);

        if (plans.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        <div class="empty-state-icon">📋</div>
                        <div class="empty-state-text">暂无保存的配餐计划</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = plans.map(plan => `
            <tr>
                <td><strong>${plan.elderName}</strong></td>
                <td>${plan.date}</td>
                <td>${CONSTANTS.MEAL_TYPE_MAP[plan.mealType]}</td>
                <td>
                    <span class="status-badge ${plan.status}">
                        ${plan.status === 'success' ? '通过' : plan.status === 'warning' ? '待复核' : '拦截'}
                    </span>
                </td>
                <td>¥${plan.totalCost.toFixed(2)}</td>
                <td>${plan.totalSalt}g</td>
                <td>${plan.totalProtein}g</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-primary btn-sm" onclick="app.viewPlanDetail('${plan.id}')">详情</button>
                        <button class="btn btn-secondary btn-sm" onclick="app.exportSinglePlan('${plan.id}')">导出</button>
                        <button class="btn btn-danger btn-sm" onclick="app.deletePlan('${plan.id}')">删除</button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    viewPlanDetail(planId) {
        const plan = dataStore.getPlanById(planId);
        if (!plan) return;

        const dishes = plan.dishes.map(id => dataStore.getDishById(id)).filter(Boolean);
        const statusInfo = this.getStatusInfo(plan.status);

        const modal = document.getElementById('plan-detail-modal');
        const content = document.getElementById('plan-detail-content');

        content.innerHTML = `
            <div class="plan-card" style="box-shadow: none;">
                <div class="plan-status ${plan.status}" style="margin: -20px -20px 20px -20px; border-radius: 0;">
                    <div class="plan-status-icon">${statusInfo.icon}</div>
                    <div class="plan-status-text">
                        <h4>${statusInfo.title}</h4>
                        <p>${statusInfo.message}</p>
                    </div>
                </div>

                <div class="plan-section">
                    <h4>📋 基本信息</h4>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <p><strong>老人：</strong>${plan.elderName}</p>
                        <p><strong>日期：</strong>${plan.date} | <strong>时段：</strong>${CONSTANTS.MEAL_TYPE_MAP[plan.mealType]}</p>
                        <p><strong>创建时间：</strong>${new Date(plan.createdAt).toLocaleString()}</p>
                    </div>
                </div>

                <div class="plan-section">
                    <h4>🍽️ 菜品列表</h4>
                    <div class="dishes-list">
                        ${dishes.map(dish => `
                            <div class="dish-item">
                                <div class="dish-info">
                                    <span class="dish-name">${dish.name}</span>
                                    <span class="dish-badge">${CONSTANTS.CATEGORY_MAP[dish.category]}</span>
                                    <div class="dish-meta">
                                        盐: ${dish.salt}g | 蛋白: ${dish.protein}g | 成本: ¥${dish.cost.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="plan-section">
                    <h4>📊 汇总</h4>
                    <div class="nutrition-summary">
                        <div class="nutrition-item">
                            <div class="nutrition-label">总盐量</div>
                            <div class="nutrition-value">${plan.totalSalt}g</div>
                            <div class="nutrition-target">限制: ≤${plan.saltLimit || CONSTANTS.SALT_LIMIT_PER_MEAL}g</div>
                        </div>
                        <div class="nutrition-item">
                            <div class="nutrition-label">总蛋白质</div>
                            <div class="nutrition-value">${plan.totalProtein}g</div>
                            <div class="nutrition-target">目标: ${plan.proteinTarget?.mealLow || 0}-${plan.proteinTarget?.mealHigh || 0}g</div>
                        </div>
                        <div class="nutrition-item">
                            <div class="nutrition-label">总成本</div>
                            <div class="nutrition-value">¥${plan.totalCost.toFixed(2)}</div>
                            <div class="nutrition-target">预算: ¥${(plan.budget || 0).toFixed(2)}</div>
                        </div>
                    </div>
                </div>

                ${plan.blockedReasons?.length > 0 ? `
                <div class="plan-blocked">
                    <h5>🚫 拦截原因</h5>
                    <ul>${plan.blockedReasons.map(r => `<li>${r}</li>`).join('')}</ul>
                </div>` : ''}

                ${plan.issues?.length > 0 ? `
                <div class="plan-issues">
                    <h5>⚠️ 待复核问题</h5>
                    <ul>${plan.issues.map(r => `<li>${r}</li>`).join('')}</ul>
                </div>` : ''}
            </div>
        `;

        modal.classList.add('active');
    },

    closePlanDetailModal() {
        document.getElementById('plan-detail-modal').classList.remove('active');
    },

    deletePlan(id) {
        if (confirm('确定要删除这个配餐计划吗？')) {
            dataStore.deletePlan(id);
            this.refreshPlanList();
            this.refreshDashboardStats();
        }
    },

    exportByDate() {
        const startDate = document.getElementById('export-start-date').value;
        const endDate = document.getElementById('export-end-date').value;

        if (!startDate || !endDate) {
            alert('请选择日期范围！');
            return;
        }

        const plans = dataStore.getPlansByDateRange(startDate, endDate);
        if (plans.length === 0) {
            alert('该日期范围内没有配餐计划！');
            return;
        }

        this.exportPlans(plans, `配餐计划_${startDate}_${endDate}`);
    },

    exportByElder() {
        const elderId = document.getElementById('export-elder-select').value;
        if (!elderId) {
            alert('请选择一位老人！');
            return;
        }

        const elder = dataStore.getElderById(elderId);
        const plans = dataStore.getPlansByElder(elderId);

        if (plans.length === 0) {
            alert('该老人没有保存的配餐计划！');
            return;
        }

        this.exportPlans(plans, `配餐计划_${elder?.name}`);
    },

    exportAll() {
        const plans = dataStore.getPlans();
        if (plans.length === 0) {
            alert('没有可导出的配餐计划！');
            return;
        }

        this.exportPlans(plans, '全部配餐计划');
    },

    exportCurrentPlan() {
        if (!this.currentPlan || !this.currentPlan.bestPlan) {
            alert('没有可导出的方案！');
            return;
        }

        const plan = { ...this.currentPlan.bestPlan };
        this.exportPlans([plan], `配餐方案_${plan.elderName}_${plan.date}`);
    },

    exportSinglePlan(planId) {
        const plan = dataStore.getPlanById(planId);
        if (plan) {
            const fullDishes = plan.dishes.map(id => dataStore.getDishById(id)).filter(Boolean);
            this.exportPlans([{ ...plan, dishes: fullDishes }], `配餐计划_${plan.elderName}_${plan.date}`);
        }
    },

    exportPlans(plans, filename) {
        const dishesMap = {};
        dataStore.getDishes().forEach(d => dishesMap[d.id] = d);

        let csv = '\ufeff';
        csv += '老人姓名,日期,时段,状态,菜品,总盐量(g),总蛋白质(g),总成本(元),问题,备注\n';

        plans.forEach(plan => {
            const dishes = plan.dishes.map(d => typeof d === 'string' ? dishesMap[d]?.name : d.name).filter(Boolean).join('；');
            const status = plan.status === 'success' ? '通过' : plan.status === 'warning' ? '待复核' : '拦截';
            const issues = (plan.issues || []).concat(plan.blockedReasons || []).join('；');

            csv += `"${plan.elderName}",${plan.date},${CONSTANTS.MEAL_TYPE_MAP[plan.mealType]},${status},"${dishes}",${plan.totalSalt},${plan.totalProtein},${plan.totalCost.toFixed(2)},"${issues}","${(plan.warnings || []).join('；')}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.csv`;
        link.click();
    },

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        this.currentDishId = null;
        this.currentElderId = null;
        this.currentRuleId = null;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
