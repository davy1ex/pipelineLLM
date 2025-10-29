import type { NodeTemplate } from '../../model/nodeRegistry';
import { textInputTemplate } from './text-input/template';
import { ollamaMockTemplate } from './ollama/template';
import { settingsTemplate } from './settings/template';
import { outputTemplate } from './output/template';

export const uiNodeTemplates: NodeTemplate[] = [
  textInputTemplate,
  ollamaMockTemplate,
  settingsTemplate,
  outputTemplate,
];


