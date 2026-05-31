import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  FileSpreadsheet,
  Eye,
  Info,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { formatDate } from '@/utils';

export default function ExportReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);

  const task = useAppStore((state) => state.getTaskById(id || ''));
  const artworks = useAppStore((state) => state.getArtworksByTaskId(id || ''));
  const wallLayouts = useAppStore((state) => state.getWallLayoutsByTaskId(id || ''));
  const checkConsistency = useAppStore((state) => state.checkConsistency);
  const updateTaskStatus = useAppStore((state) => state.updateTaskStatus);

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-ivory-300">任务不存在</p>
        <button
          onClick={() => navigate('/')}
          className="btn-primary mt-4"
        >
          返回列表
        </button>
      </div>
    );
  }

  const latestLayout = wallLayouts[0];
  const consistencyResult = checkConsistency(task.id);

  const handleExport = (format: 'pdf' | 'excel') => {
    setShowSuccess(true);
    updateTaskStatus(task.id, 'completed', `导出${format.toUpperCase()}布展清单，任务完成`);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const getIssueIcon = (severity: 'warning' | 'error') => {
    if (severity === 'error') {
      return <XCircle className="w-4 h-4 text-red-400" />;
    }
    return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {showSuccess && (
        <div className="fixed top-6 right-6 z-50 animate-fade-in-up">
          <div className="flex items-center gap-3 px-5 py-3 bg-emerald-500/90 text-white rounded-md shadow-lg">
            <CheckCircle className="w-5 h-5" />
            <span>布展清单导出成功！</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/tasks/${task.id}`)}
          className="p-2 hover:bg-charcoal-200 rounded-md transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-ivory-300" />
        </button>
        <div className="flex-1">
          <h1 className="font-serif text-2xl text-ivory-100 mb-1">
            导出复核 - {task.title}
          </h1>
          <p className="text-sm text-ivory-400">
            来源: {task.source} | 最后更新: {formatDate(task.updatedAt)}
          </p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-start gap-4 mb-6">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              consistencyResult.isConsistent
                ? 'bg-emerald-500/20'
                : 'bg-amber-500/20'
            }`}
          >
            {consistencyResult.isConsistent ? (
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-lg text-ivory-100 mb-1">
              一致性检查结果
            </h3>
            <p className="text-sm text-ivory-400">
              {consistencyResult.isConsistent
                ? '布展清单与明细数据一致，可以安全导出'
                : `发现 ${consistencyResult.issues.length} 个问题，建议处理后再导出`}
            </p>
          </div>
        </div>

        {!consistencyResult.isConsistent && (
          <div className="space-y-3 mb-6">
            {consistencyResult.issues.map((issue, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-charcoal-400/50 rounded-md"
              >
                {getIssueIcon(issue.severity)}
                <div className="flex-1">
                  <p className="text-sm text-ivory-200">{issue.message}</p>
                  <p className="text-xs text-ivory-500 mt-1">
                    作品: {issue.artworkTitle} | 类型:{' '}
                    {issue.type === 'missing_in_layout'
                      ? '展墙图中缺失'
                      : issue.type === 'missing_in_list'
                      ? '清单中缺失'
                      : '位置不匹配'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-forest-300/30 border border-forest-200/30 rounded-md p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-gold-300 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-ivory-300">
              <p className="font-medium text-ivory-200 mb-2">
                画廊助理操作指引：
              </p>
              <ul className="space-y-1.5 list-disc list-inside">
                <li>
                  策展备注样例：在任务详情页的"策展备注"标签页中查看和编辑
                </li>
                <li>
                  作品调换留痕：在"展墙图历史"标签页中查看所有版本的变更记录
                </li>
                <li>
                  导出前复核：确认上方一致性检查无错误，核对作品清单与展墙布局
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-lg text-ivory-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gold-300" />
              布展清单预览
            </h3>
            <span className="text-xs text-ivory-500">
              {artworks.length} 件作品
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal-200/50">
                  <th className="text-left py-2 px-3 font-medium text-ivory-400">
                    序号
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-ivory-400">
                    作品
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-ivory-400">
                    艺术家
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-ivory-400">
                    展墙
                  </th>
                </tr>
              </thead>
              <tbody>
                {artworks.map((artwork, index) => (
                  <tr
                    key={artwork.id}
                    className="border-b border-charcoal-200/30"
                  >
                    <td className="py-2 px-3 text-ivory-500">
                      {index + 1}
                    </td>
                    <td className="py-2 px-3 text-ivory-200">
                      {artwork.title}
                    </td>
                    <td className="py-2 px-3 text-ivory-300">
                      {artwork.artist}
                    </td>
                    <td className="py-2 px-3 text-ivory-400">
                      {artwork.wallId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-lg text-ivory-100 flex items-center gap-2">
              <Eye className="w-5 h-5 text-gold-300" />
              展墙布局明细
            </h3>
            <span className="text-xs text-ivory-500">
              v{latestLayout?.version || 0}
            </span>
          </div>

          {latestLayout ? (
            <div className="space-y-3">
              {latestLayout.layoutData.walls.map((wall) => (
                <div
                  key={wall.id}
                  className="p-3 bg-charcoal-400/50 rounded-md"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-ivory-200">
                      {wall.name}
                    </span>
                    <span className="text-xs text-ivory-500">
                      {wall.artworks.length} 件
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {wall.artworks.map((wa) => {
                      const artwork = artworks.find((a) => a.id === wa.artworkId);
                      return (
                        <span
                          key={wa.artworkId}
                          className="text-xs px-2 py-1 bg-charcoal-300 text-ivory-300 rounded"
                        >
                          {artwork?.title || wa.artworkId}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-ivory-400">
              <p>暂无展墙布局</p>
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-serif text-lg text-ivory-100 mb-4">导出布展清单</h3>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-3 px-6 py-4 bg-charcoal-400/80 border border-charcoal-200/50 rounded-md hover:border-gold-300/50 hover:bg-charcoal-300/80 transition-all group"
          >
            <div className="w-10 h-10 bg-red-500/20 rounded-md flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
              <FileText className="w-5 h-5 text-red-300" />
            </div>
            <div className="text-left">
              <p className="font-medium text-ivory-100">导出 PDF</p>
              <p className="text-xs text-ivory-500">适合打印和分享</p>
            </div>
            <Download className="w-5 h-5 text-ivory-400 ml-4" />
          </button>

          <button
            onClick={() => handleExport('excel')}
            className="flex items-center gap-3 px-6 py-4 bg-charcoal-400/80 border border-charcoal-200/50 rounded-md hover:border-gold-300/50 hover:bg-charcoal-300/80 transition-all group"
          >
            <div className="w-10 h-10 bg-emerald-500/20 rounded-md flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="text-left">
              <p className="font-medium text-ivory-100">导出 Excel</p>
              <p className="text-xs text-ivory-500">适合编辑和统计</p>
            </div>
            <Download className="w-5 h-5 text-ivory-400 ml-4" />
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Link to={`/tasks/${task.id}`} className="btn-secondary">
          返回详情
        </Link>
        <button
          onClick={() => handleExport('pdf')}
          disabled={!consistencyResult.isConsistent}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          确认导出
        </button>
      </div>
    </div>
  );
}
