/**
 * 主入口文件
 * 初始化应用程序
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('虚拟内存和内存池实验台已加载');
    
    loadSavedExperiments();
});

function switchTab(tabName) {
    const tabs = ['vm', 'pool', 'experiments'];
    
    for (const tab of tabs) {
        const tabButton = document.getElementById(`tab-${tab}`);
        const content = document.getElementById(`content-${tab}`);
        
        if (tab === tabName) {
            tabButton.className = 'bg-white inline-block py-2 px-4 text-blue-500 hover:text-blue-800 font-semibold border-l border-t border-r rounded-t';
            content.classList.remove('hidden');
        } else {
            tabButton.className = 'inline-block py-2 px-4 text-gray-500 hover:text-gray-800';
            content.classList.add('hidden');
        }
    }
}
