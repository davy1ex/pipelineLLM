import React, { useState, useEffect } from 'react';
import { listWorkflows, loadWorkflow, type WorkflowMetadata } from '../../../shared/api/workflows';
import { useWorkflowStore } from '../../../features/canvas/model';
import type { Node, Edge } from '@xyflow/react';

export const WorkflowSelector = () => {
  const [workflows, setWorkflows] = useState<WorkflowMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  
  const setNodes = useWorkflowStore((s) => s.setNodes);
  const setEdges = useWorkflowStore((s) => s.setEdges);

  const loadWorkflows = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listWorkflows();
      setWorkflows(response.workflows);
      if (response.workflows.length > 0) {
        setSelectedIndex(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
      console.error('Error loading workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadWorkflows();
    }
  }, [isOpen]);

  const handleLoadWorkflow = async (name: string) => {
    try {
      const workflow = await loadWorkflow(name);
      setNodes(workflow.nodes as Node[]);
      setEdges(workflow.edges as Edge[]);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
      console.error('Error loading workflow:', err);
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
          background: '#2196F3',
          color: 'white',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        📂 Load Workflow
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
      minWidth: '400px',
      maxWidth: '500px',
      maxHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Load Workflow</h3>
        <button
          onClick={() => setIsOpen(false)}
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

      {loading && <div style={{ textAlign: 'center', color: '#666' }}>Loading...</div>}
      
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

      {!loading && !error && workflows.length === 0 && (
        <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
          No workflows found. Save a workflow first!
        </div>
      )}

      {!loading && workflows.length > 0 && (
        <>
          {/* Carousel */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => setSelectedIndex((prev) => (prev - 1 + workflows.length) % workflows.length)}
              disabled={workflows.length <= 1}
              style={{
                padding: '8px',
                border: 'none',
                background: '#f5f5f5',
                borderRadius: '4px',
                cursor: workflows.length > 1 ? 'pointer' : 'not-allowed',
                fontSize: '18px',
                opacity: workflows.length > 1 ? 1 : 0.5,
              }}
            >
              ‹
            </button>

            <div style={{
              flex: 1,
              padding: '15px',
              background: '#f9f9f9',
              borderRadius: '4px',
              border: '2px solid #e0e0e0',
              minHeight: '120px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>
                {workflows[selectedIndex].name}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Modified: {new Date(workflows[selectedIndex].modified).toLocaleDateString()}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Size: {(workflows[selectedIndex].size / 1024).toFixed(1)} KB
              </div>
              {workflows[selectedIndex].description && (
                <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic', marginTop: '4px' }}>
                  {workflows[selectedIndex].description}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedIndex((prev) => (prev + 1) % workflows.length)}
              disabled={workflows.length <= 1}
              style={{
                padding: '8px',
                border: 'none',
                background: '#f5f5f5',
                borderRadius: '4px',
                cursor: workflows.length > 1 ? 'pointer' : 'not-allowed',
                fontSize: '18px',
                opacity: workflows.length > 1 ? 1 : 0.5,
              }}
            >
              ›
            </button>
          </div>

          {/* Indicators */}
          {workflows.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
              {workflows.map((_, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedIndex(idx)}
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: idx === selectedIndex ? '#2196F3' : '#ccc',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleLoadWorkflow(workflows[selectedIndex].name)}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderRadius: '4px',
                background: '#4CAF50',
                color: 'white',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Load
            </button>
            <button
              onClick={loadWorkflows}
              style={{
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
                fontSize: '13px',
              }}
              title="Refresh list"
            >
              🔄
            </button>
          </div>
        </>
      )}
    </div>
  );
};

