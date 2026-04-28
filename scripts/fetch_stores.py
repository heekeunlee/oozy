#!/usr/bin/env python3
import html
import json
import re
import time
import urllib.request
from pathlib import Path


BASE = "https://oozycoffee.com/47/?sort=TIME&keyword_type=all&page={page}"
OUT = Path("data/stores.json")


def fetch(page):
    req = urllib.request.Request(
        BASE.format(page=page),
        headers={"User-Agent": "Mozilla/5.0 oozy-map-data/1.0"},
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        return res.read().decode("utf-8", "replace")


def clean(value):
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def parse_page(markup):
    stores = []
    blocks = re.findall(
        r'<div class="map_container clearfix map-inner\s+_map_container" id="list_(\d+)".*?</div>\s*</div>\s*</div>',
        markup,
        flags=re.S,
    )
    for store_id in blocks:
        start = markup.find(f'id="list_{store_id}"')
        end = markup.find('<div class="map_container clearfix map-inner', start + 1)
        if end == -1:
            end = markup.find('<nav class="paging-block', start)
        block = markup[start:end]
        name = re.search(r'<div class="tit">(.+?)</div>', block, flags=re.S)
        address = re.search(r'<p class="adress">(.+?)</p>', block, flags=re.S)
        phone = re.search(r'href="tel:([^"]*)"', block)
        lng = re.search(r'class="_pos_x_temp" value="([^"]*)"', block)
        lat = re.search(r'class="_pos_y_temp" value="([^"]*)"', block)
        if not (name and address and lng and lat):
            continue
        stores.append(
            {
                "id": store_id,
                "name": clean(name.group(1)),
                "address": clean(address.group(1)),
                "phone": clean(phone.group(1)) if phone else "",
                "lng": float(lng.group(1)),
                "lat": float(lat.group(1)),
            }
        )
    return stores


def region_from_address(address):
    if address.startswith("서울"):
        return "서울"
    if address.startswith("경기"):
        return "경기"
    if address.startswith("인천"):
        return "인천"
    if address.startswith("부산"):
        return "부산"
    if address.startswith("대구"):
        return "대구"
    if address.startswith("광주"):
        return "광주"
    if address.startswith("대전"):
        return "대전"
    if address.startswith("울산"):
        return "울산"
    if address.startswith("세종"):
        return "세종"
    if address.startswith("강원"):
        return "강원"
    if address.startswith("충북") or address.startswith("충청북도"):
        return "충북"
    if address.startswith("충남") or address.startswith("충청남도"):
        return "충남"
    if address.startswith("전북") or address.startswith("전라북도"):
        return "전북"
    if address.startswith("전남") or address.startswith("전라남도"):
        return "전남"
    if address.startswith("경북") or address.startswith("경상북도"):
        return "경북"
    if address.startswith("경남") or address.startswith("경상남도"):
        return "경남"
    if address.startswith("제주"):
        return "제주"
    return "기타"


def main():
    seen = set()
    stores = []
    for page in range(1, 80):
        page_stores = parse_page(fetch(page))
        fresh = [store for store in page_stores if store["id"] not in seen]
        if not fresh:
            break
        for store in fresh:
            seen.add(store["id"])
            stores.append(store)
        time.sleep(0.15)

    total = len(stores)
    for newest_rank, store in enumerate(stores, start=1):
        store["newestRank"] = newest_rank
        store["openOrderEstimate"] = total - newest_rank + 1
        store["region"] = region_from_address(store["address"])

    stores.sort(key=lambda item: item["openOrderEstimate"])
    payload = {
        "generatedAt": time.strftime("%Y-%m-%d"),
        "source": "https://oozycoffee.com/47",
        "sortNote": "공식 매장찾기 페이지의 등록순 최신 정렬을 역순으로 변환한 추정 오픈 순서입니다.",
        "stores": stores,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(stores)} stores to {OUT}")


if __name__ == "__main__":
    main()
