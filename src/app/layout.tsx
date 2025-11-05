import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '🤖 Life AI Coach',
  description: 'あなたの生活を観察し、最適なアドバイスを提供',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
