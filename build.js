/**
 * Zero-dependency build script for Fullscreen Reloaded.
 * Compiles modular src/ into a single standalone fullscreen-reloaded.js bundle.
 *
 * Usage:
 *   node build.js           # Build once
 *   node build.js --watch   # Watch for changes and rebuild
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, "src");
const DIST_FILE = path.join(__dirname, "fullscreen-reloaded.js");
const STYLES_DIR = path.join(SRC_DIR, "styles");

const CSS_FILES_ORDER = [
  "variables.css",
  "background.css",
  "stage.css",
  "lyrics.css",
  "controls.css",
  "topbar.css",
  "settings.css",
  "ambient.css",
  "upnext.css",
  "idle.css",
];

function buildStyles() {
  let combinedCss = "";
  for (const file of CSS_FILES_ORDER) {
    const filePath = path.join(STYLES_DIR, file);
    if (fs.existsSync(filePath)) {
      combinedCss += `\n/* --- ${file} --- */\n` + fs.readFileSync(filePath, "utf-8");
    }
  }
  return combinedCss;
}

function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllJsFiles(itemPath));
    } else if (item.endsWith(".js")) {
      results.push(itemPath);
    }
  }
  return results;
}

function normalizeModuleId(baseDir, filePath) {
  let rel = path.relative(baseDir, filePath).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

function resolveImportPath(fromFile, importPath) {
  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, importPath);
  return normalizeModuleId(SRC_DIR, resolved);
}

function transformModule(content, filePath, bundledCss) {
  // Replace CSS import with embedded string
  content = content.replace(/import\s+([A-Za-z0-9_$]+)\s+from\s+['"][^'"]*styles\/index\.css['"];?/g, (m, varName) => {
    return `const ${varName} = ${JSON.stringify(bundledCss)};`;
  });

  // Transform named imports: import { a, b as c } from "./path.js";
  content = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g, (m, specifiers, importPath) => {
    const resolvedPath = resolveImportPath(filePath, importPath);
    return `const { ${specifiers} } = require(${JSON.stringify(resolvedPath)});`;
  });

  // Transform default imports: import a from "./path.js";
  content = content.replace(/import\s+([A-Za-z0-9_$]+)\s+from\s+['"]([^'"]+)['"];?/g, (m, varName, importPath) => {
    const resolvedPath = resolveImportPath(filePath, importPath);
    return `const ${varName} = (function() { const _mod = require(${JSON.stringify(resolvedPath)}); return _mod && _mod.default !== undefined ? _mod.default : _mod; })();`;
  });

  // 1. Collect exported functions (sync or async) BEFORE stripping
  const exportedFuncs = [];
  const funcRegex = /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    exportedFuncs.push(match[1]);
  }

  // 2. Collect exported classes BEFORE stripping
  const exportedClasses = [];
  const classRegex = /^export\s+class\s+([A-Za-z0-9_$]+)/gm;
  while ((match = classRegex.exec(content)) !== null) {
    exportedClasses.push(match[1]);
  }

  // 3. Transform export const / let / var: export const foo = ...
  content = content.replace(/^export\s+(const|let|var)\s+([A-Za-z0-9_$]+)\s*=/gm, (m, type, name) => {
    return `${type} ${name} = exports.${name} =`;
  });

  // 4. Strip 'export ' from functions and classes
  content = content.replace(/^export\s+((?:async\s+)?function\s+)/gm, "$1");
  content = content.replace(/^export\s+(class\s+)/gm, "$1");

  // 5. Transform export default: export default ...
  content = content.replace(/^export\s+default\s+/gm, "exports.default = ");

  // 6. Append function & class exports to module.exports
  if (exportedFuncs.length > 0) {
    content += "\n// Exported functions\n";
    for (const fn of exportedFuncs) {
      content += `exports.${fn} = ${fn};\n`;
    }
  }
  if (exportedClasses.length > 0) {
    content += "\n// Exported classes\n";
    for (const cl of exportedClasses) {
      content += `exports.${cl} = ${cl};\n`;
    }
  }

  return content;
}

export function build() {
  const startTime = Date.now();
  console.log("[Fullscreen Reloaded] Building extension bundle...");

  const bundledCss = buildStyles();
  const jsFiles = getAllJsFiles(SRC_DIR);

  let modulesObj = "{\n";
  for (const file of jsFiles) {
    const moduleId = normalizeModuleId(SRC_DIR, file);
    const rawContent = fs.readFileSync(file, "utf-8");
    const transformed = transformModule(rawContent, file, bundledCss);

    modulesObj += `    ${JSON.stringify(moduleId)}: function(require, exports, module) {\n`;
    modulesObj += `// --- ${moduleId} ---\n`;
    modulesObj += transformed + "\n";
    modulesObj += `    },\n\n`;
  }
  modulesObj += "  }";

  const bundle = `// ==========================================================================
// Fullscreen Reloaded (Spotify 1.3.6 compatible)
// A cinematic, modern fullscreen replacement for Spicetify.
// Generated on: ${new Date().toISOString()}
// ==========================================================================

(function FullscreenReloaded() {
  "use strict";

  const __modules = ${modulesObj};
  const __cache = {};

  function __require(id) {
    let cleanId = id;
    if (!cleanId.endsWith(".js") && !cleanId.endsWith(".css")) {
      cleanId += ".js";
    }
    if (!cleanId.startsWith(".")) {
      cleanId = "./" + cleanId;
    }

    if (__cache[cleanId]) {
      return __cache[cleanId].exports;
    }

    if (!__modules[cleanId]) {
      throw new Error("[Fullscreen Reloaded] Module not found: " + cleanId);
    }

    const module = (__cache[cleanId] = { exports: {} });
    __modules[cleanId](__require, module.exports, module);
    return module.exports;
  }

  // Bootstrap application
  __require("./index.js");
})();
`;

  fs.writeFileSync(DIST_FILE, bundle, "utf-8");
  const elapsed = Date.now() - startTime;
  const sizeKb = (Buffer.byteLength(bundle, "utf-8") / 1024).toFixed(1);
  console.log(`[Fullscreen Reloaded] Bundle created: ${DIST_FILE} (${sizeKb} KB) in ${elapsed}ms`);
}

// Check arguments
const isWatch = process.argv.includes("--watch");
build();

if (isWatch) {
  console.log("[Fullscreen Reloaded] Watching src/ for changes...");
  let timeout = null;
  fs.watch(SRC_DIR, { recursive: true }, (eventType, filename) => {
    if (filename) {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        console.log(`[Fullscreen Reloaded] Changed: ${filename}. Rebuilding...`);
        try {
          build();
        } catch (e) {
          console.error("[Fullscreen Reloaded] Build error:", e);
        }
      }, 100);
    }
  });
}
