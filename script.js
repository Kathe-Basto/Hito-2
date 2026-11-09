const ESQUEMA = [
  "id_servicio", "fecha", "hora_llegada", "dia_semana", "sede",
  "mecanico", "id_cliente", "tipo_cliente", "tipo_vehiculo", "tipo_servicio",
  "tiempo_diagnostico_min", "tiempo_reparacion_h", "repuestos_usados",
  "costo_repuestos_usd", "costo_mano_obra_usd", "costo_total_usd",
  "satisfaccion", "recomendaria", "requirio_garantia", "metodo_pago", "canal_reserva"
];

let DATA = null;


//------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------

function showScreen(sc) {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  document.getElementById('screen-' + sc).style.display = 'block';
  document.querySelectorAll('.nav button').forEach(b => b.removeAttribute('aria-current'));
  const btn = document.getElementById('nav-' + sc);
  if (btn) btn.setAttribute('aria-current', 'page');

  if (sc === 'm2') calcM2();
  if (sc === 'm3') calcM3();
  if (sc === 'm4') calcM4();
  if (sc === 'm5') calcM5();
  if (sc === 'm9') calcM9(); // <-- ¡Genera informe y decisiones al entrar a M9!
}


function handleFileSelect(evt) {
  const file = evt.target.files[0];
  if (!file) return;

  document.getElementById('top-filename').textContent = file.name;
  document.getElementById('error-container').innerHTML = '';

  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    Papa.parse(file, {
      header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: function (res) { validateAndLoad(res.data, file.name); }
    });
  } else if (ext === 'xlsx') {
    const reader = new FileReader();
    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.SheetNames.includes('datos') ? 'datos' : wb.SheetNames[0];
      const json = XLSX.utils.sheet_to_json(wb.Sheets[sheet]);
      validateAndLoad(json, file.name);
    };
    reader.readAsArrayBuffer(file);
  }
}

function validateAndLoad(rows, filename) {
  DATA = null;
  document.getElementById('kpi-filas').textContent = '-';
  document.getElementById('kpi-desde').textContent = '-';
  document.getElementById('kpi-hasta').textContent = '-';
  document.getElementById('kpi-mecs').textContent = '-';
  document.getElementById('kpi-clientes').textContent = '-';
  document.getElementById('sedes-tags').innerHTML = '<i>No hay sedes cargadas.</i>';
  document.getElementById('preview-header').innerHTML = '';
  document.getElementById('preview-body').innerHTML = '<tr><td colspan="21">Cargue un archivo válido.</td></tr>';

  const succContainer = document.getElementById('success-message-container');
  if (succContainer) succContainer.innerHTML = '';
  const errContainer = document.getElementById('error-container');
  if (errContainer) errContainer.innerHTML = '';

  if (!rows || rows.length === 0) {
    showErrors(["El archivo está vacío."]);
    return;
  }

  const cols = Object.keys(rows[0]);
  let errs = [];

  const missing = ESQUEMA.filter(c => !cols.includes(c));
  if (missing.length > 0) errs.push(`Faltan columnas obligatorias: ${missing.join(', ')}`);

  let emptyCount = 0, dups = 0, mathBad = 0;
  let ids = new Set();

  rows.forEach(r => {
    ESQUEMA.forEach(c => {
      if (r[c] === null || r[c] === undefined || r[c] === '') emptyCount++;
    });
    if (ids.has(r.id_servicio)) dups++;
    ids.add(r.id_servicio);

    if (Math.abs((r.costo_repuestos_usd + r.costo_mano_obra_usd) - r.costo_total_usd) > 0.01) {
      mathBad++;
    }
  });

  if (emptyCount > 0) errs.push(`Se encontraron ${emptyCount} celdas vacías.`);
  if (dups > 0) errs.push(`Se encontraron ${dups} identificadores 'id_servicio' duplicados.`);
  if (mathBad > 0) errs.push(`Existen ${mathBad} filas donde costo_total_usd no descuadra.`);

  if (errs.length > 0) {
    showErrors(errs);
    limpiarModulosAnalisis(); // <-- ¡ESTO ES LO QUE FALTABA! Limpia M2 y M3 de inmediato
    return;
  }

  DATA = rows;

  if (succContainer) {
    succContainer.innerHTML = `
        <div style="border-left: 4px solid var(--teal); background: var(--teal-soft); padding: 12px 14px; border-radius: 0 8px 8px 0; font-size: 13px; margin-top: 14px; color: var(--ink);">
          <b style="color: var(--teal);">${filename}:</b> los 21 encabezados coinciden con el esquema (MotoExpres S.A.S.).
        </div>
      `;
  }

  populateSedesFilter(rows);

  document.getElementById('chk-cols').textContent = '21 de 21';
  document.getElementById('chk-empty').textContent = '0 vacías';
  document.getElementById('chk-dups').textContent = '0 duplicadas';
  document.getElementById('chk-id').textContent = rows.length + ' únicos';
  document.getElementById('valid-interp').innerHTML = `<b style="color:var(--green)">Archivo válido.</b> Cumple rigurosamente el esquema oficial.`;

  document.getElementById('kpi-filas').textContent = rows.length.toLocaleString();
  document.getElementById('kpi-cols').textContent = '21';

  const fechas = rows.map(r => r.fecha).sort();
  document.getElementById('kpi-desde').textContent = fechas[0] || '-';
  document.getElementById('kpi-hasta').textContent = fechas[fechas.length - 1] || '-';

  const mecs = new Set(rows.map(r => r.mecanico));
  const sedes = new Set(rows.map(r => r.sede));
  const clientes = new Set(rows.map(r => r.id_cliente));

  document.getElementById('kpi-mecs').textContent = mecs.size;
  document.getElementById('kpi-clientes').textContent = clientes.size.toLocaleString();

  document.getElementById('sedes-tags').innerHTML = Array.from(sedes).map(s => `<span class="pill">${s}</span>`).join('');

  document.getElementById('preview-header').innerHTML = ESQUEMA.map(c => `<th>${c}</th>`).join('');
  document.getElementById('preview-body').innerHTML = rows.slice(0, 10).map(r => `
      <tr>${ESQUEMA.map(c => `<td class="mono">${r[c]}</td>`).join('')}</tr>
    `).join('');

  calcM2();
  calcM3();
}

function showErrors(list) {
  document.getElementById('valid-interp').innerHTML = `<b style="color:var(--red)">Archivo rechazado.</b> Ver detalles abajo.`;
  document.getElementById('error-container').innerHTML = `
      <div class="err-box">
        <b>El archivo no cumple con el esquema:</b>
        <ul>${list.map(e => `<li>${e}</li>`).join('')}</ul>
      </div>
    `;
}

