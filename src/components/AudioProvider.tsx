'use client';

import { createContext, useContext, useCallback, useRef } from 'react';

interface AudioManager {
  play: (url: string, options?: { record?: boolean }) => HTMLAudioElement;
  stopAll: () => void;
  setSounderDestination: (dest: MediaStreamAudioDestinationNode | null) => void;
}

const AudioContext = createContext<AudioManager | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const activeRef = useRef<Set<HTMLAudioElement>>(new Set());
  const sounderDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Ensure we have an AudioContext for createMediaElementSource
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const play = useCallback((url: string, options: { record?: boolean } = {}): HTMLAudioElement => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    activeRef.current.add(audio);

    // Route to sounder destination if recording
    if (sounderDestRef.current && options.record !== false) {
      try {
        const ctx = getAudioContext();
        const source = ctx.createMediaElementSource(audio);
        source.connect(sounderDestRef.current);
        source.connect(ctx.destination);
      } catch {
        // If already connected or CORS issue, just play normally
      }
    }

    audio.addEventListener('ended', () => {
      activeRef.current.delete(audio);
    });

    audio.addEventListener('error', () => {
      activeRef.current.delete(audio);
    });

    audio.play().catch(() => {
      activeRef.current.delete(audio);
    });

    return audio;
  }, [getAudioContext]);

  const stopAll = useCallback(() => {
    for (const audio of activeRef.current) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    activeRef.current.clear();
  }, []);

  const setSounderDestination = useCallback((dest: MediaStreamAudioDestinationNode | null) => {
    sounderDestRef.current = dest;
  }, []);

  return (
    <AudioContext.Provider value={{ play, stopAll, setSounderDestination }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio(): AudioManager {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
}
