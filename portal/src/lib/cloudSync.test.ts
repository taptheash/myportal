import { startCloudSync, stopCloudSync, getSyncStatus } from './cloudSync';

// Minimal in-memory stand-in for the few Firestore calls cloudSync uses,
// so the merge rules can be tested without a network or a real project.
function fakeFirestore(initial: Record<string, string | null> = {}) {
  const docs = new Map<string, string | null>(Object.entries(initial));
  let listener: ((snap: any) => void) | null = null;
  const writes: Array<[string, string | null]> = [];
  const fsMod: any = {
    collection: () => ({}),
    doc: (_col: any, id: string) => ({ id }),
    serverTimestamp: () => 'ts',
    getDocs: async () => ({ forEach: (fn: any) => docs.forEach((v, id) => fn({ id, data: () => ({ json: v }) })) }),
    setDoc: async (ref: any, data: any) => { docs.set(ref.id, data.json); writes.push([ref.id, data.json]); },
    onSnapshot: (_col: any, next: any) => { listener = next; return () => { listener = null; }; },
  };
  // Simulates a change arriving from ANOTHER device.
  const remoteChange = (id: string, json: string | null) => {
    docs.set(id, json);
    listener?.({ docChanges: () => [{ type: 'modified', doc: { id, data: () => ({ json }), metadata: { hasPendingWrites: false } } }] });
  };
  return { fb: { db: {}, fsMod } as any, docs, writes, remoteChange };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { localStorage.clear(); jest.useRealTimers(); });
afterEach(() => stopCloudSync());

test('first sign-in with an empty cloud uploads what this browser has', async () => {
  localStorage.setItem('pw6', '[{"type":"notes"}]');
  const f = fakeFirestore();
  await startCloudSync(f.fb, 'u1');
  expect(f.docs.get('pw6')).toBe('[{"type":"notes"}]');
  expect(getSyncStatus().state).toBe('synced');
});

test('first sign-in on a second browser adopts the cloud copy and backs up the local one', async () => {
  localStorage.setItem('pw6', 'LOCAL');
  const f = fakeFirestore({ pw6: 'CLOUD' });
  const events: string[] = [];
  window.addEventListener('portal-local-sync', (e: any) => events.push(e.detail.key));
  await startCloudSync(f.fb, 'u1');
  expect(localStorage.getItem('pw6')).toBe('CLOUD');
  expect(JSON.parse(localStorage.getItem('pw6-sync-backup')!).data.pw6).toBe('LOCAL');
  expect(events).toContain('pw6');
});

test('an edit made while offline on a known browser wins over the cloud', async () => {
  const f = fakeFirestore();
  localStorage.setItem('pw6-scratchpad', 'v1');
  await startCloudSync(f.fb, 'u1');
  stopCloudSync();
  localStorage.setItem('pw6-scratchpad', 'edited offline');
  f.docs.set('pw6-scratchpad', 'v1');
  await startCloudSync(f.fb, 'u1');
  expect(f.docs.get('pw6-scratchpad')).toBe('edited offline');
});

test('changes from another device are applied live; local edits are uploaded', async () => {
  jest.useFakeTimers();
  const f = fakeFirestore({ 'pw6-home-order': '["a"]' });
  await startCloudSync(f.fb, 'u1');
  f.remoteChange('pw6-home-order', '["b","a"]');
  expect(localStorage.getItem('pw6-home-order')).toBe('["b","a"]');
  localStorage.setItem('pw6-home-order', '["c"]');
  jest.advanceTimersByTime(2100);
  await Promise.resolve();
  expect(f.docs.get('pw6-home-order')).toBe('["c"]');
});

test('a remote change does not clobber an unsynced local edit', async () => {
  jest.useFakeTimers();
  const f = fakeFirestore({ 'pw6-scratchpad': 'base' });
  await startCloudSync(f.fb, 'u1');
  localStorage.setItem('pw6-scratchpad', 'typing…');
  f.remoteChange('pw6-scratchpad', 'other device');
  expect(localStorage.getItem('pw6-scratchpad')).toBe('typing…');
  jest.advanceTimersByTime(2100);
  await Promise.resolve(); // (a setTimeout-based flush would never fire under fake timers)
  expect(f.docs.get('pw6-scratchpad')).toBe('typing…');
});

test('the calendar passcode and per-device tab choice are never uploaded', async () => {
  localStorage.setItem('pw6-portal-key', 'secret');
  localStorage.setItem('pw6-active-section', '"news"');
  const f = fakeFirestore();
  await startCloudSync(f.fb, 'u1');
  expect(f.docs.has('pw6-portal-key')).toBe(false);
  expect(f.docs.has('pw6-active-section')).toBe(false);
});
