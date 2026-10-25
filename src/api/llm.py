import json

import requests

from ..config import CONFIG, SECRETS

SYSTEM_PROMPT = """
You are a packaging materials analyst.
Given product data from Open Food Facts, optional user-provided usage context, and web search results (snippets plus extracted page text), extract what is known about the packaging and its potential microplastic / additive risks.
Use the ingredients, conservation/preparation conditions, country/region, product category, and the user's usage context (heating, reuse, dishwashing, sun exposure, contents) to judge a microplastic contamination risk.
Prefer manufacturer, regulator, and scientific sources. Do not invent facts. If something is unknown, use null.
Risk notes should be easy to understand.
Return ONLY a JSON object with this exact schema:
{
  "container_material": string|null,
  "polymer_types": [string],
  "recycling_code": string|null,
  "additives": [string],
  "usage_warnings": [string],
  "risk_notes": [string],
  "confidence": number,
  "sources": [string]
}
confidence is a number from 0.0 to 1.0 reflecting how well the packaging claims are supported by the provided sources.
Do not include markdown and commentary.
"""


class PackagingLLM:
    def __init__(self):
        self.base_url = CONFIG["llm"]["base_url"].rstrip("/")
        self.model = CONFIG["llm"]["model"]
        self.headers = {
            "Authorization": f"Bearer {SECRETS['llm_api_key']}",
            "Content-Type": "application/json",
            "User-Agent": "PlasticDetective/1.0",
            "x-opencode-session": "plastic-detective",
        }

    def parse(self, product: dict, context: list[dict], usage: dict = None) -> dict:
        print("PARSING")
        user = (
            "PRODUCT DATA:\n"
            + json.dumps(product, ensure_ascii=False)
            + "\n\nUSER USAGE CONTEXT:\n"
            + json.dumps(usage or {}, ensure_ascii=False)
            + "\n\nWEB SEARCH CONTEXT:\n"
            + json.dumps(context, ensure_ascii=False)
        )
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user},
            ],
            "temperature": 0,
        }
        r = requests.post(
            f"{self.base_url}/chat/completions",
            headers=self.headers,
            json=body,
            timeout=120,
        )
        return json.loads(r.json()["choices"][0]["message"]["content"])
