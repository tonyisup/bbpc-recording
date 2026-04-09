import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Podcast Studio',
  description: 'Session dashboard for podcast recording coordination',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}