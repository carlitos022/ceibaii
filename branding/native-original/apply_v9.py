"""Update safe Spanish copy and version after v8; visual controls are helper Java."""
from pathlib import Path
from lxml import etree
import sys
root=Path(sys.argv[1]).resolve()
a='{http://schemas.android.com/apk/res/android}'
layout=root/'res/layout/activity_login.xml'
tree=etree.parse(str(layout))
count=0
for item in tree.getroot().iter():
    if item.get(a+'text')=='TECNOLOGÍA, SEGURIDAD Y CONFIANZA':
        item.set(a+'text','TECNOLOGIA, SEGURIDAD Y CONFIANZA')
        count+=1
assert count==1
tree.write(str(layout),encoding='utf-8',xml_declaration=True)
meta=root/'apktool.yml'
raw=meta.read_text(encoding='utf-8')
assert raw.count('versionCode: 2025111107')==1
meta.write_text(raw.replace('versionCode: 2025111107','versionCode: 2025111108'),encoding='utf-8')
(root/'AndroidManifest.xml').touch()
print('CSRS X v9 ASCII labels and versionCode applied')
