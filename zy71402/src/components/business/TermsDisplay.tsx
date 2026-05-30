import React, { useState } from 'react';
import { FileText, Calendar, TrendingUp, Clock, AlertTriangle, Edit2, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EvidenceDisplay } from './EvidenceDisplay';
import type { ParsedTerms, ReturnTier, ObservationInterval, EarlyTermination } from '@/types';

interface TermsDisplayProps {
  terms: ParsedTerms | null;
  onUpdate?: (terms: ParsedTerms) => void;
}

export const TermsDisplay: React.FC<TermsDisplayProps> = ({ terms, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ParsedTerms | null>(null);

  if (!terms) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">暂无解析的产品条款</p>
        <p className="text-xs text-gray-400 mt-1">请先导入产品条款文件并执行解析</p>
      </div>
    );
  }

  const handleEdit = () => {
    setEditData(JSON.parse(JSON.stringify(terms)));
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editData) {
      onUpdate?.(editData);
      setIsEditing(false);
      setEditData(null);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData(null);
  };

  const data = isEditing && editData ? editData : terms;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">产品条款解析结果</h3>
          {data.manuallyModified && (
            <Badge variant="warning" size="sm">
              已人工修正
            </Badge>
          )}
        </div>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Edit2 className="w-4 h-4 mr-1" />
            人工修正
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <X className="w-4 h-4 mr-1" />
              取消
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              <Check className="w-4 h-4 mr-1" />
              保存
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <FileText className="w-4 h-4 mr-2 text-primary-500" />
              产品基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 space-y-2">
            <InfoRow
              label="产品代码"
              value={data.productCode}
              evidence={data.evidenceRef['productCode']}
              editing={isEditing}
              onChange={(v) => setEditData(d => d ? { ...d, productCode: v } : null)}
            />
            <InfoRow
              label="产品名称"
              value={data.productName}
              evidence={data.evidenceRef['productName']}
              editing={isEditing}
              onChange={(v) => setEditData(d => d ? { ...d, productName: v } : null)}
            />
            <InfoRow
              label="挂钩标的"
              value={data.underlying}
              evidence={data.evidenceRef['underlying']}
              editing={isEditing}
              onChange={(v) => setEditData(d => d ? { ...d, underlying: v } : null)}
            />
            <InfoRow
              label="标的代码"
              value={data.underlyingCode}
              evidence={data.evidenceRef['underlyingCode']}
              editing={isEditing}
              onChange={(v) => setEditData(d => d ? { ...d, underlyingCode: v } : null)}
            />
            <InfoRow
              label="币种"
              value={data.currency}
              evidence={data.evidenceRef['currency']}
              editing={isEditing}
              onChange={(v) => setEditData(d => d ? { ...d, currency: v } : null)}
            />
            <InfoRow
              label="产品期限"
              value={`${data.termDays} 天`}
              evidence={data.evidenceRef['termDays']}
              editing={isEditing}
              onChange={(v) => setEditData(d => d ? { ...d, termDays: parseInt(v) || 0 } : null)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-primary-500" />
              观察区间
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ObservationIntervalsDisplay
              intervals={data.observationIntervals}
              evidenceRef={data.evidenceRef}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Clock className="w-4 h-4 mr-2 text-primary-500" />
              提前终止条款
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <EarlyTerminationDisplay
              earlyTermination={data.earlyTermination}
              evidenceRef={data.evidenceRef}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-primary-500" />
            收益档位
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <ReturnTiersDisplay tiers={data.returnTiers} evidenceRef={data.evidenceRef} />
        </CardContent>
      </Card>

      <div className="text-xs text-gray-500 flex items-center justify-end gap-2">
        <FileText className="w-3 h-3" />
        解析时间: {new Date(data.parsedAt).toLocaleString('zh-CN')}
      </div>
    </div>
  );
};
TermsDisplay.displayName = 'TermsDisplay';

