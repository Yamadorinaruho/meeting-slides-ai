export async function POST(request: Request) {
    try {
      const {
        currentImage,
        currentNoise,
        currentTime,
        summary30min,
        totalEntries,
        recentActivities,
        userQuestion
      } = await request.json();
      
      const now = new Date(currentTime);
      const hour = now.getHours();
      const minute = now.getMinutes();
      const totalMinutes = Math.round(totalEntries / 6);
      const dayOfWeek = now.getDay();
      
      // 音声データの収集
      const allSpeech = recentActivities
        .filter((a: any) => a.speech && a.speech.trim().length > 0)
        .map((a: any) => ({
          time: new Date(a.time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
          content: a.speech
        }));
      
      console.log('=== Coach API Called ===');
      console.log('Time:', `${['日', '月', '火', '水', '木', '金', '土'][dayOfWeek]}曜日 ${hour}:${minute}`);
      console.log('Total Minutes:', totalMinutes);
      console.log('Noise:', currentNoise, 'dB');
      console.log('Speech detected:', allSpeech.length, 'times');
      console.log('User Question:', userQuestion || 'なし');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a strict but caring life coach observing someone's daily life through their workspace camera and microphone for personal productivity insights. This is a consenting user's self-monitoring system.
  
  ${userQuestion ? `
  【🎯 ユーザーからの質問】
  "${userQuestion}"
  
  この質問に対して、画像と以下のデータを見て、的確に答えてください。
  ` : `
  【🤖 定期アドバイス】
  画像と以下のデータから、今この人に最も必要なアドバイスを厳しく、具体的に伝えてください。
  `}
  
  【現在の状況】
  - **日時**: ${['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'][dayOfWeek]} ${hour}時${minute}分
  - **連続作業時間**: ${totalMinutes}分
  - **環境音**: ${currentNoise}dB
  
  【過去の行動データ（時系列、最新20件）】
  ${recentActivities.slice(-20).map((entry: any, index: number) => {
    const time = new Date(entry.time);
    const timeStr = time.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${index + 1}. ${timeStr}
     └ 行動: ${entry.activity}
     └ 姿勢: ${entry.posture}
     └ 表情: ${entry.expression}
     └ エネルギー: ${entry.energy}
     └ 気分: ${entry.mood}${entry.speech ? `\n   └ 🎤 発話: "${entry.speech}"` : ''}`;
  }).join('\n\n')}
  
  ${allSpeech.length > 0 ? `
  【💬 発話の履歴】
  ${allSpeech.map((s: any, i: number) => `${i + 1}. [${s.time}] "${s.content}"`).join('\n')}
  
  発話から読み取れること：
  - 何の作業をしている？
  - どんな気持ち？（疲労、イライラ、楽しい、困惑）
  - 誰かと話している？独り言？
  - 愚痴や不満？
  ` : ''}
  
  画像とデータを総合的に見て、今最も必要なことを、厳しい先生として2-3文で日本語で伝えなさい。`
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${currentImage}` }
              }
            ]
          }],
          max_tokens: 400,
          temperature: 1.0
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', errorData);
        return Response.json({ 
          message: `エラーだ。でも${totalMinutes}分頑張ってるな。休憩しなさい`
        });
      }
      
      const data = await response.json();
      const message = data.choices[0].message.content.trim();
      
      console.log('=== Coach Response ===');
      console.log(message);
      
      if (!message || message.length < 5) {
        return Response.json({ 
          message: `${totalMinutes}分お疲れだな。水を飲んで休憩しろ`
        });
      }
      
      return Response.json({ message });
      
    } catch (error: any) {
      console.error('Coach API Error:', error);
      return Response.json({ 
        message: 'エラーだ。とにかく水を飲んで休憩しなさい'
      });
    }
  }