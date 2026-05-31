import React from 'react';
import { Alert } from 'antd';
import { useAppStore } from '@/store';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

const NotificationBar: React.FC = () => {
  const { notification, hideNotification } = useAppStore();

  if (!notification || !notification.visible) return null;

  const iconMap = {
    success: <CheckCircleOutlined />,
    error: <CloseCircleOutlined />,
    warning: <WarningOutlined />,
    info: <InfoCircleOutlined />,
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-slideDown">
      <Alert
        type={notification.type}
        showIcon
        icon={iconMap[notification.type]}
        message={
          <div className="font-medium">{notification.message}</div>
        }
        description={
          notification.suggestion && (
            <div className="text-sm mt-1">
              <p>{notification.suggestion}</p>
              {notification.contact && (
                <p className="text-gray-500 mt-1">
                  联系人：{notification.contact}
                </p>
              )}
            </div>
          )
        }
        onClose={hideNotification}
        closable
        className="shadow-lg"
      />
    </div>
  );
};

export default NotificationBar;
