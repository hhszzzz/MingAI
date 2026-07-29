import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TMP_DIR = path.join(REPO_ROOT, '.tmp-publish', 'npmjs');
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

function readJsonFile(filePath) {
  return readFile(filePath, 'utf8').then((content) => JSON.parse(content));
}

function packWorkspacePackage(packageName, outputFile) {
  execFileSync('pnpm', ['--filter', packageName, 'pack', '--out', outputFile], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
  });
}

function extractPackedManifest(tarballPath) {
  const content = execFileSync('tar', ['-xOf', tarballPath, 'package/package.json'], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  return JSON.parse(content);
}

function listPackedFiles(tarballPath) {
  return execFileSync('tar', ['-tf', tarballPath], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
  }).trim().split('\n');
}

function assertNoWorkspaceProtocols(manifest) {
  for (const fieldName of DEPENDENCY_FIELDS) {
    const deps = manifest[fieldName];
    if (!deps || typeof deps !== 'object') continue;
    for (const [dependencyName, version] of Object.entries(deps)) {
      assert.notEqual(
        typeof version === 'string' ? version.startsWith('workspace:') : false,
        true,
        `${manifest.name} ${fieldName}.${dependencyName} should not keep workspace protocol`,
      );
    }
  }
}

test('npm package tarballs should rewrite workspace dependencies before publish', async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
  await mkdir(TMP_DIR, { recursive: true });

  const coreSourceManifest = await readJsonFile(path.join(REPO_ROOT, 'packages/core/package.json'));
  const mcpSourceManifest = await readJsonFile(path.join(REPO_ROOT, 'packages/mcp/package.json'));
  const serverSourceManifest = await readJsonFile(path.join(REPO_ROOT, 'packages/mcp-server/package.json'));

  const coreTarball = path.join(TMP_DIR, `taibu-core-${coreSourceManifest.version}.tgz`);
  const mcpTarball = path.join(TMP_DIR, `taibu-mcp-${mcpSourceManifest.version}.tgz`);
  const serverTarball = path.join(TMP_DIR, `taibu-mcp-server-${serverSourceManifest.version}.tgz`);

  packWorkspacePackage('taibu-core', coreTarball);
  packWorkspacePackage('taibu-mcp', mcpTarball);
  packWorkspacePackage('taibu-mcp-server', serverTarball);

  const corePackedManifest = extractPackedManifest(coreTarball);
  const mcpPackedManifest = extractPackedManifest(mcpTarball);
  const serverPackedManifest = extractPackedManifest(serverTarball);

  assert.equal(corePackedManifest.version, coreSourceManifest.version);
  assert.equal(mcpPackedManifest.version, mcpSourceManifest.version);
  assert.equal(serverPackedManifest.version, serverSourceManifest.version);

  assertNoWorkspaceProtocols(corePackedManifest);
  assertNoWorkspaceProtocols(mcpPackedManifest);
  assertNoWorkspaceProtocols(serverPackedManifest);

  assert.equal(
    mcpPackedManifest.dependencies['taibu-core'],
    coreSourceManifest.version,
    'taibu-mcp should depend on the published taibu-core version in the packed artifact',
  );
  assert.equal(
    serverPackedManifest.dependencies['taibu-core'],
    coreSourceManifest.version,
    'taibu-mcp-server should depend on the published taibu-core version in the packed artifact',
  );

  const serverFiles = listPackedFiles(serverTarball);
  assert.equal(
    serverFiles.some((file) => /package\/dist\/(?:oauth\/|key-cache\.|supabase\.)/u.test(file)),
    false,
    'taibu-mcp-server should not publish stale authentication or Supabase build artifacts',
  );
});
