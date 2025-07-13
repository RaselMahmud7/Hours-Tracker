// Filename: script.js
const { jsPDF } = window.jspdf;
const form = document.getElementById('entryForm');
const dateInput = document.getElementById('date');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const breakInput = document.getElementById('breakMinutes');
const locationInput = document.getElementById('location');
const errorDiv = document.getElementById('error');
const entriesTable = document.getElementById('entriesTable');
const entriesBody = document.getElementById('entriesBody');
const summaryContainer = document.getElementById('summaryContainer');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginForm = document.getElementById('loginForm');
const appSection = document.getElementById('appSection');
const userDisplay = document.getElementById('userDisplay');
const logoutBtn = document.getElementById('logoutBtn');

let currentUser = null;
let entries = [];

function hashPassword(password) {
  return btoa(password); // base64 encoding (not secure for production)
}

function getStorageKey() {
  return `workEntries_${currentUser}`;
}

function getUserCredentialsKey(username) {
  return `credentials_${username}`;
}

window.onload = () => {
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser) {
    currentUser = storedUser;
    entries = JSON.parse(localStorage.getItem(getStorageKey()) || '[]');
    showApp();
  }
};

function showApp() {
  loginForm.classList.add('hidden');
  appSection.classList.remove('hidden');
  userDisplay.textContent = currentUser;
  updateTable();
  updateSummaryAndHeader();
}

function saveEntries() {
  localStorage.setItem(getStorageKey(), JSON.stringify(entries));
}

function parseTime(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatHours(minutes) {
  return (minutes / 60).toFixed(2);
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getMonthName(monthIndex) {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return months[monthIndex] || "";
}

function updateTable() {
  entriesBody.innerHTML = '';
  entries.forEach((entry, index) => {
    const weekNum = getWeekNumber(new Date(entry.date));
    const tr = document.createElement('tr');
    tr.className = `border border-white/30 text-white ${index % 2 === 0 ? 'bg-white/10' : 'bg-white/5'}`;
    tr.innerHTML = `
      <td class="p-2 border border-white/30 text-center">${entry.date}</td>
      <td class="p-2 border border-white/30 text-center">${weekNum}</td>
      <td class="p-2 border border-white/30 text-center">${entry.startTime}</td>
      <td class="p-2 border border-white/30 text-center">${entry.endTime}</td>
      <td class="p-2 border border-white/30 text-center">${entry.breakMinutes}</td>
      <td class="p-2 border border-white/30 text-center">${entry.location || '-'}</td>
      <td class="p-2 border border-white/30 text-center">${formatHours(entry.totalMinutes)}</td>
      <td class="p-2 border border-white/30 text-center">
        <button class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded transition" data-index="${index}" aria-label="Delete Entry">Delete</button>
      </td>
    `;
    entriesBody.appendChild(tr);
  });

  const hasEntries = entries.length > 0;
  entriesTable.classList.toggle('hidden', !hasEntries);
  exportPdfBtn.classList.toggle('hidden', !hasEntries);

  document.querySelectorAll('button[data-index]').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-index'));
      entries.splice(idx, 1);
      saveEntries();
      updateTable();
      updateSummaryAndHeader();
    };
  });
}

// --- Only this part changed ---
function updateSummaryAndHeader() {
  const now = new Date();
  const weekNumber = getWeekNumber(now);
  const monthName = getMonthName(now.getMonth());

  if (entries.length === 0) {
    summaryContainer.textContent = `Week Number: ${weekNumber}\nMonth: ${monthName}\n\nNo entries yet.`;
    return;
  }

  const locationTotals = {};
  entries.forEach(e => {
    if (!locationTotals[e.location]) locationTotals[e.location] = 0;
    locationTotals[e.location] += e.totalMinutes;
  });

  // Calculate custom "month" from 15th to 14th
  let monthlyMinutes = 0;
  let startDate, endDate;

  if (now.getDate() >= 15) {
    // From 15th current month to 14th next month
    startDate = new Date(now.getFullYear(), now.getMonth(), 15);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 14, 23, 59, 59);
  } else {
    // From 15th previous month to 14th current month
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    endDate = new Date(now.getFullYear(), now.getMonth(), 14, 23, 59, 59);
  }

  entries.forEach(e => {
    const d = new Date(e.date);
    if (d >= startDate && d <= endDate) {
      monthlyMinutes += e.totalMinutes;
    }
  });

  let summaryText = `\nMonth: ${monthName}\n`;
  summaryText += `Total Hours per Location:\n`;
  for (const [loc, mins] of Object.entries(locationTotals)) {
    summaryText += ` - ${loc || '(No location)'}: ${formatHours(mins)} hrs\n`;
  }
  summaryText += `\nMonth Total (15th to 14th): ${formatHours(monthlyMinutes)} hrs`;

  summaryContainer.textContent = summaryText;
}
// ----------------------------