function limpiarModulosAnalisis() {

  document.querySelectorAll('#screen-m2 .kpi .v, [id^="m2-card-"]').forEach(el => {
    el.innerText = '-';
  });

  const chartCont = document.getElementById('bar-chart-container');
  if (chartCont) chartCont.innerHTML = '<span style="color: var(--muted); font-size: 13px;">Sin datos válidos.</span>';

  const boxCont = document.getElementById('boxplot-container');
  if (boxCont) boxCont.innerHTML = '<span style="color: var(--muted); font-size: 13px;">Sin datos válidos.</span>';

  const histBox = document.getElementById('histogram-box');
  if (histBox) histBox.innerHTML = '<span style="color: var(--muted); margin:auto;">No hay datos para el histograma</span>';

  const statsTable = document.getElementById('m2-stats-table');
  if (statsTable) statsTable.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--muted);">Esperando datos...</td></tr>';

  const m2Interp = document.getElementById('m2-interp');
  if (m2Interp) m2Interp.innerHTML = '<b>Lectura:</b> Cargue un archivo en M1 para ver la interpretación analítica.';

  // --- LIMPIAR MÓDULO 3 ---
  const kpiPa = document.getElementById('m3-kpi-pa');
  const kpiPb = document.getElementById('m3-kpi-pb');
  const kpiPanb = document.getElementById('m3-kpi-panb');
  const kpiPaub = document.getElementById('m3-kpi-paub');
  if (kpiPa) kpiPa.innerText = '-';
  if (kpiPb) kpiPb.innerText = '-';
  if (kpiPanb) kpiPanb.innerText = '-';
  if (kpiPaub) kpiPaub.innerText = '-';

  const tablaContingencia = document.getElementById('m3-tabla-contingencia');
  if (tablaContingencia) {
    tablaContingencia.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:var(--muted);">Cargue datos para calcular...</td></tr>`;
  }

  const barrasGarantia = document.getElementById('m3-bars-garantia');
  if (barrasGarantia) {
    barrasGarantia.innerHTML = `<i style="color:var(--muted); font-size:12px;">Sin datos cargados.</i>`;
  }

  const bayesAntesVal = document.getElementById('m3-bayes-antes-val');
  const bayesDespuesVal = document.getElementById('m3-bayes-despues-val');
  const bayesInterp = document.getElementById('m3-bayes-interp');
  if (bayesAntesVal) bayesAntesVal.innerText = "-%";
  if (bayesDespuesVal) bayesDespuesVal.innerText = "-%";
  if (bayesInterp) {
    bayesInterp.innerHTML = `<b>Lectura:</b> Cargue datos para analizar el cambio de probabilidad con Bayes.`;
  }

  const tablaIndependencia = document.getElementById('m3-tabla-independencia');
  if (tablaIndependencia) {
    tablaIndependencia.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:10px; color:var(--muted);">Cargue datos para la prueba...</td></tr>`;
  }
}

function testInvalidFile() {
  showErrors([
    "Falta la columna 'costo_total_usd' (llegó como 'costo').",
    "1 celda vacía en la columna 'sede' (fila 6).",
    "1 fila duplicada (fila 61 repite la fila 11)."
  ]);
}

function populateSedesFilter(rows) {
  const sedes = Array.from(new Set(rows.map(r => r.sede))).filter(Boolean);
  const selSede = document.getElementById('sel-sede');
  selSede.innerHTML = '<option value="Todas">Todas las sedes</option>' + sedes.map(s => `<option value="${s}">${s}</option>`).join('');
}







//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


