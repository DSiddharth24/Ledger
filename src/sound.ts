/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class TypewriterSoundEngine {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = true;

  constructor() {
    // AudioContext will be initialized lazily on first interaction
  }

  private initCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (!this.isMuted) {
      this.initCtx();
    }
    return this.isMuted;
  }

  public getMuteState(): boolean {
    return this.isMuted;
  }

  public playKeyClick(isSpace = false) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      
      // We will combine a bandpass filtered noise buffer with a resonant oscillator.
      // Noise component
      const bufferSize = this.audioCtx.sampleRate * 0.05; // 50ms buffer
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseSource = this.audioCtx.createBufferSource();
      noiseSource.buffer = buffer;

      const noiseFilter = this.audioCtx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(isSpace ? 400 : 1200, now);
      noiseFilter.Q.setValueAtTime(4, now);

      const noiseGain = this.audioCtx.createGain();
      noiseGain.gain.setValueAtTime(isSpace ? 0.08 : 0.05, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + (isSpace ? 0.04 : 0.02));

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.audioCtx.destination);

      // Pitch strike element (replicating the metal typewriter arm hitting paper)
      const osc = this.audioCtx.createOscillator();
      const oscGain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isSpace ? 120 : 350, now);
      // Pitch drop mimic
      osc.frequency.exponentialRampToValueAtTime(isSpace ? 40 : 100, now + 0.03);

      oscGain.gain.setValueAtTime(isSpace ? 0.15 : 0.12, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + (isSpace ? 0.05 : 0.03));

      osc.connect(oscGain);
      oscGain.connect(this.audioCtx.destination);

      noiseSource.start(now);
      osc.start(now);

      noiseSource.stop(now + 0.06);
      osc.stop(now + 0.06);
    } catch (e) {
      console.warn("Failed to play typewriter click:", e);
    }
  }

  public playErrorStrike() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;

      // Heavy ribbon smudge sound - lower frequency, longer decay
      const osc = this.audioCtx.createOscillator();
      const oscGain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.setValueAtTime(85, now + 0.04);

      // Lowpass filter to smudge the high frequencies
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, now);

      oscGain.gain.setValueAtTime(0.18, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      console.warn("Failed to play error sound:", e);
    }
  }

  public playBell() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;

      // Typewriter bell "Ding!" at margin limit or test end.
      // Crisp metallic chime: combining two high frequency sine oscillators
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1600, now);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2000, now);

      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6); // beautiful ring out

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);

      osc1.stop(now + 0.7);
      osc2.stop(now + 0.7);
    } catch (e) {
      console.warn("Failed to play bell:", e);
    }
  }
}

export const typewriterSound = new TypewriterSoundEngine();
export default typewriterSound;
