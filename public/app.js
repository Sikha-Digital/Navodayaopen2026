/**
 * Navodaya Open 2026 - International Badminton Tournament Registration Frontend
 */

// Backend API Endpoints (Neon DB Express Backend)
const API_ENDPOINT = window.API_ENDPOINT || '/api/register';
const TOURNAMENT_CONFIG_ENDPOINT = window.TOURNAMENT_CONFIG_ENDPOINT || '/api/tournament-config';

// Dynamic Categories & Levels (populated from Neon DB backend)
let serverCategories = [
  { name: "Mens Doubles", cat_code: "MD", is_doubles: true, gender_allowed: "Male" },
  { name: "Womens Doubles", cat_code: "WD", is_doubles: true, gender_allowed: "Female" },
  { name: "Mixed Doubles", cat_code: "XD", is_doubles: true, gender_allowed: "Mixed" },
  { name: "Girls Doubles", cat_code: "GD", is_doubles: true, gender_allowed: "Female", max_age: 17 },
  { name: "Boys Doubles", cat_code: "BD", is_doubles: true, gender_allowed: "Male", max_age: 17 }
];

let serverLevels = [];

let serverCategoryLevelMap = {
  "Mens Doubles": [
    "International", "Premiere", "Championship", "F1", "F2", "F3", "F4", "F5", "F6", "Masters 35Plus", "Veterance 45Plus"
  ],
  "Womens Doubles": [
    "Championship", "F1", "F2", "F3", "F4", "F5", "F6"
  ],
  "Mixed Doubles": [
    "International", "Premiere", "Championship", "F1", "F2", "F3", "F4", "F5", "F6"
  ],
  "Boys Doubles": [
    "Under 9", "Under 11", "Under 13", "Under 15", "Under 17"
  ],
  "Girls Doubles": [
    "Under 9", "Under 11", "Under 13", "Under 15", "Under 17"
  ]
};

/**
 * Fetch dynamic tournament categories & levels directly from Neon DB backend
 */
async function fetchTournamentConfig() {
  try {
    const res = await fetch(TOURNAMENT_CONFIG_ENDPOINT);
    if (res.ok) {
      const result = await res.json();
      if (result && result.status === 'success') {
        if (Array.isArray(result.categories) && result.categories.length > 0) {
          serverCategories = result.categories;
        }
        if (Array.isArray(result.levels) && result.levels.length > 0) {
          serverLevels = result.levels;
        }
        if (result.categoryLevelMap && typeof result.categoryLevelMap === 'object') {
          serverCategoryLevelMap = result.categoryLevelMap;
        }
        updateCategoryAndAgeUI();
      }
    }
  } catch (err) {
    console.warn('[Config Warning] Using offline tournament configuration:', err.message);
  }
}

// Dropdown Component Controller with Full Keyboard & Focus Navigation
class SearchableCombobox {
  constructor(comboboxId, inputId, listId) {
    this.comboboxId = comboboxId;
    this.inputId = inputId;
    this.listId = listId;
    this.isOpen = false;
    this.items = [];
    this.highlightedIndex = -1;
    this.isSelecting = false;
    this.isInitialized = false;

    this.init();
  }

  get combobox() {
    return document.getElementById(this.comboboxId);
  }

  get input() {
    return document.getElementById(this.inputId);
  }

  get list() {
    return document.getElementById(this.listId);
  }

  get toggleBtn() {
    const el = this.combobox;
    return (el && typeof el.querySelector === 'function') ? el.querySelector('.dropdown-toggle') : null;
  }

  getVisibleItems() {
    return this.items.filter(item => item.style.display !== 'none');
  }

  clearHighlight() {
    this.items.forEach(i => i.classList.remove('highlighted'));
    this.highlightedIndex = -1;
  }

  highlightItem(index) {
    const visibleItems = this.getVisibleItems();
    if (visibleItems.length === 0) {
      this.clearHighlight();
      return;
    }

    this.items.forEach(i => i.classList.remove('highlighted'));

    if (index >= 0 && index < visibleItems.length) {
      this.highlightedIndex = index;
      const targetItem = visibleItems[index];
      targetItem.classList.add('highlighted');

      const lEl = this.list;
      if (lEl && targetItem) {
        const itemTop = targetItem.offsetTop;
        const itemBottom = itemTop + targetItem.offsetHeight;
        if (itemTop < lEl.scrollTop) {
          lEl.scrollTop = itemTop;
        } else if (itemBottom > lEl.scrollTop + lEl.clientHeight) {
          lEl.scrollTop = itemBottom - lEl.clientHeight;
        }
      }
    }
  }

  init() {
    if (this.isInitialized) return;
    const cEl = this.combobox;
    const iEl = this.input;
    const lEl = this.list;

    if (!cEl || !iEl || !lEl) return;

    this.isInitialized = true;

    iEl.addEventListener('click', () => {
      this.isOpen ? this.close() : this.open();
    });

    iEl.addEventListener('input', () => {
      if (this.isSelecting) return;
      if (!iEl.readOnly) {
        this.filterItems(iEl.value);
        if (!this.isOpen && iEl.value.trim() !== '') {
          this.open();
        }
      }
    });

    iEl.addEventListener('blur', () => {
      setTimeout(() => {
        const active = document.activeElement;
        const currentBox = this.combobox;
        if (currentBox && !currentBox.contains(active)) {
          this.close();
        }
      }, 120);
    });

    // Keyboard navigation: ArrowDown, ArrowUp, Enter, Escape, Tab
    iEl.addEventListener('keydown', (e) => {
      if (this.isDisabled) return;
      const visibleItems = this.getVisibleItems();

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
          this.highlightItem(0);
        } else if (visibleItems.length > 0) {
          let nextIdx = this.highlightedIndex + 1;
          if (nextIdx >= visibleItems.length) nextIdx = 0;
          this.highlightItem(nextIdx);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
          this.highlightItem(visibleItems.length - 1);
        } else if (visibleItems.length > 0) {
          let prevIdx = this.highlightedIndex - 1;
          if (prevIdx < 0) prevIdx = visibleItems.length - 1;
          this.highlightItem(prevIdx);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (this.isOpen) {
          if (this.highlightedIndex >= 0 && this.highlightedIndex < visibleItems.length) {
            this.selectItem(visibleItems[this.highlightedIndex], false);
          } else if (visibleItems.length > 0) {
            this.selectItem(visibleItems[0], false);
          } else {
            this.close();
          }
        } else {
          if (iEl.value.trim() !== '') {
            if (typeof focusNextInput === 'function') focusNextInput(iEl);
          } else {
            this.open();
            this.highlightItem(0);
          }
        }
      } else if (e.key === 'Escape') {
        if (this.isOpen) {
          e.preventDefault();
          this.close();
        }
      } else if (e.key === 'Tab') {
        if (this.isOpen) {
          if (this.highlightedIndex >= 0 && this.highlightedIndex < visibleItems.length) {
            this.selectItem(visibleItems[this.highlightedIndex], false);
          } else {
            this.close();
          }
        }
      }
    });

