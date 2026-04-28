const milestones = [
  { year: 2019, count: 1, label: "석촌호수1호점", source: "공식 보도자료" },
  { year: 2020, count: 1, label: "가맹본부 설립", source: "공식 보도자료" },
  { year: 2021, count: 4, label: "가맹점 4개", source: "정보공개서" },
  { year: 2022, count: 18, label: "가맹점 18개", source: "정보공개서" },
  { year: 2023, count: 50, label: "약 50매장", source: "공식 보도자료" },
  { year: 2024, count: 100, label: "100호점 돌파", source: "공식 보도자료" },
  { year: 2025, count: 300, label: "300호점 돌파", source: "공식 보도자료" },
  { year: 2026, count: 447, label: "공식 목록 447개", source: "매장찾기" },
];

const firstStore = {
  name: "석촌호수1호점",
  address: "서울 송파구 석촌호수 권역",
  lat: 37.5076,
  lng: 127.1025,
  year: 2019,
  openOrderEstimate: 1,
  region: "서울",
};

const state = {
  stores: [],
  year: 2026,
  maps: {},
  layers: {},
  timer: null,
};

function milestoneForYear(year) {
  return milestones.find((item) => item.year === Number(year));
}

function estimateYear(order) {
  for (const item of milestones) {
    if (order <= item.count) return item.year;
  }
  return 2026;
}

function storesForYear(year) {
  if (Number(year) <= 2020) return [firstStore];
  const target = milestoneForYear(year).count;
  return state.stores.filter((store) => store.openOrderEstimate <= target);
}

function regionScore(store) {
  const scores = {
    서울: 1,
    경기: 0.92,
    인천: 0.86,
    부산: 0.82,
    세종: 0.78,
    대전: 0.76,
    대구: 0.74,
    광주: 0.72,
    울산: 0.7,
    충남: 0.66,
    충북: 0.64,
    경남: 0.63,
    경북: 0.6,
    전북: 0.58,
    전남: 0.56,
    강원: 0.55,
    제주: 0.54,
  };
  return scores[store.region] || 0.58;
}

function locationScore(store) {
  const text = `${store.name} ${store.address}`;
  const keywords = [
    "역", "대학", "대학교", "병원", "시장", "터미널", "공원", "로데오",
    "센트럴", "시티", "타워", "몰", "스퀘어", "캠퍼스", "오피스", "비즈",
  ];
  const hits = keywords.filter((keyword) => text.includes(keyword)).length;
  return Math.min(1, 0.48 + hits * 0.085);
}

function maturityScore(store) {
  if (store.name === firstStore.name) return 0.86;
  const years = Math.max(0, 2026 - store.estimatedYear);
  return Math.min(1, 0.55 + years * 0.08);
}

function baseEstimatedSales(store) {
  const score = 0.45 * regionScore(store) + 0.35 * locationScore(store) + 0.2 * maturityScore(store);
  const monthlySales = Math.round((1500 + score * 3300) * 0.75);
  return {
    score: Math.round(score * 100),
    monthlySales,
    ratio: Math.max(0, Math.min(1, score)),
  };
}

function estimatedSales(store) {
  const estimate = baseEstimatedSales(store);
  if (store.name === "우지커피 광교상현역점") {
    const sujiStore = state.stores.find((item) => item.name === "우지커피 수지상현점");
    const sujiEstimate = sujiStore ? baseEstimatedSales(sujiStore) : estimate;
    return {
      score: Math.round(sujiEstimate.score * 0.9),
      monthlySales: Math.round(sujiEstimate.monthlySales * 0.9),
      ratio: Math.max(0, Math.min(1, sujiEstimate.ratio * 0.9)),
    };
  }
  return estimate;
}

function salesGreen(store) {
  const ratio = estimatedSales(store).ratio;
  const start = [181, 224, 193];
  const end = [2, 78, 39];
  const rgb = start.map((value, index) => Math.round(value + (end[index] - value) * ratio));
  return `rgb(${rgb.join(", ")})`;
}

function markerStyle(store) {
  const recent = store.newestRank <= 12;
  const first = store.name === firstStore.name;
  const ratio = estimatedSales(store).ratio;
  return {
    radius: (first ? 5.5 : 4.5) + ratio * 7 + (recent ? 0.7 : 0),
    color: "#0b2414",
    weight: first || recent ? 2.6 : 1.4,
    fillColor: salesGreen(store),
    fillOpacity: 0.62 + ratio * 0.38,
    opacity: 0.95,
  };
}

function tooltipLabel(store) {
  const estimate = estimatedSales(store);
  if (store.name === firstStore.name) {
    return `석촌호수 1호점 · 추정 월매출 ${estimate.monthlySales.toLocaleString("ko-KR")}만원`;
  }
  const shortName = store.name.replace(/^우지커피\s*/, "");
  return `${shortName} ${store.openOrderEstimate}호점 · 추정 월매출 ${estimate.monthlySales.toLocaleString("ko-KR")}만원 · 점수 ${estimate.score}`;
}

function addMarker(layer, store) {
  const marker = L.circleMarker([store.lat, store.lng], markerStyle(store))
    .bindTooltip(tooltipLabel(store), {
      className: "store-tooltip",
      direction: "top",
      opacity: 1,
      sticky: true,
    })
    .addTo(layer);

  marker.on("mouseover", () => {
    marker.setStyle({
      radius: (markerStyle(store).radius || 5) + 3,
      fillOpacity: 1,
      weight: 3,
    });
    marker.bringToFront();
  });
  marker.on("mouseout", () => {
    marker.setStyle(markerStyle(store));
  });
}

