import { score, isValidWord, answerForDay, dayNumber, keyMarks, ANSWER_COUNT } from './dailyWord';

test('marks right spot, wrong spot and missing letters', () => {
  expect(score('crane', 'caret')).toEqual(['correct', 'present', 'present', 'absent', 'present']);
  expect(score('slate', 'slate').every((m) => m === 'correct')).toBe(true);
});

test('repeated letters are only marked as often as the answer has them', () => {
  expect(score('speed', 'abide')).toEqual(['absent', 'absent', 'present', 'absent', 'present']);
  expect(score('eerie', 'ebbed')).toEqual(['correct', 'present', 'absent', 'absent', 'absent']);
  expect(score('lolly', 'hello')).toEqual(['absent', 'present', 'correct', 'correct', 'absent']); // both l's already matched
});

test('the keyboard shows the best mark for each letter', () => {
  expect(keyMarks(['speed', 'abide'], 'abide')).toMatchObject({ a: 'correct', e: 'correct', s: 'absent' });
});

test('word checks and a stable word per day', () => {
  expect(isValidWord('house')).toBe(true);
  expect(isValidWord('HOUSE')).toBe(true);
  expect(isValidWord('xqzzt')).toBe(false);
  expect(ANSWER_COUNT).toBeGreaterThan(1500);
  expect(answerForDay(10)).toBe(answerForDay(10));
  expect(answerForDay(10)).not.toBe(answerForDay(11));
  expect(dayNumber(new Date(2026, 8, 28, 23, 59))).toBe(0);
  expect(dayNumber(new Date(2026, 8, 29, 0, 1))).toBe(1);
  expect(isValidWord(answerForDay(5))).toBe(true);
});
