import { useWorkflowStore } from '../../../features/canvas/model';
import { uiNodeTemplates } from '../../../entities/nodes/registry';
import { buildNodeFromTemplates } from '../../../shared/lib/nodeTemplate';
import type { Node } from '@xyflow/react';

export const Toolbar = () => {
  const addNode = useWorkflowStore((s) => s.addNode);
  const clearWorkflow = useWorkflowStore((s) => s.clearWorkflow);
  const nodes = useWorkflowStore((s) => s.nodes);
  const getViewportCenter = useWorkflowStore((s) => s.getViewportCenter);

  const templatesCombined = [...uiNodeTemplates];

  const handleAddFromTemplate = (templateId: string) => {
    console.log('[Toolbar] ========== START: handleAddFromTemplate ==========');
    console.log('[Toolbar] templateId:', templateId);
    console.log('[Toolbar] getViewportCenter available:', !!getViewportCenter);
    
    // Get center of visible area using the function provided by ViewportCenterProvider
    // This function uses screenToFlowPosition which correctly handles viewport and zoom
    let centerPosition: { x: number; y: number } | undefined;
    
    if (getViewportCenter) {
      centerPosition = getViewportCenter();
      console.log('[Toolbar] centerPosition from getViewportCenter:', centerPosition);
    } else {
      console.warn('[Toolbar] getViewportCenter is not available yet (ReactFlow may not be initialized)');
    }
    
    console.log('[Toolbar] calling buildNodeFromTemplates with centerPosition:', centerPosition);
    const newNode = buildNodeFromTemplates(templatesCombined, templateId, centerPosition);
    
    if (newNode) {
      console.log('[Toolbar] newNode created:', {
        id: newNode.id,
        type: newNode.type,
        position: newNode.position,
        'position.x': newNode.position.x,
        'position.y': newNode.position.y
      });
      console.log('[Toolbar] calling addNode...');
      addNode(newNode as Node);
      console.log('[Toolbar] ========== END: handleAddFromTemplate ==========');
    } else {
      console.error('[Toolbar] newNode is null!');
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: 10,
      left: 10,
      zIndex: 10,
      background: 'white',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      display: 'flex',
      gap: '10px',
      flexDirection: 'column',
    }}>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Add Nodes</h3>
      {templatesCombined.map((tpl) => (
        <button
          key={tpl.id}
          onClick={() => handleAddFromTemplate(tpl.id)}
          style={{
            padding: '8px 12px',
            border: 'none',
            borderRadius: '4px',
            background: tpl.color ?? '#333',
            color: 'white',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          {tpl.label}
        </button>
      ))}
      <hr style={{ margin: '5px 0', border: 'none', borderTop: '1px solid #eee' }} />
      <button
        onClick={clearWorkflow}
        style={{
          padding: '8px 12px',
          border: 'none',
          borderRadius: '4px',
          background: '#f44336',
          color: 'white',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        🗑️ Clear All
      </button>
      <div style={{ fontSize: '12px', color: '#666' }}>
        Nodes: {nodes.length}
      </div>
    </div>
  );
};


