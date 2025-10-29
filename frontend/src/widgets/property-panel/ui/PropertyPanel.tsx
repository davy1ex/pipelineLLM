import { useWorkflowStore } from '../../../features/canvas/model';
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext';
import { useMemo } from 'react';

export const PropertyPanel = () => {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const { updateNodeData } = useNodeActions();

  // Find selected node
  const selectedNode = nodes.find((n) => n.selected);
  const nodeId = selectedNode?.id ?? '';
  const nodeType = selectedNode?.type ?? '';
  const nodeData = (selectedNode?.data as any) ?? {};

  // Get incoming/outgoing edges for this node (safe when no selection)
  const incomingEdges = nodeId ? edges.filter((e) => e.target === nodeId) : [];
  const outgoingEdges = nodeId ? edges.filter((e) => e.source === nodeId) : [];

  // Get connected sources for each input
  const inputConnections = useMemo(() => {
    const connections: Record<string, { source: string; data: any }> = {};
    incomingEdges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (sourceNode) {
        const handleKey = edge.targetHandle || 'default';
        // Use source node's data directly instead of getIncomingData for reliability
        connections[handleKey] = {
          source: sourceNode.id,
          data: (sourceNode.data as any) || {},
        };
      }
    });
    return connections;
  }, [incomingEdges, nodes, nodeId]);

  // No node selected - hide panel (after hooks to keep order stable)
  if (!selectedNode) return null;

  // Render based on node type
  const renderNodeProperties = () => {
    switch (nodeType) {
      case 'ollama':
        return <OllamaProperties nodeId={nodeId} nodeData={nodeData} inputConnections={inputConnections} updateNodeData={updateNodeData} />;
      case 'settings':
        return <SettingsProperties nodeId={nodeId} nodeData={nodeData} updateNodeData={updateNodeData} />;
      case 'textInput':
        return <TextInputProperties nodeId={nodeId} nodeData={nodeData} updateNodeData={updateNodeData} />;
      case 'output':
        return <OutputProperties nodeData={nodeData} inputConnections={inputConnections} />;
      default:
        return <DefaultProperties nodeData={nodeData} />;
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        width: 320,
        maxHeight: '90vh',
        background: 'white',
        borderRadius: 8,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        padding: '16px',
        overflowY: 'auto',
        zIndex: 10,
      }}
    >
      <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>
        ⚙️ Edit Block: {nodeData?.label || nodeType}
      </h3>

      {/* Node Info */}
      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Type: <strong>{nodeType}</strong></div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>ID: <strong>{nodeId}</strong></div>
      </div>

      {/* Inputs */}
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>📥 Inputs</h4>
        {Object.keys(inputConnections).length === 0 ? (
          <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>No connections</div>
        ) : (
          Object.entries(inputConnections).map(([handleId, conn]) => {
            const sourceNode = nodes.find((n) => n.id === conn.source);
            return (
              <div key={handleId} style={{ marginBottom: 8, padding: 8, background: '#f9fafb', borderRadius: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  {handleId === 'default' || !handleId ? 'Main Input' : `Handle: ${handleId}`}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>
                  From: <strong>{String((sourceNode?.data as any)?.label || conn.source)}</strong>
                </div>
                {Object.keys(conn.data).length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 11, color: '#374151' }}>
                    <strong>Data:</strong>
                    <pre style={{ margin: 4, fontSize: 10, background: 'white', padding: 4, borderRadius: 2, overflow: 'auto' }}>
                      {JSON.stringify(conn.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Outputs */}
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>📤 Outputs</h4>
        {outgoingEdges.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>No connections</div>
        ) : (
          outgoingEdges.map((edge) => {
            const targetNode = nodes.find((n) => n.id === edge.target);
            return (
              <div key={edge.id} style={{ marginBottom: 4, fontSize: 12, color: '#6b7280' }}>
                → <strong>{String((targetNode?.data as any)?.label || edge.target)}</strong>
                {edge.sourceHandle && <span style={{ color: '#9ca3af' }}> ({edge.sourceHandle})</span>}
              </div>
            );
          })
        )}
      </div>

      {/* Node-specific properties */}
      <div style={{ marginTop: 16 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>⚙️ Properties</h4>
        {renderNodeProperties()}
      </div>
    </div>
  );
};

// Ollama-specific properties
const OllamaProperties = ({ nodeId, nodeData, inputConnections, updateNodeData }: any) => {
  const promptConnected = !!inputConnections.default || !!inputConnections.prompt;
  const configConnected = !!inputConnections.config;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          URL
          {configConnected && <span style={{ color: '#9ca3af', fontWeight: 400 }}> (from Settings)</span>}
        </label>
        {configConnected ? (
          <div style={{ fontSize: 12, color: '#6b7280', padding: 6, background: '#f3f4f6', borderRadius: 4 }}>
            {inputConnections.config?.data?.url || nodeData?.url || 'http://localhost:11434'}
          </div>
        ) : (
          <input
            type="text"
            value={nodeData?.url || 'http://localhost:11434'}
            onChange={(e) => updateNodeData(nodeId, { url: e.target.value })}
            style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
          />
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          Model
          {configConnected && <span style={{ color: '#9ca3af', fontWeight: 400 }}> (from Settings)</span>}
        </label>
        {configConnected ? (
          <div style={{ fontSize: 12, color: '#6b7280', padding: 6, background: '#f3f4f6', borderRadius: 4 }}>
            {inputConnections.config?.data?.model || nodeData?.model || 'llama3.2'}
          </div>
        ) : (
          <input
            type="text"
            value={nodeData?.model || 'llama3.2'}
            onChange={(e) => updateNodeData(nodeId, { model: e.target.value })}
            style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
          />
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          Temperature
        </label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="2"
          value={nodeData?.temperature ?? 0.7}
          onChange={(e) => updateNodeData(nodeId, { temperature: parseFloat(e.target.value) })}
          style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          Prompt
          {promptConnected && <span style={{ color: '#9ca3af', fontWeight: 400 }}> (from TextInput)</span>}
        </label>
        {promptConnected ? (
          <div style={{ fontSize: 12, color: '#6b7280', padding: 6, background: '#f3f4f6', borderRadius: 4, whiteSpace: 'pre-wrap' }}>
            {(() => {
              // Try to find prompt value from any connected input
              const defaultConn = inputConnections.default || inputConnections.prompt;
              if (defaultConn?.data?.value) return defaultConn.data.value;
              if (defaultConn?.data?.text) return defaultConn.data.text;
              // Fallback: try first connection if exists
              const firstConn = Object.values(inputConnections)[0] as { source: string; data: any } | undefined;
              if (firstConn?.data?.value) return firstConn.data.value;
              if (firstConn?.data?.text) return firstConn.data.text;
              return 'N/A';
            })()}
          </div>
        ) : (
          <textarea
            value={nodeData?.prompt || ''}
            onChange={(e) => updateNodeData(nodeId, { prompt: e.target.value })}
            placeholder="Enter prompt..."
            style={{ width: '100%', minHeight: 60, padding: 6, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, resize: 'vertical' }}
          />
        )}
      </div>

      <div style={{ marginTop: 12, padding: 8, background: '#eff6ff', borderRadius: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Interfaces:</div>
        <div style={{ fontSize: 11, color: '#374151' }}>
          <div>📥 Inputs: prompt (main), config (Settings)</div>
          <div>📤 Outputs: output (text result)</div>
        </div>
      </div>
    </div>
  );
};

// Settings-specific properties
const SettingsProperties = ({ nodeId, nodeData, updateNodeData }: any) => {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>URL</label>
        <input
          type="text"
          value={nodeData?.url || 'http://localhost:11434'}
          onChange={(e) => updateNodeData(nodeId, { url: e.target.value })}
          style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Model</label>
        <input
          type="text"
          value={nodeData?.model || 'llama3.2'}
          onChange={(e) => updateNodeData(nodeId, { model: e.target.value })}
          style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
        />
      </div>

      <div style={{ marginTop: 12, padding: 8, background: '#eff6ff', borderRadius: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Interfaces:</div>
        <div style={{ fontSize: 11, color: '#374151' }}>
          <div>📤 Outputs: config (URL + Model)</div>
        </div>
      </div>
    </div>
  );
};

// TextInput-specific properties
const TextInputProperties = ({ nodeId, nodeData, updateNodeData }: any) => {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Label</label>
        <input
          type="text"
          value={nodeData?.label || 'Text Input'}
          onChange={(e) => updateNodeData(nodeId, { label: e.target.value })}
          style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
        />
      </div>

      <div style={{ marginTop: 12, padding: 8, background: '#eff6ff', borderRadius: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Interfaces:</div>
        <div style={{ fontSize: 11, color: '#374151' }}>
          <div>📤 Outputs: output (value field)</div>
        </div>
      </div>
    </div>
  );
};

// Output-specific properties
const OutputProperties = ({ inputConnections }: any) => {
  // Try to find text from any connected input
  const defaultConn = inputConnections.default || inputConnections.text;
  const firstConn = Object.values(inputConnections)[0] as { source: string; data: any } | undefined;
  
  const textValue = defaultConn?.data?.text || 
                    defaultConn?.data?.output || 
                    defaultConn?.data?.value || 
                    firstConn?.data?.text ||
                    firstConn?.data?.output ||
                    firstConn?.data?.value ||
                    'N/A';
  
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Received Text</label>
        <div style={{ padding: 8, background: '#f3f4f6', borderRadius: 4, fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
          {textValue as string}
        </div>
      </div>

      <div style={{ marginTop: 12, padding: 8, background: '#eff6ff', borderRadius: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Interfaces:</div>
        <div style={{ fontSize: 11, color: '#374151' }}>
          <div>📥 Inputs: text (main)</div>
        </div>
      </div>
    </div>
  );
};

// Default properties for unknown node types
const DefaultProperties = ({ nodeData }: any) => {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>
        <pre style={{ margin: 0, fontSize: 11, background: '#f3f4f6', padding: 8, borderRadius: 4, overflow: 'auto' }}>
          {JSON.stringify(nodeData, null, 2)}
        </pre>
      </div>
    </div>
  );
};

