import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface DateDisplayProps {
  date: string;
  formatStr?: string;
}

export default function DateDisplay({ date, formatStr = 'yyyy-MM-dd HH:mm' }: DateDisplayProps) {
  try {
    return <span>{format(new Date(date), formatStr, { locale: zhCN })}</span>;
  } catch {
    return <span>{date}</span>;
  }
}
