import React, { useState, useEffect } from 'react';
import { usersAPI } from '../api';

function UserSelector({ currentUser, onUserChange }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data);
    } catch (error) {
      console.error('加载用户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const userId = e.target.value;
    if (userId) {
      const user = users.find(u => u.id === parseInt(userId));
      onUserChange(user);
    } else {
      onUserChange(null);
    }
  };

  if (loading) {
    return <div style={styles.loading}>加载中...</div>;
  }

  const currentUserData = users.find(u => u.id === currentUser?.id);

  return (
    <div style={styles.container}>
      <select
        value={currentUser?.id || ''}
        onChange={handleChange}
        style={styles.select}
      >
        <option value="">选择用户</option>
        {users.map(user => (
          <option key={user.id} value={user.id}>
            {user.username} ({user.role})
          </option>
        ))}
      </select>
      {currentUserData && (
        <div style={styles.roleInfo}>
          <span style={getRoleStyle(currentUserData.role)}>
            {getRoleLabel(currentUserData.role)}
          </span>
        </div>
      )}
    </div>
  );
}

const getRoleLabel = (role) => {
  const labels = {
    analyst: '业务分析师',
    processor: '处理人员',
    admin: '管理员',
  };
  return labels[role] || role;
};

const getRoleStyle = (role) => {
  const colors = {
    analyst: { backgroundColor: '#3498db', color: 'white' },
    processor: { backgroundColor: '#2ecc71', color: 'white' },
    admin: { backgroundColor: '#e74c3c', color: 'white' },
  };
  return {
    ...styles.roleBadge,
    ...colors[role],
  };
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  loading: {
    color: '#95a5a6',
  },
  select: {
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    border: '1px solid #bdc3c7',
    backgroundColor: 'white',
    fontSize: '0.9rem',
  },
  roleInfo: {
    marginLeft: '0.5rem',
  },
  roleBadge: {
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: '500',
  },
};

export default UserSelector;
