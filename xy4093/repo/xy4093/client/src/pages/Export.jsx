import { useState, useEffect } from 'react';
import { 
  Download, FileText, FileSpreadsheet, FileJson, 
  Clipboard, Eye, Check, AlertCircle, Clock, Users, Package
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/store';
import { exportApi } from '../services/api';

export default function Export() {
  const { batches, guests, rooms, supplies, fetchBatches, fetchGuests, fetchRooms, fetchSupplies } = useAppStore();
  
  const [selectedBatch, setSelectedBatch] = useState('');
  const [previewType, setPreviewType] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchBatches();
    fetchGuests();
    fetchRooms();
    fetchSupplies();
  }, []);

  const loadPreview = async (type) => {
    setLoading(true);
    setPreviewType(type);
    setPreviewContent(null);
    
    try {
      let response;
      switch (type) {
        case 'duty-sheet':
          response = await exportApi.getDutySheet();
          break;
        case 'ship-list':
          response = await exportApi.getShipList(selectedBatch || undefined);
          break;
        case 'audit-package':
          response = await exportApi.getAuditPackage();
          break;
        default:
          return;
      }
      setPreviewContent(response.data.data);
    } catch (error) {
      toast.error(error.response?.data?.error || '加载预览失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (type) => {
    switch (type) {
      case 'duty-sheet':
        exportApi.downloadDutySheet();
        break;
      case 'ship-list':
        exportApi.downloadShipList(selectedBatch || undefined);
        break;
      case 'audit-package':
        exportApi.downloadAuditPackage();
        break;
    }
    toast.success('下载已开始');
  };

  const copyToClipboard = async (content) => {
    try {
      const text = typeof content === 'object' 
        ? JSON.stringify(content, null, 2) 
        : content;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('已复制到剪贴板');
    } catch (error) {
      toast.error('复制失败');
    }
  };

  const stats = {
    totalGuests: guests.length,
    evacuated: guests.filter(g => g.is_evacuated).length,
    pending: guests.filter(g => !g.is_evacuated).length,
    criticalSupplies: supplies.filter(s => s.quantity <= s.min_threshold).length
  };

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">数据导出</h1>
          <p className="text-gray-500 mt-1">导出值班单、船班名单和审计数据</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">总住客数</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalGuests}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">已撤离</p>
            <p className="text-2xl font-bold text-success-600">{stats.evacuated}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">待撤离</p>
            <p className="text-2xl font-bold text-warning-600">{stats.pending}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">物资告警</p>
            <p className={`text-2xl font-bold ${stats.criticalSupplies > 0 ? 'text-danger-600' : 'text-success-600'}`}>
              {stats.criticalSupplies}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">值班单</h2>
          </div>
          <div className="card-body space-y-4">
            <p className="text-sm text-gray-500">
              导出完整的撤离值班单，包含住客状态、船班安排、物资情况等关键信息，以 Markdown 格式保存。
            </p>
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              生成时间: {formatDate()}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadPreview('duty-sheet')}
                className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                预览
              </button>
              <button
                onClick={() => handleDownload('duty-sheet')}
                className="btn btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                下载
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-success-600" />
            <h2 className="font-semibold text-gray-900">船班名单</h2>
          </div>
          <div className="card-body space-y-4">
            <p className="text-sm text-gray-500">
              导出船班住客名单，可选择特定批次或全部批次，以 CSV 格式保存，便于打印或分发。
            </p>
            <div>
              <label className="label text-sm">选择批次（可选）</label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="input"
              >
                <option value="">全部批次</option>
                {batches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    第 {batch.batch_number} 批次
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadPreview('ship-list')}
                className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                预览
              </button>
              <button
                onClick={() => handleDownload('ship-list')}
                className="btn btn-success flex-1 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                下载
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center gap-2">
            <FileJson className="w-5 h-5 text-warning-600" />
            <h2 className="font-semibold text-gray-900">审计包</h2>
          </div>
          <div className="card-body space-y-4">
            <p className="text-sm text-gray-500">
              导出完整的审计数据包，包含所有历史记录、操作日志和当前状态，以 JSON 格式保存，用于数据归档和审计。
            </p>
            <div className="p-3 bg-warning-50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-warning-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-warning-800">
                  <p className="font-medium">包含内容：</p>
                  <p>房间、住客、船班、物资、批次、操作日志</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadPreview('audit-package')}
                className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                预览
              </button>
              <button
                onClick={() => handleDownload('audit-package')}
                className="btn btn-warning flex-1 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                下载
              </button>
            </div>
          </div>
        </div>
      </div>

      {previewType && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">
                {previewType === 'duty-sheet' && '值班单预览'}
                {previewType === 'ship-list' && '船班名单预览'}
                {previewType === 'audit-package' && '审计包预览'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {previewContent && (
                <button
                  onClick={() => copyToClipboard(previewContent)}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  {copied ? (
                    <><Check className="w-4 h-4" /> 已复制</>
                  ) : (
                    <><Clipboard className="w-4 h-4" /> 复制</>
                  )}
                </button>
              )}
              <button
                onClick={() => { setPreviewType(null); setPreviewContent(null); }}
                className="text-gray-500 hover:text-gray-700"
              >
                关闭
              </button>
            </div>
          </div>
          <div className="card-body">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4"></div>
                <p className="text-gray-500">加载预览中...</p>
              </div>
            ) : previewContent ? (
              <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
                {previewType === 'audit-package' ? (
                  <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap">
                    {JSON.stringify(previewContent, null, 2)}
                  </pre>
                ) : previewType === 'ship-list' ? (
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th>批次</th>
                          <th>姓名</th>
                          <th>房间</th>
                          <th>年龄</th>
                          <th>优先级</th>
                          <th>状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewContent.split('\n').slice(1).filter(line => line.trim()).map((line, index) => {
                          const [batch_number, name, room_number, age, priority, status] = line.split(',').map(s => s.trim());
                          return (
                            <tr key={index}>
                              <td>{batch_number}</td>
                              <td className="font-medium">{name}</td>
                              <td>{room_number}</td>
                              <td>{age}</td>
                              <td>
                                {priority && priority !== '-' && (
                                  <span className="badge badge-danger text-xs">{priority}</span>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${
                                  status === '已撤离' ? 'badge-success' : 
                                  status === '已分配' ? 'badge-primary' : 'badge-warning'
                                }`}>
                                  {status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap">
                    {previewContent}
                  </pre>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">暂无内容</p>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">导出说明</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-600" />
                Markdown 值班单
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 包含撤离状态概览</li>
                <li>• 船班批次安排列表</li>
                <li>• 物资储备状态</li>
                <li>• 高优先级住客列表</li>
                <li>• 适合打印或分享</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-success-600" />
                CSV 船班名单
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 包含批次号、姓名、房间</li>
                <li>• 可筛选特定批次</li>
                <li>• Excel 兼容格式</li>
                <li>• 便于打印点名</li>
                <li>• 可直接分发使用</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <FileJson className="w-4 h-4 text-warning-600" />
                JSON 审计包
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 完整数据库快照</li>
                <li>• 包含所有操作日志</li>
                <li>• 时间戳记录完整</li>
                <li>• 用于数据备份</li>
                <li>• 便于后续审计追溯</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
