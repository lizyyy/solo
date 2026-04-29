import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightContent?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ title, showBack = true, rightContent }) => {
  const navigate = useNavigate();

  return (
    <div className="header-with-back">
      {showBack && (
        <button className="back-btn" onClick={() => navigate(-1)}>
          ←
        </button>
      )}
      <h1>{title}</h1>
      {rightContent}
    </div>
  );
};

interface RatingProps {
  value: number;
  count?: number;
}

const Rating: React.FC<RatingProps> = ({ value, count }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span key={i} style={{ color: i <= value ? '#FF9500' : '#E5E5EA' }}>
        ★
      </span>
    );
  }

  return (
    <div className="rating">
      <span className="star">{stars}</span>
      <span className="value">{value.toFixed(1)}</span>
      {count !== undefined && <span className="count">({count}条评价)</span>}
    </div>
  );
};

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  unit?: string;
}

const Stepper: React.FC<StepperProps> = ({ value, min = 1, max = 99, onChange, unit }) => {
  return (
    <div className="stepper">
      <button
        onClick={() => value > min && onChange(value - 1)}
        disabled={value <= min}
      >
        −
      </button>
      <span className="value">
        {value}
        {unit}
      </span>
      <button
        onClick={() => value < max && onChange(value + 1)}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
};

interface EmptyStateProps {
  icon?: string;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon = '📭', title, desc, action }) => {
  return (
    <div className="empty-state">
      <span className="icon">{icon}</span>
      <p className="title">{title}</p>
      {desc && <p className="desc">{desc}</p>}
      {action}
    </div>
  );
};

interface LoadingProps {}

const Loading: React.FC<LoadingProps> = () => {
  return (
    <div className="loading">
      <div className="spinner"></div>
    </div>
  );
};

interface PriceBreakdownProps {
  items: { label: string; value: number }[];
  total: number;
}

const PriceBreakdown: React.FC<PriceBreakdownProps> = ({ items, total }) => {
  return (
    <div className="card">
      {items.map((item, index) => (
        <div key={index} className="price-row">
          <span className="label">{item.label}</span>
          <span className="value">
            {item.value >= 0 ? '+' : ''}
            ¥{item.value}
          </span>
        </div>
      ))}
      <div className="divider" />
      <div className="price-row total">
        <span className="label">合计</span>
        <span className="value">¥{total}</span>
      </div>
    </div>
  );
};

interface TagProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default';
  style?: React.CSSProperties;
  className?: string;
}

const Tag: React.FC<TagProps> = ({ children, variant = 'default', style, className = '' }) => {
  return (
    <span className={`tag tag-${variant} ${className}`.trim()} style={style}>
      {children}
    </span>
  );
};

export { Header, Rating, Stepper, EmptyState, Loading, PriceBreakdown, Tag };
