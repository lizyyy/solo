import { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Edit3,
  User,
  Clock,
  Hash,
  AlertTriangle,
  CheckCircle,
  Eye,
  Wrench,
} from 'lucide-react';
import { db } from '../db';
import { useCanonicalStore } from '../store/canonicalStore';
import { StatusBadge } from '../components/StatusBadge';
import type { CoordinateOriginRow, ModificationRecord } from '../types';
import { formatTimestamp } from '../utils/checksum';
import { MOCK_COORDINATE_ORIGIN_CSV } from '../data/mockData';

function ModificationDiff({ record }: { record: ModificationRecord }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500">{record.field}:</span>
      <span className="font-mono text-red-600 bg-red-50 px-1">
        {record.oldValue !== null && record.oldValue !== undefined ? String(record.oldValue) : '空'}
      </span>
      <span className="text-gray-400">→</span>
      <span className="font-mono text-green-600 bg-green-50 px-1">
        {record.newValue !== null && record.newValue !== undefined ? String(record.newValue) : '空'}
      </span>
      <span className="text-gray-400 ml-2">
        {record.operator} · {formatTimestamp(record.timestamp)}
      </span>
    </div>
  );
}

export function CoordinateOrigin() {
  const { currentOperator, supplementPhoto, fixMissing, reviewMissing, recalculate } = useCanonicalStore();
  const [rows, setRows] = useState<CoordinateOriginRow[]>([]);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [editingPhotoNumber, setEditingPhotoNumber] = useState<{ id: string; value: string } | null>(null);
  const [fixingMissing, setFixingMissing] = useState<{
    id: string;
    x: string;
    y: string;
    z: string;
  } | null>(null);
  const [reviewComment, setReviewComment] = useState<{ id: string; comment: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadRows();
  }, []);

  const loadRows = async () => {
    const data = await db.coordinateOrigin.orderBy('originalLineNumber').toArray();
    setRows(data);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleImportMock = async () => {
    try {
      await useCanonicalStore.getState().importData(MOCK_COORDINATE_ORIGIN_CSV, '坐标原点说明_模拟数据.csv');
      await loadRows();
      showMessage('success', '导入成功！已检测并标记缺行记录');
    } catch (error) {
      showMessage('error', '导入失败：' + String(error));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await useCanonicalStore.getState().importData(text, file.name);
      await loadRows();
      showMessage('success', '导入成功！');
    } catch (error) {
      showMessage('error', '导入失败：' + String(error));
    }
    e.target.value = '';
  };

  const handleSupplementPhoto = async () => {
    if (!editingPhotoNumber) return;
    try {
      const success = await supplementPhoto(editingPhotoNumber.id, editingPhotoNumber.value);
      if (success) {
        await loadRows();
        setEditingPhotoNumber(null);
        showMessage('success', '照片编号补录成功');
      }
    } catch (error) {
      showMessage('error', '补录失败：' + String(error));
    }
  };

  const handleFixMissing = async () => {
    if (!fixingMissing) return;
    try {
      const success = await fixMissing(
        fixingMissing.id,
        parseFloat(fixingMissing.x),
        parseFloat(fixingMissing.y),
        parseFloat(fixingMissing.z)
      );
      if (success) {
        await loadRows();
        setFixingMissing(null);
        showMessage('success', '缺行坐标补录成功');
      }
    } catch (error) {
      showMessage('error', '补录失败：' + String(error));
    }
  };

  const handleReview = async () => {
    if (!reviewComment) return;
    try {
      const success = await reviewMissing(reviewComment.id, reviewComment.comment);
      if (success) {
        await loadRows();
        setReviewComment(null);
        showMessage('success', '复核完成，已流转至下一步');
      }
    } catch (error) {
      showMessage('error', '复核失败：' + String(error));
    }
  };

  const handleRecalculate = async () => {
    try {
      const result = await recalculate();
      if (result.success) {
        await loadRows();
        showMessage('success', `重算成功，新版本：${result.newVersion}`);
      } else {
        showMessage('error', '重算校验失败');
      }
    } catch (error) {
      showMessage('error', '重算失败：' + String(error));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">坐标原点说明</h1>
          <p className="text-sm text-gray-500 mt-1">
            管理坐标原点说明数据，追踪原始行号、人工改动和处理状态
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleImportMock} className="btn-industrial-outline flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            导入模拟数据
          </button>
          <label className="btn-industrial flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            导入CSV文件
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 border-2 ${
            message.type === 'success' ? 'border-success-500 bg-green-50' : 'border-danger-500 bg-red-50'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-success-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-danger-500" />
            )}
            <span className={message.type === 'success' ? 'text-success-700' : 'text-danger-700'}>
              {message.text}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="card-industrial p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold text-gray-700">原始文件说明</h3>
          </div>
          <p className="text-sm text-gray-600">
            坐标原点说明文件包含照片点位ID、照片编号和三维坐标。系统保留每一行的
            <span className="font-bold text-primary-600">原始行号</span>用于追溯，
            无论后续如何排序或修改，原始行号永不改变。
          </p>
        </div>
        <div className="card-industrial p-4">
          <div className="flex items-center gap-2 mb-2">
            <Edit3 className="w-5 h-5 text-warning-500" />
            <h3 className="font-semibold text-gray-700">人工改动记录</h3>
          </div>
          <p className="text-sm text-gray-600">
            所有人工修改（补录照片编号、修正坐标、复核确认）都会被完整记录，
            包含<span className="font-bold text-warning-500">改动前后值、操作人、时间戳</span>，
            安全员可随时追溯完整证据链。
          </p>
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">行号追踪表格</h2>
            <button onClick={handleRecalculate} className="btn-success flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              触发重算
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header-cell sticky left-0 bg-gray-50 z-10">
                    <Hash className="w-4 h-4 inline mr-1" />
                    原始行号
                  </th>
                  <th className="table-header-cell">当前行号</th>
                  <th className="table-header-cell">点位ID</th>
                  <th className="table-header-cell">照片编号</th>
                  <th className="table-header-cell">X坐标</th>
                  <th className="table-header-cell">Y坐标</th>
                  <th className="table-header-cell">Z坐标</th>
                  <th className="table-header-cell">人工改动</th>
                  <th className="table-header-cell">复核人</th>
                  <th className="table-header-cell">状态</th>
                  <th className="table-header-cell">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50 ${
                      row.processingStatus === 'missing_row' ? 'missing-row-highlight' : ''
                    } ${expandedRowId === row.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="table-cell sticky left-0 bg-inherit z-10 font-mono font-bold text-primary-600">
                      {row.originalLineNumber}
                    </td>
                    <td className="table-cell font-mono">{row.currentLineNumber}</td>
                    <td className="table-cell font-mono">{row.photoPointId}</td>
                    <td className="table-cell">
                      {editingPhotoNumber?.id === row.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingPhotoNumber.value}
                            onChange={(e) =>
                              setEditingPhotoNumber({ ...editingPhotoNumber, value: e.target.value })
                            }
                            className="input-industrial w-28"
                            autoFocus
                          />
                          <button onClick={handleSupplementPhoto} className="btn-success px-2 py-1 text-xs">
                            保存
                          </button>
                          <button
                            onClick={() => setEditingPhotoNumber(null)}
                            className="btn-industrial-outline px-2 py-1 text-xs"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{row.photoNumber || '-'}</span>
                          {!row.photoNumber && currentOperator === '许工' && (
                            <button
                              onClick={() => setEditingPhotoNumber({ id: row.id, value: '' })}
                              className="text-primary-600 hover:text-primary-800 text-xs"
                            >
                              补录
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="table-cell font-mono">
                      {row.coordinateX?.toFixed(2) || '-'}
                    </td>
                    <td className="table-cell font-mono">
                      {row.coordinateY?.toFixed(2) || '-'}
                    </td>
                    <td className="table-cell font-mono">
                      {fixingMissing?.id === row.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            value={fixingMissing.x}
                            onChange={(e) => setFixingMissing({ ...fixingMissing, x: e.target.value })}
                            className="input-industrial w-16"
                            placeholder="X"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={fixingMissing.y}
                            onChange={(e) => setFixingMissing({ ...fixingMissing, y: e.target.value })}
                            className="input-industrial w-16"
                            placeholder="Y"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={fixingMissing.z}
                            onChange={(e) => setFixingMissing({ ...fixingMissing, z: e.target.value })}
                            className="input-industrial w-16"
                            placeholder="Z"
                          />
                          <button onClick={handleFixMissing} className="btn-success px-2 py-1 text-xs">
                            保存
                          </button>
                          <button
                            onClick={() => setFixingMissing(null)}
                            className="btn-industrial-outline px-2 py-1 text-xs"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        row.coordinateZ?.toFixed(2) || (
                          <button
                            onClick={() => setFixingMissing({ id: row.id, x: '', y: '', z: '' })}
                            className="text-warning-500 hover:text-warning-600 text-xs"
                          >
                            补坐标
                          </button>
                        )
                      )}
                    </td>
                    <td className="table-cell">
                      {row.isManuallyModified ? (
                        <span className="text-xs bg-warning-100 text-warning-600 px-2 py-0.5 flex items-center gap-1 w-fit">
                          <Edit3 className="w-3 h-3" />
                          是 ({row.modificationHistory.length - 1}次)
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5">否</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {row.reviewedBy ? (
                        <span className="flex items-center gap-1 text-xs">
                          <User className="w-3 h-3 text-success-500" />
                          {row.reviewedBy}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={row.processingStatus} />
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        {row.processingStatus === 'missing_row' && currentOperator === '安全员' && !row.reviewedBy && (
                          <button
                            onClick={() => setReviewComment({ id: row.id, comment: '' })}
                            className="text-warning-500 hover:text-warning-600 text-xs flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            复核
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                          className="text-primary-600 hover:text-primary-800 text-xs"
                        >
                          {expandedRowId === row.id ? '收起' : '展开'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.map((row) =>
            expandedRowId === row.id ? (
              <div key={`expanded-${row.id}`} className="card-industrial p-4 border-primary-300">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-800">
                    第 {row.originalLineNumber} 行完整追溯信息
                  </h4>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      创建于 {formatTimestamp(row.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      更新于 {formatTimestamp(row.updatedAt)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">修改记录</h5>
                    <div className="space-y-2 bg-gray-50 p-3 border border-gray-200">
                      {row.modificationHistory.map((record, i) => (
                        <ModificationDiff key={i} record={record} />
                      ))}
                    </div>
                  </div>

                  {row.reviewedAt && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">复核记录</h5>
                      <div className="bg-green-50 p-3 border border-green-200 text-sm">
                        <span className="font-medium text-success-600">{row.reviewedBy}</span>
                        <span className="text-gray-500 ml-2">
                          于 {formatTimestamp(row.reviewedAt)} 复核确认
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null
          )}

          {reviewComment && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 w-96 border-2 border-gray-200 shadow-xl">
                <h3 className="font-bold text-gray-800 mb-4">安全员复核</h3>
                <p className="text-sm text-gray-600 mb-4">
                  请确认该"照片有点位但坐标表缺一行"的记录，确认后将流转至许工补录。
                </p>
                <textarea
                  value={reviewComment.comment}
                  onChange={(e) => setReviewComment({ ...reviewComment, comment: e.target.value })}
                  placeholder="请输入复核意见..."
                  className="input-industrial mb-4 h-24"
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setReviewComment(null)}
                    className="btn-industrial-outline"
                  >
                    取消
                  </button>
                  <button onClick={handleReview} className="btn-success">
                    确认复核
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {rows.length === 0 && (
        <div className="card-industrial p-12 text-center">
          <FileSpreadsheet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">暂无坐标原点说明数据</h3>
          <p className="text-sm text-gray-400 mb-6">
            请点击上方"导入模拟数据"或"导入CSV文件"开始
          </p>
          <button onClick={handleImportMock} className="btn-industrial">
            导入模拟数据（含缺行场景）
          </button>
        </div>
      )}
    </div>
  );
}
