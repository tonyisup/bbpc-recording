import { describe, it } from 'vitest';
import { strict as assert } from 'assert';
import {
  applySessionSyncEvents,
  createInitialState,
  sessionReducer,
  syncEventToAction,
} from './session-state';
import type { SessionSyncEvent, Sounder } from '@/types';

const sounder: Sounder = {
  id: 's1',
  name: 'Intro Sting',
  category: 'Intros',
  duration: 1200,
  url: '/api/sounders/play?path=intro.mp3',
};

describe('session event replay', () => {
  it('rebuilds notes, cues, segments, sounders, and episode title from events', () => {
    const initial = createInitialState('EP-OLD', '2026-06-23', 'Harley');
    const events: SessionSyncEvent[] = [
      { kind: 'episode-update', episode: 'EP-NEW', from: 'host' },
      {
        kind: 'note',
        from: 'host',
        note: { id: 'n1', timestamp_ms: 1000, text: 'Fix cold open', author: 'Harley' },
      },
      {
        kind: 'edit-cue',
        from: 'host',
        cue: { id: 'c1', start_ms: 2000, end_ms: null, type: 'other', reason: 'tighten', author: 'Harley' },
      },
      { kind: 'edit-cue-update', id: 'c1', end_ms: 3000, from: 'host' },
      {
        kind: 'segment-start',
        from: 'host',
        segment: { id: 'seg1', start_ms: 4000, end_ms: null, type: 'segment', label: 'News' },
      },
      { kind: 'segment-end', id: 'seg1', end_ms: 9000, from: 'host' },
      {
        kind: 'sounder',
        sounder,
        played_at_ms: 5000,
        played_by: 'Tony',
        from: 'host',
      },
    ];

    const state = applySessionSyncEvents(initial, events);

    assert.equal(state.episode, 'EP-NEW');
    assert.equal(state.notes.length, 1);
    assert.equal(state.notes[0].text, 'Fix cold open');
    assert.equal(state.editCues[0].end_ms, 3000);
    assert.equal(state.segments[0].end_ms, 9000);
    assert.deepEqual(state.soundersUsed[0], {
      id: 's1',
      name: 'Intro Sting',
      played_at_ms: 5000,
      played_by: 'Tony',
    });
  });

  it('replays delete events', () => {
    const initial = createInitialState('EP', '2026-06-23', 'Harley');
    const state = applySessionSyncEvents(initial, [
      { kind: 'note', note: { id: 'n1', timestamp_ms: 1, text: 'remove me', author: 'Harley' } },
      { kind: 'note-delete', id: 'n1' },
      { kind: 'segment-start', segment: { id: 'seg1', start_ms: 1, end_ms: null, type: 'intro', label: 'Intro' } },
      { kind: 'segment-delete', id: 'seg1' },
      { kind: 'edit-cue', cue: { id: 'c1', start_ms: 1, end_ms: null, type: 'other', author: 'Harley' } },
      { kind: 'edit-cue-delete', id: 'c1' },
    ]);

    assert.equal(state.notes.length, 0);
    assert.equal(state.segments.length, 0);
    assert.equal(state.editCues.length, 0);
  });

  it('does not apply recording transport events to session state', () => {
    assert.equal(syncEventToAction({ kind: 'recording-started', startedAt: 123 }), null);
    assert.equal(syncEventToAction({ kind: 'recording-stopped', startedAt: 123, durationMs: 456 }), null);
  });

  it('preserves explicit sounder timestamps when reducing an action', () => {
    const initial = createInitialState('EP', '2026-06-23', 'Harley');
    const state = sessionReducer(initial, {
      type: 'TRIGGER_SOUNDER',
      sounder,
      played_at_ms: 12345,
      played_by: 'Tony',
    });

    assert.equal(state.soundersUsed[0].played_at_ms, 12345);
    assert.equal(state.soundersUsed[0].played_by, 'Tony');
  });
});

