"""Publish a signed CSRS X APK and its mandatory-update manifest to downloads."""
from pathlib import Path
import hashlib, json, shutil, sys, zipfile
from xml.etree import ElementTree
source=Path(sys.argv[1]).resolve()
destination=Path(sys.argv[2]).resolve()
code=int(sys.argv[3])
minimum=int(sys.argv[4])
assert source.is_file() and source.suffix=='.apk'
assert minimum<=code
destination.mkdir(parents=True,exist_ok=True)
target=destination/source.name
shutil.copy2(source,target)
digest=hashlib.sha256(target.read_bytes()).hexdigest()
manifest={'packageName':'com.googlemap.ceibaii','latestVersionCode':code,
 'minimumVersionCode':minimum,'apkUrl':'http://209.126.77.129:3010/downloads/'+target.name,
 'sha256':digest}
tmp=destination/'csrs-x-version.json.tmp'
tmp.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
tmp.replace(destination/'csrs-x-version.json')
print('Published',target.name,'SHA-256',digest)
