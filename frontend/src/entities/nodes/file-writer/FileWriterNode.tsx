import React from 'react'
import { Position, type NodeProps } from '@xyflow/react'
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext'
import { NodeShell } from '../../../shared/ui/NodeShell'
import { createFileOnServer, getDownloadUrl } from '../../../shared/api/files'

export const FileWriterNode = ({ id, data }: NodeProps) => {
  const { updateNodeData, getIncomingData } = useNodeActions();
  const label: string = (data as any)?.label ?? 'Save To File'
  const filename: string = (data as any)?.filename ?? 'result.txt'
  const fileId: string | undefined = (data as any)?.fileId

  const inputDataStrict = getIncomingData(id as string, 'input') as any
  const inputDataAny = (!inputDataStrict ? getIncomingData(id as string) : null) as any
  const src = inputDataStrict || inputDataAny || {}
  const inputValue: string = src?.value || src?.text || src?.output || src?.lastResponse || ''

  const [localName, setLocalName] = React.useState<string>(filename)
  const [localFileId, setLocalFileId] = React.useState<string | undefined>(fileId)
  React.useEffect(() => setLocalName(filename), [filename])
  React.useEffect(() => setLocalFileId(fileId), [fileId])

  const handleCreate = async () => {
    const res = await createFileOnServer({ filename: localName, content: inputValue })
    setLocalFileId(res.fileId)
    updateNodeData(id as string, { fileId: res.fileId, filename: res.filename, size: res.size })
  }

  const controls = [
    { key: 'filename', label: `Filename: ${localName}`, editable: true, value: localName, onChange: (v: string) => setLocalName(v), placeholder: 'result.txt' },
    ...(inputValue ? [{ key: 'input', label: `Input: ${inputValue.slice(0, 50)}${inputValue.length > 50 ? '...' : ''}`, fullValue: inputValue }] : []),
    ...((localFileId || fileId) ? [{ key: 'file', label: `File ready: ${localName}` }] : []),
  ]

  return (
    <NodeShell nodeId={id as string} title={label} connectors={[
      { id: 'input', type: 'target', position: Position.Left, label: 'input', dataType: 'string' },
    ]} controls={controls}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleCreate} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: inputValue ? 'pointer' : 'not-allowed' }} disabled={!inputValue}>Create file</button>
        {(localFileId || fileId) && (
          <a href={getDownloadUrl(localFileId || fileId!)} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, border: '1px solid #34d399', background: '#ecfdf5', textDecoration: 'none', color: '#065f46' }}>Download</a>
        )}
      </div>
    </NodeShell>
  )
}


