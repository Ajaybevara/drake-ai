let session = null;
let result = null;

const statusEl = document.getElementById("status");
const sampleBtn = document.getElementById("sampleBtn");
const lasInput = document.getElementById("lasInput");
const runBtn = document.getElementById("runBtn");

sampleBtn.addEventListener("click", loadSample);
lasInput.addEventListener("change", () => uploadLas(lasInput.files[0]));
runBtn.addEventListener("click", runPrediction);

async function loadSample() {
  setStatus("Loading sample dataset...");
  const response = await fetch("/api/sample", { method: "POST" });
  session = await response.json();
  result = null;
  setStatus(summaryText(session));
  clearResult();
}

async function uploadLas(file) {
  if (!file) return;
  setStatus("Uploading LAS file...");
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/upload-las", { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok) {
    setStatus(data.error || "LAS upload failed.");
    return;
  }
  session = data;
  result = null;
  setStatus(summaryText(session));
  clearResult();
}

async function runPrediction() {
  if (!session) {
    setStatus("Load sample data or upload a LAS file first.");
    return;
  }
  setStatus("Training AI/ML model and generating prediction...");
  const response = await fetch("/api/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: session.session_id,
      target: document.getElementById("target").value,
      zone_count: Number(document.getElementById("zoneCount").value || 3)
    })
  });
  const data = await response.json();
  if (!response.ok) {
    setStatus(data.error || "Prediction failed.");
    return;
  }
  result = data;
  setStatus(summaryText(session));
  renderResult(data);
}

function summaryText(data) {
  return `${data.file_name}<br>${Number(data.rows).toLocaleString()} samples<br>${data.depth_min} - ${data.depth_max} depth<br>${data.curves.length} curves loaded`;
}

function setStatus(html) {
  statusEl.innerHTML = html;
}

function renderResult(data) {
  document.getElementById("chartSubtitle").textContent = `${data.target} prediction from ${data.file_name}`;
  const badges = document.getElementById("badges");
  const metric = data.task === "classification"
    ? `${((data.metrics.accuracy || 0) * 100).toFixed(1)}% accuracy`
    : `${Number(data.metrics.r2_score || 0).toFixed(3)} R2`;
  badges.innerHTML = [metric, data.metrics.confidence, data.measured_target ? "Measured target" : "Physics-guided target"].map(text => `<span class="badge">${text}</span>`).join("");
  drawChart(data.rows, data.task);
  renderImportance(data.feature_importance);
  renderZones(data.zone_summary, data.task);
  renderPreview(data.preview);
}

function clearResult() {
  document.getElementById("badges").innerHTML = "";
  document.getElementById("importance").innerHTML = "";
  document.getElementById("zones").innerHTML = "";
  document.getElementById("preview").innerHTML = "";
  drawChart([], "regression");
}

function drawChart(rows, task) {
  const canvas = document.getElementById("predictionChart");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const y = 24 + i * ((h - 48) / 5);
    ctx.beginPath();
    ctx.moveTo(48, y);
    ctx.lineTo(w - 18, y);
    ctx.stroke();
  }
  if (!rows || !rows.length) {
    ctx.fillStyle = "#64748b";
    ctx.font = "15px Segoe UI";
    ctx.fillText("No prediction data yet", 48, 64);
    return;
  }
  const step = Math.max(1, Math.floor(rows.length / 800));
  const sampled = rows.filter((_, index) => index % step === 0);
  const depthMin = Math.min(...sampled.map(row => row.DEPTH));
  const depthMax = Math.max(...sampled.map(row => row.DEPTH));
  if (task === "classification") {
    const labels = [...new Set(sampled.map(row => row.PREDICTION))];
    sampled.forEach(row => {
      const x = scale(row.DEPTH, depthMin, depthMax, 48, w - 18);
      const y = 38 + labels.indexOf(row.PREDICTION) * 36;
      ctx.fillStyle = "#da2626";
      ctx.fillRect(x, y, 3, 24);
    });
    ctx.fillStyle = "#334155";
    ctx.font = "13px Segoe UI";
    labels.forEach((label, index) => ctx.fillText(label, 54, 54 + index * 36));
    return;
  }
  const vals = sampled.map(row => Number(row.PREDICTION)).filter(Number.isFinite);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  drawLine(ctx, sampled, "PREDICTION", depthMin, depthMax, min, max, "#da2626", w, h);
  drawLine(ctx, sampled, "MEASURED", depthMin, depthMax, min, max, "#2563eb", w, h);
  drawLine(ctx, sampled, "P10", depthMin, depthMax, min, max, "#f59e0b", w, h);
  drawLine(ctx, sampled, "P90", depthMin, depthMax, min, max, "#10b981", w, h);
}

function drawLine(ctx, rows, key, depthMin, depthMax, valueMin, valueMax, color, w, h) {
  const valid = rows.filter(row => Number.isFinite(Number(row[key])));
  if (!valid.length) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = key === "PREDICTION" ? 2.4 : 1.5;
  ctx.beginPath();
  valid.forEach((row, index) => {
    const x = scale(row.DEPTH, depthMin, depthMax, 48, w - 18);
    const y = scale(Number(row[key]), valueMin, valueMax, h - 24, 24);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function scale(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return (outMin + outMax) / 2;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function renderImportance(items) {
  const max = Math.max(...items.map(item => item.importance), 0.001);
  document.getElementById("importance").innerHTML = items.map(item => `
    <div class="bar-row">
      <div>${item.feature}</div>
      <div class="bar-bg"><div class="bar-fill" style="width:${(item.importance / max) * 100}%"></div></div>
      <div>${item.importance.toFixed(3)}</div>
    </div>
  `).join("");
}

function renderZones(items, task) {
  document.getElementById("zones").innerHTML = items.map(zone => `
    <tr>
      <td>${zone.zone}</td>
      <td>${zone.depth_from}</td>
      <td>${zone.depth_to}</td>
      <td>${zone.samples}</td>
      <td>${task === "classification" ? zone.dominant_prediction : numberText(zone.mean_prediction)}</td>
      <td>${zone.avg_confidence}%</td>
    </tr>
  `).join("");
}

function renderPreview(items) {
  document.getElementById("preview").innerHTML = items.slice(0, 120).map(row => `
    <tr>
      <td>${row.DEPTH}</td>
      <td>${row.ZONE_ID}</td>
      <td>${numberText(row.PREDICTION)}</td>
      <td>${numberText(row.MEASURED)}</td>
      <td>${numberText(row.P10)}</td>
      <td>${numberText(row.P90)}</td>
      <td>${row.CONFIDENCE}%</td>
    </tr>
  `).join("");
}

function numberText(value) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return Math.abs(value) >= 100 ? value.toFixed(2) : value.toFixed(5);
  return value;
}
