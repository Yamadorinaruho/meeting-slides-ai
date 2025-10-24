// app/api/transcribe/route.ts
export async function POST(request: Request) {
    try {
      const formData = await request.formData();
      const audioFile = formData.get('audio') as File;
      
      if (!audioFile) {
        return Response.json({ error: 'No audio file provided' }, { status: 400 });
      }
      
      console.log('=== Whisper API Called ===');
      console.log('Audio file size:', audioFile.size, 'bytes');
      
      // OpenAI Whisper APIに送信
      const whisperFormData = new FormData();
      whisperFormData.append('file', audioFile);
      whisperFormData.append('model', 'whisper-1');
      whisperFormData.append('language', 'ja');
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: whisperFormData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Whisper API Error:', errorData);
        throw new Error(`Whisper API Error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('=== Transcription ===');
      console.log(data.text);
      
      return Response.json({ text: data.text });
      
    } catch (error: any) {
      console.error('Transcribe API Error:', error);
      return Response.json({ 
        error: error.message 
      }, { status: 500 });
    }
  }