    const btn = this.toggleBtn;
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.isOpen ? this.close() : this.open();
      });
    }

    this.setupItems();

    document.addEventListener('click', (e) => {
      const currentBox = this.combobox;
      if (currentBox && !currentBox.contains(e.target)) {
        this.close();
      }
    });
  }

  filterItems(query) {
    const q = (query || '').toLowerCase().trim();
    this.items.forEach(item => {
      const txt = (item.textContent || '').toLowerCase();
      if (!q || txt.includes(q)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });

    const visibleItems = this.getVisibleItems();
    if (visibleItems.length > 0) {
      this.highlightItem(0);
    } else {
      this.clearHighlight();
    }
  }

  setupItems() {
    const lEl = this.list;
    if (!lEl) return;
    this.items = Array.from(lEl.querySelectorAll('li'));
    this.items.forEach((item) => {
      let scrollTopAtStart = 0;

      item.addEventListener('touchstart', () => {
        if (this.list) scrollTopAtStart = this.list.scrollTop;
      }, { passive: true });

      item.addEventListener('touchend', (e) => {
        const listEl = this.list;
        const scrolled = listEl ? Math.abs(listEl.scrollTop - scrollTopAtStart) : 0;
        if (scrolled < 5) {
          e.preventDefault();
          this.selectItem(item, false);
        }
      }, { passive: false });

      item.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.selectItem(item, false);
      });
    });
  }

  updateOptions(options) {
    const lEl = this.list;
    if (!lEl || !Array.isArray(options)) return;

    // Check if options are already identical to avoid unnecessary DOM rebuilding
    const currentOptions = Array.from(lEl.querySelectorAll('li')).map(li => li.getAttribute('data-value'));
    const isSame = currentOptions.length === options.length && currentOptions.every((opt, idx) => opt === options[idx]);
    if (isSame) return;

    lEl.innerHTML = '';
    const currentVal = this.input ? this.input.value.trim() : '';
    options.forEach(opt => {
      const li = document.createElement('li');
      li.setAttribute('data-value', opt);
      li.textContent = opt;
      if (currentVal && currentVal === opt) {
        li.classList.add('selected');
      }
      lEl.appendChild(li);
    });
    this.setupItems();
  }

  disable() {
    this.isDisabled = true;
    this.close();
    const cEl = this.combobox;
    if (cEl) cEl.classList.add('disabled-combobox');
    const btn = this.toggleBtn;
    if (btn) btn.style.display = 'none';
    if (this.input) this.input.setAttribute('tabindex', '-1');
  }

  enable() {
    this.isDisabled = false;
    const cEl = this.combobox;
    if (cEl) cEl.classList.remove('disabled-combobox');
    const btn = this.toggleBtn;
    if (btn) btn.style.display = '';
    if (this.input) this.input.removeAttribute('tabindex');
  }

  open() {
    if (this.isDisabled) return;
    const cEl = this.combobox;
    const lEl = this.list;
    if (this.isOpen || !cEl || !lEl) return;
    this.isOpen = true;
    cEl.classList.add('open');

    if (this.input && !this.input.readOnly && !this.input.value.trim()) {
      this.filterItems('');
    }

    const selected = lEl.querySelector('li.selected');
    const visibleItems = this.getVisibleItems();
    if (selected) {
      const selIdx = visibleItems.indexOf(selected);
      this.highlightItem(selIdx >= 0 ? selIdx : 0);
      setTimeout(() => {
        if (this.list) {
          this.list.scrollTop = selected.offsetTop - this.list.clientHeight / 2 + selected.clientHeight / 2;
        }
      }, 50);
    } else {
      this.highlightItem(0);
      lEl.scrollTop = 0;
    }
  }

  close() {
    const cEl = this.combobox;
    const iEl = this.input;
    if (!this.isOpen || !cEl || !iEl) return;
    this.isOpen = false;
    cEl.classList.remove('open');
    this.clearHighlight();
    iEl.dispatchEvent(new Event('blur'));
  }

  selectItem(item, advanceFocus = false) {
    const iEl = this.input;
    if (!item || !iEl) return;
    const val = item.getAttribute('data-value');
    iEl.value = val;

    this.items.forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');

    this.close();

    this.isSelecting = true;
    iEl.dispatchEvent(new Event('input', { bubbles: true }));
    iEl.dispatchEvent(new Event('change', { bubbles: true }));
    this.isSelecting = false;

    this.close();

    if (advanceFocus && typeof focusNextInput === 'function') {
      focusNextInput(iEl);
    }
  }

  reset() {
    this.clearHighlight();
    this.items.forEach(i => i.classList.remove('selected'));
    const iEl = this.input;
    if (iEl) iEl.value = '';
    this.close();
  }

  setValue(val) {
    const iEl = this.input;
    const item = this.items.find(i => i.getAttribute('data-value') === val);
    if (item && iEl) {
      iEl.value = val;
      this.items.forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      this.close();
      this.isSelecting = true;
      iEl.dispatchEvent(new Event('input', { bubbles: true }));
      iEl.dispatchEvent(new Event('change', { bubbles: true }));
      this.isSelecting = false;
      this.close();
    }
  }
}



// DOM Elements
const form = document.getElementById('registrationForm');
const nameInput = document.getElementById('nameInput');
const phoneInput = document.getElementById('phoneInput');
const emailInput = document.getElementById('emailInput');
const iqamaInput = document.getElementById('iqamaInput');
const genderInput = document.getElementById('genderInput');
const dobInput = document.getElementById('dobInput');
const dobNativePicker = document.getElementById('dobNativePicker');
const dobPickerBtn = document.getElementById('dobPickerBtn');
const nationalityInput = document.getElementById('nationalityInput');
const clubInput = document.getElementById('clubInput');
const categoryInput = document.getElementById('categoryInput');
const flightInput = document.getElementById('flightInput');

const partnerSection = document.getElementById('partnerSection');
const partnerNameInput = document.getElementById('partnerNameInput');
const partnerPhoneInput = document.getElementById('partnerPhoneInput');
const partnerIqamaInput = document.getElementById('partnerIqamaInput');
const partnerGenderInput = document.getElementById('partnerGenderInput');
const partnerDobInput = document.getElementById('partnerDobInput');
const partnerDobNativePicker = document.getElementById('partnerDobNativePicker');
const partnerDobPickerBtn = document.getElementById('partnerDobPickerBtn');
const partnerNationalityInput = document.getElementById('partnerNationalityInput');

const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const spinner = submitBtn.querySelector('.spinner');

const introPanel = document.getElementById('introPanel');
const enterPortalBtn = document.getElementById('enterPortalBtn');
const introProgressBar = document.getElementById('introProgressBar');
const formPanel = document.getElementById('formPanel');
const successPanel = document.getElementById('successPanel');
const resetBtn = document.getElementById('resetBtn');

const generalError = document.getElementById('generalError');
const errorMessage = document.getElementById('errorMessage');

// Step Navigation Elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const stepTab1 = document.getElementById('stepTab1');
const stepTab2 = document.getElementById('stepTab2');
const stepLine = document.getElementById('stepLine');
const nextStepBtn = document.getElementById('nextStepBtn');
const prevStepBtn = document.getElementById('prevStepBtn');

function validateStep1() {
  const isNameValid = validateInput(nameInput, document.getElementById('nameError'), null, 'Full Name is required.');
  const isPhoneValid = validateInput(phoneInput, document.getElementById('phoneError'), (val) => PHONE_REGEX.test(val), 'Please enter a valid phone number (7-15 digits).');
  const isEmailValid = validateInput(emailInput, document.getElementById('emailError'), (val) => EMAIL_REGEX.test(val), 'Please enter a valid email address.');
  const isIqamaValid = validateIqamaField(iqamaInput, document.getElementById('iqamaError'), 'Iqama / ID Number');
  const isGenderValid = validateInput(genderInput, document.getElementById('genderError'), null, 'Gender selection is required.');
  const isDobValid = validateDobField(dobInput, document.getElementById('dobError'), 'Date of Birth');
  const isNationalityValid = validateInput(nationalityInput, document.getElementById('nationalityError'), null, 'Nationality is required.');
  const isClubValid = validateInput(clubInput, document.getElementById('clubError'), null, 'Country or Club Name is required.');

  if (!isNameValid || !isPhoneValid || !isEmailValid || !isIqamaValid || !isGenderValid || !isDobValid || !isNationalityValid || !isClubValid) {
    [nameInput, phoneInput, emailInput, iqamaInput, genderInput, dobInput, nationalityInput, clubInput].forEach(inp => inp.classList.add('touched'));
    return false;
  }
  return true;
}

