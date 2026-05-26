import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  actions
}) => {
  return (
    <div className={`bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-white">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};
