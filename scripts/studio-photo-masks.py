"""Build antialiased shell/camera masks from the reviewed photographic templates.

Requires opencv-python-headless and numpy. Run prepare-studio-photos.mjs first.
STUDIO_WORK_DIR can point to a different directory containing the mask seeds.
"""
import json
import os
from pathlib import Path

import cv2
import numpy as np

root = Path(__file__).resolve().parent.parent
assets = root / 'public/assets/studio-v2'
work = Path(os.environ.get('STUDIO_WORK_DIR', root / 'test-results/studio-v2'))
sources = json.loads((root / 'docs/studio-photo-sources.json').read_text('utf-8'))

for source in sources:
    name = source['id']
    photo = cv2.imread(str(assets / f'{name}.webp'))
    seed = cv2.imread(str(work / f'{name}-body.png'), 0)
    camera = cv2.imread(str(work / f'{name}-camera.png'), 0)
    if photo is None or seed is None or camera is None:
        raise RuntimeError(f'Missing photo or mask seed: {name}')

    # White-on-white segmentation mistakes bright reflections for background.
    # Use the reviewed smooth silhouette instead, with a subpixel feather.
    body = cv2.GaussianBlur(seed, (3, 3), .55)
    printable = (body.astype('float32') * (1 - camera / 255)).astype('uint8')
    if name == 'galaxy-flip':
        printable[678:692, :] = 0

    # Output RGB channels: printable shell, empty camera opening, inner rim shadow.
    distance = cv2.distanceTransform((camera > 127).astype('uint8'), cv2.DIST_L2, 5)
    rim = (np.exp(-distance / 7) * 145 * (camera / 255)).astype('uint8')
    cv2.imwrite(str(assets / f'{name}-mask.png'), cv2.merge([rim, camera, printable]))
    print(name, flush=True)
