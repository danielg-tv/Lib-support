import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const outputRoot = path.join(projectRoot, 'vendor', 'tradingview');

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyDirectory(sourcePath, destinationPath) {
  await rm(destinationPath, { recursive: true, force: true });
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath, { recursive: true, force: true });
}

async function resolveSourcePath(label, candidatePaths) {
  for (const candidatePath of candidatePaths) {
    if (await exists(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(
    `Unable to find ${label}. Checked:\n${candidatePaths
      .map((candidatePath) => `- ${path.relative(projectRoot, candidatePath)}`)
      .join('\n')}`
  );
}

async function main() {
  const chartingLibrarySource = await resolveSourcePath('charting_library assets', [
    path.join(projectRoot, 'node_modules', 'charting_library', 'charting_library'),
  ]);

  await rm(path.join(outputRoot, 'charting_library'), { recursive: true, force: true });
  await copyDirectory(chartingLibrarySource, path.join(outputRoot, 'charting_library'));

  console.log(
    [
      `Synced TradingView assets into ${path.relative(projectRoot, outputRoot)}.`,
      'Source: node_modules/charting_library',
    ].join('\n')
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
