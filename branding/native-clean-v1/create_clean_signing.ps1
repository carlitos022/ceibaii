$ErrorActionPreference='Stop'
$dir='C:\ceibaii-buildtools\signing-csrsx-clean'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$passFile=Join-Path $dir 'csrsx-clean-password.txt'
$ks=Join-Path $dir 'csrsx-clean-release.p12'
if (!(Test-Path $passFile)) {
  $p=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N')
  [IO.File]::WriteAllText($passFile,$p)
}
$env:CSRSX_SIGN_PASS=[IO.File]::ReadAllText($passFile).Trim()
if (!(Test-Path $ks)) {
  & keytool -genkeypair -alias csrsx-clean -keyalg RSA -keysize 3072 -validity 10000 -storetype PKCS12 -keystore $ks -storepass:env CSRSX_SIGN_PASS -keypass:env CSRSX_SIGN_PASS -dname 'CN=CustomServiciosRS, OU=CSRS X Clean, O=CustomServiciosRS, L=Loja, ST=Loja, C=EC'
  if ($LASTEXITCODE -ne 0) { throw 'keytool genkey failed' }
}
& keytool -list -v -keystore $ks -storepass:env CSRSX_SIGN_PASS -alias csrsx-clean | Select-String 'Alias name:|SHA256:|Valid from:'
if ($LASTEXITCODE -ne 0) { throw 'keytool verify failed' }
Remove-Item Env:CSRSX_SIGN_PASS -ErrorAction SilentlyContinue
