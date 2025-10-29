import { useWorkflowStore, nodeTemplates, buildNodeFromTemplate, buildNodeFromTemplates } from '../model';
import { uiNodeTemplates } from './nodes/registry';
import type { Node } from '@xyflow/react';

export const WorkFlowToolbar = () => {
  const addNode = useWorkflowStore((state) => state.addNode);
  const clearWorkflow = useWorkflowStore((state) => state.clearWorkflow);
  const nodes = useWorkflowStore((state) => state.nodes);

  const templatesCombined = [...nodeTemplates, ...uiNodeTemplates];

  const handleAddFromTemplate = (templateId: string) => {
    // Try model registry first for backward-compat, then UI templates
    const newNode = buildNodeFromTemplate(templateId) ?? buildNodeFromTemplates(templatesCombined, templateId);
    if (newNode) addNode(newNode as Node);
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

