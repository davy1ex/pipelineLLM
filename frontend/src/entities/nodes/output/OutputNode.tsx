import React from 'react';
import MarkdownIt from 'markdown-it';
import { Position, type NodeProps } from '@xyflow/react';
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext';
import { NodeShell } from '../../../shared/ui/NodeShell';

export const OutputNode = ({ id, data }: NodeProps) => {
  const { getIncomingData, updateNodeData } = useNodeActions();
  const label: string = (data as any)?.label ?? 'Output Preview';
  const [expanded, setExpanded] = React.useState(false);
  const [renderMd, setRenderMd] = React.useState(true);
  const md = React.useMemo(() => new MarkdownIt({ html: false, linkify: true, breaks: true }), []);
  // Resizable width/height with persistence
  const [size, setSize] = React.useState<{ width: number; height: number }>(() => ({
    width: (data as any)?.width ?? 500,
    height: (data as any)?.height ?? 160,
  }));
  React.useEffect(() => {
    const w = (data as any)?.width;
    const h = (data as any)?.height;
    if (typeof w === 'number' || typeof h === 'number') {
      setSize((s) => ({ width: typeof w === 'number' ? w : s.width, height: typeof h === 'number' ? h : s.height }));
    }
  }, [data]);
  const resRef = React.useRef<{ active: boolean; mode: 'right'|'bottom'|'corner'|null; sx: number; sy: number; sw: number; sh: number }>({ active: false, mode: null, sx: 0, sy: 0, sw: size.width, sh: size.height });
  const startResize = (e: React.MouseEvent, mode: 'right'|'bottom'|'corner') => {
    e.preventDefault(); e.stopPropagation();
    resRef.current = { active: true, mode, sx: e.clientX, sy: e.clientY, sw: size.width, sh: size.height };
    document.body.style.userSelect = 'none';
  };
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resRef.current; if (!r.active) return;
      let w = r.sw, h = r.sh;
      if (r.mode === 'right' || r.mode === 'corner') w = Math.max(240, r.sw + (e.clientX - r.sx));
      if (r.mode === 'bottom' || r.mode === 'corner') h = Math.max(100, r.sh + (e.clientY - r.sy));
      setSize({ width: w, height: h });
    };
    const onUp = () => {
      const r = resRef.current; if (!r.active) return;
      r.active = false; document.body.style.userSelect = '';
      updateNodeData(id as string, { width: size.width, height: size.height });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [id, size.width, size.height, updateNodeData]);
  
  // Priority: 1) data.text (updated from workflow execution), 2) incoming data from connected node
  const nodeText = (data as any)?.text || '';
  const incomingData = (getIncomingData(id as string) as any) || {};
  const incomingText = incomingData.text || incomingData.output || incomingData.value || '';
  
  // Use node's own text if set (from workflow execution), otherwise use incoming data
  const text: string = nodeText || incomingText;
  
  // Debug logging - only log when text changes or on first render
  // Use a ref to track previous text to avoid spam
  const prevTextRef = React.useRef<string>('');
  const hasChanged = prevTextRef.current !== text;
  
  if (hasChanged || !prevTextRef.current) {
    console.log(`[OutputNode ${id}] ${hasChanged ? '🔄 TEXT CHANGED' : '🆕 FIRST RENDER'}:`, {
      nodeText: nodeText,
      nodeTextLength: nodeText?.length || 0,
      incomingText: incomingText,
      incomingTextLength: incomingText?.length || 0,
      finalText: text,
      finalTextLength: text?.length || 0,
      dataKeys: Object.keys(data || {}),
      willDisplay: text || 'No content yet',
    });
    prevTextRef.current = text;
  }

  const renderMarkdown = (src: string) => md.render(src || '');

  const handleExpand = () => {
    setExpanded((v) => !v);
    if (!expanded) {
      const el = document.querySelector('.output-node-content');
      if (!el) return;
      const desiredWidth = Math.max(240, Math.min(1200, el.scrollWidth + 48));
      const desiredHeight = Math.max(100, Math.min(1600, el.scrollHeight));
      setSize({ width: desiredWidth, height: desiredHeight });
      updateNodeData(id as string, { width: desiredWidth, height: desiredHeight });
      console.log('Expanded output node', { width: desiredWidth, height: desiredHeight });
    }
  };

  return (
    <NodeShell
      title={label}
      width={size.width}
      headerActions={
        <>
          <button onClick={handleExpand} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}>{expanded ? 'Collapse' : 'Expand'}</button>
          <button onClick={() => setRenderMd((v) => !v)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: renderMd ? '#e0e7ff' : '#f9fafb', cursor: 'pointer' }} title="Toggle Markdown rendering">{renderMd ? 'MD: On' : 'MD: Off'}</button>
        </>
      }
      connectors={[
        { id: 'text', type: 'target', position: Position.Left, label: 'text', dataType: 'string' },
      ]}
      controls={[
        { key: 'text', label: 'text', value: text, placeholder: 'Enter text...' },
      ]}
    >
      <div
        style={{
          minHeight: 70,
          fontSize: 12,
          padding: 15,
          width: '100%',
          borderRadius: 6,
          background: '#fafafa',
          whiteSpace: 'pre-wrap',
          boxSizing: 'border-box',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          overflow: 'auto',
          height: expanded ? size.height : Math.min(size.height, 140),
          textAlign: 'left',
        }}
        className="nodrag nowheel output-node-content"
        onMouseDown={(e) => { e.stopPropagation(); }}
      >
        {renderMd ? (
          <div style={{ textAlign: 'left' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(text || '') }} />
        ) : (
          <>{text || 'No content yet'}</>
        )}
      </div>

      {/* Resize handles */}
      <div
        className="nodrag nowheel"
        onMouseDown={(e) => startResize(e, 'right')}
        onClick={(e) => e.preventDefault()}
        style={{ position: 'absolute', top: 38, right: -4, width: 8, height: 'calc(100% - 76px)', cursor: 'ew-resize' }}
        title="Resize width"
      />
      <div
        className="nodrag nowheel"
        onMouseDown={(e) => startResize(e, 'bottom')}
        onClick={(e) => e.preventDefault()}
        style={{ position: 'absolute', left: 10, bottom: -4, width: 'calc(100% - 20px)', height: 8, cursor: 'ns-resize' }}
        title="Resize height"
      />
      <div
        className="nodrag nowheel"
        onMouseDown={(e) => startResize(e, 'corner')}
        onClick={(e) => e.preventDefault()}
        style={{ position: 'absolute', right: -4, bottom: -4, width: 12, height: 12, cursor: 'nwse-resize' }}
        title="Resize"
      />
    </NodeShell>
  );
};

