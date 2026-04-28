const milestones = [
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
};

const state = {
  stores: [],
  year: 2026,
  map: null,
  layer: null,
  firstLayer: null,
  timer: null,
};

const regionColors = {
  서울: "#0f6b3d",
  경기: "#2d8f67",
  인천: "#2079a8",
  부산: "#d5533c",
  대구: "#bb6b1e",
  광주: "#7a5ab8",
  대전: "#91692e",
  울산: "#338c8a",
  세종: "#b1457b",
  강원: "#4d81cf",
  충북: "#77a22f",
  충남: "#d09a2b",
  전북: "#8f7a35",
  전남: "#2e9f91",
  경북: "#9f5f45",
  경남: "#517c2f",
  제주: "#e17a44",
  기타: "#68746a",
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
  const target = milestoneForYear(year).count;
  return state.stores.filter((store) => store.openOrderEstimate <= target);
}

function markerStyle(store) {
  const recent = store.newestRank <= 12;
  return {
    radius: recent ? 8 : 5,
    color: "#0b2414",
    weight: recent ? 2.5 : 1.4,
    fillColor: regionColors[store.region] || regionColors["기타"],
    fillOpacity: recent ? 1 : 0.9,
    opacity: 0.95,
  };
}

function popupHtml(store) {
  return `
    <span class="popup-title">${store.name}</span>
    <span class="popup-meta">
      추정 ${store.estimatedYear}년 등록 · ${store.region}<br>
      ${store.address}<br>
      ${store.phone || "전화번호 미공개"}
    </span>
  `;
}

function renderMap() {
  const visible = storesForYear(state.year);
  state.layer.clearLayers();
  visible.forEach((store) => {
    L.circleMarker([store.lat, store.lng], markerStyle(store))
      .bindPopup(popupHtml(store))
      .addTo(state.layer);
  });

  document.querySelector("#visible-count").textContent = visible.length.toLocaleString("ko-KR");
  document.querySelector("#region-count").textContent = new Set(visible.map((store) => store.region)).size;
  document.querySelector("#year-label").textContent = state.year;
  renderStoreList(visible);
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

function renderStoreList(visible) {
  const list = document.querySelector("#store-list");
  const firstArea = `
    <article class="store-item">
      <div class="rank">브랜드 1호점 · 2019.08</div>
      <strong>${firstStore.name}</strong>
      <span>${firstStore.address} · 공식 보도자료 기준</span>
    </article>
  `;
  const latest = [...state.stores]
    .sort((a, b) => a.newestRank - b.newestRank)
    .slice(0, 6)
    .map((store) => `
      <article class="store-item">
        <div class="rank">최근 등록 ${store.newestRank}위 · 추정 ${store.estimatedYear}년</div>
        <strong>${store.name}</strong>
        <span>${store.address}</span>
      </article>
    `)
    .join("");
  const selected = visible.length ? `
    <article class="store-item">
      <div class="rank">${state.year}년 누적 마지막 표시</div>
      <strong>${visible[visible.length - 1].name}</strong>
      <span>${visible[visible.length - 1].address}</span>
    </article>
  ` : "";
  list.innerHTML = firstArea + selected + latest;
}

function initControls() {
  const range = document.querySelector("#year-range");
  const play = document.querySelector("#play-button");

  range.addEventListener("input", (event) => {
    state.year = Number(event.target.value);
    renderMap();
  });

  play.addEventListener("click", () => {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
      play.textContent = "재생";
      return;
    }

    play.textContent = "정지";
    state.year = 2020;
    range.value = state.year;
    renderMap();
    state.timer = setInterval(() => {
      state.year += 1;
      if (state.year > 2026) {
        clearInterval(state.timer);
        state.timer = null;
        play.textContent = "재생";
        return;
      }
      range.value = state.year;
      renderMap();
    }, 950);
  });
}

async function init() {
  const response = await fetch("data/stores.json");
  const data = await response.json();
  state.stores = data.stores.map((store) => ({
    ...store,
    estimatedYear: estimateYear(store.openOrderEstimate),
  }));

  document.querySelector("#current-total").textContent = state.stores.length.toLocaleString("ko-KR");

  state.map = L.map("map", {
    zoomControl: false,
    scrollWheelZoom: false,
  }).setView([36.45, 127.85], 6.6);

  L.control.zoom({ position: "bottomright" }).addTo(state.map);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  }).addTo(state.map);

  state.layer = L.layerGroup().addTo(state.map);
  state.firstLayer = L.marker([firstStore.lat, firstStore.lng], {
    icon: L.divIcon({
      className: "",
      html: '<div class="first-marker">1</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    }),
  })
    .bindPopup(`
      <span class="popup-title">${firstStore.name}</span>
      <span class="popup-meta">2019년 8월 송파구에 개설된 브랜드 1호점입니다.</span>
    `)
    .addTo(state.map);

  renderTimeline();
  renderGrowth();
  initControls();
  renderMap();
}

init().catch((error) => {
  document.body.innerHTML = `<main class="app"><section class="panel">데이터를 불러오지 못했습니다: ${error.message}</section></main>`;
});
