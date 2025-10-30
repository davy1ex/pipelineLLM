import React from 'react';

export const Header = ({
    handleStart,
    isRunning = false,
    onExport,
    onImport,
}: {
    handleStart: () => void;
    isRunning?: boolean;
    onExport?: () => void;
    onImport?: (file: File) => void;
}) => {
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    const triggerImport = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onImport) onImport(file);
        // reset value to allow re-selecting the same file
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <header style={{
            padding: '8px 16px',
            background: 'white',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
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

            <button
                onClick={onExport}
                style={{
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                }}
            >
                ⬇️ Export JSON
            </button>

            <button
                onClick={triggerImport}
                style={{
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                }}
            >
                ⬆️ Import JSON
            </button>

            <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
        </header>
    );
};