interface InfoRowProps {
  label: string;
  value: string | number;
  evidence?: any;
  editing?: boolean;
  onChange?: (value: string) => void;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, evidence, editing, onChange }) => {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        {evidence && <EvidenceDisplay evidence={evidence} compact />}
      </div>
      {editing ? (
        <Input
          value={String(value)}
          onChange={(e) => onChange?.(e.target.value)}
          className="h-7 text-sm mt-0.5"
        />
      ) : (
        <p className="text-sm font-medium text-gray-900 font-mono">{value}</p>
      )}
    </div>
  );
};

interface ObservationIntervalsDisplayProps {
  intervals: ObservationInterval[];
  evidenceRef: Record<string, any>;
}

const ObservationIntervalsDisplay: React.FC<ObservationIntervalsDisplayProps> = ({ intervals }) => {
  if (intervals.length === 0) {
    return <p className="text-sm text-gray-500">未设置观察区间</p>;
  }

  return (
    <div className="space-y-2">
      {intervals.map((interval, idx) => (
        <div key={interval.id} className="p-2 bg-gray-50 rounded">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>观察区间 {idx + 1}</span>
          </div>
          <div className="text-sm font-medium text-gray-900">
            {interval.startDate} ~ {interval.endDate}
          </div>
          <div className="text-xs text-primary-600 mt-0.5 font-mono">
            {interval.lowerInclusive ? '[' : '('}{interval.lowerBound.toFixed(2)}, {interval.upperBound.toFixed(2)}{interval.upperInclusive ? ']' : ')'}
          </div>
        </div>
      ))}
    </div>
  );
};

interface ReturnTiersDisplayProps {
  tiers: ReturnTier[];
  evidenceRef: Record<string, any>;
}

const ReturnTiersDisplay: React.FC<ReturnTiersDisplayProps> = ({ tiers }) => {
  // 检查边界风险
  const hasBoundaryRisk = tiers.some((tier, idx) => {
    if (idx === 0) return false;
    const prevTier = tiers[idx - 1];
    return Math.abs(tier.lowerBound - prevTier.upperBound) < 0.01;
  });

  return (
    <div>
      {hasBoundaryRisk && (
        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded flex items-center gap-2 text-sm text-yellow-800">
          <AlertTriangle className="w-4 h-4" />
          <span>注意：档位区间存在边界相邻，请注意边界包含规则</span>
        </div>
      )}
      <div className="grid grid-cols-5 gap-3">
        {tiers.map((tier, idx) => (
          <div
            key={tier.id}
            className={`p-3 rounded-lg border-2 ${
              idx === 0
                ? 'bg-red-50 border-red-200'
                : idx === tiers.length - 1
                ? 'bg-green-50 border-green-200'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="text-xs text-gray-500 mb-1">档位 {idx + 1}</div>
            <div className="font-mono text-sm font-semibold text-gray-900 mb-1">
              {tier.lowerInclusive ? '[' : '('}{tier.lowerBound.toFixed(2)}, {tier.upperBound.toFixed(2)}{tier.upperInclusive ? ']' : ')'}
            </div>
            <div className="text-lg font-bold text-primary-700">
              {(tier.returnRate * 100).toFixed(2)}%
            </div>
            <div className="text-xs text-gray-600 mt-1 line-clamp-2">
              {tier.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface EarlyTerminationDisplayProps {
  earlyTermination: EarlyTermination | null;
  evidenceRef: Record<string, any>;
}

const EarlyTerminationDisplay: React.FC<EarlyTerminationDisplayProps> = ({ earlyTermination }) => {
  if (!earlyTermination || !earlyTermination.enabled) {
    return (
      <div className="text-center py-4">
        <Badge variant="neutral">无提前终止条款</Badge>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
        <div className="flex items-center gap-1 text-xs font-medium text-yellow-800 mb-1">
          <Clock className="w-3 h-3" />
          已启用提前终止
        </div>
        <div className="text-xs text-yellow-700">
          触发条件: {earlyTermination.triggerCondition} {earlyTermination.triggerLevel}
        </div>
        <div className="text-xs text-yellow-700 mt-0.5">
          终止收益率: {(earlyTermination.returnRate * 100).toFixed(2)}%
        </div>
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">观察日期</div>
        <div className="flex flex-wrap gap-1">
          {earlyTermination.observationDates.map((date, idx) => (
            <Badge key={idx} variant="default" size="sm">
              {date}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};
