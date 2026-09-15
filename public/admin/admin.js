/**
 * Navodaya Open 2026 - Admin Portal Client Logic (Multi-User & RBAC)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Storage Keys
  const STORAGE_AUTH_TOKEN = 'navodaya_admin_token';
  const STORAGE_USER_PROFILE = 'navodaya_admin_user';
  
  // State
  let currentToken = localStorage.getItem(STORAGE_AUTH_TOKEN) || sessionStorage.getItem(STORAGE_AUTH_TOKEN) || '';
  let currentUser = JSON.parse(localStorage.getItem(STORAGE_USER_PROFILE) || sessionStorage.getItem(STORAGE_USER_PROFILE) || 'null');
  
  let allRegistrations = [];
  let allUsers = [];
  let tournamentConfig = { categories: [], levels: [], categoryLevelMap: {} };
  let pendingDeleteId = null;

  // DOM Elements - Auth Modal
  const authModal = document.getElementById('auth-modal');
  const authForm = document.getElementById('auth-form');
  const adminUsernameInput = document.getElementById('admin-username-input');
  const adminPasswordInput = document.getElementById('admin-password-input');
  const togglePasswordBtn = document.getElementById('toggle-password-btn');
  const authErrorMsg = document.getElementById('auth-error-msg');
  
  // DOM Elements - Dashboard Nav
  const dashboardApp = document.getElementById('dashboard-app');
  const userProfileBadge = document.getElementById('user-profile-badge');
  const userAvatarText = document.getElementById('user-avatar-text');
  const userDisplayName = document.getElementById('user-display-name');
  const userRoleChip = document.getElementById('user-role-chip');
  const usersMgmtBtn = document.getElementById('users-mgmt-btn');

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

  // User Management Modal Elements
  const usersModal = document.getElementById('users-modal');
  const closeUsersModalBtn = document.getElementById('close-users-modal-btn');
  const createUserBtn = document.getElementById('create-user-btn');
  const usersTbody = document.getElementById('users-tbody');

  // User Form Dialog Elements
  const userFormModal = document.getElementById('user-form-modal');
  const userForm = document.getElementById('user-form');
  const closeUserFormModalBtn = document.getElementById('close-user-form-modal-btn');
  const cancelUserFormBtn = document.getElementById('cancel-user-form-btn');
  const userFormId = document.getElementById('user-form-id');
  const uUsername = document.getElementById('u-username');
  const uEmail = document.getElementById('u-email');
  const uPassword = document.getElementById('u-password');
  const uPasswordGroup = document.getElementById('u-password-group');
  const uRole = document.getElementById('u-role');

  // Password Reset Modal Elements
  const resetPasswordModal = document.getElementById('reset-password-modal');
  const resetPasswordForm = document.getElementById('reset-password-form');
  const closeResetPasswordModalBtn = document.getElementById('close-reset-password-modal-btn');
  const cancelResetPasswordBtn = document.getElementById('cancel-reset-password-btn');
  const resetTargetUserId = document.getElementById('reset-target-user-id');
  const resetTargetUsername = document.getElementById('reset-target-username');
  const resetNewPassword = document.getElementById('reset-new-password');

  // 1. Initial Authentication Check
  if (currentToken && currentUser) {
    applyUserProfile(currentUser);
    hideAuthModal();
    loadTournamentConfig();
    loadDashboardData();
  } else {
    showAuthModal();
  }

  // Toggle Password Visibility
  togglePasswordBtn.addEventListener('click', () => {
    const isPass = adminPasswordInput.type === 'password';
    adminPasswordInput.type = isPass ? 'text' : 'password';
    togglePasswordBtn.innerHTML = isPass ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
  });

  // Auth Form Submit
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = adminUsernameInput.value.trim();
    const password = adminPasswordInput.value.trim();
    if (!username || !password) return;
    await performLogin(username, password);
  });

  // Logout Handler
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_AUTH_TOKEN);
    localStorage.removeItem(STORAGE_USER_PROFILE);
    sessionStorage.removeItem(STORAGE_AUTH_TOKEN);
    sessionStorage.removeItem(STORAGE_USER_PROFILE);
    currentToken = '';
    currentUser = null;
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
    if (!hasPermission('can_export')) {
      showToast('You do not have permission to export CSV files.', 'error');
      return;
    }
    const downloadUrl = `/api/admin/export-csv?key=${encodeURIComponent(currentToken)}`;
    window.open(downloadUrl, '_blank');
  });

  // User Management Button
  usersMgmtBtn.addEventListener('click', () => {
    if (!hasPermission('can_manage_users')) {
      showToast('Permission denied.', 'error');
      return;
    }
    fetchUsers();
    usersModal.classList.remove('hidden');
  });

  closeUsersModalBtn.addEventListener('click', () => usersModal.classList.add('hidden'));

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

  // Helper: Check if user has permission
  function hasPermission(perm) {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    const perms = currentUser.permissions || [];
    return perms.includes(perm);
  }

  // 2. Perform Login API Call
  async function performLogin(username, password) {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok && data.authenticated) {
        currentToken = data.token;
        currentUser = data.user;
        localStorage.setItem(STORAGE_AUTH_TOKEN, data.token);
        localStorage.setItem(STORAGE_USER_PROFILE, JSON.stringify(data.user));

        applyUserProfile(data.user);
        hideAuthModal();
        await loadTournamentConfig();
        await loadDashboardData();
        showToast(`Welcome back, ${data.user.username}!`, 'success');
      } else {
        authErrorMsg.textContent = data.message || 'Invalid username or password.';
        authErrorMsg.classList.remove('hidden');
      }
    } catch (err) {
      console.error('[Admin Login Error]', err);
      authErrorMsg.textContent = 'Server connection error. Please try again.';
      authErrorMsg.classList.remove('hidden');
    }
  }

  function applyUserProfile(user) {
    if (!user) return;
    const name = user.username || 'Admin';
    userDisplayName.textContent = name;
    userAvatarText.textContent = name.charAt(0).toUpperCase();
    
    const roleStr = (user.role || 'manager').toUpperCase();
    userRoleChip.textContent = roleStr;
    userRoleChip.className = `role-chip role-badge-${(user.role || 'manager').toLowerCase()}`;

    // Permissions UI Toggles
    if (hasPermission('can_manage_users')) {
      usersMgmtBtn.classList.remove('hidden');
    } else {
      usersMgmtBtn.classList.add('hidden');
    }

    if (hasPermission('can_export')) {
      exportCsvBtn.classList.remove('hidden');
    } else {
      exportCsvBtn.classList.add('hidden');
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
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        const s = data.data;
        statTotalRegs.textContent = s.totalRegistrations;
        statTotalPlayers.textContent = s.totalPlayers;
        statDoublesCount.textContent = s.doublesCount;
        statSinglesCount.textContent = s.singlesCount;

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
        headers: { 'Authorization': `Bearer ${currentToken}` }
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

    const canEdit = hasPermission('can_edit');
    const canDelete = hasPermission('can_delete');

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
              ${canEdit ? `
                <button class="action-btn action-btn-edit" onclick="openEditModal(${reg.id})" title="Edit Registration">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
              ` : ''}
              ${canDelete ? `
                <button class="action-btn action-btn-delete" onclick="openDeleteModal(${reg.id}, '${escapeHtml(reg.name)}', '${teamIdStr}')" title="Delete Registration">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              ` : ''}
              ${!canEdit && !canDelete ? `<span class="text-muted text-sm">Read Only</span>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 6. Edit Registration Modal Handlers
  window.openEditModal = (id) => {
    if (!hasPermission('can_edit')) {
      showToast('Permission denied. You cannot edit records.', 'error');
      return;
    }
    const reg = allRegistrations.find(r => r.id === id);
    if (!reg) return;

    editRegId.value = reg.id;
    document.getElementById('modal-subtitle').textContent = `Team ID: ${reg.team_id || ('REG-' + reg.id)}`;

    document.getElementById('edit-player-id').value = reg.player_id || 'Auto-generated';
    document.getElementById('edit-name').value = reg.name || '';
    document.getElementById('edit-iqama').value = reg.iqama || '';
    document.getElementById('edit-phone').value = reg.phone || '';
    document.getElementById('edit-email').value = reg.email || '';
    document.getElementById('edit-club').value = reg.club || '';
    document.getElementById('edit-gender').value = reg.gender || 'Male';
    document.getElementById('edit-dob').value = reg.dob || '';
    document.getElementById('edit-nationality').value = reg.nationality || '';

    editCategory.value = reg.category || '';
    editCategory.dispatchEvent(new Event('change'));
    setTimeout(() => {
      editFlight.value = reg.flight || '';
    }, 50);

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
          'Authorization': `Bearer ${currentToken}`
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

  // 7. Delete Registration Handlers
  window.openDeleteModal = (id, name, teamId) => {
    if (!hasPermission('can_delete')) {
      showToast('Permission denied. You cannot delete records.', 'error');
      return;
    }
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
        headers: { 'Authorization': `Bearer ${currentToken}` }
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

  // 8. User Management Functions
  async function fetchUsers() {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await res.json();

      if (res.ok && data.status === 'success') {
        allUsers = data.data || [];
        renderUsersTable(allUsers);
      } else {
        usersTbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Failed to load users: ${escapeHtml(data.message)}</td></tr>`;
      }
    } catch (err) {
      console.error('[Fetch Users Error]', err);
      usersTbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Connection error fetching users.</td></tr>`;
    }
  }

  function renderUsersTable(users) {
    if (users.length === 0) {
      usersTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No users found.</td></tr>';
      return;
    }

    usersTbody.innerHTML = users.map(u => {
      const roleBadgeClass = `role-badge-${(u.role || 'manager').toLowerCase()}`;
      let permsList = u.permissions;
      if (typeof permsList === 'string') {
        try { permsList = JSON.parse(permsList); } catch (e) { permsList = []; }
      }
      if (!Array.isArray(permsList)) permsList = [];

      const permsPills = permsList.map(p => `<span class="perm-pill">${escapeHtml(p.replace('can_', ''))}</span>`).join('');

      const lastLoginStr = u.last_login ? new Date(u.last_login).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : 'Never';

      return `
        <tr>
          <td>
            <div class="player-info-cell">
              <span class="player-name">${escapeHtml(u.username)}</span>
              <span class="player-meta">${escapeHtml(u.email)}</span>
            </div>
          </td>
          <td>
            <span class="${roleBadgeClass}">${escapeHtml((u.role || 'manager').toUpperCase())}</span>
          </td>
          <td>
            <div>${permsPills || '<span class="text-muted text-sm">Default</span>'}</div>
          </td>
          <td>
            <span class="${u.is_active ? 'text-emerald' : 'text-danger'} font-weight-bold">
              ${u.is_active ? '<i class="fa-solid fa-circle-check"></i> Active' : '<i class="fa-solid fa-circle-xmark"></i> Disabled'}
            </span>
          </td>
          <td>
            <span class="text-muted text-sm">${lastLoginStr}</span>
          </td>
          <td class="text-right">
            <div class="action-btn-group">
              <button class="action-btn action-btn-edit" onclick="openResetPasswordModal(${u.id}, '${escapeHtml(u.username)}')" title="Reset Password">
                <i class="fa-solid fa-key"></i>
              </button>
              ${u.id !== currentUser.id ? `
                <button class="action-btn action-btn-delete" onclick="deleteUser(${u.id}, '${escapeHtml(u.username)}')" title="Delete User">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Create User Modal Handlers
  createUserBtn.addEventListener('click', () => {
    userFormId.value = '';
    uUsername.value = '';
    uEmail.value = '';
    uPassword.value = '';
    uPasswordGroup.classList.remove('hidden');
    uRole.value = 'manager';
    uRole.dispatchEvent(new Event('change'));
    userFormModal.classList.remove('hidden');
  });

  closeUserFormModalBtn.addEventListener('click', () => userFormModal.classList.add('hidden'));
  cancelUserFormBtn.addEventListener('click', () => userFormModal.classList.add('hidden'));

  uRole.addEventListener('change', () => {
    const roleVal = uRole.value;
    const canEdit = document.getElementById('perm-can_edit');
    const canExport = document.getElementById('perm-can_export');
    const canDelete = document.getElementById('perm-can_delete');
    const canManageUsers = document.getElementById('perm-can_manage_users');

    if (roleVal === 'admin') {
      canEdit.checked = true;
      canExport.checked = true;
      canDelete.checked = true;
      canManageUsers.checked = true;
    } else if (roleVal === 'manager') {
      canEdit.checked = true;
      canExport.checked = true;
      canDelete.checked = false;
      canManageUsers.checked = false;
    } else if (roleVal === 'viewer') {
      canEdit.checked = false;
      canExport.checked = false;
      canDelete.checked = false;
      canManageUsers.checked = false;
    }
  });

  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = uUsername.value.trim();
    const email = uEmail.value.trim();
    const password = uPassword.value.trim();
    const role = uRole.value;

    const permissions = ['can_view'];
    if (document.getElementById('perm-can_edit').checked) permissions.push('can_edit');
    if (document.getElementById('perm-can_export').checked) permissions.push('can_export');
    if (document.getElementById('perm-can_delete').checked) permissions.push('can_delete');
    if (document.getElementById('perm-can_manage_users').checked) permissions.push('can_manage_users');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ username, email, password, role, permissions })
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast(`User "${username}" created successfully`, 'success');
        userFormModal.classList.add('hidden');
        fetchUsers();
      } else {
        showToast(data.message || 'Failed to create user', 'error');
      }
    } catch (err) {
      console.error('[Create User Error]', err);
      showToast('Error creating user: ' + err.message, 'error');
    }
  });

  // Password Reset Handlers
  window.openResetPasswordModal = (id, username) => {
    resetTargetUserId.value = id;
    resetTargetUsername.textContent = username;
    resetNewPassword.value = '';
    resetPasswordModal.classList.remove('hidden');
  };

  closeResetPasswordModalBtn.addEventListener('click', () => resetPasswordModal.classList.add('hidden'));
  cancelResetPasswordBtn.addEventListener('click', () => resetPasswordModal.classList.add('hidden'));

  resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = resetTargetUserId.value;
    const newPassword = resetNewPassword.value.trim();
    if (!id || !newPassword) return;

    try {
      const res = await fetch(`/api/admin/users/${id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ newPassword })
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast('Password reset successfully', 'success');
        resetPasswordModal.classList.add('hidden');
      } else {
        showToast(data.message || 'Failed to reset password', 'error');
      }
    } catch (err) {
      showToast('Error resetting password: ' + err.message, 'error');
    }
  });

  // Delete User
  window.deleteUser = async (id, username) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast(`User "${username}" deleted successfully`, 'success');
        fetchUsers();
      } else {
        showToast(data.message || 'Failed to delete user', 'error');
      }
    } catch (err) {
      showToast('Error deleting user: ' + err.message, 'error');
    }
  };

  // 9. Toast Helper
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

  // 10. Utility Escape HTML
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
