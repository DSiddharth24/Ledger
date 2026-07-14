/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TestDuration = 15 | 30 | 60;

export type TestStatus = 'idle' | 'running' | 'completed';

export interface ScoreEntry {
  id: string;
  date: string;
  wpm: number;
  accuracy: number;
  errors: number;
  duration: number;
  rawWpm: number;
}

export interface CharacterState {
  char: string;
  status: 'untyped' | 'correct' | 'incorrect';
  isCurrent: boolean;
}
