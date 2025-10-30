import React from 'react'

export const LogExecution = ({ logExecution }: { logExecution: string[] }) => {
    const [height, setHeight] = React.useState<number>(200)
    const [isResizing, setIsResizing] = React.useState<boolean>(false)
    const startYRef = React.useRef<number>(0)
    const startHeightRef = React.useRef<number>(0)
    const contentRef = React.useRef<HTMLDivElement | null>(null)

    // Auto-scroll to bottom on new logs
    React.useEffect(() => {
        const el = contentRef.current
        if (el) {
            el.scrollTop = el.scrollHeight
        }
    }, [logExecution])

    const onMouseDownResizer = (e: React.MouseEvent) => {
        setIsResizing(true)
        startYRef.current = e.clientY
        startHeightRef.current = height
        // Prevent text selection while resizing
        document.body.style.userSelect = 'none'
    }

    const onMouseMove = React.useCallback((e: MouseEvent) => {
        if (!isResizing) return
        const dy = startYRef.current - e.clientY
        const next = Math.max(120, Math.min(600, startHeightRef.current + dy))
        setHeight(next)
    }, [isResizing])

    const onMouseUp = React.useCallback(() => {
        if (!isResizing) return
        setIsResizing(false)
        document.body.style.userSelect = ''
    }, [isResizing])

    React.useEffect(() => {
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
        return () => {
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }
    }, [onMouseMove, onMouseUp])

    return (
        <div
            style={{
                position: 'absolute',
                left: 10,
                right: 10,
                bottom: 10,
                height,
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 50,
            }}
        >
            {/* Resizer bar at the top */}
            <div
                onMouseDown={onMouseDownResizer}
                style={{
                    height: 10,
                    cursor: 'ns-resize',
                    background: '#f3f4f6',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                title="Drag to resize"
            >
                <div style={{ width: 40, height: 3, borderRadius: 3, background: '#d1d5db' }} />
            </div>

            {/* Header */}
            <div style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, borderBottom: '1px solid #f3f4f6' }}>
                Log Execution
            </div>

            {/* Scrollable content */}
            <div
                ref={contentRef}
                style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: 10,
                    fontSize: 12,
                    lineHeight: '1.4',
                    whiteSpace: 'pre-wrap',
                    textAlign: 'left',
                    background: '#fafafa',
                }}
            >
                {logExecution?.map((line: string, index: number) => (
                    <div key={index}>{line}</div>
                ))}
            </div>
        </div>
    )
}