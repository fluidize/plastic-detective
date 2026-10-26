const statusEl = document.getElementById("status");
const analysisEl = document.getElementById("analysis");
const barcodeInput = document.getElementById("barcode");
const litterList = document.getElementById("litter-list");
const litterForm = document.getElementById("litter-form");
const submitBtn = litterForm.querySelector("button[type=submit]");
const cancelBtn = document.getElementById("cancel-edit");
const navItems = document.querySelectorAll(".nav-item");
const settingsForm = document.getElementById("settings-form");
const settingsStatus = document.getElementById("settings-status");
let settingsConfig = {};
let editIndex = null;
let appConfig = {};

fetch("/api/config")
  .then((res) => res.json())
  .then((config) => {
    appConfig = config;
  });

function codeSpan(text) {
  const code = document.createElement("code");
  code.textContent = text;
  return code;
}

let map = null;
let mapMarkers = [];
let mapPromise = null;

function initMap() {
  map = L.map("map").setView([39.5, -98.35], 3);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  return map;
}

function ensureMap() {
  if (!mapPromise) mapPromise = Promise.resolve(initMap());
  return mapPromise;
}

let litterMap = null;
let litterMarker = null;

function initLitterMap() {
  if (litterMap) return litterMap;

  litterMap = L.map("litter-map").setView([39.5, -98.35], 3);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(litterMap);

  litterMap.on("click", (event) => {
    const { lat, lng } = event.latlng;
    litterForm.elements["latitude"].value = lat.toFixed(6);
    litterForm.elements["longitude"].value = lng.toFixed(6);
    if (litterMarker) {
      litterMarker.setLatLng(event.latlng);
    } else {
      litterMarker = L.marker(event.latlng).addTo(litterMap);
    }
  });

  return litterMap;
}

function showView(name) {
  document.querySelectorAll(".view").forEach((view) => {
    view.hidden = view.id !== `view-${name}`;
  });
  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.view === name);
  });
  if (name === "recycling") {
    ensureMap().then(() => map.invalidateSize());
  }
  if (name === "litter") {
    initLitterMap();
    litterMap.invalidateSize();
  }
  if (name === "settings") {
    loadSettings();
  }
}

async function loadSettings() {
  settingsConfig = await (await fetch("/api/config")).json();
  const llm = settingsConfig.llm || {};
  settingsForm.elements["searxng_url"].value = settingsConfig.searxng_url || "";
  settingsForm.elements["max_search_results"].value =
    settingsConfig.max_search_results ?? "";
  settingsForm.elements["llm_model"].value = llm.model || "";
  settingsStatus.textContent = "";
}

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    ...settingsConfig,
    searxng_url: settingsForm.elements["searxng_url"].value.trim(),
    max_search_results: Number(settingsForm.elements["max_search_results"].value),
    llm: {
      ...(settingsConfig.llm || {}),
      model: settingsForm.elements["llm_model"].value.trim(),
    },
  };

  const res = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const saved = await res.json();
  if (res.ok) {
    settingsConfig = saved;
    settingsStatus.textContent = "Saved. Some changes may need a restart.";
  } else {
    settingsStatus.textContent = saved.error || "Save failed.";
  }
});

navItems.forEach((item) => {
  item.addEventListener("click", () => showView(item.dataset.view));
});

function validBarcode() {
  return /^\d{12}$/.test(barcodeInput.value);
}

barcodeInput.addEventListener("input", () => {
  barcodeInput.value = barcodeInput.value.replace(/\D/g, "").slice(0, 12);
  barcodeInput.classList.toggle(
    "invalid",
    barcodeInput.value.length > 0 && !validBarcode()
  );
});

function makeField(label, content, info) {
  const div = document.createElement("div");
  div.className = "field";
  const heading = document.createElement("h3");
  heading.textContent = label;
  if (info) {
    const icon = document.createElement("span");
    icon.className = "info-icon";
    icon.tabIndex = 0;
    icon.textContent = "i";
    icon.setAttribute("aria-label", info);
    const tooltip = document.createElement("span");
    tooltip.className = "tooltip";
    tooltip.textContent = info;
    icon.appendChild(tooltip);
    heading.appendChild(icon);
  }
  div.append(heading, content);
  return div;
}

