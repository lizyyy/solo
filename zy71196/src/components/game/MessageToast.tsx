import { useEffect, useState } from 'react';

interface MessageToastProps {
  message: string | null;
  onClose: () => void;
}

export function MessageToast({ message, onClose }: MessageToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }, 2700);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  const isError = message.includes('警告') || message.includes('不足') || message.includes('失败');
  const isSuccess = message.includes('成功') || message.includes('完成');

  let bgColor = 'bg-blue-600';
  if (isError) bgColor = 'bg-red-600';
  else if (isSuccess) bgColor = 'bg-green-600';

  return (
    <div
      className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div
        className={`${bgColor} text-white px-6 py-3 rounded-lg shadow-lg font-medium`}
      >
        {message}
      </div>
    </div>
  );
}
