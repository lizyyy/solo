import React, { useState } from 'react';
import { Music, User, Users, ArrowRight, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useUserStore } from '@/store/useUserStore';
import { SAMPLE_CLASS } from '@/data/sample';
import { importSampleData } from '@/data/sample';
import { cn } from '@/lib/utils';

const Login: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  const [studentName, setStudentName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { loginAsStudent, loginAsTeacher } = useUserStore();

  const handleStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!studentName.trim()) {
      setError('请输入您的姓名');
      return;
    }
    if (!classCode.trim()) {
      setError('请输入班级码');
      return;
    }

    const success = loginAsStudent(studentName.trim(), classCode.trim());
    if (success) {
      importSampleData();
      navigate('/lobby');
    } else {
      setError('班级码不正确，请检查后重试');
    }
  };

  const handleTeacherLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!teacherEmail.trim()) {
      setError('请输入邮箱');
      return;
    }
    if (!teacherPassword.trim()) {
      setError('请输入密码');
      return;
    }

    const success = loginAsTeacher(teacherEmail.trim(), teacherPassword.trim());
    if (success) {
      importSampleData();
      navigate('/console');
    } else {
      setError('登录失败，请检查邮箱和密码');
    }
  };

  const handleQuickDemo = () => {
    loginAsTeacher('demo@jazz.com', 'demo');
    importSampleData();
    navigate('/sample-guide');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 staff-pattern">
      <div className="absolute inset-0 bg-gradient-to-br from-jazz-bg via-jazz-bg/95 to-jazz-bgDark" />
      
      <div className="relative z-10 w-full max-w-5xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-jazz-gold to-jazz-goldDark flex items-center justify-center shadow-xl shadow-jazz-gold/30">
              <Music className="w-8 h-8 text-jazz-bg" />
            </div>
            <h1 className="font-display text-5xl font-bold text-jazz-gold">
              爵士即兴接龙局
            </h1>
          </div>
          <p className="text-jazz-textMuted text-lg max-w-xl mx-auto">
            在游戏化环境中练习爵士即兴创作，同时掌握和弦进行与节拍稳定性
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          <Card glass className="p-8">
            <div className="flex gap-2 mb-6 bg-jazz-bg/50 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('student')}
                className={cn(
                  'flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
                  activeTab === 'student'
                    ? 'bg-jazz-gold text-jazz-bg shadow-lg'
                    : 'text-jazz-textMuted hover:text-jazz-text'
                )}
              >
                <User className="w-4 h-4" />
                学生登录
              </button>
              <button
                onClick={() => setActiveTab('teacher')}
                className={cn(
                  'flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
                  activeTab === 'teacher'
                    ? 'bg-jazz-gold text-jazz-bg shadow-lg'
                    : 'text-jazz-textMuted hover:text-jazz-text'
                )}
              >
                <Users className="w-4 h-4" />
                教师登录
              </button>
            </div>

            {activeTab === 'student' ? (
              <form onSubmit={handleStudentLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-jazz-text mb-2">
                    您的姓名
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="请输入您的姓名"
                    className="w-full px-4 py-3 rounded-xl bg-jazz-bg border border-jazz-border text-jazz-text placeholder-jazz-textMuted/50 focus:outline-none focus:ring-2 focus:ring-jazz-gold/50 focus:border-jazz-gold transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-jazz-text mb-2">
                    班级码
                  </label>
                  <input
                    type="text"
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                    placeholder={`例如: ${SAMPLE_CLASS.joinCode}`}
                    className="w-full px-4 py-3 rounded-xl bg-jazz-bg border border-jazz-border text-jazz-text placeholder-jazz-textMuted/50 focus:outline-none focus:ring-2 focus:ring-jazz-gold/50 focus:border-jazz-gold transition-all font-mono tracking-widest uppercase"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-jazz-burgundy/20 border border-jazz-burgundy/50 text-jazz-burgundyLight text-sm">
                    {error}
                  </div>
                )}

                <Button type="submit" variant="brass" className="w-full gap-2">
                  进入游戏 <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleTeacherLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-jazz-text mb-2">
                    邮箱
                  </label>
                  <input
                    type="email"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    placeholder="teacher@jazzschool.edu"
                    className="w-full px-4 py-3 rounded-xl bg-jazz-bg border border-jazz-border text-jazz-text placeholder-jazz-textMuted/50 focus:outline-none focus:ring-2 focus:ring-jazz-gold/50 focus:border-jazz-gold transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-jazz-text mb-2">
                    密码
                  </label>
                  <input
                    type="password"
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl bg-jazz-bg border border-jazz-border text-jazz-text placeholder-jazz-textMuted/50 focus:outline-none focus:ring-2 focus:ring-jazz-gold/50 focus:border-jazz-gold transition-all"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-jazz-burgundy/20 border border-jazz-burgundy/50 text-jazz-burgundyLight text-sm">
                    {error}
                  </div>
                )}

                <Button type="submit" variant="brass" className="w-full gap-2">
                  登录控制台 <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t border-jazz-border/50">
              <p className="text-xs text-jazz-textMuted text-center mb-3">
                测试用：班级码 {SAMPLE_CLASS.joinCode}，教师任意邮箱密码
              </p>
              <Button
                variant="ghost"
                onClick={handleQuickDemo}
                className="w-full gap-2 text-jazz-gold hover:text-jazz-goldLight"
              >
                <BookOpen className="w-4 h-4" />
                快速体验：新人交接样例流程
              </Button>
            </div>
          </Card>

          <div className="space-y-4">
            <Card glass className="p-6">
              <h3 className="font-display text-xl text-jazz-gold mb-4">核心特色</h3>
              <div className="space-y-3">
                {[
                  { icon: '🎵', title: '和弦判定', desc: '智能分析乐句与和弦的匹配度，区分和弦内音、经过音和外音' },
                  { icon: '🥁', title: '节拍评分', desc: '精确评估节拍稳定性，检测超拍、抢拍等节奏问题' },
                  { icon: '🔍', title: '错误分类', desc: '区分数据问题、规则问题、材料问题，提供针对性建议' },
                  { icon: '📊', title: '完整报告', desc: '生成包含关键选择、扣分原因和改进建议的详细报告' },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <h4 className="font-medium text-jazz-text">{item.title}</h4>
                      <p className="text-sm text-jazz-textMuted">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card glass className="p-6">
              <h3 className="font-display text-lg text-jazz-gold mb-3">错误类型说明</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-jazz-orange">⚠️</span>
                  <span className="text-jazz-text">数据问题：和弦外音、音高识别偏差</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-jazz-burgundy">🚫</span>
                  <span className="text-jazz-text">规则问题：小节超拍、节拍错位</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-jazz-purple">📦</span>
                  <span className="text-jazz-text">材料问题：重复乐句、材料不足</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <p className="text-center text-jazz-textMuted/50 text-sm mt-8">
          © 2024 爵士即兴接龙局 - 音乐教学平台
        </p>
      </div>
    </div>
  );
};

export default Login;
