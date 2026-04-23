// ─────────────────────────────────────────────────────────────────────────────
//  CRAMS-AMS · Dashboard Page
//  Place in: src/pages/Dashboard.<your-page-id>.js
//
//  Element IDs required on this page:
//    #accountName      → Text element showing logged-in user's display name
//    #logoutBtn        → Logout button
//    #table1           → Main leads data table
//    #startDatePicker  → Start date picker
//    #endDatePicker    → End date picker
//    #allDatesBtn      → Quick filter: all dates
//    #lastMonthBtn     → Quick filter: last month
//    #last2WeekBtn     → Quick filter: last 2 weeks
//    #lastWeekBtn      → Quick filter: last week
//    #filterCampaignDrop → Filter by campaign (ad_name)
//    #filterShowroomDrop → Filter by branch
//    #filterVehicleDrop  → Filter by model
//    #filterSourceDrop   → Filter by source
//
//  Session storage keys read:
//    "crams_session_hash"  → verified against backend hashMap
//    "crams_username"      → used for verifyCookie()
//    "crams_display_name"  → shown in #accountName
// ─────────────────────────────────────────────────────────────────────────────

import { verifyCookie } from 'backend/login-verification.web.js';
import { session as storage } from 'wix-storage';
import { to } from 'wix-location';
import wixData from 'wix-data';

// ─────────────────────────────────────────────────────────────────────────────
//  GLOBALS
// ─────────────────────────────────────────────────────────────────────────────
const COLLECTION = 'PolarisLeads';

let allItems      = [];   // full unfiltered result set
let filterCampaign  = null;
let filterBranch    = null;
let filterModel     = null;
let filterSource    = null;
let filterStartDate = null;
let filterEndDate   = null;

// ─────────────────────────────────────────────────────────────────────────────
//  TABLE COLUMNS
//  Adjust width values to suit your page layout.
// ─────────────────────────────────────────────────────────────────────────────
const TABLE_COLUMNS = [
    { id: 'c1',  dataPath: 'received',         label: 'Received',          type: 'string', width: 130 },
    { id: 'c2',  dataPath: 'fullName',          label: 'Name',              type: 'string', width: 150 },
    { id: 'c3',  dataPath: 'phone',             label: 'Phone',             type: 'string', width: 130 },
    { id: 'c4',  dataPath: 'email',             label: 'Email',             type: 'string', width: 180 },
    { id: 'c5',  dataPath: 'model',             label: 'Model',             type: 'string', width: 120 },
    { id: 'c6',  dataPath: 'branch',            label: 'Branch',            type: 'string', width: 130 },
    { id: 'c7',  dataPath: 'campaign',          label: 'Campaign',          type: 'string', width: 150 },
    { id: 'c8',  dataPath: 'status',            label: 'Status',            type: 'string', width: 100 },
    { id: 'c9',  dataPath: 'salesExec',         label: 'Sales Exec',        type: 'string', width: 120 },
    { id: 'c10', dataPath: 'preferredChannel',  label: 'Pref. Channel',     type: 'string', width: 110 },
    { id: 'c11', dataPath: 'preferredTime',     label: 'Pref. Time',        type: 'string', width: 100 },
    { id: 'c12', dataPath: 'source',            label: 'Source',            type: 'string', width: 110 },
];

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────────────
$w.onReady(async function () {

    // 1. Verify session — redirect to login if invalid
    const username    = storage.getItem('crams_username');
    const sessionHash = storage.getItem('crams_session_hash');

    if (!username || !sessionHash) {
        to('/');
        return;
    }

    const auth = await verifyCookie(username, sessionHash);
    if (auth.status !== 200) {
        clearSession();
        to('/');
        return;
    }

    // 2. Show display name
    $w('#accountName').text = storage.getItem('crams_display_name') || username;

    // 3. Set up table columns
    $w('#table1').columns = TABLE_COLUMNS;

    // 4. Load all leads
    await loadLeads();

    // 5. Disable end date picker until start is chosen
    $w('#endDatePicker').disable();
});

// ─────────────────────────────────────────────────────────────────────────────
//  LOAD & RENDER
// ─────────────────────────────────────────────────────────────────────────────
async function loadLeads() {
    try {
        const result = await wixData
            .query(COLLECTION)
            .descending('received')
            .limit(1000)
            .find({ suppressAuth: true });

        allItems = result.items;
        populateFilterOptions(allItems);
        renderTable(allItems);
    } catch (err) {
        console.error('Failed to load leads:', err);
    }
}

