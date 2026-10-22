import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PORChat — Chat, Play, Debate',
  description: 'Party chat with synchronous mini-games and big-screen TV Mode',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased min-h-screen bg-surface-light text-ink-main selection:bg-brand-primary selection:text-white">
        {children}
      </body>
    </html>
  );
}
