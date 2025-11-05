import React from 'react'
import { Position, type NodeProps } from '@xyflow/react'
import { NodeShell } from '../../../shared/ui/NodeShell'
import { uploadFileToServer } from '../../../shared/api/files'
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext'

export const DoclingNode = ({ id, data }: NodeProps) => {
  const { updateNodeData } = useNodeActions()
  const label: string = (data as any)?.label ?? 'Docling (PDF/DOCX → Markdown)'
  const filename: string | undefined = (data as any)?.filename
  const fileId: string | undefined = (data as any)?.fileId
  const output: string | undefined = (data as any)?.output
  const error: string | undefined = (data as any)?.error

  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const onPick = () => inputRef.current?.click()
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const res = await uploadFileToServer(file)
    updateNodeData(id as string, { fileId: res.fileId, filename: res.filename, mimetype: res.mimetype, size: res.size })
    // reset to allow picking same file again
    e.target.value = ''
  }

  // Check if error indicates file not found
  const isFileNotFound = error && (error.includes('File not found') || error.includes('file may have been deleted'))

  const controls = [
    { key: 'file', label: filename ? `File: ${filename}` : 'No file selected' },
    ...(fileId ? [{ key: 'fileId', label: `fileId: ${fileId}` }] : []),
    ...(output ? [{ key: 'output', label: `Markdown (${output.length} chars)`, fullValue: output }] : []),
    ...(error ? [{ key: 'error', label: `Error: ${error}`, fullValue: error }] : []),
  ]

  return (
    <NodeShell
      nodeId={id as string}
      title={label}
      connectors={[
        { id: 'output', type: 'source', position: Position.Right, label: 'markdown', dataType: 'text' },
      ]}
      controls={controls}
      defaultWidth={520}
      defaultHeight={220}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" style={{ display: 'none' }} onChange={onChange} />
          <button onClick={onPick} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}>
            {filename ? 'Change file' : 'Upload file'}
          </button>
          {filename && <span style={{ fontSize: 12, color: '#475569' }}>{filename}</span>}
        </div>
        {isFileNotFound && (
          <div style={{ padding: '8px 12px', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 6, fontSize: 11, color: '#92400e' }}>
            ⚠️ File not found. The file may have been deleted or the container was restarted. Please upload the file again.
          </div>
        )}
      </div>
    </NodeShell>
  )
}


