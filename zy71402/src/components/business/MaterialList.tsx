import React, { useState } from 'react';
import { FileText, Trash2, Eye, Download, Clock, User, RefreshCw, Plus } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import type { Material } from '@/types';

interface MaterialListProps {
  materials: Material[];
  onDelete?: (materialId: string) => void;
  onView?: (material: Material) => void;
}

const typeLabels: Record<string, { label: string; color: string }> = {
  product_terms: { label: '产品条款', color: 'bg-blue-100 text-blue-800' },
  customer_position: { label: '客户持仓', color: 'bg-green-100 text-green-800' },
  underlying_price: { label: '标的价格', color: 'bg-purple-100 text-purple-800' },
};

const statusLabels: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'neutral' }> = {
  new: { label: '新导入', variant: 'success' },
  duplicate: { label: '重复', variant: 'neutral' },
  updated: { label: '已更新', variant: 'warning' },
  supplementary: { label: '补充', variant: 'info' },
};

export const MaterialList: React.FC<MaterialListProps> = ({ materials, onDelete, onView }) => {
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = (materialId: string) => {
    onDelete?.(materialId);
    setDeleteConfirm(null);
  };

  if (materials.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">暂无导入的材料</p>
        <p className="text-xs text-gray-400 mt-1">请上传产品条款、客户持仓、标的价格文件</p>
      </div>
    );
  }

  return (
    <div>
      <Table bordered>
        <TableHeader>
          <TableRow>
            <TableHead>材料类型</TableHead>
            <TableHead>文件名</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>版本</TableHead>
            <TableHead>来源</TableHead>
            <TableHead>导入时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((material) => (
            <TableRow key={material.id}>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${typeLabels[material.type].color}`}>
                  <FileText className="w-3 h-3 mr-1" />
                  {typeLabels[material.type].label}
                </span>
              </TableCell>
              <TableCell>
                <div className="font-medium text-gray-900">{material.filename}</div>
                {material.previousVersion && (
                  <div className="text-xs text-yellow-600 flex items-center mt-0.5">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    覆盖了旧版本
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={statusLabels[material.status].variant} dot>
                  {statusLabels[material.status].label}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-sm">v{material.version}</TableCell>
              <TableCell>
                <span className="inline-flex items-center text-xs text-gray-500">
                  <User className="w-3 h-3 mr-1" />
                  {material.source}
                </span>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center text-xs text-gray-500">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatDate(material.importedAt)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewingMaterial(material)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView?.(material)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setDeleteConfirm(material.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal
        open={!!viewingMaterial}
        onClose={() => setViewingMaterial(null)}
        title="材料详情"
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setViewingMaterial(null)}>
            关闭
          </Button>
        }
      >
        {viewingMaterial && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500">材料类型</label>
                <p className="mt-1">{typeLabels[viewingMaterial.type].label}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">文件名</label>
                <p className="mt-1 font-mono text-sm">{viewingMaterial.filename}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">数据指纹</label>
                <p className="mt-1 font-mono text-xs text-gray-600">{viewingMaterial.dataHash}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">导入时间</label>
                <p className="mt-1">{formatDate(viewingMaterial.importedAt)}</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">解析内容预览</label>
              <pre className="mt-1 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-64 font-mono">
                {JSON.stringify(viewingMaterial.content, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="确认删除"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              确认删除
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          确定要删除这份材料吗？删除后需要重新导入。
        </p>
      </Modal>
    </div>
  );
};
MaterialList.displayName = 'MaterialList';
