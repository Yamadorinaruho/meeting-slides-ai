'use client';

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [isActive, setIsActive] = useState(false);
  const [narration, setNarration] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // カメラと画面共有を起動
  useEffect(() => {
    const initSources = async () => {
      try {
        // カメラストリーム
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });

        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = cameraStream;
        }

        console.log('✅ Camera initialized');

        // 画面共有ストリーム
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = screenStream;
        }

        console.log('✅ Screen capture initialized');
      } catch (err: any) {
        console.error('Source initialization error:', err);
        setError('カメラまたは画面共有へのアクセスを許可してください');
      }
    };

    initSources();

    return () => {
      // クリーンアップ
      if (cameraVideoRef.current?.srcObject) {
        const stream = cameraVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (screenVideoRef.current?.srcObject) {
        const stream = screenVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // 30秒ごとに実況
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(async () => {
      await narrateLife();
    }, 30000);
    
    // 初回は即座に実行
    narrateLife();
    
    return () => clearInterval(interval);
  }, [isActive]);
  
  const narrateLife = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    setError('');

    try {
      // カメラ画像キャプチャ
      const cameraCanvas = document.createElement('canvas');
      cameraCanvas.width = 640;
      cameraCanvas.height = 480;
      const cameraCtx = cameraCanvas.getContext('2d');

      if (!cameraCtx || !cameraVideoRef.current) {
        throw new Error('Camera canvas or video not ready');
      }

      cameraCtx.drawImage(cameraVideoRef.current, 0, 0, 640, 480);
      const cameraImageBase64 = cameraCanvas.toDataURL('image/jpeg', 0.7).split(',')[1];

      // 画面キャプチャ
      const screenCanvas = document.createElement('canvas');
      screenCanvas.width = 1280;
      screenCanvas.height = 720;
      const screenCtx = screenCanvas.getContext('2d');

      if (!screenCtx || !screenVideoRef.current) {
        throw new Error('Screen canvas or video not ready');
      }

      screenCtx.drawImage(screenVideoRef.current, 0, 0, 1280, 720);
      const screenImageBase64 = screenCanvas.toDataURL('image/jpeg', 0.7).split(',')[1];

      console.log('📸 Camera and screen images captured, calling API...');

      // APIコール（カメラ + 画面1つ）
      const response = await fetch('/api/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraImageBase64,
          screenImages: [screenImageBase64]
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
      }
      
      const data = await response.json();
      console.log('✅ Narration received:', data.narration);
      
      setNarration(data.narration);
      
      // 音声再生（修正版）
      if (data.audioBase64) {
        // 前の音声を停止
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        
        // 新しい音声を作成
        const audioUrl = `data:${data.mimeType};base64,${data.audioBase64}`;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.oncanplaythrough = () => {
          console.log('🔊 Audio ready, playing...');
          audio.play().catch(err => {
            console.error('Audio play error:', err);
            setError('音声再生エラー: ' + err.message);
          });
        };
        
        audio.onerror = (e) => {
          console.error('Audio error:', e);
          setError('音声読み込みエラー');
        };
        
        audio.load();
      }
      
    } catch (err: any) {
      console.error('❌ Narration error:', err);
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div style={{
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      fontFamily: 'sans-serif',
    }}>
      <h1 style={{ textAlign: 'center' }}>🎙️ 人生実況AI（カメラ＆画面）</h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '20px',
        marginBottom: '20px',
      }}>
        <div>
          <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>📷 カメラ</h3>
          <video
            ref={cameraVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              borderRadius: '12px',
              background: '#000',
            }}
          />
        </div>

        <div>
          <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>🖥️ 画面</h3>
          <video
            ref={screenVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              borderRadius: '12px',
              background: '#000',
            }}
          />
        </div>
      </div>
      
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button
          onClick={() => setIsActive(!isActive)}
          disabled={isProcessing}
          style={{
            padding: '15px 30px',
            fontSize: '18px',
            background: isActive ? '#f44336' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            opacity: isProcessing ? 0.7 : 1,
          }}
        >
          {isProcessing ? '⏳ 処理中...' : isActive ? '⏸️ 停止' : '▶️ 開始'}
        </button>
      </div>
      
      {error && (
        <div style={{
          background: '#ffebee',
          color: '#c62828',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
        }}>
          <strong>❌ エラー:</strong> {error}
        </div>
      )}
      
      {narration && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '20px',
          borderRadius: '12px',
          fontSize: '18px',
          lineHeight: '1.6',
        }}>
          <strong>🎙️ 実況:</strong>
          <p style={{ margin: '10px 0 0 0' }}>{narration}</p>
        </div>
      )}
    </div>
  );
}