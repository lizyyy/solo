const App = (function() {
    'use strict';
    
    const appState = {
        dataLoaded: false,
        shelters: [],
        evacuees: [],
        supplyRules: {},
        issues: [],
        shelterStates: {},
        timelineEvents: [],
        statistics: {},
        filteredData: {
            evacuees: [],
            issues: [],
            timelineEvents: []
        },
        filesLoaded: {
            shelters: false,
            evacuees: false,
            supplyRules: false
        }
    };
    
    function init() {
        console.log('社区应急避难点复盘工具启动...');
        UI.initEventListeners(appState);
    }
    
    document.addEventListener('DOMContentLoaded', init);
    
    return {
        appState,
        init
    };
})();
