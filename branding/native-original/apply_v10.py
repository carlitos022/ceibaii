"""Center the initial map camera and bump CSRS X v10."""
from pathlib import Path
import sys
root=Path(sys.argv[1]).resolve()
frag=root/'smali_classes2/com/streamax/ceibaii/map/view/FragmentRealTimeMap.smali'
raw=frag.read_text(encoding='utf-8')
start=raw.index('.method private initBaseInfoMap()V')
end=raw.index('.end method',start)
block=raw[start:end]
needle='    :goto_0\n    return-void'
hook=('    :goto_0\n\n'
      '    iget-object v0, p0, Lcom/streamax/ceibaii/map/view/FragmentRealTimeMap;->mBaseInfoMap:Lcom/streamax/rmmapdemo/api/AbstractBaseInfoMap;\n\n'
      '    invoke-static {v0}, Lcom/customserviciosrs/ceiba/CsrsMapControls;->centerEcuador(Ljava/lang/Object;)V\n\n'
      '    return-void')
assert block.count(needle)==1
raw=raw[:start]+block.replace(needle,hook)+raw[end:]
frag.write_text(raw,encoding='utf-8')
meta=root/'apktool.yml'
data=meta.read_text(encoding='utf-8')
assert data.count('versionCode: 2025111108')==1
meta.write_text(data.replace('versionCode: 2025111108','versionCode: 2025111109'),encoding='utf-8')
(root/'AndroidManifest.xml').touch()
print('v10 Ecuador camera and version applied')