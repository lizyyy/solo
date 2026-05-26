import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Trophy, BookOpen, FileCheck, Users, Shield, Clock } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';

export default function Home() {
  const navigate = useNavigate();
  const { loadProgress } = useGameStore();

  useEffect(() => {
    loadProgress();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a3a2e] via-[#2c3e50] to-[#1a3a2e] flex items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-[#d4a017] to-[#f1c40f] shadow-2xl shadow-[#d4a017]/30 mb-6">
            <FileCheck size={48} className="text-[#1a3a2e]" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            资料归档
            <span className="text-[#d4a017]">审计游戏</span>
          </h1>
          <p className="text-white/70 text-lg max-w-md mx-auto leading-relaxed">
            模拟真实档案管理场景，掌握保密级别判定、保管期限计算、借阅登记合规等核心技能
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Shield size={24} className="text-[#d4a017] mx-auto mb-2" />
            <div className="text-white font-bold text-sm">保密判定</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Clock size={24} className="text-[#3498db] mx-auto mb-2" />
            <div className="text-white font-bold text-sm">期限计算</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Users size={24} className="text-[#27ae60] mx-auto mb-2" />
            <div className="text-white font-bold text-sm">借阅管理</div>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => navigate('/levels')}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#d4a017] to-[#f1c40f]
              text-[#1a3a2e] font-bold text-xl shadow-xl shadow-[#d4a017]/30
              hover:shadow-2xl hover:shadow-[#d4a017]/40 hover:-translate-y-0.5
              transition-all duration-200 flex items-center justify-center gap-3"
          >
            <Play size={24} />
            开始游戏
          </button>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/levels')}
              className="py-3 rounded-xl bg-white/5 text-white/80
                hover:bg-white/10 hover:text-white transition-all duration-200
                flex items-center justify-center gap-2 border border-white/10"
            >
              <Trophy size={18} />
              关卡选择
            </button>
            <button
              onClick={() => navigate('/report')}
              className="py-3 rounded-xl bg-white/5 text-white/80
                hover:bg-white/10 hover:text-white transition-all duration-200
                flex items-center justify-center gap-2 border border-white/10"
            >
              <BookOpen size={18} />
              查看报告
            </button>
          </div>
        </div>

        <div className="mt-10 p-5 bg-white/5 rounded-2xl border border-white/10 text-left">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Shield size={18} className="text-[#d4a017]" />
            游戏规则
          </h3>
          <ul className="text-white/60 text-sm space-y-2">
            <li>• 根据文件内容判断正确的 <span className="text-white">保密级别</span>（公开/秘密/机密/绝密）</li>
            <li>• 根据文件类型选择正确的 <span className="text-white">保管期限</span>（永久/30年/10年/5年/3年）</li>
            <li>• 将文件归档到对应的 <span className="text-white">档案盒</span> 中</li>
            <li>• 处理借阅请求时确保 <span className="text-white">登记合规</span>，需要审批的必须先审批</li>
            <li>• 得分 = 正确数 × 10 - 错误数 × 5，正确率越高评级越高</li>
          </ul>
        </div>
      </div>
    </div>
  );
}