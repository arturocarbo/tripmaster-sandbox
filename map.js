let leafletMap = null;
let leafletMarkersGroup = null;
let leafletPolylineGroup = null;

const AIRPORT_COORDS = {
  "SAL": { lat: 13.4409, lng: -89.0557, name: "El Salvador Int. Airport (SAL)", city: "San Salvador", country: "El Salvador" },
  "SJO": { lat: 9.9939, lng: -84.2088, name: "Juan Santamaría Int. Airport (SJO)", city: "San José", country: "Costa Rica" },
  "GYE": { lat: -2.1574, lng: -79.8836, name: "José Joaquín de Olmedo Int. Airport (GYE)", city: "Guayaquil", country: "Ecuador" },
  "UIO": { lat: -0.1292, lng: -78.3575, name: "Mariscal Sucre Int. Airport (UIO)", city: "Quito", country: "Ecuador" },
  "MIA": { lat: 25.7959, lng: -80.2870, name: "Miami International Airport (MIA)", city: "Miami", country: "Estados Unidos" },
  "JFK": { lat: 40.6413, lng: -73.7781, name: "John F. Kennedy Int. Airport (JFK)", city: "Nueva York", country: "Estados Unidos" },
  "EZE": { lat: -34.8222, lng: -58.5358, name: "Ministro Pistarini Int. Airport (EZE)", city: "Buenos Aires", country: "Argentina" },
  "MAD": { lat: 40.4839, lng: -3.5679, name: "Adolfo Suárez Madrid-Barajas (MAD)", city: "Madrid", country: "España" },
  "BOG": { lat: 4.7016, lng: -74.1469, name: "El Dorado Int. Airport (BOG)", city: "Bogotá", country: "Colombia" },
  "PTY": { lat: 9.0714, lng: -79.3835, name: "Tocumen Int. Airport (PTY)", city: "Panamá", country: "Panamá" }
};

