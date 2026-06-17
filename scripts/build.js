const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");
const assets = path.join(root, "assets");
const browsers = path.join(root, "browsers");
const dist = path.join(root, "dist");
const version = "0.4.0";
const contentMatches = [
  "https://x.com/*",
  "https://*.x.com/*",
  "https://twitter.com/*",
  "https://*.twitter.com/*"
];
const hostPermissions = [
  "https://x.com/*",
  "https://*.x.com/*",
  "https://twitter.com/*",
  "https://*.twitter.com/*",
  "https://pbs.twimg.com/*",
  "https://video.twimg.com/*",
  "https://*.twimg.com/*",
  "https://t.co/*"
];

const shared = {
  manifest_version: 3,
  name: "Xtension",
  short_name: "Xtension",
  version,
  description: "Télécharge les articles, tweets et threads X/Twitter en PDF depuis le menu X.",
  action: {
    default_title: "Xtension",
    default_icon: iconMap()
  },
  icons: iconMap(),
  permissions: ["downloads"],
  content_scripts: [
    {
      matches: contentMatches,
      js: ["content.js"],
      css: ["content.css"],
      run_at: "document_idle"
    }
  ],
  web_accessible_resources: [
    {
      resources: ["pdf-menu-icon.png"],
      matches: contentMatches
    }
  ],
  host_permissions: hostPermissions
};

const targets = {
  chrome: {
    ...shared,
    background: {
      service_worker: "background.js"
    },
    minimum_chrome_version: "114"
  },
  edge: {
    ...shared,
    background: {
      service_worker: "background.js"
    },
    minimum_chrome_version: "114"
  },
  firefox: {
    ...shared,
    background: {
      scripts: ["background.js"]
    },
    browser_specific_settings: {
      gecko: {
        id: "xtension@example.invalid",
        strict_min_version: "109.0"
      }
    }
  }
};

function iconMap() {
  return {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png"
  };
}

function cleanDirectory(dir) {
  fs.rmSync(dir, { force: true, recursive: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyExtensionFiles(targetDir) {
  for (const file of ["background.js", "content.js", "content.css"]) {
    copyFile(path.join(src, file), path.join(targetDir, file));
  }

  copyFile(path.join(assets, "pdf-menu-icon.png"), path.join(targetDir, "pdf-menu-icon.png"));

  for (const size of [16, 32, 48, 128]) {
    copyFile(path.join(assets, "icons", `icon-${size}.png`), path.join(targetDir, "icons", `icon-${size}.png`));
  }
}

function writeManifest(targetDir, manifest) {
  fs.writeFileSync(path.join(targetDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function buildTarget(name, manifest) {
  const targetDir = path.join(browsers, name);
  cleanDirectory(targetDir);
  copyExtensionFiles(targetDir);
  writeManifest(targetDir, manifest);
  const zipPath = path.join(dist, `xtension-${name}-v${version}.zip`);
  writeZip(targetDir, zipPath);
  return zipPath;
}

function collectFiles(dir) {
  const files = [];

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);

      if (entry.isDirectory()) {
        walk(full);
      } else {
        files.push(full);
      }
    }
  }

  walk(dir);
  return files;
}

function writeZip(sourceDir, zipPath) {
  const files = collectFiles(sourceDir);
  const chunks = [];
  const central = [];
  let offset = 0;

  function push(buffer) {
    chunks.push(buffer);
    offset += buffer.length;
  }

  for (const file of files) {
    const data = fs.readFileSync(file);
    const name = path.relative(sourceDir, file).replace(/\\/g, "/");
    const nameBytes = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const localOffset = offset;
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);
    push(localHeader);
    push(nameBytes);
    push(data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    central.push(centralHeader, nameBytes);
  }

  const centralOffset = offset;
  for (const part of central) {
    push(part);
  }
  const centralSize = offset - centralOffset;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);
  push(end);

  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  fs.writeFileSync(zipPath, Buffer.concat(chunks));
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

cleanDirectory(browsers);
cleanDirectory(dist);

const releaseFiles = [];

for (const [name, manifest] of Object.entries(targets)) {
  releaseFiles.push(buildTarget(name, manifest));
}

writeChecksums(releaseFiles);

const safariDir = path.join(browsers, "safari");
fs.mkdirSync(safariDir, { recursive: true });
fs.writeFileSync(path.join(safariDir, "README.md"), `# Safari

Safari ne charge pas directement un dossier WebExtension comme Chrome, Edge ou Firefox.

Utilise le package Chromium comme source, depuis macOS avec Xcode :

\`\`\`bash
xcrun safari-web-extension-converter browsers/chrome --bundle-identifier com.example.xtension
\`\`\`

Le convertisseur génère un projet Xcode contenant l'extension Safari et l'app hôte requise pour publication App Store.
`, "utf8");

console.log(`Built ${Object.keys(targets).length} browser packages in ${path.relative(root, dist)}`);

function writeChecksums(files) {
  const lines = files.map((file) => {
    const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    return `${hash}  ${path.basename(file)}`;
  });

  fs.writeFileSync(path.join(dist, "SHA256SUMS.txt"), `${lines.join("\n")}\n`, "utf8");
}
