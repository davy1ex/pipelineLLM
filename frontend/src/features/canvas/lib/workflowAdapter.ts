/**
 * Adapter between ComfyUI-style Workflow format and ReactFlow Node/Edge format
 * 
 * This adapter allows us to work internally with Workflow format while
 * still using ReactFlow for UI rendering.
 */

import type { Node, Edge } from '@xyflow/react';
import type { Workflow, WorkflowNode, WorkflowLink } from '../model/workflowTypes';
import { getNodeHandles } from '../../../shared/lib/nodeHandles';

/**
 * Convert Workflow format to ReactFlow Node[]/Edge[] for UI rendering
 */
export function workflowToReactFlow(workflow: Workflow): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = workflow.nodes.map((wn) => {
    // Extract position from properties - validate it's a proper object with x and y
    let position = { x: 0, y: 0 };
    const posData = wn.properties?.position;
    if (posData && typeof posData === 'object' && 'x' in posData && 'y' in posData) {
      const x = typeof posData.x === 'number' ? posData.x : 0;
      const y = typeof posData.y === 'number' ? posData.y : 0;
      position = { x, y };
    }
    
    // Build data object from widgets_values and properties
    const data: Record<string, unknown> = {
      label: wn.properties?.label || wn.type,
      ...wn.properties,
    };
    
    // Map widgets_values to data (type-specific)
    if (wn.widgets_values) {
      if (wn.type === 'textInput') {
        data.value = wn.widgets_values[0] || '';
      } else if (wn.type === 'ollama') {
        data.model = wn.widgets_values[0] || 'llama3.2';
        data.temperature = wn.widgets_values[1] ?? 0.7;
        data.prompt = wn.widgets_values[2] || '';
        data.systemPrompt = wn.widgets_values[3] || '';
        const urlValue = wn.widgets_values[4];
        data.url = urlValue !== undefined && urlValue !== null && urlValue !== '' ? urlValue : undefined;
        // Also populate config for backward compatibility with OllamaNode logic
        data.config = {
          model: data.model,
          temperature: data.temperature,
          url: data.url,
        };
      } else if (wn.type === 'python') {
        data.code = wn.widgets_values[0] || '';
        data.output = wn.widgets_values[1] || '';
      } else if (wn.type === 'settings') {
        data.url = wn.widgets_values[0] || 'http://localhost:11434';
        data.model = wn.widgets_values[1] || 'llama3.2';
        data.temperature = wn.widgets_values[2] ?? 0.7;
      } else if (wn.type === 'output') {
        data.text = wn.widgets_values[0] || '';
      } else if (wn.type === 'fileWriter') {
        data.filename = wn.widgets_values[0] || 'result.txt';
        data.fileId = wn.widgets_values[1] || undefined;
      }
    }
    
    // Add width/height if in properties
    if (wn.properties?.width) data.width = wn.properties.width;
    if (wn.properties?.height) data.height = wn.properties.height;
    
    const node = {
      id: wn.id.toString(),
      type: wn.type,
      position,
      data,
    } as Node;
    
    // Log position for debugging if there's a mismatch
    const positionFromWorkflow = wn.properties?.position as { x: number; y: number } | undefined;
    if (positionFromWorkflow && (positionFromWorkflow.x !== position.x || positionFromWorkflow.y !== position.y)) {
      console.warn(`[workflowAdapter] Position mismatch for node ${wn.id}:`, {
        workflow: positionFromWorkflow,
        final: position
      });
    }
    
    return node;
  });
  
  // Convert links to edges
  console.log('[workflowAdapter] Converting links to edges:', {
    linkCount: workflow.links.length,
    nodeCount: workflow.nodes.length,
    nodeIds: workflow.nodes.map(n => n.id),
    links: workflow.links
  });
  
  const edges: Edge[] = workflow.links
    .filter((link) => {
      // Filter out invalid links
      if (!Array.isArray(link) || link.length < 5) {
        console.warn('[workflowAdapter] Invalid link format (not array or length < 5):', link);
        return false;
      }
      const [, fromNodeId, , toNodeId] = link;
      if (fromNodeId == null || toNodeId == null) {
        console.warn('[workflowAdapter] Link has null node IDs:', link);
        return false;
      }
      return true;
    })
    .map((link) => {
      const [linkId, fromNodeId, fromSlot, toNodeId, toSlot] = link;
      
      // Validate node IDs
      if (fromNodeId == null || toNodeId == null) {
        console.warn('[workflowAdapter] Invalid link detected, skipping:', link);
        return null;
      }
      
      // Find source and target handles by slot index
      const fromNode = workflow.nodes.find((n) => n.id === fromNodeId);
      const toNode = workflow.nodes.find((n) => n.id === toNodeId);
      
      // Skip if nodes not found
      if (!fromNode || !toNode) {
        console.warn('[workflowAdapter] Link references missing node, skipping:', { 
          fromNodeId, 
          toNodeId, 
          fromNodeFound: !!fromNode,
          toNodeFound: !!toNode,
          availableNodeIds: workflow.nodes.map(n => n.id),
          link 
        });
        return null;
      }
      
      const fromHandles = getNodeHandles(fromNode.type);
      const toHandles = getNodeHandles(toNode.type);
      
      // Validate slot indices
      if (fromSlot == null || toSlot == null) {
        console.warn('[workflowAdapter] Null slot indices, skipping:', { fromSlot, toSlot, link });
        return null;
      }
      
      // Validate slot indices are within bounds
      const outputsLength = fromHandles.outputs?.length || 0;
      const inputsLength = toHandles.inputs?.length || 0;
      
      if (fromSlot < 0 || fromSlot >= outputsLength || toSlot < 0 || toSlot >= inputsLength) {
        console.warn('[workflowAdapter] Invalid slot indices out of bounds, skipping:', { 
          fromSlot, 
          toSlot, 
          outputsLength,
          inputsLength,
          fromNodeType: fromNode.type,
          toNodeType: toNode.type,
          link 
        });
        return null;
      }
      
      // Get handles by slot index
      const sourceHandleObj = fromHandles.outputs[fromSlot];
      const targetHandleObj = toHandles.inputs[toSlot];
      
      if (!sourceHandleObj || !targetHandleObj) {
        console.warn('[workflowAdapter] Handle not found at slot index, skipping:', { 
          fromSlot, 
          toSlot, 
          sourceHandleObj,
          targetHandleObj,
          outputs: fromHandles.outputs,
          inputs: toHandles.inputs,
          link 
        });
        return null;
      }
      
      const sourceHandle = sourceHandleObj.id;
      const targetHandle = targetHandleObj.id;
      
      const edge = {
        id: `e${linkId}`,
        source: String(fromNodeId),
        target: String(toNodeId),
        sourceHandle,
        targetHandle,
        type: 'step',
      } as Edge;
      
      console.log('[workflowAdapter] Created edge from link:', {
        linkId,
        fromNodeId,
        toNodeId,
        fromSlot,
        toSlot,
        fromNodeType: fromNode.type,
        toNodeType: toNode.type,
        sourceHandle,
        targetHandle,
        edge
      });
      
      return edge;
    })
    .filter((edge): edge is Edge => edge !== null);
  
  console.log('[workflowAdapter] Conversion complete:', {
    inputLinks: workflow.links.length,
    outputEdges: edges.length,
    edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle }))
  });
  
  return { nodes, edges };
}

