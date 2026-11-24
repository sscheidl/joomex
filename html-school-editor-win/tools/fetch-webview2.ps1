# Downloads the WebView2 SDK named in dependencies.json into third_party/webview2 and checks its SHA-256.
# Usage (PowerShell, in html-school-editor-win):  powershell -ExecutionPolicy Bypass -File tools\fetch-webview2.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$deps = Get-Content (Join-Path $root 'dependencies.json') -Raw | ConvertFrom-Json
$wv = $deps.'webview2-sdk'
$third = Join-Path $root 'third_party'
New-Item -ItemType Directory -Force $third | Out-Null
$package = Join-Path $third ($wv.package + "." + $wv.version + ".nupkg")
if (-not (Test-Path $package)) {
    Write-Host "Download $($wv.source)"
    Invoke-WebRequest -Uri $wv.source -OutFile $package -UseBasicParsing
}
$hash = (Get-FileHash $package -Algorithm SHA256).Hash.ToLowerInvariant()
if (-not $wv.archive_sha256) {
    Write-Host ""
    Write-Host "SHA-256 of the package: $hash"
    Write-Host "The hash is not pinned yet. Check the package (source, licence) and write the hash into dependencies.json (archive_sha256), then run this script again."
    exit 2
}
if ($hash -ne $wv.archive_sha256.ToLowerInvariant()) {
    Remove-Item $package
    throw "SHA-256 mismatch: expected $($wv.archive_sha256), got $hash. The package was removed."
}
$dest = Join-Path $third 'webview2'
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($package, $dest)
Write-Host "WebView2 SDK $($wv.version) unpacked to third_party\webview2 (SHA-256 ok)."
Write-Host "Licence: $(Join-Path $dest 'LICENSE.txt')"
