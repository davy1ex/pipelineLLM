import { getNodeHandles } from '../lib/nodeHandles';
import { getDataTypeConfig } from '../lib/dataTypes';

interface HandleLabelProps {
  nodeType: string;
  handleId: string;
  handleType: 'input' | 'output';
  position: 'left' | 'right';
  verticalPosition?: number | string;
}

export const HandleLabel = ({ nodeType, handleId, handleType, position, verticalPosition = '50%' }: HandleLabelProps) => {
  const handles = getNodeHandles(nodeType);
  const handleList = handleType === 'input' ? handles.inputs : handles.outputs;
  const handle = handleList.find((h) => h.id === handleId);

  if (!handle) return null;

  const typeConfig = getDataTypeConfig(handle.dataType);

  const style: React.CSSProperties = {
    position: 'absolute',
    [position]: 0,
    top: typeof verticalPosition === 'number' ? `${verticalPosition}px` : verticalPosition,
    transform: position === 'left' 
      ? 'translateX(-100%) translateY(-50%)' 
      : 'translateX(100%) translateY(-50%)',
    fontSize: 10,
    fontWeight: 600,
    color: typeConfig.color,
    padding: '2px 6px',
    borderRadius: 4,
    backgroundColor: typeConfig.backgroundColor,
    border: `1px solid ${typeConfig.borderColor}`,
    whiteSpace: 'nowrap',
    zIndex: 10,
  };

  return (
    <div style={style}>
      {handle.label}
    </div>
  );
};

