import type { NodeTemplate } from '../../shared/lib/nodeTemplate';
import { textInputTemplate } from './text-input/template';
import { ollamaMockTemplate } from './ollama/template';
import { settingsTemplate } from './settings/template';
import { outputTemplate } from './output/template';
import { pythonTemplate } from './python/template';
import { fileWriterTemplate } from './file-writer/template';

export const uiNodeTemplates: NodeTemplate[] = [
  textInputTemplate,
  ollamaMockTemplate,
  settingsTemplate,
  outputTemplate,
  pythonTemplate,
  fileWriterTemplate,
];


