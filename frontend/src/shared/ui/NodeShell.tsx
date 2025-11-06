import React, { useContext } from 'react'
import { useExecutionStore } from '../../features/workflow-execution/model/executionStore'
import { getDataTypeColor, getDataTypeConfig, type DataType } from '../lib/dataTypes'
import { Handle, type Position } from '@xyflow/react'
import { NodeActionsContext } from '../../features/canvas/ui/NodeActionsContext'
// Handles are not rendered here to avoid layout conflicts with ReactFlow absolute positioning.

type ConnectorConfig = {
  id?: string
  type: 'source' | 'target'
  position: Position
  label: string
  dataType?: DataType
  group?: string
}

type NodeShellProps = {
  nodeId?: string
  title: string
  headerActions?: React.ReactNode
  connectors?: ConnectorConfig[]
  connectorRowRefs?: {
    inputs?: Record<string, React.Ref<HTMLDivElement>>
    outputs?: Record<string, React.Ref<HTMLDivElement>>
  }
  controls?: Array<{
    key: string;
    label: string;
    fullValue?: string;
    connected?: boolean; // true -> connector priority, view-only
    // edit support when not connected
    editable?: boolean;
    value?: string;
    onChange?: (next: string) => void;
    placeholder?: string;
  }>
  children?: React.ReactNode
  width?: number
  height?: number
  defaultWidth?: number
  defaultHeight?: number
  outerRef?: React.Ref<HTMLDivElement>
  disableResize?: boolean // Disable NodeShell's built-in resize handles
}

