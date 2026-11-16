import copy
import json
import sys
import unittest
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / 'scripts'))
from podbase_requirements import supplemental_requirements


class ReviewedRequirementsTests(unittest.TestCase):
    def setUp(self):
        self.evidence = json.loads((root / 'server/podbase-print-requirements-supplement.json').read_text('utf-8'))

    def test_all_six_reviewed_variants_require_their_named_original_guide(self):
        for model in self.evidence['models']:
            for variant in model['variants']:
                row = supplemental_requirements(self.evidence, {**model, **variant}, variant['productId'], model['guideGroup'], self.evidence['guideSha256'])
                self.assertEqual(row['Variant ID'], variant['variantId'])
                self.assertIsNone(row['SKU'])
                self.assertEqual(row['requirementsEvidence']['guideGroup'], model['guideGroup'])
                self.assertEqual(row['Print file dimensions (width x height)'], '2000 x 3400')

    def test_no_generic_fallback_for_unreviewed_or_mismatched_models(self):
        model = self.evidence['models'][0]
        variant = model['variants'][0]
        input_model = {**model, **variant}
        args = [self.evidence, input_model, variant['productId'], model['guideGroup'], self.evidence['guideSha256']]
        for index, value in [(1, {**input_model, 'modelId': 'iphone-17e'}), (1, {**input_model, 'variantId': 'PBV-wrong'}), (2, 'PBP-wrong'), (3, 'iPhone 17 Pro'), (4, '0' * 64)]:
            changed = args.copy()
            changed[index] = value
            self.assertIsNone(supplemental_requirements(*changed))
        for field, value in [('width', 1999), ('density', 72), ('printType', 'cut-out')]:
            evidence = copy.deepcopy(self.evidence)
            evidence[field] = value
            self.assertIsNone(supplemental_requirements(evidence, *args[1:]))


if __name__ == '__main__':
    unittest.main()
