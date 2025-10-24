export async function POST(request: Request) {
    try {
      const { imageBase64, audioLevel, speechContent } = await request.json();
      
      console.log('=== Analyze API Called ===');
      console.log('Audio Level:', audioLevel);
      console.log('Speech Content:', speechContent);
      
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
                text: `You are analyzing a workspace environment for productivity tracking purposes. This is a consenting user's own self-monitoring system for personal use only.
  
  Analyze the workspace and person's current state to provide productivity insights.
  
  Respond ONLY with valid JSON in this exact format:
  
  {
    "activity": "typing",
    "posture": "upright",
    "expression": "focused",
    "eyeContact": "screen",
    "focusLevel": "high",
    "energyLevel": "normal",
    "mood": "calm"
  }
  
  Options:
  - activity: "typing" | "reading" | "phone" | "eating" | "talking" | "away" | "relaxing" | "thinking" | "unknown"
  - posture: "upright" | "slouched" | "leaning" | "lying"
  - expression: "focused" | "neutral" | "tired" | "happy" | "stressed" | "not_visible"
  - eyeContact: "screen" | "phone" | "away" | "closed" | "camera"
  - focusLevel: "high" | "medium" | "low"
  - energyLevel: "energetic" | "normal" | "tired"
  - mood: "calm" | "happy" | "stressed" | "frustrated" | "relaxed"
  
  Return ONLY the JSON object. No markdown, no code blocks, no explanation.`
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
              }
            ]
          }],
          max_tokens: 200,
          temperature: 0.3
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', errorData);
        return Response.json({ 
          error: errorData.error?.message || 'API Error' 
        }, { status: response.status });
      }
      
      const data = await response.json();
      const content = data.choices[0].message.content;
      
      console.log('=== GPT-4 Response ===');
      console.log(content);
      
      // GPT-4が拒否した場合の検出
      if (content.includes("I'm sorry") || content.includes("I can't") || content.includes("I cannot")) {
        console.log('GPT-4 refused to analyze. Using fallback.');
        
        // フォールバック値を返す
        const fallbackResult = {
          visual: {
            activity: 'unknown',
            posture: 'upright',
            expression: 'neutral',
            eyeContact: 'screen'
          },
          audio: {
            environmentType: audioLevel < 20 ? ['silence'] : 
                            audioLevel < 40 ? ['quiet'] : 
                            audioLevel < 60 ? ['moderate'] : ['noisy']
          },
          inference: {
            focusLevel: 'medium',
            energyLevel: 'normal',
            mood: 'calm'
          }
        };
        
        return Response.json(fallbackResult);
      }
      
      // JSONを抽出（複数の方法を試す）
      let result = null;
      
      // 方法1: ```json ``` で囲まれている場合
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        try {
          result = JSON.parse(codeBlockMatch[1].trim());
          console.log('Parsed from code block');
        } catch (e) {
          console.log('Code block parse failed:', e);
        }
      }
      
      // 方法2: { } のみを抽出
      if (!result) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
            console.log('Parsed from JSON match');
          } catch (e) {
            console.log('JSON match parse failed:', e);
          }
        }
      }
      
      // 方法3: 全体をパース
      if (!result) {
        try {
          result = JSON.parse(content.trim());
          console.log('Parsed from raw content');
        } catch (e) {
          console.log('Raw content parse failed:', e);
        }
      }
      
      if (!result) {
        console.error('Failed to parse JSON from:', content);
        
        // パース失敗時のフォールバック
        const fallbackResult = {
          visual: {
            activity: 'unknown',
            posture: 'upright',
            expression: 'neutral',
            eyeContact: 'screen'
          },
          audio: {
            environmentType: audioLevel < 20 ? ['silence'] : 
                            audioLevel < 40 ? ['quiet'] : 
                            audioLevel < 60 ? ['moderate'] : ['noisy']
          },
          inference: {
            focusLevel: 'medium',
            energyLevel: 'normal',
            mood: 'calm'
          }
        };
        
        return Response.json(fallbackResult);
      }
      
      console.log('=== Parsed Result ===');
      console.log(JSON.stringify(result, null, 2));
      
      // 環境音のタイプを判定
      const envTypes: string[] = [];
      if (audioLevel < 20) envTypes.push('silence');
      else if (audioLevel < 40) envTypes.push('quiet');
      else if (audioLevel < 60) envTypes.push('moderate');
      else envTypes.push('noisy');
      
      if (result.activity === 'typing') envTypes.push('typing');
      if (speechContent) envTypes.push('speech');
      
      const response_data = {
        visual: {
          activity: result.activity || 'unknown',
          posture: result.posture || 'upright',
          expression: result.expression || 'neutral',
          eyeContact: result.eyeContact || 'screen'
        },
        audio: {
          environmentType: envTypes
        },
        inference: {
          focusLevel: result.focusLevel || 'medium',
          energyLevel: result.energyLevel || 'normal',
          mood: result.mood || 'calm'
        }
      };
      
      console.log('=== Final Response ===');
      console.log(JSON.stringify(response_data, null, 2));
      
      return Response.json(response_data);
      
    } catch (error: any) {
      console.error('Analyze API Error:', error);
      
      // エラー時のフォールバック
      return Response.json({
        visual: {
          activity: 'unknown',
          posture: 'upright',
          expression: 'neutral',
          eyeContact: 'screen'
        },
        audio: {
          environmentType: ['quiet']
        },
        inference: {
          focusLevel: 'medium',
          energyLevel: 'normal',
          mood: 'calm'
        }
      });
    }
  }