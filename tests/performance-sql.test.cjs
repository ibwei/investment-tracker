const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const createLoader = require('./load-ts.cjs');

const pglitePath = process.env.EARN_TEST_PGLITE_PATH;
test('isolated PostgreSQL behavior, SQL batching and rollback', { skip: !pglitePath }, async t => {
  const { PGlite } = require(pglitePath);
  const database = new PGlite();
  await database.exec(fs.readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf8'));
  await database.exec(`insert into users(email,password_hash,status,created_at,updated_at) values ('test@example.invalid','test','ACTIVE','2026-09-08','2026-09-08'),('other@example.invalid','test','ACTIVE','2026-09-08','2026-09-08')`);
  const calls = [];
  let failSnapshot = false, failSummary = false;
  const client = { query: async (sql, params = []) => {
    calls.push(sql);
    if (failSnapshot && /insert into asset_snapshots/.test(sql)) throw new Error('injected snapshot failure');
    if (failSummary && /with summary_balances/.test(sql)) throw new Error('injected summary failure');
    const result = await database.query(sql, params);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  } };
  const db = {
    query: async (sql, args) => (await client.query(sql, args)).rows,
    queryOne: async (sql, args) => (await client.query(sql, args)).rows[0] ?? null,
    execute: client.query,
    withConnection: async callback => callback(client),
    withTransaction: async callback => {
      await client.query('BEGIN');
      try { const result = await callback(client); await client.query('COMMIT'); return result }
      catch (error) { await client.query('ROLLBACK'); throw error }
    },
  };
  let failProvider = false;
  let providerPayload = { balances: [], positions: [] };
  const provider = {
    AssetProviderError: class extends Error {},
    fetchSourceAssetsFromCexDexService: async () => { if (failProvider) throw new Error('Injected provider failure'); return providerPayload },
  };
  const mocks = { '@/lib/db': db, '@/lib/assets/cex-dex-service-client': provider,
    '@/lib/assets/encryption': { decryptAssetConfig: () => ({ address: '0x1111111111111111111111111111111111111111' }), encryptAssetConfig: () => '{}' } };
  const load = createLoader(mocks);
  const investments = load('lib/investments.ts');
  const assets = load('lib/assets/service.ts');
  const input = { project: 'Test', assetName: 'USDT', type: 'Interest', amount: 1000, currency: 'USD', startTime: '2026-08-01', endTime: '2026-10-01', aprExpected: 8 };
  try {
    await t.test('compact CRUD preserves calculation rules and avoids full-list reads', async () => {
      const created = await investments.createInvestment(1, input, { compact: true });
      assert.equal(created.snapshot, undefined);
      assert.ok(created.record.metrics);
      const legacy = await investments.getDashboardSnapshot(1);
      assert.deepEqual(created.record.metrics, legacy.records[0].metrics);
      calls.length = 0;
      const updated = await investments.updateInvestment(1, created.record.id, { ...input, amount: 2000 }, { compact: true });
      assert.equal(updated.record.amount, 2000);
      assert.equal(calls.some(sql => sql.includes('/* investment-read:')), false);
      assert.equal(calls.at(-1), 'COMMIT');
      const ended = await investments.finishInvestment(1, created.record.id, { endTime: '2026-09-08', incomeTotal: 45, aprActual: null }, { compact: true });
      const after = await investments.getDashboardSnapshot(1);
      assert.deepEqual(ended.record.metrics, after.records[0].metrics);
      assert.equal(ended.record.metrics.totalIncome, 45);
      await assert.rejects(investments.softDeleteInvestment(1, created.record.id, 'wrong', { compact: true }));
      await assert.rejects(investments.updateInvestment(2, created.record.id, input, { compact: true }));
      const deleted = await investments.softDeleteInvestment(1, created.record.id, 'DELETE', { compact: true });
      assert.equal(deleted.removedId, created.record.id);
      assert.equal((await db.queryOne('select is_deleted from investments where id = $1', [created.record.id])).is_deleted, true);
      const oldCreate = await investments.createInvestment(1, input);
      assert.ok(oldCreate.snapshot.activeRecords);
      await investments.clearAllInvestments(1, { compact: true });
      assert.equal((await investments.getDashboardSnapshot(1)).records.length, 0);
    });
    await database.exec(`insert into asset_sources(user_id,type,provider,name,public_ref,status,encrypted_config,created_at,updated_at) values (1,'ONCHAIN','OKX','Wallet','0x1111111111111111111111111111111111111111','ACTIVE','{}','2026-09-08','2026-09-08'), (2,'ONCHAIN','OKX','Other wallet','0x2222222222222222222222222222222222222222','ACTIVE','{}','2026-09-08','2026-09-08')`);
    await t.test('balances/positions batch atomically with duplicate and nullable-key semantics', async () => {
      providerPayload = {
        balances: Array.from({ length: 205 }, (_, i) => ({ assetSymbol: `COIN${i}`, amount: 1, valueUsd: i + 1, category: 'SPOT' })),
        positions: [
          { provider: 'OKX', chain: 'eth', protocolId: 'a', positionType: 'LENDING', assetValueUsd: 20, debtValueUsd: 5, rewardValueUsd: 1, netValueUsd: 16 },
          { provider: 'OKX', chain: 'eth', protocolId: 'a', positionType: 'LENDING', assetValueUsd: 30, debtValueUsd: 5, rewardValueUsd: 1, netValueUsd: 26 },
          { provider: 'OKX', positionType: 'LENDING', assetValueUsd: 3, debtValueUsd: 0, rewardValueUsd: 0, netValueUsd: 3 },
          { provider: 'OKX', positionType: 'LENDING', assetValueUsd: 4, debtValueUsd: 0, rewardValueUsd: 0, netValueUsd: 4 },
        ],
      };
      providerPayload.balances.push({ assetSymbol: 'COIN0', amount: 2, valueUsd: 2, category: 'SPOT' });
      providerPayload.balances.push({ assetSymbol: 'DETAIL', amount: 1, valueUsd: 99999, category: 'DETAIL' });
      calls.length = 0;
      const synced = await assets.syncAssetSource(1, 1);
      assert.equal(synced.error, null);
      assert.equal(calls.filter(sql => /insert into asset_balances/.test(sql)).length, 3);
      assert.equal(calls.filter(sql => /insert into asset_positions/.test(sql)).length, 1);
      assert.equal((await db.queryOne('select count(*)::int as count from asset_positions')).count, 3);
      assert.equal(synced.summary.summary.totalValueUsd, 21150); // 1..205 + duplicate 2 + positions 33; DETAIL excluded.
    });
    await t.test('single-query summary matches existing full aggregation for every response field', async () => {
      const current = await assets.getAssetSummary(1);
      assert.equal(current.summary.totalValueUsd, 21150);
      assert.equal(current.categoryBreakdown.find(item => item.category === 'SPOT').valueUsd, 21117);
      assert.equal(current.categoryBreakdown.find(item => item.category === 'LENDING').valueUsd, 33);
      if (!process.env.EARN_TEST_ASSETS_BASELINE) return;
      const old = createLoader(mocks)(process.env.EARN_TEST_ASSETS_BASELINE);
      const expected = await old.getAssetSummary(1);
      calls.length = 0;
      const actual = await assets.getAssetSummary(1);
      assert.deepEqual({ ...actual, meta: null }, { ...expected, meta: null });
      assert.equal(calls.length, 1);
    });
    await t.test('failed synchronization preserves the last successful balances and timestamp', async () => {
      const before = await assets.getAssetSource(1, 1);
      failProvider = true;
      const result = await assets.syncAssetSource(1, 1);
      failProvider = false;
      assert.ok(result.error);
      assert.equal(result.source.lastSyncedAt, before.lastSyncedAt);
      assert.equal(result.summary.summary.totalValueUsd, 21150);
      assert.equal(result.summary.summary.failedSourceCount, 1);
    });
    await t.test('time zones, DST and minimum holding days match the complete snapshot', async () => {
      await db.execute("update users set timezone = 'America/New_York' where id = 2");
      const created = await investments.createInvestment(2, { ...input, startTime: '2026-03-07 12:00:00', endTime: '2026-03-09 12:00:00' }, { compact: true });
      const full = await investments.getDashboardSnapshot(2);
      assert.deepEqual(created.record.metrics, full.records[0].metrics);
      assert.equal(created.record.metrics.holdingDays, 2);
      const sameDay = await investments.createInvestment(2, { ...input, startTime: '2026-09-08 12:00:00', endTime: '2026-09-08 12:00:00' }, { compact: true });
      assert.equal(sameDay.record.metrics.holdingDays, 1);
    });
    await t.test('snapshot failure rolls back manual writes; summary failure preserves committed success', async () => {
      failSnapshot = true;
      await assert.rejects(assets.createManualAsset(1, { name: 'Test cash', type: 'CASH', amount: 100, valueUsd: 100 }));
      assert.equal((await db.queryOne('select count(*)::int as count from manual_assets')).count, 0);
      failSnapshot = false;
      failSummary = true;
      const result = await assets.createManualAsset(1, { name: 'Test cash', type: 'CASH', amount: 100, valueUsd: 100 });
      assert.ok(result.asset.id);
      assert.equal(result.summary, undefined);
      failSummary = false;
      assert.equal((await assets.listManualAssets(1)).length, 1);
      assert.equal((await assets.listManualAssets(2)).length, 0);
      await assets.updateManualAsset(1, result.asset.id, { name: 'Updated cash', amount: 200, valueUsd: 200 });
      await assets.deleteManualAsset(1, result.asset.id);
      assert.equal((await assets.listManualAssets(1)).length, 0);
    });
    await t.test('compact list does not duplicate records and default response stays compatible', async () => {
      const compact = await investments.getDashboardSnapshot(1, { compact: true });
      assert.deepEqual(Object.keys(compact).sort(), ['meta', 'records']);
      const full = await investments.getDashboardSnapshot(1);
      assert.ok(full.summary && full.activeRecords && full.historicalRecords);
    });
  } finally { await database.close() }
});
