import React from 'react';

function PermissionAlert({ message, type = 'warning' }) {
  const typeStyles = {
    warning: {
      backgroundColor: '#fff3cd',
      borderColor: '#ffc107',
      color: '#856404',
    },
    error: {
      backgroundColor: '#f8d7da',
      borderColor: '#dc3545',
      color: '#721c24',
    },
    info: {
      backgroundColor: '#d1ecf1',
      borderColor: '#17a2b8',
      color: '#0c5460',
    },
  };

  return (
    <div style={{ ...styles.alert, ...typeStyles[type] }}>
      <span style={styles.icon}>⚠️</span>
      <span>{message}</span>
    </div>
  );
}

const styles = {
  alert: {
    padding: '1rem',
    borderRadius: '4px',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  icon: {
    fontSize: '1.2rem',
  },
};

export default PermissionAlert;
