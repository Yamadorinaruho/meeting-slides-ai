import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const imageValidationToolInput = z.object({
  imageBase64: z.string().describe('Base64 encoded image data'),
});

export const imageValidationToolOutput = z.object({
  isValid: z.boolean(),
  width: z.number().optional(),
  height: z.number().optional(),
  format: z.string().optional(),
  sizeKB: z.number().optional(),
  timestamp: z.string(),
});

export const imageValidationTool = createTool({
  id: 'image-validation',
  description: 'Validates and extracts metadata from base64 image data',
  inputSchema: imageValidationToolInput,
  outputSchema: imageValidationToolOutput,
  execute: async ({ context }) => {
    const { imageBase64 } = context;
    
    try {
      // Base64の形式チェック
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return {
          isValid: false,
          timestamp: new Date().toISOString(),
        };
      }
      
      // サイズ計算（Base64のサイズからおおよそのバイト数を推定）
      const sizeKB = Math.round((imageBase64.length * 3) / 4 / 1024);
      
      // 画像形式の推定（先頭の数バイトから）
      let format = 'unknown';
      if (imageBase64.startsWith('/9j/')) format = 'jpeg';
      else if (imageBase64.startsWith('iVBORw')) format = 'png';
      else if (imageBase64.startsWith('R0lGOD')) format = 'gif';
      
      return {
        isValid: true,
        format,
        sizeKB,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Image validation error:', error);
      return {
        isValid: false,
        timestamp: new Date().toISOString(),
      };
    }
  },
});