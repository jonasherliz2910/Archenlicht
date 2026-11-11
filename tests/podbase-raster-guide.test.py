"""Run with Pillow/numpy installed (the same offline dependencies as the importer)."""
import sys
import unittest
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from podbase_raster_guide import extract_raster_guide


class RasterGuideTests(unittest.TestCase):
    def guide(self, camera=True):
        image = Image.new('RGBA', (200, 300))
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((5, 5, 194, 294), radius=20, outline='black', width=3)
        if camera:
            draw.rounded_rectangle((20, 20, 60, 90), radius=15, outline='black', width=3)
        return image

    def test_preserves_pixel_coordinates_and_camera_outline(self):
        safe, cameras = extract_raster_guide(self.guide(), (340, 324))
        self.assertEqual(safe['bounds'], {'x': 345, 'y': 329, 'width': 190, 'height': 290})
        self.assertEqual(cameras[0]['bounds'], {'x': 360, 'y': 344, 'width': 41, 'height': 71})
        self.assertEqual(safe['extraction'], 'closed-raster-outline-v1')
        self.assertEqual(len(safe['rasterSourceSha256']), 64)

    def test_rejects_missing_camera_and_open_contours(self):
        with self.assertRaises(ValueError):
            extract_raster_guide(self.guide(camera=False), (0, 0))
        image = self.guide()
        ImageDraw.Draw(image).rectangle((90, 0, 110, 10), fill=(0, 0, 0, 0))
        with self.assertRaises(ValueError):
            extract_raster_guide(image, (0, 0))

    def test_rejects_extra_unreviewed_hole(self):
        image = self.guide()
        ImageDraw.Draw(image).ellipse((120, 20, 150, 50), outline='black', width=3)
        with self.assertRaises(ValueError):
            extract_raster_guide(image, (0, 0))


if __name__ == '__main__':
    unittest.main()
