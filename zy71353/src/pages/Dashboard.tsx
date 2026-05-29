import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Palette,
  Users,
  FileText,
  TrendingUp,
  Upload,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { useWorkStore } from '@/store/useWorkStore';
import { useClassStore } from '@/store/useClassStore';
import { ColorSwatch } from '@/components/color/ColorSwatch';
import { db } from '@/db';

export default function Dashboard() {
  const { recentWorks, loadRecentWorks, isLoading } = useWorkStore();
  const { classes, loadClasses } = useClassStore();

  useEffect(() => {
    loadRecentWorks(10);
    loadClasses();
  }, [loadRecentWorks, loadClasses]);

  const getStats = async () => {
    const works = await db.works.toArray();
    const versions = await db.workVersions.toArray();
    const issues = await db.colorIssues.toArray();
    const comments = await db.teacherComments.toArray();

    const totalWorks = works.length;
    const avgScore = comments.length > 0
      ? Math.round(comments.reduce((s, c) => s + c.overallScore, 0) / comments.length)
      : 0;
    const worksWithIssues = new Set(issues.map(i => i.versionId)).size;
    const issueRate = versions.length > 0
      ? Math.round((worksWithIssues / versions.length) * 100)
      : 0;
    const completeWorks = versions.filter(v => !v.dataGaps.incomplete).length;
    const completionRate = versions.length > 0
      ? Math.round((completeWorks / versions.length) * 100)
      : 0;

    return { totalWorks, avgScore, issueRate, completionRate, totalClasses: classes.length };
  };

  const [stats, setStats] = useState({ totalWorks: 0, avgScore: 0, issueRate: 0, completionRate: 0, totalClasses: 0 });

  useEffect(() => {
    getStats().then(setStats);
  }, [recentWorks, classes]);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">仪表盘</h1>
        <p className="text-slate-600">色彩教学数据概览</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="作品总数"
          value={stats.totalWorks}
          subtitle="累计导入作品"
          icon={<Palette className="w-6 h-6 text-indigo-600" />}
          color="default"
        />
        <StatCard
          title="平均评分"
          value={stats.avgScore}
          subtitle="综合质量评分"
          icon={<TrendingUp className="w-6 h-6 text-emerald-600" />}
          color="success"
        />
        <StatCard
          title="问题率"
          value={`${stats.issueRate}%`}
          subtitle="存在色彩问题的作品比例"
          icon={<AlertTriangle className="w-6 h-6 text-amber-600" />}
          color={stats.issueRate > 50 ? 'warning' : 'default'}
        />
        <StatCard
          title="班级数"
          value={stats.totalClasses}
          subtitle="管理中的班级"
          icon={<Users className="w-6 h-6 text-indigo-600" />}
          color="default"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">最近作品</h2>
              <Link
                to="/import"
                className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                导入新作品 <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-slate-500">加载中...</div>
            ) : recentWorks.length === 0 ? (
              <div className="text-center py-8">
                <Palette className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 mb-4">还没有作品数据</p>
                <Link
                  to="/samples"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  导入第一个作品
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentWorks.map(item => (
                  <Link
                    key={item.version.id}
                    to={`/analysis/${item.work.id}`}
                    className="flex items-center gap-4 p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-all"
                  >
                    <img
                      src={item.version.imageDataUrl}
                      alt={item.work.title}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 truncate">
                        {item.work.title}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {item.student.name} · {new Date(item.version.importedAt).toLocaleDateString('zh-CN')}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm font-medium ${
                          item.score >= 80 ? 'text-emerald-600' :
                          item.score >= 60 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {item.score > 0 ? `${item.score}分` : '未评分'}
                        </span>
                        {item.version.dataGaps.incomplete && (
                          <span className="text-xs text-amber-600">⚠ 数据不完整</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">快捷操作</h2>
            <div className="space-y-3">
              <Link
                to="/import"
                className="flex items-center gap-3 p-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <div className="p-2 bg-indigo-600 text-white rounded-lg">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">导入作品</p>
                  <p className="text-xs text-slate-500">上传学生作品图片</p>
                </div>
              </Link>

              <Link
                to="/class"
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="p-2 bg-slate-600 text-white rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">班级概览</p>
                  <p className="text-xs text-slate-500">查看班级统计数据</p>
                </div>
              </Link>

              <Link
                to="/export"
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="p-2 bg-slate-600 text-white rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">报告导出</p>
                  <p className="text-xs text-slate-500">导出Excel/CSV报告</p>
                </div>
              </Link>

              <Link
                to="/samples"
                className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors"
              >
                <div className="p-2 bg-amber-600 text-white rounded-lg">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">样例中心</p>
                  <p className="text-xs text-slate-500">查看样例和失败演示</p>
                </div>
              </Link>
            </div>
          </div>

          {recentWorks.length > 0 && recentWorks[0].version && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">最新作品配色</h2>
              <p className="text-sm text-slate-500 mb-2">{recentWorks[0].work.title}</p>
              <div className="flex gap-2 flex-wrap">
                {recentWorks[0].version && (
                  <div className="w-full flex gap-2 flex-wrap">
                    <p className="text-sm text-slate-500 mb-2 w-full">{recentWorks[0].work.title}</p>
                    <div className="flex gap-2 flex-wrap">
                      {Array(6).fill(0).map((_, i) => (
                        <ColorSwatch
                          key={i}
                          color={{
                            id: `demo-${i}`,
                            versionId: '',
                            hex: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'][i],
                            rgb_r: 0, rgb_g: 0, rgb_b: 0,
                            hsl_h: 0, hsl_s: 0, hsl_l: 0,
                            lab_l: 0, lab_a: 0, lab_b: 0,
                            percentage: 16.7,
                            isBackground: false,
                            isExtreme: false,
                            pixelCount: 0
                          }}
                          size="sm"
                          showPercentage={false}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
