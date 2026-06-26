export function LoadingSpinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="animate-spin"
      style={{ display: 'inline-block' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        color: '#6c757d',
        gap: '0.75rem',
      }}
    >
      <LoadingSpinner size={22} />
      <span style={{ fontSize: '0.9rem' }}>Carregando...</span>
    </div>
  );
}
