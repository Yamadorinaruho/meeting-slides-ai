import { Mastra } from '@mastra/core';
import { visionAgent } from './agents/vision.agent';
import { narratorAgent } from './agents/narrator.agent';
import { imageValidationTool } from './tools/camera.tool';
import { narrationWorkflow } from './workflows/narration.workflow';

// Mastraインスタンスの作成（最新API）
export const mastra = new Mastra({
  agents: {
    visionAgent,
    narratorAgent,
  },
  tools: {
    'image-validation': imageValidationTool,
  },
  workflows: {
    'narration-workflow': narrationWorkflow,
  },
});