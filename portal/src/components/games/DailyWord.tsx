import React, { useCallback, useEffect, useState } from 'react';
import { Delete, RotateCcw } from 'lucide-react';
import {
  WordGame, Mark, WORD_LEN, MAX_GUESSES, score, keyMarks, isValidWord, isSolved, isOver, dailyGame, practiceGame, dayNumber,
} from '../../lib/dailyWord';
import { Segmented, gameBtn } from './GameShell';

// Daily Word: six tries to find the five-letter word. Green = right letter,
// right spot; yellow = in the word, wrong spot; grey = not in the word.
// Daily gives everyone the same word each day (with a streak); Practice deals
// as many random words as you like.

type Props = { config: Record<string, any>; onUpdateConfig: (c: Record<string, any>) => void };
interface ModeStats { played: number; won: number; streak: number; maxStreak: number; dist: number[]; lastDay: number | null }
const EMPTY: ModeStats = { played: 0, won: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0], lastDay: null };

const KEY = { daily: 'pw6-game-word-daily', practice: 'pw6-game-word-practice' } as const;
const load = (mode: 'daily' | 'practice'): WordGame | null => {
  try { const g = JSON.parse(localStorage.getItem(KEY[mode]) || 'null'); return g && g.answer && Array.isArray(g.guesses) ? g : null; } catch { return null; }
};
const save = (g: WordGame) => { try { localStorage.setItem(KEY[g.mode], JSON.stringify(g)); } catch { /* storage blocked */ } };

function currentGame(mode: 'daily' | 'practice'): WordGame {
  const saved = load(mode);
  if (mode === 'daily') return saved && saved.day === dayNumber() ? saved : dailyGame();
  return saved || practiceGame();
}

const COLORS: Record<Mark, string> = { correct: '#16a34a', present: '#ca8a04', absent: '#71717a' };
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

function untilMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const s = Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function DailyWord({ config, onUpdateConfig }: Props) {
  const mode: 'daily' | 'practice' = config.mode === 'practice' ? 'practice' : 'daily';
  const [game, setGame] = useState<WordGame>(() => currentGame(mode));
  const [input, setInput] = useState('');
  const [toast, setToast] = useState('');
  const [shake, setShake] = useState(false);
  const [clock, setClock] = useState(untilMidnight());
  const stats: ModeStats = { ...EMPTY, ...(config.wordStats?.[mode] || {}) };

  useEffect(() => { setGame(currentGame(mode)); setInput(''); }, [mode]);
  useEffect(() => { save(game); }, [game]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 1600); return () => clearTimeout(t); }, [toast]);
  // Countdown to the next daily word, and roll over at midnight.
  useEffect(() => {
    const t = setInterval(() => {
      setClock(untilMidnight());
      if (mode === 'daily' && game.day !== dayNumber()) { setGame(dailyGame()); setInput(''); }
    }, 1000);
    return () => clearInterval(t);
  }, [mode, game.day]);

  const over = isOver(game);
  const solved = isSolved(game);

  const record = useCallback((g: WordGame) => {
    const won = isSolved(g);
    const cur: ModeStats = { ...EMPTY, ...(config.wordStats?.[g.mode] || {}) };
    const dist = [...cur.dist];
    if (won) dist[g.guesses.length - 1] += 1;
    const consecutive = g.mode === 'daily' && cur.lastDay === g.day - 1;
    const streak = won ? (g.mode === 'daily' ? (consecutive ? cur.streak + 1 : 1) : cur.streak + 1) : 0;
    const next: ModeStats = {
      played: cur.played + 1, won: cur.won + (won ? 1 : 0), dist, streak,
      maxStreak: Math.max(cur.maxStreak, streak), lastDay: g.mode === 'daily' ? g.day : cur.lastDay,
    };
    onUpdateConfig({ ...config, wordStats: { ...(config.wordStats || {}), [g.mode]: next } });
  }, [config, onUpdateConfig]);

  const submit = useCallback(() => {
    if (over) return;
    if (input.length < WORD_LEN) { setToast('Not enough letters'); setShake(true); return; }
    if (!isValidWord(input)) { setToast('Not in the word list'); setShake(true); return; }
    const g = { ...game, guesses: [...game.guesses, input] };
    setGame(g);
    setInput('');
    if (isOver(g)) record(g);
  }, [over, input, game, record]);

  const press = useCallback((k: string) => {
    if (over) return;
    if (k === 'enter') submit();
    else if (k === 'back') setInput((s) => s.slice(0, -1));
    else if (/^[a-z]$/.test(k)) setInput((s) => (s.length < WORD_LEN ? s + k : s));
  }, [over, submit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') { e.preventDefault(); press('enter'); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [press]);
  useEffect(() => { if (!shake) return; const t = setTimeout(() => setShake(false), 400); return () => clearTimeout(t); }, [shake]);

  const keys = keyMarks(game.guesses, game.answer);
  const tile = 54;
  const maxDist = Math.max(1, ...stats.dist);

  return (
    <div className="flex flex-col gap-3">
      <style>{'@keyframes dw-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}'}</style>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={mode} onChange={(m) => onUpdateConfig({ ...config, mode: m })}
          options={[{ value: 'daily', label: 'Daily' }, { value: 'practice', label: 'Practice' }]} />
        {mode === 'practice' && (
          <button onClick={() => { setGame(practiceGame()); setInput(''); }} className={`${gameBtn} bg-indigo-600 hover:bg-indigo-500 text-white`}>
            <RotateCcw size={13} /> New word
          </button>
        )}
        <div className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
          {mode === 'daily' ? <>Next word in <span className="tabular-nums">{clock}</span></> : 'Unlimited random words'}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 py-2">
        <div className="relative flex flex-col gap-1.5">
          {toast && <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-10 rounded-md bg-zinc-900 text-white text-xs font-medium px-3 py-1.5 shadow">{toast}</div>}
          {Array.from({ length: MAX_GUESSES }, (_, r) => {
            const guess = game.guesses[r];
            const isCurrent = r === game.guesses.length && !over;
            const letters = guess || (isCurrent ? input : '');
            const marks = guess ? score(guess, game.answer) : null;
            return (
              <div key={r} className="flex gap-1.5" style={isCurrent && shake ? { animation: 'dw-shake .4s' } : undefined}>
                {Array.from({ length: WORD_LEN }, (_, c) => {
                  const ch = letters[c] || '';
                  const m = marks?.[c];
                  return (
                    <div key={c} className={`flex items-center justify-center font-bold uppercase select-none rounded-md ${m ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'} ${!m ? (ch ? 'border-2 border-zinc-500 dark:border-zinc-400' : 'border-2 border-zinc-200 dark:border-zinc-700') : ''}`}
                      style={{ width: tile, height: tile, fontSize: tile * 0.5, background: m ? COLORS[m] : undefined, transition: 'background .25s' }}>
                      {ch}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {over && (
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-center">
            <div className="text-base font-semibold text-zinc-900 dark:text-white">
              {solved ? `Got it in ${game.guesses.length}!` : <>The word was <span className="uppercase tracking-wider">{game.answer}</span></>}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1 text-center">
              {[['Played', stats.played], ['Won %', stats.played ? Math.round((100 * stats.won) / stats.played) : 0], ['Streak', stats.streak], ['Best streak', stats.maxStreak]].map(([k, v]) => (
                <div key={k as string}><div className="text-lg font-semibold text-zinc-900 dark:text-white tabular-nums">{v}</div><div className="text-[10px] text-zinc-500">{k}</div></div>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-1">
              {stats.dist.map((n, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-zinc-500">{i + 1}</span>
                  <div className="h-4 rounded-sm flex items-center justify-end px-1.5 text-[10px] font-semibold text-white"
                    style={{ width: `${Math.max(8, (100 * n) / maxDist)}%`, background: solved && game.guesses.length === i + 1 ? '#16a34a' : '#71717a' }}>{n}</div>
                </div>
              ))}
            </div>
            {mode === 'daily'
              ? <div className="mt-3 text-xs text-zinc-500">New word in <span className="tabular-nums">{clock}</span>. Try Practice in the meantime.</div>
              : <button onClick={() => { setGame(practiceGame()); setInput(''); }} className="mt-3 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">Next word</button>}
          </div>
        )}

        <div className="flex flex-col items-center gap-1.5 select-none">
          {ROWS.map((row, i) => (
            <div key={row} className="flex gap-1.5">
              {i === 2 && <button onClick={() => press('enter')} className="px-3 h-12 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 text-xs font-semibold">ENTER</button>}
              {row.split('').map((k) => {
                const m = keys[k];
                return (
                  <button key={k} onClick={() => press(k)}
                    className={`w-9 h-12 rounded-md text-sm font-semibold uppercase ${m ? 'text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100'}`}
                    style={m ? { background: COLORS[m] } : undefined}>
                    {k}
                  </button>
                );
              })}
              {i === 2 && <button onClick={() => press('back')} className="px-3 h-12 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100" aria-label="Delete"><Delete size={18} /></button>}
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
        Type or tap letters, Enter to guess. Green: right letter, right spot. Yellow: in the word, wrong spot. Grey: not in the word.
        Daily: everyone gets the same word each day. Word lists from SCOWL (Kevin Atkinson).
      </p>
    </div>
  );
}
