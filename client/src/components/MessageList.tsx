import { format } from 'date-fns';
import clsx from 'clsx';
import { Message } from '../types';

interface MessageListProps {
  messages: Message[];
  currentUserId: string | null;
}

function formatTimestamp(value: string) {
  try {
    return format(new Date(value), 'PP pp');
  } catch (error) {
    return value;
  }
}

export function MessageList({ messages, currentUserId }: MessageListProps) {
  return (
    <div className="message-list">
      {messages.map((message) => {
        const isSelf = currentUserId === message.author.id;
        return (
          <div
            key={message.id}
            className={clsx('message-list__item', {
              'message-list__item--self': isSelf,
              'message-list__item--system': message.system,
              'message-list__item--error': Boolean(message.error),
            })}
          >
            <div className="message-list__meta">
              <span
                className="message-list__author"
                style={{ color: message.system ? '#94a3b8' : message.author.color || '#38bdf8' }}
              >
                {message.author.name}
              </span>
              <span className="message-list__timestamp">{formatTimestamp(message.timestamp)}</span>
              <span className={clsx('message-list__transport', message.transport === 'p2p' ? 'message-list__transport--p2p' : 'message-list__transport--server')}>
                {message.transport === 'p2p' ? 'P2P' : 'Server'}
              </span>
              {message.pending && <span className="message-list__pending">sending…</span>}
              {message.error && <span className="message-list__error">{message.error}</span>}
            </div>
            <div className="message-list__content">{message.content}</div>
          </div>
        );
      })}
      {messages.length === 0 && <div className="message-list__empty">No messages yet. Say hello! 👋</div>}
    </div>
  );
}
