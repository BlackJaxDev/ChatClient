import { format } from 'date-fns';
import clsx from 'clsx';
import { useEffect, useRef } from 'react';
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousCount = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 160 ||
      messages.length < previousCount.current;
    previousCount.current = messages.length;
    if (isNearBottom) {
      requestAnimationFrame(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [messages]);

  return (
    <div className="message-list" ref={containerRef}>
      {messages.map((message) => {
        const isSelf = currentUserId === message.author.id;
        const isSystem = Boolean(message.system);
        const initials = createInitials(message.author.name);
        const avatarColor = isSystem ? '#1f2937' : message.author.color || '#4f46e5';

        return (
          <div
            key={message.id}
            className={clsx('message-list__item', {
              'message-list__item--self': isSelf,
              'message-list__item--system': isSystem,
              'message-list__item--error': Boolean(message.error),
            })}
          >
            {!isSystem && (
              <div className="message-list__avatar" style={{ backgroundColor: avatarColor }} aria-hidden={true}>
                {initials}
              </div>
            )}
            <div className="message-list__body">
              <div className="message-list__header">
                <span
                  className="message-list__author"
                  style={{ color: isSystem ? '#94a3b8' : message.author.color || 'var(--accent)' }}
                >
                  {message.author.name}
                </span>
                <span className="message-list__timestamp">{formatTimestamp(message.timestamp)}</span>
                <span
                  className={clsx(
                    'message-list__transport',
                    message.transport === 'p2p' ? 'message-list__transport--p2p' : 'message-list__transport--server'
                  )}
                >
                  {message.transport === 'p2p' ? 'P2P' : 'Server'}
                </span>
                {message.pending && <span className="message-list__pending">sending…</span>}
                {message.error && <span className="message-list__error">{message.error}</span>}
              </div>
              <div
                className={clsx('message-list__bubble', {
                  'message-list__bubble--self': isSelf,
                  'message-list__bubble--system': isSystem,
                  'message-list__bubble--error': Boolean(message.error),
                })}
              >
                <div className="message-list__content">{message.content}</div>
              </div>
            </div>
          </div>
        );
      })}
      {messages.length === 0 && <div className="message-list__empty">No messages yet. Say hello! 👋</div>}
    </div>
  );
}

function createInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .padEnd(2, '∙');
}
