"""Extract official print guides offline; never order, upload or approve production.

Requires psd-tools and the Podbase PSD + requirements CSV downloaded from the
official print-file guide. Re-run explicitly when Podbase changes those files.
"""
import csv
import hashlib
import json
import re
from pathlib import Path
from psd_tools import PSDImage
from podbase_raster_guide import extract_raster_guide

root = Path(__file__).resolve().parent.parent
source = root / '.tools/podbase-print-references/podbase-phone-layouts.psd'
requirements = root / '.tools/podbase-print-references/requirements.csv'
mapping = json.loads((root / 'server/podbase-model-map.json').read_text('utf-8'))
psd = PSDImage.open(source)
width, height = psd.size
assert (width, height) == (2000, 3400)
rows = list(csv.DictReader(requirements.open(encoding='utf-8-sig')))
groups = [layer for layer in psd.descendants() if layer.is_group()]
# These are the literal names of shared guides (and a typo) in Podbase's PSD.
aliases = {
    'iphone-12': 'iPhone 12/12 Pro', 'iphone-12-pro': 'iPhone 12/12 Pro',
    'iphone-17-pro': 'iPhone 17 Pro / 18 Pro', 'iphone-17-pro-max': 'iPhone 17 Pro Max / 18 Pro Max',
    'iphone-18-pro': 'iPhone 17 Pro / 18 Pro', 'iphone-18-pro-max': 'iPhone 17 Pro Max / 18 Pro Max',
    'samsung-galaxy-s23-ultra': 'Sasmung Galaxy S23 Ultra 5G',
    'samsung-galaxy-a36': 'Samsung Galaxy A36/A56', 'samsung-galaxy-a56': 'Samsung Galaxy A36/A56',
    'samsung-galaxy-a17': 'Samsung Galaxy A17 / A18'
}
def key(value):
    return re.sub('[^a-z0-9]', '', value.lower())
def shape(layer):
    if not layer.has_vector_mask():
        left, top, right, bottom = layer.bbox
        return {'path': f'M {left} {top} H {right} V {bottom} H {left} Z',
                'bounds': {'x': left, 'y': top, 'width': right-left, 'height': bottom-top},
                'conservativeRasterBounds': True}
    paths = []
    def coords(point):
        return f'{point[1] * width:.5f} {point[0] * height:.5f}'
    for subpath in layer.vector_mask.paths:
        if not subpath.is_closed() or subpath.operation != 1:
            raise ValueError('Unsupported path operation in ' + layer.name)
        knots = list(subpath)
        parts = ['M ' + coords(knots[0].anchor)]
        for previous, current in zip(knots, knots[1:] + knots[:1]):
            parts.append('C ' + coords(previous.leaving) + ' ' + coords(current.preceding) + ' ' + coords(current.anchor))
        paths.append(' '.join(parts) + ' Z')
    left, top, right, bottom = layer.vector_mask.bbox
    return {'path': ' '.join(paths), 'bounds': {'x': left * width, 'y': top * height, 'width': (right-left) * width, 'height': (bottom-top) * height}}

templates, missing = [], []
for model in mapping['models']:
    row = next((r for r in rows if r.get('Variant ID') == model['variantId'] and r['Product'] == 'Tough Phone Case'), None)
    candidates = {key(model['catalogName']), key(model['modelId'].replace('-', ' ')), key(aliases.get(model['modelId'], ''))}
    found = [g for g in groups if key(g.name) in candidates]
    if not row or len(found) != 1:
        missing.append({'modelId': model['modelId'], 'reason': 'requirements-missing' if not row else 'guide-missing-or-ambiguous'})
        continue
    group = found[0]
    if row['Design file type'] != 'Full file area' or row['Print file dimensions (width x height)'] != '2000 x 3400':
        missing.append({'modelId': model['modelId'], 'reason': 'unsupported-print-type'})
        continue
    descendants = list(group.descendants())
    safe = [l for l in descendants if l.name in ('Safe area for text and details', 'Save area for text and details', 'Save area for text and idetails') and l.has_vector_mask()]
    cameras = [l for l in descendants if not l.is_group() and l.kind != 'type' and l not in safe and l.width > 0 and l.height > 0]
    raster_safe = [l for l in descendants if l.name == 'Safe area for text and details' and l.kind == 'pixel']
    # Podbase's iPhone 17 guide combines the safe and camera outlines in one
    # raster layer. Recover its closed contours instead of rejecting it or
    # borrowing another phone's template. Other raster layouts require review.
    if model['modelId'] == 'iphone-17' and not safe and len(raster_safe) == 1 and len(cameras) == 1:
        layer = raster_safe[0]
        safe_shape, camera_shapes = extract_raster_guide(layer.topil(), layer.bbox[:2])
        safe_shape['sourceLayer'] = layer.name
    elif len(safe) == 1 and cameras:
        safe_shape, camera_shapes = shape(safe[0]), [shape(l) for l in cameras]
    else:
        missing.append({'modelId': model['modelId'], 'reason': 'missing-safe-or-camera-path'})
        continue
    record = {**model, 'productId': mapping['productId'], 'sku': row['SKU'], 'width': width, 'height': height,
              'density': 300, 'printType': 'full-file-area', 'guideGroup': group.name,
              'safeArea': safe_shape, 'cameraExclusions': camera_shapes, 'clearance': 45}
    record['hash'] = hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
    templates.append(record)

magnetic_mapping = json.loads((root / 'server/podbase-magsafe-map.json').read_text('utf-8'))
magnetic_templates, magnetic_missing = [], []
for product in magnetic_mapping['products']:
    for model in product['models']:
        template = next((t for t in templates if t['modelId'] == model['modelId']), None)
        row = next((r for r in rows if r.get('Variant ID') == model['variantId'] and r['Product'] == product['productName']), None)
        if not template or not row or row['Design file type'] != 'Full file area' or row['Print file dimensions (width x height)'] != '2000 x 3400':
            magnetic_missing.append({'modelId': model['modelId'], 'reason': 'guide-or-requirements-missing'})
            continue
        # Podbase publishes the same phone-layout guide for Tough and magnetic Tough.
        # Still require an explicit print-requirements row for this exact variant.
        record = {**template, **model, 'productId': product['productId'], 'sku': row['SKU'], 'magsafe': True}
        del record['hash']
        record['hash'] = hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
        magnetic_templates.append(record)

output = {'version': 'podbase-tough-guides-v1', 'source': {
    'guideUrl': 'https://drive.google.com/file/d/1SvuCd1eDkq2VKgky2NRi6NpEF9CZTUB2/view',
    'guideSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'requirementsUrl': 'https://docs.google.com/spreadsheets/d/1shTH2o9K3sN0RyWYUzk8tLADDNgB-qixPxnwQGvOiqM/edit?gid=969391465',
    'requirementsSha256': hashlib.sha256(requirements.read_bytes()).hexdigest()},
    'templates': templates, 'missing': missing, 'magsafeTemplates': magnetic_templates, 'magsafeMissing': magnetic_missing}
target = root / 'server/podbase-print-templates.json'
target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'templates': len(templates), 'missing': len(missing), 'magsafeTemplates': len(magnetic_templates), 'magsafeMissing': magnetic_missing}, ensure_ascii=False))
