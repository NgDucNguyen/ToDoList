/* A small supervised intent classifier. Training and inference share these features. */
(function (root, factory) {
  const api = factory(); root.PlannerChatbotNLU = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function normalize(text) {
    return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function features(text, size = 4096) {
    const words = normalize(text).match(/[a-z0-9]+/g) || [], counts = new Map();
    function add(value, weight) {
      let hash = 2166136261;
      for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
      const index = (hash >>> 0) % size; counts.set(index, (counts.get(index) || 0) + weight);
    }
    for (let i = 0; i < words.length; i++) {
      add('w:' + words[i], 1.5);
      if (i) add('b:' + words[i - 1] + '_' + words[i], 1.4);
      const padded = '^' + words[i] + '$';
      for (let n = 3; n <= 4; n++) for (let j = 0; j <= padded.length - n; j++) add('c:' + padded.slice(j, j + n), .25);
    }
    let norm = 0;
    const vector = [...counts].map(([i, count]) => { const value = Math.log1p(count); norm += value * value; return [i, value]; });
    norm = Math.sqrt(norm) || 1;
    return vector.map(([i, value]) => [i, value / norm]);
  }
  function classify(text, model) {
    const vector = features(text, model.featureCount);
    const scores = model.labels.map((intent, index) => ({ intent, score: vector.reduce((sum, [i, value]) => sum + model.weights[index][i] * value, model.bias[index]) }));
    const max = Math.max(...scores.map(item => item.score));
    const total = scores.reduce((sum, item) => sum + Math.exp(item.score - max), 0);
    scores.forEach(item => { item.confidence = Math.exp(item.score - max) / total; });
    scores.sort((a, b) => b.confidence - a.confidence);
    return { ...scores[0], margin: scores[0].confidence - scores[1].confidence, alternatives: scores.slice(1, 3) };
  }
  return { normalize, features, classify };
});
