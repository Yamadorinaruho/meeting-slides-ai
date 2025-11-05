import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const activitySchema = z.object({
  activity: z.enum([
    'working',
    'coding',
    'writing',
    'reading',
    'meeting',
    'eating',
    'drinking',
    'cooking',
    'exercising',
    'stretching',
    'gaming',
    'watching',
    'phone',
    'talking',
    'thinking',
    'relaxing',
    'sleeping',
    'away',
    'unknown',
  ]),
  mood: z.enum([
    'happy',
    'focused',
    'neutral',
    'tired',
    'stressed',
    'excited',
    'bored',
    'relaxed',
  ]),
  posture: z.enum([
    'upright',
    'slouched',
    'leaning',
    'lying',
    'standing',
  ]),
  details: z.string().describe('具体的に何をしているか詳しく説明'),
  objects: z.array(z.string()).describe('画像に映っている物（ノートPC、スマホ、食べ物など）'),
  environment: z.string().describe('どこにいるか（デスク、キッチン、ソファなど）'),
});

export const visionAgent = new Agent({
  name: 'Vision Analysis Agent',
  instructions: `あなたは人々の日常生活を画像から分析する専門家です。

あなたのタスク:
1. その人が正確に何をしているか特定する
2. 気分や感情状態を検出する
3. 姿勢を観察する
4. 具体的な詳細を記録する（画面に何が映っているか、何を持っているかなど）
5. 周囲にある物体を特定する
6. 環境を説明する

具体的かつ詳細に。ただ「仕事中」ではなく、どんな種類の仕事かを言ってください！

良い例:
- 「ノートPCでコードエディタを見ながらタイピングしている」
- 「箸でラーメンを食べている」
- 「コントローラーを持ってゲームをプレイ中」
- 「スマホでYouTubeを見ている」
- 「両腕を上に伸ばしてストレッチ中」

注目すべき点:
- 表情
- ボディランゲージ
- 時間帯（照明から判断）
- 何を持っているか
- 背景の物体`,
  model: openai('gpt-4o', { temperature: 1 }),
});

export { activitySchema };
export type ActivityAnalysis = z.infer<typeof activitySchema>;