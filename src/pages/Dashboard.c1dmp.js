//@ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
//  CRAMS - AMS - Dashboard Page
//
//  Element IDs required on this page:
//    #accountName        → Text showing logged-in user's display name
//    #logoutBtn          → Logout button
//    #table1             → Main leads data table
//    #tableViewSwitch    → Toggle switch element (Simple / Full view)
//    #tableViewTxt       → Text element next to switch showing current view label
//    #generateCSV        → Button to download current filtered data as CSV
//    #clearFiltersBtn    → Button to reset all filters
//    #sortDateDrop       → Dropdown: "Ascending" | "Descending"
//    #startDatePicker    → Start date picker
//    #endDatePicker      → End date picker
//    #allDatesBtn        → Quick filter: all dates
//    #lastMonthBtn       → Quick filter: last month (~30 days)
//    #last2WeekBtn       → Quick filter: last 2 weeks
//    #lastWeekBtn        → Quick filter: last week
//    #filterCampaignDrop → Filter by campaign
//    #filterShowroomDrop → Filter by branch
//    #filterVehicleDrop  → Filter by model
//    #filterSourceDrop   → Filter by source
//    #htmlDownloader     → HTML iframe element used for CSV download trigger
// ─────────────────────────────────────────────────────────────────────────────

import { verifyCookie } from 'backend/login-verification.web.js';
import { session as storage } from 'wix-storage';
import { to } from 'wix-location';
import wixData from 'wix-data';

// ─────────────────────────────────────────────────────────────────────────────
//  GLOBALS
// ─────────────────────────────────────────────────────────────────────────────
const COLLECTION = 'PolarisLeads';

let allItems        = [];   // full unfiltered dataset
let currentFiltered = [];   // currently displayed (filtered + sorted) rows
let sortAscending   = false;

let filterCampaign  = null;
let filterBranch    = null;
let filterModel     = null;
let filterSource    = null;
let filterStartDate = null;
let filterEndDate   = null;

// ─────────────────────────────────────────────────────────────────────────────
//  TABLE COLUMN DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const SIMPLE_COLUMNS = [
    { id: 'c1',  dataPath: 'created',           label: 'Created',           type: 'string', width: 120 },
    { id: 'c2',  dataPath: 'source',            label: 'Source',            type: 'string', width: 100 },
    { id: 'c3',  dataPath: 'campaign',          label: 'Campaign',          type: 'string', width: 150 },
    { id: 'c4',  dataPath: 'salesExec',         label: 'Sales Exec',        type: 'string', width: 150 },
    { id: 'c5',  dataPath: 'fullName',          label: 'Name',              type: 'string', width: 100 },
    { id: 'c6',  dataPath: 'email',             label: 'Email',             type: 'string', width: 200 },
    { id: 'c7',  dataPath: 'phone',             label: 'Phone',             type: 'string', width: 100 },
    { id: 'c8',  dataPath: 'preferredChannel',  label: 'Pref. Channel',     type: 'string', width: 100 },
    { id: 'c9',  dataPath: 'preferredTime',     label: 'Pref. Time',        type: 'string', width: 150 },
    { id: 'c10', dataPath: 'model',             label: 'Model',             type: 'string', width: 150 },
];

