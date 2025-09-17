import { FormEvent, useEffect, useState } from 'react';

interface UserProfileModalProps {
  open: boolean;
  initialName: string;
  initialColor: string;
  onSave: (name: string, color: string) => Promise<void> | void;
  onClose?: () => void;
  saving?: boolean;
}

export function UserProfileModal({ open, initialName, initialColor, onSave, onClose, saving }: UserProfileModalProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    setColor(initialColor);
  }, [initialColor]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      setSubmitting(true);
      await onSave(trimmed, color);
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