function goToStep(stepNum) {
  if (stepNum === 2) {
    if (!validateStep1()) return;
    step1.classList.remove('active');
    step2.classList.add('active');
    stepTab1.classList.remove('active');
    stepTab1.classList.add('completed');
    stepTab2.classList.add('active');
    stepLine.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      if (categoryInput) {
        categoryInput.focus();
        if (categoryCombobox && !categoryInput.value) {
          categoryCombobox.open();
        }
      }
    }, 150);
  } else {
    step2.classList.remove('active');
    step1.classList.add('active');
    stepTab2.classList.remove('active');
    stepTab1.classList.remove('completed');
    stepTab1.classList.add('active');
    stepLine.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      if (nameInput) {
        nameInput.focus();
      }
    }, 150);
  }
}

if (nextStepBtn) {
  nextStepBtn.addEventListener('click', () => goToStep(2));
}

if (prevStepBtn) {
  prevStepBtn.addEventListener('click', () => goToStep(1));
}

let introProgressTimer = null;
let isIntroTransitioned = false;

function transitionToForm() {
  if (isIntroTransitioned) return;
  isIntroTransitioned = true;
  if (introProgressTimer) clearInterval(introProgressTimer);

  if (introPanel) {
    introPanel.style.opacity = '0';
    introPanel.style.transform = 'translateY(-20px)';
  }

  setTimeout(() => {
    if (introPanel) introPanel.classList.remove('active');
    if (formPanel) formPanel.classList.add('active');
    setTimeout(() => {
      if (nameInput) nameInput.focus();
    }, 150);
  }, 400);
}

if (enterPortalBtn) {
  enterPortalBtn.addEventListener('click', transitionToForm);
}

function startIntroProgress() {
  if (!introProgressBar) return;
  if (introProgressTimer) {
    clearInterval(introProgressTimer);
    introProgressTimer = null;
  }
  introProgressBar.style.width = '0%';
  let step = 0;
  const interval = 25;
  const totalSteps = 2400 / interval;

  introProgressTimer = setInterval(() => {
    step++;
    const progress = (step / totalSteps) * 100;
    introProgressBar.style.width = `${Math.min(progress, 100)}%`;
    if (step >= totalSteps) {
      transitionToForm();
    }
  }, interval);
}

// Initialize combobox components lazily when DOM is ready
let genderCombobox = null;
let partnerGenderCombobox = null;
let categoryCombobox = null;
let flightCombobox = null;
let nationalityCombobox = null;
let partnerNationalityCombobox = null;

function initComboboxes() {
  if (!genderCombobox) genderCombobox = new SearchableCombobox('genderCombobox', 'genderInput', 'genderList');
  if (!partnerGenderCombobox) partnerGenderCombobox = new SearchableCombobox('partnerGenderCombobox', 'partnerGenderInput', 'partnerGenderList');
  if (!categoryCombobox) categoryCombobox = new SearchableCombobox('categoryCombobox', 'categoryInput', 'categoryList');
  if (!flightCombobox) flightCombobox = new SearchableCombobox('flightCombobox', 'flightInput', 'flightList');
  if (!nationalityCombobox) nationalityCombobox = new SearchableCombobox('nationalityCombobox', 'nationalityInput', 'nationalityList');
  if (!partnerNationalityCombobox) partnerNationalityCombobox = new SearchableCombobox('partnerNationalityCombobox', 'partnerNationalityInput', 'partnerNationalityList');
}


/**
 * Parse date strings supporting DD-MM-YYYY, DD/MM/YYYY, and YYYY-MM-DD
 * @param {string} dateStr 
 * @returns {Date|null}
 */
function parseDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const s = dateStr.trim();

  // 1. Format: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
    return null;
  }

  // 2. Format: YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
    return null;
  }

  const fallbackDate = new Date(s);
  return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

// Regex for strict DD-MM-YYYY format
const DOB_REGEX = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-\d{4}$/;

/**
 * Apply auto-formatting mask (DD-MM-YYYY) as digits are typed
 */
function applyDateMask(input, onChangeCallback) {
  if (!input) return;

  input.addEventListener('input', (e) => {
    let cursor = input.selectionStart;
    let raw = input.value.replace(/\D/g, '');
    if (raw.length > 8) raw = raw.slice(0, 8);

    let formatted = '';
    if (raw.length > 4) {
      formatted = `${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(4)}`;
    } else if (raw.length > 2) {
      formatted = `${raw.slice(0, 2)}-${raw.slice(2)}`;
    } else {
      formatted = raw;
    }

    input.value = formatted;

    if (typeof onChangeCallback === 'function') {
      onChangeCallback();
    }
  });
}

/**
 * Date Picker Setup: binds a text DD-MM-YYYY input with native datepicker bridge (works on iOS Safari, Android, Desktop)
 */