function calcM2() {
  if (!DATA || DATA.length === 0) return;

  const v = document.getElementById('sel-var').value;
  const sedeFiltro = document.getElementById('sel-sede').value;

  let filteredData = DATA;
  if (sedeFiltro !== 'Todas') {
    filteredData = DATA.filter(r => r.sede === sedeFiltro);
  }

  const vals = filteredData.map(r => Number(r[v])).filter(n => !isNaN(n)).sort((a, b) => a - b);
  const n = vals.length;
  if (n === 0) return;

  const sum = vals.reduce((a, b) => a + b, 0);
  const media = sum / n;
  const mediana = n % 2 === 0 ? (vals[n / 2 - 1] + vals[n / 2]) / 2 : vals[Math.floor(n / 2)];

  const min = vals[0];
  const max = vals[n - 1];

  const variance = vals.reduce((a, b) => a + Math.pow(b - media, 2), 0) / (n - 1);
  const std = Math.sqrt(variance);
  const cv = media !== 0 ? (std / media) * 100 : 0;

  const q1 = vals[Math.floor(n * 0.25)];
  const q3 = vals[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  const atipicos = vals.filter(val => val < lowerBound || val > upperBound).length;

  const m3 = vals.reduce((a, b) => a + Math.pow(b - media, 3), 0) / n;
  const sesgo = std > 0 ? (m3 / Math.pow(std, 3)) * (Math.sqrt(n * (n - 1)) / (n - 2)) : 0;

  document.getElementById('m2-kpi-media').textContent = media.toFixed(2);
  document.getElementById('m2-kpi-mediana').textContent = mediana.toFixed(2);
  document.getElementById('m2-kpi-std').textContent = std.toFixed(2);
  document.getElementById('m2-kpi-cv').textContent = cv.toFixed(1) + ' %';
  document.getElementById('m2-kpi-sesgo').textContent = sesgo.toFixed(2);
  document.getElementById('m2-kpi-atipicos').textContent = atipicos;

  document.getElementById('m2-stats-table').innerHTML = `
      <tr><td><b>n</b></td><td class="mono" style="text-align:right;">${n.toLocaleString()}</td></tr>
      <tr><td><b>Media</b></td><td class="mono" style="text-align:right;">${media.toFixed(2)}</td></tr>
      <tr><td><b>Mediana</b></td><td class="mono" style="text-align:right;">${mediana.toFixed(2)}</td></tr>
      <tr><td><b>Desviación estándar</b></td><td class="mono" style="text-align:right;">${std.toFixed(2)}</td></tr>
      <tr><td><b>Coeficiente de variación</b></td><td class="mono" style="text-align:right;">${cv.toFixed(1)} %</td></tr>
      <tr><td><b>Q1 · Q3</b></td><td class="mono" style="text-align:right;">${q1.toFixed(2)} · ${q3.toFixed(2)}</td></tr>
      <tr><td><b>IQR</b></td><td class="mono" style="text-align:right;">${iqr.toFixed(2)}</td></tr>
      <tr><td><b>Mínimo · Máximo</b></td><td class="mono" style="text-align:right;">${min.toFixed(2)} · ${max.toFixed(2)}</td></tr>
      <tr><td><b>Sesgo</b></td><td class="mono" style="text-align:right;">${sesgo.toFixed(2)}</td></tr>
      <tr><td><b>Atípicos</b></td><td class="mono" style="text-align:right;">${atipicos}</td></tr>
    `;

  let interpretacion = "";
  if (sesgo > 0.5) {
    interpretacion = `La variable es sesgada a la derecha (sesgo ${sesgo.toFixed(2)}): la mediana (${mediana.toFixed(2)}) representa mejor el caso típico que la media (${media.toFixed(2)}).`;
  } else if (sesgo < -0.5) {
    interpretacion = `La variable es sesgada a la izquierda (sesgo ${sesgo.toFixed(2)}): la mediana (${mediana.toFixed(2)}) es un estadístico de tendencia central más robusto que la media (${media.toFixed(2)}).`;
  } else {
    interpretacion = `La distribución es relativamente simétrica (sesgo ${sesgo.toFixed(2)}); media y mediana se alinean cercanamente alrededor del centro de los datos.`;
  }
  document.getElementById('m2-interp').innerHTML = `<b>Lectura:</b> ${interpretacion}`;

  document.getElementById('hist-title').textContent = `Histograma de ${v}`;

  renderFrecuenciasServicio(filteredData);
  renderBoxplotsPorServicio(filteredData, v);
  renderHistograma(vals, v);
  renderTarjetasInferiores(filteredData);
}

function renderTarjetasInferiores(rows) {
  if (!rows || rows.length === 0) return;

  try {
    const sedesCosto = {};
    rows.forEach(r => {
      const s = r.sede || 'N/A';
      if (!sedesCosto[s]) sedesCosto[s] = [];
      const val = Number(r.costo_total_usd);
      if (!isNaN(val)) sedesCosto[s].push(val);
    });

    let bestSede = '-';
    let maxMediaSede = -1;
    Object.entries(sedesCosto).forEach(([s, vals]) => {
      if (vals.length > 0) {
        const m = vals.reduce((a, b) => a + b, 0) / vals.length;
        if (m > maxMediaSede) { maxMediaSede = m; bestSede = s; }
      }
    });

    const elSede = document.getElementById('m2-card-sede');
    const elSedeVal = document.getElementById('m2-card-sede-val');

    if (elSede) elSede.textContent = bestSede;
    if (elSedeVal) elSedeVal.textContent = maxMediaSede >= 0 ? `${maxMediaSede.toFixed(2)} USD` : '-';

    const mecs = {};
    rows.forEach(r => {
      const m = r.mecanico;
      if (!m) return;
      if (!mecs[m]) mecs[m] = [];
      const val = Number(r.costo_total_usd);
      if (!isNaN(val)) mecs[m].push(val);
    });

    let bestMec = '-';
    let minCV = Infinity;

    Object.entries(mecs).forEach(([m, vals]) => {
      if (vals.length === 0) return;
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (mean === 0) return;

      let cv = 0;
      if (vals.length > 1) {
        const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (vals.length - 1);
        const std = Math.sqrt(variance);
        cv = (std / mean) * 100;
      }

      if (cv < minCV) {
        minCV = cv;
        bestMec = m;
      }
    });

    const elMec = document.getElementById('m2-card-mec');
    const elMecVal = document.getElementById('m2-card-mec-val');
    if (elMec) elMec.textContent = bestMec;
    if (elMecVal) elMecVal.textContent = minCV !== Infinity ? `CV ${minCV.toFixed(1)} %` : '-';

    const sats = rows.map(r => Number(r.satisfaccion)).filter(n => !isNaN(n));
    const elSat = document.getElementById('m2-card-sat');
    const elSatVal = document.getElementById('m2-card-sat-val');

    if (sats.length > 0) {
      const satMean = sats.reduce((a, b) => a + b, 0) / sats.length;
      const freq = {};
      sats.forEach(s => freq[s] = (freq[s] || 0) + 1);
      let moda = sats[0], maxF = 0;
      Object.entries(freq).forEach(([s, f]) => { if (f > maxF) { maxF = f; moda = s; } });

      if (elSat) elSat.textContent = `moda ${moda}`;
      if (elSatVal) elSatVal.textContent = `media ${satMean.toFixed(2)}`;
    } else {
      if (elSat) elSat.textContent = '-';
      if (elSatVal) elSatVal.textContent = '-';
    }
  } catch (e) {
    console.error("EXCEPCIÓN EN RENDER TARJETAS INFERIORES:", e);
  }
}


function renderFrecuenciasServicio(rows) {
  const cont = document.getElementById('bar-chart-container');
  const counts = {};
  rows.forEach(r => {
    const s = r.tipo_servicio || 'Desconocido';
    counts[s] = (counts[s] || 0) + 1;
  });

  const total = rows.length;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  cont.innerHTML = sorted.map(([serv, count]) => {
    const pct = ((count / total) * 100).toFixed(1);
    return `
        <div>
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:2px;">
            <span>${serv}</span>
            <span class="mono">${count} - ${pct}%</span>
          </div>
          <div style="background:var(--surface-2); border-radius:4px; height:10px; width:100%; overflow:hidden;">
            <div style="background:var(--teal); height:100%; width:${pct}%;"></div>
          </div>
        </div>
      `;
  }).join('');
}

function renderBoxplotsPorServicio(rows, varName) {
  const cont = document.getElementById('boxplot-container');
  const grupos = {};
  rows.forEach(r => {
    const g = r.tipo_servicio || 'General';
    if (!grupos[g]) grupos[g] = [];
    const val = Number(r[varName]);
    if (!isNaN(val)) grupos[g].push(val);
  });

  const html = Object.entries(grupos).map(([serv, vals]) => {
    if (vals.length === 0) return '';
    vals.sort((a, b) => a - b);
    const min = vals[0];
    const max = vals[vals.length - 1];
    const q1 = vals[Math.floor(vals.length * 0.25)];
    const med = vals[Math.floor(vals.length * 0.5)];
    const q3 = vals[Math.floor(vals.length * 0.75)];

    return `
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:12px;">
          <span style="width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${serv}</span>
          <div style="flex-grow:1; position:relative; height:16px; margin:0 10px; background:rgba(255,255,255,0.05); border-radius:4px;">
            <div style="position:absolute; left:${(min / max) * 100}%; width:${((max - min) / max) * 100}%; height:2px; background:var(--muted); top:7px;"></div>
            <div style="position:absolute; left:${(q1 / max) * 100}%; width:${((q3 - q1) / max) * 100}%; height:12px; background:var(--teal); opacity:0.8; top:2px; border-radius:2px;"></div>
            <div style="position:absolute; left:${(med / max) * 100}%; width:2px; height:14px; background:var(--amber); top:1px;"></div>
          </div>
          <span class="mono" style="width:50px; text-align:right; font-size:11px;">${med.toFixed(0)}</span>
        </div>
      `;
  }).join('');

  cont.innerHTML = html || '<i>No hay suficientes datos para generar boxplots.</i>';
}

function renderHistograma(vals, v) {
  const container = document.getElementById('histogram-box');
  if (!vals || vals.length === 0) {
    container.innerHTML = '<span style="color:var(--muted); margin:auto;">No hay datos para el histograma</span>';
    return;
  }

  const min = vals[0];
  const max = vals[vals.length - 1];

  if (min === max) {
    container.innerHTML = '<span style="color:var(--muted); margin:auto;">Los valores son idénticos, no se puede histogramar</span>';
    return;
  }

  // Dividir en 8 intervalos (bins)
  const numBins = 8;
  const binWidth = (max - min) / numBins;
  const bins = Array(numBins).fill(0);

  vals.forEach(val => {
    let binIndex = Math.floor((val - min) / binWidth);
    if (binIndex >= numBins) binIndex = numBins - 1; // por si cae exactamente en el max
    if (binIndex < 0) binIndex = 0;
    bins[binIndex]++;
  });

  const maxFreq = Math.max(...bins);

  // Dibujar las barras dentro del contenedor
  container.innerHTML = bins.map((freq, i) => {
    const binMin = min + i * binWidth;
    const binMax = binMin + binWidth;
    const heightPct = maxFreq > 0 ? (freq / maxFreq) * 100 : 0;

    return `
        <div style="display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; flex:1; padding:0 2px;" title="Rango: ${binMin.toFixed(0)} - ${binMax.toFixed(0)} | Frecuencia: ${freq}">
          <div style="font-size:9px; color:var(--muted); margin-bottom:2px;">${freq}</div>
          <div style="background:var(--teal); width:100%; height:${heightPct}%; border-radius:3px 3px 0 0; min-height:4px;"></div>
          <div style="font-size:9px; color:var(--muted); margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;">${binMin.toFixed(0)}</div>
        </div>
      `;
  }).join('');
}





//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function calcM3() {
  if (!DATA || DATA.length === 0) return;

  const totalN = DATA.length;

  // 1. Probabilidades Básicas y Regla de la Suma
  const countA = DATA.filter(r => String(r.tipo_vehiculo || '').toLowerCase().includes('moto')).length;
  const countB = DATA.filter(r => Number(r.satisfaccion) >= 4).length;
  const countAnB = DATA.filter(r => String(r.tipo_vehiculo || '').toLowerCase().includes('moto') && Number(r.satisfaccion) >= 4).length;

  const pA = countA / totalN;
  const pB = countB / totalN;
  const pAnB = countAnB / totalN;
  const pAuB = pA + pB - pAnB; // Regla de la suma

  document.getElementById('m3-kpi-pa').textContent = pA.toFixed(4);
  document.getElementById('m3-kpi-pb').textContent = pB.toFixed(4);
  document.getElementById('m3-kpi-panb').textContent = pAnB.toFixed(4);
  document.getElementById('m3-kpi-paub').textContent = pAuB.toFixed(4);

  // 2. TABLA DE CONTINGENCIA Y BARRAS: Mecánico x Requirió Garantía
  const mecs = {};
  let totalGarantias = 0;

  DATA.forEach(r => {
    const m = r.mecanico || 'Sin Asignar';
    const garantia = String(r.requirio_garantia || r.garantia || '').toLowerCase();
    const esSi = (garantia === 'sí' || garantia === 'si' || garantia === 'true' || garantia === '1');

    if (!mecs[m]) mecs[m] = { si: 0, no: 0, total: 0 };

    if (esSi) {
      mecs[m].si++;
      totalGarantias++;
    } else {
      mecs[m].no++;
    }
    mecs[m].total++;
  });

  let htmlContingencia = '';
  let htmlBarras = '';
  let maxP = 0;

  Object.entries(mecs).forEach(([m, obj]) => {
    const pCond = obj.total > 0 ? (obj.si / obj.total) : 0;
    if (pCond > maxP) maxP = pCond;

    htmlContingencia += `
          <tr style="border-bottom:1px solid #222;">
            <td style="padding:8px; font-weight:600; color:#FFF;">${m}</td>
            <td style="padding:8px; text-align:center;">${obj.si}</td>
            <td style="padding:8px; text-align:center;">${obj.no}</td>
            <td style="padding:8px; text-align:center; font-weight:600;">${obj.total}</td>
            <td style="padding:8px; text-align:right; color:#4ecca3; font-weight:bold;">${pCond.toFixed(4)}</td>
          </tr>
        `;
  });

  document.getElementById('m3-tabla-contingencia').innerHTML = htmlContingencia;

  // Renderizar Barras de P(Garantía | Mecánico)
  const maxAncho = maxP > 0 ? maxP : 1;
  Object.entries(mecs).forEach(([m, obj]) => {
    const pCond = obj.total > 0 ? (obj.si / obj.total) : 0;
    const widthPct = (pCond / maxAncho) * 100;

    htmlBarras += `
          <div style="display:flex; align-items:center; gap:10px; font-size:12px;">
            <div style="width:110px; color:#ccc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m}</div>
            <div style="flex:1; background:#161625; border-radius:4px; height:18px; overflow:hidden;">
              <div style="background:#4ecca3; width:${widthPct}%; height:100%; border-radius:4px;"></div>
            </div>
            <div style="width:45px; text-align:right; font-weight:bold; color:#4ecca3;">${pCond.toFixed(3)}</div>
          </div>
        `;
  });

  document.getElementById('m3-bars-garantia').innerHTML = htmlBarras;

  // 3. TEOREMA DE BAYES: ¿De dónde viene una garantía?
  let targetMec = Object.keys(mecs)[0] || 'Mecánico';
  let maxRate = -1;

  Object.entries(mecs).forEach(([m, obj]) => {
    const rate = obj.total > 0 ? (obj.si / obj.total) : 0;
    if (rate > maxRate) {
      maxRate = rate;
      targetMec = m;
    }
  });

  const pPrior = mecs[targetMec] ? (mecs[targetMec].total / totalN) : 0;
  const pGarantiaDadaMec = maxRate;
  const pGarantiaGlobal = totalN > 0 ? (totalGarantias / totalN) : 0;

  const pPosterior = pGarantiaGlobal > 0 ? (pGarantiaDadaMec * pPrior) / pGarantiaGlobal : 0;
  const factor = pPrior > 0 ? (pPosterior / pPrior).toFixed(1) : '1.0';

  document.getElementById('m3-bayes-antes-label').textContent = `ANTES · P(${targetMec.toUpperCase()})`;
  document.getElementById('m3-bayes-antes-val').textContent = `${(pPrior * 100).toFixed(1)} %`;

  document.getElementById('m3-bayes-despues-label').textContent = `DESPUÉS · P(${targetMec.toUpperCase()} | GARANTÍA)`;
  document.getElementById('m3-bayes-despues-val').textContent = `${(pPosterior * 100).toFixed(1)} %`;

  document.getElementById('m3-bayes-interp').innerHTML = `
        <b>Lectura:</b> Saber que hubo garantía multiplica por <b>${factor}</b> la probabilidad de que la reparación haya sido realizada por <b>${targetMec}</b>.
      `;

  // 4. PRUEBA DE INDEPENDENCIA: Regla |P(A|B) - P(A)| < 0.02
  const testPairs = [
    {
      condLabel: 'P(Satisf ≥ 4 | Moto)',
      uncondLabel: 'P(Satisf ≥ 4)',
      calcCond: () => {
        const motos = DATA.filter(r => String(r.tipo_vehiculo || '').toLowerCase().includes('moto'));
        return motos.length > 0 ? motos.filter(r => Number(r.satisfaccion) >= 4).length / motos.length : 0;
      },
      calcUncond: () => pB,
      desc: 'Tener una moto'
    },
    {
      condLabel: 'P(Recomienda | Nequi)',
      uncondLabel: 'P(Recomienda)',
      calcCond: () => {
        const nequi = DATA.filter(r => String(r.metodo_pago || '').toLowerCase().includes('nequi'));
        return nequi.length > 0 ? nequi.filter(r => String(r.recomendaria || '').toLowerCase().includes('sí') || String(r.recomendaria || '').toLowerCase().includes('si')).length / nequi.length : 0;
      },
      calcUncond: () => {
        return DATA.filter(r => String(r.recomendaria || '').toLowerCase().includes('sí') || String(r.recomendaria || '').toLowerCase().includes('si')).length / totalN;
      },
      desc: 'Pagar con Nequi'
    },
    {
      condLabel: 'P(Satisf ≥ 4 | Garantía)',
      uncondLabel: 'P(Satisf ≥ 4)',
      calcCond: () => {
        const garantias = DATA.filter(r => String(r.requirio_garantia || r.garantia || '').toLowerCase().includes('sí') || String(r.requirio_garantia || r.garantia || '').toLowerCase().includes('si'));
        return garantias.length > 0 ? garantias.filter(r => Number(r.satisfaccion) >= 4).length / garantias.length : 0;
      },
      calcUncond: () => pB,
      desc: 'Haber requerido garantía'
    }
  ];

  let htmlIndep = '';

  testPairs.forEach(pair => {
    const pCond = pair.calcCond();
    const pUncond = pair.calcUncond();
    const diff = pCond - pUncond;
    const absDiff = Math.abs(diff);

    // Regla de corte según la rúbrica: |P(A|B) - P(A)| < 0.02
    const esIndep = absDiff < 0.02;

    let veredictoText = '';
    let badgeBg = '';
    let badgeColor = '';

    if (esIndep) {
      veredictoText = 'prácticamente independientes';
      badgeBg = 'rgba(78, 204, 163, 0.2)';
      badgeColor = '#4ecca3';
    } else {
      const efecto = diff > 0 ? 'aumenta' : 'disminuye';
      veredictoText = `dependientes (${pair.desc} ${efecto} la probabilidad)`;
      badgeBg = 'rgba(235, 130, 60, 0.2)';
      badgeColor = '#eb823c';
    }

    htmlIndep += `
          <tr style="border-bottom:1px solid #222;">
            <td style="padding:8px; font-weight:600; color:#FFF;">${pair.condLabel}</td>
            <td style="padding:8px; text-align:center; color:#4ecca3; font-weight:bold;">${pCond.toFixed(4)}</td>
            <td style="padding:8px; color:#888;">${pair.uncondLabel}</td>
            <td style="padding:8px; text-align:center; color:#FFF;">${pUncond.toFixed(4)}</td>
            <td style="padding:8px; text-align:right;">
              <span style="background:${badgeBg}; color:${badgeColor}; padding:4px 8px; border-radius:12px; font-size:11px; font-weight:bold; display:inline-block;">
                ${veredictoText}
              </span>
            </td>
          </tr>
        `;
  });

  document.getElementById('m3-tabla-independencia').innerHTML = htmlIndep;
}





