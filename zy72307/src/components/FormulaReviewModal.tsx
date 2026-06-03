import React, { useState } from 'react';

interface FormulaReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const FormulaReviewModal: React.FC<FormulaReviewModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm 
}) => {
  const [isReviewed, setIsReviewed] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (isReviewed) {
      onConfirm();
      setIsReviewed(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>步骤2：查看旧公式截图</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="formula-section">
            <h3>历史计算公式</h3>
            <div className="formula-screenshot-placeholder">
              <div className="screenshot-icon">📷</div>
              <p>旧公式截图展示区域</p>
              <p className="hint">（实际项目中此处显示上传的历史公式截图）</p>
            </div>
          </div>
          <div className="formula-details">
            <h4>权重计算公式说明：</h4>
            <ul>
              <li>矩阵条件数 = 最大特征值 / 最小特征值</li>
              <li>条件数阈值：30</li>
              <li>当条件数大于阈值时触发预警</li>
              <li>百分数自动转换为小数进行计算</li>
            </ul>
          </div>
          <div className="review-checkbox">
            <label>
              <input
                type="checkbox"
                checked={isReviewed}
                onChange={(e) => setIsReviewed(e.target.checked)}
              />
              我已查看并确认旧公式截图
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            取消
          </button>
          <button 
            className="btn-confirm"
            onClick={handleConfirm}
            disabled={!isReviewed}
          >
            确认并进入下一步
          </button>
        </div>
      </div>
    </div>
  );
};
