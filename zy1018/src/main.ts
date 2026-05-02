import { App } from './App';

async function main(): Promise<void> {
  console.log('🏪 摊位布置预演工具启动中...');
  
  try {
    const app = new App();
    await app.init();
    
    console.log('✅ 摊位布置预演工具已启动！');
    console.log('');
    console.log('📋 快捷键:');
    console.log('  - 鼠标左键: 选择/拖动物件');
    console.log('  - 鼠标右键: 取消选择');
    console.log('  - 滚轮: 缩放视角');
    console.log('  - 鼠标中键拖动: 旋转视角');
    console.log('  - Q/E: 旋转选中物件 (-45°/+45°)');
    console.log('  - Delete/Backspace: 删除选中物件');
    console.log('  - Esc: 取消选择');
    console.log('  - 1/2/3/4: 切换视角 (顶/前/侧/透视)');
    console.log('');
    console.log('💡 提示:');
    console.log('  - 从左侧物件库点击物件即可添加到场景');
    console.log('  - 场景中的物件可以拖动、旋转、调整尺寸');
    console.log('  - 右侧面板会实时显示布置问题检查结果');
    console.log('  - 方案会自动保存到本地存储');
    console.log('  - 可以通过 "示例" 菜单加载预设方案');
    console.log('');
  } catch (error) {
    console.error('❌ 应用启动失败:', error);
  }
}

main();
