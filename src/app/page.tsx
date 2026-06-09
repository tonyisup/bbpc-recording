'use client';

import { useState } from 'react';
import { SessionProvider } from '@/components/SessionProvider';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SounderBoard } from '@/components/SounderBoard';
import { NotesPanel } from '@/components/NotesPanel';
import { EditCuePanel } from '@/components/EditCuePanel';
import { SegmentPanel } from '@/components/SegmentPanel';
import { ExportBar } from '@/components/ExportBar';
import { useSession } from '@/components/SessionProvider';

type Tab = 'sounders' | 'notes' | 'edit' | 'segments';

const TABS: { id: Tab; label: string }[] = [
  { id: 'sounders', label: 'Sounders' },
  { id: 'notes', label: 'Notes' },
  { id: 'edit', label: 'Edit Cues' },
  { id: 'segments', label: 'Segments' },
];

function DashboardContent() {
  const [activeTab, setActiveTab] = useState<Tab>('sounders');
  const { toManifest } = useSession();

  return (
    <div className="flex flex-col h-screen">
      <DashboardHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: Sounder board (always visible) */}
        <aside className="w-72 shrink-0 border-r border-[var(--card-border)] overflow-hidden flex flex-col lg:block hidden">
          <SounderBoard />
        </aside>

        {/* Main content area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <nav className="flex border-b border-[var(--card-border)] bg-[var(--card-bg)]">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-white border-b-2 border-[var(--accent)]'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'sounders' && (
              <div className="h-full overflow-y-auto lg:hidden">
                <SounderBoard />
              </div>
            )}
            {activeTab === 'sounders' && (
              <div className="hidden lg:flex h-full items-center justify-center text-[var(--muted)] text-sm">
                Sounder board is shown in the left sidebar on desktop.
              </div>
            )}
            {activeTab === 'notes' && <NotesPanel />}
            {activeTab === 'edit' && <EditCuePanel />}
            {activeTab === 'segments' && <SegmentPanel />}
          </div>
        </main>
      </div>

      {/* Export bar */}
      <ExportBar manifest={toManifest()} />
    </div>
  );
}

export default function Home() {
  return (
    <SessionProvider episode="EP-2026-06-09" hostName="tony" channelName="ep-2026-06-09">
      <DashboardContent />
    </SessionProvider>
  );
}
