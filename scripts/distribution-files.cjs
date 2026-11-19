/* Explicit public files: builds never copy private profiles or local extras. */
const webFiles = [
  'index.html', 'style.css', 'chatbot.css', 'assets/chatbot-avatar.svg',
  'planner-store.js', 'lunar.js', 'hust-ui.js', 'notes-richtext.js',
  'notes-store.js', 'notes.js', 'chatbot-core.js', 'chatbot-nlu.js',
  'chatbot-model.js', 'chatbot-knowledge.js', 'chatbot-local.js',
  'chatbot.js', 'app.js', 'appearance.js',
];
const desktopFiles = [...webFiles, 'main.js', 'preload.js', 'hust-connector.js',
  'hust-extractor.js', 'Calendar.ico', 'package.json', 'LICENSE'];
function includePath(file, files = desktopFiles) {
  const relative = file.replaceAll('\\', '/').replace(/^\/+/, '');
  return !relative || files.some(name => name === relative || name.startsWith(relative + '/'));
}
module.exports = { webFiles, desktopFiles, includePath };
