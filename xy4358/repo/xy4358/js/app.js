(function() {
    'use strict';

    function checkDependencies() {
        const dependencies = {
            'Utils': typeof Utils !== 'undefined',
            'Storage': typeof Storage !== 'undefined',
            'DataImport': typeof DataImport !== 'undefined',
            'Validators': typeof Validators !== 'undefined',
            'DataExport': typeof DataExport !== 'undefined',
            'UI': typeof UI !== 'undefined'
        };

        const missing = Object.entries(dependencies)
            .filter(([_, loaded]) => !loaded)
            .map(([name]) => name);

        return {
            allLoaded: missing.length === 0,
            missing: missing,
            dependencies: dependencies
        };
    }

    function initSystem() {
        console.log('宠物寄养店喂药与异常交接台系统初始化中...');

        const depCheck = checkDependencies();
        if (!depCheck.allLoaded) {
            console.error('❌ 缺少依赖模块:', depCheck.missing);
            console.error('依赖状态:', depCheck.dependencies);
            
            if (depCheck.missing.includes('DataExport')) {
                console.warn('⚠️ DataExport 模块未加载，部分导出功能可能不可用');
            }
            
            if (depCheck.missing.includes('UI')) {
                Utils.showNotification('界面模块加载失败，请刷新页面重试', 'danger');
                return;
            }
        } else {
            console.log('✅ 所有依赖模块已加载');
        }

        try {
            Storage.init();
            console.log('✅ 存储模块已初始化');
        } catch (e) {
            console.error('❌ 存储模块初始化失败:', e);
            Utils.showNotification('存储模块初始化失败，请检查浏览器设置', 'danger');
            return;
        }

        try {
            if (typeof DataImport !== 'undefined' && DataImport.init) {
                DataImport.init();
                console.log('✅ 数据导入模块已初始化');
            }
        } catch (e) {
            console.error('❌ 数据导入模块初始化失败:', e);
        }

        try {
            if (typeof Validators !== 'undefined' && Validators.runAllChecks) {
                Validators.runAllChecks();
                console.log('✅ 验证检查已完成');
            }
        } catch (e) {
            console.error('❌ 验证检查失败:', e);
        }

        try {
            if (typeof UI !== 'undefined' && UI.init) {
                UI.init();
                console.log('✅ UI 模块已初始化');
                console.log('🎉 系统初始化完成！');
            }
        } catch (e) {
            console.error('❌ UI 模块初始化失败:', e);
            console.error('错误详情:', e.message);
            console.error('错误堆栈:', e.stack);
            
            try {
                if (typeof Utils !== 'undefined' && Utils.showNotification) {
                    Utils.showNotification('界面部分功能初始化失败，部分功能可能不可用', 'warning');
                }
            } catch (e2) {
                console.error('无法显示通知:', e2);
            }
        }
    }

    function delayedInit(attempts) {
        const maxAttempts = attempts || 5;
        let currentAttempt = 0;

        function tryInit() {
            currentAttempt++;
            const depCheck = checkDependencies();
            
            if (depCheck.allLoaded || currentAttempt >= maxAttempts) {
                initSystem();
            } else {
                console.log(`⏳ 等待依赖模块加载... (尝试 ${currentAttempt}/${maxAttempts})`);
                console.log('缺失模块:', depCheck.missing);
                setTimeout(tryInit, 200);
            }
        }

        tryInit();
    }

    document.addEventListener('DOMContentLoaded', function() {
        delayedInit(10);
    });

    window.addEventListener('beforeunload', function(e) {
        try {
            if (typeof Storage !== 'undefined' && Storage.getStatistics) {
                const stats = Storage.getStatistics();
                if (stats.totalWarnings > 0 || stats.openObservations > 0) {
                    console.log('系统中存在未处理的异常提醒，数据已保存到本地存储。');
                }
            }
        } catch (e) {
            console.error('beforeunload 处理失败:', e);
        }
    });

    window.PetFeedingSystem = {
        getVersion: function() {
            return '1.0.0';
        },

        getStatistics: function() {
            if (typeof Storage !== 'undefined' && Storage.getStatistics) {
                return Storage.getStatistics();
            }
            return null;
        },

        exportAll: function() {
            if (typeof Storage !== 'undefined' && Storage.exportAllData) {
                return Storage.exportAllData();
            }
            return null;
        },

        importAll: function(data) {
            if (typeof Storage !== 'undefined' && Storage.importAllData) {
                return Storage.importAllData(data);
            }
            return false;
        },

        clearAll: function() {
            if (confirm('确定要清除所有数据吗？此操作不可撤销！')) {
                if (typeof Storage !== 'undefined' && Storage.clearAllData) {
                    Storage.clearAllData();
                }
                location.reload();
                return true;
            }
            return false;
        },

        refresh: function() {
            try {
                if (typeof Validators !== 'undefined' && Validators.runAllChecks) {
                    Validators.runAllChecks();
                }
                if (typeof UI !== 'undefined' && UI.refreshAll) {
                    UI.refreshAll();
                }
                if (typeof Utils !== 'undefined' && Utils.showNotification) {
                    Utils.showNotification('数据已刷新', 'success');
                }
            } catch (e) {
                console.error('刷新失败:', e);
            }
        },

        checkDependencies: checkDependencies,

        manualInit: initSystem
    };

    console.log('💡 提示: 使用 PetFeedingSystem 对象可以访问系统高级功能');
    console.log('   - PetFeedingSystem.getStatistics() - 获取统计数据');
    console.log('   - PetFeedingSystem.exportAll() - 导出所有数据');
    console.log('   - PetFeedingSystem.clearAll() - 清除所有数据');
    console.log('   - PetFeedingSystem.refresh() - 刷新所有数据');
    console.log('   - PetFeedingSystem.checkDependencies() - 检查依赖模块');

})();