/**
 * Convert ReactFlow Node[]/Edge[] to Workflow format
 */
export function reactFlowToWorkflow(
  nodes: Node[],
  edges: Edge[],
  existingWorkflow?: Workflow
): Workflow {
  const state = existingWorkflow?.state || {
    lastNodeId: 0,
    lastLinkId: 0,
  };
  
  // Convert nodes
  const workflowNodes: WorkflowNode[] = nodes.map((node) => {
    // Try to parse node.id as integer first (if it's a number string from workflow)
    // Otherwise, try to find matching node in existing workflow by position/type
    let nodeId: number;
    if (existingWorkflow) {
      const parsed = parseInt(node.id);
      if (!isNaN(parsed)) {
        nodeId = parsed;
      } else {
        // Try to find existing node by matching properties
        const existing = existingWorkflow.nodes.find(
          (n) => n.properties?.position === node.position && n.type === node.type
        );
        nodeId = existing?.id || state.lastNodeId + 1;
      }
    } else {
      nodeId = state.lastNodeId + 1;
    }
    
    if (nodeId > state.lastNodeId) {
      state.lastNodeId = nodeId;
    }
    
    const handles = getNodeHandles(node.type);
    
    // Build inputs array
    const inputs: WorkflowNode['inputs'] = handles.inputs.map((handle) => {
      // Find edge connecting to this input
      const edge = edges.find(
        (e) => e.target === node.id && e.targetHandle === handle.id
      );
      
      return {
        name: handle.label || handle.id,
        type: handle.dataType || 'string',
        link: edge ? parseInt(edge.id.replace('e', '')) : undefined,
      };
    });
    
    // Build outputs array
    const outputs: WorkflowNode['outputs'] = handles.outputs.map((handle) => {
      // Find edges connecting from this output
      const connectedEdges = edges.filter(
        (e) => e.source === node.id && e.sourceHandle === handle.id
      );
      
      return {
        name: handle.label || handle.id,
        type: handle.dataType || 'string',
        links: connectedEdges.map((e) => parseInt(e.id.replace('e', ''))),
      };
    });
    
    // Extract widgets_values from data (type-specific)
    const widgets_values: unknown[] = [];
    const data = node.data as any;
    
    if (node.type === 'textInput') {
      widgets_values.push(data.value || '');
    } else if (node.type === 'ollama') {
      // Extract model from config if present, otherwise from data.model
      const model = (data.config as any)?.model || data.model || 'llama3.2';
      // Extract url from config if present, otherwise from data.url
      const url = (data.config as any)?.url !== undefined ? (data.config as any)?.url : data.url;
      widgets_values.push(
        model,
        data.temperature ?? 0.7,
        data.prompt || '',
        data.systemPrompt || '',
        url !== undefined && url !== null && url !== '' ? url : undefined
      );
    } else if (node.type === 'python') {
      widgets_values.push(data.code || '', data.output || '');
    } else if (node.type === 'settings') {
      widgets_values.push(
        data.url || 'http://localhost:11434',
        data.model || 'llama3.2',
        data.temperature ?? 0.7
      );
    } else if (node.type === 'output') {
      widgets_values.push(data.text || '');
    } else if (node.type === 'fileWriter') {
      widgets_values.push(data.filename || 'result.txt', data.fileId || undefined);
    }
    
    // Build properties (UI-specific data)
    // Ensure position is properly formatted
    let savedPosition = { x: 0, y: 0 };
    if (node.position && typeof node.position === 'object' && 'x' in node.position && 'y' in node.position) {
      savedPosition = {
        x: typeof node.position.x === 'number' ? node.position.x : 0,
        y: typeof node.position.y === 'number' ? node.position.y : 0,
      };
    }
    
    const properties: Record<string, unknown> = {
      label: data.label || node.type,
      position: savedPosition,
    };
    
    if (data.width) properties.width = data.width;
    if (data.height) properties.height = data.height;
    
    // Copy other properties
    Object.keys(data).forEach((key) => {
      if (!['value', 'model', 'temperature', 'prompt', 'systemPrompt', 'url', 'code', 'output', 'text', 'filename', 'fileId'].includes(key)) {
        properties[key] = data[key];
      }
    });
    
    if (!node.type) {
      throw new Error(`Node ${node.id} has no type`);
    }
    
    return {
      id: nodeId,
      type: node.type,
      order: 0, // Will be computed on backend
      mode: 0,
      inputs,
      outputs,
      properties,
      widgets_values,
    } as WorkflowNode;
  });
  
  // Convert edges to links
  console.log('[workflowAdapter] Converting edges to links:', {
    edgeCount: edges.length,
    nodeCount: workflowNodes.length,
    workflowNodeIds: workflowNodes.map(n => n.id),
    edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle }))
  });
  
  const links: WorkflowLink[] = edges
    .filter((edge) => {
      // Filter out invalid edges
      if (!edge.source || !edge.target) {
        console.warn('[workflowAdapter] Invalid edge detected, skipping:', edge);
        return false;
      }
      return true;
    })
    .map((edge) => {
      // Extract linkId from edge.id (format: "e123")
      let linkId: number;
      const match = edge.id.match(/^e(\d+)$/);
      if (match) {
        linkId = parseInt(match[1], 10);
      } else {
        // If edge.id doesn't match format, generate new linkId
        linkId = state.lastLinkId + 1;
        console.warn('[workflowAdapter] Edge ID does not match expected format, generating new linkId:', { 
          edgeId: edge.id, 
          newLinkId: linkId,
          edge 
        });
      }
      
      // Update state.lastLinkId
      if (linkId > state.lastLinkId) {
        state.lastLinkId = linkId;
      }
      
      // Find nodes by matching source/target string IDs with workflow node IDs
      // First try to parse as integer, then find by matching string ID
      const fromNodeIdParsed = parseInt(edge.source);
      const toNodeIdParsed = parseInt(edge.target);
      
      // Find nodes - check if parsed ID matches, or if node.id.toString() matches edge.source/target
      const fromNode = workflowNodes.find((n) => {
        if (!isNaN(fromNodeIdParsed)) {
          return n.id === fromNodeIdParsed;
        }
        return false;
      });
      
      const toNode = workflowNodes.find((n) => {
        if (!isNaN(toNodeIdParsed)) {
          return n.id === toNodeIdParsed;
        }
        return false;
      });
      
      // Validate nodes found
      if (!fromNode || !toNode) {
        console.warn('[workflowAdapter] Edge references missing node, skipping:', { 
          source: edge.source, 
          target: edge.target, 
          fromNodeIdParsed,
          toNodeIdParsed,
          workflowNodeIds: workflowNodes.map(n => n.id),
          edge 
        });
        return null;
      }
      
      const fromNodeId = fromNode.id;
      const toNodeId = toNode.id;
      
      const fromHandles = getNodeHandles(fromNode.type);
      const toHandles = getNodeHandles(toNode.type);
      
      // Find slot indices by handle ID
      let fromSlot = edge.sourceHandle ? fromHandles.outputs.findIndex((h) => h.id === edge.sourceHandle) : -1;
      let toSlot = edge.targetHandle ? toHandles.inputs.findIndex((h) => h.id === edge.targetHandle) : -1;
      
      // If handles not found, try to infer defaults
      if (fromSlot < 0 && fromHandles.outputs.length > 0) {
        console.warn('[workflowAdapter] Source handle not found, using first output:', { 
          sourceHandle: edge.sourceHandle, 
          availableOutputs: fromHandles.outputs.map(h => h.id),
          fromNodeType: fromNode.type
        });
        fromSlot = 0; // Use first output
      }
      
      if (toSlot < 0 && toHandles.inputs.length > 0) {
        console.warn('[workflowAdapter] Target handle not found, using first input:', { 
          targetHandle: edge.targetHandle,
          availableInputs: toHandles.inputs.map(h => h.id),
          toNodeType: toNode.type
        });
        toSlot = 0; // Use first input
      }
      
      // Validate slot indices
      if (fromSlot < 0 || toSlot < 0) {
        console.warn('[workflowAdapter] Invalid slot indices for edge, skipping:', { 
          fromSlot, 
          toSlot, 
          sourceHandle: edge.sourceHandle, 
          targetHandle: edge.targetHandle,
          fromNodeType: fromNode.type,
          toNodeType: toNode.type,
          fromOutputs: fromHandles.outputs.map(h => h.id),
          toInputs: toHandles.inputs.map(h => h.id),
          edge 
        });
        return null;
      }
      
      const fromSlotHandle = fromHandles.outputs[fromSlot];
      const dataType = fromSlotHandle?.dataType || 'string';
      
      const link: WorkflowLink = [linkId, fromNodeId, fromSlot, toNodeId, toSlot, dataType];
      
      console.log('[workflowAdapter] Created link from edge:', {
        linkId,
        fromNodeId,
        toNodeId,
        fromSlot,
        toSlot,
        dataType,
        edgeId: edge.id,
        edgeSource: edge.source,
        edgeTarget: edge.target,
        link
      });
      
      return link;
    })
    .filter((link): link is WorkflowLink => link !== null);
  
  console.log('[workflowAdapter] Edge to link conversion complete:', {
    inputEdges: edges.length,
    outputLinks: links.length,
    links: links
  });
  
  return {
    version: existingWorkflow?.version || 1,
    state,
    nodes: workflowNodes,
    links,
  };
}

