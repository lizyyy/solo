import { useEffect, useMemo } from 'react';
import { FileText, Edit, Eye, AlertTriangle, Clock, CheckCircle2, Shield } from 'lucide-react';
import { useStore } from '../store';
import { Card, CardHeader, CardContent } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { RiskBadge } from '../components/RiskBadge';
import { Button } from '../components/Button';
import type { License, ChannelType } from '../types';

const channelLabels: Record<ChannelType, string> = {
  web: '网站',
  print: '印刷',
  social: '社交',
  broadcast: '广电',
  merchandise: '周边'
};

function getExpiryStatus(endDate: string): { status: 'normal' | 'expiring' | 'expired'; days: number } {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - now.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (days < 0) return { status: 'expired', days };
  if (days <= 30) return { status: 'expiring', days };
  return { status: 'normal', days };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function Licenses() {
  const { licenses, loadLicenses, loading } = useStore();

  useEffect(() => {
    loadLicenses();
  }, [loadLicenses]);

  const stats = useMemo(() => {
    const total = licenses.length;
    let expiring = 0;
    let expired = 0;

    licenses.forEach(lic => {
      const { status } = getExpiryStatus(lic.endDate);
      if (status === 'expiring') expiring++;
      if (status === 'expired') expired++;
    });

    return { total, expiring, expired };
  }, [licenses]);

  if (loading.licenses) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">授权证书管理</h1>
          <p className="text-slate-400 mt-1">管理所有字体的授权证书信息</p>
        </div>
        <Button>
          <FileText className="w-4 h-4" />
          新增授权
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                <Shield className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">总授权数</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[rgba(251,140,0,0.15)]">
                <Clock className="w-6 h-6 text-[#FB8C00]" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">即将过期</p>
                <p className="text-2xl font-bold text-[#FB8C00] mt-1">{stats.expiring}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[rgba(229,57,53,0.15)]">
                <AlertTriangle className="w-6 h-6 text-[#E53935]" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">已过期</p>
                <p className="text-2xl font-bold text-[#E53935] mt-1">{stats.expired}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">授权证书列表</h2>
            <span className="text-sm text-slate-400">共 {licenses.length} 条记录</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {licenses.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">暂无授权证书记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">字体名称</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">授权方</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">授权类型</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">有效期</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">允许渠道</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">状态</th>
                    <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map((license) => (
                    <LicenseRow key={license.id} license={license} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LicenseRow({ license }: { license: License }) {
  const expiry = getExpiryStatus(license.endDate);

  const expiryClasses = {
    normal: 'text-slate-300',
    expiring: 'text-[#FB8C00] font-medium',
    expired: 'text-[#E53935] font-medium'
  };

  return (
    <tr className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
      <td className="py-4 px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="font-medium text-white">{license.fontName}</span>
        </div>
      </td>
      <td className="py-4 px-6 text-slate-300">{license.licensor}</td>
      <td className="py-4 px-6 text-slate-300">{license.licenseType}</td>
      <td className="py-4 px-6">
        <div className="space-y-1">
          <div className={`text-sm ${expiryClasses[expiry.status]}`}>
            {formatDate(license.startDate)} ~ {formatDate(license.endDate)}
          </div>
          <div className="flex items-center gap-1 text-xs">
            {expiry.status === 'expired' ? (
              <>
                <AlertTriangle className="w-3 h-3 text-[#E53935]" />
                <span className="text-[#E53935]">已过期 {Math.abs(expiry.days)} 天</span>
              </>
            ) : expiry.status === 'expiring' ? (
              <>
                <Clock className="w-3 h-3 text-[#FB8C00]" />
                <span className="text-[#FB8C00]">剩余 {expiry.days} 天</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3 text-[#43A047]" />
                <span className="text-[#43A047]">有效</span>
              </>
            )}
          </div>
        </div>
      </td>
      <td className="py-4 px-6">
        <div className="flex flex-wrap gap-1">
          {license.allowedChannels.map((ch) => (
            <span
              key={ch}
              className="px-2 py-0.5 text-xs rounded-md bg-slate-700/50 text-slate-300 border border-slate-600/50"
            >
              {channelLabels[ch]}
            </span>
          ))}
        </div>
      </td>
      <td className="py-4 px-6">
        <div className="flex items-center gap-2">
          <StatusBadge status={license.status} size="sm" />
          {expiry.status !== 'normal' && (
            <RiskBadge
              level={expiry.status === 'expired' ? 'high' : 'medium'}
              size="sm"
            />
          )}
        </div>
      </td>
      <td className="py-4 px-6">
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm">
            <Eye className="w-4 h-4" />
            详情
          </Button>
          <Button variant="secondary" size="sm">
            <Edit className="w-4 h-4" />
            编辑
          </Button>
        </div>
      </td>
    </tr>
  );
}
