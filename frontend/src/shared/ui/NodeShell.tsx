import React from 'react'
import { getDataTypeColor, getDataTypeConfig, type DataType } from '../lib/dataTypes'
import { Handle, type Position } from '@xyflow/react'
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
  outerRef?: React.Ref<HTMLDivElement>
}

export const NodeShell: React.FC<NodeShellProps> = ({
  title,
  headerActions,
  connectors,
  connectorRowRefs,
  controls = [],
  children,
  outerRef,
}) => {
  return (
    <div
      className="node-shell"
      style={{
        width: 500,
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        position: 'relative',
        boxSizing: 'border-box',
        overflow: 'hidden',
        textAlign: 'left',
      }}
      ref={outerRef as any}
    >
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
                        justifyContent: 'center', gap: 8
                    }}>
                    <Handle {...connector} className="connector-handle" style={{ 
                        borderRadius: 4, 
                        height: "20px",
                        margin: "auto 0",
                        width: "30px", 
                        backgroundColor: getDataTypeColor(connector.dataType || 'any'), 
                        border: `1px solid ${getDataTypeConfig(connector.dataType || 'any').borderColor}`,
                    }} />
                    <div className="connector-label" style={{ 
                        fontSize: 11, 
                        color: getDataTypeConfig(connector.dataType || 'any').color, 
                        padding: '4px 6px', 
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
      <div style={{ padding: 12 }}>{children}</div>
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


