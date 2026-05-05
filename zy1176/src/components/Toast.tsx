import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
}

const Toast: React.FC<ToastProps> = ({ message, type }) => {
  const icons: Record<string, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  };

  return (
    <div className={`toast toast-${type}`}>
      <span style={{ marginRight: '8px' }}>{icons[type]}</span>
      {message}
    </div>
  );
};

export default Toast;