function tagList(items) {
  const wrap = document.createElement("div");
  wrap.className = "tags";
  for (const item of items) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = item;
    wrap.appendChild(tag);
  }
  return wrap;
}

function bulletList(items, className = "bullets") {
  const list = document.createElement("ul");
  list.className = className;
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  }
  return list;
}

function renderAnalysis(result) {
  analysisEl.innerHTML = "";
  if (!result || typeof result !== "object") {
    analysisEl.textContent = "No analysis available.";
    analysisEl.hidden = false;
    return;
  }

  const head = document.createElement("div");
  head.className = "analysis-head";

  const material = document.createElement("h2");
  material.className = "material";
  material.textContent =
    result.product_name ||
    (result.barcode ? `Barcode ${result.barcode}` : "Unknown product");
  head.appendChild(material);

  if (result.recycling_code != null) {
    const code = document.createElement("span");
    code.className = "recycle-code";
    code.textContent = `♻ ${result.recycling_code}`;
    head.appendChild(code);
  }
  analysisEl.appendChild(head);

  if (result.container_material) {
    const value = document.createElement("p");
    value.className = "value";
    value.textContent = result.container_material;
    analysisEl.appendChild(makeField("Packaging material", value));
  }

  if (result.polymer_types?.length) {
    analysisEl.appendChild(makeField("Polymers", tagList(result.polymer_types)));
  }
  if (result.additives?.length) {
    analysisEl.appendChild(makeField("Additives", tagList(result.additives)));
  }
  if (result.usage_warnings?.length) {
    analysisEl.appendChild(
      makeField("Usage warnings", bulletList(result.usage_warnings))
    );
  }
  if (result.risk_notes?.length) {
    analysisEl.appendChild(makeField("Risk notes", bulletList(result.risk_notes)));
  }

  if (result.confidence != null) {
    const pct = Math.round(Number(result.confidence) * 100);
    const wrap = document.createElement("div");
    wrap.className = "confidence";

    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    fill.className = "fill";
    fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    bar.appendChild(fill);

    const model = appConfig?.llm?.model || "model";
    const label = document.createElement("span");
    label.append(
      codeSpan(model),
      document.createTextNode(` is ${pct}% confident in this information`)
    );
    wrap.append(label, bar);
    analysisEl.appendChild(
      makeField(
        "Confidence",
        wrap,
        "A value generated by the model's reporting its certainty (0-100%) that the packaging details are correct, based on how well the Open Food Facts data and web sources support them. It is not a risk score."
      )
    );
  }

  if (result.sources?.length) {
    const list = document.createElement("ul");
    list.className = "bullets sources";
    for (const url of result.sources) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = url;
      link.textContent = url;
      link.target = "_blank";
      link.rel = "noopener";
      li.appendChild(link);
      list.appendChild(li);
    }
    analysisEl.appendChild(makeField("Sources", list));
  }

  analysisEl.hidden = false;
}

