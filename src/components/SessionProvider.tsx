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
import { useSessionSync } from '@/hooks/useSessionSync';
import type { SessionState, SessionAction, Manifest, Sounder, SessionNote, Segment, EditCue, PusherSessionEvent } from '@/types';

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'START_RECORDING':
      return { ...state, isRecording: true, recordingStart: Date.now() };

    case 'STOP_RECORDING':
      return { ...state, isRecording: false };

    case 'TRIGGER_SOUNDER': {
      const playedAt = state.recordingStart != null ? Date.now() - state.recordingStart : 0;
      return {
        ...state,
        soundersUsed: [
          ...state.soundersUsed,
          { id: action.sounder.id, name: action.sounder.name, played_at_ms: playedAt, played_by: state.hostName },
        ],
      };
    }

    case 'ADD_NOTE':
      return { ...state, notes: [...state.notes, action.note] };

    case 'DELETE_NOTE':
      return { ...state, notes: state.notes.filter(n => n.id !== action.id) };

    case 'START_SEGMENT':
      return { ...state, segments: [...state.segments, action.segment] };

    case 'END_SEGMENT':
      return { ...state, segments: state.segments.map(seg => seg.id === action.id ? { ...seg, end_ms: action.end_ms } : seg) };

    case 'ADD_EDIT_CUE':
      return { ...state, editCues: [...state.editCues, action.cue] };

    case 'UPDATE_EDIT_CUE':
      return { ...state, editCues: state.editCues.map(cue => cue.id === action.id ? { ...cue, end_ms: action.end_ms } : cue) };

    case 'DELETE_EDIT_CUE':
      return { ...state, editCues: state.editCues.filter(c => c.id !== action.id) };

    case 'RESET':
      return { ...createInitialState(state.episode, state.date, state.hostName, state.sounders) };

    default:
      return state;
  }
}

function createInitialState(episode: string, date: string, hostName: string, sounders: Sounder[] = []): SessionState {
  return {
    episode,
    date,
    hostName,
    recordingStart: null,
    isRecording: false,
    sounders,
    soundersUsed: [],
    notes: [],
    segments: [],
    editCues: [],
  };
}

// ---------------------------------------------------------------------------
// Action → Pusher event mapping
// ---------------------------------------------------------------------------

function actionToPusherEvent(
  action: SessionAction,
  hostName: string,
  recordingStart: number | null,
): PusherSessionEvent | null {
  switch (action.type) {
    case 'TRIGGER_SOUNDER': {
      const playedAt = recordingStart != null ? Date.now() - recordingStart : 0;
      return { kind: 'sounder', sounder: action.sounder, played_at_ms: playedAt, played_by: hostName };
    }
    case 'ADD_NOTE':
      return { kind: 'note', note: action.note };
    case 'DELETE_NOTE':
      return { kind: 'note-delete', id: action.id };
    case 'START_SEGMENT':
      return { kind: 'segment-start', segment: action.segment };
    case 'END_SEGMENT':
      return { kind: 'segment-end', id: action.id, end_ms: action.end_ms };
    case 'ADD_EDIT_CUE':
      return { kind: 'edit-cue', cue: action.cue };
    case 'UPDATE_EDIT_CUE':
      return { kind: 'edit-cue-update', id: action.id, end_ms: action.end_ms };
    case 'DELETE_EDIT_CUE':
      return { kind: 'edit-cue-delete', id: action.id };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Pusher event → Action mapping (for remote events)
// ---------------------------------------------------------------------------

function pusherEventToAction(event: PusherSessionEvent): SessionAction {
  switch (event.kind) {
    case 'sounder':
      return { type: 'TRIGGER_SOUNDER', sounder: event.sounder };
    case 'note':
      return { type: 'ADD_NOTE', note: event.note };
    case 'note-delete':
      return { type: 'DELETE_NOTE', id: event.id };
    case 'segment-start':
      return { type: 'START_SEGMENT', segment: event.segment };
    case 'segment-end':
      return { type: 'END_SEGMENT', id: event.id, end_ms: event.end_ms };
    case 'edit-cue':
      return { type: 'ADD_EDIT_CUE', cue: event.cue };
    case 'edit-cue-update':
      return { type: 'UPDATE_EDIT_CUE', id: event.id, end_ms: event.end_ms };
    case 'edit-cue-delete':
      return { type: 'DELETE_EDIT_CUE', id: event.id };
  }
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
  channelName?: string;
  sounders?: Sounder[];
}

export function SessionProvider({
  children,
  episode = 'EP-NEW',
  date = new Date().toISOString().slice(0, 10),
  hostName = 'host',
  channelName,
  sounders = [],
}: SessionProviderProps) {
  const [state, rawDispatch] = useReducer(
    sessionReducer,
    null,
    () => createInitialState(episode, date, hostName, sounders)
  );

  // Elapsed timer
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

  // Pusher sync
  const channel = channelName ?? episode.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const handleRemoteEvent = useCallback((event: PusherSessionEvent) => {
    rawDispatch(pusherEventToAction(event));
  }, []);

  const { sendEvent } = useSessionSync({
    channelName: channel,
    hostName: state.hostName,
    onRemoteEvent: handleRemoteEvent,
  });

  // Wrapped dispatch: local + broadcast
  const dispatch = useCallback((action: SessionAction) => {
    rawDispatch(action);
    const event = actionToPusherEvent(action, state.hostName, state.recordingStart);
    if (event) sendEvent(event);
  }, [rawDispatch, sendEvent, state.hostName, state.recordingStart]);

  const toManifest = useCallback((): Manifest => ({
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
  }), [state, elapsedMs]);

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
