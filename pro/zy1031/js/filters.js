/**
 * 筛选模块
 * 负责数据筛选功能
 */

const Filters = {
    // 当前筛选条件
    currentFilters: {
        player: '',
        shotType: '',
        result: '',
        date: ''
    },
    
    /**
     * 初始化筛选模块
     */
    init() {
        this.bindEvents();
    },
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 球员筛选
        const playerFilter = document.getElementById('playerFilter');
        if (playerFilter) {
            playerFilter.addEventListener('change', () => {
                this.currentFilters.player = playerFilter.value;
                this.applyFilters();
            });
        }
        
        // 拍型筛选
        const shotTypeFilter = document.getElementById('shotTypeFilter');
        if (shotTypeFilter) {
            shotTypeFilter.addEventListener('change', () => {
                this.currentFilters.shotType = shotTypeFilter.value;
                this.applyFilters();
            });
        }
        
        // 回合结果筛选
        const resultFilter = document.getElementById('resultFilter');
        if (resultFilter) {
            resultFilter.addEventListener('change', () => {
                this.currentFilters.result = resultFilter.value;
                this.applyFilters();
            });
        }
        
        // 日期筛选
        const dateFilter = document.getElementById('dateFilter');
        if (dateFilter) {
            dateFilter.addEventListener('change', () => {
                this.currentFilters.date = dateFilter.value;
                this.applyFilters();
            });
        }
        
        // 重置筛选按钮
        const resetFiltersBtn = document.getElementById('resetFiltersBtn');
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                this.resetFilters();
            });
        }
    },
    
    /**
     * 更新筛选选项
     * @param {Array} data 数据数组
     */
    updateFilterOptions(data) {
        if (!data || data.length === 0) return;
        
        // 更新球员选项
        const players = Utils.unique(data, '球员');
        this.updateSelectOptions('playerFilter', players);
        
        // 更新拍型选项
        const shotTypes = Utils.unique(data, '拍型');
        this.updateSelectOptions('shotTypeFilter', shotTypes);
        
        // 更新日期选项
        const dates = Utils.unique(data, '训练日期').filter(d => d && d !== '');
        if (dates.length > 0) {
            this.updateSelectOptions('dateFilter', dates);
        } else {
            // 如果数据中没有日期，从训练数据元数据中获取
            const currentData = DataManager.getCurrentData();
            if (currentData && currentData.trainingDate) {
                this.updateSelectOptions('dateFilter', [currentData.trainingDate]);
            }
        }
    },
    
    /**
     * 更新下拉框选项
     * @param {string} selectId 下拉框ID
     * @param {Array} options 选项数组
     */
    updateSelectOptions(selectId, options) {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        // 保存当前选中值
        const currentValue = select.value;
        
        // 清空选项（保留"全部"选项）
        select.innerHTML = '<option value="">全部</option>';
        
        // 添加新选项
        for (const option of options) {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            if (option === currentValue) {
                opt.selected = true;
            }
            select.appendChild(opt);
        }
    },
    
    /**
     * 应用筛选条件
     */
    applyFilters() {
        const currentData = DataManager.getCurrentData();
        if (!currentData) return;
        
        // 构建筛选条件对象
        const filterConditions = {};
        
        if (this.currentFilters.player && this.currentFilters.player !== '') {
            filterConditions['球员'] = this.currentFilters.player;
        }
        
        if (this.currentFilters.shotType && this.currentFilters.shotType !== '') {
            filterConditions['拍型'] = this.currentFilters.shotType;
        }
        
        if (this.currentFilters.result && this.currentFilters.result !== '') {
            filterConditions['回合结果'] = this.currentFilters.result;
        }
        
        if (this.currentFilters.date && this.currentFilters.date !== '') {
            filterConditions['训练日期'] = this.currentFilters.date;
        }
        
        // 应用筛选
        DataManager.applyFilters(filterConditions);
        
        // 更新图表
        Visualization.updateAllCharts(DataManager.filteredData);
        
        // 更新统计信息
        this.updateStats();
        
        Utils.showToast(`筛选完成，共 ${DataManager.filteredData.length} 条记录`, 'info');
    },
    
    /**
     * 重置筛选条件
     */
    resetFilters() {
        // 重置筛选条件
        this.currentFilters = {
            player: '',
            shotType: '',
            result: '',
            date: ''
        };
        
        // 重置下拉框
        const selects = ['playerFilter', 'shotTypeFilter', 'resultFilter', 'dateFilter'];
        for (const selectId of selects) {
            const select = document.getElementById(selectId);
            if (select) {
                select.value = '';
            }
        }
        
        // 重置数据筛选
        DataManager.resetFilters();
        
        // 更新图表
        Visualization.updateAllCharts(DataManager.filteredData);
        
        // 更新统计信息
        this.updateStats();
        
        Utils.showToast('已重置筛选条件', 'info');
    },
    
    /**
     * 更新统计信息
     */
    updateStats() {
        const data = DataManager.filteredData;
        if (!data || data.length === 0) return;
        
        // 更新总拍数
        const totalShotsEl = document.getElementById('totalShots');
        if (totalShotsEl) {
            totalShotsEl.textContent = data.length;
        }
        
        // 计算得分率
        const winRate = Validator.calculateWinRate(data);
        const winRateEl = document.getElementById('winRate');
        if (winRateEl) {
            winRateEl.textContent = Utils.calculatePercentage(winRate, 1, 1);
        }
        
        // 计算训练时长（假设每拍约30秒，取前20拍的时间或估算）
        const duration = Math.ceil(data.length * 0.5); // 估算：每拍约30秒
        const durationEl = document.getElementById('trainingDuration');
        if (durationEl) {
            durationEl.textContent = `${duration}分钟`;
        }
        
        // 参与球员数量
        const players = Utils.unique(data, '球员');
        const playerCountEl = document.getElementById('playerCount');
        if (playerCountEl) {
            playerCountEl.textContent = `${players.length}人`;
        }
    },
    
    /**
     * 获取当前筛选条件的描述
     * @returns {string} 筛选条件描述
     */
    getFilterDescription() {
        const descriptions = [];
        
        if (this.currentFilters.player) {
            descriptions.push(`球员: ${this.currentFilters.player}`);
        }
        
        if (this.currentFilters.shotType) {
            descriptions.push(`拍型: ${this.currentFilters.shotType}`);
        }
        
        if (this.currentFilters.result) {
            descriptions.push(`结果: ${this.currentFilters.result}`);
        }
        
        if (this.currentFilters.date) {
            descriptions.push(`日期: ${this.currentFilters.date}`);
        }
        
        return descriptions.length > 0 ? descriptions.join(' | ') : '无筛选';
    },
    
    /**
     * 检查是否有筛选条件
     * @returns {boolean} 是否有筛选条件
     */
    hasFilters() {
        return this.currentFilters.player !== '' ||
               this.currentFilters.shotType !== '' ||
               this.currentFilters.result !== '' ||
               this.currentFilters.date !== '';
    }
};
