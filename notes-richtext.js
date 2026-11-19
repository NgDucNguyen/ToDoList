/* Small, allow-listed note document: no stored HTML is executed. */
(function (root, factory) {
  const api = factory(); root.PlannerRichText = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const types = ['p', 'h1', 'h2', 'h3', 'check'];
  function normalize(content) {
    if (!content || content.version !== 1 || !Array.isArray(content.blocks) || !content.blocks.length) throw new Error('Định dạng nội dung ghi chú chưa được hỗ trợ.');
    const blocks = content.blocks.map(block => {
      if (!block || !types.includes(block.type) || !Array.isArray(block.runs)) throw new Error('Khối nội dung ghi chú không hợp lệ.');
      const runs = [];
      for (const run of block.runs) {
        if (!run || typeof run.text !== 'string' || typeof run.bold !== 'boolean' || (run.normal !== undefined && typeof run.normal !== 'boolean') || (run.bold && run.normal)) throw new Error('Định dạng chữ ghi chú không hợp lệ.');
        if (!run.text) continue;
        if (runs.at(-1)?.bold === run.bold && Boolean(runs.at(-1)?.normal) === Boolean(run.normal)) runs.at(-1).text += run.text;
        else runs.push({ text: run.text, bold: run.bold, ...(run.normal ? { normal: true } : {}) });
      }
      if (block.type === 'check' && typeof block.checked !== 'boolean') throw new Error('Trạng thái checklist không hợp lệ.');
      return { type: block.type, ...(block.type === 'check' ? { checked: block.checked } : {}), runs };
    });
    return { version: 1, blocks };
  }
  function fromPlain(body) {
    return { version: 1, blocks: body.split('\n').map(text => ({ type: 'p', runs: text ? [{ text, bold: false }] : [] })) };
  }
  function toPlain(content) { return normalize(content).blocks.map(block => (block.type === 'check' ? (block.checked ? '[x] ' : '[ ] ') : '') + block.runs.map(run => run.text).join('')).join('\n'); }
  function render(editor, content) {
    const document = editor.ownerDocument;
    const blocks = normalize(content).blocks.map(block => {
      const element = document.createElement(block.type === 'check' ? 'div' : block.type);
      let target = element;
      if (block.type === 'check') {
        element.dataset.noteCheck = ''; element.dataset.checked = String(block.checked);
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = block.checked;
        checkbox.contentEditable = 'false'; checkbox.setAttribute('aria-label', 'Hoàn thành mục ghi chú');
        target = document.createElement('span'); target.dataset.checkText = '';
        element.append(checkbox, target);
      }
      for (const run of block.runs) {
        const text = document.createTextNode(run.text);
        if (run.bold) { const strong = document.createElement('strong'); strong.append(text); target.append(strong); }
        else if (run.normal) { const span = document.createElement('span'); span.style.fontWeight = '400'; span.append(text); target.append(span); }
        else target.append(text);
      }
      if (!target.childNodes.length) target.append(document.createElement('br'));
      return element;
    });
    editor.replaceChildren(...blocks);
  }
  function serialize(editor) {
    const blocks = [], forbidden = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'IMG', 'VIDEO', 'AUDIO']);
    const blockTags = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE']);
    function inline(nodes, bold, runs, normal = false) {
      const list = Array.from(nodes);
      list.forEach((node, index) => {
        if (node.nodeType === 3) { if (node.data) runs.push({ text: node.data, bold, ...(normal ? { normal: true } : {}) }); return; }
        if (node.nodeType !== 1 || forbidden.has(node.tagName)) return;
        if (node.tagName === 'BR') {
          // The final BR is Chromium's caret placeholder, not another line.
          if (index !== list.length - 1) runs.push({ text: '\n', bold, ...(normal ? { normal: true } : {}) });
          return;
        }
        const weight = node.style?.fontWeight;
        const explicitBold = ['B', 'STRONG'].includes(node.tagName) || weight === 'bold' || Number(weight) >= 600;
        const explicitNormal = weight === 'normal' || weight === '400';
        const mark = explicitBold ? true : explicitNormal ? false : bold;
        inline(node.childNodes, mark, runs, explicitBold ? false : explicitNormal ? true : normal);
      });
    }
    function collect(nodes) {
      let loose = [];
      function flush() { if (loose.length) { const runs = []; inline(loose, false, runs); if (runs.length) blocks.push({ type: 'p', runs }); loose = []; } }
      for (const node of nodes) {
        if (node.nodeType === 1 && forbidden.has(node.tagName)) continue;
        if (node.nodeType === 1 && blockTags.has(node.tagName)) {
          flush();
          if (node.hasAttribute('data-note-check')) {
            const runs = []; inline(node.querySelector('[data-check-text]')?.childNodes || [], false, runs);
            blocks.push({ type: 'check', checked: Boolean(node.querySelector('input[type="checkbox"]')?.checked), runs });
            continue;
          }
          if (Array.from(node.children).some(child => blockTags.has(child.tagName))) collect(node.childNodes);
          else { const runs = []; inline(node.childNodes, false, runs); blocks.push({ type: types.includes(node.tagName.toLowerCase()) ? node.tagName.toLowerCase() : 'p', runs }); }
        } else loose.push(node);
      }
      flush();
    }
    collect(editor.childNodes);
    return normalize({ version: 1, blocks: blocks.length ? blocks : [{ type: 'p', runs: [] }] });
  }
  return { normalize, fromPlain, toPlain, render, serialize };
});
