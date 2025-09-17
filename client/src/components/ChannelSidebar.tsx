import { ChannelSummary, ServerSummary } from '../types';

interface ChannelSidebarProps {
  server: ServerSummary | null;
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onCreateChannel: () => void;
}

export function ChannelSidebar({ server, selectedChannelId, onSelectChannel, onCreateChannel }: ChannelSidebarProps) {
  return (
    <aside className="channel-sidebar">
      <div className="channel-sidebar__header">
        <h2>{server?.name ?? 'Select a server'}</h2>
        <button onClick={onCreateChannel} title="Create channel">
          +
        </button>
      </div>
      {server?.description && <p className="channel-sidebar__description">{server.description}</p>}
      <nav className="channel-sidebar__list">
        {server?.channels.map((channel: ChannelSummary) => {
          const isActive = channel.id === selectedChannelId;
          return (
            <button
              key={channel.id}
              className={`channel-sidebar__item${isActive ? ' channel-sidebar__item--active' : ''}`}
              onClick={() => onSelectChannel(channel.id)}
            >
              <span>#</span>
              <div className="channel-sidebar__item-text">
                <strong>{channel.name}</strong>
                {channel.topic && <small>{channel.topic}</small>}
              </div>
            </button>
          );
        })}
        {!server && <p className="channel-sidebar__empty">Join or create a server to see channels.</p>}
      </nav>
    </aside>
  );
}
