'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0, background: '#f3f4f6' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 360, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: 40, margin: 0 }}>😅</p>
          <h1 style={{ fontSize: 20, margin: '12px 0 8px' }}>Something went wrong</h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 20px' }}>
            Don&apos;t worry — your data is safe. Try reloading the page.
          </p>
          <button
            onClick={reset}
            style={{ background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 999, padding: '10px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', width: '100%' }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
