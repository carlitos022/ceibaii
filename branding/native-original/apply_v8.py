"""Preserve native Monitor and downloader; add admin tab plus fix map icons."""
from pathlib import Path
import re,sys
root=Path(sys.argv[1]).resolve()
sources=Path(__file__).resolve().parent
map_java=sources/'CsrsMapControls.java'
raw=map_java.read_text(encoding='utf-8')
raw,n=re.subn(r'TextView layers = button\([^;]+;', 'TextView layers = button("", "Elegir capa del mapa");\n        CsrsGlyph.attach(layers, 1);',raw,count=1)
assert n==1
raw,n=re.subn(r'TextView full = button\([^;]+;', 'TextView full = button("", expanded ? "Volver al mapa normal" : "Pantalla completa");\n        CsrsGlyph.attach(full, 2);',raw,count=1)
assert n==1
raw,n=re.subn(r'new String\[\]\{"Calles", "[^"]+"\}', lambda m: 'new String[]{"Calles", "Sat\\u00e9lite con calles"}',raw,count=1)
assert n==1
map_java.write_text(raw,encoding='utf-8')
frag=root/'smali_classes2/com/streamax/ceibaii/tab/view/FragmentOptions.smali'
raw=frag.read_text(encoding='utf-8')
signature='.method public doBusiness()V'
a=raw.index(signature);b=raw.index('.end method',a)
block=raw[a:b]
needle='invoke-direct {p0}, Lcom/streamax/ceibaii/tab/view/FragmentOptions;->setTabsVisibility()V'
assert needle in block
hook='iget-object v0, p0, Lcom/streamax/ceibaii/base/BaseFragment;->mBaseView:Landroid/view/View;\n\n    invoke-static {v0}, Lcom/customserviciosrs/ceiba/CsrsDownloadsTabs;->attach(Landroid/view/View;)V'
block=block.replace('.locals 0','.locals 1',1).replace(needle,needle+'\n\n    '+hook,1)
raw=raw[:a]+block+raw[b:]
signature='.method public toOptions(IZ)V'
a=raw.index(signature);b=raw.index('.end method',a)
block=raw[a:b]
needle='    .line 364'
assert needle in block
hook=('    const/4 v0, 0x1\n\n'
      '    if-ne p1, v0, :csrs_not_monitor\n\n'
      '    invoke-static {}, Lcom/customserviciosrs/ceiba/CsrsDownloadsTabs;->showMonitor()V\n\n'
      '    :csrs_not_monitor\n\n')
block=block.replace(needle,hook+needle,1)
raw=raw[:a]+block+raw[b:]
frag.write_text(raw,encoding='utf-8')
login=root/'smali_classes2/com/streamax/ceibaii/login/view/LoginActivity.smali'
raw=login.read_text(encoding='utf-8')
signature='.method public login(Landroid/view/View;)V'
a=raw.index(signature);b=raw.index('.end method',a)
block=raw[a:b]
needle='invoke-direct {p0, p1, v0, v3}, Lcom/streamax/ceibaii/login/view/LoginActivity;->login(Ljava/lang/String;Ljava/lang/String;Lcom/streamax/ceibaii/entity/UserEntity;)V'
assert needle in block
block=block.replace(needle,'invoke-static {v3}, Lcom/customserviciosrs/ceiba/CsrsDownloadsTabs;->capture(Ljava/lang/Object;)V\n\n    '+needle,1)
raw=raw[:a]+block+raw[b:]
login.write_text(raw,encoding='utf-8')
meta=root/'apktool.yml'
raw=meta.read_text(encoding='utf-8')
assert raw.count('versionCode: 2025111106')==1
meta.write_text(raw.replace('versionCode: 2025111106','versionCode: 2025111107'),encoding='utf-8')
# Apktool may reuse a binary manifest unless its source mtime changes.
manifest=root/'AndroidManifest.xml'
manifest.touch()
print('v8 map glyphs and admin downloader tab applied')

