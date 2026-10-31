import { networkAttempts } from './_no-network.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSupabaseUrl } from '../src/lib/config.js';
import { sanitizePermissions, isValidRole, canManageTarget } from '../supabase/functions/_shared/rbac.js';

// ── Miljökonfiguration ───────────────────────────────────────────────────────
test('config: saknad VITE_SUPABASE_URL kastar tydligt fel (ingen fallback)', () => {
  for (const env of [{}, undefined, { VITE_SUPABASE_URL: '' }, { VITE_SUPABASE_URL: '   ' }]) {
    assert.throws(() => getSupabaseUrl(env), /VITE_SUPABASE_URL saknas/);
  }
});
test('config: angiven URL returneras utan avslutande snedstreck', () => {
  assert.equal(getSupabaseUrl({ VITE_SUPABASE_URL: 'https://demo.example.test/' }), 'https://demo.example.test');
});
test('config: fel kastas före något nätverksanrop', () => {
  assert.throws(() => getSupabaseUrl({}));
  assert.deepEqual(networkAttempts, []);
});

// ── admin-users behörigheter ─────────────────────────────────────────────────
test('rbac: bara välformade och unika behörigheter behålls', () => {
  assert.deepEqual(
    sanitizePermissions(['quotes:read', 'quotes:read', '*', 'admin:all', 'x', 5, 'sales:write'], 'employee'),
    ['quotes:read', 'sales:write'],
  );
});
test('rbac: intern får aldrig write/delete', () => {
  assert.deepEqual(sanitizePermissions(['quotes:read', 'quotes:write', 'quotes:delete'], 'intern'), ['quotes:read']);
});
test('rbac: icke-array ger tom lista', () => {
  assert.deepEqual(sanitizePermissions('quotes:read', 'employee'), []);
});
test('rbac: bara kända roller är giltiga', () => {
  for (const r of ['superadmin', 'admin', 'employee', 'intern']) assert.equal(isValidRole(r), true);
  for (const r of ['root', '', null, undefined, 'Admin']) assert.equal(isValidRole(r), false);
});
test('rbac: admin kan inte hantera admin/superadmin men kan hantera employee/intern och sig själv', () => {
  assert.equal(canManageTarget('admin', 'superadmin'), false);
  assert.equal(canManageTarget('admin', 'admin'), false);
  assert.equal(canManageTarget('admin', 'employee'), true);
  assert.equal(canManageTarget('admin', 'intern'), true);
  assert.equal(canManageTarget('admin', 'admin', true), true);
});
test('rbac: superadmin kan hantera alla; andra roller ingen', () => {
  assert.equal(canManageTarget('superadmin', 'admin'), true);
  assert.equal(canManageTarget('superadmin', 'employee'), true);
  assert.equal(canManageTarget('superadmin', 'intern'), true);
  assert.equal(canManageTarget('employee', 'intern'), false);
  assert.equal(canManageTarget('intern', 'intern'), false);
  assert.equal(canManageTarget('intern', 'admin'), false);
});
test('rbac: intern och employee kan inte hantera sig själva som målanvändare', () => {
  assert.equal(canManageTarget('employee', 'employee', true), false);
  assert.equal(canManageTarget('intern', 'intern', true), false);
});
test('rbac: sanitizePermissions blockerar skadliga format och ogiltiga actions', () => {
  const dirty = ['quotes:read', 'quotes:execute', 'quotes:drop', 'quotes:admin', 'users:write', 'inventory:delete'];
  assert.deepEqual(
    sanitizePermissions(dirty, 'employee'),
    ['quotes:read', 'users:write', 'inventory:delete']
  );
  assert.deepEqual(
    sanitizePermissions(dirty, 'intern'),
    ['quotes:read']
  );
});

// ── Nätverksskyddet fungerar ─────────────────────────────────────────────────
test('nätverk: fetch och sockets är blockerade i testmiljön', async () => {
  await assert.rejects(async () => fetch('https://example.invalid'), /BLOCKERAT/);
  assert.ok(networkAttempts.includes('fetch'));
});