export const NodeShell: React.FC<NodeShellProps> = ({
  nodeId,
  title,
  headerActions,
  connectors,
  connectorRowRefs,
  controls = [],
  children,
  width,
  height,
  defaultWidth = 500,
  defaultHeight,
  outerRef,
  disableResize = false,
}) => {
  const runningIds = useExecutionStore((s) => s.runningNodeIds)
  const completedIds = useExecutionStore((s) => s.completedNodeIds)
  const isRunning = nodeId ? runningIds.includes(nodeId) : false
  const isCompleted = nodeId ? completedIds.includes(nodeId) : false
  const borderColor = isRunning ? '#60a5fa' : isCompleted ? '#34d399' : '#e5e7eb'
  const glow = isRunning ? '0 0 0 2px rgba(59,130,246,0.15)' : '0 1px 3px rgba(0,0,0,0.06)'
  
  // Resize logic - safely get node actions context
  const nodeActionsContext = useContext(NodeActionsContext)
  const nodeActions = nodeActionsContext && nodeId ? nodeActionsContext : null
  
  // State only for resize drag, use props directly for display
  const [resizeWidth, setResizeWidth] = React.useState<number | null>(null)
  const [resizeHeight, setResizeHeight] = React.useState<number | null>(null)
  
  const displayWidth = resizeWidth ?? width ?? defaultWidth
  const displayHeight = resizeHeight ?? height ?? defaultHeight
  
  const resRef = React.useRef<{ 
    active: boolean
    mode: 'right' | 'bottom' | 'corner' | null
    sx: number
    sy: number
    sw: number
    sh: number
    finalW?: number
    finalH?: number
  }>({ 
    active: false, 
    mode: null, 
    sx: 0, 
    sy: 0, 
    sw: 0, 
    sh: 0 
  })
  
  const startResize = (e: React.MouseEvent, mode: 'right' | 'bottom' | 'corner') => {
    e.preventDefault()
    e.stopPropagation()
    // Get current dimensions from DOM or state
    const currentWidth = resizeWidth ?? width ?? defaultWidth
    const currentHeight = resizeHeight ?? height ?? defaultHeight ?? (outerRef && 'current' in outerRef && outerRef.current ? outerRef.current.offsetHeight : 200)
    resRef.current = { 
      active: true, 
      mode, 
      sx: e.clientX, 
      sy: e.clientY, 
      sw: currentWidth, 
      sh: currentHeight,
      finalW: undefined,
      finalH: undefined
    }
    document.body.style.userSelect = 'none'
  }
  
  React.useEffect(() => {
    if (!nodeActions) return
    
    const onMove = (e: MouseEvent) => {
      const r = resRef.current
      if (!r.active) return
      let w = r.sw
      let h = r.sh
      if (r.mode === 'right' || r.mode === 'corner') w = Math.max(240, r.sw + (e.clientX - r.sx))
      if (r.mode === 'bottom' || r.mode === 'corner') h = Math.max(100, r.sh + (e.clientY - r.sy))
      r.finalW = w
      r.finalH = h
      setResizeWidth(w)
      setResizeHeight(h)
    }
    
    const onUp = () => {
      const r = resRef.current
      if (!r.active) return
      const finalW = r.finalW ?? r.sw
      const finalH = r.finalH ?? r.sh
      r.active = false
      r.finalW = undefined
      r.finalH = undefined
      document.body.style.userSelect = ''
      if (nodeId && nodeActions) {
        nodeActions.updateNodeData(nodeId, { width: finalW, height: finalH })
        // Reset resize state after a small delay to allow node data update
        setTimeout(() => {
          setResizeWidth(null)
          setResizeHeight(null)
        }, 0)
      }
    }
    
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [nodeId, nodeActions])
  
  const containerStyle: React.CSSProperties = {
    width: `${displayWidth}px`,
    ...(typeof displayHeight === 'number' ? { height: `${displayHeight*2}px` } : {}),
    background: 'white',
    border: `1px solid ${borderColor}`,
    borderRadius: 8,
    boxShadow: glow,
    position: 'relative',
    boxSizing: 'border-box',
    overflow: 'hidden',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
  }
  
  return (
    <div
      className="node-shell"
      style={containerStyle}
      ref={outerRef as any}
    >
      {isRunning && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #93c5fd, #3b82f6, #93c5fd)', backgroundSize: '200% 100%', animation: 'node-run 1.2s linear infinite' }} />
      )}
      <style>{`@keyframes node-run{0%{background-position:0% 0}100%{background-position:200% 0}}`}</style>
        {/* header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: '#f9fafb',
          borderBottom: '1px solid #eef2f7',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700 }}>{title}</div>
        <div style={{ display: 'flex', gap: 6 }}>{headerActions}</div>
      </div>
      {/* scoped overrides for react-flow handles inside NodeShell only */}
      <style>{`
        .node-shell .react-flow__handle-left, .react-flow__handle-right {
          position: static !important;
          top: auto !important;
          transform: none !important;
        }
      `}</style>
      {/* connectors container: absolute connectors + vertical label columns */}
        {connectors && Array.isArray(connectors) && connectors.map((connector: any) => {
            return (
              <div className="connectoins-container" style={{ display: 'flex', flexFlow: 'column', gap: 8, }}>
                <div 
                    key={connector.id} 
                    ref={connectorRowRefs?.inputs?.[connector.id]} 
                    className="connector-row" 
                    style={{ 
                        // width: '100px',
                        display: 'flex', 
                        alignSelf: connector.type === 'target' ? 'flex-start' : 'flex-end', 
                        flexDirection: connector.type === 'target' ? 'row' : 'row-reverse', 
                        alignItems: 'flex-start', 
                    }}>
                    <Handle {...connector} className="connector-handle" style={{ 
                        borderRadius: 4, 
                        height: "10px",
                        margin: "auto 0",
                        width: "10px", 
                        backgroundColor: getDataTypeColor(connector.dataType || 'any'), 
                        border: `1px solid ${getDataTypeConfig(connector.dataType || 'any').borderColor}`,
                    }} />
                    <div className="connector-label" style={{ 
                        fontSize: 11, 
                        color: getDataTypeConfig(connector.dataType || 'any').color, 
                        padding: '2px', 
                        borderRadius: 4, 
                        background: getDataTypeConfig(connector.dataType || 'any').backgroundColor, 
                        border: `1px solid ${getDataTypeConfig(connector.dataType || 'any').borderColor}`,
                        // width: '100%',
                        textAlign: 'center',
                    }}>
                        {connector.label}
                    </div>
                </div>
            </div>      
          )
        })}

      

      {/* controls list (stacked rows) */}
      {controls.length > 0 && <ControlsList controls={controls} />}

      {/* body */}
      <div style={{ padding: 12, flex: 1, overflow: 'auto' }}>{children}</div>
      
      {/* Resize handles */}
      {nodeId && !disableResize && (
        <>
          {/* Corner resize handle */}
          <div
            className="nodrag"
            onMouseDown={(e) => startResize(e, 'corner')}
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 16,
              height: 16,
              cursor: 'nwse-resize',
              background: 'linear-gradient(-45deg, transparent 40%, #cbd5e1 40%, #cbd5e1 45%, transparent 45%, transparent 55%, #cbd5e1 55%, #cbd5e1 60%, transparent 60%)',
              zIndex: 10,
            }}
          />
          {/* Right edge resize handle */}
          <div
            className="nodrag"
            onMouseDown={(e) => startResize(e, 'right')}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 4,
              cursor: 'ew-resize',
              zIndex: 9,
            }}
          />
          {/* Bottom edge resize handle */}
          <div
            className="nodrag"
            onMouseDown={(e) => startResize(e, 'bottom')}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 4,
              cursor: 'ns-resize',
              zIndex: 9,
            }}
          />
        </>
      )}
    </div>
  )
}

