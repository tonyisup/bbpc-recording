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