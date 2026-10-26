declare module 'zzfx' {
  export const ZZFX: { volume: number; audioContext: AudioContext; buildSamples: (...p: number[]) => number[]; [k: string]: unknown };
  export class ZZFXSound {
    constructor(params: number[]);
    play(volume?: number, pitch?: number, randomnessScale?: number, pan?: number, loop?: boolean): AudioBufferSourceNode | undefined;
  }
  export function zzfx(...params: number[]): AudioBufferSourceNode;
}
