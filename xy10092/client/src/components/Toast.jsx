import React from 'react';

function Toast({ message, type = 'info' }) {
  const typeClasses = {
    success: 'alert-success',
    error: 'alert-error',
    warning: 'alert-warning',
    info: 'alert-info'
  };

  return (
    <div className="toast">
      <div className={`alert ${typeClasses[type]}`}>
        {message}
      </div>
    </div>
  );
}

export default Toast;