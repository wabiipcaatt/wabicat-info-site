'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

let child;
let baseUrl;
let dataFile;
let tempDir;
const token = 'test-only-secret-not-for-production';

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitUntilReady() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Test server did not become ready');
}

test('public API paginates/searches; writes require auth; corrupt stores fail closed', async t => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wabicat-test-'));
  dataFile = path.join(tempDir, 'items.json');
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), ADMIN_API_KEY: token, DATA_FILE: dataFile },
    stdio: 'ignore'
  });
  t.after(() => {
    if (child && child.exitCode === null) child.kill('SIGTERM');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  await waitUntilReady();

  let response = await fetch(`${baseUrl}/api/items`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).items, []);

  response = await fetch(`${baseUrl}/api/items`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'unauthorized' })
  });
  assert.equal(response.status, 401);

  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}` };
  for (const title of ['Alpha guide', 'Beta news', 'Alpha update']) {
    response = await fetch(`${baseUrl}/api/items`, { method: 'POST', headers, body: JSON.stringify({ title }) });
    assert.equal(response.status, 201);
  }

  response = await fetch(`${baseUrl}/api/items?limit=2&offset=1`);
  let page = await response.json();
  assert.equal(page.total, 3);
  assert.equal(page.items.length, 2);
  assert.equal(page.hasMore, false);

  response = await fetch(`${baseUrl}/api/items?q=alpha`);
  page = await response.json();
  assert.equal(page.total, 2);
  assert.ok(page.items.every(item => item.title.toLowerCase().includes('alpha')));

  response = await fetch(`${baseUrl}/api/items?limit=bogus`);
  assert.equal(response.status, 400);

  fs.writeFileSync(dataFile, '{broken json');
  response = await fetch(`${baseUrl}/api/items`);
  assert.equal(response.status, 500);
  response = await fetch(`${baseUrl}/api/items`, {
    method: 'POST', headers, body: JSON.stringify({ title: 'must not overwrite corrupt data' })
  });
  assert.equal(response.status, 500);
  assert.equal(fs.readFileSync(dataFile, 'utf8'), '{broken json');
});
