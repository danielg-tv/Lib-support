import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');

const nextVersion = process.argv[2];

if (!nextVersion || !/^\d+\.\d+\.\d+$/.test(nextVersion)) {
  console.error('Usage: npm run tv:use-version -- <major.minor.patch>');
  process.exit(1);
}

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
packageJson.dependencies ??= {};
packageJson.dependencies.charting_library =
  `git+ssh://git@github.com/tradingview/trading_platform.git#semver:${nextVersion}`;

await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log(
  [
    `Updated TradingView dependency to v${nextVersion}.`,
    'Run `npm install` next to download the release and resync the served assets.',
  ].join('\n')
);
