// src/mastra/tools/camera-tool.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const analyzeCameraTool = createTool({
  id: 'analyze-camera',
  description: 'カメラ画像からユーザーの集中度を分析する。姿勢、表情、動きから high/medium/low を判定',
  inputSchema: z.object({
    imageBase64: z.string().describe('Base64エンコードされたカメラ画像'),
  }),
  outputSchema: z.object({
    focusLevel: z.enum(['high', 'medium', 'low']).describe('集中度'),
    posture: z.string().describe('姿勢の説明'),
    expression: z.string().describe('表情の説明'),
    confidence: z.number().describe('判定の信頼度 0-1'),
  }),
  execute: async ({ context }) => {
    const { imageBase64 } = context;
    
    // GPT-4 Visionで画像分析
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `
デスクワーカーの集中状態を分析してください。

判定基準:
- high: 前のめり、真剣な表情、動きが少ない
- medium: 普通に座っている
- low: 姿勢が崩れている、疲れた表情

JSON形式:
{
  "focusLevel": "high" | "medium" | "low",
  "posture": "姿勢の説明",
  "expression": "表情の説明",
  "confidence": 0.0-1.0
}
`
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
              }
            ]
          }
        ],
        max_tokens: 300
      })
    });
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('JSON parse error:', error);
    }
    
    // フォールバック
    return {
      focusLevel: 'medium' as const,
      posture: '分析できませんでした',
      expression: '分析できませんでした',
      confidence: 0.5,
    };
  },
});