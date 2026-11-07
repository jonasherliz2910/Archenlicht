param([ValidateSet('start','dev','test','check','seed','install','assets','design-previews')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js 24 oder neuer fehlt. Bitte von https://nodejs.org/ installieren und erneut starten.' }
if ($Action -eq 'install') {
  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($npmCommand) { & $npmCommand.Source install }
  else {
    $pnpmPath = Join-Path (Split-Path (Split-Path $nodePath -Parent) -Parent) 'node_modules\pnpm\bin\pnpm.cjs'
    if (-not (Test-Path -LiteralPath $pnpmPath)) { throw 'npm fehlt. Bitte Node.js inklusive npm installieren.' }
    & $nodePath $pnpmPath install --allow-build=sharp
  }
  exit $LASTEXITCODE
}
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\sharp'))) { throw 'Abhaengigkeiten fehlen. Zuerst .\Start-Shop.ps1 install ausfuehren.' }
switch ($Action) {
  'start' { & $nodePath --env-file-if-exists=.env server/index.js }
  'dev' { & $nodePath --env-file-if-exists=.env --watch server/index.js }
  'test' { & $nodePath --test --test-concurrency=1 tests/*.test.js }
  'check' { & $nodePath scripts/check.mjs }
  'seed' { & $nodePath --env-file-if-exists=.env scripts/seed.mjs }
  'assets' { & $nodePath scripts/brand-assets.mjs }
  'design-previews' { & $nodePath scripts/design-preview.mjs }
}
exit $LASTEXITCODE
