import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, History, BookOpen, BadgeCheck } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

const Home = () => {
  const navigate = useNavigate();
  const { loadCases, cases, getCaseHistory } = useGameStore();
  const [showTitle, setShowTitle] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);

  useEffect(() => {
    loadCases();
    setTimeout(() => setShowTitle(true), 300);
    setTimeout(() => setShowSubtitle(true), 1500);
  }, [loadCases]);

  const completedCount = getCaseHistory().length;
  const totalCount = cases.length;

  const menuItems = [
    {
      icon: Search,
      title: '开始调查',
      description: '进入案件大厅，选择待核查的赔案',
      action: () => navigate('/cases'),
      color: 'from-amber-500 to-orange-500',
      delay: 2000
    },
    {
      icon: BookOpen,
      title: '调查规则',
      description: '了解游戏规则和理赔核查要点',
      action: () => navigate('/rules'),
      color: 'from-blue-500 to-cyan-500',
      delay: 2300
    },
    {
      icon: History,
      title: '调查记录',
      description: `已完成 ${completedCount}/${totalCount} 个案件`,
      action: () => navigate('/history'),
      color: 'from-emerald-500 to-teal-500',
      delay: 2600
    }
  ];

  return (
    <div className="min-h-screen bg-detective-bg flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-64 h-64 bg-detective-accent rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-detective-danger rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-detective-success rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <BadgeCheck className="w-24 h-24 text-detective-accent animate-glow" />
            <div className="absolute -inset-4 bg-detective-accent/20 rounded-full blur-xl animate-pulse"></div>
          </div>
        </div>

        <h1 className="font-serif text-6xl md:text-7xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-detective-accent via-amber-300 to-detective-accent">
          {showTitle ? (
            <span className="inline-block animate-slide-in-left">保险理赔侦探局</span>
          ) : null}
        </h1>

        {showSubtitle && (
          <p className="text-xl md:text-2xl text-slate-300 mb-12 font-light animate-fade-in">
            运用你的推理能力，从蛛丝马迹中发现真相
          </p>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {menuItems.map((item, index) => (
            <button
              key={item.title}
              onClick={item.action}
              className="group file-folder card-hover text-left animate-fade-in"
              style={{ animationDelay: `${item.delay}ms` }}
            >
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-lg bg-gradient-to-br ${item.color} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <item.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-slate-100 group-hover:text-detective-accent transition-colors">
                {item.title}
              </h3>
              <p className="text-slate-400 text-sm">
                {item.description}
              </p>
              <div className="mt-4 flex items-center text-detective-accent text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                进入
                <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        <div className="paper-texture max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '3000ms' }}>
          <div className="flex items-start gap-3">
            <FileText className="w-6 h-6 text-detective-accent flex-shrink-0 mt-1" />
            <div className="text-left">
              <h4 className="font-bold mb-2 text-detective-bg">培训目标</h4>
              <ul className="text-sm space-y-1 text-detective-bg/80">
                <li>• 识别免责条款，避免错赔</li>
                <li>• 区分新旧损伤，防范欺诈</li>
                <li>• 发现材料矛盾，核实真相</li>
                <li>• 规范留痕操作，降低风险</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <footer className="absolute bottom-4 text-slate-500 text-sm">
        © 2024 保险理赔侦探局 · 培训专用
      </footer>
    </div>
  );
};

export default Home;
