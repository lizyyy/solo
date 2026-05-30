import React, { useState } from 'react';
import { GitCompare, ChevronDown, ChevronRight, FileText, RefreshCw, Plus, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { BatchVersion, Material } from '@/types';

interface VersionCompareProps {
  versions: BatchVersion[];
  materials: Material[];
}

export const VersionCompare: React.FC<VersionCompareProps> = ({ versions, materials }) => {
  const [selectedVersion, setSelectedVersion] = useState<string>(
    versions.length > 0 ? versions[0].id : ''
  );

  const currentVersion = versions.find(v => v.id === selectedVersion);

  if (versions.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <GitCompare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">暂无版本记录</p>
        <p className="text-xs text-gray-400 mt-1">当材料更新时，系统会自动记录版本变更</p>
      </div>
    );
  }

  const versionOptions = versions.map(v => ({
    value: v.id,
    label: `v${v.version} - ${new Date(v.createdAt).toLocaleString('zh-CN')}`,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-64">
          <label className="block text-xs font-medium text-gray-500 mb-1">选择版本查看变更详情</label>
          <Select
            options={versionOptions}
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
          />
        </div>
        <Badge variant="info" size="sm">
          共 {versions.length} 个版本
        </Badge>
      </div>

      {currentVersion && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center">
                <GitCompare className="w-4 h-4 mr-2 text-primary-500" />
                版本 v{currentVersion.version} 变更详情
              </CardTitle>
              <span className="text-xs text-gray-500">
                {new Date(currentVersion.createdAt).toLocaleString('zh-CN')}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="mb-4 p-3 bg-primary-50 rounded-lg border border-primary-200">
              <p className="text-sm text-primary-800 font-medium">变更摘要</p>
              <p className="text-sm text-primary-700 mt-1">{currentVersion.changeSummary}</p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500">变更的材料</p>
              {currentVersion.changedMaterials.map((materialId) => {
                const material = materials.find(m => m.id === materialId);
                if (!material) return null;

                return (
                  <div key={materialId} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">{material.filename}</span>
                      </div>
                      <Badge variant="warning" size="sm">
                        {material.status === 'updated' ? '已更新' : '已补充'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-gray-500">材料类型: </span>
                        <span className="text-gray-700">
                          {material.type === 'product_terms' ? '产品条款' :
                           material.type === 'customer_position' ? '客户持仓' : '标的价格'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">版本: </span>
                        <span className="text-gray-700 font-mono">v{material.version}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
VersionCompare.displayName = 'VersionCompare';
