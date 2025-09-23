import { FormEvent, useEffect, useState } from 'react';

interface UserProfileModalProps {
  open: boolean;
  initialName: string;
  initialColor: string;
  initialAvatarUrl: string;
  onSave: (name: string, color: string, avatarUrl: string) => Promise<void> | void;
  onClose?: () => void;
  saving?: boolean;
}

export function UserProfileModal({
  open,
  initialName,
  initialColor,
  initialAvatarUrl,
  onSave,
  onClose,
  saving,
}: UserProfileModalProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    setColor(initialColor);
  }, [initialColor]);

  useEffect(() => {
    setAvatarUrl(initialAvatarUrl);
  }, [initialAvatarUrl]);

  const trimmedAvatar = avatarUrl.trim();
  const previewAvatarUrl = isValidHttpUrl(trimmedAvatar) ? trimmedAvatar : '';
  const previewInitials = initials(name || initialName);
  const avatarHint = trimmedAvatar && !previewAvatarUrl
    ? 'Enter a valid image URL starting with http:// or https://'
    : 'Leave empty to use your initials.';
  const avatarPreviewClassName = [
    'user-profile-modal__avatar-preview',
    previewAvatarUrl ? 'user-profile-modal__avatar-preview--image' : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');
  const avatarHintClassName = [
    'user-profile-modal__hint',
    trimmedAvatar && !previewAvatarUrl ? 'user-profile-modal__hint--warning' : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      setSubmitting(true);
      await onSave(trimmed, color, trimmedAvatar);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="user-profile-modal">
      <form className="user-profile-modal__content" onSubmit={handleSubmit}>
        <h2>Update your profile</h2>
        <p>Set how others will see you across servers.</p>
        <label>
          Display name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ada Lovelace" />
        </label>
        <label className="user-profile-modal__avatar">
          Avatar URL
          <div className="user-profile-modal__avatar-input">
            <div className={avatarPreviewClassName}>
              {previewAvatarUrl ? (
                <img src={previewAvatarUrl} alt="" />
              ) : (
                <span>{previewInitials}</span>
              )}
            </div>
            <input
              type="url"
              inputMode="url"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://example.com/avatar.png"
            />
          </div>
          <span className={avatarHintClassName}>
            {avatarHint}
          </span>
        </label>
        <label className="user-profile-modal__color">
          Accent color
          <div className="user-profile-modal__color-inputs">
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
            <button type="button" onClick={() => setColor(randomAccent())}>
              Randomize
            </button>
          </div>
        </label>
        {error && <div className="user-profile-modal__error">{error}</div>}
        <div className="user-profile-modal__actions">
          <button type="button" onClick={onClose} disabled={submitting || saving}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim() || submitting || saving}>
            {submitting || saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function randomAccent() {
  const palette = ['#A78BFA', '#38BDF8', '#F472B6', '#FBBF24', '#4ADE80', '#F87171'];
  return palette[Math.floor(Math.random() * palette.length)];
}

function initials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .padEnd(2, '∙');
}

function isValidHttpUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}
