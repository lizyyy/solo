import { NOTIFICATION_STATUS } from '../constants/status';
import { updateNotification, getNotificationById } from './storage';
import dayjs from 'dayjs';

export const sendNotification = async (notificationId) => {
  const notification = getNotificationById(notificationId);
  if (!notification) {
    throw new Error('通知记录不存在');
  }

  updateNotification(notificationId, {
    status: NOTIFICATION_STATUS.SENDING,
    lastSendTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  });

  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));

  const success = Math.random() > 0.3;
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  if (success) {
    updateNotification(notificationId, {
      status: NOTIFICATION_STATUS.SUCCESS,
      retryCount: notification.retryCount + 1,
      failureReason: null,
      lastSendTime: now,
    });
    return { success: true };
  } else {
    const failureReasons = [
      '短信接口调用失败：余额不足，请充值后重试',
      '用户手机号格式不正确',
      '网络连接超时，请稍后重试',
      '短信服务商服务异常',
    ];
    const failureReason = failureReasons[Math.floor(Math.random() * failureReasons.length)];

    updateNotification(notificationId, {
      status: NOTIFICATION_STATUS.FAILED,
      retryCount: notification.retryCount + 1,
      failureReason,
      lastSendTime: now,
    });
    return { success: false, failureReason };
  }
};

export const retryNotification = async (notificationId) => {
  return sendNotification(notificationId);
};
