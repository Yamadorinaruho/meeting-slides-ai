import React from 'react';

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <title>Life AI Coach</title>
        <meta name="description" content="AIが全ての行動を記録して最適なアドバイス" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'sans-serif', background: '#f0f0f0' }}>
        {children}
      </body>
    </html>
  );
}