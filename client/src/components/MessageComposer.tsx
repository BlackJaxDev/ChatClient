import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { nanoid } from 'nanoid';
import clsx from 'clsx';
import { uploadAttachment } from '../api';
import { MessageAttachment, MessageBlock } from '../types';
import { blocksToHtml, parseMarkdown } from '../utils/markdown';

const QUICK_EMOJIS = ['😀', '😂', '😍', '🎉', '🔥', '👍', '🙏', '💡', '🚀', '❤️'];

interface DraftAttachment extends MessageAttachment {
  clientId: string;
  uploading?: boolean;
  error?: string;
}

export interface ComposerPayload {
  content: string;
  blocks: MessageBlock[];
  attachments: MessageAttachment[];
  mentions: string[];
}

interface MessageComposerProps {
  disabled?: boolean;
  onSend: (payload: ComposerPayload) => void;
  placeholder?: string;
  transportLabel: string;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_\-]+)/g) || [];
  const unique = new Set(matches.map((match) => match.slice(1)));
  return Array.from(unique);
}

function formatFileSize(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

const TYPING_INACTIVITY_MS = 2500;

export function MessageComposer({
  disabled,
  onSend,
  placeholder,
  transportLabel,
  onTypingStart,
  onTypingStop,
}: MessageComposerProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActiveRef = useRef(false);

  const hasText = value.trim().length > 0;
  const hasAttachment = attachments.length > 0;
  const hasUploadInProgress = attachments.some((item) => item.uploading);
  const hasAttachmentError = attachments.some((item) => item.error);

  const previewBlocks = useMemo(() => parseMarkdown(value), [value]);

  const previewHtml = useMemo(() => {
    if (!hasText) {
      return '';
    }
    return blocksToHtml(previewBlocks);
  }, [hasText, previewBlocks]);

  const canSubmit = !disabled && !hasUploadInProgress && !hasAttachmentError && (hasText || hasAttachment);

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (typingActiveRef.current) {
      onTypingStop?.();
      typingActiveRef.current = false;
    }
  }, [onTypingStop]);

  const bumpTyping = useCallback(() => {
    if (!onTypingStart && !onTypingStop) {
      return;
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (!typingActiveRef.current) {
      onTypingStart?.();
      typingActiveRef.current = true;
    }
    typingTimerRef.current = setTimeout(() => {
      stopTyping();
    }, TYPING_INACTIVITY_MS);
  }, [onTypingStart, onTypingStop, stopTyping]);

  const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!canSubmit) return;
    const blocks = parseMarkdown(value);
    const mentions = extractMentions(value);
    const readyAttachments = attachments.filter((item) => !item.uploading && !item.error && item.id && !item.id.startsWith('pending-'));
    onSend({
      content: value.trim(),
      blocks,
      mentions,
      attachments: readyAttachments.map(({ clientId, uploading, error, ...rest }) => rest),
    });
    setValue('');
    setAttachments([]);
    setShowPreview(false);
    setShowEmojiPicker(false);
    stopTyping();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    } else if (value.trim()) {
      bumpTyping();
    }
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;
    for (const file of files) {
      const clientId = `pending-${nanoid()}`;
      const placeholder: DraftAttachment = {
        clientId,
        id: clientId,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        type: file.type.startsWith('image/') ? 'image' : 'file',
        url: '',
        uploading: true,
      };
      setAttachments((prev) => [...prev, placeholder]);
      try {
        const uploaded = await uploadAttachment(file);
        setAttachments((prev) =>
          prev.map((item) =>
            item.clientId === clientId ? { ...uploaded, clientId, uploading: false } : item
          )
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        setAttachments((prev) =>
          prev.map((item) =>
            item.clientId === clientId ? { ...item, uploading: false, error: message } : item
          )
        );
      }
    }
  };

  const handleRemoveAttachment = (clientId: string) => {
    setAttachments((prev) => prev.filter((item) => item.clientId !== clientId));
  };

  const handleInsertEmoji = (emoji: string) => {
    setValue((prev) => {
      const next = `${prev}${emoji}`;
      if (next.trim()) {
        bumpTyping();
      } else {
        stopTyping();
      }
      return next;
    });
    setShowEmojiPicker(false);
  };

  useEffect(() => {
    if (disabled) {
      stopTyping();
    }
  }, [disabled, stopTyping]);

  useEffect(() => () => stopTyping(), [stopTyping]);

  return (
    <form className={clsx('message-composer', { 'message-composer--preview': showPreview })} onSubmit={handleSubmit}>
      <div className="message-composer__editor">
        <textarea
          rows={3}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            const nextValue = event.target.value;
            setValue(nextValue);
            if (nextValue.trim()) {
              bumpTyping();
            } else {
              stopTyping();
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Message #channel'}
        />
        {showPreview && hasText && (
          <div className="message-composer__preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        )}
      </div>
      {attachments.length > 0 && (
        <div className="message-composer__attachments">
          {attachments.map((attachment) => (
            <div key={attachment.clientId} className="message-composer__attachment">
              <div className="message-composer__attachment-meta">
                <span className="message-composer__attachment-name">{attachment.name}</span>
                <span className="message-composer__attachment-size">{formatFileSize(attachment.size)}</span>
                {attachment.uploading && <span className="message-composer__attachment-status">Uploading…</span>}
                {attachment.error && <span className="message-composer__attachment-error">{attachment.error}</span>}
              </div>
              <button
                type="button"
                className="message-composer__attachment-remove"
                onClick={() => handleRemoveAttachment(attachment.clientId)}
                aria-label={`Remove attachment ${attachment.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="message-composer__actions">
        <div className="message-composer__toolbar">
          <label className="message-composer__action-button" htmlFor={fileInputId} title="Add attachment">
            📎
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              disabled={disabled}
            />
          </label>
          <div className="message-composer__emoji-picker">
            <button
              type="button"
              className="message-composer__action-button"
              onClick={() => setShowEmojiPicker((value) => !value)}
              disabled={disabled}
              aria-haspopup="true"
              aria-expanded={showEmojiPicker}
            >
              😊
            </button>
            {showEmojiPicker && (
              <div className="message-composer__emoji-popover">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleInsertEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className={clsx('message-composer__action-button', { 'message-composer__action-button--active': showPreview })}
            onClick={() => setShowPreview((value) => !value)}
            disabled={!hasText || disabled}
          >
            {showPreview ? 'Hide preview' : 'Preview'}
          </button>
        </div>
        <div className="message-composer__meta">
          <span className="message-composer__transport-label">{transportLabel}</span>
          <button type="submit" disabled={!canSubmit}>
            Send
          </button>
        </div>
      </div>
    </form>
  );
}
