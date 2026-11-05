async function renderFlightStats() {
  let totalFlightCost = 0;
  let totalMiles = 0;
  let totalFlightMinutes = 0;
  let airlineCounts = {};
  let airlineSpending = {};

  const activeStatsTrips = getFilteredTripsForStats();

  for (let t of activeStatsTrips) {
    for (let i of (t.items || [])) {
      if (i.type === 'flight') {
        // 1. Sumar costo total
        const cost = parseFloat(i.flightTotalCost) || 0;
        totalFlightCost += cost;

        // 2. Calcular tiempo total de vuelo en minutos
        if (i.timestamp && i.arrTimestamp && i.arrTimestamp > i.timestamp) {
          const diffMins = Math.floor((i.arrTimestamp - i.timestamp) / (1000 * 60));
          totalFlightMinutes += diffMins;
        }

        // 3. Extraer nombre de aerolínea
        let airlineName = 'Sin especificar';
        if (i.subtitle) {
          const match = i.subtitle.match(/\((.*?)\)/);
          airlineName = match ? match[1].trim() : i.subtitle.trim();
        }
        if (airlineName) {
          airlineCounts[airlineName] = (airlineCounts[airlineName] || 0) + 1;
          airlineSpending[airlineName] = (airlineSpending[airlineName] || 0) + cost;
        }

        // 4. Calcular millas voladas entre aeropuertos (IATA)
        const parts = i.title ? i.title.split('–') : [];
        if (parts.length === 2) {
          const origIata = parts[0].trim();
          const destIata = parts[1].trim();

          const apOrig = await fetchAirportFromWikidata(origIata);
          const apDest = await fetchAirportFromWikidata(destIata);

          if (apOrig && apDest && apOrig.lat && apDest.lat) {
            const distMiles = Math.round(turf.distance(
              turf.point([apOrig.lng, apOrig.lat]),
              turf.point([apDest.lng, apDest.lat]),
              { units: 'miles' }
            ));
            totalMiles += distMiles;
          }
        }
      }
    }
  }

  // Actualizar indicadores principales en pantalla
  const totalCostEl = document.getElementById('flight-stat-total-cost');
  const milesEl = document.getElementById('stat-miles');
  const hoursEl = document.getElementById('stat-hours');
  const cpmEl = document.getElementById('flight-stat-cost-per-mile');

  if (totalCostEl) totalCostEl.innerText = `$${totalFlightCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  if (milesEl) milesEl.innerText = `${totalMiles.toLocaleString()} mi`;
  
  const totalHours = (totalFlightMinutes / 60).toFixed(1);
  if (hoursEl) hoursEl.innerText = `${totalHours} h`;

  if (cpmEl) {
    const costPerMile = totalMiles > 0 ? (totalFlightCost / totalMiles).toFixed(2) : '0.00';
    cpmEl.innerText = `$${costPerMile}/mi`;
  }

  // Renderizar o actualizar gráfico Chart.js
  const canvas = document.getElementById('airlinesChart');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (airlinesChartObj) airlinesChartObj.destroy();

    const labels = Object.keys(airlineCounts);
    const dataValues = Object.values(airlineCounts);
    const backgroundColors = ['#0084ff', '#10b981', '#ffb703', '#ec4899', '#8b5cf6', '#3b82f6'];

    if (labels.length === 0) {
      labels.push('Sin vuelos');
      dataValues.push(1);
    }

    airlinesChartObj = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: backgroundColors.slice(0, labels.length)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { size: 10 } }
          }
        }
      }
    });
  }

  // Renderizar listado de gasto por aerolínea
  const spendingUl = document.getElementById('flight-top-airlines-spending');
  if (spendingUl) {
    const sortedSpending = Object.entries(airlineSpending).sort((a, b) => b[1] - a[1]);
    spendingUl.innerHTML = sortedSpending.length > 0
      ? sortedSpending.map(([name, spend]) => `
          <li class="top-list-item">
            <span>${name}</span>
            <span class="top-list-badge">$${spend.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </li>
        `).join('')
      : `<li class="top-list-item" style="color:#94a3b8;">Sin datos de gastos registrados</li>`;
  }
}
