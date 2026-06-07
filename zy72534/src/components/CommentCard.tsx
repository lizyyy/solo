import { User, MessageSquare } from 'lucide-react';
import { Comment } from '../types';
import { formatDate } from '../utils/formatters';

const authorColors: Record<Comment['author'], string> = {
  '小孟': 'bg-emerald-100 text-emerald-800',
  '标注员': 'bg-amber-100 text-amber-800',
  '运营复核': 'bg-sky-100 text-sky-800',
};

export function CommentCard({ comment }: { comment: Comment }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${authorColors[comment.author]}`}>
          <MessageSquare className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${authorColors[comment.author]}`}>
              {comment.author}
            </span>
            <span className="text-xs text-slate-400">{formatDate(comment.timestamp)}</span>
          </div>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed">{comment.content}</p>
        </div>
      </div>
    </div>
  );
}
