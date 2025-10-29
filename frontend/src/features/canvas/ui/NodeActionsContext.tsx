import { createContext, useContext } from 'react';

type UpdateNodeData = (nodeId: string, patch: Record<string, unknown>) => void;

const NodeActionsContext = createContext<{ updateNodeData: UpdateNodeData } | null>(null);

export const NodeActionsProvider = NodeActionsContext.Provider;

export const useNodeActions = () => {
  const ctx = useContext(NodeActionsContext);
  if (!ctx) throw new Error('useNodeActions must be used within NodeActionsProvider');
  return ctx;
};


