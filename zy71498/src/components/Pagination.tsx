import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  const getPages = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }

    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={cn(
          'p-2 rounded-lg transition-all duration-150',
          currentPage === 1
            ? 'text-deep-blue-500 cursor-not-allowed'
            : 'text-deep-blue-300 hover:bg-deep-blue-600/50 hover:text-white'
        )}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {getPages().map((page, index) => (
        <button
          key={index}
          onClick={() => typeof page === 'number' && onPageChange(page)}
          disabled={page === '...'}
          className={cn(
            'min-w-[40px] h-10 px-3 rounded-lg font-medium transition-all duration-150',
            page === currentPage
              ? 'bg-neon-purple-600 text-white shadow-glow-purple'
              : page === '...'
              ? 'text-deep-blue-400 cursor-default'
              : 'text-deep-blue-300 hover:bg-deep-blue-600/50 hover:text-white'
          )}
        >
          {page}
        </button>
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={cn(
          'p-2 rounded-lg transition-all duration-150',
          currentPage === totalPages
            ? 'text-deep-blue-500 cursor-not-allowed'
            : 'text-deep-blue-300 hover:bg-deep-blue-600/50 hover:text-white'
        )}
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
