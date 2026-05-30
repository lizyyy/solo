const App = (function() {
    function init() {
        GameState.init();
        UI.setupTabs();
        setupEventListeners();
        UI.refreshAll();
    }

    function setupEventListeners() {
        document.getElementById('processOrdersBtn').addEventListener('click', processAllOrders);
        document.getElementById('nextRoundBtn').addEventListener('click', nextRound);
        document.getElementById('resetBtn').addEventListener('click', resetGame);
        document.getElementById('viewReportBtn').addEventListener('click', viewReport);
        document.getElementById('exportBtn').addEventListener('click', exportData);
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });
        document.getElementById('importFile').addEventListener('change', importData);
        
        document.getElementById('historySelect').addEventListener('change', (e) => {
            UI.renderHistoryView(parseInt(e.target.value));
        });
    }

    function buyIngredient(ingredientKey) {
        const qtyInput = document.getElementById(`buy-qty-${ingredientKey}`);
        const quantity = parseInt(qtyInput.value) || 1;
        const result = GameEngine.buyIngredient(ingredientKey, quantity);
        UI.refreshAll();
        return result;
    }

    function buyFund(fundKey) {
        const qtyInput = document.getElementById(`fund-qty-${fundKey}`);
        const shares = parseInt(qtyInput.value) || 1;
        const result = GameEngine.buyFund(fundKey, shares);
        UI.refreshAll();
        return result;
    }

    function sellFund(fundKey) {
        const qtyInput = document.getElementById(`fund-qty-${fundKey}`);
        const shares = parseInt(qtyInput.value) || 1;
        const result = GameEngine.sellFund(fundKey, shares);
        UI.refreshAll();
        return result;
    }

    function processOrder(orderId) {
        const result = GameEngine.processOrder(orderId);
        UI.refreshAll();
        return result;
    }

    function processAllOrders() {
        const results = GameEngine.processAllOrders();
        UI.refreshAll();
        return results;
    }

    function nextRound() {
        const result = GameEngine.nextRound();
        UI.refreshAll();
        return result;
    }

    function resetGame() {
        if (confirm('确定要重新开始游戏吗？所有进度将被清除。')) {
            GameState.reset();
            UI.refreshAll();
        }
    }

    function viewReport() {
        UI.renderReport();
        document.getElementById('reportModal').style.display = 'flex';
    }

    function closeReportModal() {
        document.getElementById('reportModal').style.display = 'none';
    }

    function resolvePending(recordId, action) {
        const result = GameState.resolvePendingRecord(recordId, action);
        UI.refreshAll();
        return result;
    }

    function restoreSnapshot(snapshotId) {
        if (confirm('确定要恢复到此状态吗？当前进度将被覆盖。')) {
            GameState.restoreSnapshot(snapshotId);
            UI.refreshAll();
            alert('状态已恢复！');
        }
    }

    function exportData() {
        const data = GameState.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fund_manager_report_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        GameState.addLog('📤 数据已导出', 'info');
    }

    function importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (GameState.importData(data)) {
                    UI.refreshAll();
                    GameState.addLog('📥 数据已导入', 'success');
                    alert('数据导入成功！');
                } else {
                    alert('数据导入失败：格式错误');
                }
            } catch (err) {
                console.error('Import error:', err);
                alert('数据导入失败：' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        buyIngredient,
        buyFund,
        sellFund,
        processOrder,
        processAllOrders,
        nextRound,
        resetGame,
        viewReport,
        closeReportModal,
        resolvePending,
        restoreSnapshot,
        exportData,
        importData
    };
})();

window.closeReportModal = App.closeReportModal;
window.App = App;
