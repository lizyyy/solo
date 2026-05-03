import React from 'react';
import './variables.css';

const App: React.FC = () => {
  const containerStyle: React.CSSProperties = {
    padding: '24px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    color: '#1f2937',
    marginBottom: '16px',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  };

  const cardStyle: React.CSSProperties = {
    padding: '16px',
    backgroundColor: '#f3f4f6',
    marginTop: '20px',
  };

  return (
    <div style={containerStyle} className="p-6 bg-white rounded-lg">
      <h1 style={titleStyle} className="text-2xl font-bold text-gray-900">
        Token Drift Detector 示例
      </h1>
      
      <p className="text-gray-600 mb-4" style={{ fontSize: '16px' }}>
        这个示例项目包含一些故意的硬编码值，用于演示 token drift 检测。
      </p>

      <button 
        style={buttonStyle}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-md"
      >
        示例按钮
      </button>

      <div style={cardStyle} className="mt-5 p-4 bg-gray-100">
        <h2 style={{ color: '#6b7280', marginBottom: '8px' }} className="text-gray-500">
          示例卡片
        </h2>
        <p style={{ color: '#9ca3af' }} className="text-gray-400">
          这个卡片有一些硬编码的颜色值和间距。
        </p>
        <div style={{ marginTop: '12px' }}>
          <span style={{ color: '#22c55e' }}>成功状态</span>
          <span style={{ color: '#ef4444', marginLeft: '16px' }}>错误状态</span>
        </div>
      </div>

      <div className="mt-6">
        <span style={{ padding: '8px 16px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px' }}>
          警告标签
        </span>
      </div>

      <div className="invalid-token-test">
        <p style={{ color: 'var(--color-nonexistent)' }}>
          这个引用了一个不存在的 CSS 变量
        </p>
      </div>
    </div>
  );
};

export default App;