function initOrUpdateLeafletMap() {
  const mapContainer = document.getElementById('leafletMap');
  if (!mapContainer) return;

  if (!leafletMap) {
    leafletMap = L.map('leafletMap', {
      zoomControl: true,
      attributionControl: false
    }).setView([13.4409, -89.0557], 3);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(leafletMap);

    leafletMarkersGroup = L.layerGroup().addTo(leafletMap);
    leafletPolylineGroup = L.layerGroup().addTo(leafletMap);
  }

  leafletMarkersGroup.clearLayers();
  leafletPolylineGroup.clearLayers();

  const flights = getAllAirFlights();
  const airportsCount = {};
  const airlinesCount = {};
  let totalDistanceMiles = 0;
  const boundsCoords = [];

  flights.forEach(fl => {
    const origKey = (fl.origin || '').trim().toUpperCase();
    const destKey = (fl.dest || '').trim().toUpperCase();

    if (origKey) airportsCount[origKey] = (airportsCount[origKey] || 0) + 1;
    if (destKey) airportsCount[destKey] = (airportsCount[destKey] || 0) + 1;
    if (fl.airline) airlinesCount[fl.airline] = (airlinesCount[fl.airline] || 0) + 1;

    const origCoords = AIRPORT_COORDS[origKey];
    const destCoords = AIRPORT_COORDS[destKey];

    if (origCoords && destCoords) {
      boundsCoords.push([origCoords.lat, origCoords.lng]);
      boundsCoords.push([destCoords.lat, destCoords.lng]);

      const fromPt = turf.point([origCoords.lng, origCoords.lat]);
      const toPt = turf.point([destCoords.lng, destCoords.lat]);
      const distMi = turf.distance(fromPt, toPt, { units: 'miles' });
      totalDistanceMiles += distMi;

      const greatCircle = turf.greatCircle(fromPt, toPt, { npoints: 50 });
      const pathCoords = greatCircle.geometry.coordinates.map(c => [c[1], c[0]]);

      L.polyline(pathCoords, {
        color: '#0084ff',
        weight: 2,
        opacity: 0.8,
        dashArray: '4, 6'
      }).addTo(leafletPolylineGroup);
    }
  });

  Object.keys(airportsCount).forEach(code => {
    const data = AIRPORT_COORDS[code];
    if (data) {
      const customMarker = L.divIcon({
        className: 'custom-leaflet-pin',
        html: `<div style="background:#0084ff; color:#fff; font-size:10px; font-weight:800; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border:2px solid #fff; box-shadow:0 0 8px rgba(0,132,255,0.8);">${code}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      L.marker([data.lat, data.lng], { icon: customMarker })
        .bindPopup(`<strong style="color:#0f172a;">${data.name}</strong><br><small>${data.city}, ${data.country}</small>`)
        .addTo(leafletMarkersGroup);
    }
  });

  if (boundsCoords.length > 0) {
    leafletMap.fitBounds(boundsCoords, { padding: [30, 30] });
  }

  const distEl = document.getElementById('map-total-distance');
  const countEl = document.getElementById('map-total-flights');
  if (distEl) distEl.textContent = Math.round(totalDistanceMiles).toLocaleString() + ' mi';
  if (countEl) countEl.textContent = flights.length;

  renderTopList('map-top-airports', airportsCount, 'aeropuerto');
  renderTopList('map-top-airlines', airlinesCount, 'vuelo');

  setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 300);
}

function renderTopList(containerId, countObj, labelSingular) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const sorted = Object.entries(countObj).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (sorted.length === 0) {
    container.innerHTML = '<li class="top-list-item" style="color:#94a3b8;">Sin datos registrados</li>';
    return;
  }

  container.innerHTML = sorted.map(([key, val]) => `
    <li class="top-list-item">
      <span><strong>${key}</strong></span>
      <span class="top-list-badge">${val} ${labelSingular}${val > 1 ? 's' : ''}</span>
    </li>
  `).join('');
}

async function searchAirportGuide() {
  const input = document.getElementById('airport-search-input');
  const container = document.getElementById('airports-guide-container');
  if (!input || !container) return;

  const code = input.value.trim().toUpperCase();
  if (!code) return;

  container.innerHTML = '<div style="color:#38bdf8; text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Consultando datos de Wikidata...</div>';

  const airport = AIRPORT_COORDS[code];
  const query = `
    SELECT ?item ?itemLabel ?elevation ?website WHERE {
      ?item wdt:P238 "${code}".
      OPTIONAL { ?item wdt:P2044 ?elevation. }
      OPTIONAL { ?item wdt:P856 ?website. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
    } LIMIT 1
  `;

  try {
    const resp = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, {
      headers: { 'Accept': 'application/json' }
    });
    const data = await resp.json();
    const results = data.results.bindings;

    let elevationText = 'No disponible';
    let websiteUrl = null;
    let title = airport ? airport.name : `Aeropuerto ${code}`;

    if (results.length > 0) {
      if (results[0].itemLabel) title = results[0].itemLabel.value;
      if (results[0].elevation) elevationText = Math.round(results[0].elevation.value) + ' m sobre el nivel del mar';
      if (results[0].website) websiteUrl = results[0].website.value;
    }

    container.innerHTML = `
      <div class="dark-card" style="border: 1px solid var(--primary);">
        <div style="font-size: 1.1rem; font-weight: 800; color: #fff; margin-bottom: 4px;">
          <i class="fa-solid fa-building-airport" style="color:#0084ff;"></i> ${title} (${code})
        </div>
        <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 10px;">
          ${airport ? `${airport.city}, ${airport.country}` : 'Información enciclopédica obtenida de Wikidata'}
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; font-size:0.78rem;">
          <div><strong>Elevación:</strong> ${elevationText}</div>
          <div><strong>Coordenadas:</strong> ${airport ? `${airport.lat}, ${airport.lng}` : 'Consultadas vía IATA'}</div>
          ${websiteUrl ? `<div><strong>Sitio Web Oficial:</strong> <a href="${websiteUrl}" target="_blank" style="color:#38bdf8; text-decoration:underline;">Visitar portal</a></div>` : ''}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; text-align:center; padding:10px;">Error al conectar con Wikidata.</div>`;
  }
}