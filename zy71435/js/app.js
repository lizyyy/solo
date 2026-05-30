const App = {
    currentTab: 'import',

    init() {
        DataTrace.init();
        
        ImportModule.init();
        GameModule.init();
        ReviewModule.init();
        ExportModule.init();

        this.bindEvents();
        this.loadSavedData();
        this.updateTab('import');

        showToast('🌌 黑洞逃逸速度棋已加载完成！', 'success');
    },

    bindEvents() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.updateTab(tab);
            });
        });

        document.getElementById('closeTraceModal').addEventListener('click', () => {
            DataTrace.closeTraceModal();
        });

        document.getElementById('traceModal').addEventListener('click', (e) => {
            if (e.target.id === 'traceModal') {
                DataTrace.closeTraceModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                DataTrace.closeTraceModal();
            }
        });
    },

    updateTab(tabName) {
        this.currentTab = tabName;

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });

        if (tabName === 'review') {
            ReviewModule.loadHistory();
        } else if (tabName === 'export') {
            ExportModule.refreshExportList();
        }
    },

    loadSavedData() {
        const hasData = ImportModule.loadStoredData();
        if (hasData) {
            showToast('已恢复上次导入的数据', 'info');
        }
    },

    verifyCalculationConsistency() {
        console.log('🔍 验证计算口径一致性...');

        const testBody = {
            id: 'TEST-001',
            name: '测试天体',
            type: 'planet',
            mass: '5.972e24 kg',
            radius: '6371 km'
        };

        const testShip = {
            id: 'TEST-SHIP',
            name: '测试飞船',
            baseVelocity: '8 km/s'
        };

        const testFuels = [
            { id: 'TEST-FUEL-1', name: '测试燃料1', type: 'chemical', velocityBoost: '2 km/s' },
            { id: 'TEST-FUEL-2', name: '测试燃料2', type: 'nuclear', velocityBoost: '5 km/s' }
        ];

        const escapeResult1 = Physics.calculateEscapeVelocity(testBody);
        const escapeResult2 = Physics.calculateEscapeVelocity(testBody);
        
        console.log('逃逸速度计算一致性:', 
            escapeResult1.escapeVelocityKms === escapeResult2.escapeVelocityKms ? '✅ 通过' : '❌ 失败');
        console.log('  结果:', escapeResult1.escapeVelocityKms.toFixed(4), 'km/s');
        console.log('  预期: ~11.1857 km/s');

        const velResult1 = Physics.calculateTotalVelocity(testShip, testFuels, 'away');
        const velResult2 = Physics.calculateTotalVelocity(testShip, testFuels, 'away');
        
        console.log('速度计算一致性:', 
            velResult1.totalVelocityKms === velResult2.totalVelocityKms ? '✅ 通过' : '❌ 失败');
        console.log('  结果:', velResult1.totalVelocityKms.toFixed(4), 'km/s');
        console.log('  预期: 15.0000 km/s');

        const checkResult = Physics.checkEscape(velResult1, escapeResult1);
        console.log('逃逸检查一致性:', checkResult.canEscape ? '✅ 可以逃逸' : '❌ 无法逃逸');
        console.log('  速度差:', checkResult.velocityDiffKms.toFixed(4), 'km/s');
        console.log('  预期: ~3.8143 km/s (正数，可以逃逸)');

        const wrongDirResult = Physics.calculateTotalVelocity(testShip, testFuels, 'towards');
        const wrongDirCheck = Physics.checkEscape(wrongDirResult, escapeResult1);
        console.log('方向错误检测:', wrongDirCheck.errorType === 'wrong_direction' ? '✅ 通过' : '❌ 失败');
        console.log('  错误类型:', wrongDirCheck.errorType);

        const errorBody = {
            id: 'TEST-ERROR',
            name: '错误天体',
            type: 'planet',
            mass: '5.972e24 千斤',
            radius: '6371 km'
        };
        const errorResult = Physics.calculateEscapeVelocity(errorBody);
        console.log('单位错误检测:', !errorResult.valid && errorResult.error.includes('千斤') ? '✅ 通过' : '❌ 失败');
        console.log('  错误信息:', errorResult.error);

        const lowFuelResult = Physics.calculateTotalVelocity(testShip, [], 'away');
        const lowFuelCheck = Physics.checkEscape(lowFuelResult, escapeResult1);
        console.log('燃料不足检测:', lowFuelCheck.errorType === 'insufficient_fuel' ? '✅ 通过' : '❌ 失败');
        console.log('  错误类型:', lowFuelCheck.errorType);
        console.log('  速度差:', lowFuelCheck.velocityDiffKms.toFixed(4), 'km/s');

        console.log('✅ 计算口径一致性验证完成');
        return true;
    },

    getSystemInfo() {
        return {
            version: '1.0.0',
            schemaVersion: '1.0',
            calculationRules: {
                escapeVelocityFormula: 'v = √(2GM/r)',
                gravitationalConstant: GAME_CONFIG.G,
                units: {
                    mass: ['kg', '吨', 'M⊕', 'M☉'],
                    radius: ['m', 'km'],
                    velocity: ['m/s', 'km/s']
                }
            },
            supportedBodyTypes: Object.keys(GAME_CONFIG.BODY_TYPES),
            supportedFuelTypes: Object.keys(GAME_CONFIG.FUEL_TYPES)
        };
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
    
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setTimeout(() => {
            App.verifyCalculationConsistency();
        }, 1000);
    }
});

window.App = App;
window.Physics = Physics;
window.DataTrace = DataTrace;
