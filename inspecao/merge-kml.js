const $ = (id) => document.getElementById(id);
const statusEl = $("status");

let mergedRows = [];
let kmlIndex = new Map();

function setStatus(msg) {
  statusEl.textContent = msg;
}

function normalizeKey(v) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function readXlsxWorkbook(file) {
  const ab = await file.arrayBuffer();
  return XLSX.read(ab, { type: "array" });
}

function sheetToRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Aba "${sheetName}" não encontrada no arquivo.`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

function colIndex(letter) {
  let n = 0;
  for (const ch of letter.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

async function readKmlIndex(file) {
  const fname = file.name.toLowerCase();
  let kmlText = "";

  if (fname.endsWith(".kmz")) {
    const ab = await file.arrayBuffer();
    const u8 = new Uint8Array(ab);
    const unzipped = window.fflate.unzipSync(u8);

    let kmlEntry = unzipped["doc.kml"];
    if (!kmlEntry) {
      const key = Object.keys(unzipped).find(k => k.endsWith(".kml"));
      kmlEntry = unzipped[key];
    }

    kmlText = new TextDecoder().decode(kmlEntry);
  } else {
    kmlText = await file.text();
  }

  const doc = new DOMParser().parseFromString(kmlText, "text/xml");
  const placemarks = [...doc.getElementsByTagName("Placemark")];

  const idx = new Map();

  for (const pm of placemarks) {
    const name = pm.getElementsByTagName("name")[0]?.textContent ?? "";
    const coords = pm.getElementsByTagName("coordinates")[0]?.textContent ?? "";
    const first = coords.trim().split(/\s+/)[0] || "";
    const [lon, lat] = first.split(",").map(Number);

    const key = normalizeKey(name);
    if (!key || !lat || !lon) continue;

    if (!idx.has(key)) idx.set(key, { lat, lon });
  }

  return idx;
}

function buildFromInspecao(rows) {
  const iE  = colIndex("E");   // Instalacao_nova
  const iH  = colIndex("H");   // Número OT
  const iAP = colIndex("AP");  // DISPOSITIVO_PROTECAO

  return rows.slice(1).map(row => {
    const dispProt = String(row[iAP] ?? "").trim(); // DISPOSITIVO_PROTECAO (AP)
    const inst     = String(row[iE]  ?? "").trim(); // Instalacao_nova (E) => na prática é o alimentador/instalação
    const ot       = String(row[iH]  ?? "").trim();

    const key = normalizeKey(dispProt);             // diff por DISPOSITIVO_PROTECAO
    if (!key) return null;

    return {
      key,
      TIPO: "INSPECAO",
      DISPOSITIVO_PROTECAO: dispProt,
      INSTALACAO_NOVA: inst,
      NUMERO_OT: ot,
      ALIMENTADOR: "" // inspeção não traz coluna de alimentador
    };
  }).filter(Boolean);
}

function buildFromReiteradas(rows) {
  const iA = colIndex("A");
  const iC = colIndex("C");

  return rows.slice(1).map(row => {
    const disp = String(row[iA] ?? "").trim(); // Elemento
    return {
      key: normalizeKey(disp),
      TIPO: "REITERADA",
      DISPOSITIVO_PROTECAO: disp,  // reaproveita campo para mostrar no popup
      INSTALACAO_NOVA: "",
      NUMERO_OT: "",
      ALIMENTADOR: String(row[iC] ?? "").trim()
    };
  }).filter(r => r.key);
}

function mergeAndDiff(ins, rei) {
  const setIns = new Set(ins.map(x => x.key));
  const setRei = new Set(rei.map(x => x.key));
  const intersection = new Set([...setIns].filter(k => setRei.has(k)));

  return [
    ...rei.filter(x => !intersection.has(x.key)),
    ...ins.filter(x => !intersection.has(x.key))
  ];
}

function escapeXml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildKml(rows, idx) {
  const CATEGORY_BY_ALIM = {
    // CANINDÉ
    CND01C1:"Canindé", CND01C2:"Canindé", CND01C3:"Canindé", CND01C4:"Canindé", CND01C5:"Canindé", CND01C6:"Canindé",
    INP01N3:"Canindé", INP01N4:"Canindé", INP01N5:"Canindé",
    BVG01P1:"Canindé", BVG01P2:"Canindé", BVG01P3:"Canindé", BVG01P4:"Canindé",
    MCA01L1:"Canindé", MCA01L2:"Canindé", MCA01L3:"Canindé",

    // QUIXADÁ
    BNB01Y2:"Quixadá",
    JTM01N2:"Quixadá",
    QXD01P1:"Quixadá", QXD01P2:"Quixadá", QXD01P3:"Quixadá", QXD01P4:"Quixadá", QXD01P5:"Quixadá", QXD01P6:"Quixadá",
    QXB01N2:"Quixadá", QXB01N3:"Quixadá", QXB01N4:"Quixadá", QXB01N5:"Quixadá", QXB01N6:"Quixadá", QXB01N7:"Quixadá",

    // NOVA RUSSAS
    IPU01L2:"Nova Russas", IPU01L3:"Nova Russas", IPU01L4:"Nova Russas", IPU01L5:"Nova Russas",
    ARR01L1:"Nova Russas", ARR01L2:"Nova Russas", ARR01L3:"Nova Russas",
    SQT01F2:"Nova Russas", SQT01F3:"Nova Russas", SQT01F4:"Nova Russas",
    ARU01Y1:"Nova Russas", ARU01Y2:"Nova Russas", ARU01Y4:"Nova Russas", ARU01Y5:"Nova Russas",
    ARU01Y6:"Nova Russas", ARU01Y7:"Nova Russas", ARU01Y8:"Nova Russas",
    NVR01N1:"Nova Russas", NVR01N2:"Nova Russas", NVR01N3:"Nova Russas", NVR01N5:"Nova Russas",
    MTB01S2:"Nova Russas", MTB01S3:"Nova Russas", MTB01S4:"Nova Russas",

    // CRATEÚS
    IDP01I1:"Crateús", IDP01I2:"Crateús", IDP01I3:"Crateús", IDP01I4:"Crateús",
    CAT01C1:"Crateús", CAT01C2:"Crateús", CAT01C3:"Crateús", CAT01C4:"Crateús",
    CAT01C5:"Crateús", CAT01C6:"Crateús", CAT01C7:"Crateús"
  };

  // ---- Coordenada: tenta por DISPOSITIVO_PROTECAO, depois INSTALACAO_NOVA, depois ALIMENTADOR
  function findGeoForRow(r) {
    const k1 = normalizeKey(r.DISPOSITIVO_PROTECAO || "");
    const k2 = normalizeKey(r.INSTALACAO_NOVA || "");
    const k3 = normalizeKey(r.ALIMENTADOR || "");
    return idx.get(k1) || idx.get(k2) || idx.get(k3) || null;
  }

  // ---- Categoria: usa ALIMENTADOR; se vazio, usa INSTALACAO_NOVA (porque é onde vem CND01C4 etc)
  function detectCategory(row) {
    const alimRef = String(row.ALIMENTADOR || row.INSTALACAO_NOVA || "").toUpperCase().trim();
    if (alimRef && CATEGORY_BY_ALIM[alimRef]) return CATEGORY_BY_ALIM[alimRef];

    const prefix = String(alimRef || row.DISPOSITIVO_PROTECAO || "").toUpperCase().substring(0,3);

    const prefixMap = {
      CND:"Canindé", INP:"Canindé", BVG:"Canindé", MCA:"Canindé",
      BNB:"Quixadá", JTM:"Quixadá", QXD:"Quixadá", QXB:"Quixadá",
      IPU:"Nova Russas", ARR:"Nova Russas", SQT:"Nova Russas",
      ARU:"Nova Russas", NVR:"Nova Russas", MTB:"Nova Russas",
      IDP:"Crateús", CAT:"Crateús"
    };

    return prefixMap[prefix] || "Outros";
  }

  const groups = {};
  const notFoundRows = [];

  const PUSH_PIN = "http://maps.google.com/mapfiles/kml/pushpin/wht-pushpin.png";

  for (const r of rows) {
    const geo = findGeoForRow(r);
    if (!geo) {
      notFoundRows.push({
        TIPO: r.TIPO,
        DISPOSITIVO_PROTECAO: r.DISPOSITIVO_PROTECAO,
        INSTALACAO_NOVA: r.INSTALACAO_NOVA,
        ALIMENTADOR: r.ALIMENTADOR,
        NUMERO_OT: r.NUMERO_OT
      });
      continue;
    }

    const cat = detectCategory(r);
    if (!groups[cat]) groups[cat] = { INSPEÇÃO:[], REITERADA:[] };

    const tipo = r.TIPO === "INSPECAO" ? "INSPEÇÃO" : "REITERADA";
    const color = tipo === "INSPEÇÃO" ? "ff800080" : "ffffffff";

    const nomePino = String(r.DISPOSITIVO_PROTECAO || "").trim(); // ✅ SEMPRE DISPOSITIVO_PROTECAO
    const alimRef = String(r.ALIMENTADOR || r.INSTALACAO_NOVA || "").trim();

    groups[cat][tipo].push(`
