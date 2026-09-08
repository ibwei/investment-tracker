const test = require('node:test');
const assert = require('node:assert/strict');
const createLoader = require('./load-ts.cjs');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject }; };
const record = (id, amount = 100) => ({ id, project: `Project ${id}`, assetName: 'USDT', status: 'ONGOING', amount, metrics: { amount, dailyIncome: 1 } });
function setup(repository) {
  const load = createLoader({
    '@/lib/storage/repositories': { getInvestmentRepository: () => repository },
    '@/lib/storage/repositories/remote-investment-repository': { remoteInvestmentRepository: repository },
    '@/store/app-store': { useAppStore: { getState: () => ({ storageMode: 'remote' }) } },
    'zustand/middleware': { persist: fn => fn },
  });
  const store = load('lib/store.ts').useInvestmentStore;
  store.getState().hydrate('user:1', { records: [record(1), record(2)] }, Date.now());
  return { store, load, reset: () => store.getState().resetScope('guest') };
}

test('cached initialization deduplicates and preserves the last confirmed state on refresh failure', async () => {
  let calls = 0;
  const read = deferred();
  const { store, reset } = setup({ getSnapshot: () => { calls++; return read.promise } });
  await store.getState().initialize({ userId: 1 });
  assert.equal(calls, 0);
  const a = store.getState().initialize({ force: true });
  const b = store.getState().initialize({ force: true });
  assert.equal(calls, 1);
  read.reject(new Error('network'));
  await Promise.all([a, b]);
  assert.equal(store.getState().investments.length, 2);
  assert.equal(store.getState().refreshError, 'request.refreshFailed');
  reset();
});

test('out-of-order mutations merge by record; stale reads cannot overwrite either confirmation', async () => {
  const stale = deferred(), first = deferred(), second = deferred();
  const { store, reset } = setup({ getSnapshot: () => stale.promise, update: id => id === '1' ? first.promise : second.promise });
  const read = store.getState().initialize({ force: true });
  const a = store.getState().updateInvestment('1', { amount: 200 });
  const b = store.getState().updateInvestment('2', { amount: 300 });
  await assert.rejects(store.getState().deleteInvestment('1'), /request.pending/);
  second.resolve({ record: record(2, 300) }); await b;
  first.resolve({ record: record(1, 200) }); await a;
  stale.resolve({ records: [record(1), record(2)] }); await read;
  assert.deepEqual(store.getState().investments.map(i => i.amount), [200, 300]);
  assert.deepEqual(store.getState().pendingIds, []);
  reset();
});

test('writes do not update displayed amounts until confirmation; finish and delete apply deltas', async () => {
  const write = deferred();
  const { store, reset } = setup({
    update: () => write.promise,
    earlyClose: async () => ({ record: { ...record(1, 200), status: 'EARLY_ENDED' } }),
    remove: async id => ({ removedId: id }),
    clearAll: async () => ({ cleared: true }),
  });
  const pending = store.getState().updateInvestment('1', { amount: 200 });
  assert.equal(store.getState().investments[0].amount, 100);
  write.resolve({ record: record(1, 200) }); await pending;
  assert.equal(store.getState().investments[0].amount, 200);
  await store.getState().endInvestment('1', { endDate: '2026-09-08' });
  assert.equal(store.getState().getHistoryInvestments()[0].id, '1');
  await store.getState().deleteInvestment('1');
  assert.equal(store.getState().investments.length, 1);
  await store.getState().clearAllData();
  assert.equal(store.getState().investments.length, 0);
  reset();
});

test('logout cancels writes and old responses never reach the next account', async () => {
  const write = deferred();
  let signal;
  const { store, reset } = setup({ update: (id, data, options) => { signal = options.signal; return write.promise } });
  const pending = store.getState().updateInvestment('1', { amount: 200 });
  store.getState().resetScope('user:2');
  assert.equal(signal.aborted, true);
  write.resolve({ record: record(1, 200) });
  await assert.rejects(pending, /sessionChanged/);
  assert.deepEqual(store.getState().investments, []);
  reset();
});

test('ambiguous write responses block automatic replay and retain confirmed amounts', async () => {
  let calls = 0, requestError;
  const { store, load, reset } = setup({ update: async () => { calls++; throw requestError } });
  requestError = new (load('lib/client-request.ts').RequestError)('request.uncertain', 0, true);
  await assert.rejects(store.getState().updateInvestment('1', { amount: 200 }));
  await assert.rejects(store.getState().updateInvestment('1', { amount: 200 }));
  assert.equal(calls, 1);
  assert.equal(store.getState().investments[0].amount, 100);
  assert.deepEqual(store.getState().uncertainIds, ['1']);
  reset();
});

test('resource cache is scoped, deduplicated and invalidated writes discard in-flight results', async () => {
  const load = createLoader();
  const cache = load('lib/client-request.ts');
  const original = global.fetch;
  const pending = deferred();
  let calls = 0;
  global.fetch = async () => { calls++; return pending.promise };
  try {
    const a = cache.readResource('user:1', '/api/assets/summary');
    const b = cache.readResource('user:1', '/api/assets/summary');
    assert.equal(calls, 1);
    cache.invalidateResources('user:1');
    cache.seedResource('user:1', '/api/assets/summary', { total: 200 });
    pending.resolve(Response.json({ total: 100 }));
    await Promise.all([a, b]);
    assert.equal(cache.peekResource('user:1', '/api/assets/summary').data.total, 200);
    assert.equal(cache.peekResource('user:2', '/api/assets/summary').data, undefined);
    assert.equal((await cache.readResource('user:1', '/api/assets/summary')).total, 200);
    assert.equal(calls, 1);
  } finally { global.fetch = original; cache.invalidateResources() }
});

test('timing headers isolate concurrent requests and private responses are not cacheable', async () => {
  const { timedRoute, measure } = createLoader()('lib/performance.ts');
  const a = timedRoute(async () => { await measure('db_query', () => delay(5)); return Response.json({ ok: true }) });
  const b = timedRoute(async () => { await measure('provider', () => delay(1)); return Response.json({ ok: true }) });
  const [left, right] = await Promise.all([a(), b()]);
  assert.match(left.headers.get('Server-Timing'), /db_query/);
  assert.doesNotMatch(left.headers.get('Server-Timing'), /provider/);
  assert.match(right.headers.get('Cache-Control'), /private, no-store/);
});


test('a successful concurrent write still reconciles when the last operation fails validation', async () => {
  const first = deferred(), second = deferred();
  let reads = 0;
  const { store, reset } = setup({ getSnapshot: async () => { reads++; return { records: [record(1, 200), record(2)] } }, update: id => id === '1' ? first.promise : second.promise });
  const a = store.getState().updateInvestment('1', { amount: 200 });
  const b = store.getState().updateInvestment('2', { amount: 300 });
  first.resolve({ record: record(1, 200) }); await a;
  second.reject(new Error('Validation rejected'));
  await assert.rejects(b);
  await delay(220);
  assert.equal(reads, 1);
  assert.deepEqual(store.getState().investments.map(item => item.amount), [200, 100]);
  reset();
});
