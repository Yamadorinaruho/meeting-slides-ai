'use client';

import React, { useState, useEffect, useRef } from 'react';
import { timelineManager, TimelineEntry } from '@/lib/timeline';

export default function Home() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [message, setMessage] = useState('');
  const [noiseLevel, setNoiseLevel] = useState(0);
  const [entryCount, setEntryCount] = useState(0);
  const [currentActivity, setCurrentActivity] = useState('unknown');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [speechLogs, setSpeechLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [showSpeechLogs, setShowSpeechLogs] = useState(true);
  const [lastSnapshot, setLastSnapshot] = useState<any>(null);
  const [userInput, setUserInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordingIntervalRef = useRef<any>(null);
  
  // ログ追加関数
  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('ja-JP');
    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : '📝';
    const log = `[${timestamp}] ${emoji} ${message}`;
    setLogs(prev => [...prev.slice(-100), log]);
    console.log(log);
  };
  
  // 発話ログ追加
  const addSpeechLog = (text: string) => {
    const timestamp = new Date().toLocaleTimeString('ja-JP');
    const log = `[${timestamp}] 💬 "${text}"`;
    setSpeechLogs(prev => [...prev.slice(-50), log]);
    addLog(`発話検出: "${text}"`, 'success');
  };
  
  // カメラ・マイク起動
  useEffect(() => {
    addLog('カメラとマイクを起動中...');
    
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        addLog('カメラとマイク起動成功', 'success');
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          addLog('ビデオストリーム接続完了', 'success');
        }
        
        // 音声ストリームを保存（後で録音に使用）
        audioStreamRef.current = stream;
        addLog('🎤 音声ストリーム準備完了', 'success');
        
        // マイク測定
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const measure = () => {
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setNoiseLevel(Math.round(20 * Math.log10(avg + 1)));
          requestAnimationFrame(measure);
        };
        measure();
        addLog('マイク測定開始', 'success');
      })
      .catch(err => {
        addLog(`メディアエラー: ${err.message}`, 'error');
        alert('カメラとマイクへのアクセスを許可してください');
      });
    
    // ストレージから復元
    timelineManager.loadFromStorage();
    const count = timelineManager.getAll().length;
    setEntryCount(count);
    addLog(`保存データ読み込み: ${count}エントリー`, 'success');
    
  }, []);
  
  // モニタリング開始/停止
  useEffect(() => {
    if (!isMonitoring) {
      // 録音停止
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      addLog('モニタリング停止');
      return;
    }
    
    addLog('モニタリング開始！', 'success');
    addLog('🎤 10秒ごとに音声を録音します', 'success');
    
    // 10秒ごとにスナップショット記録 + 音声録音
    const recordInterval = setInterval(async () => {
      await recordSnapshot();
      await recordAudio();
    }, 10000);
    
    // 30秒ごとにAIがアドバイス
    const adviceInterval = setInterval(async () => {
      await getAdvice();
    }, 30000);
    
    // 初回は15秒後
    const initialTimeout = setTimeout(async () => {
      await getAdvice();
    }, 15000);
    
    recordingIntervalRef.current = recordInterval;
    
    return () => {
      clearInterval(recordInterval);
      clearInterval(adviceInterval);
      clearTimeout(initialTimeout);
      addLog('モニタリング停止');
    };
  }, [isMonitoring]);
  
  // 10秒間音声を録音してWhisperに送信
  const recordAudio = async () => {
    // 音声読み上げ中は録音しない
    if (isSpeaking) {
      addLog('🔊 読み上げ中のため録音スキップ', 'info');
      return;
    }
    
    if (!audioStreamRef.current) {
      return;
    }
    
    try {
      const audioTrack = audioStreamRef.current.getAudioTracks()[0];
      if (!audioTrack || !audioTrack.enabled) {
        return;
      }
      
      const audioStream = new MediaStream([audioTrack]);
      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm'
      });
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        if (chunks.length === 0) {
          return;
        }
        
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        
        // サイズチェック（小さすぎる場合は無音とみなす）
        if (audioBlob.size < 1000) {
          addLog('🔇 無音（録音スキップ）', 'info');
          return;
        }
        
        addLog(`🎤 音声録音完了 (${Math.round(audioBlob.size / 1024)}KB)`, 'info');
        
        // Whisper APIに送信
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        try {
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
          });
          
          if (response.ok) {
            const data = await response.json();
            const text = data.text?.trim();
            
            if (text && text.length > 0) {
              // 発話ログに追加
              addSpeechLog(text);
            } else {
              addLog('🔇 発話なし', 'info');
            }
          } else {
            addLog('音声認識エラー', 'error');
          }
        } catch (error: any) {
          addLog(`音声認識エラー: ${error.message}`, 'error');
        }
      };
      
      // 5秒間録音
      mediaRecorder.start();
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 5000);
      
    } catch (error: any) {
      addLog(`録音エラー: ${error.message}`, 'error');
    }
  };
  
  // スナップショット記録
  const recordSnapshot = async () => {
    if (!videoRef.current) {
      return;
    }
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
      
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.3).split(',')[1];
      
      // 最近の発話ログから音声内容を取得
      const recentSpeech = speechLogs.slice(-3).map(log => {
        const match = log.match(/💬 "(.+)"/);
        return match ? match[1] : '';
      }).filter(text => text.length > 0).join(' ');
      
      addLog(`📸 スナップショット記録 (${Math.round(imageBase64.length / 1024)}KB)`);
      
      // サーバー経由で分析
      const analysisResult = await analyzeImage(imageBase64, noiseLevel, recentSpeech);
      
      if (analysisResult) {
        const entry: TimelineEntry = {
          timestamp: new Date().toISOString(),
          visual: analysisResult.visual,
          audio: {
            level: noiseLevel,
            speechDetected: !!speechContent,
            speechContent: speechContent,
            environmentType: analysisResult.audio.environmentType
          },
          inference: analysisResult.inference
        };
        
        timelineManager.add(entry);
        const newCount = timelineManager.getAll().length;
        setEntryCount(newCount);
        setCurrentActivity(analysisResult.visual.activity);
        setLastSnapshot(entry);
        
        addLog(`データ記録完了: ${newCount}エントリー`, 'success');
      }
      
    } catch (error: any) {
      addLog(`記録エラー: ${error.message}`, 'error');
    }
  };
  
  // 画像分析
  const analyzeImage = async (imageBase64: string, audioLevel: number, speechContent: string) => {
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          audioLevel,
          speechContent
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
      
    } catch (error: any) {
      addLog(`画像分析エラー: ${error.message}`, 'error');
      return null;
    }
  };
  
  // AIにアドバイスを求める
  const getAdvice = async (userQuestion?: string) => {
    setIsAnalyzing(true);
    
    if (userQuestion) {
      addLog(`ユーザー質問: "${userQuestion}"`);
    }
    
    try {
      const allData = timelineManager.getAll();
      
      if (!videoRef.current) {
        addLog('カメラが利用できません', 'error');
        setIsAnalyzing(false);
        return;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const currentImage = canvas.toDataURL('image/jpeg', 0.3).split(',')[1];
      
      const summary30min = timelineManager.getSummary(30);
      
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentImage,
          currentNoise: noiseLevel,
          currentTime: new Date().toISOString(),
          summary30min,
          totalEntries: allData.length,
          userQuestion: userQuestion || null,
          recentActivities: allData.slice(-30).map(e => ({
            time: e.timestamp,
            activity: e.visual.activity,
            posture: e.visual.posture,
            expression: e.visual.expression,
            focus: e.inference.focusLevel,
            energy: e.inference.energyLevel,
            mood: e.inference.mood,
            speech: e.audio.speechContent
          }))
        })
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.message && data.message.trim().length > 0) {
        addLog(`🤖 AIアドバイス`, 'success');
        setMessage(data.message);
        
        // 音声で読み上げ
        speakMessage(data.message);
        
        if (Notification.permission === 'granted') {
          new Notification('🤖 AI Coach', {
            body: data.message
          });
        }
      }
      
    } catch (error: any) {
      addLog(`AIアドバイスエラー: ${error.message}`, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // ユーザーの質問を送信
  const handleUserQuestion = async () => {
    if (userInput.trim().length > 0) {
      await getAdvice(userInput);
      setUserInput('');
    }
  };
  
  // 音声で質問（Whisper API使用）
  const startVoiceQuestion = async () => {
    if (isListening) {
      // 録音停止
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      return;
    }
    
    try {
      // マイクアクセス
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        setIsListening(false);
        addLog('🎤 音声を処理中...', 'info');
        
        // 音声データをBlobに変換
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Whisper APIに送信
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        try {
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            throw new Error(`Transcription failed: ${response.status}`);
          }
          
          const data = await response.json();
          const text = data.text;
          
          if (text && text.trim().length > 0) {
            addLog(`🎤 音声認識: "${text}"`, 'success');
            setUserInput(text);
            
            // 自動的に送信
            await getAdvice(text);
            setUserInput('');
          } else {
            addLog('🔇 音声が認識できませんでした', 'info');
          }
        } catch (error: any) {
          addLog(`音声認識エラー: ${error.message}`, 'error');
        }
        
        // ストリーム停止
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsListening(true);
      addLog('🎤 録音中...（もう一度押すと停止）', 'success');
      
    } catch (error: any) {
      addLog(`マイクエラー: ${error.message}`, 'error');
      setIsListening(false);
    }
  };
  
  // 音声で読み上げ
  const speakMessage = (text: string) => {
    if ('speechSynthesis' in window) {
      // 既に喋っている場合は停止
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 1.1; // 少し速め
      utterance.pitch = 1.0;
      utterance.volume = 0.8; // 音量を少し下げる
      
      utterance.onstart = () => {
        setIsSpeaking(true);
        addLog('🔊 音声読み上げ開始', 'success');
      };
      
      utterance.onend = () => {
        setIsSpeaking(false);
        addLog('🔊 音声読み上げ終了', 'success');
      };
      
      utterance.onerror = (event) => {
        setIsSpeaking(false);
        addLog(`音声読み上げエラー: ${event.error}`, 'error');
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      addLog('音声読み上げは非対応ブラウザです', 'error');
    }
  };
  
  // 音声停止
  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      addLog('🔊 音声読み上げ停止', 'info');
    }
  };
  
  useEffect(() => {
    if (typeof window !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
  
  return (
    <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '36px', margin: '10px 0' }}>🤖 Life AI Coach</h1>
        <p style={{ color: '#666' }}>
          あなたの生活を観察し、最適なアドバイスを提供
        </p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* 左カラム */}
        <div>
          {/* コントロール */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
            <button
              onClick={() => setIsMonitoring(!isMonitoring)}
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                background: isMonitoring ? '#f44336' : '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginRight: '10px'
              }}
            >
              {isMonitoring ? '⏸️ 停止' : '▶️ 開始'}
            </button>
            
            <button
              onClick={() => {
                timelineManager.clear();
                setEntryCount(0);
                setMessage('');
                setLogs([]);
                setSpeechLogs([]);
                setLastSnapshot(null);
                addLog('全データクリア完了', 'success');
              }}
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                background: '#999',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              🗑️ クリア
            </button>
            
            <button
              onClick={() => getAdvice()}
              disabled={isAnalyzing}
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                background: isAnalyzing ? '#ccc' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                marginLeft: '10px'
              }}
            >
              {isAnalyzing ? '⏳ 分析中...' : '🤖 今すぐアドバイス'}
            </button>
            
            <div style={{ marginTop: '15px', fontSize: '14px' }}>
              {isMonitoring && <span style={{ color: '#4caf50' }}>🟢 記録中</span>}
              {isAnalyzing && <span style={{ color: '#ff9800', marginLeft: '15px' }}>🤖 AI分析中...</span>}
              {isListening && (
                <span style={{ color: '#f44336', marginLeft: '15px' }}>🎤 録音中</span>
              )}
            </div>
            
            <div style={{ marginTop: '10px', fontSize: '16px', fontWeight: 'bold' }}>
              記録データ: {entryCount} エントリー ({Math.round(entryCount / 6)} 分)
            </div>
          </div>
          
          {/* AI質問フォーム */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
            <h3 style={{ marginTop: 0, fontSize: '16px' }}>💬 AIに質問する</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleUserQuestion()}
                placeholder="テキストで質問..."
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '14px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleUserQuestion}
                disabled={isAnalyzing || userInput.trim().length === 0}
                style={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  background: isAnalyzing || userInput.trim().length === 0 ? '#ccc' : '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isAnalyzing || userInput.trim().length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                送信
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={startVoiceQuestion}
                disabled={isAnalyzing}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '14px',
                  background: isListening ? '#f44336' : '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {isListening ? '🔴 録音停止' : '🎤 音声で質問'}
              </button>
              
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  style={{
                    padding: '12px 24px',
                    fontSize: '14px',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  🔊 停止
                </button>
              )}
            </div>
          </div>
          
          {/* AIメッセージ */}
          {message && (
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                    🤖 先生からのアドバイス
                  </div>
                  <div style={{ fontSize: '16px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {message}
                  </div>
                </div>
                <button
                  onClick={() => setMessage('')}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: 'white',
                    fontSize: '20px',
                    cursor: 'pointer',
                    padding: '5px 10px',
                    borderRadius: '4px'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          
          {/* モニター */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            <div style={{
              background: 'white',
              padding: '15px',
              borderRadius: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0, fontSize: '16px' }}>📹 カメラ</h3>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', borderRadius: '8px', background: '#000' }}
              />
            </div>
            
            <div style={{
              background: 'white',
              padding: '15px',
              borderRadius: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0, fontSize: '16px' }}>🔊 環境音</h3>
              <div style={{
                fontSize: '36px',
                fontWeight: 'bold',
                margin: '15px 0',
                textAlign: 'center'
              }}>
                {noiseLevel} <span style={{ fontSize: '18px' }}>dB</span>
              </div>
              <div style={{
                padding: '6px 12px',
                borderRadius: '6px',
                textAlign: 'center',
                background: noiseLevel < 30 ? '#4caf50' :
                           noiseLevel < 50 ? '#8bc34a' :
                           noiseLevel < 70 ? '#ff9800' : '#f44336',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '14px'
              }}>
                {noiseLevel < 30 ? '🔇 静寂' :
                 noiseLevel < 50 ? '😌 静か' :
                 noiseLevel < 70 ? '📢 やや騒がしい' : '🔊 騒がしい'}
              </div>
              
              <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
                <div style={{ 
                  marginBottom: '8px',
                  padding: '8px',
                  background: isMonitoring ? '#e8f5e9' : '#ffebee',
                  borderRadius: '4px',
                  fontWeight: 'bold'
                }}>
                  💬 音声録音: {isMonitoring ? '🟢 稼働中（10秒ごと）' : '🔴 停止中'}
                </div>
                <div>🎤 発話検出: {speechLogs.length}回</div>
                <div>📊 記録間隔: 10秒</div>
                <div>🤖 分析間隔: 30秒</div>
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#999' }}>
                  ※ Whisper APIで音声認識
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 右カラム */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 発話ログ */}
          <div style={{
            background: 'white',
            padding: '15px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            minHeight: '300px',
            maxHeight: '400px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>💬 発話ログ</h3>
              <button
                onClick={() => setShowSpeechLogs(!showSpeechLogs)}
                style={{
                  padding: '5px 10px',
                  fontSize: '12px',
                  background: '#e0e0e0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {showSpeechLogs ? '非表示' : '表示'}
              </button>
            </div>
            
            {showSpeechLogs && (
              <div style={{
                flex: 1,
                overflow: 'auto',
                background: '#f0f8ff',
                padding: '10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'monospace',
                lineHeight: '1.6'
              }}>
                {speechLogs.length === 0 ? (
                  <div style={{ color: '#999' }}>まだ発話が検出されていません</div>
                ) : (
                  speechLogs.map((log, i) => (
                    <div key={i} style={{
                      marginBottom: '8px',
                      color: '#2196f3',
                      padding: '5px',
                      background: 'white',
                      borderRadius: '4px'
                    }}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          
          {/* システムログ */}
          <div style={{
            background: 'white',
            padding: '15px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            minHeight: '300px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>📋 システムログ</h3>
              <button
                onClick={() => setShowLogs(!showLogs)}
                style={{
                  padding: '5px 10px',
                  fontSize: '12px',
                  background: '#e0e0e0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {showLogs ? '非表示' : '表示'}
              </button>
            </div>
            
            {showLogs && (
              <div style={{
                flex: 1,
                overflow: 'auto',
                background: '#f5f5f5',
                padding: '10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'monospace',
                lineHeight: '1.6'
              }}>
                {logs.length === 0 ? (
                  <div style={{ color: '#999' }}>ログなし</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} style={{
                      marginBottom: '5px',
                      color: log.includes('❌') ? '#f44336' :
                             log.includes('✅') ? '#4caf50' : '#333'
                    }}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}