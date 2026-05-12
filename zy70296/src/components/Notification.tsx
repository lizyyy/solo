import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

const Notification = ({ type, message }: NotificationProps) => {
  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-400" />,
    error: <XCircle className="h-5 w-5 text-red-400" />,
    warning: <AlertTriangle className="h-5 w-5 text-yellow-400" />,
    info: <Info className="h-5 w-5 text-blue-400" />
  };

  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200'
  };

  const textColors = {
    success: 'text-green-800',
    error: 'text-red-800',
    warning: 'text-yellow-800',
    info: 'text-blue-800'
  };

  return (
    <div className="fixed top-20 right-4 z-50 animate-pulse">
      <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg border shadow-lg ${bgColors[type]}`}>
        {icons[type]}
        <p className={`text-sm font-medium ${textColors[type]}`}>{message}</p>
      </div>
    </div>
  );
};

export default Notification;