function setupDatePicker(textInput, nativePicker, triggerBtn, onDateChanged) {
  if (!textInput || !nativePicker) return;

  // Sync text input (DD-MM-YYYY) to native picker (YYYY-MM-DD)
  function syncTextToNative() {
    const val = textInput.value.trim();
    if (DOB_REGEX.test(val)) {
      const [d, m, y] = val.split('-');
      nativePicker.value = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // Pre-sync when user focuses or touches the datepicker
  nativePicker.addEventListener('focus', syncTextToNative);
  nativePicker.addEventListener('touchstart', syncTextToNative, { passive: true });
  nativePicker.addEventListener('mousedown', syncTextToNative);

  // If button clicked directly (desktop / keyboard)
  if (triggerBtn) {
    triggerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      syncTextToNative();
      if (typeof nativePicker.showPicker === 'function') {
        try {
          nativePicker.showPicker();
        } catch (err) {
          nativePicker.click();
        }
      } else {
        nativePicker.click();
      }
    });
  }

  // When date is selected from calendar picker (handles both 'change' and 'input' for iOS/Android/Desktop)
  const handleDateSelection = () => {
    if (nativePicker.value) {
      const parts = nativePicker.value.split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts;
        textInput.value = `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
        textInput.classList.add('touched');
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
        textInput.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof onDateChanged === 'function') {
          onDateChanged();
        }
      }
    }
  };

  nativePicker.addEventListener('change', handleDateSelection);
  nativePicker.addEventListener('input', handleDateSelection);
}

/**
 * Validate a DOB input field for DD-MM-YYYY format and realistic tournament age
 */
function validateDobField(input, errorElement, label = 'Date of Birth') {
  const val = input ? input.value.trim() : '';
  if (!val) {
    return validateInput(input, errorElement, null, `${label} is required (DD-MM-YYYY).`);
  }
  if (!DOB_REGEX.test(val)) {
    return validateInput(input, errorElement, () => false, `Please enter date in DD-MM-YYYY format.`);
  }
  const parsed = parseDateString(val);
  if (!parsed) {
    return validateInput(input, errorElement, () => false, `Please enter a valid calendar date.`);
  }
  if (parsed > new Date()) {
    return validateInput(input, errorElement, () => false, `${label} cannot be in the future.`);
  }
  const age = calculateAge(val);
  if (age !== null && (age < 4 || age > 99)) {
    return validateInput(input, errorElement, () => false, `Please enter a valid tournament age (4-99 years).`);
  }
  return validateInput(input, errorElement, () => true, '');
}

/**
 * Calculate age based on date of birth string and tournament reference date (Oct 30, 2026)
 */
function calculateAge(dobString, refDateStr = '2026-10-30') {
  if (!dobString) return null;
  const birthDate = parseDateString(dobString);
  if (!birthDate) return null;

  const refDate = parseDateString(refDateStr) || new Date(2026, 9, 30);
  let age = refDate.getFullYear() - birthDate.getFullYear();
  const m = refDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Returns available event categories based on Gender and Age (as of Oct 30, 2026)
 * Driven dynamically by Neon DB backend categories data
 */
function getAvailableCategories(gender, age) {
  const isMale = gender === 'Male';
  const isFemale = gender === 'Female';

  if (Array.isArray(serverCategories) && serverCategories.length > 0) {
    return serverCategories
      .filter(cat => {
        const catGender = cat.gender_allowed || 'Any';
        if (isMale && catGender === 'Female') return false;
        if (isFemale && catGender === 'Male') return false;

        if (age !== null && age !== undefined && !isNaN(age)) {
          if (cat.min_age !== null && cat.min_age !== undefined && age < cat.min_age) return false;
          if (cat.max_age !== null && cat.max_age !== undefined && age > cat.max_age) return false;

          const lowerName = (cat.name || '').toLowerCase();
          if (age > 17 && (lowerName.includes('boys') || lowerName.includes('girls') || lowerName.includes('junior'))) {
            return false;
          }
        }
        return true;
      })
      .map(c => c.name);
  }

  if (isMale) return ["Mens Doubles", "Boys Doubles", "Mixed Doubles"];
  if (isFemale) return ["Womens Doubles", "Girls Doubles", "Mixed Doubles"];
  return ["Mens Doubles", "Womens Doubles", "Mixed Doubles", "Girls Doubles", "Boys Doubles"];
}

/**
 * Returns available level / flight choices based on Category, Gender, and Age
 * Driven dynamically by Neon DB backend levels data
 */
function getAvailableFlights(gender, age, category = '') {
  const cat = (category || '').trim();

  // 1. Mixed Doubles: ALWAYS allows full open flights (International through F6) regardless of primary player gender
  if (cat === 'Mixed Doubles') {
    return ["International", "Premiere", "Championship", "F1", "F2", "F3", "F4", "F5", "F6"];
  }

  // 2. Womens Doubles: Championship through F6
  if (cat === 'Womens Doubles') {
    return ["Championship", "F1", "F2", "F3", "F4", "F5", "F6"];
  }

  // 3. Mens Doubles: International through F6 (+ Masters 35Plus / Veterance 45Plus depending on age)
  if (cat === 'Mens Doubles') {
    const baseMD = ["International", "Premiere", "Championship", "F1", "F2", "F3", "F4", "F5", "F6"];
    if (age !== null && age !== undefined && !isNaN(age)) {
      if (age >= 45) return [...baseMD, "Masters 35Plus", "Veterance 45Plus"];
      if (age >= 35) return [...baseMD, "Masters 35Plus"];
      return baseMD;
    }
    return [...baseMD, "Masters 35Plus", "Veterance 45Plus"];
  }

  // 4. Boys Doubles & Girls Doubles: Junior flight levels (Under 9 through Under 17)
  if (cat === 'Boys Doubles' || cat === 'Girls Doubles') {
    if (age !== null && age !== undefined && !isNaN(age)) {
      if (age <= 9) return ["Under 9", "Under 11", "Under 13", "Under 15", "Under 17"];
      if (age <= 11) return ["Under 11", "Under 13", "Under 15", "Under 17"];
      if (age <= 13) return ["Under 13", "Under 15", "Under 17"];
      if (age <= 15) return ["Under 15", "Under 17"];
      return ["Under 17"];
    }
    return ["Under 9", "Under 11", "Under 13", "Under 15", "Under 17"];
  }

  // 5. Dynamic lookup if custom category defined in database
  if (cat && serverCategoryLevelMap[cat]) {
    return [...serverCategoryLevelMap[cat]];
  }

  // 6. Default flight levels when no category has been selected yet
  return ["International", "Premiere", "Championship", "F1", "F2", "F3", "F4", "F5", "F6", "Masters 35Plus", "Veterance 45Plus"];
}

/**
 * Updates Event Category dropdown choices & Age Badge UI elements based on Gender and DOB
 */
function updateCategoryAndAgeUI() {
  initComboboxes();
  const gender = genderInput ? genderInput.value.trim() : '';
  const dob = dobInput ? dobInput.value.trim() : '';
  const age = calculateAge(dob);

  // 1. Update Age Badges in Step 1 and Step 2
  const step1Badge = document.getElementById('step1AgeBadge');
  const step2Badge = document.getElementById('step2AgeBadge');

  if (age !== null && !isNaN(age)) {
    let tagText = '';
    let tagClass = '';
    if (age <= 17) {
      tagText = 'Junior / Kids (≤17)';
      tagClass = 'junior';
    } else if (age < 35) {
      tagText = 'Open Adult';
      tagClass = 'open';
    } else if (age < 45) {
      tagText = 'Masters (35+)';
      tagClass = 'masters';
    } else {
      tagText = 'Veterans (45+)';
      tagClass = 'veterans';
    }

    const badgeText = `Tournament Age: <strong>${age} yrs</strong> (as of Oct 2026)`;

    [step1Badge, step2Badge].forEach(badge => {
      if (badge) {
        const textEl = badge.querySelector('.age-badge-text');
        const tagEl = badge.querySelector('.age-badge-tag');
        if (textEl) textEl.innerHTML = badgeText;
        if (tagEl) {
          tagEl.textContent = tagText;
          tagEl.className = `age-badge-tag ${tagClass}`;
        }
        badge.classList.remove('hidden');
      }
    });
  } else {
    [step1Badge, step2Badge].forEach(badge => {
      if (badge) badge.classList.add('hidden');
    });
  }

  // 2. Compute available categories
  const categories = getAvailableCategories(gender, age);

  // 3. Update categoryCombobox dropdown options
  if (categoryCombobox) {
    categoryCombobox.updateOptions(categories);
  }

  // 4. Reset category if selected value is no longer in available categories
  const currentCategory = categoryInput ? categoryInput.value.trim() : '';
  if (currentCategory && !categories.includes(currentCategory)) {
    if (categoryCombobox) categoryCombobox.reset();
    checkDoublesCategory();
  }

  // 5. Compute available levels / flights
  const selectedCat = categoryInput ? categoryInput.value.trim() : '';
  const flights = getAvailableFlights(gender, age, selectedCat);

  // 6. Update flightCombobox dropdown options
  if (flightCombobox) {
    flightCombobox.updateOptions(flights);
  }

  // 7. Reset flight if selected value is no longer in available flights
  const currentFlight = flightInput ? flightInput.value.trim() : '';
  if (currentFlight && !flights.includes(currentFlight)) {
    if (flightCombobox) flightCombobox.reset();
  }
}

// Category selection change -> show/hide Doubles Partner card & auto-fill partner gender
categoryInput.addEventListener('input', checkDoublesCategory);
categoryInput.addEventListener('change', checkDoublesCategory);

function checkDoublesCategory() {
  initComboboxes();

  const val = categoryInput.value.trim();

  // Partner section is always visible
  if (partnerSection) {
    partnerSection.classList.remove('hidden');
  }
  partnerNameInput.setAttribute('required', 'required');
  partnerPhoneInput.setAttribute('required', 'required');
  partnerIqamaInput.setAttribute('required', 'required');
  partnerGenderInput.setAttribute('required', 'required');
  partnerDobInput.setAttribute('required', 'required');
  partnerNationalityInput.setAttribute('required', 'required');

  // Auto-set & LOCK partner gender based on category and primary player gender
  const primaryGender = genderInput.value.trim();
  let targetPartnerGender = '';

  if (val.includes('Mixed')) {
    if (primaryGender === 'Male') {
      targetPartnerGender = 'Female';
    } else if (primaryGender === 'Female') {
      targetPartnerGender = 'Male';
    }
  } else if (val.includes("Men") || val.includes("Boys")) {
    targetPartnerGender = 'Male';
  } else if (val.includes("Women") || val.includes("Girls")) {
    targetPartnerGender = 'Female';
  }

  if (targetPartnerGender) {
    partnerGenderCombobox.setValue(targetPartnerGender);
    partnerGenderCombobox.disable();
    const errEl = document.getElementById('partnerGenderError');
    if (errEl) errEl.textContent = '';
  } else {
    partnerGenderCombobox.enable();
  }
}

// Regex Validations
const PHONE_REGEX = /^[0-9]{7,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_REGEX = /^[A-Z0-9]{5,30}$/;

/**
 * Normalizes an Iqama / ID number:
 * Strips all internal and surrounding whitespace, hyphens, underscores and converts to uppercase.
 * Example: 'S 896056' -> 'S896056', 's896056' -> 'S896056', ' s 896056 ' -> 'S896056'
 * @param {string} val
 * @returns {string}
 */
function normalizeId(val) {
  if (!val) return '';
  return String(val).replace(/[\s\-_]/g, '').toUpperCase();
}

/**
 * Validates an Iqama / ID Number (Min 5 characters, alphanumeric, case & space insensitive)
 */
function validateIqamaField(input, errorElement, label) {
  const rawVal = input.value;
  const normalized = normalizeId(rawVal);
  const isRequired = input.hasAttribute('required') || !partnerSection.classList.contains('hidden');

  if (!rawVal.trim()) {
    if (isRequired) {
      return validateInput(input, errorElement, () => false, `${label || 'Iqama / ID Number'} is required.`);
    }
    return true;
  }

  if (normalized.length < 5) {
    return validateInput(input, errorElement, () => false, `${label || 'Iqama / ID Number'} must be at least 5 characters.`);
  }

  if (!ID_REGEX.test(normalized)) {
    return validateInput(input, errorElement, () => false, `Please enter a valid alphanumeric ${label || 'Iqama / ID Number'}.`);
  }

  return validateInput(input, errorElement, () => true, '');
}


/**
 * Validates a single input field
 */
function validateInput(input, errorElement, validationFn, defaultMsg) {
  const value = input.value.trim();
  let isValid = true;
  let customMessage = defaultMsg;

  if (input.hasAttribute('required') && !value) {
    isValid = false;
    customMessage = defaultMsg || 'This field is required.';
  } else if (value && validationFn && !validationFn(value)) {
    isValid = false;
  }

  if (!isValid) {
    input.classList.add('touched');
    input.setCustomValidity(customMessage);
    if (errorElement) {
      errorElement.textContent = customMessage;
    }
  } else {
    input.setCustomValidity('');
    if (errorElement) {
      errorElement.textContent = '';
    }
  }

  return isValid;
}

/**
 * Validates Partner Gender based on selected Event Category and Primary Player Gender
 */
function validatePartnerGender() {
  const input = partnerGenderInput;
  const errorElement = document.getElementById('partnerGenderError');
  if (partnerSection.classList.contains('hidden')) return true;

  const pGender = input.value.trim();
  const primaryGender = genderInput.value.trim();
  const category = categoryInput.value.trim();

  if (!pGender) {
    return validateInput(input, errorElement, null, 'Partner Gender selection is required.');
  }

  if (category.includes("Men") || category.includes("Boys")) {
    if (pGender !== 'Male') {
      return validateInput(input, errorElement, () => false, 'Partner for Mens / Boys Doubles must be Male.');
    }
  } else if (category.includes("Women") || category.includes("Girls")) {
    if (pGender !== 'Female') {
      return validateInput(input, errorElement, () => false, 'Partner for Womens / Girls Doubles must be Female.');
    }
  } else if (category.includes("Mixed")) {
    if (primaryGender === 'Male' && pGender !== 'Female') {
      return validateInput(input, errorElement, () => false, 'Partner for Mixed Doubles must be Female.');
    } else if (primaryGender === 'Female' && pGender !== 'Male') {
      return validateInput(input, errorElement, () => false, 'Partner for Mixed Doubles must be Male.');
    }
  }

  return validateInput(input, errorElement, () => true, '');
}

/**
 * Validates Partner DOB based on DD-MM-YYYY format, calendar validity, and category/flight age limits
 */
function validatePartnerDob() {
  const input = partnerDobInput;
  const errorElement = document.getElementById('partnerDobError');
  if (partnerSection.classList.contains('hidden')) return true;

  const val = input.value.trim();
  if (!val) {
    return validateInput(input, errorElement, null, 'Partner Date of Birth is required (DD-MM-YYYY).');
  }

  if (!DOB_REGEX.test(val)) {
    return validateInput(input, errorElement, () => false, 'Please enter partner date in DD-MM-YYYY format.');
  }

  const birthDate = parseDateString(val);
  if (!birthDate) {
    return validateInput(input, errorElement, () => false, 'Please enter a valid calendar date.');
  }

  if (birthDate > new Date()) {
    return validateInput(input, errorElement, () => false, 'Partner Date of Birth cannot be in the future.');
  }

  const pAge = calculateAge(val);
  const category = categoryInput.value.trim();
  const flight = flightInput.value.trim();

  if (pAge !== null && (pAge < 4 || pAge > 99)) {
    return validateInput(input, errorElement, () => false, 'Please enter a valid partner tournament age (4-99 years).');
  }

  if (flight === 'Under 9' && pAge > 9) {
    return validateInput(input, errorElement, () => false, 'Partner must be age 9 or under for Under 9 level.');
  }
  if (flight === 'Under 11' && pAge > 11) {
    return validateInput(input, errorElement, () => false, 'Partner must be age 11 or under for Under 11 level.');
  }
  if (flight === 'Under 13' && pAge > 13) {
    return validateInput(input, errorElement, () => false, 'Partner must be age 13 or under for Under 13 level.');
  }
  if (flight === 'Under 15' && pAge > 15) {
    return validateInput(input, errorElement, () => false, 'Partner must be age 15 or under for Under 15 level.');
  }
  if ((flight === 'Under 17' || category.includes('Boys') || category.includes('Girls')) && pAge > 17) {
    return validateInput(input, errorElement, () => false, 'Partner must be age 17 or under for junior categories/levels.');
  }
  if (flight === 'Masters 35Plus' && pAge < 35) {
    return validateInput(input, errorElement, () => false, 'Partner must be age 35 or older for Masters 35Plus level.');
  }
  if (flight === 'Veterance 45Plus' && pAge < 45) {
    return validateInput(input, errorElement, () => false, 'Partner must be age 45 or older for Veterance 45Plus level.');
  }

  return validateInput(input, errorElement, () => true, '');
}

function validatePartnerIqama() {
  const input = partnerIqamaInput;
  const errorElement = document.getElementById('partnerIqamaError');
  if (partnerSection.classList.contains('hidden')) return true;

  const rawVal = input.value;
  const normVal = normalizeId(rawVal);
  const normPrimary = normalizeId(iqamaInput.value);

  if (!rawVal.trim()) {
    return validateInput(input, errorElement, () => false, 'Partner Iqama / ID Number is required.');
  }
  if (normVal.length < 5) {
    return validateInput(input, errorElement, () => false, 'Partner Iqama / ID must be at least 5 characters.');
  }
  if (!ID_REGEX.test(normVal)) {
    return validateInput(input, errorElement, () => false, 'Please enter a valid alphanumeric Partner Iqama / ID.');
  }
  if (normPrimary && normVal === normPrimary) {
    return validateInput(input, errorElement, () => false, 'Partner Iqama / ID cannot be the same as Primary player.');
  }

  return validateInput(input, errorElement, () => true, '');
}

function validatePartnerPhone() {
  const input = partnerPhoneInput;
  const errorElement = document.getElementById('partnerPhoneError');
  if (partnerSection.classList.contains('hidden')) return true;

  const val = input.value.trim();
  const primaryPhone = phoneInput.value.trim();

  if (!val) {
    return validateInput(input, errorElement, null, 'Partner Contact Number is required.');
  }
  if (!PHONE_REGEX.test(val)) {
    return validateInput(input, errorElement, () => false, 'Please enter a valid partner contact number (7-15 digits).');
  }
  if (primaryPhone && val === primaryPhone) {
    return validateInput(input, errorElement, () => false, 'Partner Contact Number cannot be the same as Primary player.');
  }

  return validateInput(input, errorElement, () => true, '');
}

function validatePartnerNationality() {
  const input = partnerNationalityInput;
  const errorElement = document.getElementById('partnerNationalityError');
  if (partnerSection.classList.contains('hidden')) return true;

  const val = input.value.trim();
  if (!val) {
    return validateInput(input, errorElement, null, 'Partner Nationality is required for Doubles.');
  }

  return validateInput(input, errorElement, () => true, '');
}

// Event Listeners for Primary Player Details
nameInput.addEventListener('blur', () => validateInput(nameInput, document.getElementById('nameError'), null, 'Full Name is required.'));
nameInput.addEventListener('input', () => {
  if (nameInput.classList.contains('touched')) {
    validateInput(nameInput, document.getElementById('nameError'), null, 'Full Name is required.');
  }
});

phoneInput.addEventListener('blur', () => validateInput(phoneInput, document.getElementById('phoneError'), (val) => PHONE_REGEX.test(val), 'Please enter a valid phone number (7-15 digits).'));
phoneInput.addEventListener('input', () => {
  phoneInput.value = phoneInput.value.replace(/[^0-9]/g, '');
  if (phoneInput.classList.contains('touched')) {
    validateInput(phoneInput, document.getElementById('phoneError'), (val) => PHONE_REGEX.test(val), 'Please enter a valid phone number (7-15 digits).');
  }
});

emailInput.addEventListener('blur', () => validateInput(emailInput, document.getElementById('emailError'), (val) => EMAIL_REGEX.test(val), 'Please enter a valid email address.'));
emailInput.addEventListener('input', () => {
  if (emailInput.classList.contains('touched')) {
    validateInput(emailInput, document.getElementById('emailError'), (val) => EMAIL_REGEX.test(val), 'Please enter a valid email address.');
  }
});

iqamaInput.addEventListener('blur', () => {
  if (iqamaInput.value) iqamaInput.value = normalizeId(iqamaInput.value);
  validateIqamaField(iqamaInput, document.getElementById('iqamaError'), 'Iqama / ID Number');
  if (!partnerSection.classList.contains('hidden') && partnerIqamaInput.value) {
    validatePartnerIqama();
  }
});
iqamaInput.addEventListener('input', () => {
  iqamaInput.value = iqamaInput.value.replace(/[^a-zA-Z0-9\s\-_]/g, '');
  if (iqamaInput.classList.contains('touched')) {
    validateIqamaField(iqamaInput, document.getElementById('iqamaError'), 'Iqama / ID Number');
  }
  if (!partnerSection.classList.contains('hidden') && partnerIqamaInput.classList.contains('touched')) {
    validatePartnerIqama();
  }
});

// Event Listeners for Validation and Dynamic Category Population
genderInput.addEventListener('blur', () => validateInput(genderInput, document.getElementById('genderError'), null, 'Gender selection is required.'));
genderInput.addEventListener('change', () => {
  validateInput(genderInput, document.getElementById('genderError'), null, 'Gender selection is required.');
  updateCategoryAndAgeUI();
  checkDoublesCategory();
  validatePartnerGender();
});

// Auto-mask DD-MM-YYYY format and date picker for Date of Birth inputs
applyDateMask(dobInput, () => {
  updateCategoryAndAgeUI();
  if (dobInput.classList.contains('touched')) {
    validateDobField(dobInput, document.getElementById('dobError'), 'Date of Birth');
  }
});

setupDatePicker(dobInput, dobNativePicker, dobPickerBtn, () => {
  validateDobField(dobInput, document.getElementById('dobError'), 'Date of Birth');
  updateCategoryAndAgeUI();
  validatePartnerDob();
});

applyDateMask(partnerDobInput, () => {
  if (partnerDobInput.classList.contains('touched')) {
    validatePartnerDob();
  }
});

setupDatePicker(partnerDobInput, partnerDobNativePicker, partnerDobPickerBtn, () => {
  validatePartnerDob();
});

dobInput.addEventListener('focus', () => {
  dobInput.placeholder = 'DD-MM-YYYY';
});
dobInput.addEventListener('blur', () => {
  if (!dobInput.value.trim()) dobInput.placeholder = ' ';
  validateDobField(dobInput, document.getElementById('dobError'), 'Date of Birth');
});
dobInput.addEventListener('change', () => {
  validateDobField(dobInput, document.getElementById('dobError'), 'Date of Birth');
  updateCategoryAndAgeUI();
  validatePartnerDob();
});

partnerDobInput.addEventListener('focus', () => {
  partnerDobInput.placeholder = 'DD-MM-YYYY';
});
partnerDobInput.addEventListener('blur', () => {
  if (!partnerDobInput.value.trim()) partnerDobInput.placeholder = ' ';
  validatePartnerDob();
});
partnerDobInput.addEventListener('change', () => {
  validatePartnerDob();
});

nationalityInput.addEventListener('blur', () => validateInput(nationalityInput, document.getElementById('nationalityError'), null, 'Nationality is required.'));
nationalityInput.addEventListener('input', () => nationalityInput.classList.contains('touched') && validateInput(nationalityInput, document.getElementById('nationalityError'), null, 'Nationality is required.'));

clubInput.addEventListener('blur', () => validateInput(clubInput, document.getElementById('clubError'), null, 'Country or Club Name is required.'));
clubInput.addEventListener('input', () => clubInput.classList.contains('touched') && validateInput(clubInput, document.getElementById('clubError'), null, 'Country or Club Name is required.'));

categoryInput.addEventListener('blur', () => validateInput(categoryInput, document.getElementById('categoryError'), null, 'Event category selection is required.'));
categoryInput.addEventListener('input', () => {
  categoryInput.classList.contains('touched') && validateInput(categoryInput, document.getElementById('categoryError'), null, 'Event category selection is required.');
  updateCategoryAndAgeUI();
  validatePartnerGender();
  validatePartnerDob();
});
categoryInput.addEventListener('change', () => {
  updateCategoryAndAgeUI();
  validatePartnerGender();
  validatePartnerDob();
});

flightInput.addEventListener('blur', () => validateInput(flightInput, document.getElementById('flightError'), null, 'Level selection is required.'));
flightInput.addEventListener('input', () => {
  flightInput.classList.contains('touched') && validateInput(flightInput, document.getElementById('flightError'), null, 'Level selection is required.');
  validatePartnerDob();
  validatePartnerGender();
});
flightInput.addEventListener('change', () => {
  validatePartnerDob();
  validatePartnerGender();
});

partnerNameInput.addEventListener('blur', () => {
  if (!partnerSection.classList.contains('hidden')) {
    validateInput(partnerNameInput, document.getElementById('partnerNameError'), null, 'Partner Name is required for Doubles.');
  }
});

partnerPhoneInput.addEventListener('blur', () => {
  validatePartnerPhone();
});
partnerPhoneInput.addEventListener('input', () => {
  partnerPhoneInput.value = partnerPhoneInput.value.replace(/[^0-9]/g, '');
  if (!partnerSection.classList.contains('hidden') && partnerPhoneInput.classList.contains('touched')) {
    validatePartnerPhone();
  }
});

partnerIqamaInput.addEventListener('blur', () => {
  if (partnerIqamaInput.value) partnerIqamaInput.value = normalizeId(partnerIqamaInput.value);
  validatePartnerIqama();
});
partnerIqamaInput.addEventListener('input', () => {
  partnerIqamaInput.value = partnerIqamaInput.value.replace(/[^a-zA-Z0-9\s\-_]/g, '');
  if (!partnerSection.classList.contains('hidden') && partnerIqamaInput.classList.contains('touched')) {
    validatePartnerIqama();
  }
});

partnerGenderInput.addEventListener('blur', () => {
  validatePartnerGender();
});
partnerGenderInput.addEventListener('change', () => {
  validatePartnerGender();
});

partnerDobInput.addEventListener('input', () => {
  if (partnerDobInput.classList.contains('touched')) {
    validatePartnerDob();
  }
});

partnerNationalityInput.addEventListener('blur', () => {
  validatePartnerNationality();
});
partnerNationalityInput.addEventListener('input', () => {
  if (!partnerSection.classList.contains('hidden') && partnerNationalityInput.classList.contains('touched')) {
    validatePartnerNationality();
  }
});

/**
 * Handle form submission
 */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Guard against submission while still on Step 1
  if (step1 && step1.classList.contains('active')) {
    return;
  }

  generalError.classList.add('hidden');

  const isStep1Valid = validateStep1();
  if (!isStep1Valid) {
    goToStep(1);
    return;
  }

  const isCategoryValid = validateInput(categoryInput, document.getElementById('categoryError'), null, 'Event category selection is required.');
  const isFlightValid = validateInput(flightInput, document.getElementById('flightError'), null, 'Level selection is required.');

  let isPartnerValid = true;
  if (!partnerSection.classList.contains('hidden')) {
    const isPNameValid = validateInput(partnerNameInput, document.getElementById('partnerNameError'), null, 'Partner Name is required for Doubles.');
    const isPPhoneValid = validatePartnerPhone();
    const isPIqamaValid = validatePartnerIqama();
    const isPGenderValid = validatePartnerGender();
    const isPDobValid = validatePartnerDob();
    const isPNationalityValid = validatePartnerNationality();
    isPartnerValid = isPNameValid && isPPhoneValid && isPIqamaValid && isPGenderValid && isPDobValid && isPNationalityValid;
  }

  if (!isCategoryValid || !isFlightValid || !isPartnerValid) {
    [categoryInput, flightInput].forEach(inp => inp.classList.add('touched'));
    if (!partnerSection.classList.contains('hidden')) {
      [partnerNameInput, partnerPhoneInput, partnerIqamaInput, partnerGenderInput, partnerDobInput, partnerNationalityInput].forEach(inp => inp.classList.add('touched'));
    }
    return;
  }

  setSubmittingState(true);

  const primaryCodeEl = document.getElementById('countryCodeSelect');
  const primaryCode = primaryCodeEl ? primaryCodeEl.value.replace('+', '') : '966';

  const partnerCodeEl = document.getElementById('partnerCountryCodeSelect');
  const partnerCode = partnerCodeEl ? partnerCodeEl.value.replace('+', '') : '966';

  const rawPhone = phoneInput.value.trim().replace(/^0+/, '');
  const rawPartnerPhone = partnerPhoneInput.value.trim().replace(/^0+/, '');

  const payload = {
    name: nameInput.value.trim(),
    phone: primaryCode + rawPhone,
    email: emailInput.value.trim(),
    iqama: normalizeId(iqamaInput.value),
    gender: genderInput.value.trim(),
    dob: dobInput.value.trim(),
    nationality: nationalityInput.value.trim(),
    club: clubInput.value.trim(),
    category: categoryInput.value.trim(),
    flight: flightInput.value.trim(),
    partnerName: partnerSection.classList.contains('hidden') ? '' : partnerNameInput.value.trim(),
    partnerPhone: partnerSection.classList.contains('hidden') ? '' : partnerCode + rawPartnerPhone,
    partnerIqama: partnerSection.classList.contains('hidden') ? '' : normalizeId(partnerIqamaInput.value),
    partnerGender: partnerSection.classList.contains('hidden') ? '' : partnerGenderInput.value.trim(),
    partnerDob: partnerSection.classList.contains('hidden') ? '' : partnerDobInput.value.trim(),
    partnerNationality: partnerSection.classList.contains('hidden') ? '' : partnerNationalityInput.value.trim()
  };

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok && result && result.status === 'success') {
      showSuccess(result, payload);
    } else {
      showError(result.message || `Server returned error (${response.status}). Please check your details and try again.`);
    }
  } catch (error) {
    console.error('Submission failed:', error);
    showError(error.message || 'Unable to connect to the server. Please verify backend connection.');
  } finally {
    setSubmittingState(false);
  }
});

function setSubmittingState(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  [nameInput, phoneInput, emailInput, iqamaInput, genderInput, dobInput, nationalityInput, clubInput, categoryInput, flightInput, partnerNameInput, partnerPhoneInput, partnerIqamaInput, partnerGenderInput, partnerDobInput, partnerNationalityInput].forEach(inp => inp.disabled = isSubmitting);

  if (isSubmitting) {
    btnText.textContent = 'Submitting Entry...';
    spinner.classList.remove('hidden');
  } else {
    btnText.textContent = 'Submit Tournament Entry';
    spinner.classList.add('hidden');
  }
}

function showSuccess(result, payload) {
  const cardsContainer = document.getElementById('successPlayerCards');
  const teamIdEl = document.getElementById('successTeamId');
  const catFlightEl = document.getElementById('successCategoryFlight');
  const mainNameEl = document.getElementById('successMainName');
  const mainIdEl = document.getElementById('successMainId');
  const partnerCard = document.getElementById('successPartnerCard');
  const partnerNameEl = document.getElementById('successPartnerName');
  const partnerIdEl = document.getElementById('successPartnerId');

  const teamId = (result && result.teamId) || (result && result.data && result.data.teamId) || 'T1001';
  const mainId = (result && result.playerId) || (result && result.data && result.data.playerId) || '----';
  const partnerId = (result && result.partnerPlayerId) || (result && result.data && result.data.partnerPlayerId) || null;
  const mainName = (payload && payload.name) || (result && result.data && result.data.name) || 'Player';
  const partnerName = (payload && payload.partnerName) || (result && result.data && result.data.partnerName) || '';
  const category = (payload && payload.category) || (result && result.data && result.data.category) || '';
  const flight = (payload && payload.flight) || (result && result.data && result.data.flight) || '';

  if (teamIdEl) teamIdEl.textContent = teamId;
  if (catFlightEl) catFlightEl.textContent = category && flight ? `${category} • ${flight}` : category || flight || '';
  if (mainNameEl) mainNameEl.textContent = mainName;
  if (mainIdEl) mainIdEl.textContent = `#${mainId}`;

  if (partnerCard) {
    if (partnerId && partnerName) {
      partnerCard.classList.remove('hidden');
      if (partnerNameEl) partnerNameEl.textContent = partnerName;
      if (partnerIdEl) partnerIdEl.textContent = `#${partnerId}`;
    } else {
      partnerCard.classList.add('hidden');
    }
  }

  if (cardsContainer) cardsContainer.classList.remove('hidden');

  const waBtn = document.getElementById('successWhatsAppBtn');
  if (waBtn) {
    const waNum = window.WHATSAPP_NUMBER || '966569407699';
    const msgText = `Hi, I have an inquiry about my tournament entry for Navodaya Open 2026.\nTeam ID: ${teamId}\nPlayer: ${mainName}\nCategory: ${category}${flight ? ' (' + flight + ')' : ''}`;
    waBtn.href = `https://wa.me/${waNum}?text=${encodeURIComponent(msgText)}`;
  }

  formPanel.classList.remove('active');
  setTimeout(() => {
    successPanel.classList.add('active');
  }, 300);
}

function showError(msg) {
  errorMessage.textContent = msg;
  generalError.classList.remove('hidden');
  generalError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Reset form state and return to the Intro Splash screen
 */
function resetToIntro() {
  form.reset();

  if (genderCombobox) genderCombobox.reset();
  if (partnerGenderCombobox) partnerGenderCombobox.reset();
  if (categoryCombobox) categoryCombobox.reset();
  if (flightCombobox) flightCombobox.reset();
  if (nationalityCombobox) nationalityCombobox.reset();
  if (partnerNationalityCombobox) partnerNationalityCombobox.reset();

  if (dobNativePicker) dobNativePicker.value = '';
  if (partnerDobNativePicker) partnerDobNativePicker.value = '';

  if (partnerSection) partnerSection.classList.remove('hidden');
  updateCategoryAndAgeUI();

  [nameInput, phoneInput, emailInput, iqamaInput, genderInput, dobInput, nationalityInput, clubInput, categoryInput, flightInput, partnerNameInput, partnerPhoneInput, partnerIqamaInput, partnerGenderInput, partnerDobInput, partnerNationalityInput].forEach(inp => {
    if (inp) {
      inp.classList.remove('touched');
      inp.disabled = false;
    }
  });

  goToStep(1);

  if (successPanel) successPanel.classList.remove('active');
  if (formPanel) formPanel.classList.remove('active');
  if (generalError) generalError.classList.add('hidden');

  setTimeout(() => {
    isIntroTransitioned = false;
    if (introPanel) {
      introPanel.style.opacity = '';
      introPanel.style.transform = '';
      introPanel.classList.add('active');
    }
    startIntroProgress();
  }, 250);
}

if (resetBtn) {
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetToIntro();
  });
}

if (successPanel) {
  successPanel.addEventListener('click', () => {
    resetToIntro();
  });
}

/**
 * Closes any currently open combobox dropdown menus
 */
function closeAllComboboxes() {
  [genderCombobox, partnerGenderCombobox, categoryCombobox, flightCombobox, nationalityCombobox, partnerNationalityCombobox].forEach(cb => {
    if (cb && cb.isOpen) {
      cb.close();
    }
  });
}

/**
 * Smoothly scroll an element into proper vertical visibility in the viewport
 * when focused or navigating via Enter key above virtual mobile keyboards.
 */
function scrollIntoProperVisibility(el) {
  if (!el) return;
  setTimeout(() => {
    try {
      const wrapper = el.closest('.input-group') || el;
      wrapper.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    } catch (err) {
      el.scrollIntoView(false);
    }
  }, 100);
}

/**
 * Fast Keyboard Navigation & Enter-Key Behavior
 * Allows operators to rapidly type and advance focus through form fields within each step.
 */
function focusNextInput(currentInput) {
  if (!currentInput) return;
  closeAllComboboxes();

  const isStep1Active = step1 && step1.classList.contains('active');
  const isStep2Active = step2 && step2.classList.contains('active');

  if (isStep1Active) {
    const step1Inputs = [
      nameInput,
      phoneInput,
      emailInput,
      iqamaInput,
      genderInput,
      dobInput,
      nationalityInput,
      clubInput
    ].filter(el => el && !el.disabled && el.offsetParent !== null);

    const idx = step1Inputs.indexOf(currentInput);

    if (idx >= 0 && idx < step1Inputs.length - 1) {
      const next = step1Inputs[idx + 1];
      next.focus();
      scrollIntoProperVisibility(next);
      if (next === genderInput && genderCombobox && !genderInput.value) {
        genderCombobox.open();
      } else if (next === nationalityInput && nationalityCombobox && !nationalityInput.value) {
        nationalityCombobox.open();
      }
    } else if (idx === step1Inputs.length - 1 || currentInput === clubInput) {
      // Last field in Step 1 (City / Club name):
      // Move focus to Next button without automatically switching steps
      if (nextStepBtn) {
        nextStepBtn.focus();
        scrollIntoProperVisibility(nextStepBtn);
      }
    }
  } else if (isStep2Active) {
    const step2Inputs = [
      categoryInput,
      flightInput
    ];

    if (partnerSection && !partnerSection.classList.contains('hidden')) {
      step2Inputs.push(
        partnerNameInput,
        partnerPhoneInput,
        partnerIqamaInput
      );
      if (partnerGenderCombobox && !partnerGenderCombobox.isDisabled && partnerGenderInput && !partnerGenderInput.disabled) {
        step2Inputs.push(partnerGenderInput);
      }
      step2Inputs.push(
        partnerDobInput,
        partnerNationalityInput
      );
    }

    const validInputs = step2Inputs.filter(el => el && !el.disabled && el.offsetParent !== null);
    const idx = validInputs.indexOf(currentInput);

    if (idx >= 0 && idx < validInputs.length - 1) {
      const next = validInputs[idx + 1];
      next.focus();
      scrollIntoProperVisibility(next);
      if (next === flightInput && flightCombobox && !flightInput.value) {
        flightCombobox.open();
      } else if (next === partnerGenderInput && partnerGenderCombobox && !partnerGenderInput.value) {
        partnerGenderCombobox.open();
      } else if (next === partnerNationalityInput && partnerNationalityCombobox && !partnerNationalityInput.value) {
        partnerNationalityCombobox.open();
      }
    } else if (idx === validInputs.length - 1 || currentInput === validInputs[validInputs.length - 1]) {
      // Last field in Step 2:
      // Move focus to Submit button without automatically submitting
      if (submitBtn) {
        submitBtn.focus();
        scrollIntoProperVisibility(submitBtn);
      }
    }
  }
}

// Automatically ensure focused inputs scroll into center of view above virtual keyboard
[
  nameInput, phoneInput, emailInput, iqamaInput, genderInput, dobInput, nationalityInput, clubInput,
  categoryInput, flightInput, partnerNameInput, partnerPhoneInput, partnerIqamaInput,
  partnerGenderInput, partnerDobInput, partnerNationalityInput
].forEach(inp => {
  if (!inp) return;
  inp.addEventListener('focus', () => {
    scrollIntoProperVisibility(inp);
  });
});

// Bind Enter key listener on standard text/number/tel/email inputs
[
  nameInput,
  phoneInput,
  emailInput,
  iqamaInput,
  dobInput,
  clubInput,
  partnerNameInput,
  partnerPhoneInput,
  partnerIqamaInput,
  partnerDobInput
].forEach(input => {
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      focusNextInput(input);
    }
  });
});

