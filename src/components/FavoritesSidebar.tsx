'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from './SessionProvider';

interface SounderItem {
  id: string;
  name: string;
  category: string;
  url: string;
  duration: number;
}

const STORAGE_KEY = 'bbpc-sounders-favorites';

function loadFavorites(): SounderItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favs: SounderItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

export function FavoritesSidebar() {
  const { dispatch } = useSession();
  const [favorites, setFavorites] = useState<SounderItem[]>(loadFavorites);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Persist to localStorage on change
  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  const handleTrigger = useCallback((s: SounderItem) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = s.url;
    audioRef.current = audio;
    setPlayingId(s.id);
    audio.play().catch(() => {
      setPlayingId(null);
      audioRef.current = null;
    });
    audio.addEventListener('ended', () => {
      setPlayingId(null);
      audioRef.current = null;
    });
    dispatch({
      type: 'TRIGGER_SOUNDER',
      sounder: { id: s.id, name: s.name, category: s.category, duration: s.duration },
    });
  }, [dispatch]);

  const handleRemove = useCallback((id: string) => {
    setFavorites(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleClear = useCallback(() => {
    setFavorites([]);
  }, []);

  // Handle drop from drag source
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as SounderItem;
      if (!data || !data.id) return;
      setFavorites(prev => {
        if (prev.some(f => f.id === data.id)) return prev;
        return [...prev, data];
      });
    } catch {
      // ignore malformed drops
    }
  }, []);

  // Suppress unused variable warning
  void editing;
  void setEditing;

  return (
    <div
      className={`flex flex-col h-full transition-colors ${dragOver ? 'bg-[var(--accent)]/10' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--card-border)]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Favorites
          {favorites.length > 0 && (
            <span className="ml-1 text-[var(--accent)] font-normal normal-case">
              ({favorites.length})
            </span>
          )}
        </h2>
        {favorites.length > 0 && (
          <button
            onClick={handleClear}
            className="text-[10px] text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Drop zone hint when empty */}
      {favorites.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-2xl mb-2">🎵</div>
            <p className="text-xs text-[var(--muted)]">
              Drag sounders here from the Sounders tab to build your favorites.
            </p>
          </div>
        </div>
      )}

      {/* Favorites grid */}
      {favorites.length > 0 && (
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-2 gap-1.5">
            {favorites.map(s => (
              <div key={s.id} className="relative group">
                <button
                  onClick={() => handleTrigger(s)}
                  className={`w-full px-2 py-2 text-xs font-medium rounded-lg border transition-all text-left ${
                    playingId === s.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white'
                      : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--accent)]/50'
                  }`}
                >
                  <span className="block truncate leading-tight">{s.name}</span>
                  <span className="block text-[10px] text-[var(--muted)] mt-0.5">
                    {(s.duration / 1000).toFixed(1)}s
                  </span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(s.id); }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--danger)] text-white text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
