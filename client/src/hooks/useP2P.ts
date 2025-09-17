import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import { Socket } from 'socket.io-client';
import { Member, Message } from '../types';

interface PeerEntry {
  peer: SimplePeer.Instance;
  meta: Member;
  connected: boolean;
}

export interface PeerStatus {
  peerId: string;
  meta: Member;
  connected: boolean;
}

interface UseP2POptions {
  socket: Socket | null;
  enabled: boolean;
  serverId: string | null;
  channelId: string | null;
  currentUser: Member | null;
  onMessage: (message: Message) => void;
  resolvePeerMeta: (peerId: string) => Member | undefined;
}

const textDecoder = new TextDecoder();

export function useP2P({
  socket,
  enabled,
  serverId,
  channelId,
  currentUser,
  onMessage,
  resolvePeerMeta,
}: UseP2POptions) {
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const [peerStatuses, setPeerStatuses] = useState<PeerStatus[]>([]);

  const room = useMemo(() => {
    if (!serverId || !channelId) return null;
    return `${serverId}:${channelId}`;
  }, [serverId, channelId]);

  const updateStatuses = useCallback(() => {
    setPeerStatuses(
      Array.from(peersRef.current.entries()).map(([peerId, entry]) => ({
        peerId,
        meta: entry.meta,
        connected: entry.connected,
      }))
    );
  }, []);

  const destroyPeer = useCallback((peerId: string) => {
    const entry = peersRef.current.get(peerId);
    if (!entry) return;
    entry.peer.destroy();
    peersRef.current.delete(peerId);
    updateStatuses();
  }, [updateStatuses]);

  const ensureEntry = useCallback(
    (peerId: string, meta: Member | undefined, initiator: boolean) => {
      let entry = peersRef.current.get(peerId);
      if (entry) {
        if (meta) {
          entry.meta = { ...entry.meta, ...meta };
          updateStatuses();
        }
        return entry;
      }

      const peer = new SimplePeer({ initiator, trickle: true });
      entry = {
        peer,
        meta: meta || fallbackMeta(peerId),
        connected: false,
      };
      peersRef.current.set(peerId, entry);

      peer.on('signal', (data) => {
        if (!socket || !serverId || !channelId) return;
        socket.emit('p2p-signal', {
          target: peerId,
          data,
          serverId,
          channelId,
        });
      });

      peer.on('connect', () => {
        entry!.connected = true;
        updateStatuses();
      });

      const cleanup = () => {
        peersRef.current.delete(peerId);
        updateStatuses();
      };

      peer.on('close', cleanup);
      peer.on('error', cleanup);

      peer.on('data', (chunk) => {
        try {
          const text = typeof chunk === 'string' ? chunk : textDecoder.decode(chunk as Uint8Array);
          const payload = JSON.parse(text) as Message;
          onMessage(payload);
        } catch (error) {
          console.warn('Failed to parse peer message', error);
        }
      });

      updateStatuses();
      return entry;
    },
    [channelId, onMessage, serverId, socket, updateStatuses]
  );

  useEffect(() => {
    if (!socket || !room || !currentUser) {
      peersRef.current.forEach((entry) => entry.peer.destroy());
      peersRef.current.clear();
      updateStatuses();
      return;
    }

    const tearDownAll = () => {
      peersRef.current.forEach((entry, peerId) => {
        entry.peer.destroy();
        peersRef.current.delete(peerId);
      });
      updateStatuses();
    };

    if (!enabled) {
      socket.emit('p2p-teardown', { serverId, channelId });
      tearDownAll();
      return;
    }

    const handleInit = (payload: { room: string; peerId: string; peer: Member; initiator: boolean }) => {
      if (payload.room !== room) return;
      const entry = ensureEntry(payload.peerId, { ...payload.peer, socketId: payload.peerId }, payload.initiator);
      if (!entry.meta.socketId) {
        entry.meta.socketId = payload.peerId;
      }
    };

    const handleSignal = (payload: { from: string; data: SimplePeer.SignalData }) => {
      const meta = resolvePeerMeta(payload.from) || fallbackMeta(payload.from);
      const entry = ensureEntry(payload.from, { ...meta, socketId: payload.from }, false);
      entry.peer.signal(payload.data);
    };

    const handleTeardown = (payload: { peerId: string }) => {
      destroyPeer(payload.peerId);
    };

    socket.on('p2p-init', handleInit);
    socket.on('p2p-signal', handleSignal);
    socket.on('p2p-teardown', handleTeardown);

    socket.emit('p2p-ready', { serverId, channelId });

    return () => {
      socket.off('p2p-init', handleInit);
      socket.off('p2p-signal', handleSignal);
      socket.off('p2p-teardown', handleTeardown);
      socket.emit('p2p-teardown', { serverId, channelId });
      tearDownAll();
    };
  }, [channelId, currentUser, destroyPeer, enabled, ensureEntry, resolvePeerMeta, room, serverId, socket, updateStatuses]);

  const sendMessage = useCallback(
    (message: Message) => {
      if (!enabled) {
        return;
      }
      const payload = JSON.stringify(message);
      peersRef.current.forEach((entry) => {
        if (entry.connected) {
          try {
            entry.peer.send(payload);
          } catch (error) {
            console.warn('Failed to send message to peer', error);
          }
        }
      });
    },
    [enabled]
  );

  return {
    peers: peerStatuses,
    sendMessage,
    isActive: enabled && peerStatuses.some((status) => status.connected),
  };
}

function fallbackMeta(peerId: string): Member {
  return {
    socketId: peerId,
    userId: peerId,
    username: 'Peer',
    color: '#60a5fa',
  };
}
