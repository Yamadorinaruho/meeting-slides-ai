import { Mastra } from '@mastra/core';
import { focusCoachAgent } from './agents/focus-coach';

export const mastra = new Mastra({
  agents: {
    focusCoach: focusCoachAgent,
  },
});