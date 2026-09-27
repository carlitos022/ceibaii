"""Add separately compiled branding UI classes to a rebuilt unsigned APK."""
import sys
import zipfile
from pathlib import Path

source, helper, target = map(Path, sys.argv[1:4])
with zipfile.ZipFile(source) as original, zipfile.ZipFile(target, "w") as merged:
    assert "classes3.dex" not in original.namelist()
    for item in original.infolist():
        merged.writestr(item, original.read(item.filename))
    merged.write(helper, "classes3.dex", compress_type=zipfile.ZIP_DEFLATED)
print("Added branding UI classes as classes3.dex")
