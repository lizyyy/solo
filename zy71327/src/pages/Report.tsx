import { useState } from 'react';
import { FileText, Download, Copy, Check, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useStore } from '@/store/useStore';
import { generateMarkdownReport, generateHTMLReport, downloadFile, copyToClipboard } from '@/services/exportService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { STATUS_LABELS, LICENSE_TYPE_LABELS } from '@/types';

export default function Report() {
  const { samplePacks, credentials, tracks, platformLinks, risks } = useStore();
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const exportData = {
    samplePacks,
    credentials,
    tracks,
    platformLinks,
    risks,
  };

  const handleExportHTML = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const html = generateHTMLReport(exportData);
      const filename = `采样包授权报告_${format(new Date(), 'yyyyMMdd_HHmm')}.html`;
      downloadFile(html, filename, 'text/html');
      setIsGenerating(false);
    }, 500);
  };

  const handleExportMarkdown = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const md = generateMarkdownReport(exportData);
      const filename = `采样包授权报告_${format(new Date(), 'yyyyMMdd_HHmm')}.md`;
      downloadFile(md, filename, 'text/markdown');
      setIsGenerating(false);
    }, 500);
  };

  const handleCopyMarkdown = async () => {
    const md = generateMarkdownReport(exportData);
    await copyToClipboard(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = [
    { label: '采样包总数', value: samplePacks.length },
    { label: '曲目总数', value: tracks.length },
    { label: '授权有效', value: samplePacks.filter((s) => s.status === 'active').length },
    { label: '即将到期', value: samplePacks.filter((s) => s.status === 'expiring').length },
    { label: '已过期', value: samplePacks.filter((s) => s.status === 'expired').length },
    { label: '资料不全', value: samplePacks.filter((s) => s.status === 'incomplete').length },
    { label: '风险项', value: risks.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">授权报告</h1>
          <p className="text-gray-500 mt-1">
            生成完整的授权台账报告，支持导出和转发
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleCopyMarkdown} className="gap-2">
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#4A7C59]" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                复制 Markdown
              </>
            )}
          </Button>
          <Button variant="secondary" onClick={handleExportHTML} className="gap-2" disabled={isGenerating}>
            {isGenerating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            导出 HTML
          </Button>
          <Button onClick={handleExportMarkdown} className="gap-2" disabled={isGenerating}>
            {isGenerating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            导出 Markdown
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl p-4 border border-gray-100 text-center animate-in fade-in duration-500"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <p className="text-2xl font-bold text-[#1A1A2E]">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {risks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="error">风险提醒</Badge>
              <span className="text-sm font-normal text-gray-500">
                共 {risks.length} 项待处理
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {risks.map((risk) => {
              const pack = samplePacks.find((p) => p.id === risk.relatedEntityId);
              return (
                <div
                  key={risk.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-50"
                >
                  <span
                    className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                      risk.severity === 'error'
                        ? 'bg-[#B85450]'
                        : risk.severity === 'warning'
                        ? 'bg-[#D4883A]'
                        : 'bg-[#6B8E9F]'
                    }`}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-[#1A1A2E]">{risk.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{risk.message}</p>
                    {pack && (
                      <p className="text-xs text-gray-400 mt-1">
                        相关采样包：{pack.name}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>采样包状态一览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">采样包</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">供应商</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">授权类型</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">状态</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">关联曲目</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">凭证数</th>
                </tr>
              </thead>
              <tbody>
                {samplePacks.map((pack) => {
                  const packTracks = tracks.filter((t) => t.samplePackIds.includes(pack.id));
                  const packCreds = credentials.filter((c) => c.samplePackId === pack.id);
                  return (
                    <tr key={pack.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-[#1A1A2E]">{pack.name}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{pack.vendor}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {LICENSE_TYPE_LABELS[pack.licenseType]}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={pack.status} />
                      </td>
                      <td className="py-3 px-4 text-gray-600">{packTracks.length} 首</td>
                      <td className="py-3 px-4 text-gray-600">{packCreds.length} 份</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>曲目授权状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">曲目名称</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">艺术家</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">关联采样包</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">平台链接</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">授权状态</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((track) => {
                  const trackPacks = samplePacks.filter((p) => track.samplePackIds.includes(p.id));
                  const trackLinks = platformLinks.filter((l) => l.trackId === track.id);
                  const hasExpiredPack = trackPacks.some((p) => p.status === 'expired');
                  const hasExpiringPack = trackPacks.some((p) => p.status === 'expiring');
                  const hasIncompletePack = trackPacks.some((p) => p.status === 'incomplete');
                  const trackStatus = hasExpiredPack
                    ? 'expired'
                    : hasIncompletePack
                    ? 'incomplete'
                    : hasExpiringPack
                    ? 'expiring'
                    : 'active';
                  return (
                    <tr key={track.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-[#1A1A2E]">{track.title}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{track.artist}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {trackPacks.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {trackPacks.map((pack) => (
                              <span
                                key={pack.id}
                                className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs"
                              >
                                {pack.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">未关联</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{trackLinks.length} 个</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={trackStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>报告说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 space-y-2">
            <p>• 报告生成时间：{format(new Date(), 'yyyy年MM月dd日 HH:mm:ss', { locale: zhCN })}</p>
            <p>• 本报告包含所有采样包授权信息、曲目关联关系和风险提醒</p>
            <p>• 建议每月导出并存档一份授权报告，以备审计需要</p>
            <p>• 如发现授权状态异常，请及时更新凭证信息或联系供应商</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
