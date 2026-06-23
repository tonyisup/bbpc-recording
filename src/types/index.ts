// --- Session Manifest Types ---

export interface Sounder {
  id: string;
  name: string;
  category: string;
  duration: number; // ms
  url: string;
}

export interface EditCue {
  id: string;
  start_ms: number;
  end_ms: number | null;
  type: 'doxx-bleep' | 'network-drop' | 'dmca-music' | 'spoiler' | 'other';
  reason?: string;
  author?: string;
}

export interface SessionNote {
  id: string;
  timestamp_ms: number;
  text: string;
  author: string;
}

export interface Segment {
  id: string;
  start_ms: number;
  end_ms: number | null;
  type: 'intro' | 'segment' | 'ad' | 'outro' | 'news' | 'interview';
  label: string;
}

export interface SegmentTemplate {
  id: string;
  label: string;
  type: Segment['type'];
  introSounder?: string;
  outroSounder?: string;
  sortOrder?: number;
}

export interface Manifest {
  session_id?: string;
  episode: string;
  date: string;
  hosts: string[];
  recording_start: number | null;
  recording_end: number | null;
  manifest_version: '1.0';
  sounders_used: Array<{ id: string; name: string; played_at_ms: number; played_by: string }>;
  notes: SessionNote[];
  segments: Segment[];
  edit_cues: EditCue[];
}

// --- Session State (runtime, in-memory) ---

export interface SessionState {
  episode: string;
  date: string;
  hostName: string;
  recordingStart: number | null; // Date.now() when recording started, null if not started
  isRecording: boolean;
  sounders: Sounder[];
  soundersUsed: Manifest['sounders_used'];
  notes: SessionNote[];
  segments: Segment[];
  editCues: EditCue[];
}

export type SessionAction =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'TRIGGER_SOUNDER'; sounder: Sounder; played_at_ms?: number; played_by?: string }
  | { type: 'ADD_NOTE'; note: SessionNote }
  | { type: 'DELETE_NOTE'; id: string }
  | { type: 'START_SEGMENT'; segment: Segment }
  | { type: 'END_SEGMENT'; id: string; end_ms: number }
  | { type: 'ADD_EDIT_CUE'; cue: EditCue }
  | { type: 'UPDATE_EDIT_CUE'; id: string; end_ms: number }
  | { type: 'DELETE_EDIT_CUE'; id: string }
  | { type: 'DELETE_SEGMENT'; id: string }
  | { type: 'UPDATE_EPISODE'; episode: string }
  | { type: 'UPDATE_HOST_NAME'; hostName: string }
  | { type: 'RESET' }

// --- Realtime Session Event Types ---

export interface SessionSyncSounderEvent {
  kind: 'sounder';
  sounder: Sounder;
  played_at_ms: number;
  played_by: string;
  from?: string;
}

export interface SessionSyncNoteEvent {
  kind: 'note';
  note: SessionNote;
  from?: string;
}

export interface SessionSyncNoteDeleteEvent {
  kind: 'note-delete';
  id: string;
  from?: string;
}

export interface SessionSyncSegmentStartEvent {
  kind: 'segment-start';
  segment: Segment;
  from?: string;
}

export interface SessionSyncSegmentEndEvent {
  kind: 'segment-end';
  id: string;
  end_ms: number;
  from?: string;
}

export interface SessionSyncEditCueEvent {
  kind: 'edit-cue';
  cue: EditCue;
  from?: string;
}

export interface SessionSyncEditCueUpdateEvent {
  kind: 'edit-cue-update';
  id: string;
  end_ms: number;
  from?: string;
}

export interface SessionSyncEditCueDeleteEvent {
  kind: 'edit-cue-delete';
  id: string;
  from?: string;
}

export interface SessionSyncSegmentDeleteEvent {
  kind: 'segment-delete';
  id: string;
  from?: string;
}

export interface SessionSyncRecordingStartEvent {
  kind: 'recording-started';
  startedAt: number;
  from?: string;
}

export interface SessionSyncRecordingStopEvent {
  kind: 'recording-stopped';
  startedAt: number;
  durationMs: number;
  from?: string;
}

export interface SessionSyncEpisodeUpdateEvent {
  kind: 'episode-update';
  episode: string;
  from?: string;
}

// All events that affect session state
export type SessionSyncStateEvent =
  | SessionSyncSounderEvent
  | SessionSyncNoteEvent
  | SessionSyncNoteDeleteEvent
  | SessionSyncSegmentStartEvent
  | SessionSyncSegmentEndEvent
  | SessionSyncSegmentDeleteEvent
  | SessionSyncEpisodeUpdateEvent
  | SessionSyncEditCueEvent
  | SessionSyncEditCueUpdateEvent
  | SessionSyncEditCueDeleteEvent;

// All realtime events (session + recording sync)
export type SessionSyncEvent =
  | SessionSyncStateEvent
  | SessionSyncRecordingStartEvent
  | SessionSyncRecordingStopEvent;
