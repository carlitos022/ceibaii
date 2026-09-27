"""Keep the legacy Fleet drawer code but suppress it while the Vivo shell is active."""
from pathlib import Path
import sys
root=Path(sys.argv[1]).resolve()
main=root/'smali_classes2/com/streamax/ceibaii/tab/view/MainActivity.smali'
raw=main.read_text(encoding='utf-8')
helper='Lcom/customserviciosrs/ceiba/CsrsVivoTabs;->isLegacyFleetHidden()Z'
for method,label in [('lambda$openDrawLayout$0', 'csrs_allow_fleet'), ('unLockDrawerLayout', 'csrs_allow_unlock')]:
    # Match the method declaration, not an earlier call site.
    match=[line for line in raw.splitlines() if line.startswith('.method ') and method+'(' in line]
    assert len(match)==1, (method,match)
    begin=raw.index(match[0]); end=raw.index('.end method',begin)+len('.end method')
    body=raw[begin:end]
    if helper in body:
        assert body.count(helper)==1
        continue
    needle='    .locals 2\n' if method=='lambda$openDrawLayout$0' else '    .locals 1\n'
    assert body.count(needle)==1
    guard=('\n    invoke-static {}, '+helper+'\n\n    move-result v0\n\n'
           '    if-eqz v0, :'+label+'\n\n    return-void\n\n    :'+label+'\n')
    updated=body.replace(needle,needle+guard,1)
    raw=raw[:begin]+updated+raw[end:]
main.write_text(raw,encoding='utf-8')
print('Blocked legacy Fleet drawer opens and unlock events')
meta=root/'apktool.yml'
version=meta.read_text(encoding='utf-8')
if 'versionCode: 2025111113' in version:
    assert version.count('versionCode: 2025111113')==1
    meta.write_text(version.replace('versionCode: 2025111113','versionCode: 2025111114'),encoding='utf-8')
else:
    assert version.count('versionCode: 2025111114')==1
(root/'AndroidManifest.xml').touch()
print('CSRS X v15 versionCode ready')