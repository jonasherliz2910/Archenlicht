"""Small Latin web fonts, retaining full originals for other scripts and printing.
Run with fonttools[woff]. Layout tables, variable axes and glyph outlines remain.
"""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ranges = [(0, 0x24F), (0x1E00, 0x1EFF), (0x2000, 0x206F),
          (0x20A0, 0x20CF), (0x2100, 0x214F), (0x2190, 0x21FF),
          (0xFEFF, 0xFEFF), (0xFFFD, 0xFFFD)]
codes = {code for start, end in ranges for code in range(start, end + 1)}
directory = Path('public/fonts/web-v2')
directory.mkdir(exist_ok=True)
for name in ['DMSans', 'CormorantGaramond', 'Caveat']:
    original = TTFont(Path('public/fonts') / f'{name}.woff2')
    original_cmap = original.getBestCmap()
    options = subset.Options()
    options.layout_features = ['*']
    options.notdef_glyph = True
    options.recommended_glyphs = True
    sub = subset.Subsetter(options=options)
    sub.populate(unicodes=codes)
    sub.subset(original)
    target = directory / f'{name}-latin.woff2'
    original.flavor = 'woff2'
    original.save(target)
    restored = TTFont(target)
    assert set(restored.getBestCmap()) == set(original_cmap) & codes
    assert all(char in restored.getBestCmap() for char in map(ord, 'ÄÖÜäöüß€'))
    print(f'{name}: {target.stat().st_size} bytes; Latin coverage verified')
