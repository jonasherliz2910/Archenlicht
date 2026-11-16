"""Match reviewed provider evidence; never substitute a different model's guide."""


def supplemental_requirements(supplement, model, product_id, guide_group, guide_hash):
    if guide_hash != supplement['guideSha256']:
        return None
    if (supplement['width'], supplement['height'], supplement['density'], supplement['printType']) != (2000, 3400, 300, 'full-file-area'):
        return None
    product = next((p for p in supplement['products'] if p['productId'] == product_id), None)
    reviewed = next((m for m in supplement['models'] if m['modelId'] == model['modelId']), None)
    if not product or not reviewed or guide_group != reviewed['guideGroup']:
        return None
    if not any(v['productId'] == product_id and v['variantId'] == model['variantId'] for v in reviewed['variants']):
        return None
    return {
        'Variant ID': model['variantId'], 'Product': product['productName'],
        'Design file type': 'Full file area', 'Print file dimensions (width x height)': '2000 x 3400',
        # The provider API uses variantId; do not invent an absent spreadsheet SKU.
        'SKU': None,
        'requirementsEvidence': {
            'kind': 'reviewed-product-guideline-and-named-psd-guide',
            'reviewedAt': supplement['reviewedAt'], 'url': product['url'],
            'pageSha256': product['pageSha256'], 'methodUrl': supplement['methodUrl'],
            'guideGroup': guide_group, 'guideSha256': guide_hash,
        },
    }
