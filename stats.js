let airlinesChartInstance = null;

function populateYearSelects() {
  const tripSelect = document.getElementById('trip-year-select');
  const statsSelect = document.getElementById('stats-year-select');

  const years = new Set();
  tripsData.forEach(t => {
    if (t.startDate) years.add(new Date(t.startDate).getFullYear());
  });

  const sortedYears = Array.from(years).sort((a, b) => b - a);

  if (tripSelect) {
    const currentVal = tripSelect.value;
    tripSelect.innerHTML = '<option value="all">📅 Año: Todos</option>' + 
      sortedYears.map(y => `<option value="${y}">📅 Año: ${y}</option>`).join('');
    tripSelect.value = currentVal;
  }

  if (statsSelect) {
    const currentVal = statsSelect.value;
    statsSelect.innerHTML = '<option value="all">Todos</option>' + 
      sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
    statsSelect.value = currentVal;
  }
}

function renderSelectedCategoryStats() {
  const cat = document.getElementById('stats-category-select')?.value || 'trips';
  const yearFilter = document.getElementById('stats-year-select')?.value || 'all';

  document.getElementById('stats-panel-trips').style.display = (cat === 'trips') ? 'block' : 'none';
  document.getElementById('stats-panel-flights').style.display = (cat === 'flights') ? 'block' : 'none';
  document.getElementById('stats-panel-hotels').style.display = (cat === 'hotels') ? 'block' : 'none';

  if (cat === 'trips') renderTripStats(yearFilter);
  if (cat === 'flights') renderFlightStats(yearFilter);
  if (cat === 'hotels') renderHotelStats(yearFilter);
}

function renderTripStats(yearFilter) {
  let filtered = tripsData;
  if (yearFilter !== 'all') {
    filtered = tripsData.filter(t => t.startDate && new Date(t.startDate).getFullYear().toString() === yearFilter);
  }

  let totalDays = 0;
  let totalExpenses = 0;
  const countryCounts = {};

  filtered.forEach(t => {
    if (t.startDate && t.endDate) {
      const d1 = new Date(t.startDate);
      const d2 = new Date(t.endDate);
      const diff = Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
      totalDays += diff;
    }

    if (t.items) {
      t.items.forEach(it => {
        if (it.cost) totalExpenses += parseFloat(it.cost);
      });
    }

    if (t.destination) {
      const parts = t.destination.split(',');
      const country = parts[parts.length - 1].trim();
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    }
  });

  const count = filtered.length;
  const avgDays = count > 0 ? (totalDays / count).toFixed(1) : 0;

  document.getElementById('trip-stat-days').textContent = totalDays;
  document.getElementById('trip-stat-expenses').textContent = '$' + totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 });
  document.getElementById('trip-stat-count').textContent = count;
  document.getElementById('trip-stat-avg-days').textContent = avgDays + ' días';

  renderTopList('trip-top-countries', countryCounts, 'viaje');
}

function renderFlightStats(yearFilter) {
  let flights = getAllAirFlights();
  if (yearFilter !== 'all') {
    flights = flights.filter(f => f.depTime && new Date(f.depTime).getFullYear().toString() === yearFilter);
  }

  let totalCost = 0;
  let totalFare = 0;
  let totalMiles = 0;
  let totalMinutes = 0;
  const airlineSpending = {};
  const airlineCounts = {};

  flights.forEach(fl => {
    const c = parseFloat(fl.totalCost || 0);
    const f = parseFloat(fl.fareCost || 0);
    totalCost += c;
    totalFare += f;

    const al = fl.airline || 'Otra';
    airlineSpending[al] = (airlineSpending[al] || 0) + c;
    airlineCounts[al] = (airlineCounts[al] || 0) + 1;

    const orig = AIRPORT_COORDS[(fl.origin || '').toUpperCase()];
    const dest = AIRPORT_COORDS[(fl.dest || '').toUpperCase()];
    if (orig && dest) {
      const dist = turf.distance(turf.point([orig.lng, orig.lat]), turf.point([dest.lng, dest.lat]), { units: 'miles' });
      totalMiles += dist;
    }

    if (fl.depTime && fl.arrTime) {
      const m = (new Date(fl.arrTime) - new Date(fl.depTime)) / (1000 * 60);
      if (m > 0) totalMinutes += m;
    }
  });

  const totalTaxes = totalCost - totalFare;
  const avgCost = flights.length > 0 ? (totalCost / flights.length) : 0;
  const costPerMile = totalMiles > 0 ? (totalCost / totalMiles) : 0;

  document.getElementById('flight-stat-total-cost').textContent = '$' + totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 });
  document.getElementById('flight-stat-fare-taxes').textContent = `$${Math.round(totalFare)} / $${Math.round(totalTaxes)}`;
  document.getElementById('stat-miles').textContent = Math.round(totalMiles).toLocaleString();
  document.getElementById('stat-hours').textContent = Math.round(totalMinutes / 60) + ' h';
  document.getElementById('flight-stat-avg-cost').textContent = '$' + avgCost.toFixed(2);
  document.getElementById('flight-stat-cost-per-mile').textContent = '$' + costPerMile.toFixed(2);

  renderTopList('flight-top-airlines-spending', airlineSpending, 'USD');
  renderAirlinesChart(airlineCounts);
}

function renderHotelStats(yearFilter) {
  let hotels = [];
  tripsData.forEach(t => {
    if (t.items) {
      t.items.filter(i => i.type === 'hotel').forEach(h => {
        if (yearFilter === 'all' || (h.checkin && new Date(h.checkin).getFullYear().toString() === yearFilter)) {
          hotels.push(h);
        }
      });
    }
  });

  let totalNights = 0;
  let totalCost = 0;
  const brandCounts = {};

  hotels.forEach(h => {
    const cost = parseFloat(h.cost || 0);
    totalCost += cost;

    if (h.checkin && h.checkout) {
      const n = Math.max(1, Math.ceil((new Date(h.checkout) - new Date(h.checkin)) / (1000 * 60 * 60 * 24)));
      totalNights += n;
    }

    const brand = h.title || 'Hotel Independiente';
    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
  });

  const avgNight = totalNights > 0 ? (totalCost / totalNights) : 0;

  document.getElementById('hotel-stat-nights').textContent = totalNights;
  document.getElementById('hotel-stat-cost').textContent = '$' + totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 });
  document.getElementById('hotel-stat-avg-night').textContent = '$' + avgNight.toFixed(2);

  renderTopList('hotel-top-brands', brandCounts, 'estadía');
}

function renderAirlinesChart(airlineCounts) {
  const ctx = document.getElementById('airlinesChart')?.getContext('2d');
  if (!ctx) return;

  if (airlinesChartInstance) airlinesChartInstance.destroy();

  const labels = Object.keys(airlineCounts);
  const data = Object.values(airlineCounts);

  airlinesChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#0084ff', '#10b981', '#ffb703', '#ec4899', '#8b5cf6', '#64748b']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#fff', font: { size: 10 } } }
      }
    }
  });
}