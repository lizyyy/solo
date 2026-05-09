const TabManager = {
    init: function() {
        this.bindEvents();
    },
    
    bindEvents: function() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
    },
    
    switchTab: function(tabName) {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');
        
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tabName}-tab`);
        });
        
        this.onTabChange(tabName);
    },
    
    onTabChange: function(tabName) {
        if (typeof window.app !== 'undefined' && window.app) {
            window.app.onTabChange(tabName);
        }
    }
};