// Prevent Enter key in form inputs and dropdowns from triggering implicit form submissions
if (form) {
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) {
        if (target.type !== 'submit') {
          e.preventDefault();
        }
      }
    }
  });
}

// Bind Enter key on country code selectors to move focus to phone
const countryCodeSelect = document.getElementById('countryCodeSelect');
if (countryCodeSelect) {
  countryCodeSelect.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (phoneInput) {
        phoneInput.focus();
        scrollIntoProperVisibility(phoneInput);
      }
    }
  });
}

const partnerCountryCodeSelect = document.getElementById('partnerCountryCodeSelect');
if (partnerCountryCodeSelect) {
  partnerCountryCodeSelect.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (partnerPhoneInput) partnerPhoneInput.focus();
    }
  });
}

// Global Enter key behavior on intro and success screens for quick workflow
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (introPanel && introPanel.classList.contains('active')) {
      e.preventDefault();
      transitionToForm();
    } else if (successPanel && successPanel.classList.contains('active')) {
      e.preventDefault();
      resetToIntro();
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  startIntroProgress();
  updateCategoryAndAgeUI();
  fetchTournamentConfig();
  updateOnlineStatus();
});

// ==========================================
// Progressive Web App (PWA) Management
// ==========================================

// 1. Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('PWA Service Worker registration skipped or failed:', err);
      });
  });
}

