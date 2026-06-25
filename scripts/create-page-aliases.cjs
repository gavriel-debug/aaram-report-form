const fs = require("node:fs");
const path = require("node:path");

const distDir = path.join(__dirname, "..", "dist");
const indexPath = path.join(distDir, "index.html");

const aliases = ["report", "dryer", "compressor", "delivery"];

for (const alias of aliases) {
  const aliasDir = path.join(distDir, alias);
  fs.mkdirSync(aliasDir, { recursive: true });
  fs.copyFileSync(indexPath, path.join(aliasDir, "index.html"));
}

fs.copyFileSync(indexPath, path.join(distDir, "404.html"));
