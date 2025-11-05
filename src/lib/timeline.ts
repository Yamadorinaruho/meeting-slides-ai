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
      speechContent?: string;
      environmentType: string[];
    };
    inference: {
      focusLevel: string;
      energyLevel: string;
      mood: string;
    };
  }
  
  class TimelineManager {
    private entries: TimelineEntry[] = [];
    private readonly STORAGE_KEY = 'life-coach-timeline';
  
    add(entry: TimelineEntry) {
      this.entries.push(entry);
      this.saveToStorage();
    }
  
    getAll(): TimelineEntry[] {
      return this.entries;
    }
  
    clear() {
      this.entries = [];
      if (typeof window !== 'undefined') {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    }
  
    loadFromStorage() {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          try {
            this.entries = JSON.parse(stored);
          } catch (e) {
            console.error('Failed to load timeline:', e);
          }
        }
      }
    }
  
    private saveToStorage() {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.entries));
        } catch (e) {
          console.error('Failed to save timeline:', e);
        }
      }
    }
  
    getSummary(minutes: number) {
      const now = Date.now();
      const cutoff = now - minutes * 60 * 1000;
      
      const recent = this.entries.filter(
        (e) => new Date(e.timestamp).getTime() > cutoff
      );
  
      const activities = recent.map((e) => e.visual.activity);
      const moods = recent.map((e) => e.inference.mood);
      const focusLevels = recent.map((e) => e.inference.focusLevel);
  
      return {
        count: recent.length,
        activities: [...new Set(activities)],
        moods: [...new Set(moods)],
        focusLevels: [...new Set(focusLevels)],
      };
    }
  }
  
  export const timelineManager = new TimelineManager();