import { ServerSummary } from '../types';

interface ServerSidebarProps {
  servers: ServerSummary[];
  selectedServerId: string | null;
  onSelect: (serverId: string) => void;
  onCreateServer: () => void;
}

export function ServerSidebar({ servers, selectedServerId, onSelect, onCreateServer }: ServerSidebarProps) {
  return (
    <aside className="server-sidebar">
      <div className="server-sidebar__list">
        {servers.map((server) => (
          <button
            key={server.id}
            className={`server-sidebar__item${server.id === selectedServerId ? ' server-sidebar__item--active' : ''}`}
            style={{ backgroundColor: server.accentColor || '#5865F2' }}
            onClick={() => onSelect(server.id)}
            title={server.name}
          >
            {server.icon || server.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
      </div>
      <button className="server-sidebar__item server-sidebar__item--create" onClick={onCreateServer} title="Create server">
        +
      </button>
    </aside>
  );
}
