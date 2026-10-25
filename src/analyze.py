import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent)) #main.py to src to project folder

from rich import print

from src.api.endpoints import OpenFoodFacts
from src.api.llm import PackagingLLM
from src.api.search import SearxNG

food = OpenFoodFacts()
search = SearxNG()
llm = PackagingLLM()


USAGE_FLAGS = ("microwaved", "reused", "dishwashed", "sun_exposed")


def build_usage(data):
    usage = {}
    contents = (data.get("contents") or "").strip()
    if contents:
        usage["contents"] = contents
    for flag in USAGE_FLAGS:
        if data.get(flag):
            usage[flag] = True
    notes = (data.get("notes") or "").strip()
    if notes:
        usage["notes"] = notes
    return usage


def build_queries(product, code):
    name = (product.get("product_name") or "").strip()
    brand = (product.get("brands") or "").strip()
    packaging_text = (product.get("packaging_text") or "").strip()
    base = " ".join(f'"{value}"' for value in (brand, name) if value).strip()

    queries = [f'"{code}" packaging']

    if base:
        queries += [
            f"{base} packaging material",
            f"{base} packaging recycling code",
            f"{base} packaging microplastics leaching",
            f"{base} material safety data sheet packaging",
            f"{base} microwave safe BPA phthalates",
        ]

    for tag in product.get("packaging_materials_tags") or []:
        material = tag.split(":", 1)[-1].replace("-", " ")
        queries.append(f"{base} {material} packaging".strip())

    if packaging_text:
        queries.append(f"{packaging_text} packaging material polymer")

    categories = product.get("categories_tags") or []
    if categories:
        category = categories[-1].split(":", 1)[-1].replace("-", " ")
        queries.append(f"{category} packaging microplastic study")

    return list(dict.fromkeys(query for query in queries if query.strip()))


def analyze(code, usage_data=None):
    off_info = food.get_info_by_code(code)
    product = off_info["product"]
    usage = build_usage(usage_data or {})

    queries = build_queries(product, code)
    print(queries)

    print("SEARCHING")
    results_by_url = {}
    for query in queries:
        for item in search.search(query):
            results_by_url[item["url"]] = item

    context = list(results_by_url.values())
    for item in context[:3]:
        item["text"] = search.fetch_text(item["url"])

    result = llm.parse(product, context, usage)
    result["product_name"] = product.get("product_name") or product.get("brands") or code
    result["barcode"] = code
    return result


if __name__ == "__main__":
    print(analyze("096619756803"))