const FULL_COLUMNS = [
    { id: 'c1',  dataPath: 'created',           label: 'Created',           type: 'string', width: 120 },
    { id: 'c2',  dataPath: 'source',            label: 'Source',            type: 'string', width: 100 },
    { id: 'c3',  dataPath: 'campaign',          label: 'Campaign',          type: 'string', width: 150 },
    { id: 'c4',  dataPath: 'salesExec',         label: 'Sales Exec',        type: 'string', width: 150 },
    { id: 'c5',  dataPath: 'fullName',          label: 'Name',              type: 'string', width: 100 },
    { id: 'c6',  dataPath: 'email',             label: 'Email',             type: 'string', width: 200 },
    { id: 'c7',  dataPath: 'phone',             label: 'Phone',             type: 'string', width: 100 },
    { id: 'c8',  dataPath: 'preferredChannel',  label: 'Pref. Channel',     type: 'string', width: 100 },
    { id: 'c9',  dataPath: 'preferredTime',     label: 'Pref. Time',        type: 'string', width: 150 },
    { id: 'c10', dataPath: 'model',             label: 'Model',             type: 'string', width: 150 },
    { id: 'c11', dataPath: 'modelDetails',      label: 'Model Details',     type: 'string', width: 120 },
    { id: 'c12', dataPath: 'branch',            label: 'Branch',            type: 'string', width: 130 },
    { id: 'c13', dataPath: 'strength',          label: 'Strength',          type: 'string', width: 90  },
    { id: 'c14', dataPath: 'status',            label: 'Status',            type: 'string', width: 100 },
    { id: 'c15', dataPath: 'quotationIssued',   label: 'Quotation',         type: 'string', width: 100 },
    { id: 'c16', dataPath: 'remarks',           label: 'Remarks',           type: 'string', width: 150 },
    { id: 'c17', dataPath: 'followUp1',         label: 'Follow Up 1',       type: 'string', width: 130 },
    { id: 'c18', dataPath: 'reply1',            label: 'Reply 1',           type: 'string', width: 130 },
    { id: 'c19', dataPath: 'followUp2',         label: 'Follow Up 2',       type: 'string', width: 130 },
    { id: 'c20', dataPath: 'reply2',            label: 'Reply 2',           type: 'string', width: 130 },
    { id: 'c21', dataPath: 'followUp3',         label: 'Follow Up 3',       type: 'string', width: 130 },
    { id: 'c22', dataPath: 'reply3',            label: 'Reply 3',           type: 'string', width: 130 },
    { id: 'c23', dataPath: 'lostSaleReason',    label: 'Lost Reason',       type: 'string', width: 130 },
    { id: 'c24', dataPath: 'lostSaleRemarks',   label: 'Lost Remarks',      type: 'string', width: 130 },
    { id: 'c25', dataPath: 'notes',             label: 'Notes',             type: 'string', width: 180 },
    { id: 'c26', dataPath: 'month',             label: 'Month',             type: 'string', width: 100 },
    { id: 'c27', dataPath: 'qty',               label: 'Qty',               type: 'number', width: 70  },
    { id: 'c28', dataPath: 'amtWithVat',        label: 'Amt w/ VAT',        type: 'number', width: 110 },
    { id: 'c29', dataPath: 'amtWithoutVat',     label: 'Amt w/o VAT',       type: 'number', width: 110 },
];

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────────────
$w.onReady(async function () {

    // 1. Verify session
    const username    = storage.getItem('crams_username');
    const sessionHash = storage.getItem('crams_session_hash');
    if (!username || !sessionHash) { to('/'); return; }

    const auth = await verifyCookie(username, sessionHash);
    if (auth.status !== 200) { clearSession(); to('/'); return; }

    // 2. Show display name
    $w('#accountName').text = storage.getItem('crams_display_name') || username;

    // 3. Simple view on load (switch unchecked = simple)
    $w('#table1').columns   = SIMPLE_COLUMNS;
    $w('#tableViewTxt').text = 'SIMPLE VIEW';
    $w('#tableViewSwitch').checked = false;

    // 4. Sort dropdown default
    $w('#sortDateDrop').value = 'Descending';

    // 5. Load leads
    await loadLeads();

    // 6. Disable end date until start chosen
    $w('#endDatePicker').disable();
});

// ─────────────────────────────────────────────────────────────────────────────
//  LOAD & RENDER
// ─────────────────────────────────────────────────────────────────────────────
async function loadLeads() {
    try {
        const result = await wixData.query(COLLECTION).descending('created').limit(1000).find({ suppressAuth: true });
        allItems = result.items;
        populateFilterOptions(allItems);
        applyFilters();
    } catch (err) {
        console.error('Failed to load leads:', err);
    }
}

