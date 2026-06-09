// --- Session Manifest Types ---

export interface Sounder {
  id: string;
  name: string;
  category: string;
  duration: number; // ms
  playing?: boolean;
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

export interface Manifest {
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
  | { type: 'TRIGGER_SOUNDER'; sounder: Sounder }
  | { type: 'ADD_NOTE'; note: SessionNote }
  | { type: 'DELETE_NOTE'; id: string }
  | { type: 'START_SEGMENT'; segment: Segment }
  | { type: 'END_SEGMENT'; id: string; end_ms: number }
  | { type: 'ADD_EDIT_CUE'; cue: EditCue }
  | { type: 'UPDATE_EDIT_CUE'; id: string; end_ms: number }
  | { type: 'DELETE_EDIT_CUE'; id: string }
  | { type: 'RESET' };

// --- Pusher Event Types ---

export interface PusherSounderEvent {
  kind: 'sounder';
  sounder: Sounder;
  played_at_ms: number;
  played_by: string;
}

export interface PusherNoteEvent {
  kind: 'note';
  note: SessionNote;
}

export interface PusherNoteDeleteEvent {
  kind: 'note-delete';
  id: string;
}

export interface PusherSegmentStartEvent {
  kind: 'segment-start';
  segment: Segment;
}

export interface PusherSegmentEndEvent {
  kind: 'segment-end';
  id: string;
  end_ms: number;
}

export interface PusherEditCueEvent {
  kind: 'edit-cue';
  cue: EditCue;
}

export interface PusherEditCueUpdateEvent {
  kind: 'edit-cue-update';
  id: string;
  end_ms: number;
}

export interface PusherEditCueDeleteEvent {
  kind: 'edit-cue-delete';
  id: string;
}

export type PusherSessionEvent =
  | PusherSounderEvent
  | PusherNoteEvent
  | PusherNoteDeleteEvent
  | PusherSegmentStartEvent
  | PusherSegmentEndEvent
  | PusherEditCueEvent
  | PusherEditCueUpdateEvent
  | PusherEditCueDeleteEvent;
