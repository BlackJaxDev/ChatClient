import { Member } from '../types';

interface TypingIndicatorProps {
  typers: Member[];
}

function formatTypingMessage(typers: Member[]): string {
  const names = typers.map((member) => member.username || 'Someone');
  if (names.length === 0) {
    return '';
  }
  if (names.length === 1) {
    return `${names[0]} is typing…`;
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing…`;
  }
  const [first, second, third, ...rest] = names;
  if (names.length === 3) {
    return `${first}, ${second}, and ${third} are typing…`;
  }
  return `${first}, ${second}, and ${rest.length + 1} others are typing…`;
}

export function TypingIndicator({ typers }: TypingIndicatorProps) {
  if (!typers || typers.length === 0) {
    return null;
  }
  const message = formatTypingMessage(typers);
  return (
    <div className="typing-indicator" role="status" aria-live="polite">
      <span className="typing-indicator__text">{message}</span>
      <span className="typing-indicator__dots" aria-hidden="true">
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
      </span>
    </div>
  );
}

export default TypingIndicator;
