import { Button, Dropdown, Tag } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { RecordStatus } from '../types';
import { STATUS_COLOR, STATUS_LABEL } from '../utils/cleaningLogic';

interface Props {
  value: RecordStatus;
  onChange: (status: RecordStatus) => void;
}

export default function StatusSwitcher({ value, onChange }: Props) {
  const items: { key: RecordStatus; label: string }[] = [
    { key: 'confirmed', label: '已确认' },
    { key: 'pending', label: '待补件' },
    { key: 'returned', label: '退回' }
  ];
  return (
    <Dropdown
      menu={{
        items,
        onClick: ({ key }) => onChange(key as RecordStatus),
        selectedKeys: [value]
      }}
    >
      <Button size="small">
        <Tag color={STATUS_COLOR[value]} style={{ margin: 0 }}>
          {STATUS_LABEL[value]}
        </Tag>
        <DownOutlined style={{ fontSize: 10, marginLeft: 6 }} />
      </Button>
    </Dropdown>
  );
}
