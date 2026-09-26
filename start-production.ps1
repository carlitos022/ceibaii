$ErrorActionPreference = 'Stop'
$env:NODE_ENV = 'production'
Set-Location 'C:\customserviciosrs\ceiba-fleet'
& 'C:\Users\Administrator\AppData\Local\hermes\node\node.exe' 'dist\server.cjs'