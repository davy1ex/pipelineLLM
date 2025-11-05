import React, { useState } from 'react';
import { saveWorkflow } from '../../../shared/api/workflows';
import { useWorkflowStore } from '../../../features/canvas/model';

export const SaveWorkflowButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Workflow name is required');
      return;
    }

    if (nodes.length === 0) {
      setError('Cannot save empty workflow');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await saveWorkflow({
        name: name.trim(),
        nodes,
        edges,
        description: description.trim() || undefined,
      });
      
      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setName('');
        setDescription('');
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: '8px 12px',
          border: 'none',
          borderRadius: '4px',
          background: '#4CAF50',
          color: 'white',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        💾 Save Workflow
      </button>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 1000,
      background: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      minWidth: '350px',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Save Workflow</h3>
        <button
          onClick={() => {
            setIsOpen(false);
            setName('');
            setDescription('');
            setError(null);
            setSuccess(false);
          }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            padding: 0,
            width: '24px',
            height: '24px',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', marginBottom: '5px', fontWeight: 500 }}>
            Workflow Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-workflow"
            disabled={saving}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '13px',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', marginBottom: '5px', fontWeight: 500 }}>
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this workflow..."
            disabled={saving}
            rows={3}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '13px',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ fontSize: '12px', color: '#666' }}>
          {nodes.length} nodes, {edges.length} edges
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px',
          background: '#ffebee',
          color: '#c62828',
          borderRadius: '4px',
          fontSize: '13px',
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '10px',
          background: '#e8f5e9',
          color: '#2e7d32',
          borderRadius: '4px',
          fontSize: '13px',
        }}>
          ✓ Workflow saved successfully!
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || nodes.length === 0}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            borderRadius: '4px',
            background: saving || !name.trim() || nodes.length === 0 ? '#ccc' : '#4CAF50',
            color: 'white',
            cursor: saving || !name.trim() || nodes.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => {
            setIsOpen(false);
            setName('');
            setDescription('');
            setError(null);
            setSuccess(false);
          }}
          disabled={saving}
          style={{
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            background: 'white',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '13px',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