function renderMapLayer(key, stores) {
  state.layers[key].clearLayers();
  stores.forEach((store) => addMarker(state.layers[key], store));
}

function renderMaps() {
  const allVisible = storesForYear(state.year);
  const gyeonggiVisible = allVisible.filter((store) => store.region === "경기");

  renderMapLayer("all", allVisible);
  renderMapLayer("gyeonggi", gyeonggiVisible);

  document.querySelector("#visible-count").textContent = allVisible.length.toLocaleString("ko-KR");
  document.querySelector("#current-total").textContent = state.stores.length.toLocaleString("ko-KR");
  document.querySelector("#current-total-label").textContent = "현재 공식 목록";
  document.querySelector("#region-count").textContent = new Set(allVisible.map((store) => store.region)).size;
  document.querySelector("#all-visible-count").textContent = allVisible.length.toLocaleString("ko-KR");
  document.querySelector("#gyeonggi-visible-count").textContent = gyeonggiVisible.length.toLocaleString("ko-KR");
  document.querySelector("#year-label").textContent = state.year;
  renderStoreList(allVisible, gyeonggiVisible);
}

function renderTimeline() {
  const timeline = document.querySelector("#timeline");
  timeline.innerHTML = milestones.map((item) => `<span>${item.year}<br>${item.count}</span>`).join("");
}

function renderGrowth() {
  const chart = document.querySelector("#growth-chart");
  const maxIncrease = Math.max(...milestones.map((item, index) => {
    const previous = index === 0 ? 0 : milestones[index - 1].count;
    return item.count - previous;
  }));

  chart.innerHTML = milestones.map((item, index) => {
    const previous = index === 0 ? 0 : milestones[index - 1].count;
    const increase = item.count - previous;
    const width = Math.max(4, Math.round((increase / maxIncrease) * 100));
    return `
      <div class="bar-row" title="${item.source}: ${item.label}">
        <strong>${item.year}</strong>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
        <span>+${increase}</span>
      </div>
    `;
  }).join("");
}

function renderStoreList(allVisible, gyeonggiVisible) {
  const list = document.querySelector("#store-list");
  const firstArea = `
    <article class="store-item">
      <div class="rank">브랜드 1호점 · 2019.08</div>
      <strong>${firstStore.name}</strong>
      <span>${firstStore.address} · 공식 보도자료 기준</span>
    </article>
  `;
  const current = allVisible.length ? `
    <article class="store-item">
      <div class="rank">${state.year}년 전국 누적 마지막 표시</div>
      <strong>${allVisible[allVisible.length - 1].name}</strong>
      <span>${allVisible[allVisible.length - 1].address}</span>
    </article>
  ` : "";
  const gyeonggi = gyeonggiVisible.length ? `
    <article class="store-item">
      <div class="rank">${state.year}년 경기도 누적 마지막 표시</div>
      <strong>${gyeonggiVisible[gyeonggiVisible.length - 1].name}</strong>
      <span>${gyeonggiVisible[gyeonggiVisible.length - 1].address}</span>
    </article>
  ` : "";
  const latest = [...state.stores]
    .sort((a, b) => a.newestRank - b.newestRank)
    .slice(0, 5)
    .map((store) => `
      <article class="store-item">
        <div class="rank">최근 등록 ${store.newestRank}위 · 추정 ${store.estimatedYear}년</div>
        <strong>${store.name}</strong>
        <span>${store.address}</span>
      </article>
    `)
    .join("");
  list.innerHTML = firstArea + current + gyeonggi + latest;
}

function initControls() {
  const range = document.querySelector("#year-range");
  const play = document.querySelector("#play-button");

  range.addEventListener("input", (event) => {
    state.year = Number(event.target.value);
    renderMaps();
  });

  play.addEventListener("click", () => {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
      play.textContent = "재생";
      return;
    }

    play.textContent = "정지";
    state.year = 2019;
    range.value = state.year;
    renderMaps();
    state.timer = setInterval(() => {
      state.year += 1;
      if (state.year > 2026) {
        clearInterval(state.timer);
        state.timer = null;
        play.textContent = "재생";
        return;
      }
      range.value = state.year;
      renderMaps();
    }, 950);
  });
}

function createMap(id, center, zoom) {
  const map = L.map(id, {
    zoomControl: false,
    scrollWheelZoom: false,
  }).setView(center, zoom);

  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  }).addTo(map);
  return map;
}

async function init() {
  const response = await fetch("data/stores.json");
  const data = await response.json();
  state.stores = data.stores.map((store) => ({
    ...store,
    estimatedYear: estimateYear(store.openOrderEstimate),
  }));

  state.maps.all = createMap("map-all", [36.45, 127.85], 6.6);
  state.maps.gyeonggi = createMap("map-gyeonggi", [37.45, 127.18], 8.45);
  state.layers.all = L.layerGroup().addTo(state.maps.all);
  state.layers.gyeonggi = L.layerGroup().addTo(state.maps.gyeonggi);

  renderTimeline();
  renderGrowth();
  initControls();
  renderMaps();
}

init().catch((error) => {
  document.body.innerHTML = `<main class="app"><section class="panel">데이터를 불러오지 못했습니다: ${error.message}</section></main>`;
});
