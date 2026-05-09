document.addEventListener('DOMContentLoaded', () => {
  const engine = new GameEngine();
  const gameUI = new GameUI(engine);
  
  console.log('仓库机器人拣货游戏已加载');
  console.log('使用方向键或WASD移动，空格键拾取');
  console.log('规则: 成功取货+100, 碰撞-100, 重复取货-50');
});
