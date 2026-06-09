'use client';

import { createContext, useContext, useCallback, useRef } from 'react';

interface AudioManager {
  play: (url: string) => HTMLAudioElement;
  stopAll: () => void;
}

const AudioContext = createContext<AudioManager | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const activeRef = useRef<Set<HTMLAudioElement>>(new Set());

  const play = useCallback((url: string): HTMLAudioElement => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    activeRef.current.add(audio);

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
  }, []);

  const stopAll = useCallback(() => {
    for (const audio of activeRef.current) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load(); // forces release of audio resource
    }
    activeRef.current.clear();
  }, []);

  return (
    <AudioContext.Provider value={{ play, stopAll }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio(): AudioManager {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
}
