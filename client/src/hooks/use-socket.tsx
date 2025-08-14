import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketEvents {
  qr_code: (data: { instance: string; qrCode: string }) => void;
  connection_update: (data: { instance: string; status: string }) => void;
}

export function useSocket() {
  const socket = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to Socket.IO server
    socket.current = io(window.location.origin);

    socket.current.on('connect', () => {
      console.log('Connected to Socket.IO server');
    });

    socket.current.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
    });

    // Cleanup on unmount
    return () => {
      if (socket.current) {
        socket.current.disconnect();
        socket.current = null;
      }
    };
  }, []);

  const joinInstance = (instanceName: string) => {
    if (socket.current) {
      console.log(`Joining instance: ${instanceName}`);
      socket.current.emit('join-instance', instanceName);
    }
  };

  const on = <K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]) => {
    if (socket.current) {
      socket.current.on(event, callback);
    }
  };

  const off = <K extends keyof SocketEvents>(event: K, callback?: SocketEvents[K]) => {
    if (socket.current) {
      socket.current.off(event, callback);
    }
  };

  return {
    joinInstance,
    on,
    off,
    isConnected: socket.current?.connected || false
  };
}