// 2. PWA Install Prompt Logic
let deferredInstallPrompt = null;
const pwaInstallBanner = document.getElementById('pwaInstallBanner');
const pwaInstallBtn = document.getElementById('pwaInstallBtn');
const pwaDismissBtn = document.getElementById('pwaDismissBtn');
const offlineToast = document.getElementById('offlineToast');

const isRunningStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;

  if (!isRunningStandalone && !sessionStorage.getItem('pwa_dismissed')) {
    if (pwaInstallBanner) {
      setTimeout(() => {
        pwaInstallBanner.classList.remove('hidden');
      }, 1200);
    }
  }
});

if (pwaInstallBtn) {
  pwaInstallBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    if (pwaInstallBanner) pwaInstallBanner.classList.add('hidden');
    deferredInstallPrompt.prompt();
    try {
      const choice = await deferredInstallPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        deferredInstallPrompt = null;
      }
    } catch (err) {
      console.warn('PWA Install choice error:', err);
    }
  });
}

if (pwaDismissBtn) {
  pwaDismissBtn.addEventListener('click', () => {
    if (pwaInstallBanner) pwaInstallBanner.classList.add('hidden');
    sessionStorage.setItem('pwa_dismissed', 'true');
  });
}

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  if (pwaInstallBanner) pwaInstallBanner.classList.add('hidden');
});

// 3. Network Online/Offline Indicators
function updateOnlineStatus() {
  if (!offlineToast) return;
  if (!navigator.onLine) {
    offlineToast.classList.remove('hidden');
  } else {
    offlineToast.classList.add('hidden');
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);



