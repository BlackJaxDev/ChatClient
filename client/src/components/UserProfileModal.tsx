import { FormEvent, useEffect, useState } from 'react';

interface UserProfileModalProps {
  open: boolean;
  initialName: string;
  initialColor: string;
  onSave: (name: string, color: string) => void;
}

export function UserProfileModal({ open, initialName, initialColor, onSave }: UserProfileModalProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    setColor(initialColor);
  }, [initialColor]);

  if (!open) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, color);
  };

  return (
    <div className="user-profile-modal">
      <form className="user-profile-modal__content" onSubmit={handleSubmit}>
        <h2>Choose your display name</h2>
        <p>You can change this later from the settings menu.</p>
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
        <button type="submit" disabled={!name.trim()}>
          Join Chat
        </button>
      </form>
    </div>
  );
}

function randomAccent() {
  const palette = ['#A78BFA', '#38BDF8', '#F472B6', '#FBBF24', '#4ADE80', '#F87171'];
  return palette[Math.floor(Math.random() * palette.length)];
}
