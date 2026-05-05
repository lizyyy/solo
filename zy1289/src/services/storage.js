import { NOTIFICATION_STATUS } from '../constants/status';

const STORAGE_KEY = 'store_notifications';

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const getNotifications = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    return [];
  }
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveNotifications = (notifications) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
};

export const updateNotification = (id, updates) => {
  const notifications = getNotifications();
  const index = notifications.findIndex(n => n.id === id);
  if (index !== -1) {
    notifications[index] = { ...notifications[index], ...updates };
    saveNotifications(notifications);
    return notifications[index];
  }
  return null;
};

export const getNotificationById = (id) => {
  const notifications = getNotifications();
  return notifications.find(n => n.id === id);
};

export const initializeMockData = () => {
  const existing = getNotifications();
  if (existing.length > 0) {
    return existing;
  }

  const mockNotifications = [
    {
      id: generateId(),
      storeName: '上海陆家嘴店',
      customerName: '张三',
      phone: '138****1234',
      packageNo: 'PKG20260501001',
      createTime: '2026-05-01 10:30:00',
      status: NOTIFICATION_STATUS.PENDING,
      retryCount: 0,
      failureReason: null,
      lastSendTime: null,
    },
    {
      id: generateId(),
      storeName: '上海陆家嘴店',
      customerName: '李四',
      phone: '139****5678',
      packageNo: 'PKG20260501002',
      createTime: '2026-05-01 11:00:00',
      status: NOTIFICATION_STATUS.SUCCESS,
      retryCount: 0,
      failureReason: null,
      lastSendTime: '2026-05-02 09:00:00',
    },
    {
      id: generateId(),
      storeName: '北京朝阳店',
      customerName: '王五',
      phone: '137****9012',
      packageNo: 'PKG20260501003',
      createTime: '2026-05-01 14:00:00',
      status: NOTIFICATION_STATUS.FAILED,
      retryCount: 2,
      failureReason: '短信接口调用失败：余额不足，请充值后重试',
      lastSendTime: '2026-05-03 16:30:00',
    },
    {
      id: generateId(),
      storeName: '深圳南山店',
      customerName: '赵六',
      phone: '136****3456',
      packageNo: 'PKG20260501004',
      createTime: '2026-05-02 09:00:00',
      status: NOTIFICATION_STATUS.PENDING,
      retryCount: 0,
      failureReason: null,
      lastSendTime: null,
    },
    {
      id: generateId(),
      storeName: '北京朝阳店',
      customerName: '钱七',
      phone: '135****7890',
      packageNo: 'PKG20260502005',
      createTime: '2026-05-02 15:30:00',
      status: NOTIFICATION_STATUS.FAILED,
      retryCount: 1,
      failureReason: '用户手机号格式不正确',
      lastSendTime: '2026-05-04 10:00:00',
    },
    {
      id: generateId(),
      storeName: '深圳南山店',
      customerName: '孙八',
      phone: '134****1122',
      packageNo: 'PKG20260503006',
      createTime: '2026-05-03 10:00:00',
      status: NOTIFICATION_STATUS.SENDING,
      retryCount: 1,
      failureReason: null,
      lastSendTime: '2026-05-05 09:00:00',
    },
  ];

  saveNotifications(mockNotifications);
  return mockNotifications;
};

export const getStoreList = () => {
  const notifications = getNotifications();
  const stores = new Set(notifications.map(n => n.storeName));
  return Array.from(stores).sort();
};
