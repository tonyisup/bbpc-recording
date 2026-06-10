'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from './SessionProvider';
import { useAudio } from './AudioProvider';
import { usePresence } from '@/hooks/usePresence';
import type { Sounder as SounderItem } from '@/types';

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
  const { state, dispatch } = useSession();
  const { play } = useAudio();
  const { members, connected } = usePresence({
    channelName: state.episode.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    hostName: state.hostName,
  });
  const [favorites, setFavorites] = useState<SounderItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage after mount (SSR-safe)
  useEffect(() => {
    setFavorites(loadFavorites());
    setHydrated(true);
  }, []);

  // Persist on change (skip initial empty state before hydration)
  useEffect(() => {
    if (!hydrated) return;
    saveFavorites(favorites);
  }, [favorites, hydrated]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // --- Play ---
  const handleTrigger = useCallback((s: SounderItem) => {
    if (editMode) return;
    setPlayingId(s.id);
    const audio = play(s.url);
    audio.addEventListener('ended', () => { setPlayingId(null); });
    dispatch({ type: 'TRIGGER_SOUNDER', sounder: { id: s.id, name: s.name, category: s.category, duration: s.duration, url: s.url } });
  }, [dispatch, editMode, play]);

  // --- Remove ---
  const handleRemove = useCallback((id: string) => {
    setFavorites(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleClear = useCallback(() => { setFavorites([]); }, []);

  // --- Rename ---
  const startRename = useCallback((s: SounderItem) => {
    setRenamingId(s.id);
    setRenameText(s.name);
  }, []);

  const commitRename = useCallback(() => {
    if (!renamingId) return;
    const trimmed = renameText.trim();
    if (trimmed) {
      setFavorites(prev => prev.map(f => f.id === renamingId ? { ...f, name: trimmed } : f));
    }
    setRenamingId(null);
    setRenameText('');
  }, [renamingId, renameText]);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameText('');
  }, []);

  // --- Reorder (drag within grid) ---
  const handlePadDragStart = useCallback((idx: number) => (e: React.DragEvent) => {
    if (!editMode) return;
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
    setDragIdx(idx);
  }, [editMode]);

  const handlePadDragOver = useCallback((idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx !== null && idx !== dragIdx) {
      setDropIdx(idx);
    }
  }, [dragIdx]);

  const handlePadDrop = useCallback((targetIdx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(sourceIdx) || sourceIdx === targetIdx) return;
    setFavorites(prev => {
      const next = [...prev];
      const [moved] = next.splice(sourceIdx, 1);
      next.splice(targetIdx > sourceIdx ? targetIdx - 1 : targetIdx, 0, moved);
      return next;
    });
    setDragIdx(null);
    setDropIdx(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDropIdx(null);
  }, []);

  // --- Drop from external (Sounders tab) ---
  const handleSidebarDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }, []);

  const handleSidebarDragLeave = useCallback(() => { setDragOver(false); }, []);

  const handleSidebarDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as SounderItem;
      if (!data?.id) return;
      setFavorites(prev => {
        if (prev.some(f => f.id === data.id)) return prev;
        return [...prev, data];
      });
    } catch { /* ignore */ }
  }, []);

  return (
    <div
      className={`flex flex-col h-full transition-colors ${dragOver ? 'bg-[var(--accent)]/10' : ''}`}
      onDragOver={handleSidebarDragOver}
      onDragLeave={handleSidebarDragLeave}
      onDrop={handleSidebarDrop}
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
        <div className="flex items-center gap-1.5">
          {favorites.length > 0 && !editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="text-[10px] text-[var(--muted)] hover:text-[var(--accent)] transition-colors px-1.5 py-0.5 rounded border border-transparent hover:border-[var(--card-border)]"
              title="Rearrange, rename, and remove favorites"
            >
              Edit
            </button>
          )}
          {editMode && (
            <button
              onClick={() => { setEditMode(false); cancelRename(); }}
              className="text-[10px] text-[var(--accent)] hover:text-white transition-colors px-1.5 py-0.5 rounded border border-[var(--accent)]/50 hover:border-[var(--accent)] bg-[var(--accent)]/10"
            >
              Done
            </button>
          )}
          {favorites.length > 0 && !editMode && (
            <button
              onClick={handleClear}
              className="text-[10px] text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
              title="Remove all favorites"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Edit mode hint */}
      {editMode && favorites.length > 0 && (
        <div className="px-3 py-1.5 bg-[var(--accent)]/5 border-b border-[var(--card-border)]">
          <p className="text-[10px] text-[var(--muted)]">
            Drag to reorder · Tap name to rename · ✕ to remove
          </p>
        </div>
      )}

      {/* Empty state */}
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
            {favorites.map((s, idx) => (
              <div
                key={s.id}
                draggable={editMode}
                onDragStart={handlePadDragStart(idx)}
                onDragOver={handlePadDragOver(idx)}
                onDrop={handlePadDrop(idx)}
                onDragEnd={handleDragEnd}
                className={`relative group rounded-lg transition-all ${
                  editMode && dropIdx === idx && dragIdx !== idx
                    ? 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--card-bg)]'
                    : ''
                } ${editMode && dragIdx === idx ? 'opacity-40' : ''}`}
              >
                {/* Playing indicator */}
                {playingId === s.id && (
                  <div className="absolute inset-0 rounded-lg border border-[var(--accent)] bg-[var(--accent)]/20 z-10 pointer-events-none" />
                )}

                {/* Edit overlay: remove button */}
                {editMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(s.id); }}
                    className="absolute -top-1 -right-1 z-20 w-5 h-5 rounded-full bg-[var(--danger)] text-white text-[10px] font-bold flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                  >
                    ✕
                  </button>
                )}

                {/* Pad content */}
                {renamingId === s.id ? (
                  <input
                    ref={renameInputRef}
                    value={renameText}
                    onChange={e => setRenameText(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') cancelRename(); }}
                    onClick={e => e.stopPropagation()}
                    className="w-full px-2 py-1.5 text-xs font-medium rounded-lg border border-[var(--accent)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none text-left"
                  />
                ) : (
                  <button
                    onClick={() => { if (editMode) return; handleTrigger(s); }}
                    onDoubleClick={() => { if (editMode) startRename(s); }}
                    title={editMode ? 'Drag to reorder, double-click to rename' : s.name}
                    className={`w-full px-2 py-2 text-xs font-medium rounded-lg border transition-all text-left select-none ${
                      editMode
                        ? 'border-[var(--card-border)] bg-[var(--card-bg)] cursor-grab active:cursor-grabbing'
                        : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--accent)]/50 cursor-pointer'
                    }`}
                  >
                    <span className="block truncate leading-tight">{s.name}</span>
                    {!editMode && (
                      <span className="block text-[10px] text-[var(--muted)] mt-0.5">
                        {(s.duration / 1000).toFixed(1)}s
                      </span>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection Info Panel */}
      <div className="border-t border-[var(--card-border)] mt-auto shrink-0">
        <div className="flex items-center justify-between px-3 py-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Online
          </h3>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} />
        </div>
        <div className="px-3 pb-2 space-y-1">
          {members.length === 0 && (
            <p className="text-[10px] text-[var(--muted)]">No other hosts connected</p>
          )}
          {members.map(member => (
            <div key={member.id} className="flex items-center gap-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
              <span className="text-[var(--foreground)]">{member.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}