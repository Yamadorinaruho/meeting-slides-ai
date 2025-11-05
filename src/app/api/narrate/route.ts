import { mastra } from '@/mastra';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { cameraImageBase64, screenImages } = await request.json();

    if (!cameraImageBase64 || !screenImages || !Array.isArray(screenImages) || screenImages.length === 0) {
      return NextResponse.json(
        { error: 'cameraImageBase64 and screenImages (array) are required' },
        { status: 400 }
      );
    }

    console.log(`🎙️ Starting multi-screen narration workflow (${screenImages.length} screens)...`);

    // 最新のMastra API
    const workflow = mastra.getWorkflow('narration-workflow');

    // Workflow実行（カメラ + 複数画面）
    const run = await workflow.createRunAsync();
    const result = await run.start({
      inputData: {
        cameraImageBase64,
        screenImages
      }
    });

    console.log('✅ Workflow completed successfully');

    if (result.status !== 'success') {
      throw new Error('Workflow execution failed');
    }

    // ワークフローの最終出力を取得
    const { audioBase64, mimeType } = result.result;

    // 各ステップの結果も取得可能
    const validationResult = result.steps?.['validate-image'];
    const analysisResult = result.steps?.['analyze-image'];
    const narrationResult = result.steps?.['generate-narration'];

    return NextResponse.json({
      audioBase64,
      mimeType,
      narration: narrationResult?.status === 'success' ? narrationResult.output.narration : undefined,
      analysis: analysisResult?.status === 'success' ? analysisResult.output.analysis : undefined,
      validation: validationResult?.status === 'success' ? validationResult.output : undefined,
      workflowStatus: 'completed',
    });
  } catch (error: any) {
    console.error('❌ Workflow execution error:', error);
    return NextResponse.json(
      {
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        workflowStatus: 'failed',
      },
      { status: 500 }
    );
  }
}