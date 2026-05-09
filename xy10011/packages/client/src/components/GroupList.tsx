import { Group } from '../types';

interface Props {
  groups: Group[];
  selectedGroup: Group | null;
  onSelect: (group: Group) => void;
}

export function GroupList({ groups, selectedGroup, onSelect }: Props) {
  return (
    <div className="group-list">
      <h3>我的群组</h3>
      <ul>
        {groups.map((group) => (
          <li
            key={group.id}
            className={selectedGroup?.id === group.id ? 'active' : ''}
            onClick={() => onSelect(group)}
          >
            <div className="group-name">{group.name}</div>
            <div className="group-meta">
              {group.members.length} 人
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
