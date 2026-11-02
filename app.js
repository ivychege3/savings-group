// All data stored in the browser
let members      = JSON.parse(localStorage.getItem('savings_members') || '[]');
let transactions = JSON.parse(localStorage.getItem('savings_tx')      || '[]');

function saveData() {
  localStorage.setItem('savings_members', JSON.stringify(members));
  localStorage.setItem('savings_tx',      JSON.stringify(transactions));
}

function formatMoney(amount) {
  return 'KES ' + Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function todayDate() {
  return new Date().toLocaleDateString('en-KE');
}

function showMsg(elementId, text, type) {
  const el = document.getElementById(elementId);
  el.textContent = text;
  el.className = 'form-msg ' + type;
  setTimeout(() => { el.textContent = ''; }, 4000);
}

// TAB SWITCHING
function showTab(tabName) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.getAttribute('onclick') === "showTab('" + tabName + "')") btn.classList.add('active');
  });
  if (tabName === 'dashboard') renderDashboard();
  if (tabName === 'members')   renderMembersTable();
  if (tabName === 'record')    refreshMemberDropdown();
  if (tabName === 'history')   renderHistory();
}

// DASHBOARD
function renderDashboard() {
  const totalContributions = members.reduce((s, m) => s + m.contributions, 0);
  const totalDebts         = members.reduce((s, m) => s + m.debt, 0);
  document.getElementById('stat-members').textContent       = members.length;
  document.getElementById('stat-contributions').textContent = formatMoney(totalContributions);
  document.getElementById('stat-debts').textContent         = formatMoney(totalDebts);
  document.getElementById('stat-balance').textContent       = formatMoney(totalContributions - totalDebts);

  const tbody = document.getElementById('dashboard-tbody');
  if (!members.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No members added yet.</td></tr>'; return; }
  tbody.innerHTML = members.map(m => {
    const net = m.contributions - m.debt;
    return `<tr>
      <td><strong>${m.name}</strong></td>
      <td class="amount-green">${formatMoney(m.contributions)}</td>
      <td class="amount-red">${formatMoney(m.debt)}</td>
      <td class="${net >= 0 ? 'amount-green' : 'amount-red'}">${formatMoney(net)}</td>
      <td>${getStatusBadge(m.debt, m.contributions)}</td>
    </tr>`;
  }).join('');
}

function getStatusBadge(debt, contributions) {
  if (debt === 0) return '<span class="badge badge-clear">Clear</span>';
  if (debt < contributions) return '<span class="badge badge-partial">Partial Debt</span>';
  return '<span class="badge badge-debt">In Debt</span>';
}

// ADD MEMBER
function addMember() {
  const name    = document.getElementById('memberName').value.trim();
  const phone   = document.getElementById('memberPhone').value.trim();
  const contrib = parseFloat(document.getElementById('memberContrib').value) || 0;
  const debt    = parseFloat(document.getElementById('memberDebt').value)    || 0;

  if (!name) { showMsg('member-msg', 'Please enter the member\'s full name.', 'error'); return; }
  if (members.some(m => m.name.toLowerCase() === name.toLowerCase())) {
    showMsg('member-msg', 'A member with that name already exists.', 'error'); return;
  }

  members.push({ id: Date.now(), name, phone, contributions: contrib, debt, dateAdded: todayDate() });
  saveData();
  document.getElementById('memberName').value    = '';
  document.getElementById('memberPhone').value   = '';
  document.getElementById('memberContrib').value = '';
  document.getElementById('memberDebt').value    = '';
  showMsg('member-msg', name + ' has been added!', 'success');
  renderMembersTable();
}

function renderMembersTable() {
  const tbody = document.getElementById('members-tbody');
  if (!members.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No members yet.</td></tr>'; return; }
  tbody.innerHTML = members.map((m, i) => `
    <tr>
      <td><strong>${m.name}</strong></td>
      <td>${m.phone || '—'}</td>
      <td class="amount-green">${formatMoney(m.contributions)}</td>
      <td class="amount-red">${formatMoney(m.debt)}</td>
      <td>${getStatusBadge(m.debt, m.contributions)}</td>
      <td><button class="btn btn-danger" onclick="removeMember(${i})">Remove</button></td>
    </tr>`).join('');
}

function removeMember(index) {
  if (!confirm('Remove ' + members[index].name + '? This cannot be undone.')) return;
  members.splice(index, 1);
  saveData();
  renderMembersTable();
}

// RECORD ENTRY
function refreshMemberDropdown() {
  const select = document.getElementById('txMember');
  select.innerHTML = '<option value="">-- Choose member --</option>';
  members.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = m.name;
    select.appendChild(opt);
  });
}

function recordEntry() {
  const idx    = document.getElementById('txMember').value;
  const type   = document.getElementById('txType').value;
  const amount = parseFloat(document.getElementById('txAmount').value);
  const note   = document.getElementById('txNote').value.trim();

  if (idx === '')        { showMsg('record-msg', 'Please select a member.', 'error'); return; }
  if (!amount || amount <= 0) { showMsg('record-msg', 'Please enter a valid amount.', 'error'); return; }

  const m = members[idx];
  if (type === 'contribution') m.contributions += amount;
  else if (type === 'debt')    m.debt += amount;
  else if (type === 'debt_paid') m.debt = Math.max(0, m.debt - amount);

  transactions.unshift({ id: Date.now(), memberName: m.name, type, amount, note, date: todayDate() });
  if (transactions.length > 500) transactions = transactions.slice(0, 500);
  saveData();

  document.getElementById('txMember').value = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('txNote').value   = '';
  showMsg('record-msg', 'Entry saved for ' + m.name + '!', 'success');
}

// HISTORY
const typeLabels = { contribution: 'Contribution', debt: 'Debt Added', debt_paid: 'Debt Repaid' };

function renderHistory() {
  const tbody = document.getElementById('history-tbody');
  if (!transactions.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No transactions yet.</td></tr>'; return; }
  tbody.innerHTML = transactions.map(tx => {
    const pos = tx.type === 'contribution' || tx.type === 'debt_paid';
    return `<tr>
      <td>${tx.date}</td>
      <td><strong>${tx.memberName}</strong></td>
      <td>${typeLabels[tx.type] || tx.type}</td>
      <td class="${pos ? 'amount-green' : 'amount-red'}">${pos ? '+' : '-'}${formatMoney(tx.amount)}</td>
      <td>${tx.note || '—'}</td>
    </tr>`;
  }).join('');
}

// Start the app
renderDashboard();
  