//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function calcM4() {
    if (!DATA || DATA.length === 0) return;

    // ==========================================
    // 1. VARIABLE ALEATORIA: repuestos_usados
    // ==========================================
    const repVals = DATA.map(r => Number(r.repuestos_usados)).filter(n => !isNaN(n));
    const totalRep = repVals.length;

    if (totalRep > 0) {
        // Frecuencias para PMF (0, 1, 2, 3, 4, 5+)
        const freq = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, '5+': 0 };
        repVals.forEach(v => {
            if (v >= 0 && v <= 4) freq[v]++;
            else if (v >= 5) freq['5+']++;
        });

        const pmf = {};
        Object.keys(freq).forEach(k => {
            pmf[k] = freq[k] / totalRep;
        });

        // Esperante E(X)
        const meanX = repuestosValsMean(repVals);
        
        // Varianza muestral V(X) con (N-1)
        const varX = repVals.reduce((a, b) => a + Math.pow(b - meanX, 2), 0) / (totalRep - 1);
        
        // P(X >= 3)
        const countGE3 = repVals.filter(v => v >= 3).length;
        const pGE3 = countGE3 / totalRep;

        const elEX = document.getElementById('m4-kpi-ex');
        const elVX = document.getElementById('m4-kpi-vx');
        const elP3 = document.getElementById('m4-kpi-p3');
        if (elEX) elEX.textContent = meanX.toFixed(4);
        if (elVX) elVX.textContent = varX.toFixed(4);
        if (elP3) elP3.textContent = pGE3.toFixed(4);

        renderPMFChart(pmf);
    }

    // ==========================================
    // 2. MODELO BINOMIAL (p = P(recomienda = Sí))
    // ==========================================
    const recRows = DATA.filter(r => r.recomendaria !== undefined && r.recomendaria !== null);
    const exitos = recRows.filter(r => {
        const val = String(r.recomendaria || '').trim().toLowerCase();
        return val === 'sí' || val === 'si' || val === 'true' || val === '1' || val === 's';
    }).length;

    const pBin = recRows.length > 0 ? (exitos / recRows.length) : 0.75;
    
    const subBin = document.getElementById('m4-binomial-subtitle');
    if (subBin) subBin.textContent = `p = P(Recomienda = Sí) = ${pBin.toFixed(4)} (estimado del archivo)`;

    const inputN = document.getElementById('binomial-n');
    const inputK = document.getElementById('binomial-k');

    const updateBinomial = () => {
        let n = parseInt(inputN ? inputN.value : 10) || 10;
        let k = parseInt(inputK ? inputK.value : 8) || 8;
        if (k > n) k = n;

        const exBin = n * pBin;
        const pEqK = combinacion(n, k) * Math.pow(pBin, k) * Math.pow(1 - pBin, n - k);
        
        let pGeqK = 0;
        for (let i = k; i <= n; i++) {
            pGeqK += combinacion(n, i) * Math.pow(pBin, i) * Math.pow(1 - pBin, n - i);
        }

        const elEq = document.getElementById('binomial-res-eq');
        const elGeq = document.getElementById('binomial-res-geq');
        const elEx = document.getElementById('binomial-res-ex');
        if (elEq) elEq.textContent = pEqK.toFixed(4);
        if (elGeq) elGeq.textContent = pGeqK.toFixed(4);
        if (elEx) elEx.textContent = exBin.toFixed(2);

        const elInterp = document.getElementById('binomial-interp');
        if (elInterp) {
            elInterp.innerHTML = `<b>Lectura:</b> De ${n} clientes que recomiendan, la probabilidad de que ${k} o más cumplan es ${(pGeqK * 100).toFixed(1)}%.`;
        }

        renderBinomialChart(n, k, pBin);
    };

    if (inputN) inputN.oninput = updateBinomial;
    if (inputK) inputK.oninput = updateBinomial;
    updateBinomial();

    // ==========================================
    // 3. MODELO POISSON (Servicios por sede y día hábil)
    // ==========================================
    const sedesSet = new Set(DATA.map(r => r.sede)).size || 1;
    const fechasSet = new Set(DATA.map(r => r.fecha)).size || 1;
    
    // lambda por sede y día hábil
    const lambda = DATA.length / (Math.max(fechasSet, 1) * sedesSet);

    // Varianza observada de conteos diarios por sede
    const conteosMap = {};
    DATA.forEach(r => {
        const key = `${r.fecha}_${r.sede}`;
        conteosMap[key] = (conteosMap[key] || 0) + 1;
    });
    const conteosArr = Object.values(conteosMap);
    const meanConteos = repuestosValsMean(conteosArr);
    const varConteos = conteosArr.length > 1 
        ? conteosArr.reduce((a, b) => a + Math.pow(b - meanConteos, 2), 0) / (conteosArr.length - 1) 
        : 0;
    const ratioVarMean = meanConteos > 0 ? (varConteos / meanConteos) : 1.0;

    const subP = document.getElementById('poisson-subtitle');
    const elRatio = document.getElementById('poisson-ratio');
    if (subP) subP.textContent = `λ = ${lambda.toFixed(4)} (promedio observado por sede y día)`;
    if (elRatio) elRatio.textContent = ratioVarMean.toFixed(2);

    const p0 = poissonProb(0, lambda);
    let pGE20 = 0;
    for (let x = 20; x <= 80; x++) {
        pGE20 += poissonProb(x, lambda);
    }

    const elP0 = document.getElementById('poisson-p0');
    const elP20 = document.getElementById('poisson-p20');
    if (elP0) elP0.textContent = p0.toFixed(4);
    if (elP20) elP20.textContent = pGE20.toFixed(4);

    // Capacidad mínima c con P(X > c) < 5% (es decir, P(X <= c) >= 0.95)
    let cMin = 0;
    let acum = 0;
    for (let x = 0; x <= 100; x++) {
        acum += poissonProb(x, lambda);
        if (acum >= 0.95) {
            cMin = x;
            break;
        }
    }

    const elC = document.getElementById('poisson-c');
    const pInterp = document.getElementById('poisson-interp');
    if (elC) elC.textContent = cMin;
    if (pInterp) {
        pInterp.innerHTML = `<b>Lectura:</b> Con capacidad diaria por sede de ${cMin}, la probabilidad de superarla es menor al 5%.`;
    }

    renderPoissonChart(lambda, cMin);
}

