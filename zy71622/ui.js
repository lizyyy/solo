const UI = (function() {
    function formatCurrency(value) {
        return '¥' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function formatPercent(value) {
        return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
    }

    function updateStatusPanel() {
        const state = GameState.getState();
        const portfolio = GameState.getPortfolioValue();

        document.getElementById('cashDisplay').textContent = formatCurrency(state.cash);
        document.getElementById('ingredientsValue').textContent = formatCurrency(portfolio.ingredientsValue);
        document.getElementById('fundsValue').textContent = formatCurrency(portfolio.fundsValue);
        document.getElementById('totalAssets').textContent = formatCurrency(portfolio.total);

        document.getElementById('currentRound').textContent = `第 ${state.round} 回合`;
        document.getElementById('gamePhase').textContent = state.phase === 'preparation' ? '准备阶段' : '经营阶段';

        updatePendingRecords();
    }

    function updatePendingRecords() {
        const pendingRecords = GameState.getPendingRecords();
        const section = document.getElementById('pendingSection');
        const list = document.getElementById('pendingList');

        if (pendingRecords.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        list.innerHTML = pendingRecords.map(record => `
            <div class="pending-item">
                <div class="pending-reason">${record.reason}</div>
                <div class="pending-actions">
                    <button class="btn-small success" onclick="App.resolvePending(${record.id}, 'accept')">接受</button>
                    <button class="btn-small danger" onclick="App.resolvePending(${record.id}, 'reject')">拒绝</button>
                </div>
            </div>
        `).join('');
    }

    function renderInventory() {
        const state = GameState.getState();
        const ingredientsData = GameState.getIngredientsData();
        const inventorySummary = GameEngine.getAllInventorySummary();
        const priceMultiplier = state.currentEvent?.impact?.priceMultiplier || 1;

        const grid = document.getElementById('inventoryGrid');
        grid.innerHTML = '';

        Object.entries(ingredientsData).forEach(([key, data]) => {
            const inventory = inventorySummary[key];
            const currentPrice = state.ingredientPrices[key] * priceMultiplier;
            
            const card = document.createElement('div');
            card.className = 'inventory-card';
            card.innerHTML = `
                <div class="card-header">
                    <span class="item-emoji">${data.emoji}</span>
                    <span class="item-name">${data.name}</span>
                </div>
                <div class="card-stats">
                    <div class="stat">
                        <span class="stat-label">库存</span>
                        <span class="stat-value">${inventory.quantity}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">价值</span>
                        <span class="stat-value">${formatCurrency(inventory.value)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">现价</span>
                        <span class="stat-value ${priceMultiplier !== 1 ? (priceMultiplier > 1 ? 'text-danger' : 'text-success') : ''}">${formatCurrency(currentPrice)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">保质期</span>
                        <span class="stat-value">${data.perishTime}回合</span>
                    </div>
                </div>
                <div class="card-actions">
                    <input type="number" min="1" value="5" id="buy-qty-${key}" class="qty-input">
                    <button class="btn-small primary" onclick="App.buyIngredient('${key}')">购买</button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    function renderFunds() {
        const state = GameState.getState();
        const fundsData = GameState.getFundsData();
        const grid = document.getElementById('fundsGrid');
        grid.innerHTML = '';

        Object.entries(state.funds).forEach(([key, fundState]) => {
            const fund = fundsData[key];
            const marketValue = fundState.shares * fundState.currentPrice;
            const costBasis = fundState.shares * fundState.avgCost;
            const gain = marketValue - costBasis;
            const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;

            const card = document.createElement('div');
            card.className = 'fund-card';
            card.innerHTML = `
                <div class="card-header">
                    <span class="item-emoji">${fund.emoji}</span>
                    <span class="item-name">${fund.name}</span>
                    <span class="fund-risk ${fund.volatility > 0.05 ? 'high-risk' : fund.volatility > 0.02 ? 'medium-risk' : 'low-risk'}">
                        ${fund.volatility > 0.05 ? '高风险' : fund.volatility > 0.02 ? '中风险' : '低风险'}
                    </span>
                </div>
                <div class="fund-description">${fund.description}</div>
                <div class="card-stats">
                    <div class="stat">
                        <span class="stat-label">持有份额</span>
                        <span class="stat-value">${fundState.shares}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">当前净值</span>
                        <span class="stat-value">${formatCurrency(fundState.currentPrice)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">成本价</span>
                        <span class="stat-value">${formatCurrency(fundState.avgCost)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">市值</span>
                        <span class="stat-value">${formatCurrency(marketValue)}</span>
                    </div>
                    <div class="stat full-width">
                        <span class="stat-label">浮动盈亏</span>
                        <span class="stat-value ${gain >= 0 ? 'text-success' : 'text-danger'}">
                            ${formatCurrency(gain)} (${formatPercent(gainPercent)})
                        </span>
                    </div>
                </div>
                <div class="card-actions">
                    <input type="number" min="1" value="10" id="fund-qty-${key}" class="qty-input">
                    <button class="btn-small primary" onclick="App.buyFund('${key}')">买入</button>
                    <button class="btn-small warning" onclick="App.sellFund('${key}')">卖出</button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    function renderOrders() {
        const state = GameState.getState();
        const recipes = GameState.getRecipes();
        const list = document.getElementById('ordersList');
        
        if (state.orders.length === 0) {
            list.innerHTML = '<div class="empty-state">暂无订单</div>';
            return;
        }

        list.innerHTML = state.orders.map(order => {
            const recipe = recipes[order.recipeKey];
            const ingredientsList = Object.entries(recipe.ingredients)
                .map(([key, qty]) => {
                    const inv = GameEngine.getIngredientInventory(key);
                    const enough = inv.quantity >= qty;
                    return `<span class="ingredient-tag ${enough ? '' : 'insufficient'}">${key} x${qty}</span>`;
                }).join('');

            const patiencePercent = (order.patience / order.maxPatience) * 100;
            const patienceClass = order.patience <= 1 ? 'danger' : order.patience <= 2 ? 'warning' : 'success';

            return `
                <div class="order-card ${order.status}">
                    <div class="order-header">
                        <span class="order-emoji">${order.emoji}</span>
                        <span class="order-name">${order.recipeName}</span>
                        <span class="order-price">${formatCurrency(order.price)}</span>
                    </div>
                    <div class="order-patience">
                        <div class="patience-bar">
                            <div class="patience-fill ${patienceClass}" style="width: ${patiencePercent}%"></div>
                        </div>
                        <span class="patience-text">剩余耐心: ${order.patience}/${order.maxPatience} 回合</span>
                    </div>
                    <div class="order-ingredients">
                        ${ingredientsList}
                    </div>
                    <div class="order-status">
                        ${order.status === 'pending' 
                            ? `<button class="btn-small success" onclick="App.processOrder(${order.id})">完成订单</button>`
                            : order.status === 'completed' 
                                ? '<span class="status-badge completed">✓ 已完成</span>'
                                : '<span class="status-badge expired">✗ 已超时</span>'
                        }
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderMarketEvent() {
        const state = GameState.getState();
        const event = state.currentEvent;
        const eventEl = document.getElementById('marketEvent');
        
        const eventClass = event.id === 'normal' ? 'normal' 
            : event.id.includes('bull') || event.id.includes('peak') || event.id.includes('sale') ? 'positive' 
            : 'negative';

        eventEl.className = `event-card ${eventClass}`;
        eventEl.innerHTML = `
            <div class="event-title">${event.name}</div>
            <p>${event.effect}</p>
        `;
    }

    function renderLogs() {
        const state = GameState.getState();
        const container = document.getElementById('logContainer');
        
        container.innerHTML = state.logs.slice(0, 30).map(log => `
            <div class="log-entry ${log.type}">
                <span class="log-round">[R${log.round}]</span>
                <span class="log-message">${log.message}</span>
            </div>
        `).join('');
    }

    function renderHistory() {
        const snapshots = GameState.getAllSnapshots();
        const select = document.getElementById('historySelect');
        
        select.innerHTML = snapshots.map(s => 
            `<option value="${s.id}">${s.label} - ${new Date(s.timestamp).toLocaleString()}</option>`
        ).join('');

        if (snapshots.length > 0) {
            renderHistoryView(snapshots[0].id);
        }
    }

    function renderHistoryView(snapshotId) {
        const snapshot = GameState.getSnapshot(snapshotId);
        if (!snapshot) return;

        const view = document.getElementById('historyView');
        const s = snapshot.state;
        const portfolio = {
            cash: s.cash,
            ingredientsValue: calculateIngredientsValue(s.inventory),
            fundsValue: calculateFundsValue(s.funds),
            total: 0
        };
        portfolio.total = portfolio.cash + portfolio.ingredientsValue + portfolio.fundsValue;

        view.innerHTML = `
            <div class="snapshot-summary">
                <h4>${snapshot.label}</h4>
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="label">现金</span>
                        <span class="value">${formatCurrency(portfolio.cash)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">食材价值</span>
                        <span class="value">${formatCurrency(portfolio.ingredientsValue)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">基金市值</span>
                        <span class="value">${formatCurrency(portfolio.fundsValue)}</span>
                    </div>
                    <div class="summary-item highlight">
                        <span class="label">总资产</span>
                        <span class="value">${formatCurrency(portfolio.total)}</span>
                    </div>
                </div>
                <div class="snapshot-actions">
                    <button class="btn-small info" onclick="App.restoreSnapshot(${snapshot.id})">恢复到此状态</button>
                </div>
            </div>
        `;
    }

    function calculateIngredientsValue(inventory) {
        let value = 0;
        Object.keys(inventory).forEach(key => {
            const items = inventory[key] || [];
            items.forEach(item => {
                value += item.quantity * item.price;
            });
        });
        return value;
    }

    function calculateFundsValue(funds) {
        let value = 0;
        Object.keys(funds).forEach(key => {
            value += funds[key].shares * funds[key].currentPrice;
        });
        return value;
    }

    function renderReport() {
        const report = GameEngine.generateReport();
        const content = document.getElementById('reportContent');

        content.innerHTML = `
            <div class="report-section">
                <h3>📊 总体表现 (第 ${report.round} 回合)</h3>
                <div class="report-grid">
                    <div class="report-card">
                        <div class="report-label">初始资金</div>
                        <div class="report-value">${formatCurrency(report.portfolio.cash - report.portfolio.totalReturn)}</div>
                    </div>
                    <div class="report-card">
                        <div class="report-label">当前总资产</div>
                        <div class="report-value highlight">${formatCurrency(report.portfolio.total)}</div>
                    </div>
                    <div class="report-card">
                        <div class="report-label">累计收益</div>
                        <div class="report-value ${report.portfolio.totalReturn >= 0 ? 'positive' : 'negative'}">
                            ${formatCurrency(report.portfolio.totalReturn)}
                        </div>
                    </div>
                    <div class="report-card">
                        <div class="report-label">收益率</div>
                        <div class="report-value ${report.portfolio.returnRate >= 0 ? 'positive' : 'negative'}">
                            ${formatPercent(report.portfolio.returnRate)}
                        </div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3>💵 资产配置分析</h3>
                <div class="allocation-bar">
                    <div class="allocation-segment cash" style="width: ${report.assetAllocation.cashPercent}%">
                        <span>现金 ${report.assetAllocation.cashPercent.toFixed(1)}%</span>
                    </div>
                    <div class="allocation-segment ingredients" style="width: ${report.assetAllocation.ingredientsPercent}%">
                        <span>食材 ${report.assetAllocation.ingredientsPercent.toFixed(1)}%</span>
                    </div>
                    <div class="allocation-segment funds" style="width: ${report.assetAllocation.fundsPercent}%">
                        <span>基金 ${report.assetAllocation.fundsPercent.toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3>📈 投资组合明细</h3>
                ${report.fundAllocation.length > 0 ? `
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>基金</th>
                                <th>份额</th>
                                <th>成本价</th>
                                <th>现价</th>
                                <th>市值</th>
                                <th>盈亏</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.fundAllocation.map(f => `
                                <tr>
                                    <td>${f.emoji} ${f.name}</td>
                                    <td>${f.shares}</td>
                                    <td>${formatCurrency(f.avgCost)}</td>
                                    <td>${formatCurrency(f.currentPrice)}</td>
                                    <td>${formatCurrency(f.marketValue)}</td>
                                    <td class="${f.gain >= 0 ? 'positive' : 'negative'}">${formatCurrency(f.gain)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="fund-summary">
                        <span>已实现收益: <strong class="${report.funds.realizedGain >= 0 ? 'positive' : 'negative'}">${formatCurrency(report.funds.realizedGain)}</strong></span>
                        <span>浮动盈亏: <strong class="${report.funds.unrealizedGain >= 0 ? 'positive' : 'negative'}">${formatCurrency(report.funds.unrealizedGain)}</strong></span>
                        <span>投资总收益: <strong class="${report.funds.totalGain >= 0 ? 'positive' : 'negative'}">${formatCurrency(report.funds.totalGain)}</strong></span>
                    </div>
                ` : '<p class="empty-text">暂无基金持仓</p>'}
            </div>

            <div class="report-section">
                <h3>🍳 库存明细</h3>
                ${report.inventory.length > 0 ? `
                    <div class="inventory-list">
                        ${report.inventory.map(i => `
                            <div class="inv-item">
                                <span class="inv-emoji">${i.emoji}</span>
                                <span class="inv-name">${i.name}</span>
                                <span class="inv-qty">x${i.quantity}</span>
                                <span class="inv-value">${formatCurrency(i.value)}</span>
                                <span class="inv-cat">${i.category}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="empty-text">暂无库存</p>'}
            </div>

            <div class="report-section">
                <h3>📋 经营统计</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-icon">📦</span>
                        <span class="stat-label">订单完成</span>
                        <span class="stat-value">${report.orders.completed}/${report.orders.total}</span>
                        <span class="stat-sub">成功率 ${report.orders.successRate.toFixed(0)}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-icon">💰</span>
                        <span class="stat-label">营业收入</span>
                        <span class="stat-value">${formatCurrency(report.statistics.totalRevenue)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-icon">💸</span>
                        <span class="stat-label">采购成本</span>
                        <span class="stat-value">${formatCurrency(report.statistics.totalCost)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-icon">📉</span>
                        <span class="stat-label">食材浪费</span>
                        <span class="stat-value">${formatCurrency(report.statistics.ingredientsWasted)}</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3>💡 经营洞察</h3>
                <div class="insights-list">
                    ${report.insights.map(i => `
                        <div class="insight-item ${i.type}">
                            <span class="insight-icon">${i.type === 'success' ? '✅' : i.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                            <span>${i.text}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="report-section">
                <h3>📝 改进建议</h3>
                <div class="recommendations-list">
                    ${report.recommendations.map(r => `
                        <div class="recommendation-item priority-${r.priority}">
                            <span class="rec-area">[${r.area}]</span>
                            <span class="rec-text">${r.text}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function setupTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');

                if (tab.dataset.tab === 'history') {
                    renderHistory();
                }
            });
        });
    }

    function refreshAll() {
        updateStatusPanel();
        renderInventory();
        renderFunds();
        renderOrders();
        renderMarketEvent();
        renderLogs();
    }

    return {
        formatCurrency,
        formatPercent,
        updateStatusPanel,
        renderInventory,
        renderFunds,
        renderOrders,
        renderMarketEvent,
        renderLogs,
        renderHistory,
        renderHistoryView,
        renderReport,
        setupTabs,
        refreshAll
    };
})();
