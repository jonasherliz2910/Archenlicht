"""Recover closed raster outlines from an original Podbase guide, without guessing.

Only supports one closed outer outline and one disjoint camera outline. The
paths follow the outer pixel edges exactly; no smoothing or rescaling is used.
The normal production clearance is applied afterwards by production-print.js.
"""
import hashlib
import numpy as np
from PIL import Image, ImageDraw


def outline(mask, offset, exclusion=False):
    rows = np.flatnonzero(mask.any(axis=1))
    if not len(rows) or np.any(np.diff(rows) != 1):
        raise ValueError('Empty or disconnected raster outline')
    left, right = [], []
    for y in rows:
        xs = np.flatnonzero(mask[y])
        if not exclusion and len(xs) != xs[-1] - xs[0] + 1:
            raise ValueError('Raster outline is not row-convex')
        left.extend([(int(xs[0]), int(y)), (int(xs[0]), int(y + 1))])
        right.extend([(int(xs[-1] + 1), int(y)), (int(xs[-1] + 1), int(y + 1))])
    points = []
    for point in left + right[::-1]:
        if points and point == points[-1]:
            continue
        while len(points) >= 2:
            a, b = points[-2:]
            if (b[0] - a[0]) * (point[1] - b[1]) != (b[1] - a[1]) * (point[0] - b[0]):
                break
            points.pop()
        points.append(point)
    points = [(x + offset[0], y + offset[1]) for x, y in points]
    xs, ys = zip(*points)
    return {'path': 'M ' + ' L '.join(f'{x} {y}' for x, y in points) + ' Z',
            'bounds': {'x': min(xs), 'y': min(ys), 'width': max(xs)-min(xs), 'height': max(ys)-min(ys)}}


def extract_raster_guide(image, offset):
    alpha = np.array(image.convert('RGBA'))[:, :, 3]
    # Include every antialiased line pixel. Padding supplies an exterior seed.
    lines = np.pad(alpha > 0, 1)
    regions = Image.fromarray(np.uint8(lines) * 255).copy()
    ImageDraw.floodfill(regions, (0, 0), 64)
    center = (regions.width // 2, regions.height // 2)
    if regions.getpixel(center) != 0:
        raise ValueError('Printable center is not enclosed by a clear outline')
    ImageDraw.floodfill(regions, center, 127)
    labels = np.array(regions)
    holes = np.argwhere(labels == 0)
    if not len(holes) or not np.any(labels == 127):
        raise ValueError('Missing closed camera or safe region')
    y, x = holes[0]
    # Expand the camera interior through its own outline, stopping at the
    # printable region. This includes the whole antialiased camera border.
    camera = Image.fromarray(np.uint8((labels == 64) | (labels == 127)) * 255).copy()
    ImageDraw.floodfill(camera, (int(x), int(y)), 127)
    camera_mask = np.array(camera) == 127
    if not np.all(camera_mask[labels == 0]) or np.any(camera_mask[0]) or np.any(camera_mask[-1]):
        raise ValueError('Ambiguous, open or additional raster contours')
    outer_mask = labels != 64
    safe = outline(outer_mask[1:-1, 1:-1], offset)
    # Tiny antialias gaps can occur along the camera boundary. Its row hull
    # only enlarges the excluded area; it never enlarges the printable area.
    exclusion = outline(camera_mask[1:-1, 1:-1], offset, exclusion=True)
    # No inferred camera sizes, aliases to another model or rectangular
    # substitutes: these are the actual source pixels, recorded for auditing.
    safe['rasterSourceSha256'] = hashlib.sha256(alpha.tobytes()).hexdigest()
    safe['extraction'] = 'closed-raster-outline-v1'
    exclusion['extraction'] = 'closed-raster-outline-v1'
    return safe, [exclusion]
