import { format } from 'date-fns';
import clsx from 'clsx';
import { createElement, useEffect, useRef } from 'react';
import { Message, MessageAttachment, MessageBlock } from '../types';
import { sanitizeInline } from '../utils/markdown';

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

function renderBlocks(blocks: MessageBlock[]) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return null;
  }
  return blocks.map((block, index) => {
    switch (block.type) {
      case 'heading': {
        const level = Math.min(6, Math.max(1, block.level));
        return createElement(`h${level}` as keyof JSX.IntrinsicElements, {
          key: `${block.type}-${index}`,
          dangerouslySetInnerHTML: { __html: sanitizeInline(block.text) },
        });
      }
      case 'paragraph':
        return <p key={`${block.type}-${index}`} dangerouslySetInnerHTML={{ __html: sanitizeInline(block.text) }} />;
      case 'code':
        return (
          <pre key={`${block.type}-${index}`}>
            <code>{block.text}</code>
          </pre>
        );
      case 'quote':
        return (
          <blockquote key={`${block.type}-${index}`}>
            <span dangerouslySetInnerHTML={{ __html: sanitizeInline(block.text) }} />
          </blockquote>
        );
      case 'list':
        if (block.style === 'number') {
          return (
            <ol key={`${block.type}-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`list-item-${itemIndex}`} dangerouslySetInnerHTML={{ __html: sanitizeInline(item) }} />
              ))}
            </ol>
          );
        }
        return (
          <ul key={`${block.type}-${index}`}>
            {block.items.map((item, itemIndex) => (
              <li key={`list-item-${itemIndex}`} dangerouslySetInnerHTML={{ __html: sanitizeInline(item) }} />
            ))}
          </ul>
        );
      default:
        return null;
    }
  });
}

function AttachmentPreview({ attachment }: { attachment: MessageAttachment }) {
  if (attachment.type === 'image') {
    return (
      <a className="message-list__attachment message-list__attachment--image" href={attachment.url} target="_blank" rel="noreferrer">
        <img src={attachment.url} alt={attachment.name} loading="lazy" />
      </a>
    );
  }
  return (
    <a className="message-list__attachment" href={attachment.url} target="_blank" rel="noreferrer" download={attachment.name}>
      <span className="message-list__attachment-icon">📎</span>
      <span className="message-list__attachment-name">{attachment.name}</span>
    </a>
  );
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
        const contentBlocks = renderBlocks(message.blocks);

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
              <div
                className={clsx('message-list__avatar', {
                  'message-list__avatar--image': Boolean(message.author.avatarUrl),
                })}
                style={message.author.avatarUrl ? undefined : { backgroundColor: avatarColor }}
                aria-hidden={true}
              >
                {message.author.avatarUrl ? (
                  <img src={message.author.avatarUrl} alt="" />
                ) : (
                  initials
                )}
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
                <div className="message-list__content">
                  {contentBlocks && contentBlocks.length > 0 ? (
                    contentBlocks
                  ) : message.content ? (
                    <p dangerouslySetInnerHTML={{ __html: sanitizeInline(message.content) }} />
                  ) : null}
                </div>
                {message.attachments && message.attachments.length > 0 && (
                  <div className="message-list__attachments">
                    {message.attachments.map((attachment) => (
                      <AttachmentPreview key={attachment.id} attachment={attachment} />
                    ))}
                  </div>
                )}
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
