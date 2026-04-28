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
  sales: {},
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

function salesRecord(store) {
  return state.sales[store.id] || state.sales[store.name] || null;
}

function salesAmount(store) {
  const record = salesRecord(store);
  if (!record) return null;
  if (typeof record.monthlySales === "number") return record.monthlySales;
  if (Array.isArray(record.months) && record.months.length) {
    return record.months[record.months.length - 1].sales;
  }
  return null;
}

function availableSalesValues() {
  return state.stores
    .map((store) => salesAmount(store))
    .filter((value) => typeof value === "number" && Number.isFinite(value));
}

function salesRatio(store) {
  const value = salesAmount(store);
  const values = availableSalesValues();
  if (value === null || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

function salesGreen(store) {
  const ratio = salesRatio(store);
  if (ratio === null) return "#0f6b3d";
  const start = [181, 224, 193];
  const end = [2, 78, 39];
  const rgb = start.map((value, index) => Math.round(value + (end[index] - value) * ratio));
  return `rgb(${rgb.join(", ")})`;
}

function markerStyle(store) {
  const recent = store.newestRank <= 12;
  const first = store.name === firstStore.name;
  const ratio = salesRatio(store);
  return {
    radius: ratio === null ? (first ? 6 : recent ? 7 : 5) : 4.5 + ratio * 7,
    color: "#0b2414",
    weight: first || recent ? 2.6 : 1.4,
    fillColor: salesGreen(store),
    fillOpacity: ratio === null ? 0.86 : 0.62 + ratio * 0.38,
    opacity: 0.95,
  };
}

function tooltipLabel(store) {
  if (store.name === firstStore.name) return "석촌호수 1호점";
  const shortName = store.name.replace(/^우지커피\s*/, "");
  const sales = salesAmount(store);
  const salesText = sales === null ? "매출 데이터 미연동" : `월매출 ${sales.toLocaleString("ko-KR")}만원`;
  return `${shortName} ${store.openOrderEstimate}호점 · ${salesText}`;
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

  try {
    const salesResponse = await fetch("data/sales.json", { cache: "no-store" });
    if (salesResponse.ok) {
      state.sales = await salesResponse.json();
    }
  } catch (error) {
    state.sales = {};
  }

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
