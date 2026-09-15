/**
 * Navodaya Open 2026 - Admin Portal Client Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Storage Key Name
  const STORAGE_ADMIN_KEY = 'navodaya_admin_key';
  
  // State
  let currentAdminKey = localStorage.getItem(STORAGE_ADMIN_KEY) || sessionStorage.getItem(STORAGE_ADMIN_KEY) || '';
  let allRegistrations = [];
  let tournamentConfig = { categories: [], levels: [], categoryLevelMap: {} };
  let pendingDeleteId = null;

  // DOM Elements
  const authModal = document.getElementById('auth-modal');
  const authForm = document.getElementById('auth-form');
  const adminKeyInput = document.getElementById('admin-key-input');
  const togglePasswordBtn = document.getElementById('toggle-password-btn');
  const authErrorMsg = document.getElementById('auth-error-msg');
  
  const dashboardApp = document.getElementById('dashboard-app');
  const refreshBtn = document.getElementById('refresh-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const logoutBtn = document.getElementById('logout-btn');

  // Stats Elements
  const statTotalRegs = document.getElementById('stat-total-regs');
  const statTotalPlayers = document.getElementById('stat-total-players');
  const statDoublesCount = document.getElementById('stat-doubles-count');
  const statSinglesCount = document.getElementById('stat-singles-count');
  const categoryBadgesContainer = document.getElementById('category-badges-container');

  // Search and Filter Elements
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const filterCategory = document.getElementById('filter-category');
  const filterFlight = document.getElementById('filter-flight');
  const registrationsTbody = document.getElementById('registrations-tbody');
  const tableSubtitle = document.getElementById('table-subtitle');

  // Edit Modal Elements
  const editModal = document.getElementById('edit-modal');
  const editForm = document.getElementById('edit-form');
  const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');
  const editRegId = document.getElementById('edit-reg-id');
  const editCategory = document.getElementById('edit-category');
  const editFlight = document.getElementById('edit-flight');

  // Delete Modal Elements
  const deleteModal = document.getElementById('delete-modal');
  const deleteTargetInfo = document.getElementById('delete-target-info');
  const closeDeleteModalBtn = document.getElementById('close-delete-modal-btn');
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

  // 1. Initial Authentication Check
  if (currentAdminKey) {
    verifyKeyAndInitialize(currentAdminKey);
  } else {
    showAuthModal();
  }

  // Toggle Password Visibility
  togglePasswordBtn.addEventListener('click', () => {
    const isPass = adminKeyInput.type === 'password';
    adminKeyInput.type = isPass ? 'text' : 'password';
    togglePasswordBtn.innerHTML = isPass ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
  });

  // Auth Form Submit
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const keyVal = adminKeyInput.value.trim();
    if (!keyVal) return;
    await verifyKeyAndInitialize(keyVal);
  });

  // Logout Handler
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_ADMIN_KEY);
    sessionStorage.removeItem(STORAGE_ADMIN_KEY);
    currentAdminKey = '';
    showAuthModal();
    showToast('Logged out successfully', 'success');
  });

  // Refresh Button
  refreshBtn.addEventListener('click', () => {
    refreshBtn.querySelector('i').classList.add('fa-spin');
    loadDashboardData().finally(() => {
      setTimeout(() => refreshBtn.querySelector('i').classList.remove('fa-spin'), 500);
    });
  });

  // Export CSV Button
  exportCsvBtn.addEventListener('click', () => {
    const downloadUrl = `/api/admin/export-csv?key=${encodeURIComponent(currentAdminKey)}`;
    window.open(downloadUrl, '_blank');
  });

  // Search & Filter Listeners
  searchInput.addEventListener('input', () => {
    if (searchInput.value.trim()) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }
    fetchRegistrations();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    fetchRegistrations();
  });

  filterCategory.addEventListener('change', () => fetchRegistrations());
  filterFlight.addEventListener('change', () => fetchRegistrations());

  // 2. Authentication Verification Function
  async function verifyKeyAndInitialize(key) {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': key
        },
        body: JSON.stringify({ key })
      });

      const data = await res.json();

      if (res.ok && data.authenticated) {
        currentAdminKey = key;
        localStorage.setItem(STORAGE_ADMIN_KEY, key);
        hideAuthModal();
        await loadTournamentConfig();
        await loadDashboardData();
      } else {
        authErrorMsg.textContent = data.message || 'Invalid passcode or admin key.';
        authErrorMsg.classList.remove('hidden');
        showAuthModal();
      }
    } catch (err) {
      console.error('[Admin Auth Error]', err);
      authErrorMsg.textContent = 'Server connection error. Please try again.';
      authErrorMsg.classList.remove('hidden');
      showAuthModal();
    }
  }

  function showAuthModal() {
    authModal.classList.remove('hidden');
    dashboardApp.classList.add('hidden');
  }

  function hideAuthModal() {
    authModal.classList.add('hidden');
    dashboardApp.classList.remove('hidden');
    authErrorMsg.classList.add('hidden');
  }

  // 3. Load Tournament Dropdown Config
  async function loadTournamentConfig() {
    try {
      const res = await fetch('/api/tournament-config');
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        tournamentConfig = data;
        populateDropdowns();
      }
    } catch (err) {
      console.error('[Load Config Error]', err);
    }
  }

  function populateDropdowns() {
    // Populate Category filter & edit options
    const catOptions = ['<option value="All">All Categories</option>'];
    const editCatOptions = ['<option value="">Select Category</option>'];
    
    if (tournamentConfig.categories) {
      tournamentConfig.categories.forEach(c => {
        catOptions.push(`<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`);
        editCatOptions.push(`<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`);
      });
    }
    filterCategory.innerHTML = catOptions.join('');
    editCategory.innerHTML = editCatOptions.join('');

    // Populate Flight filter options
    const flightOptions = ['<option value="All">All Flights / Levels</option>'];
    const editFlightOptions = ['<option value="">Select Level</option>'];
    if (tournamentConfig.levels) {
      tournamentConfig.levels.forEach(l => {
        flightOptions.push(`<option value="${escapeHtml(l.name)}">${escapeHtml(l.name)}</option>`);
        editFlightOptions.push(`<option value="${escapeHtml(l.name)}">${escapeHtml(l.name)}</option>`);
      });
    }
    filterFlight.innerHTML = flightOptions.join('');
    editFlight.innerHTML = editFlightOptions.join('');
  }

  // Dependent Flight Dropdown when Category changes in Edit Modal
  editCategory.addEventListener('change', () => {
    const selectedCat = editCategory.value;
    const allowedLevels = tournamentConfig.categoryLevelMap[selectedCat] || [];
    let opts = '<option value="">Select Level</option>';
    if (allowedLevels.length > 0) {
      allowedLevels.forEach(lvl => {
        opts += `<option value="${escapeHtml(lvl)}">${escapeHtml(lvl)}</option>`;
      });
    } else if (tournamentConfig.levels) {
      tournamentConfig.levels.forEach(l => {
        opts += `<option value="${escapeHtml(l.name)}">${escapeHtml(l.name)}</option>`;
      });
    }
    editFlight.innerHTML = opts;
  });

  // 4. Load Dashboard Stats & Registrations Data
  async function loadDashboardData() {
    await Promise.all([
      fetchStats(),
      fetchRegistrations()
    ]);
  }

  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'x-admin-key': currentAdminKey }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        const s = data.data;
        statTotalRegs.textContent = s.totalRegistrations;
        statTotalPlayers.textContent = s.totalPlayers;
        statDoublesCount.textContent = s.doublesCount;
        statSinglesCount.textContent = s.singlesCount;

        // Render Category Chips
        if (s.byCategory && s.byCategory.length > 0) {
          categoryBadgesContainer.innerHTML = s.byCategory.map(c => `
            <div class="cat-chip">
              <span>${escapeHtml(c.category || 'Unassigned')}</span>
              <strong>${c.count}</strong>
            </div>
          `).join('');
        } else {
          categoryBadgesContainer.innerHTML = '<span class="text-muted text-sm">No category data available yet.</span>';
        }
      }
    } catch (err) {
      console.error('[Fetch Stats Error]', err);
    }
  }

  async function fetchRegistrations() {
    try {
      const searchVal = searchInput.value.trim();
      const catVal = filterCategory.value;
      const flightVal = filterFlight.value;

      const params = new URLSearchParams();
      if (searchVal) params.append('search', searchVal);
      if (catVal && catVal !== 'All') params.append('category', catVal);
      if (flightVal && flightVal !== 'All') params.append('flight', flightVal);

      const res = await fetch(`/api/admin/registrations?${params.toString()}`, {
        headers: { 'x-admin-key': currentAdminKey }
      });

      const data = await res.json();

      if (res.ok && data.status === 'success') {
        allRegistrations = data.data || [];
        renderRegistrationsTable(allRegistrations);
      } else {
        registrationsTbody.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Failed to load: ${escapeHtml(data.message)}</td></tr>`;
      }
    } catch (err) {
      console.error('[Fetch Registrations Error]', err);
      registrationsTbody.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Network connection error while fetching registrations.</td></tr>`;
    }
  }

  // 5. Render Registration Directory Table
  function renderRegistrationsTable(list) {
    tableSubtitle.textContent = `Showing ${list.length} registration entry${list.length === 1 ? '' : 's'}`;

    if (list.length === 0) {
      registrationsTbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted" style="padding: 40px 0;">
            <i class="fa-solid fa-folder-open" style="font-size: 32px; display: block; margin-bottom: 8px; opacity: 0.5;"></i>
            No matching registrations found.
          </td>
        </tr>
      `;
      return;
    }

    registrationsTbody.innerHTML = list.map(reg => {
      const teamIdStr = reg.team_id ? escapeHtml(reg.team_id) : `REG-${reg.id}`;
      const playerUidStr = reg.player_id ? escapeHtml(reg.player_id) : '--';
      const partnerUidStr = reg.partner_player_id ? escapeHtml(reg.partner_player_id) : '--';

      const hasPartner = !!(reg.partner_name || reg.partner_iqama);

      const formattedDate = reg.timestamp ? new Date(reg.timestamp).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : '--';

      return `
        <tr>
          <td>
            <span class="badge-team">${teamIdStr}</span>
            <div class="text-muted text-sm mt-1">#${reg.id}</div>
          </td>
          <td>
            <div class="player-info-cell">
              <span class="player-name">${escapeHtml(reg.name)} <span class="uid-tag">UID: ${playerUidStr}</span></span>
              <span class="player-meta">Iqama: <strong>${escapeHtml(reg.iqama || '--')}</strong></span>
              <span class="player-meta"><i class="fa-solid fa-phone" style="font-size:10px;"></i> ${escapeHtml(reg.phone || '--')}</span>
              <span class="player-meta"><i class="fa-solid fa-envelope" style="font-size:10px;"></i> ${escapeHtml(reg.email || '--')}</span>
            </div>
          </td>
          <td>
            ${hasPartner ? `
              <div class="player-info-cell">
                <span class="player-name">${escapeHtml(reg.partner_name)} <span class="uid-tag">UID: ${partnerUidStr}</span></span>
                <span class="player-meta">Iqama: <strong>${escapeHtml(reg.partner_iqama || '--')}</strong></span>
                <span class="player-meta"><i class="fa-solid fa-phone" style="font-size:10px;"></i> ${escapeHtml(reg.partner_phone || '--')}</span>
              </div>
            ` : `<span class="text-muted text-sm">-- (Singles) --</span>`}
          </td>
          <td>
            <div><span class="badge-cat">${escapeHtml(reg.category || 'N/A')}</span></div>
            <div><span class="badge-flight">${escapeHtml(reg.flight || 'N/A')}</span></div>
          </td>
          <td>
            <span>${escapeHtml(reg.club || 'Independent')}</span>
          </td>
          <td>
            <span class="text-muted text-sm">${formattedDate}</span>
          </td>
          <td class="text-right">
            <div class="action-btn-group">
              <button class="action-btn action-btn-edit" onclick="openEditModal(${reg.id})" title="Edit Registration">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="action-btn action-btn-delete" onclick="openDeleteModal(${reg.id}, '${escapeHtml(reg.name)}', '${teamIdStr}')" title="Delete Registration">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 6. Edit Registration Modal Handlers
  window.openEditModal = (id) => {
    const reg = allRegistrations.find(r => r.id === id);
    if (!reg) return;

    editRegId.value = reg.id;
    document.getElementById('modal-subtitle').textContent = `Team ID: ${reg.team_id || ('REG-' + reg.id)}`;

    // Main Player
    document.getElementById('edit-player-id').value = reg.player_id || 'Auto-generated';
    document.getElementById('edit-name').value = reg.name || '';
    document.getElementById('edit-iqama').value = reg.iqama || '';
    document.getElementById('edit-phone').value = reg.phone || '';
    document.getElementById('edit-email').value = reg.email || '';
    document.getElementById('edit-club').value = reg.club || '';
    document.getElementById('edit-gender').value = reg.gender || 'Male';
    document.getElementById('edit-dob').value = reg.dob || '';
    document.getElementById('edit-nationality').value = reg.nationality || '';

    // Category & Flight
    editCategory.value = reg.category || '';
    editCategory.dispatchEvent(new Event('change'));
    setTimeout(() => {
      editFlight.value = reg.flight || '';
    }, 50);

    // Partner
    document.getElementById('edit-partner-player-id').value = reg.partner_player_id || '--';
    document.getElementById('edit-partner-name').value = reg.partner_name || '';
    document.getElementById('edit-partner-iqama').value = reg.partner_iqama || '';
    document.getElementById('edit-partner-phone').value = reg.partner_phone || '';
    document.getElementById('edit-partner-gender').value = reg.partner_gender || '';
    document.getElementById('edit-partner-nationality').value = reg.partner_nationality || '';

    editModal.classList.remove('hidden');
  };

  closeEditModalBtn.addEventListener('click', () => editModal.classList.add('hidden'));
  cancelEditBtn.addEventListener('click', () => editModal.classList.add('hidden'));

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editRegId.value;
    if (!id) return;

    const payload = {
      name: document.getElementById('edit-name').value.trim(),
      iqama: document.getElementById('edit-iqama').value.trim(),
      phone: document.getElementById('edit-phone').value.trim(),
      email: document.getElementById('edit-email').value.trim(),
      club: document.getElementById('edit-club').value.trim(),
      gender: document.getElementById('edit-gender').value,
      dob: document.getElementById('edit-dob').value,
      nationality: document.getElementById('edit-nationality').value.trim(),
      category: editCategory.value,
      flight: editFlight.value,
      partner_name: document.getElementById('edit-partner-name').value.trim(),
      partner_iqama: document.getElementById('edit-partner-iqama').value.trim(),
      partner_phone: document.getElementById('edit-partner-phone').value.trim(),
      partner_gender: document.getElementById('edit-partner-gender').value,
      partner_nationality: document.getElementById('edit-partner-nationality').value.trim()
    };

    try {
      const res = await fetch(`/api/admin/registrations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': currentAdminKey
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast('Registration updated successfully', 'success');
        editModal.classList.add('hidden');
        loadDashboardData();
      } else {
        showToast(data.message || 'Failed to update registration', 'error');
      }
    } catch (err) {
      console.error('[Update Error]', err);
      showToast('Error updating record: ' + err.message, 'error');
    }
  });

  // 7. Delete Modal Handlers
  window.openDeleteModal = (id, name, teamId) => {
    pendingDeleteId = id;
    deleteTargetInfo.textContent = `${name} (${teamId})`;
    deleteModal.classList.remove('hidden');
  };

  closeDeleteModalBtn.addEventListener('click', () => deleteModal.classList.add('hidden'));
  cancelDeleteBtn.addEventListener('click', () => deleteModal.classList.add('hidden'));

  confirmDeleteBtn.addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    try {
      const res = await fetch(`/api/admin/registrations/${pendingDeleteId}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': currentAdminKey }
      });
      const data = await res.json();

      if (res.ok && data.status === 'success') {
        showToast('Registration record deleted successfully', 'success');
        deleteModal.classList.add('hidden');
        pendingDeleteId = null;
        loadDashboardData();
      } else {
        showToast(data.message || 'Failed to delete record', 'error');
      }
    } catch (err) {
      console.error('[Delete Error]', err);
      showToast('Error deleting record', 'error');
    }
  });

  // 8. Toast Helper
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fa-solid ${type === 'success' ? 'fa-circle-check text-emerald' : 'fa-circle-exclamation text-danger'}"></i>
      <span>${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // 9. Utility Escape HTML
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