function renderTable(items) {
    currentFiltered = items;
    $w('#table1').rows = items.map(item => ({
        created:          item.created          || '',
        source:           item.source           || '',
        campaign:         item.campaign         || '',
        salesExec:        item.salesExec        || '',
        fullName:         item.fullName         || '',
        email:            item.email            || '',
        phone:            item.phone            || '',
        preferredChannel: item.preferredChannel || '',
        preferredTime:    item.preferredTime    || '',
        model:            item.model            || '',
        modelDetails:     item.modelDetails     || '',
        branch:           item.branch           || '',
        strength:         item.strength         || '',
        status:           item.status           || '',
        quotationIssued:  item.quotationIssued  || '',
        remarks:          item.remarks          || '',
        followUp1:        item.followUp1        || '',
        reply1:           item.reply1           || '',
        followUp2:        item.followUp2        || '',
        reply2:           item.reply2           || '',
        followUp3:        item.followUp3        || '',
        reply3:           item.reply3           || '',
        lostSaleReason:   item.lostSaleReason   || '',
        lostSaleRemarks:  item.lostSaleRemarks  || '',
        notes:            item.notes            || '',
        month:            item.month            || '',
        qty:              item.qty              || 0,
        amtWithVat:       item.amtWithVat       || 0,
        amtWithoutVat:    item.amtWithoutVat    || 0,
    }));
}

