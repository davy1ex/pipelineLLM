import { useEffect } from 'react'
import {
  WorkFlowFrame,
  WorkFlowToolbar,
  useWorkflowStore,
  getInitialNodes,
  getInitialEdges
} from '../../features/workflow'

export const WorkFlowPage = () => {
    const setNodes = useWorkflowStore((state) => state.setNodes)
    const setEdges = useWorkflowStore((state) => state.setEdges)
    const nodes = useWorkflowStore((state) => state.nodes)

    useEffect(() => {
        // Initialize with demo workflow only if empty
        if (nodes.length === 0) {
            setNodes(getInitialNodes())
            setEdges(getInitialEdges())
        }
    }, [])

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
            <WorkFlowFrame />
            <WorkFlowToolbar />
        </div>
    )
}