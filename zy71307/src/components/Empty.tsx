import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const Empty: React.FC<EmptyProps> = ({ icon: Icon, title, description, action }) => {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center max-w-md">
        {Icon && (
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-industrial-800 border border-industrial-700 flex items-center justify-center">
            <Icon size={32} className="text-gray-500" />
          </div>
        )}
        <h3 className="text-lg font-display font-semibold text-gray-200 mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-gray-400 mb-6">{description}</p>
        )}
        {action && (
          <button
            onClick={action.onClick}
            className="px-6 py-2.5 bg-tech-500 hover:bg-tech-400 text-white rounded-lg transition-colors text-sm font-medium"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
};

export default Empty;
