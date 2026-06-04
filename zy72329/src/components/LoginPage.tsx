import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, User, Lock, Eye, EyeOff, UserCog, GraduationCap, FileCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { cn } from '../lib/utils';
import { UserRole } from '../../shared/types';

const roleQuickLogin: Array<{ role: UserRole; label: string; icon: typeof UserCog; color: string }> = [
  { role: 'admin', label: '行政老师', icon: UserCog, color: 'blue' },
  { role: 'coach', label: '唐老师', icon: GraduationCap, color: 'green' },
  { role: 'reviewer', label: '教研组', icon: FileCheck, color: 'purple' },
];

const roleColorClasses: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600 hover:bg-blue-200 border-blue-300',
  green: 'bg-green-100 text-green-600 hover:bg-green-200 border-green-300',
  purple: 'bg-purple-100 text-purple-600 hover:bg-purple-200 border-purple-300',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, quickLogin } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(username, password);
      navigate('/');
    } catch {
      setError('用户名或密码错误');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (role: UserRole) => {
    setLoading(true);
    setError('');
    try {
      await quickLogin(role);
      navigate('/');
    } catch {
      setError('快速登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="px-8 pt-8 pb-6 text-center">
            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">稀疏矩阵账单压缩</h1>
            <p className="text-slate-400 text-sm">账单证据整合与审核系统</p>
          </div>

          <div className="px-8 pb-6">
            <div className="mb-6">
              <p className="text-slate-400 text-xs mb-3 text-center uppercase tracking-wider">
                快速登录
              </p>
              <div className="grid grid-cols-3 gap-2">
                {roleQuickLogin.map((item) => (
                  <button
                    key={item.role}
                    onClick={() => handleQuickLogin(item.role)}
                    disabled={loading}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all',
                      roleColorClasses[item.color],
                      loading && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 text-slate-500 text-xs bg-transparent">
                  或使用账号登录
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  用户名
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full pl-10 pr-12 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !username || !password}
                className={cn(
                  'w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  loading && 'cursor-wait'
                )}
              >
                {loading ? '登录中...' : '登 录'}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-500">
              <p>测试账号: admin / coach / reviewer</p>
              <p className="mt-1">密码: admin123 / coach123 / reviewer123</p>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © 2025 稀疏矩阵账单压缩 · 证据可追溯 · 冲突可复核
        </p>
      </div>
    </div>
  );
}
