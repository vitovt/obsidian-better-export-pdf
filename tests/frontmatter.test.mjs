import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSource } from './load-source.mjs';

const { getPrintTitle, makePrintOptions } = await loadSource('src/pdf.ts');

test('print titles prefer frontmatter without changing output basenames', () => {
  const file = { basename: 'report' };
  for (const [title, expected] of [
    ['Звіт — 2026', 'Звіт — 2026'], [undefined, 'report'], [null, 'report'], ['', ''], [2026, '2026'],
  ]) {
    assert.equal(getPrintTitle({ file, frontMatter: { title } }), expected);
    assert.equal(file.basename, 'report');
  }
  assert.equal(getPrintTitle({ file }), 'report');
});

test('each document can override templates and interpolation without leaking to the next', () => {
  const config = {
    displayHeader: true, displayFooter: true, pageSize: 'A4', marginType: '1',
    headerTemplate: '<span class="title"></span>', footerTemplate: '<span class="pageNumber"></span>',
  };
  const first = makePrintOptions(config, { author: 'Alice', headerTemplate: '<span>{{author}}</span>' });
  const second = makePrintOptions(config, { author: 'Bob', footerTemplate: '<span>{{author}}</span>' });
  const plain = makePrintOptions(config);
  assert.equal(first.headerTemplate, '<span>Alice</span>');
  assert.equal(first.footerTemplate, config.footerTemplate);
  assert.equal(second.headerTemplate, config.headerTemplate);
  assert.equal(second.footerTemplate, '<span>Bob</span>');
  assert.equal(plain.headerTemplate, '<span class="title"></span>');
  assert.equal(plain.footerTemplate, '<span class="pageNumber"></span>');
});
