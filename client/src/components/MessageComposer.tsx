import { FormEvent, KeyboardEvent, useState } from 'react';

interface MessageComposerProps {
  disabled?: boolean;
  onSend: (content: string) => void;
  placeholder?: string;
  transportLabel: string;
}

export function MessageComposer({ disabled, onSend, placeholder, transportLabel }: MessageComposerProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const text = value.trim();
      if (!text || disabled) return;
      onSend(text);
      setValue('');
    }
  };

  return (
    <form className="message-composer" onSubmit={handleSubmit}>
      <textarea
        rows={3}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Message #channel'}
      />
      <div className="message-composer__actions">
        <span className="message-composer__transport-label">{transportLabel}</span>
        <button type="submit" disabled={disabled || !value.trim()}>
          Send
        </button>
      </div>
    </form>
  );
}
