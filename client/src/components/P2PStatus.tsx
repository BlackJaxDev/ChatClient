import { PeerStatus } from '../hooks/useP2P';

interface P2PStatusProps {
  peers: PeerStatus[];
  active: boolean;
}

export function P2PStatus({ peers, active }: P2PStatusProps) {
  if (!active) {
    return <div className="p2p-status p2p-status--inactive">Peer-to-peer disabled</div>;
  }

  const connected = peers.filter((peer) => peer.connected);

  if (peers.length === 0) {
    return <div className="p2p-status">Waiting for peers…</div>;
  }

  return (
    <div className="p2p-status">
      Connected to {connected.length} / {peers.length} peer{peers.length === 1 ? '' : 's'}
    </div>
  );
}
