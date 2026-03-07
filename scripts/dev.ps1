# Ensure Cargo is on PATH (e.g. if terminal was opened before Rust was installed)
$cargoBin = "$env:USERPROFILE\.cargo\bin"
if (Test-Path "$cargoBin\cargo.exe") {
  $env:Path = "$cargoBin;$env:Path"
}
Set-Location $PSScriptRoot\..
npm run tauri dev
