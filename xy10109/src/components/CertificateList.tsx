import { useState, useMemo } from 'react';
import type { Certificate, CertificateType, CertificateStatus, ReviewStatus } from '../types';
import { useAppContext } from '../context';
import { getTypeName, getStatusName, getDaysUntilExpiry, getReviewStatusText } from '../utils';
import { CertificateForm } from './CertificateForm';
import { ReviewModal } from './ReviewModal';

export function CertificateList() {
  const { certificates, deleteCertificate } = useAppContext();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterReview, setFilterReview] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showForm, setShowForm] = useState(false);
  const [editCert, setEditCert] = useState<Certificate | undefined>();
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  
  const [showReview, setShowReview] = useState(false);
  const [reviewCert, setReviewCert] = useState<Certificate | undefined>();

  const [deleteConfirm, setDeleteConfirm] = useState<Certificate | null>(null);

  const filteredCertificates = useMemo(() => {
    return certificates.filter(cert => {
      if (filterType !== 'all' && cert.type !== filterType) return false;
      if (filterStatus !== 'all' && cert.status !== filterStatus) return false;
      if (filterReview !== 'all' && cert.reviewStatus !== filterReview) return false;
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          cert.certificateNumber.toLowerCase().includes(term) ||
          cert.name.toLowerCase().includes(term) ||
          cert.holder.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [certificates, filterType, filterStatus, filterReview, searchTerm]);

  const handleAddClick = () => {
    setEditCert(undefined);
    setFormMode('add');
    setShowForm(true);
  };

  const handleEditClick = (cert: Certificate) => {
    setEditCert(cert);
    setFormMode('edit');
    setShowForm(true);
  };

  const handleReviewClick = (cert: Certificate) => {
    setReviewCert(cert);
    setShowReview(true);
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      deleteCertificate(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const getStatusBadgeClass = (status: CertificateStatus) => {
    switch (status) {
      case 'valid': return 'bg-green-100 text-green-800';
      case 'expiring_soon': return 'bg-yellow-100 text-yellow-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'invalid': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getReviewBadgeClass = (status: ReviewStatus) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'under_review': return 'bg-blue-100 text-blue-800';
      default: return 'bg-orange-100 text-orange-800';
    }
  };

  const getTypeIcon = (type: CertificateType) => {
    switch (type) {
      case 'store_license': return '🏪';
      case 'health_certificate': return '💊';
      case 'supplier_qualification': return '📋';
      default: return '📄';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">证照管理</h2>
        <button
          onClick={handleAddClick}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition flex items-center gap-2"
        >
          <span>+</span>
          添加证照
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索证照编号、名称或持证人..."
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部类型</option>
            <option value="store_license">门店许可证</option>
            <option value="health_certificate">员工健康证</option>
            <option value="supplier_qualification">供应商资质</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="valid">有效</option>
            <option value="expiring_soon">即将过期</option>
            <option value="expired">已过期</option>
          </select>
          <select
            value={filterReview}
            onChange={(e) => setFilterReview(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部复核</option>
            <option value="not_reviewed">未复核</option>
            <option value="under_review">复核中</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
          </select>
        </div>

        {filteredCertificates.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-5xl mb-4">📂</p>
            <p className="text-lg">暂无证照数据</p>
            <p className="text-sm mt-2">点击上方按钮添加或导入证照</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCertificates.map(cert => {
              const daysUntil = getDaysUntilExpiry(cert.expiryDate);
              return (
                <div
                  key={cert.id}
                  className={`border rounded-lg p-4 transition hover:shadow-md ${
                    cert.status === 'expired' ? 'border-red-200 bg-red-50/30' :
                    cert.status === 'expiring_soon' ? 'border-yellow-200 bg-yellow-50/30' :
                    'border-gray-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{getTypeIcon(cert.type)}</span>
                        <span className="font-semibold text-lg text-gray-800">{cert.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(cert.status)}`}>
                          {getStatusName(cert.status)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getReviewBadgeClass(cert.reviewStatus)}`}>
                          {getReviewStatusText(cert.reviewStatus)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                        <div>
                          <span className="text-gray-400">编号：</span>{cert.certificateNumber}
                        </div>
                        <div>
                          <span className="text-gray-400">类型：</span>{getTypeName(cert.type)}
                        </div>
                        <div>
                          <span className="text-gray-400">持证人：</span>{cert.holder}
                        </div>
                        <div className={daysUntil < 0 ? 'text-red-600' : daysUntil <= 30 ? 'text-yellow-600' : ''}>
                          <span className="text-gray-400">到期：</span>{cert.expiryDate}
                          {daysUntil >= 0 && <span className="ml-1">({daysUntil}天后)</span>}
                          {daysUntil < 0 && <span className="ml-1">(已过期{Math.abs(daysUntil)}天)</span>}
                        </div>
                      </div>
                      {cert.reviewComments && (
                        <div className="mt-2 text-sm text-gray-500">
                          <span className="text-gray-400">复核备注：</span>{cert.reviewComments}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReviewClick(cert)}
                        className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition text-sm"
                      >
                        复核
                      </button>
                      <button
                        onClick={() => handleEditClick(cert)}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition text-sm"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(cert)}
                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition text-sm"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500 text-center">
          显示 {filteredCertificates.length} / {certificates.length} 条记录
        </div>
      </div>

      {showForm && (
        <CertificateForm
          certificate={editCert}
          mode={formMode}
          onCancel={() => setShowForm(false)}
        />
      )}

      {showReview && reviewCert && (
        <ReviewModal
          certificate={reviewCert}
          onCancel={() => setShowReview(false)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">确认删除</h3>
            <p className="text-gray-600 mb-2">
              确定要删除证照 <strong>{deleteConfirm.name}</strong> 吗？
            </p>
            <p className="text-sm text-red-600 mb-6">
              ⚠️ 此操作不可撤销，删除后无法恢复。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
