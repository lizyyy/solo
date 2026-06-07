import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CheckRecord } from '../types';
import { checkApi } from '../services/api';
import { getStatusText, getStatusClass, formatDate } from '../utils/format';

const CheckList: React.FC = () => {
  const [records, setRecords] = useState<CheckRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    sampleId: '',
    sampleName: '',
    imageUrl: '',
    caption: '',
    knowledgeLink: '',
    knowledgeTitle: '',
    modelVersion: 'v2.1.0',
    conclusion: '字幕与图像一致',
    operator: '小乔',
  });

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const data = await checkApi.getAll();
      setRecords(data);
    } catch (error) {
      console.error('Failed to load records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await checkApi.import({
        sampleId: formData.sampleId,
        sampleName: formData.sampleName,
        imageUrl: formData.imageUrl,
        caption: formData.caption,
        knowledgeRef: {
          link: formData.knowledgeLink,
          title: formData.knowledgeTitle,
          sampleId: formData.sampleId,
          modelVersion: formData.modelVersion,
          conclusion: formData.conclusion,
        },
        operator: formData.operator,
      });
      setShowImportModal(false);
      loadRecords();
      setFormData({
        sampleId: '',
        sampleName: '',
        imageUrl: '',
        caption: '',
        knowledgeLink: '',
        knowledgeTitle: '',
        modelVersion: 'v2.1.0',
        conclusion: '字幕与图像一致',
        operator: '小乔',
      });
    } catch (error) {
      console.error('Failed to import:', error);
    }
  };

  const handleExport = async () => {
    try {
      const details = await checkApi.getExportDetails();
      const csvContent = [
        ['样本编号', '样本名称', '一致性得分', '是否一致', '状态', '模型版本', '冲突数量', '更新时间'],
        ...details.map(d => [
          d.sampleId,
          d.sampleName,
          d.consistencyScore.toFixed(2),
          d.isConsistent ? '是' : '否',
          getStatusText(d.status),
          d.modelVersion,
          d.conflictCount,
          formatDate(d.updatedAt),
        ])
      ].map(row => row.join(',')).join('\n');
      
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `图像字幕检查_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="header">
          <h1>图像字幕一致性检查</h1>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>图像字幕一致性检查</h1>
        <p>统一管理知识库引用、线上工单与检查结果，确保数据一致性</p>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ marginBottom: 0 }}>检查记录列表</h2>
          <div className="flex gap-2">
            <button className="btn btn-default" onClick={handleExport}>
              导出数据
            </button>
            <button className="btn btn-primary" onClick={() => setShowImportModal(true)}>
              导入知识库引用
            </button>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>样本编号</th>
              <th>样本名称</th>
              <th>一致性得分</th>
              <th>状态</th>
              <th>模型版本</th>
              <th>冲突</th>
              <th>当前步骤</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {records.map(record => (
              <tr key={record.id}>
                <td>{record.sampleId}</td>
                <td>{record.sampleName}</td>
                <td>
                  <span className={record.calculationResult.consistencyScore >= 0.9 ? 'text-success' : 
                        record.calculationResult.consistencyScore >= 0.7 ? 'text-warning' : 'text-danger'}>
                  {(record.calculationResult.consistencyScore * 100).toFixed(0)}分
                </span>
              </td>
                <td>
                  <span className={`status-badge ${getStatusClass(record.status)}`}>
                    {getStatusText(record.status)}
                  </span>
                </td>
                <td>{record.modelVersionInfo.version}</td>
                <td>
                  {record.conflicts.length > 0 ? (
                    <span className="text-danger">{record.conflicts.length} 项</span>
                  ) : (
                    <span className="text-muted">无</span>
                  )}
                </td>
                <td>第 {record.currentStep} 步</td>
                <td className="text-muted" style={{ fontSize: 12 }}>
                  {formatDate(record.updatedAt)}
                </td>
                <td>
                  <button 
                    className="btn btn-default btn-sm"
                    onClick={() => navigate(`/checks/${record.id}`)}
                  >
                    查看详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showImportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="card" style={{ width: 500, maxHeight: '90vh', overflow: 'auto' }}>
            <h2>导入知识库引用</h2>
            <form onSubmit={handleImport}>
              <div className="form-group">
                <label>样本编号</label>
                <input
                  type="text"
                  value={formData.sampleId}
                  onChange={e => setFormData({ ...formData, sampleId: e.target.value })}
                  placeholder="如：SAMPLE-004"
                  required
                />
              </div>
              <div className="form-group">
                <label>样本名称</label>
                <input
                  type="text"
                  value={formData.sampleName}
                  onChange={e => setFormData({ ...formData, sampleName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>图片URL</label>
                <input
                  type="text"
                  value={formData.imageUrl}
                  onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>字幕内容</label>
                <input
                  type="text"
                  value={formData.caption}
                  onChange={e => setFormData({ ...formData, caption: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>知识库链接</label>
                <input
                  type="text"
                  value={formData.knowledgeLink}
                  onChange={e => setFormData({ ...formData, knowledgeLink: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>知识库标题</label>
                <input
                  type="text"
                  value={formData.knowledgeTitle}
                  onChange={e => setFormData({ ...formData, knowledgeTitle: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>模型版本</label>
                <select
                  value={formData.modelVersion}
                  onChange={e => setFormData({ ...formData, modelVersion: e.target.value })}
                >
                  <option value="v2.0.0">v2.0.0</option>
                  <option value="v2.1.0">v2.1.0</option>
                </select>
              </div>
              <div className="form-group">
                <label>结论</label>
                <select
                  value={formData.conclusion}
                  onChange={e => setFormData({ ...formData, conclusion: e.target.value })}
                >
                  <option value="字幕与图像一致">字幕与图像一致</option>
                  <option value="字幕与图像不一致">字幕与图像不一致</option>
                </select>
              </div>
              <div className="form-group">
                <label>操作人</label>
                <input
                  type="text"
                  value={formData.operator}
                  onChange={e => setFormData({ ...formData, operator: e.target.value })}
                />
              </div>
              <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-default"
                  onClick={() => setShowImportModal(false)}
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  导入
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckList;
