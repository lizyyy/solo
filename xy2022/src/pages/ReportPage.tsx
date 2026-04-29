import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/UI';
import { useToast } from '../components/Toast';

const ReportPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [reportType, setReportType] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');

  const reportTypes = [
    { id: 'service', label: '服务问题' },
    { id: 'feeder', label: '喂养师问题' },
    { id: 'payment', label: '支付问题' },
    { id: 'refund', label: '退款问题' },
    { id: 'other', label: '其他问题' },
  ];

  const handleSubmit = () => {
    if (!reportType) {
      showToast('请选择问题类型');
      return;
    }
    if (!content.trim()) {
      showToast('请填写问题描述');
      return;
    }

    showToast('提交成功！我们会尽快处理');
    setTimeout(() => {
      navigate('/profile');
    }, 1500);
  };

  return (
    <div className="page-container" style={{ paddingBottom: 100 }}>
      <Header title="投诉举报" />

      <div className="card">
        <p className="text-sm text-secondary mb-2">说明</p>
        <p className="text-sm text-secondary">
          请如实描述您遇到的问题，我们会在1-3个工作日内与您联系处理。
        </p>
      </div>

      <div className="card">
        <div className="input-group">
          <label>问题类型 *</label>
          <div className="grid grid-cols-2 gap-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {reportTypes.map((type) => (
              <div
                key={type.id}
                className={`p-3 rounded-lg text-center cursor-pointer border-2 ${
                  reportType === type.id
                    ? 'border-orange bg-orange-50'
                    : 'border-gray-200'
                }`}
                style={{
                  borderColor: reportType === type.id ? '#FF6B35' : '#E5E5EA',
                  background: reportType === type.id ? '#FFF0EB' : 'transparent',
                }}
                onClick={() => setReportType(type.id)}
              >
                <span className="text-sm">{type.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="input-group">
          <label>关联订单号（可选）</label>
          <input
            placeholder="请输入订单号"
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>问题描述 *</label>
          <textarea
            placeholder="请详细描述您遇到的问题，以便我们更好地处理..."
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <p className="text-xs text-tertiary text-right mt-1">
            {content.length}/500
          </p>
        </div>

        <div className="input-group">
          <label>联系方式（可选）</label>
          <input
            placeholder="手机号码"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <p className="text-xs text-tertiary mt-1">
            方便我们与您联系处理
          </p>
        </div>
      </div>

      <div className="card">
        <p className="text-sm text-secondary">客服热线</p>
        <p className="font-semibold text-orange text-lg mt-1">400-123-4567</p>
        <p className="text-xs text-tertiary mt-1">工作时间：9:00 - 21:00</p>
      </div>

      <div className="bottom-actions">
        <button className="btn btn-primary btn-full" onClick={handleSubmit}>
          提交
        </button>
      </div>
    </div>
  );
};

export default ReportPage;
