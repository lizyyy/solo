const App = {
    init() {
        console.log('太阳人际关系治愈小程序启动...');
        
        InitData.initialize();
        
        Navigation.init();
        
        HomePage.render();
        
        this.checkLowBattery();
    },

    checkLowBattery() {
        const battery = Storage.getBattery();
        if (battery <= 20) {
            setTimeout(() => {
                Toast.warning('社交电量较低！建议减少不必要的社交，给自己一些独处时间恢复能量。');
            }, 1000);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