function renderTable(items) {
    $w('#table1').rows = items.map(item => ({
        received:        item.received        || '',
        fullName:        item.fullName        || '',
        phone:           item.phone           || '',
        email:           item.email           || '',
        model:           item.model           || '',
        branch:          item.branch          || '',
        campaign:        item.campaign        || '',
        status:          item.status          || '',
        salesExec:       item.salesExec       || '',
        preferredChannel:item.preferredChannel|| '',
        preferredTime:   item.preferredTime   || '',
        source:          item.source          || '',
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
//  FILTERING
//  All filtering is done client-side against allItems for speed.
//  With large datasets (>1000 rows) switch to server-side wixData queries.
// ─────────────────────────────────────────────────────────────────────────────
function applyFilters() {
    let filtered = allItems;

    if (filterCampaign) {
        filtered = filtered.filter(i => i.campaign === filterCampaign);
    }
    if (filterBranch) {
        filtered = filtered.filter(i => i.branch === filterBranch);
    }
    if (filterModel) {
        filtered = filtered.filter(i => i.model === filterModel);
    }
    if (filterSource) {
        filtered = filtered.filter(i => i.source === filterSource);
    }
    if (filterStartDate) {
        filtered = filtered.filter(i => i.received && i.received >= filterStartDate);
    }
    if (filterEndDate) {
        // received is "YYYY-MM-DD HH:MM" — end date "YYYY-MM-DD" compares correctly
        // because "2025-04-30" < "2025-04-30 23:59" alphabetically
        const endInclusive = filterEndDate + ' 23:59';
        filtered = filtered.filter(i => i.received && i.received <= endInclusive);
    }

    renderTable(filtered);
}

// Populate dropdowns with unique values from the full dataset
function populateFilterOptions(items) {
    const unique = (key) => ['All', ...new Set(items.map(i => i[key]).filter(Boolean))];

    const toOptions = (values) => values.map(v => ({ label: v, value: v === 'All' ? '' : v }));

    $w('#filterCampaignDrop').options  = toOptions(unique('campaign'));
    $w('#filterShowroomDrop').options  = toOptions(unique('branch'));
    $w('#filterVehicleDrop').options   = toOptions(unique('model'));
    $w('#filterSourceDrop').options    = toOptions(unique('source'));
}

// ─────────────────────────────────────────────────────────────────────────────
//  FILTER EVENT LISTENERS
// ─────────────────────────────────────────────────────────────────────────────
$w('#filterCampaignDrop').onChange((e) => {
    filterCampaign = e.target.value || null;
    applyFilters();
});

$w('#filterShowroomDrop').onChange((e) => {
    filterBranch = e.target.value || null;
    applyFilters();
});

$w('#filterVehicleDrop').onChange((e) => {
    filterModel = e.target.value || null;
    applyFilters();
});

$w('#filterSourceDrop').onChange((e) => {
    filterSource = e.target.value || null;
    applyFilters();
});

// ─────────────────────────────────────────────────────────────────────────────
//  DATE FILTERS
// ─────────────────────────────────────────────────────────────────────────────
$w('#startDatePicker').onChange((e) => {
    filterStartDate = toDateString(e.target.value);
    $w('#endDatePicker').minDate = e.target.value;
    $w('#endDatePicker').enable();
    enableAllDateBtns();
    applyFilters();
});

$w('#endDatePicker').onChange((e) => {
    filterEndDate = toDateString(e.target.value);
    enableAllDateBtns();
    applyFilters();
});

$w('#lastWeekBtn').onClick((e) => {
    const [start, end] = quickDateRange(7);
    setQuickDateFilter(start, end, e.target);
});

$w('#last2WeekBtn').onClick((e) => {
    const [start, end] = quickDateRange(14);
    setQuickDateFilter(start, end, e.target);
});

$w('#lastMonthBtn').onClick((e) => {
    const [start, end] = quickDateRange(30);
    setQuickDateFilter(start, end, e.target);
});

$w('#allDatesBtn').onClick((e) => {
    filterStartDate = null;
    filterEndDate   = null;
    $w('#startDatePicker').value = null;
    $w('#endDatePicker').value   = null;
    $w('#endDatePicker').disable();
    enableAllDateBtns();
    e.target.disable();
    applyFilters();
});

// ─────────────────────────────────────────────────────────────────────────────
//  LOGOUT
// ─────────────────────────────────────────────────────────────────────────────
$w('#logoutBtn').onClick(() => {
    clearSession();
    to('/');
});

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function clearSession() {
    storage.removeItem('crams_session_hash');
    storage.removeItem('crams_username');
    storage.removeItem('crams_role');
    storage.removeItem('crams_display_name');
}

function toDateString(dateValue) {
    if (!dateValue) return null;
    const d = new Date(dateValue);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Returns [startDateStr, endDateStr] for the last N days
function quickDateRange(days) {
    const end   = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    return [toDateString(start), toDateString(end)];
}

function setQuickDateFilter(start, end, clickedBtn) {
    filterStartDate = start;
    filterEndDate   = end;
    $w('#startDatePicker').value = null;
    $w('#endDatePicker').value   = null;
    $w('#endDatePicker').disable();
    enableAllDateBtns();
    clickedBtn.disable();
    applyFilters();
}

function enableAllDateBtns() {
    [$w('#lastWeekBtn'), $w('#last2WeekBtn'), $w('#lastMonthBtn'), $w('#allDatesBtn')]
        .forEach(btn => btn.enable());
}