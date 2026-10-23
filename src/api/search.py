import requests

from searxng_wrapper import SearxngWrapper
from searxng_wrapper.types import SearchResponse

from ..config import CONFIG


class SearxNG(SearxngWrapper):
    def __init__(self):
        super().__init__(base_url=CONFIG["searxng_url"])
        self.max_results = CONFIG["max_search_results"]

    def search(self, query: str) -> list[dict]:
        r = requests.get(
            self.base_url,
            params={"q": query, "format": "json"},
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
            timeout=30,
        )
        data = r.json()
        response = SearchResponse(
            query=query,
            number_of_results=data.get("number_of_results", 0),
            results=data.get("results", [])[: self.max_results],
        )
        return [
            {"title": item.title, "url": item.url, "content": item.content or ""}
            for item in response.results
        ]
