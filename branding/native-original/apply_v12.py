"""Bump the decoded v11 CSRS X shell to v12 after the Vivo session fix."""
from pathlib import Path
import sys
root = Path(sys.argv[1]).resolve()
frag = (root / 'smali_classes2/com/streamax/ceibaii/tab/view/FragmentOptions.smali').read_text(encoding='utf-8')
login = (root / 'smali_classes2/com/streamax/ceibaii/login/view/LoginActivity.smali').read_text(encoding='utf-8')
assert frag.count('Lcom/customserviciosrs/ceiba/CsrsVivoTabs;->attach') == 1
assert frag.count('Lcom/customserviciosrs/ceiba/CsrsVivoTabs;->showMonitor') == 1
assert login.count('Lcom/customserviciosrs/ceiba/CsrsVivoTabs;->capture') == 1
meta = root / 'apktool.yml'
raw = meta.read_text(encoding='utf-8')
if 'versionCode: 2025111110' in raw:
    assert raw.count('versionCode: 2025111110') == 1
    meta.write_text(raw.replace('versionCode: 2025111110', 'versionCode: 2025111111'), encoding='utf-8')
else:
    assert raw.count('versionCode: 2025111111') == 1
(root / 'AndroidManifest.xml').touch()
print('CSRS X v12 versionCode ready')