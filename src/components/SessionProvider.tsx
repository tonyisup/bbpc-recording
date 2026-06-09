'use client';

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { SessionState, SessionAction, Manifest, Sounder, SessionNote, Segment, EditCue } from '@/types';

// ---------------------------------------------------------------------------
// Initial sounder library
// ---------------------------------------------------------------------------

const DEFAULT_SOUNDERS: Sounder[] = [
  { id: 'theme-intro', name: 'Theme Song Intro', category: 'Show', duration: 15000 },
  { id: 'theme-outro', name: 'Theme Song Outro', category: 'Show', duration: 15000 },
  { id: 'laugh-01', name: 'Laugh 01', category: 'Reactions', duration: 2000 },
  { id: 'laugh-02', name: 'Laugh 02', category: 'Reactions', duration: 2000 },
  { id: 'applause', name: 'Applause', category: 'Reactions', duration: 3000 },
  { id: 'rimshot', name: 'Rimshot', category: 'Comedy', duration: 1500 },
  { id: 'wrong', name: 'Wah-wah-waaah', category: 'Comedy', duration: 2000 },
  { id: 'airhorn', name: 'Airhorn', category: 'Meme', duration: 2000 },
  { id: 'sadtrombone', name: 'Sad Trombone', category: 'Meme', duration: 2500 },
  { id: 'crickets', name: 'Crickets', category: 'Meme', duration: 3000 },
  { id: 'ding', name: 'Ding!', category: 'FX', duration: 500 },
  { id: 'whoosh', name: 'Whoosh', category: 'FX', duration: 800 },
];

const INITIAL_SOUNDERS = DEFAULT_SOUNDERS;

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'START_RECORDING':
      return {
        ...state,
        isRecording: true,
        recordingStart: Date.now(),
      };

    case 'STOP_RECORDING':
      return {
        ...state,
        isRecording: false,
      };

    case 'TRIGGER_SOUNDER': {
      const playedAt = state.recordingStart != null ? Date.now() - state.recordingStart : 0;
      return {
        ...state,
        sounders: state.sounders.map(s =>
          s.id === action.sounder.id ? { ...s, playing: true } : s
        ),
        soundersUsed: [
          ...state.soundersUsed,
          {
            id: action.sounder.id,
            name: action.sounder.name,
            played_at_ms: playedAt,
            played_by: state.hostName,
          },
        ],
      };
    }

    case 'ADD_NOTE':
      return {
        ...state,
        notes: [...state.notes, action.note],
      };

    case 'DELETE_NOTE':
      return {
        ...state,
        notes: state.notes.filter(n => n.id !== action.id),
      };

    case 'START_SEGMENT':
      return {
        ...state,
        segments: [...state.segments, action.segment],
      };

    case 'END_SEGMENT':
      return {
        ...state,
        segments: state.segments.map(seg =>
          seg.id === action.id ? { ...seg, end_ms: action.end_ms } : seg
        ),
      };

    case 'ADD_EDIT_CUE':
      return {
        ...state,
        editCues: [...state.editCues, action.cue],
      };

    case 'UPDATE_EDIT_CUE':
      return {
        ...state,
        editCues: state.editCues.map(cue =>
          cue.id === action.id ? { ...cue, end_ms: action.end_ms } : cue
        ),
      };

    case 'DELETE_EDIT_CUE':
      return {
        ...state,
        editCues: state.editCues.filter(c => c.id !== action.id),
      };

    case 'RESET':
      return createInitialState(state.episode, state.date, state.hostName);

    default:
      return state;
  }
}

function createInitialState(episode: string, date: string, hostName: string): SessionState {
  return {
    episode,
    date,
    hostName,
    recordingStart: null,
    isRecording: false,
    sounders: INITIAL_SOUNDERS,
    soundersUsed: [],
    notes: [],
    segments: [],
    editCues: [],
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SessionContextValue {
  state: SessionState;
  dispatch: React.Dispatch<SessionAction>;
  elapsedMs: number;
  toManifest: () => Manifest;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface SessionProviderProps {
  children: ReactNode;
  episode?: string;
  date?: string;
  hostName?: string;
}

export function SessionProvider({
  children,
  episode = 'EP-NEW',
  date = new Date().toISOString().slice(0, 10),
  hostName = 'host',
}: SessionProviderProps) {
  const [state, dispatch] = useReducer(
    sessionReducer,
    null,
    () => createInitialState(episode, date, hostName)
  );

  // Track elapsed time
  const [elapsedMs, setElapsedMs] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!state.isRecording || state.recordingStart === null) {
      setElapsedMs(0);
      return;
    }

    const tick = () => {
      setElapsedMs(Date.now() - state.recordingStart!);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [state.isRecording, state.recordingStart]);

  const toManifest = useCallback((): Manifest => {
    return {
      episode: state.episode,
      date: state.date,
      hosts: [state.hostName],
      recording_start: state.recordingStart,
      recording_end: state.isRecording ? null : (state.recordingStart ?? 0) + elapsedMs,
      manifest_version: '1.0',
      sounders_used: state.soundersUsed,
      notes: state.notes,
      segments: state.segments,
      edit_cues: state.editCues,
    };
  }, [state, elapsedMs]);

  return (
    <SessionContext.Provider value={{ state, dispatch, elapsedMs, toManifest }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
