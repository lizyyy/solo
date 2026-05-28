import { AuditStatus, NodeStatus, RollbackStatus } from '../../../shared/types';

interface StatusBadgeProps {
  status: AuditStatus | NodeStatus | RollbackStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const getBadgeClass = () => {
    switch (status) {
      case 'normal':
      case 'ok':
      case 'completed':
        return 'tag-success';
      case 'pending':
        return 'tag-muted';
      case 'abnormal':
      case 'error':
        return 'tag-danger';
      case 'warning':
        return 'tag-warning';
      case 'resolved':
        return 'tag-info';
      default:
        return 'tag-muted';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'normal':
        return '审计通过';
      case 'pending':
        return '待审计';
      case 'abnormal':
        return '存在异常';
      case 'resolved':
        return '已处理';
      case 'ok':
        return '正常';
      case 'error':
        return '异常';
      case 'warning':
        return '警告';
      case 'completed':
        return '已完成';
      default:
        return status;
    }
  };

  return <span className={getBadgeClass()}>{getLabel()}</span>;
}
