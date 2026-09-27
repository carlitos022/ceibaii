"""Bump the functional v13 Android shell to v14 without changing CMS components."""
from pathlib import Path
import sys
root = Path(sys.argv[1]).resolve()
frag = (root / 'smali_classes2/com/streamax/ceibaii/tab/view/FragmentOptions.smali').read_text(encoding='utf-8')
assert frag.count('Lcom/customserviciosrs/ceiba/CsrsVivoTabs;->attach') == 1
assert frag.count('Lcom/customserviciosrs/ceiba/CsrsDownloadsTabs;->attach') == 1
meta = root / 'apktool.yml'
raw = meta.read_text(encoding='utf-8')
if 'versionCode: 2025111112' in raw:
    assert raw.count('versionCode: 2025111112') == 1
    meta.write_text(raw.replace('versionCode: 2025111112', 'versionCode: 2025111113'), encoding='utf-8')
else:
    assert raw.count('versionCode: 2025111113') == 1
(root / 'AndroidManifest.xml').touch()
print('CSRS X v14 versionCode ready')