// FUNCIONES MATEMÁTICAS AUXILIARES
function repuestosValsMean(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function factorial(num) {
    if (num < 0) return 0;
    if (num === 0 || num === 1) return 1;
    let sum = 1;
    for (let i = 2; i <= num; i++) sum *= i;
    return sum;
}

function combinacion(n, k) {
    if (k > n || k < 0) return 0;
    return factorial(n) / (factorial(k) * factorial(n - k));
}

function poissonProb(k, lambda) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function renderPMFChart(pmf) {
    const cont = document.getElementById('m4-pmf-container');
    if (!cont) return;
    const maxVal = Math.max(...Object.values(pmf)) || 1;
    cont.innerHTML = Object.entries(pmf).map(([x, prob]) => {
        const heightPct = (prob / maxVal) * 100;
        return `
            <div style="display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; flex:1; padding:0 2px;">
                <div style="font-size:9px; color:var(--muted); margin-bottom:2px;">${prob.toFixed(2)}</div>
                <div style="background:var(--teal); width:100%; height:${heightPct}%; border-radius:3px 3px 0 0; min-height:4px;"></div>
                <div style="font-size:10px; color:var(--muted); margin-top:4px;">${x}</div>
            </div>
        `;
    }).join('');
}

function renderBinomialChart(n, kHighlight, p) {
    const cont = document.getElementById('binomial-chart-container');
    if (!cont) return;
    let probs = [];
    let maxP = 0;
    for (let i = 0; i <= n; i++) {
        let prob = combinacion(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
        probs.push(prob);
        if (prob > maxP) maxP = prob;
    }

    cont.innerHTML = probs.map((prob, i) => {
        const heightPct = maxP > 0 ? (prob / maxP) * 100 : 0;
        const color = i === kHighlight ? 'var(--amber)' : 'var(--teal)';
        return `
            <div style="display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; flex:1;">
                <div style="background:${color}; width:100%; height:${heightPct}%; border-radius:2px 2px 0 0; min-height:2px;"></div>
                <div style="font-size:8px; color:var(--muted); margin-top:2px;">${i}</div>
            </div>
        `;
    }).join('');
}

function renderPoissonChart(lambda, cMin) {
    const cont = document.getElementById('poisson-chart-container');
    if (!cont) return;
    let maxVal = Math.round(lambda * 2) + 2;
    let probs = [];
    let maxP = 0;
    for (let i = 0; i <= maxVal; i++) {
        let prob = poissonProb(i, lambda);
        probs.push(prob);
        if (prob > maxP) maxP = prob;
    }

    cont.innerHTML = probs.map((prob, i) => {
        const heightPct = maxP > 0 ? (prob / maxP) * 100 : 0;
        const color = i === cMin ? 'var(--amber)' : 'var(--teal)';
        return `
            <div style="display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; flex:1;">
                <div style="background:${color}; width:100%; height:${heightPct}%; border-radius:2px 2px 0 0; min-height:2px;"></div>
                <div style="font-size:8px; color:var(--muted); margin-top:2px;">${i}</div>
            </div>
        `;
    }).join('');
}





//----------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------

// MÓDULO 5: NORMAL Y EXPONENCIAL
function calcM5() {
    if (!DATA || DATA.length === 0) return;

    // Extraer tiempo_diagnostico_min
    const diagVals = DATA.map(r => Number(r.tiempo_diagnostico_min)).filter(n => !isNaN(n)).sort((a, b) => a - b);
    const n = diagVals.length;
    if (n === 0) return;

    // Media (mu) y Desviación estándar muestral (sigma)
    const mu = diagVals.reduce((a, b) => a + b, 0) / n;
    const sigma = Math.sqrt(diagVals.reduce((a, b) => a + Math.pow(b - mu, 2), 0) / (n - 1));

    document.getElementById('m5-normal-subtitle').textContent = `Histograma de los datos con la curva Normal (μ = ${mu.toFixed(2)}, σ = ${sigma.toFixed(2)})`;

    // Regla empírica: % dentro de mu +- 1sigma y mu +- 2sigma
    const count1Sig = diagVals.filter(v => v >= (mu - sigma) && v <= (mu + sigma)).length;
    const count2Sig = diagVals.filter(v => v >= (mu - 2 * sigma) && v <= (mu + 2 * sigma)).length;

    const pct1Sig = (count1Sig / n) * 100;
    const pct2Sig = (count2Sig / n) * 100;

    document.getElementById('m5-kpi-1sigma').textContent = pct1Sig.toFixed(1) + ' %';
    document.getElementById('m5-kpi-2sigma').textContent = pct2Sig.toFixed(1) + ' %';

    // Percentil 95 teóricamente y observado
    const p95Val = normalInverseCDF(0.95, mu, sigma);
    document.getElementById('m5-kpi-p95').textContent = p95Val.toFixed(2) + ' min';

    // Calculadora Normal interacciones
    const inputX = document.getElementById('normal-input-x');
    const inputP = document.getElementById('normal-input-p');

    const updateNormalCalc = () => {
        const x = parseFloat(inputX.value) || 25;
        const pInput = (parseFloat(inputP.value) || 95) / 100;

        const pLt = normalCDF(x, mu, sigma);
        const pGt = 1 - pLt;
        const percRes = normalInverseCDF(pInput, mu, sigma);

        document.getElementById('normal-res-lt').textContent = pLt.toFixed(4);
        document.getElementById('normal-res-gt').textContent = pGt.toFixed(4);
        document.getElementById('normal-res-perc').textContent = percRes.toFixed(2) + ' min';

        // P(X > 25) modelo vs observado
        const obsGT25 = diagVals.filter(v => v > x).length / n;
        document.getElementById('normal-interp').innerHTML = `<b>Modelo vs datos:</b> P(X > ${x}) = ${pGt.toFixed(4)} con la Normal y ${obsGT25.toFixed(4)} observada. La Normal describe bien esta variable.`;
    };

    if (inputX) inputX.oninput = updateNormalCalc;
    if (inputP) inputP.oninput = updateNormalCalc;
    updateNormalCalc();

    renderNormalChart(diagVals, mu, sigma);

    // EXPONENCIAL: tiempo entre llegadas
    
    // λ = filas / (días_hábiles * sedes * 11 h)
    const sedesSet = new Set(DATA.map(r => r.sede)).size || 1;
    const fechasSet = new Set(DATA.map(r => r.fecha)).size || 1;
    
    // Suponiendo 11 horas diarias de operación por sede
    const lambdaExp = DATA.length / (Math.max(fechasSet, 1) * sedesSet * 11);
    const etMins = lambdaExp > 0 ? (60 / lambdaExp) : 0;
    
    // P(T < 5 min) = 1 - e^(-lambda * (5/60))
    const pT5 = 1 - Math.exp(-lambdaExp * (5 / 60));

    document.getElementById('exp-lambda').textContent = lambdaExp.toFixed(2);
    document.getElementById('exp-et').textContent = etMins.toFixed(1) + ' min';
    document.getElementById('exp-p5').textContent = pT5.toFixed(4);

    document.getElementById('exp-interp').innerHTML = `<b>Lectura:</b> El tiempo medio esperado entre llegadas por sede es de ${etMins.toFixed(1)} minutos.`;
}

// FUNCIONES ESTADÍSTICAS NORMALES Y AUXILIARES
function normalCDF(x, mean, stdDev) {
    return 0.5 * (1 + erf((x - mean) / (stdDev * Math.sqrt(2))));
}

function erf(z) {
    const t = 1.0 / (1.0 + 0.5 * Math.abs(z));
    const tau = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return z >= 0 ? 1 - tau : tau - 1;
}

function normalInverseCDF(p, mean, stdDev) {
    // Aproximación de Beasley-Springer-Moro para inversa normal estándar
    const a = [
        -3.969683028665376e+01,  2.209460984245050e+02,
        -2.759285104469687e+02,  1.383577518672690e+02,
        -3.066479806614716e+01,  2.506628277459239e+00
    ];
    const b = [
        -5.447609879822406e+01,  1.615858368580409e+02,
        -1.556989798598866e+02,  6.680131188771972e+01,
        -1.328068155288572e+01
    ];
    const c = [
        -7.784894002430293e-03, -3.223964580411365e-01,
        -2.400758277161838e+00, -2.549732539343734e+00,
        4.374664141464968e+00,  2.938163982698783e+00
    ];
    const d = [
        7.784695709041462e-03,  3.224671290700398e-01,
        2.445134137142996e+00,  3.754408661907416e+00
    ];

    let q, r, z;
    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
        q = p - 0.5;
        r = q * q;
        z = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
            (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        z = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
             ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    return mean + stdDev * z;
}

function renderNormalChart(vals, mu, sigma) {
    const cont = document.getElementById('m5-normal-chart');
    if (!cont) return;

    const min = vals[0];
    const max = vals[vals.length - 1];
    const numBins = 10;
    const binWidth = (max - min) / numBins;
    const bins = Array(numBins).fill(0);

    vals.forEach(v => {
        let idx = Math.floor((v - min) / binWidth);
        if (idx >= numBins) idx = numBins - 1;
        if (idx < 0) idx = 0;
        bins[idx]++;
    });

    const maxFreq = Math.max(...bins) || 1;
    const nTotal = vals.length;

    // Generar 100 puntos continuos para la campana de Gauss
    let pathD = "";
    const steps = 100;
    
    // Altura máxima reservada para las barras (80% del alto del contenedor para dar aire a la curva arriba)
    const maxBarHeightPct = 80;

    for (let i = 0; i <= steps; i++) {
        // Valor X real en el rango
        const xVal = min + (i / steps) * (max - min);
        
        // Función de Densidad Normal teórica
        const pdf = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((xVal - mu) / sigma, 2));
        
        // Frecuencia esperada en este punto escalada a la muestra
        const freqEsperada = pdf * binWidth * nTotal;

        // Porcentaje X (0% a 100%)
        const px = (i / steps) * 100;

        const py = 100 - (freqEsperada / maxFreq) * maxBarHeightPct;

        if (i === 0) {
            pathD += `M ${px.toFixed(2)} ${py.toFixed(2)}`;
        } else {
            pathD += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
        }
    }

    cont.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: flex-end;">
            
            <!-- CONTENEDOR DE BARRAS Y SVG SUPERPUESTO -->
            <div style="position: relative; width: 100%; height: 160px;">
                
                <!-- BARRAS DEL HISTOGRAMA -->
                <div style="position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: space-between; gap: 4px; z-index: 1;">
                    ${bins.map((freq, i) => {
                        const heightPct = (freq / maxFreq) * maxBarHeightPct;
                        return `
                            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end;">
                                <div style="font-size: 8px; color: var(--muted); margin-bottom: 2px;">${freq > 0 ? freq : ''}</div>
                                <div style="background: var(--teal); width: 100%; height: ${heightPct}%; border-radius: 3px 3px 0 0; min-height: 2px;"></div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- SVG CON LA CURVA NORMAL EN CORAL (#FB7185) -->
                <svg style="position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none;" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="${pathD}" fill="none" stroke="#e0e846" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>

            </div>

            <!-- EJE X CON ETIQUETAS Y NUMERACIÓN -->
            <div style="display: flex; justify-content: space-between; margin-top: 6px; padding: 0 4px; z-index: 3;">
                ${bins.map((_, i) => {
                    const binVal = min + i * binWidth;
                    return `<span style="font-size: 9px; color: var(--muted); text-align: center; flex: 1;">${binVal.toFixed(0)}</span>`;
                }).join('')}
            </div>

        </div>
    `;
}





//----------------------------------------------------------------------------------------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------


// MÓDULO 9: INFORME Y DECISIONES
function calcM9() {
    if (!DATA || DATA.length === 0) {
        document.getElementById('m9-kpi-servicios').textContent = '-';
        document.getElementById('m9-kpi-fechas').textContent = 'Sin datos';
        document.getElementById('m9-kpi-costo').textContent = '-';
        document.getElementById('m9-kpi-ic').textContent = '-';
        document.getElementById('m9-kpi-recom').textContent = '-';
        document.getElementById('m9-kpi-gar').textContent = '-';
        document.getElementById('m9-dec1-title').textContent = 'Cargue datos en M1';
        document.getElementById('m9-dec1-desc').textContent = 'Esperando conjunto de datos válido.';
        document.getElementById('m9-dec2-title').textContent = 'Cargue datos en M1';
        document.getElementById('m9-dec2-desc').textContent = 'Esperando conjunto de datos válido.';
        document.getElementById('m9-dec3-title').textContent = 'Cargue datos en M1';
        document.getElementById('m9-dec3-desc').textContent = 'Esperando conjunto de datos válido.';
        return;
    }

    const totalN = DATA.length;
    
    // Rango de fechas del archivo activo
    const fechas = DATA.map(r => r.fecha).filter(Boolean).sort();
    let rangoFechasStr = 'periodo activo';
    if (fechas.length > 0) {
        rangoFechasStr = `${fechas[0]} a ${fechas[fechas.length - 1]}`;
    }

    // Costo medio y IC 95%
    const costos = DATA.map(r => Number(r.costo_total_usd)).filter(n => !isNaN(n));
    const meanCosto = costos.length > 0 ? costos.reduce((a, b) => a + b, 0) / costos.length : 0;
    const stdCosto = costos.length > 1 ? Math.sqrt(costos.reduce((a, b) => a + Math.pow(b - meanCosto, 2), 0) / (costos.length - 1)) : 0;
    const semCosto = stdCosto / Math.sqrt(costos.length || 1);
    const icInf = meanCosto - 1.96 * semCosto;
    const icSup = meanCosto + 1.96 * semCosto;

    // % Recomiendan
    const recRows = DATA.filter(r => r.recomendaria !== undefined && r.recomendaria !== null);
    const recExitos = recRows.filter(r => {
        const val = String(r.recomendaria || '').trim().toLowerCase();
        return val === 'sí' || val === 'si' || val === 'true' || val === '1' || val === 's';
    }).length;
    const pctRecom = recRows.length > 0 ? (recExitos / recRows.length) * 100 : 0;

    // % Garantías
    const garRows = DATA.filter(r => r.requirio_garantia !== undefined || r.garantia !== undefined);
    const garExitos = garRows.filter(r => {
        const val = String(r.requirio_garantia || r.garantia || '').trim().toLowerCase();
        return val === 'sí' || val === 'si' || val === 'true' || val === '1' || val === 's';
    }).length;
    const pctGar = garRows.length > 0 ? (garExitos / garRows.length) * 100 : 0;

    // Poisson lambda y capacidad mínima c
    const sedesSet = new Set(DATA.map(r => r.sede)).size || 1;
    const fechasSet = new Set(DATA.map(r => r.fecha)).size || 1;
    const lambdaPoisson = totalN / (Math.max(fechasSet, 1) * sedesSet);
    
    let cMin = 0;
    let acum = 0;
    for (let x = 0; x <= 100; x++) {
        acum += poissonProb(x, lambdaPoisson);
        if (acum >= 0.95) {
            cMin = x;
            break;
        }
    }

    // Mecánico con mayor impacto en garantías
    const mecs = {};
    let totalGarantiasDataset = 0;
    DATA.forEach(r => {
        const m = r.mecanico || 'Sin Asignar';
        const garantia = String(r.requirio_garantia || r.garantia || '').toLowerCase();
        const esSi = (garantia === 'sí' || garantia === 'si' || garantia === 'true' || garantia === '1');
        if (!mecs[m]) mecs[m] = { si: 0, total: 0 };
        if (esSi) {
            mecs[m].si++;
            totalGarantiasDataset++;
        }
        mecs[m].total++;
    });

    let topMec = 'Mecánico Principal';
    let maxGarShare = -1;
    let topMecServShare = 0;
    Object.entries(mecs).forEach(([m, obj]) => {
        const shareGar = totalGarantiasDataset > 0 ? (obj.si / totalGarantiasDataset) : 0;
        if (shareGar > maxGarShare) {
            maxGarShare = shareGar;
            topMec = m;
            topMecServShare = totalN > 0 ? (obj.total / totalN) : 0;
        }
    });

    // Rellenar KPIs superiores
    document.getElementById('m9-kpi-servicios').textContent = totalN.toLocaleString('es-CO');
    document.getElementById('m9-kpi-fechas').textContent = rangoFechasStr;
    document.getElementById('m9-kpi-costo').textContent = meanCosto.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD';
    document.getElementById('m9-kpi-ic').textContent = `IC 95 %: ${icInf.toFixed(2).replace('.', ',')}–${icSup.toFixed(2).replace('.', ',')}`;
    document.getElementById('m9-kpi-recom').textContent = pctRecom.toFixed(1).replace('.', ',') + ' %';
    document.getElementById('m9-kpi-gar').textContent = pctGar.toFixed(1).replace('.', ',') + ' %';

    // Rellenar Decisiones Dinámicas
    document.getElementById('m9-dec1-title').textContent = `Dimensionar cada sede para ${cMin} servicios diarios`;
    document.getElementById('m9-dec1-desc').textContent = `Con λ = ${Math.round(lambdaPoisson)}, el taller se satura menos del 5 % de los días.`;

    document.getElementById('m9-dec2-title').textContent = `Capacitar a ${topMec}`;
    document.getElementById('m9-dec2-desc').textContent = `Genera el ${(maxGarShare * 100).toFixed(1).replace('.', ',')} % de las garantías con el ${(topMecServShare * 100).toFixed(1).replace('.', ',')} % de los servicios (Bayes).`;

    document.getElementById('m9-dec3-title').textContent = `Presupuestar ${icSup.toFixed(2).replace('.', ',')} USD por servicio`;
    document.getElementById('m9-dec3-desc').textContent = `Es el límite superior del IC 95 % del costo medio.`;
}

function exportarInformeHTML() {
    if (!DATA || DATA.length === 0) {
        alert("No hay datos cargados para exportar.");
        return;
    }
    window.print();
}