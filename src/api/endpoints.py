import requests


class FoodInformer:
    def __init__(self):
        self.headers = {"User-Agent": "PlasticDetective/1.0"}

    def get_info_by_code(
        self,
        code: str,
        fields: list = [
            "code",
            "product_name",
            "brands",
            "categories_tags",
            "packagings",
            "packaging_materials_tags",
            "packaging_shapes_tags",
            "packaging_recycling_tags",
            "packaging_text",
        ],
        truncated: bool = False,
    ):  
        # truncated means input code is 10 char long, needs to be conv to 12
        if truncated:
            code = "0" + code + "0"
        r = requests.get(
            f"https://world.openfoodfacts.org/api/v2/product/{code}.json?fields={",".join(fields)}",
            headers=self.headers,
        )
        return r.json()

    def get_info_by_text(
        self,
        query: str,
        page_size: int,
        fields: list = [
            "code",  # barcode
            "categories_tags",
            "packagings",
            "packaging_materials_tags",
            "packaging_shapes_tags",
            "packaging_recycling_tags",
            "packaging_text",
        ],
    ):
        url = "https://world.openfoodfacts.org/cgi/search.pl"
        params = {
            "search_terms": query,
            "fields": ",".join(fields),
            "page_size": page_size,
            "json": 1,  # required for v1 to return json
        }
        r = requests.get(url, params=params, headers=self.headers)
        r.raise_for_status()
        return r.json()
