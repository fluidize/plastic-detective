import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent)) #main.py to src to project folder

from rich import print

from src.api.endpoints import FoodInformer
from src.api.llm import PackagingLLM
from src.api.search import SearxNG

food = FoodInformer()
search = SearxNG()
llm = PackagingLLM()


def analyze(code):
    off_info = food.get_info_by_code(code)
    product = off_info["product"]

    name = (product.get("product_name") or "").strip()
    brand = (product.get("brands") or "").strip()
    packaging_text = (product.get("packaging_text") or "").strip()
    base = " ".join(f'"{value}"' for value in (brand, name) if value).strip()

    queries = []
    if base:
        queries.append(f"{base} packaging material")
        queries.append(f"{base} packaging recycling code")
        queries.append(f"{base} packaging microplastics")

    for tag in product.get("packaging_materials_tags") or []:
        material = tag.split(":", 1)[-1].replace("-", " ")
        queries.append(f"{base} {material} packaging".strip())

    if packaging_text:
        queries.append(f"{packaging_text} packaging material polymer")

    print(queries)

    print("SEARCHING")
    results_by_url = {}
    for query in queries:
        for item in search.search(query):
            results_by_url[item["url"]] = item

    context = list(results_by_url.values()) + [off_info]
    print(context)

    return llm.parse(product, context)


if __name__ == "__main__":
    print(analyze("096619756803"))
