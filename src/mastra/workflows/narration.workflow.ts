import { createWorkflow, createStep } from '@mastra/core';
import { z } from 'zod';
import { activitySchema, visionAgent } from '../agents/vision.agent';
import { narratorAgent } from '../agents/narrator.agent';
import { imageValidationTool } from '../tools/camera.tool';

// Step 1: 画像バリデーション（カメラと画面）
const validateImageStep = createStep({
  id: 'validate-image',
  inputSchema: z.object({
    cameraImageBase64: z.string(),
    screenImages: z.array(z.string()),
  }),
  outputSchema: z.object({
    cameraIsValid: z.boolean(),
    screensValid: z.array(z.boolean()),
    timestamp: z.string(),
    cameraImageBase64: z.string(),
    screenImages: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const { cameraImageBase64, screenImages } = inputData;

    // カメラ画像のバリデーション
    const cameraResult = await imageValidationTool.execute({
      context: { imageBase64: cameraImageBase64 },
    });

    // 画面のバリデーション（最初の1つだけ）
    const screenResult = await imageValidationTool.execute({
      context: { imageBase64: screenImages[0] },
    });

    if (!cameraResult.isValid || !screenResult.isValid) {
      throw new Error('Invalid image data');
    }

    console.log('✅ Camera & Screen validated');
    return {
      cameraIsValid: cameraResult.isValid,
      screensValid: [screenResult.isValid],
      timestamp: cameraResult.timestamp,
      cameraImageBase64,
      screenImages,
    };
  },
});

// Step 2: 画像分析（カメラと画面を同時に）
const analyzeImageStep = createStep({
  id: 'analyze-image',
  inputSchema: z.object({
    cameraIsValid: z.boolean(),
    screensValid: z.array(z.boolean()),
    timestamp: z.string(),
    cameraImageBase64: z.string(),
    screenImages: z.array(z.string()),
  }),
  outputSchema: z.object({
    cameraAnalysis: activitySchema,
    screenAnalyses: z.array(z.object({
      content: z.string().describe('画面に表示されている内容の詳細'),
      activity: z.string().describe('画面上で何をしているか（コーディング、ブラウジング、動画視聴など）'),
      application: z.string().describe('使用しているアプリケーションやウェブサイト'),
    })),
  }),
  execute: async ({ inputData }) => {
    const { cameraImageBase64, screenImages } = inputData;

    // カメラ画像の分析
    const cameraResult = await visionAgent.generate(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze the person in this camera image in detail' },
            { type: 'image', image: `data:image/jpeg;base64,${cameraImageBase64}` },
          ],
        },
      ],
      {
        structuredOutput: { schema: activitySchema },
      }
    );

    // 画面画像の分析（最初の1つだけ）
    const screenSchema = z.object({
      content: z.string().describe('画面に表示されている内容の詳細'),
      activity: z.string().describe('画面上で何をしているか（コーディング、ブラウジング、動画視聴など）'),
      application: z.string().describe('使用しているアプリケーションやウェブサイト'),
    });

    const screenResult = await visionAgent.generate(
      [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this screen capture. What is displayed? What application or website is being used? What activity is being performed?',
            },
            { type: 'image', image: `data:image/jpeg;base64,${screenImages[0]}` },
          ],
        },
      ],
      {
        structuredOutput: { schema: screenSchema },
      }
    );

    console.log('✅ Camera analyzed:', cameraResult.object);
    console.log('✅ Screen analyzed:', screenResult.object);

    return {
      cameraAnalysis: cameraResult.object,
      screenAnalyses: [screenResult.object],
    };
  },
});

// Step 3: 実況文生成（カメラと画面を統合）
const generateNarrationStep = createStep({
  id: 'generate-narration',
  inputSchema: z.object({
    cameraAnalysis: activitySchema,
    screenAnalyses: z.array(z.object({
      content: z.string(),
      activity: z.string(),
      application: z.string(),
    })),
  }),
  outputSchema: z.object({ narration: z.string() }),
  execute: async ({ inputData }) => {
    const { cameraAnalysis, screenAnalyses } = inputData;

    // 最初の画面（メイン画面）を使用
    const screenAnalysis = screenAnalyses[0];

    const prompt = `
【カメラ（本人の様子）】
活動: ${cameraAnalysis.activity}
気分: ${cameraAnalysis.mood}
姿勢: ${cameraAnalysis.posture}
詳細: ${cameraAnalysis.details}
周囲の物: ${cameraAnalysis.objects?.join(', ') || 'なし'}
環境: ${cameraAnalysis.environment}

【画面（PC作業内容）】
表示内容: ${screenAnalysis.content}
作業内容: ${screenAnalysis.activity}
アプリ/サイト: ${screenAnalysis.application}

本人の様子とPC画面の両方を見て、今何をしているのか、熱血スポーツ実況風に実況してください！
画面で何をしているか、その人がどんな状態で取り組んでいるかを2-3文で、エキサイティングに！
`;

    const result = await narratorAgent.generate(prompt);

    console.log('✅ Narration generated:', result.text);
    return { narration: result.text };
  },
});

// Step 4: 音声合成
const synthesizeSpeechStep = createStep({
  id: 'synthesize-speech',
  inputSchema: z.object({ narration: z.string() }),
  outputSchema: z.object({
    audioBase64: z.string(),
    mimeType: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { narration } = inputData;

    console.log('🔊 Synthesizing speech for:', narration);

    // OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'alloy',
        input: narration,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTS API failed (${response.status}): ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    console.log('✅ Audio synthesized, size:', audioBase64.length);

    return {
      audioBase64,
      mimeType: 'audio/mpeg',
    };
  },
});

// Workflow定義（最新API）
export const narrationWorkflow = createWorkflow({
  id: 'narration-workflow',
  inputSchema: z.object({
    cameraImageBase64: z.string(),
    screenImages: z.array(z.string()),
  }),
  outputSchema: z.object({
    audioBase64: z.string(),
    mimeType: z.string(),
  }),
})
  .then(validateImageStep)
  .then(analyzeImageStep)
  .then(generateNarrationStep)
  .then(synthesizeSpeechStep)
  .commit();
