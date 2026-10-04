import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFString, PDFHexString } from 'pdf-lib';
import { loadSource } from './load-source.mjs';

const { generateOutlines, editPDF } = await loadSource('src/pdf.ts');
const node = (key, level, children = []) => ({ key, title: key, level, children });
const tree = node('root', 0, [
  node('before', 2),
  node('title-a', 1, [node('section-a', 2, [node('detail', 3)]), node('skipped-level', 4)]),
  node('title-b', 1, [node('section-b', 2)]),
  node('title-only', 1),
]);
const positions = { 'section-a': [1, 321], detail: [1, 123] };
const titles = (outlines) => outlines.map(({ title, children }) => [title, titles(children)]);

test('default bookmarks retain H1 and all descendants', () => {
  assert.deepEqual(titles(generateOutlines(tree, positions)), [
    ['before', []], ['title-a', [['section-a', [['detail', []]]], ['skipped-level', []]]],
    ['title-b', [['section-b', []]]], ['title-only', []],
  ]);
});

test('excluding every H1 promotes children without changing order, nesting or destinations', () => {
  const before = structuredClone(tree);
  const outlines = generateOutlines(tree, positions, 6, true);
  assert.deepEqual(titles(outlines), [
    ['before', []], ['section-a', [['detail', []]]], ['skipped-level', []], ['section-b', []],
  ]);
  assert.deepEqual(outlines[1].to, [1, 0, 321]);
  assert.deepEqual(outlines[1].children[0].to, [1, 0, 123]);
  assert.deepEqual(tree, before);
});

test('maxLevel continues to apply to the original heading levels', () => {
  assert.deepEqual(titles(generateOutlines(tree, positions, 2, true)), [
    ['before', []], ['section-a', []], ['section-b', []],
  ]);
  assert.deepEqual(generateOutlines(tree, positions, 1, true), []);
  assert.deepEqual(generateOutlines(node('root', 0), {}, 6, true), []);
});

test('saved PDF excludes H1 bookmarks but retains page content and internal H1 links', async () => {
  const input = await PDFDocument.create();
  const page = input.addPage();
  page.drawText('Visible H1 title');
  const link = (uri, y) => input.context.register(input.context.obj({
    Type: 'Annot', Subtype: 'Link', Rect: [0, y, 10, y + 10], Border: [0, 0, 0],
    A: { S: 'URI', URI: PDFString.of(uri) },
  }));
  page.node.set(PDFName.of('Annots'), input.context.obj([
    link('af://title', 700), link('af://section', 600), link('an://title', 100),
  ]));
  const inputBytes = await input.save();
  const headings = node('root', 0, [node('title', 1, [node('section', 2)])]);
  for (const excludeH1FromBookmarks of [false, true]) {
    const bytes = await editPDF(inputBytes, { headings, maxLevel: 6, excludeH1FromBookmarks });
    const output = await PDFDocument.load(bytes);
    const outlines = output.catalog.lookup(PDFName.of('Outlines'), PDFDict);
    const first = outlines.lookup(PDFName.of('First'), PDFDict);
    assert.equal(first.lookup(PDFName.of('Title'), PDFHexString).decodeText(), excludeH1FromBookmarks ? 'section' : 'title');
    const dest = first.lookup(PDFName.of('Dest'), PDFArray);
    assert.equal(dest.get(3).asNumber(), excludeH1FromBookmarks ? 600 : 700);
    const outputPage = output.getPage(0);
    const internalLink = outputPage.node.Annots().lookup(2, PDFDict);
    assert.equal(internalLink.lookup(PDFName.of('Dest'), PDFArray).get(3).asNumber(), 700);
    const contentBytes = (doc) => {
      const contents = doc.getPage(0).node.Contents();
      return Array.from({ length: contents.size() }, (_, i) => [...contents.lookup(i).getContents()]);
    };
    assert.deepEqual(contentBytes(output), contentBytes(await PDFDocument.load(inputBytes)));
  }
});

test('each new export dialog takes the global preference over previous overrides', async () => {
  globalThis.window = { localStorage: { getItem: () => 'en' } };
  const { ExportConfigModal } = await loadSource('src/modal.ts', { Modal: class {} });
  for (const preference of [false, true, undefined]) {
    const plugin = { app: {}, settings: {
      excludeH1FromBookmarks: preference,
      prevConfig: { excludeH1FromBookmarks: !preference, scale: 75 },
    } };
    const first = new ExportConfigModal(plugin, {});
    assert.equal(first.defaultConfig.excludeH1FromBookmarks, preference ?? false);
    first.defaultConfig.excludeH1FromBookmarks = !preference;
    const next = new ExportConfigModal(plugin, {});
    assert.equal(next.defaultConfig.excludeH1FromBookmarks, preference ?? false);
    assert.equal(next.defaultConfig.scale, 75);
    assert.equal(plugin.settings.excludeH1FromBookmarks, preference);
  }
});
