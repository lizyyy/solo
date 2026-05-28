import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '../lib/utils';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize?: number;
  total?: number;
  showPageSize?: boolean;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: {
    button: 'h-7 min-w-7 text-xs',
    icon: 'w-3.5 h-3.5',
    select: 'h-7 text-xs px-2',
  },
  md: {
    button: 'h-8 min-w-8 text-sm',
    icon: 'w-4 h-4',
    select: 'h-8 text-sm px-2',
  },
  lg: {
    button: 'h-10 min-w-10 text-base',
    icon: 'w-5 h-5',
    select: 'h-10 text-sm px-3',
  },
};

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize = 10,
  total,
  showPageSize = true,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  className,
  size = 'md',
}) => {
  const styles = sizeStyles[size];

  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = Number(e.target.value);
    onPageSizeChange?.(size);
    onPageChange(1);
  };

  if (totalPages <= 1 && !showPageSize) {
    return null;
  }

  return (
    <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-4 w-full', className)}>
      <div className="flex items-center gap-3 text-sm text-slate-600">
        {total !== undefined && (
          <span className="whitespace-nowrap">共 {total} 条</span>
        )}
        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span>每页</span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className={cn(
                'border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white',
                styles.select
              )}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>条</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={cn(
            'px-2 rounded-lg font-medium transition-colors flex items-center justify-center',
            styles.button,
            currentPage === 1
              ? 'text-slate-300 cursor-not-allowed'
              : 'text-slate-600 hover:bg-slate-100'
          )}
          aria-label="第一页"
        >
          <ChevronsLeft className={styles.icon} />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            'px-2 rounded-lg font-medium transition-colors flex items-center justify-center',
            styles.button,
            currentPage === 1
              ? 'text-slate-300 cursor-not-allowed'
              : 'text-slate-600 hover:bg-slate-100'
          )}
          aria-label="上一页"
        >
          <ChevronLeft className={styles.icon} />
        </button>

        {getPageNumbers().map((page, index) => (
          <React.Fragment key={index}>
            {page === '...' ? (
              <span className={cn('px-2 text-slate-400', styles.button, 'flex items-center justify-center')}>
                ...
              </span>
            ) : (
              <button
                onClick={() => onPageChange(page as number)}
                className={cn(
                  'px-2 rounded-lg font-medium transition-colors flex items-center justify-center',
                  styles.button,
                  currentPage === page
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {page}
              </button>
            )}
          </React.Fragment>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className={cn(
            'px-2 rounded-lg font-medium transition-colors flex items-center justify-center',
            styles.button,
            currentPage === totalPages || totalPages === 0
              ? 'text-slate-300 cursor-not-allowed'
              : 'text-slate-600 hover:bg-slate-100'
          )}
          aria-label="下一页"
        >
          <ChevronRight className={styles.icon} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages || totalPages === 0}
          className={cn(
            'px-2 rounded-lg font-medium transition-colors flex items-center justify-center',
            styles.button,
            currentPage === totalPages || totalPages === 0
              ? 'text-slate-300 cursor-not-allowed'
              : 'text-slate-600 hover:bg-slate-100'
          )}
          aria-label="最后一页"
        >
          <ChevronsRight className={styles.icon} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
