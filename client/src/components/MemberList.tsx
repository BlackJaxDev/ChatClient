import { Member } from '../types';

interface MemberListProps {
  members: Member[];
  currentUserId: string | null;
}

export function MemberList({ members, currentUserId }: MemberListProps) {
  return (
    <aside className="member-list">
      <h3>Online — {members.length}</h3>
      <ul>
        {members.map((member) => (
          <li key={member.userId} className={member.userId === currentUserId ? 'member-list__item member-list__item--self' : 'member-list__item'}>
            <span className="member-list__indicator" style={{ backgroundColor: member.color }} />
            <span className="member-list__name">{member.username}</span>
          </li>
        ))}
        {members.length === 0 && <li className="member-list__empty">No one is online yet.</li>}
      </ul>
    </aside>
  );
}
