/**
 * Data types system for nodes inputs/outputs
 */

export type DataType = 'json' | 'string' | 'number' | 'boolean' | 'any';

export interface DataTypeConfig {
  type: DataType;
  label: string;
  color: string;
  borderColor: string;
  backgroundColor: string;
}

/**
 * Color scheme for different data types
 */
export const DATA_TYPE_COLORS: Record<DataType, DataTypeConfig> = {
  json: {
    type: 'json',
    label: 'JSON',
    color: '#ea580c', // orange-600
    borderColor: '#f97316', // orange-500
    backgroundColor: '#fff7ed', // orange-50
  },
  string: {
    type: 'string',
    label: 'String',
    color: '#0284c7', // sky-600
    borderColor: '#0ea5e9', // sky-500
    backgroundColor: '#f0f9ff', // sky-50
  },
  number: {
    type: 'number',
    label: 'Number',
    color: '#059669', // emerald-600
    borderColor: '#10b981', // emerald-500
    backgroundColor: '#ecfdf5', // emerald-50
  },
  boolean: {
    type: 'boolean',
    label: 'Boolean',
    color: '#7c3aed', // violet-600
    borderColor: '#8b5cf6', // violet-500
    backgroundColor: '#f5f3ff', // violet-50
  },
  any: {
    type: 'any',
    label: 'Any',
    color: '#6b7280', // gray-600
    borderColor: '#9ca3af', // gray-500
    backgroundColor: '#f9fafb', // gray-50
  },
};

/**
 * Get data type config by type name
 */
export const getDataTypeConfig = (type: DataType = 'any'): DataTypeConfig => {
  return DATA_TYPE_COLORS[type] || DATA_TYPE_COLORS.any;
};

export const getDataTypeColor = (type: DataType = 'any'): string => {
  return getDataTypeConfig(type).color;
};
/**
 * Node handle configuration
 */
export interface NodeHandle {
  id: string;
  type: 'input' | 'output';
  dataType: DataType;
  label: string;
}

