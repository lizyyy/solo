import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="home-page">
      <h2>🎭 舞台监督换景排练</h2>
      <p className="subtitle">通过游戏化方式训练剧场换景调度能力</p>
      
      <div className="home-features">
        <div className="feature-card">
          <div className="feature-icon">🎪</div>
          <h3>沉浸式舞台体验</h3>
          <p>在虚拟舞台上拖动幕布、道具和灯光，模拟真实换景场景</p>
        </div>
        
        <div className="feature-card">
          <div className="feature-icon">⏱️</div>
          <h3>时间轴挑战</h3>
          <p>按照台词时间轴完成换景动作，考验你的时间管理能力</p>
        </div>
        
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <h3>智能评分系统</h3>
          <p>自动检测超时、错位、危险占道和遗漏动作，实时扣分</p>
        </div>
        
        <div className="feature-card">
          <div className="feature-icon">📝</div>
          <h3>复盘与导出</h3>
          <p>保存每次排练记录，支持导出 Markdown 复盘单和 JSON 审计包</p>
        </div>
      </div>
      
      <div className="home-actions">
        <Link to="/levels">
          <button className="btn-primary btn-lg">
            📁 管理关卡
          </button>
        </Link>
        <Link to="/history">
          <button className="btn-secondary btn-lg">
            📜 查看历史
          </button>
        </Link>
      </div>
    </div>
  );
}

export default Home;