<Placemark>
  <name>${escapeXml(nomePino)}</name>
  <Style>
    <IconStyle>
      <color>${color}</color>
      <scale>1.8</scale>
      <Icon><href>${PUSH_PIN}</href></Icon>
    </IconStyle>
  </Style>
  <description><![CDATA[
    <b>CATEGORIA:</b> ${escapeXml(cat)}<br/>
    <b>TIPO:</b> ${escapeXml(tipo)}<br/>
    <b>DISPOSITIVO_PROTECAO / ELEMENTO:</b> ${escapeXml(nomePino)}<br/>
    <b>OT:</b> ${escapeXml(r.NUMERO_OT || "-")}<br/>
    <b>ALIMENTADOR (ref):</b> ${escapeXml(alimRef || "-")}<br/>
    <b>INSTALACAO_NOVA:</b> ${escapeXml(r.INSTALACAO_NOVA || "-")}<br/>
  ]]></description>
  <Point><coordinates>${geo.lon},${geo.lat},0</coordinates></Point>
</Placemark>
`);
  }

  const ordered = ["Canindé","Nova Russas","Quixadá","Crateús","Outros"];

  const folders = ordered
    .filter(c => groups[c])
    .map(c => `
<Folder>
  <name>${escapeXml(c)}</name>

  <Folder>
    <name>🟣 INSPEÇÃO</name>
    ${groups[c]["INSPEÇÃO"].join("\n")}
  </Folder>

  <Folder>
    <name>⚪ REITERADA</name>
    ${groups[c]["REITERADA"].join("\n")}
  </Folder>

