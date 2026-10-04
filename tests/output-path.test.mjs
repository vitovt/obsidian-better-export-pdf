import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { loadSource } from './load-source.mjs';

class TFile {
  constructor(basename, parentPath = '/') {
    this.basename = basename;
    this.parent = { path: parentPath };
  }
}
class FileSystemAdapter {
  getBasePath() { return path.resolve('/vault'); }
}
const { getSiblingOutputFile } = await loadSource('src/pdf.ts', { TFile, FileSystemAdapter });
const app = { vault: { adapter: new FileSystemAdapter(), getName: () => 'My vault' } };

test('single and batch notes keep their own folder and filename', () => {
  for (const folder of ['/', 'Projects', 'Projects/Плани']) {
    assert.equal(getSiblingOutputFile(app, new TFile('Звіт', folder)), path.join('/vault', folder, 'Звіт.pdf'));
  }
});

test('combined folder and vault exports use the folder name inside that folder', () => {
  assert.equal(getSiblingOutputFile(app, { name: 'Projects', path: 'Projects' }), path.join('/vault', 'Projects', 'Projects.pdf'));
  assert.equal(getSiblingOutputFile(app, { name: '', path: '/' }), path.join('/vault', 'My vault.pdf'));
});

test('timestamp applies to both notes and combined folders', (t) => {
  t.mock.method(Date, 'now', () => 123456);
  assert.equal(getSiblingOutputFile(app, new TFile('Note'), true), path.join('/vault', 'Note-123456.pdf'));
  assert.equal(getSiblingOutputFile(app, { name: 'Folder', path: 'Folder' }, true), path.join('/vault', 'Folder', 'Folder-123456.pdf'));
});

test('unsupported adapters fail clearly instead of constructing an invalid path', () => {
  assert.throws(() => getSiblingOutputFile({ vault: { adapter: {} } }, new TFile('Note')), /local filesystem vault/);
});
