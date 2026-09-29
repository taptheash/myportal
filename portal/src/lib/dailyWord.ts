// Daily Word: guess the five-letter word in six tries. After each guess every
// letter is marked: right letter in the right spot, right letter in the wrong
// spot, or not in the word. Everyone gets the same word on the same day;
// Practice mode deals random ones.

import { ANSWERS, GUESSES } from './wordList';
import { rng, shuffle } from './cardDeck';

export type Mark = 'correct' | 'present' | 'absent';
export const WORD_LEN = 5;
export const MAX_GUESSES = 6;

const split = (s: string) => Array.from({ length: s.length / WORD_LEN }, (_, i) => s.slice(i * WORD_LEN, i * WORD_LEN + WORD_LEN));
const answers = split(ANSWERS);
let valid: Set<string> | null = null;

// The answers in a fixed shuffled order, so day N always gets the same word.
const dailyOrder = shuffle(answers, rng(20260928));

export function isValidWord(w: string): boolean {
  if (!valid) valid = new Set([...answers, ...split(GUESSES)]);
  return valid.has(w.toLowerCase());
}

// Day 0 is 28 Sep 2026, counted in your own time zone.
export function dayNumber(d: Date = new Date()): number {
  const local = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((local - Date.UTC(2026, 8, 28)) / 86400000);
}

export const answerForDay = (day: number) => dailyOrder[((day % dailyOrder.length) + dailyOrder.length) % dailyOrder.length];
export const randomAnswer = (rand: () => number = Math.random) => answers[Math.floor(rand() * answers.length)];

// Marks a guess against the answer. Repeated letters count properly: a letter
// is marked "present" only as many times as it's still unaccounted for.
export function score(guess: string, answer: string): Mark[] {
  const g = guess.toLowerCase(), a = answer.toLowerCase();
  const marks: Mark[] = Array(WORD_LEN).fill('absent');
  const left: Record<string, number> = {};
  for (let i = 0; i < WORD_LEN; i++) {
    if (g[i] === a[i]) marks[i] = 'correct';
    else left[a[i]] = (left[a[i]] || 0) + 1;
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (marks[i] === 'correct') continue;
    if (left[g[i]]) { marks[i] = 'present'; left[g[i]]--; }
  }
  return marks;
}

// Best mark seen for each letter, for colouring the keyboard.
export function keyMarks(guesses: string[], answer: string): Record<string, Mark> {
  const rank: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };
  const out: Record<string, Mark> = {};
  guesses.forEach((g) => score(g, answer).forEach((m, i) => {
    const ch = g[i];
    if (!out[ch] || rank[m] > rank[out[ch]]) out[ch] = m;
  }));
  return out;
}

export interface WordGame { mode: 'daily' | 'practice'; day: number; answer: string; guesses: string[] }
export const isSolved = (g: WordGame) => g.guesses.some((x) => x === g.answer);
export const isOver = (g: WordGame) => isSolved(g) || g.guesses.length >= MAX_GUESSES;

export const dailyGame = (day = dayNumber()): WordGame => ({ mode: 'daily', day, answer: answerForDay(day), guesses: [] });
export const practiceGame = (): WordGame => ({ mode: 'practice', day: dayNumber(), answer: randomAnswer(), guesses: [] });

export const ANSWER_COUNT = answers.length;
