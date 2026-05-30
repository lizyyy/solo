import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Play,
  BookOpen,
  Users,
  Lock,
  ChevronRight,
  AlertTriangle,
  Target,
  Clock,
  MapPin
} from 'lucide-react';
import { scenarios } from '../data/scenarios';
import { useWorkflowStore, validateInstructorPassword } from '../store/workflowStore';
import { getDifficultyLabel, getDifficultyColor } from '../utils/formatters';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { loginAsInstructor, currentUser, logout } = useWorkflowStore();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleStartTraining = (scenarioId: string) => {
    navigate(`/training/${scenarioId}`);
  };

  const handleLogin = () => {
    if (validateInstructorPassword(password)) {
      loginAsInstructor();
      setShowLoginModal(false);
      setPassword('');
      setLoginError('');
    } else {
      setLoginError('密码错误，请重试');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800/50 border-b border-slate-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl">
                <Compass size={32} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">海上救援三角定位</h1>
                <p className="text-sm text-slate-400">航海专业技能训练系统</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {currentUser ? (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm text-white font-medium">{currentUser.name}</div>
                    <div className="text-xs text-slate-400">
                      {currentUser.role === 'instructor' ? '教员' : '学员'}
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    退出
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 hover:text-white transition-colors"
                >
                  <Lock size={16} />
                  教员登录
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/30 to-transparent"></div>
        <div className="container mx-auto px-6 relative">
          <div className="max-w-3xl">
            <h2 className="text-5xl font-bold text-white mb-6 leading-tight">
              掌握<span className="text-blue-400">三角定位</span>
              <br />
              成为精准的海上救援者
            </h2>
            <p className="text-xl text-slate-400 mb-8 leading-relaxed">
              通过三座灯塔的方位角，计算遇险船的精确位置。
              在取舍中理解航海定位的艺术，在复盘中提升专业技能。
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 rounded-lg border border-slate-700">
                <Target size={18} className="text-blue-400" />
                <span className="text-sm text-slate-300">{scenarios.length} 个训练场景</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 rounded-lg border border-slate-700">
                <BookOpen size={18} className="text-green-400" />
                <span className="text-sm text-slate-300">完整操作溯源</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 rounded-lg border border-slate-700">
                <Users size={18} className="text-purple-400" />
                <span className="text-sm text-slate-300">教员复核机制</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold text-white">选择训练场景</h3>
            {currentUser?.role === 'instructor' && (
              <button
                onClick={() => navigate('/records')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
              >
                <BookOpen size={18} />
                查看待复核记录
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {scenarios.map((scenario, index) => (
              <div
                key={scenario.id}
                className="group bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden hover:border-slate-600 hover:shadow-2xl hover:shadow-blue-500/10 transition-all"
              >
                <div className="relative h-48 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                  <div className="absolute top-4 right-4 z-10">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getDifficultyColor(scenario.difficulty)}`}>
                      {getDifficultyLabel(scenario.difficulty)}
                    </span>
                  </div>
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                    <span className="text-5xl">
                      {index === 0 ? '🚢' : index === 1 ? '⛵' : '🛥️'}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <h4 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                    {scenario.name}
                  </h4>
                  <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                    {scenario.description}
                  </p>

                  <div className="flex items-center gap-4 mb-6 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      {scenario.lighthouseIds.length} 座灯塔
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      约 15 分钟
                    </span>
                  </div>

                  <button
                    onClick={() => handleStartTraining(scenario.id)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 transition-all group-hover:translate-x-1"
                  >
                    <Play size={18} />
                    开始训练
                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-slate-800/30">
        <div className="container mx-auto px-6">
          <h3 className="text-2xl font-bold text-white mb-8 text-center">
            为什么选择三角定位训练系统？
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                <Target size={32} className="text-blue-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">真实取舍体验</h4>
              <p className="text-sm text-slate-400">
                不只是点按钮看分数。每条路线都有权衡，每个标注都有后果。
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-500/20 flex items-center justify-center">
                <BookOpen size={32} className="text-green-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">完整数据溯源</h4>
              <p className="text-sm text-slate-400">
                每座灯塔、每个角度、每次修改都有记录。单位错误永久留痕，不被掩盖。
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                <Users size={32} className="text-purple-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">三级工作流机制</h4>
              <p className="text-sm text-slate-400">
                待确认、已处理、需退回。复盘时能看懂当时为什么这么处理。
              </p>
            </div>
          </div>
        </div>
      </section>

      {showLoginModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                <Lock size={32} className="text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">教员登录</h2>
              <p className="text-sm text-slate-400 mt-1">登录后可复核学员训练记录</p>
            </div>

            {loginError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                {loginError}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">教员密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="请输入教员密码"
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-2">
                演示密码：instructor123
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowLoginModal(false); setLoginError(''); setPassword(''); }}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleLogin}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
              >
                登录
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
