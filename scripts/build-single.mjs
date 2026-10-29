import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 1. 读取基础配置与静态资源
const deckPath = path.join(rootDir, 'deck.json');
const deck = JSON.parse(fs.readFileSync(deckPath, 'utf8'));

const cssPath = path.join(rootDir, 'css', 'main.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

const playerPath = path.join(rootDir, 'js', 'player.js');
const playerJs = fs.readFileSync(playerPath, 'utf8');

const indexPath = path.join(rootDir, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// 2. 收集所有页面 HTML 片段
const fragments = {};
for (const page of deck.pages) {
  const filePath = path.join(rootDir, page.path);
  if (fs.existsSync(filePath)) {
    fragments[page.path] = fs.readFileSync(filePath, 'utf8');
  } else {
    console.warn(`[WARN] Page not found: ${page.path}`);
  }
}

// 3. 收集所有自定义交互模块代码
const modules = {};
for (const page of deck.pages) {
  if (page.module) {
    const modPath = path.join(rootDir, page.module);
    if (fs.existsSync(modPath)) {
      modules[page.module] = fs.readFileSync(modPath, 'utf8');
    }
  }
}

// 4. 构建嵌入式执行脚本
const modulesCode = Object.entries(modules)
  .map(([modName, code]) => {
    // 将 ES 模块转换成自执行工厂函数挂载
    const cleanCode = code
      .replace(/export\s+default\s+/, 'return ')
      .replace(/export\s+const\s+(\w+)\s*=/, 'const $1 =')
      .replace(/export\s+function\s+(\w+)/, 'function $1');
    return `"${modName}": (() => { ${cleanCode}; return typeof init === 'function' ? { init } : {}; })()`;
  })
  .join(',\n');

const inlineScript = `
  <script type="module">
    window.__EMBEDDED_DECK__ = ${JSON.stringify(deck)};
    window.__EMBEDDED_FRAGMENTS__ = ${JSON.stringify(fragments)};
    window.__EMBEDDED_MODULES__ = { ${modulesCode} };
    ${playerJs}
  </script>
`;

// 5. 组装为自包含的单个 HTML 文件
indexHtml = indexHtml.replace(
  /<link rel="stylesheet" href="css\/main\.css[^"]*">/,
  `<style>\n${cssContent}\n</style>`
);
indexHtml = indexHtml.replace(
  /<script type="module" src="js\/player\.js[^"]*"><\/script>/,
  inlineScript
);

const outputPath = path.join(distDir, 'deck-standalone.html');
fs.writeFileSync(outputPath, indexHtml, 'utf8');

const stats = fs.statSync(outputPath);
const sizeKb = (stats.size / 1024).toFixed(1);
console.log(`✓ Single-file standalone deck generated: dist/deck-standalone.html (${sizeKb} KB)`);
console.log(`  可以直接双击本地打开，无需任何 Web 服务器，随时发微信/飞书分享！`);
