import { useState, useEffect } from 'react';
import { X, CheckCircle } from 'lucide-react';

interface Props {
  message: string;
  onClose: () => void;
}

export default function SuccessToast({ message, onClose }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className="bg-teal-50 border border-teal-200 rounded-lg shadow-lg p-4 max-w-md">
        <div className="flex items-start gap-3">
          <CheckCircle
            className="text-teal-500 flex-shrink-0 mt-0.5"
            size={20}
          />
          <div className="flex-1">
            <p className="text-teal-800 font-medium">操作成功</p>
            <p className="text-teal-600 text-sm mt-1">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="text-teal-400 hover:text-teal-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
