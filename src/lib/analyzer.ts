export interface AnalysisResult {
    visual: {
      activity: string;
      posture: string;
      expression: string;
      eyeContact: string;
    };
    audio: {
      environmentType: string[];
    };
    inference: {
      focusLevel: string;
      energyLevel: string;
      mood: string;
    };
  }
  
  export async function analyzeSnapshot(
    imageBase64: string,
    audioLevel: number,
    speechContent: string
  ): Promise<AnalysisResult> {
    
    // GPT-4 Visionで画像を分析
    try {
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
                text: `この画像から以下を判定してください。
  
  【判定項目】
  1. activity: "typing" | "reading" | "phone" | "eating" | "talking" | "away" | "relaxing" | "exercising" | "unknown"
  2. posture: "upright" | "slouched" | "leaning" | "lying"
  3. expression: "focused" | "neutral" | "tired" | "happy" | "stressed" | "not_visible"
  4. eyeContact: "screen" | "phone" | "away" | "closed"
  5. focusLevel: "high" | "medium" | "low"
  6. energyLevel: "energetic" | "normal" | "tired"
  7. mood: "calm" | "happy" | "stressed" | "frustrated"
  
  JSON形式で返してください:
  {
    "activity": "...",
    "posture": "...",
    "expression": "...",
    "eyeContact": "...",
    "focusLevel": "...",
    "energyLevel": "...",
    "mood": "..."
  }`
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
              }
            ]
          }],
          max_tokens: 200
        })
      });
      
      const data = await response.json();
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        
        // 環境音の推測
        const envTypes: string[] = [];
        if (audioLevel < 20) envTypes.push('silence');
        else if (audioLevel < 40) envTypes.push('quiet');
        else if (audioLevel < 60) envTypes.push('moderate');
        else envTypes.push('noisy');
        
        if (result.activity === 'typing') envTypes.push('typing');
        if (speechContent) envTypes.push('speech');
        
        return {
          visual: {
            activity: result.activity,
            posture: result.posture,
            expression: result.expression,
            eyeContact: result.eyeContact
          },
          audio: {
            environmentType: envTypes
          },
          inference: {
            focusLevel: result.focusLevel,
            energyLevel: result.energyLevel,
            mood: result.mood
          }
        };
      }
    } catch (error) {
      console.error('Analysis error:', error);
    }
    
    // フォールバック
    return {
      visual: {
        activity: 'unknown',
        posture: 'unknown',
        expression: 'not_visible',
        eyeContact: 'away'
      },
      audio: {
        environmentType: ['unknown']
      },
      inference: {
        focusLevel: 'medium',
        energyLevel: 'normal',
        mood: 'calm'
      }
    };
  }