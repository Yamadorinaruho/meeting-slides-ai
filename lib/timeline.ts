// タイムラインデータの型定義
export interface TimelineEntry {
    timestamp: string;
    visual: {
      activity: string;
      posture: string;
      expression: string;
      eyeContact: string;
    };
    audio: {
      level: number;
      speechDetected: boolean;
      speechContent: string;
      environmentType: string[];
    };
    inference: {
      focusLevel: string;
      energyLevel: string;
      mood: string;
    };
  }
  
  class TimelineManager {
    private timeline: TimelineEntry[] = [];
    private maxEntries = 8640; // 24時間分（10秒 × 6 × 60 × 24）
    
    add(entry: TimelineEntry) {
      this.timeline.push(entry);
      
      // 古いデータを削除（24時間以上前）
      if (this.timeline.length > this.maxEntries) {
        this.timeline = this.timeline.slice(-this.maxEntries);
      }
      
      // IndexedDBに保存
      this.saveToStorage();
    }
    
    getAll(): TimelineEntry[] {
      return this.timeline;
    }
    
    getRecent(minutes: number): TimelineEntry[] {
      const entries = minutes * 6; // 10秒ごと × 6 = 1分
      return this.timeline.slice(-entries);
    }
    
    getSummary(minutes: number): string {
      const recent = this.getRecent(minutes);
      if (recent.length === 0) return '';
      
      // 活動の集計
      const activities = recent.map(e => e.visual.activity);
      const activityCounts = activities.reduce((acc, act) => {
        acc[act] = (acc[act] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // 音声内容の抽出
      const speeches = recent
        .filter(e => e.audio.speechContent)
        .map(e => `${e.timestamp.split('T')[1].slice(0, 5)}: "${e.audio.speechContent}"`)
        .join('\n');
      
      return `
  【過去${minutes}分の活動】
  ${Object.entries(activityCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([act, count]) => `- ${act}: ${Math.round(count / 6)}分`)
    .join('\n')}
  
  【発話内容】
  ${speeches || 'なし'}
  
  【表情の変化】
  ${recent.map(e => e.visual.expression).filter((v, i, a) => a.indexOf(v) === i).join(' → ')}
  
  【集中度の推移】
  ${recent.map(e => e.inference.focusLevel).filter((v, i, a) => a.indexOf(v) === i).join(' → ')}
  `;
    }
    
    private async saveToStorage() {
      if (typeof window === 'undefined') return;
      
      try {
        localStorage.setItem('timeline', JSON.stringify(this.timeline));
      } catch (e) {
        console.error('Storage error:', e);
      }
    }
    
    loadFromStorage() {
      if (typeof window === 'undefined') return;
      
      try {
        const data = localStorage.getItem('timeline');
        if (data) {
          this.timeline = JSON.parse(data);
        }
      } catch (e) {
        console.error('Load error:', e);
      }
    }
    
    clear() {
      this.timeline = [];
      if (typeof window !== 'undefined') {
        localStorage.removeItem('timeline');
      }
    }
  }
  
  export const timelineManager = new TimelineManager();