</Folder>`).join("\n");

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Resultado - Reiteradas x Inspeção</name>
${folders}
</Document>
</kml>`;

  return { kml, missing: notFoundRows.length, notFoundRows };
}

function download(data, filename, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* function downloadXlsxNotFound(rows, filename) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "NAO_ENCONTRADOS");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
} */

$("btnGerarPlanilha").addEventListener("click", async () => {
  const fIns = $("fileInspecao").files[0];
  const fRei = $("fileReiteradas").files[0];

  if (!fIns || !fRei) {
    setStatus("Envie as duas planilhas.");
    return;
  }

  setStatus("Processando planilhas...");

  const wbIns = await readXlsxWorkbook(fIns);
  const insRows = sheetToRows(wbIns, "PBM-CE - Inspecao");
  const ins = buildFromInspecao(insRows);

  const wbRei = await readXlsxWorkbook(fRei);
  const reiRows = sheetToRows(wbRei, wbRei.SheetNames[0]);
  const rei = buildFromReiteradas(reiRows);

  mergedRows = mergeAndDiff(ins, rei);

  // Planilha resultado: mostra claramente os campos
  const exportRows = mergedRows.map(r => ({
    TIPO: r.TIPO,
    DISPOSITIVO_PROTECAO: r.DISPOSITIVO_PROTECAO,
    ALIMENTADOR: r.ALIMENTADOR,
    INSTALACAO_NOVA: r.INSTALACAO_NOVA,
    NUMERO_OT: r.NUMERO_OT
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "RESULTADO");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  download(buf, "resultado.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  $("btnGerarKml").disabled = false;
  setStatus("Planilha gerada com sucesso.");
});

$("btnGerarKml").addEventListener("click", async () => {
  const fKml = $("fileKmlGeral").files[0];
  if (!fKml) {
    setStatus("Envie o KML/KMZ geral.");
    return;
  }

  if (!mergedRows?.length) {
    setStatus("Gere a planilha primeiro.");
    return;
  }

  setStatus("Gerando KML final...");

  const idx = await readKmlIndex(fKml);
  const { kml, missing } = buildKml(mergedRows, idx);

  download(kml, "resultado_google_earth.kml", "application/vnd.google-earth.kml+xml");
  
  setStatus(
    `KML gerado com sucesso.\n` +
    `Sem coordenadas encontradas: ${missing}`
  );
  
});
