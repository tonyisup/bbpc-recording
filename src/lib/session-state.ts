import type { Manifest, SessionAction, SessionState, SessionSyncEvent, Sounder } from '@/types';

export function createInitialState(
  episode: string,
  date: string,
  hostName: string,
  sounders: Sounder[] = [],
): SessionState {
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

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'START_RECORDING':
      return { ...state, isRecording: true, recordingStart: Date.now() };

    case 'STOP_RECORDING':
      return { ...state, isRecording: false };

    case 'TRIGGER_SOUNDER': {
      const playedAt = action.played_at_ms ?? (state.recordingStart != null ? Date.now() - state.recordingStart : 0);
      return {
        ...state,
        soundersUsed: [
          ...state.soundersUsed,
          {
            id: action.sounder.id,
            name: action.sounder.name,
            played_at_ms: playedAt,
            played_by: action.played_by ?? state.hostName,
          },
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
      return {
        ...state,
        segments: state.segments.map(seg => (
          seg.id === action.id ? { ...seg, end_ms: action.end_ms } : seg
        )),
      };

    case 'ADD_EDIT_CUE':
      return { ...state, editCues: [...state.editCues, action.cue] };

    case 'UPDATE_EDIT_CUE':
      return {
        ...state,
        editCues: state.editCues.map(cue => (
          cue.id === action.id ? { ...cue, end_ms: action.end_ms } : cue
        )),
      };

    case 'DELETE_EDIT_CUE':
      return { ...state, editCues: state.editCues.filter(c => c.id !== action.id) };

    case 'DELETE_SEGMENT':
      return { ...state, segments: state.segments.filter(seg => seg.id !== action.id) };

    case 'UPDATE_EPISODE':
      return { ...state, episode: action.episode };

    case 'UPDATE_HOST_NAME':
      return { ...state, hostName: action.hostName };

    case 'RESET':
      return { ...createInitialState(state.episode, state.date, state.hostName, state.sounders) };

    default:
      return state;
  }
}

export function actionToSyncEvent(
  action: SessionAction,
  hostName: string,
  recordingStart: number | null,
  clientEventSourceId: string,
): SessionSyncEvent | null {
  switch (action.type) {
    case 'TRIGGER_SOUNDER': {
      const playedAt = recordingStart != null ? Date.now() - recordingStart : 0;
      return {
        kind: 'sounder',
        sounder: action.sounder,
        played_at_ms: playedAt,
        played_by: hostName,
        from: clientEventSourceId,
      };
    }
    case 'ADD_NOTE':
      return { kind: 'note', note: action.note, from: clientEventSourceId };
    case 'DELETE_NOTE':
      return { kind: 'note-delete', id: action.id, from: clientEventSourceId };
    case 'START_SEGMENT':
      return { kind: 'segment-start', segment: action.segment, from: clientEventSourceId };
    case 'END_SEGMENT':
      return { kind: 'segment-end', id: action.id, end_ms: action.end_ms, from: clientEventSourceId };
    case 'DELETE_SEGMENT':
      return { kind: 'segment-delete', id: action.id, from: clientEventSourceId };
    case 'UPDATE_EPISODE':
      return { kind: 'episode-update', episode: action.episode, from: clientEventSourceId };
    case 'ADD_EDIT_CUE':
      return { kind: 'edit-cue', cue: action.cue, from: clientEventSourceId };
    case 'UPDATE_EDIT_CUE':
      return { kind: 'edit-cue-update', id: action.id, end_ms: action.end_ms, from: clientEventSourceId };
    case 'DELETE_EDIT_CUE':
      return { kind: 'edit-cue-delete', id: action.id, from: clientEventSourceId };
    default:
      return null;
  }
}

export function syncEventToAction(event: SessionSyncEvent): SessionAction | null {
  switch (event.kind) {
    case 'sounder':
      return {
        type: 'TRIGGER_SOUNDER',
        sounder: event.sounder,
        played_at_ms: event.played_at_ms,
        played_by: event.played_by,
      };
    case 'note':
      return { type: 'ADD_NOTE', note: event.note };
    case 'note-delete':
      return { type: 'DELETE_NOTE', id: event.id };
    case 'segment-start':
      return { type: 'START_SEGMENT', segment: event.segment };
    case 'segment-end':
      return { type: 'END_SEGMENT', id: event.id, end_ms: event.end_ms };
    case 'segment-delete':
      return { type: 'DELETE_SEGMENT', id: event.id };
    case 'episode-update':
      return { type: 'UPDATE_EPISODE', episode: event.episode };
    case 'edit-cue':
      return { type: 'ADD_EDIT_CUE', cue: event.cue };
    case 'edit-cue-update':
      return { type: 'UPDATE_EDIT_CUE', id: event.id, end_ms: event.end_ms };
    case 'edit-cue-delete':
      return { type: 'DELETE_EDIT_CUE', id: event.id };
    default:
      return null;
  }
}

export function applySessionSyncEvents(
  initialState: SessionState,
  events: SessionSyncEvent[],
): SessionState {
  return events.reduce((state, event) => {
    const action = syncEventToAction(event);
    return action ? sessionReducer(state, action) : state;
  }, initialState);
}

export function sessionStateToManifest(
  state: SessionState,
  sessionId: string,
  elapsedMs: number,
): Manifest {
  return {
    episode: state.episode,
    date: state.date,
    hosts: [state.hostName],
    session_id: sessionId,
    recording_start: state.recordingStart,
    recording_end: state.isRecording ? null : (state.recordingStart ?? 0) + elapsedMs,
    manifest_version: '1.0',
    sounders_used: state.soundersUsed,
    notes: state.notes,
    segments: state.segments,
    edit_cues: state.editCues,
  };
}