function renderItem(item, index) {
  const li = document.createElement("li");
  const text = document.createElement("span");
  const where =
    item.latitude && item.longitude
      ? ` @ ${Number(item.latitude).toFixed(4)}, ${Number(item.longitude).toFixed(4)}`
      : "";
  text.textContent = `${item.type || "unknown"}${where}`;

  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "Edit";
  edit.addEventListener("click", () => startEdit(item, index));

  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "Delete";
  del.addEventListener("click", async () => {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/litter/${index}`, { method: "DELETE" });
    resetForm();
showView("scan");
loadLitter();
  });

  li.append(text, edit, del);
  return li;
}

async function loadLitter() {
  const items = await (await fetch("/api/litter")).json();
  litterList.innerHTML = "";
  items
    .map((item, index) => ({ item, index }))
    .reverse()
    .forEach(({ item, index }) => litterList.appendChild(renderItem(item, index)));
}

function startEdit(item, index) {
  editIndex = index;
  litterForm.elements["type"].value = item.type;
  litterForm.elements["longitude"].value = item.longitude;
  litterForm.elements["latitude"].value = item.latitude;
  submitBtn.textContent = "Update";
  cancelBtn.hidden = false;

  if (litterMap && item.latitude && item.longitude) {
    const lat = Number(item.latitude);
    const lng = Number(item.longitude);
    litterMap.setView([lat, lng], 14);
    if (litterMarker) {
      litterMarker.setLatLng([lat, lng]);
    } else {
      litterMarker = L.marker([lat, lng]).addTo(litterMap);
    }
  }
}

function resetForm() {
  editIndex = null;
  litterForm.reset();
  submitBtn.textContent = "Add";
  cancelBtn.hidden = true;
}

cancelBtn.addEventListener("click", resetForm);

litterForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const record = Object.fromEntries(new FormData(litterForm));
  const url = editIndex === null ? "/api/litter" : `/api/litter/${editIndex}`;
  await fetch(url, {
    method: editIndex === null ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  resetForm();
  loadLitter();
});

document.getElementById("scan-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validBarcode()) {
    barcodeInput.classList.add("invalid");
    statusEl.textContent = "Barcode must be exactly 12 digits.";
    return;
  }
  barcodeInput.classList.remove("invalid");
  analysisEl.hidden = true;
  statusEl.textContent = "Starting scan...";
  statusEl.classList.add("loading");

  const res = await fetch("/api/scan", {
    method: "POST",
    body: new FormData(e.target)
  });
  const { job_id } = await res.json();

  const timer = setInterval(async () => {
    const job = await (await fetch(`/api/scan/${job_id}`)).json();
    if (job.status === "pending") {
      statusEl.textContent = "Analyzing: Open Food Facts + web search → LLM...";
      return;
    }
    clearInterval(timer);
    statusEl.classList.remove("loading");
    if (job.status === "done") {
      statusEl.textContent = "";
      renderAnalysis(job.result);
    } else {
      statusEl.textContent = "Error: " + (job.error || job.status);
    }
  }, 1000);
});

document.getElementById("recycle-btn").addEventListener("click", () => {
  const status = document.getElementById("recycling-status");
  const list = document.getElementById("recycling-list");
  list.hidden = true;
  if (!navigator.geolocation) {
    status.textContent = "Geolocation not supported.";
    return;
  }
  status.textContent = "Getting your location...";
  status.classList.add("loading");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      await ensureMap().catch(() => {});
      status.textContent = "Searching recycling points...";
      const data = await (
        await fetch(`/api/recycling?lat=${latitude}&lon=${longitude}`)
      ).json();
      const features = data.features || [];

      list.innerHTML = "";
      for (const feature of features) {
        const p = feature.properties;
        const li = document.createElement("li");

        const info = document.createElement("div");
        info.className = "place-info";
        const name = document.createElement("span");
        name.className = "place-name";
        name.textContent = p.formatted || "Recycling point";
        const distance = document.createElement("span");
        distance.className = "place-dist";
        distance.textContent =
          p.distance != null ? `${(p.distance / 1000).toFixed(1)} km` : "";
        info.append(name, distance);

        const link = document.createElement("a");
        link.className = "place-link";
        link.href = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Google Maps";

        li.append(info, link);
        list.appendChild(li);
      }

      if (map) {
        mapMarkers.forEach((marker) => map.removeLayer(marker));
        mapMarkers = features.map((feature) => {
          const p = feature.properties;
          return L.marker([p.lat, p.lon])
            .addTo(map)
            .bindPopup(p.formatted || "Recycling point");
        });

        const bounds = L.latLngBounds([[latitude, longitude]]);
        mapMarkers.forEach((marker) => bounds.extend(marker.getLatLng()));
        if (features.length) {
          map.fitBounds(bounds, { padding: [30, 30] });
        } else {
          map.setView([latitude, longitude], 12);
        }
      }

      status.classList.remove("loading");
      status.textContent = features.length
        ? `${features.length} recycling points near you`
        : "No recycling points found.";
      list.hidden = features.length === 0;
    },
    () => {
      status.classList.remove("loading");
      status.textContent = "Location permission denied.";
    }
  );
});

const tutorialModal = document.getElementById("tutorial-modal");

function showTutorial() {
  tutorialModal.hidden = false;
}

function hideTutorial() {
  tutorialModal.hidden = true;
}

document.getElementById("tutorial-close").addEventListener("click", hideTutorial);
document.getElementById("tutorial-dismiss").addEventListener("click", hideTutorial);
document.getElementById("tutorial-btn").addEventListener("click", showTutorial);

tutorialModal.addEventListener("click", (event) => {
  if (event.target === tutorialModal) hideTutorial();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !tutorialModal.hidden) hideTutorial();
});

showTutorial();

loadLitter();