form.addEventListener('submit', (e) => {
  e.preventDefault();
  errorDiv.textContent = '';
  const date = dateInput.value;
  const start = startTimeInput.value;
  const end = endTimeInput.value;
  const breakMinutes = parseInt(breakInput.value, 10);
  const location = locationInput.value.trim();
  if (!date || !start || !end) {
    errorDiv.textContent = 'Please fill in date, start time, and end time.';
    return;
  }
  if (breakMinutes < 0) {
    errorDiv.textContent = 'Break minutes must be zero or positive.';
    return;
  }
  const startMins = parseTime(start);
  const endMins = parseTime(end);
  if (endMins <= startMins) {
    errorDiv.textContent = 'End time must be after start time.';
    return;
  }
  if (breakMinutes >= (endMins - startMins)) {
    errorDiv.textContent = 'Break must be less than total shift duration.';
    return;
  }
  const totalMinutes = endMins - startMins - breakMinutes;
  entries.push({ date, startTime: start, endTime: end, breakMinutes, location, totalMinutes });
  saveEntries();
  dateInput.value = '';
  startTimeInput.value = '';
  endTimeInput.value = '';
  breakInput.value = '30';
  locationInput.value = '';
  updateTable();
  updateSummaryAndHeader();
});

exportPdfBtn.onclick = () => {
  if (entries.length === 0) return;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Work Hours Report", 14, 20);
  const headers = [["Date", "Week", "Start Time", "End Time", "Break (min)", "Location", "Working Hours"]];
  const data = entries.map(e => [
    e.date,
    getWeekNumber(new Date(e.date)),
    e.startTime,
    e.endTime,
    e.breakMinutes.toString(),
    e.location || '-',
    formatHours(e.totalMinutes)
  ]);
  doc.autoTable({ head: headers, body: data, startY: 30 });

  const locationTotals = {};
  let grandTotal = 0;
  entries.forEach(e => {
    if (!locationTotals[e.location]) locationTotals[e.location] = 0;
    locationTotals[e.location] += e.totalMinutes;
    grandTotal += e.totalMinutes;
  });

  let summaryY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.text("Total Hours per Location:", 14, summaryY);
  summaryY += 6;
  Object.entries(locationTotals).forEach(([loc, mins]) => {
    doc.text(` - ${loc || '(No location)'}: ${formatHours(mins)} hrs`, 20, summaryY);
    summaryY += 6;
  });
  doc.text(`\nWorking Hours: ${formatHours(grandTotal)} hrs`, 14, summaryY + 4);

  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text("Copy@ M Rasel Mahmud", 14, doc.internal.pageSize.height - 10);
  doc.save(`work_hours_${Date.now()}.pdf`);
};

loginForm.onsubmit = (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!username || !password) return;

  const savedPassword = localStorage.getItem(getUserCredentialsKey(username));
  const hashedInput = hashPassword(password);

  if (savedPassword) {
    if (savedPassword !== hashedInput) {
      const reset = confirm("Incorrect password. Reset account?");
      if (reset) {
        localStorage.setItem(getUserCredentialsKey(username), hashedInput);
      } else {
        return;
      }
    }
  } else {
    localStorage.setItem(getUserCredentialsKey(username), hashedInput);
  }

  currentUser = username;
  localStorage.setItem('currentUser', currentUser);
  entries = JSON.parse(localStorage.getItem(getStorageKey()) || '[]');
  showApp();
};

logoutBtn.onclick = () => {
  localStorage.removeItem('currentUser');
  location.reload();
};
