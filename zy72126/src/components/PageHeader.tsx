interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const PageHeader = ({ title, subtitle, action }: PageHeaderProps) => {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-olive-900 mb-2">{title}</h1>
        {subtitle && <p className="text-olive-600">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
