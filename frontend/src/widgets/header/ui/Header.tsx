export const Header = ({
    handleStart,
    isRunning = false,
}: {
    handleStart: () => void;
    isRunning?: boolean;
}) => {
    return (
        <header style={{
            padding: '8px 16px',
            background: 'white',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            zIndex: 1000,
        }}>
            <button
                onClick={handleStart}
                disabled={isRunning}
                style={{
                    padding: '6px 12px',
                    fontSize: 14,
                    fontWeight: 600,
                    background: isRunning ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                }}
            >
                {isRunning ? '⏳ Running...' : '▶️ Run'}
            </button>
        </header>
    );
};