function populateFilterOptions(items) {
    const unique    = (key) => ['All', ...new Set(items.map(i => i[key]).filter(Boolean))];
    const toOptions = (vals) => vals.map(v => ({ label: v, value: v === 'All' ? '' : v }));

    $w('#filterCampaignDrop').options = toOptions(unique('campaign'));
    $w('#filterShowroomDrop').options = toOptions(unique('branch'));
    $w('#filterVehicleDrop').options  = toOptions(unique('model'));
    $w('#filterSourceDrop').options   = toOptions(unique('source'));
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE VIEW SWITCH
// ─────────────────────────────────────────────────────────────────────────────
$w('#tableViewSwitch').onClick(() => {
    if ($w('#tableViewSwitch').checked) {
        $w('#table1').columns    = FULL_COLUMNS;
        $w('#tableViewTxt').text = 'EXPANDED VIEW';
    } else {
        $w('#table1').columns    = SIMPLE_COLUMNS;
        $w('#tableViewTxt').text = 'SIMPLE VIEW';
    }
    renderTable(currentFiltered);
});

// ─────────────────────────────────────────────────────────────────────────────
//  CSV DOWNLOAD
// ─────────────────────────────────────────────────────────────────────────────
$w('#generateCSV').onClick(() => {
    console.log("clicked download csv");
    const headers = [
        'created', 'source', 'campaign', 'salesExec',
        'fullName', 'email', 'phone',
        'preferredChannel', 'preferredTime',
        'model', 'modelDetails', 'branch', 'strength',
        'status', 'quotationIssued',
        'remarks',
        'followUp1', 'reply1', 'followUp2', 'reply2', 'followUp3', 'reply3',
        'lostSaleReason', 'lostSaleRemarks', 'notes',
        'month', 'day', 'qty', 'amtWithVat', 'amtWithoutVat'
    ];

    const headerRow = headers.join(',');
    const dataRows  = currentFiltered.map(item =>
        headers.map(h => `"${String(item[h] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    console.log("mapping data to rows...");

    const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\n');

    const now     = new Date();
    const pad     = (n) => n.toString().padStart(2, '0');
    const stamp   = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const fileName = `PolarisLeads-${stamp}.csv`;

    $w('#htmlDownloader').postMessage({ csvContent, fileName });
    console.log("posted message to iframe for download...");
});

// ─────────────────────────────────────────────────────────────────────────────
//  SORT BY CREATED
// ─────────────────────────────────────────────────────────────────────────────
$w('#sortDateDrop').onChange(e => {
    sortAscending = e.target.value === 'Ascending';
    applyFilters();
});

// ─────────────────────────────────────────────────────────────────────────────
//  FILTERING + SORTING
// ─────────────────────────────────────────────────────────────────────────────
function applyFilters() {
    let filtered = allItems;

    if (filterCampaign)  filtered = filtered.filter(i => i.campaign === filterCampaign);
    if (filterBranch)    filtered = filtered.filter(i => i.branch   === filterBranch);
    if (filterModel)     filtered = filtered.filter(i => i.model    === filterModel);
    if (filterSource)    filtered = filtered.filter(i => i.source   === filterSource);

    if (filterStartDate) {
        filtered = filtered.filter(i => i.created && i.created >= filterStartDate);
    }
    if (filterEndDate) {
        filtered = filtered.filter(i => i.created && i.created <= filterEndDate + ' 23:59');
    }

    // Sort by created string — "YYYY-MM-DD HH:MM" sorts correctly alphabetically
    filtered = filtered.slice().sort((a, b) => {
        const valA = a.created || '';
        const valB = b.created || '';
        return sortAscending
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
    });

    renderTable(filtered);
}

// ─────────────────────────────────────────────────────────────────────────────
//  FILTER EVENT LISTENERS
// ─────────────────────────────────────────────────────────────────────────────
$w('#filterCampaignDrop').onChange(e => { filterCampaign = e.target.value || null; applyFilters(); });
$w('#filterShowroomDrop').onChange(e => { filterBranch   = e.target.value || null; applyFilters(); });
$w('#filterVehicleDrop').onChange(e  => { filterModel    = e.target.value || null; applyFilters(); });
$w('#filterSourceDrop').onChange(e   => { filterSource   = e.target.value || null; applyFilters(); });

// ─────────────────────────────────────────────────────────────────────────────
//  DATE FILTERS
// ─────────────────────────────────────────────────────────────────────────────
$w('#startDatePicker').onChange(e => {
    filterStartDate = toDateString(e.target.value);
    $w('#endDatePicker').minDate = e.target.value;
    $w('#endDatePicker').enable();
    enableAllDateBtns();
    applyFilters();
});

$w('#endDatePicker').onChange(e => {
    filterEndDate = toDateString(e.target.value);
    enableAllDateBtns();
    applyFilters();
});

$w('#lastWeekBtn').onClick(e  => setQuickDateFilter(...quickDateRange(7),  e.target));
$w('#last2WeekBtn').onClick(e => setQuickDateFilter(...quickDateRange(14), e.target));
$w('#lastMonthBtn').onClick(e => setQuickDateFilter(...quickDateRange(30), e.target));

$w('#allDatesBtn').onClick(e => {
    filterStartDate = null;
    filterEndDate   = null;
    $w('#startDatePicker').value = null;
    $w('#endDatePicker').value   = null;
    $w('#endDatePicker').disable();
    enableAllDateBtns();
    e.target.disable();
    applyFilters();
});

$w('#clearFiltersBtn').onClick(() => {
    // Reset all filter state
    filterCampaign  = null;
    filterBranch    = null;
    filterModel     = null;
    filterSource    = null;
    filterStartDate = null;
    filterEndDate   = null;
    sortAscending   = false;

    // Reset UI elements
    $w('#filterCampaignDrop').value  = '';
    $w('#filterShowroomDrop').value  = '';
    $w('#filterVehicleDrop').value   = '';
    $w('#filterSourceDrop').value    = '';
    $w('#sortDateDrop').value        = 'Descending';
    $w('#startDatePicker').value     = null;
    $w('#endDatePicker').value       = null;
    $w('#endDatePicker').disable();

    enableAllDateBtns();
    applyFilters();
});

// ─────────────────────────────────────────────────────────────────────────────
//  LOGOUT
// ─────────────────────────────────────────────────────────────────────────────
$w('#logoutBtn').onClick(() => { clearSession(); to('/'); });

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
    return new Date(dateValue).toISOString().slice(0, 10);
}

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