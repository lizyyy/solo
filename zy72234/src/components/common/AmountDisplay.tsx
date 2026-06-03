interface AmountDisplayProps {
  amount: number;
  prefix?: string;
  showSign?: boolean;
  className?: string;
}

export default function AmountDisplay({ amount, prefix = '¥', showSign = false, className = '' }: AmountDisplayProps) {
  const formatted = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  const sign = showSign ? (amount >= 0 ? '+' : '-') : '';
  const isZero = amount === 0;

  return (
    <span className={`font-mono ${isZero ? 'text-risk-red font-semibold' : 'text-carbon-800'} ${className}`}>
      {sign}{prefix}{formatted}
    </span>
  );
}
