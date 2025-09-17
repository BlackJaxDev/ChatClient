import { TransportMode } from '../types';

interface TransportToggleProps {
  mode: TransportMode;
  onChange: (mode: TransportMode) => void;
  disabled?: boolean;
}

export function TransportToggle({ mode, onChange, disabled }: TransportToggleProps) {
  return (
    <div className="transport-toggle">
      <button
        type="button"
        className={`transport-toggle__option${mode === 'server' ? ' transport-toggle__option--active' : ''}`}
        onClick={() => onChange('server')}
        disabled={disabled}
      >
        Server Relay
      </button>
      <button
        type="button"
        className={`transport-toggle__option${mode === 'p2p' ? ' transport-toggle__option--active' : ''}`}
        onClick={() => onChange('p2p')}
        disabled={disabled}
      >
        Peer to Peer
      </button>
    </div>
  );
}
