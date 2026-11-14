"""Repackage the original fonts as WOFF2 without removing or changing glyphs.
Requires fonttools[woff]. The original TTFs remain the source for print output.
"""
from pathlib import Path
from fontTools.ttLib import TTFont

for name in ['DMSans', 'CormorantGaramond', 'Caveat']:
    source = Path('public/fonts') / (name + '.ttf')
    target = source.with_suffix('.woff2')
    font = TTFont(source)
    font.flavor = 'woff2'
    font.save(target)
    restored = TTFont(target)
    assert restored.getBestCmap() == font.getBestCmap()
    assert restored.getGlyphOrder() == font.getGlyphOrder()
    print(f'{name}: {source.stat().st_size} -> {target.stat().st_size} bytes; all glyphs retained')