const ControlsList: React.FC<{
  controls: Array<{
    key: string;
    label: string;
    fullValue?: string;
    connected?: boolean;
    editable?: boolean;
    value?: string;
    onChange?: (next: string) => void;
    placeholder?: string;
  }>;
}> = ({ controls }) => {
  const [editingKey, setEditingKey] = React.useState<string | null>(null)
  const [tempValue, setTempValue] = React.useState<string>('')
  const [viewKey, setViewKey] = React.useState<string | null>(null)
  React.useEffect(() => {
    console.log('controls', controls)
  }, [controls])

  return (
    <div style={{padding: '8px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {controls.map((c) => {
        const isEditing = editingKey === c.key && c.editable && !c.connected
        const isViewing = viewKey === c.key
        return (
          <div
            key={c.key}
            title={c.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              background: '#e5e7eb',
              color: '#111827',
              fontSize: 11,
              fontWeight: 600,
              boxSizing: 'border-box',
            }}
          >
            {isEditing ? (
              <input
                autoFocus
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                placeholder={c.placeholder}
                onBlur={() => {
                  c.onChange?.(tempValue)
                  setEditingKey(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    c.onChange?.(tempValue)
                    setEditingKey(null)
                  } else if (e.key === 'Escape') {
                    setEditingKey(null)
                  }
                }}
                style={{
                  flex: 1,
                  marginRight: 10,
                  padding: '4px 6px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 4,
                  fontSize: 12,
                  background: '#fff',
                }}
              />
            ) : (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
            )}
            <div style={{ display: 'flex', gap: 6, marginLeft: 10 }}>
              <button
                onClick={() => {
                  if (c.editable && !c.connected) {
                    if (isEditing) {
                      c.onChange?.(tempValue)
                      setEditingKey(null)
                    } else {
                      setTempValue(c.value ?? '')
                      setEditingKey(c.key)
                      setViewKey(null)
                    }
                  } else {
                    setEditingKey(null)
                    setViewKey(isViewing ? null : c.key)
                  }
                }}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: '#0f172a',
                }}
                aria-label={isEditing ? `Apply ${c.key}` : `Open ${c.key}`}
                title={c.connected ? 'Connected (view only)' : isEditing ? 'Apply' : 'Open'}
              >
                {isEditing ? '✓' : '▶'}
              </button>
            </div>
          </div>
        )
      })}
      {viewKey && (
        <div style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Value</div>
          <div
            style={{
              height: 'auto', // fixed height to avoid resizing the node
              overflow: 'auto',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              background: '#f8fafc',
              padding: 8,
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              boxSizing: 'border-box',
              width: '100%',
            }}
          >
            {controls.find((x) => x.key === viewKey)?.fullValue ?? ''}
          </div>
        </div>
      )}
    </div>
  )
}


