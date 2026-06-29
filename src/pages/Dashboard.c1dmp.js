//@ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
//  CRAMS - AMS - Dashboard Page
//
//  ── EXISTING ELEMENTS ────────────────────────────────────────────────────────
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
//    #todaysDate         → Text element showing today's date
// ─────────────────────────────────────────────────────────────────────────────

import { verifyCookie } from 'backend/login-verification.web.js';
import { updateLead, getSalesReps } from 'backend/leads.web.js';
import { session as storage } from 'wix-storage';
import wixLocation, { to } from 'wix-location';
import wixData from 'wix-data';

// ─────────────────────────────────────────────────────────────────────────────
//  GLOBALS
// ─────────────────────────────────────────────────────────────────────────────
const COLLECTION = 'PolarisLeads';

let allItems      = []; // full unfiltered dataset (full CMS objects with _id)
let currentFiltered = []; // rows currently in the table — SAME ORDER as #table1
let sortAscending = false;

let filterCampaign  = null;
let filterBranch    = null;
let filterModel     = null;
let filterSource    = null;
let filterStartDate = null;
let filterEndDate   = null;

let editingItem = null; // CMS item currently open in the edit popup
let suppressRowSelect = false; // true while renderTable is called from saveEdit to prevent re-open
let overlayClickEnabled = false; // guards against click bleed-through from row select

let myLeadsOnly            = false;
let currentUserRoles       = [];
let currentUserDisplayName = null;

const isAdmin = () => currentUserRoles.includes('admin');
const isSales = () => currentUserRoles.includes('sales');

// ─────────────────────────────────────────────────────────────────────────────
//  EDIT POPUP — DROPDOWN OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

// Source / Channel
const OPT_SOURCE = [
    { label: '—',                value: '' },
    { label: 'Walk-in',          value: 'Walk-in' },
    { label: 'Email',            value: 'Email' },
    { label: 'Telephone',        value: 'Telephone' },
    { label: 'Whatsapp',         value: 'Whatsapp' },
    { label: 'Dealer IDEX',      value: 'Dealer IDEX' },
    { label: 'Social Media',     value: 'Social Media' },
    { label: 'Campaign/Channel', value: 'Campaign/Channel' },
    { label: 'Facebook',         value: 'Facebook' },
    { label: 'Instagram',        value: 'Instagram' },
    { label: 'Meta Lead Ad',     value: 'Meta Lead Ad' },
    { label: 'Website',          value: 'Website' },
    { label: 'Referral',         value: 'Referral' },
    { label: 'Other',            value: 'Other' },
];

// Strength
const OPT_STRENGTH = [
    { label: '—',    value: '' },
    { label: 'Hot',  value: 'Hot' },
    { label: 'Mild', value: 'Mild' },
    { label: 'Low',  value: 'Low' },
];

// Status
const OPT_STATUS = [
    { label: '—',                        value: '' },
    { label: 'Waiting to be contacted',  value: 'Waiting to be contacted' },
    { label: 'Attempted to contact',     value: 'Attempted to contact' },
    { label: 'Contacted & In progress',  value: 'Contacted & In progress' },
    { label: 'Qualified & In progress',  value: 'Qualified & In progress' },
    { label: 'Not Qualified',            value: 'Not Qualified' },
    { label: 'Booked',                   value: 'Booked' },
    { label: 'Invoiced',                 value: 'Invoiced' },
    { label: 'Lost Sale',                value: 'Lost Sale' },
];

// Branch / Showroom
const OPT_BRANCH = [
    { label: '—',         value: '' },
    { label: 'Abu Dhabi', value: 'Abu Dhabi' },
    { label: 'Alain',     value: 'Alain' },
    { label: 'Dubai',     value: 'Dubai' },
    { label: 'Sharjah',   value: 'Sharjah' },
    { label: 'Other',     value: 'Other' },
];

// Model
const OPT_MODEL = [
    { label: '—',                value: '' },
    { label: 'RZR',              value: 'RZR' },
    { label: 'RANGER/GENERAL',   value: 'RANGER/GENERAL' },
    { label: 'XPEDITION',        value: 'XPEDITION' },
    { label: 'ATV',              value: 'ATV' },
    { label: 'YOUTH',            value: 'YOUTH' },
    { label: 'GOUPIL',           value: 'GOUPIL' },
    { label: 'SHERCO',           value: 'SHERCO' },
    { label: 'SLINGSHOT',        value: 'SLINGSHOT' },
    { label: 'IMC-HEAVY WEIGHT', value: 'IMC-HEAVY WEIGHT' },
    { label: 'IMC-MID SIZE',     value: 'IMC-MID SIZE' },
];

// Sales Exec — populated dynamically from Accounts CMS (role === 'sales') on page load
let OPT_SALES_EXEC = [{ label: '—', value: '' }];

// Preferred Channel
const OPT_CHANNEL = [
    { label: '—',          value: '' },
    { label: 'Whatsapp',   value: 'Whatsapp' },
    { label: 'Call',       value: 'Call' },
    { label: 'Email',      value: 'Email' },
    { label: 'In Person',  value: 'In Person' },
];

// Preferred Time
const OPT_TIME = [
    { label: '—',           value: '' },
    { label: 'Morning',     value: 'Morning' },
    { label: 'Afternoon',   value: 'Afternoon' },
    { label: 'Evening',     value: 'Evening' },
    { label: 'Anytime',     value: 'Anytime' },
];

// Yes / No (Quotation Issued, Test Drive etc.)
const OPT_YES_NO = [
    { label: '—',   value: '' },
    { label: 'Yes', value: 'Yes' },
    { label: 'No',  value: 'No' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  TABLE COLUMN DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
let SIMPLE_COLUMNS = [
    { id: 'cid', dataPath: '_id',              label: '',              type: 'string', width: 0   },
    { id: 'c1',  dataPath: 'created',          label: 'Created',       type: 'string', width: 120 },
    { id: 'c2',  dataPath: 'source',           label: 'Source',        type: 'string', width: 100 },
    { id: 'c3',  dataPath: 'status',           label: 'Status',        type: 'string', width: 150 },
    { id: 'c4',  dataPath: 'salesExec',        label: 'Sales Exec',    type: 'string', width: 150 },
    { id: 'c5',  dataPath: 'fullName',         label: 'Name',          type: 'string', width: 100 },
    { id: 'c6',  dataPath: 'email',            label: 'Email',         type: 'string', width: 200 },
    { id: 'c7',  dataPath: 'phone',            label: 'Phone',         type: 'string', width: 100 },
    { id: 'c8',  dataPath: 'preferredChannel', label: 'Pref. Channel', type: 'string', width: 100 },
    { id: 'c9',  dataPath: 'preferredTime',    label: 'Pref. Time',    type: 'string', width: 150 },
    { id: 'c10', dataPath: 'model',            label: 'Model',         type: 'string', width: 150 },
];

let FULL_COLUMNS = [
    { id: 'cid', dataPath: '_id',              label: '',              type: 'string', width: 0   },
    { id: 'c1',  dataPath: 'created',          label: 'Created',       type: 'string', width: 120 },
    { id: 'c2',  dataPath: 'source',           label: 'Source',        type: 'string', width: 100 },
    { id: 'c3',  dataPath: 'campaign',         label: 'Campaign',      type: 'string', width: 150 },
    { id: 'c4',  dataPath: 'salesExec',        label: 'Sales Exec',    type: 'string', width: 150 },
    { id: 'c5',  dataPath: 'fullName',         label: 'Name',          type: 'string', width: 100 },
    { id: 'c6',  dataPath: 'email',            label: 'Email',         type: 'string', width: 200 },
    { id: 'c7',  dataPath: 'phone',            label: 'Phone',         type: 'string', width: 100 },
    { id: 'c8',  dataPath: 'preferredChannel', label: 'Pref. Channel', type: 'string', width: 100 },
    { id: 'c9',  dataPath: 'preferredTime',    label: 'Pref. Time',    type: 'string', width: 150 },
    { id: 'c10', dataPath: 'model',            label: 'Model',         type: 'string', width: 150 },
    { id: 'c11', dataPath: 'modelDetails',     label: 'Model Details', type: 'string', width: 120 },
    { id: 'c12', dataPath: 'branch',           label: 'Branch',        type: 'string', width: 130 },
    { id: 'c13', dataPath: 'strength',         label: 'Strength',      type: 'string', width: 90  },
    { id: 'c14', dataPath: 'status',           label: 'Status',        type: 'string', width: 150 },
    { id: 'c15', dataPath: 'quotationIssued',  label: 'Quotation',     type: 'string', width: 100 },
    { id: 'c16', dataPath: 'remarks',          label: 'Remarks',       type: 'string', width: 150 },
    { id: 'c17', dataPath: 'followUp1',        label: 'Follow Up 1',   type: 'string', width: 130 },
    { id: 'c18', dataPath: 'reply1',           label: 'Reply 1',       type: 'string', width: 130 },
    { id: 'c19', dataPath: 'followUp2',        label: 'Follow Up 2',   type: 'string', width: 130 },
    { id: 'c20', dataPath: 'reply2',           label: 'Reply 2',       type: 'string', width: 130 },
    { id: 'c21', dataPath: 'followUp3',        label: 'Follow Up 3',   type: 'string', width: 130 },
    { id: 'c22', dataPath: 'reply3',           label: 'Reply 3',       type: 'string', width: 130 },
    { id: 'c23', dataPath: 'lostSaleReason',   label: 'Lost Reason',   type: 'string', width: 130 },
    { id: 'c24', dataPath: 'lostSaleRemarks',  label: 'Lost Remarks',  type: 'string', width: 130 },
    { id: 'c25', dataPath: 'notes',            label: 'Notes',         type: 'string', width: 180 },
    { id: 'c26', dataPath: 'month',            label: 'Month',         type: 'string', width: 100 },
    { id: 'c27', dataPath: 'qty',              label: 'Qty',           type: 'number', width: 70  },
    { id: 'c28', dataPath: 'amtWithVat',       label: 'Amt w/ VAT',    type: 'number', width: 110 },
    { id: 'c29', dataPath: 'amtWithoutVat',    label: 'Amt w/o VAT',   type: 'number', width: 110 },
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

    // 2. Display name & date
    $w('#accountName').text = storage.getItem('crams_display_name') || username;
    $w('#todaysDate').text  = new Date().toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    // 3. Role-based setup — must run before columns are assigned to the table
    const rawRole = storage.getItem('crams_role') || '["sales"]';
    try { currentUserRoles = JSON.parse(rawRole); } catch { currentUserRoles = [rawRole]; }
    if (!Array.isArray(currentUserRoles)) currentUserRoles = [currentUserRoles];
    currentUserDisplayName = storage.getItem('crams_display_name') || username;

    if (isSales()) {
        const ownedCol = { id: 'co', dataPath: 'owned', label: '', type: 'string', width: 28 };
        SIMPLE_COLUMNS = [SIMPLE_COLUMNS[0], ownedCol, ...SIMPLE_COLUMNS.slice(1)];
        FULL_COLUMNS   = [FULL_COLUMNS[0],   ownedCol, ...FULL_COLUMNS.slice(1)];
        myLeadsOnly = !isAdmin(); // admin+sales users default to all leads
        $w('#text18').show();
        $w('#myLeadsToggle').show();
        $w('#myLeadsToggleTxt').show();
        $w('#myLeadsToggleTxt').text = 'ASSIGNED';
        $w('#myLeadsToggle').checked = false;
    } else {
        $w('#text18').hide();
        $w('#myLeadsToggle').hide();
        $w('#myLeadsToggleTxt').hide();
    }

    // 4. Default table view
    $w('#table1').columns = SIMPLE_COLUMNS;
    $w('#tableViewTxt').text = 'SIMPLE VIEW';
    $w('#tableViewSwitch').checked = false;

    // 5. Sort default
    $w('#sortDateDrop').value = 'Descending';

    // 6. Load CMS data
    await loadLeads();

    // 7. Disable end date until start chosen
    $w('#endDatePicker').disable();

    // 8. Load sales reps from Accounts CMS, then seed popup dropdowns
    const repsResult = await getSalesReps(username, sessionHash);
    if (repsResult.success && repsResult.reps.length) {
        OPT_SALES_EXEC = [
            { label: '—', value: '' },
            ...repsResult.reps.map(name => ({ label: name, value: name }))
        ];
    }
    $w("#editPopupBox").hide();
    $w("#editPopupOverlay").hide();
    initEditPopupDropdowns();

    // 9. Wire popup action buttons
    $w('#editSaveBtn').onClick(()   => saveEdit());
    $w('#editCancelBtn').onClick(() => closeEditPopup());
    $w('#editPopupOverlay').onClick(() => { if (overlayClickEnabled) closeEditPopup(); });

    // 10. Row click → open edit popup (sales users blocked from editing unassigned leads)
    $w('#table1').onRowSelect(async (event) => {
        if (suppressRowSelect) return;
        const id = event.rowData && event.rowData._id;
        if (!id) return;

        let item = allItems.find(i => i._id === id);
        if (!item) {
            console.warn('[onRowSelect] item not found in allItems, fetching from CMS. id:', id);
            try {
                item = await wixData.get(COLLECTION, id, { suppressAuth: true });
            } catch (e) {
                console.error('[onRowSelect] CMS fallback failed:', e);
                return;
            }
            if (!item) return;
        }

        if (isSales() && !isAdmin() && item.salesExec !== currentUserDisplayName) return;
        openEditPopup(item);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
//  LOAD & RENDER
// ─────────────────────────────────────────────────────────────────────────────
async function loadLeads() {
    try {
        const result = await wixData
            .query(COLLECTION)
            .descending('created')
            .limit(1000)
            .find({ suppressAuth: true });

        allItems = result.items;
        populateFilterOptions(allItems);
        applyFilters(); // calls renderTable + setupCharts

        // Safety net: re-render charts after 1.5s in case CEs weren't mounted yet
        setTimeout(() => setupCharts(currentFiltered), 1500);

    } catch (err) {
        console.error('Failed to load leads:', err);
    }
}

function renderTable(items) {
    currentFiltered = items; // keep in sync — onRowSelect depends on this order
    $w('#table1').rows = items.map(item => ({
        _id:              item._id              || '',
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
        owned:            (isSales() && !myLeadsOnly && item.salesExec === currentUserDisplayName) ? '●' : '',
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
//  TABLE VIEW SWITCH
// ─────────────────────────────────────────────────────────────────────────────
$w('#tableViewSwitch').onClick(() => {
    if ($w('#tableViewSwitch').checked) {
        $w('#table1').columns = FULL_COLUMNS;
        $w('#tableViewTxt').text = 'EXPANDED VIEW';
    } else {
        $w('#table1').columns = SIMPLE_COLUMNS;
        $w('#tableViewTxt').text = 'SIMPLE VIEW';
    }
    renderTable(currentFiltered);
});

$w('#myLeadsToggle').onChange(() => {
    myLeadsOnly = !$w('#myLeadsToggle').checked;
    $w('#myLeadsToggleTxt').text = $w('#myLeadsToggle').checked ? 'ALL LEADS' : 'ASSIGNED';
    applyFilters();
});

// ─────────────────────────────────────────────────────────────────────────────
//  CSV DOWNLOAD
// ─────────────────────────────────────────────────────────────────────────────
$w('#generateCSV').onClick(() => {
    const username    = storage.getItem('crams_username');
    const sessionHash = storage.getItem('crams_session_hash');

    const params = new URLSearchParams({ username, sessionHash });
    if (filterCampaign)  params.set('campaign',    filterCampaign);
    if (filterBranch)    params.set('branch',       filterBranch);
    if (filterModel)     params.set('model',        filterModel);
    if (filterSource)    params.set('source',       filterSource);
    if (filterStartDate) params.set('startDate',    filterStartDate);
    if (filterEndDate)   params.set('endDate',      filterEndDate);
    if (myLeadsOnly && isSales()) {
        params.set('myLeadsOnly',  'true');
        params.set('displayName',  currentUserDisplayName);
    }

    // wixLocation.to(`${wixLocation.baseUrl}/_functions/downloadCSV?${params.toString()}`);
    wixLocation.to(`${wixLocation.baseUrl}/_functions-dev/downloadCSV?${params.toString()}`);
});

// ─────────────────────────────────────────────────────────────────────────────
//  SORT
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

    if (filterCampaign) filtered = filtered.filter(i => i.campaign === filterCampaign);
    if (filterBranch)   filtered = filtered.filter(i => i.branch   === filterBranch);
    if (filterModel)    filtered = filtered.filter(i => i.model    === filterModel);
    if (filterSource)   filtered = filtered.filter(i => i.source   === filterSource);

    if (filterStartDate) filtered = filtered.filter(i => i.created && i.created >= filterStartDate);
    if (filterEndDate)   filtered = filtered.filter(i => i.created && i.created <= filterEndDate + ' 23:59');
    if (myLeadsOnly && isSales()) filtered = filtered.filter(i => i.salesExec === currentUserDisplayName);

    filtered = filtered.slice().sort((a, b) => {
        const valA = a.created || '';
        const valB = b.created || '';
        return sortAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    renderTable(filtered);
    setupCharts(filtered);
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
    filterStartDate = null; filterEndDate = null;
    $w('#startDatePicker').value = null;
    $w('#endDatePicker').value   = null;
    $w('#endDatePicker').disable();
    enableAllDateBtns();
    e.target.disable();
    applyFilters();
});

$w('#clearFiltersBtn').onClick(() => {
    filterCampaign = null; filterBranch = null; filterModel = null; filterSource = null;
    filterStartDate = null; filterEndDate = null;
    sortAscending = false;

    $w('#filterCampaignDrop').value = '';
    $w('#filterShowroomDrop').value = '';
    $w('#filterVehicleDrop').value  = '';
    $w('#filterSourceDrop').value   = '';
    $w('#sortDateDrop').value = 'Descending';
    $w('#startDatePicker').value = null;
    $w('#endDatePicker').value   = null;
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
    const end = new Date(); const start = new Date();
    start.setDate(end.getDate() - days);
    return [toDateString(start), toDateString(end)];
}

function setQuickDateFilter(start, end, clickedBtn) {
    filterStartDate = start; filterEndDate = end;
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

// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ───────           ─────                ───────           ───────────────────  ────────────  ───────           ──────────────
// ─────  ───────────  ───  ────────────  ─────  ───────────  ─────────────────  ────────────  ─────  ───────────  ────────────
// ─────  ───────────  ───  ────────────  ─────  ───────────  ─────────────────  ────────────  ─────  ───────────  ────────────
// ─────  ───────────  ───  ────────────  ─────  ───────────  ─────────────────  ────────────  ─────  ───────────  ────────────
// ─────  ───────────  ───  ────────────  ─────  ───────────  ─────────────────  ────────────  ─────  ───────────  ────────────
// ─────  ───────────  ───  ────────────  ─────  ───────────  ─────────────────  ────────────  ─────  ───────────  ────────────
// ─────  ───────────  ───  ────────────  ─────  ───────────  ─────────────────  ────────────  ─────  ───────────  ────────────
// ─────            ──────  ────────────  ─────            ────────────────────  ────────────  ─────            ───────────────
// ─────  ────────────────  ────────────  ─────  ──────────────────────────────  ────────────  ─────  ─────────────────────────
// ─────  ────────────────  ────────────  ─────  ──────────────────────────────  ────────────  ─────  ─────────────────────────
// ─────  ────────────────  ────────────  ─────  ──────────────────────────────  ────────────  ─────  ─────────────────────────
// ─────  ────────────────  ────────────  ─────  ──────────────────────────────  ────────────  ─────  ─────────────────────────
// ─────  ────────────────  ────────────  ─────  ──────────────────────────────  ────────────  ─────  ─────────────────────────
// ─────  ────────────────  ────────────  ─────  ──────────────────────────────  ────────────  ─────  ─────────────────────────
// ─────  ────────────────  ────────────  ─────  ──────────────────────────────  ────────────  ─────  ─────────────────────────
// ─────  ────────────────                ─────  ──────────────────────────────                ─────  ─────────────────────────
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
//  EDIT POPUP — INIT DROPDOWNS
// ─────────────────────────────────────────────────────────────────────────────
function initEditPopupDropdowns() {
    $w('#editSource').options           = OPT_SOURCE;
    $w('#editStrength').options         = OPT_STRENGTH;
    $w('#editStatus').options           = OPT_STATUS;
    $w('#editBranch').options           = OPT_BRANCH;
    $w('#editModel').options            = OPT_MODEL;
    $w('#editSalesExec').options        = OPT_SALES_EXEC;
    $w('#editPreferredChannel').options = OPT_CHANNEL;
    $w('#editPreferredTime').options    = OPT_TIME;
    $w('#editQuotationIssued').options  = OPT_YES_NO;
}

// ─────────────────────────────────────────────────────────────────────────────
//  EDIT POPUP — DROPDOWN HELPER
// ─────────────────────────────────────────────────────────────────────────────
function setDropdown(elementId, rawValue) {
    if (!rawValue) { $w(elementId).value = ''; return; }
    const el = $w(elementId);    
    const normalize = s => s.trim().replace(/_/g, ' ').toLowerCase();
    const match = el.options.find(o => normalize(o.value) === normalize(rawValue));
    el.value = match ? match.value : '';
}

// ─────────────────────────────────────────────────────────────────────────────
//  EDIT POPUP — OPEN
// ─────────────────────────────────────────────────────────────────────────────
function openEditPopup(item) {
    console.log('[openEditPopup] called. item._id:', item ? item._id : 'NULL');
    editingItem = item;

    $w('#editLeadName').text = `Editing: ${item.fullName || 'Unknown'}`;
    $w('#editSaveTxt').hide();

    // ── Text Inputs ──────────────────────────────────────────────────────────
    $w('#editFullName').value       = item.fullName      || '';
    $w('#editPhone').value          = item.phone         || '';
    $w('#editEmail').value          = item.email         || '';
    $w('#editCampaign').value       = item.campaign      || '';
    $w('#editModelDetails').value   = item.modelDetails  || '';
    $w('#editFollowUp1').value      = item.followUp1     || '';
    $w('#editReply1').value         = item.reply1        || '';
    $w('#editFollowUp2').value      = item.followUp2     || '';
    $w('#editReply2').value         = item.reply2        || '';
    $w('#editFollowUp3').value      = item.followUp3     || '';
    $w('#editReply3').value         = item.reply3        || '';
    $w('#editLostSaleReason').value = item.lostSaleReason || '';
    $w('#editMonth').value          = item.month         || '';
    $w('#editQty').value            = item.qty        != null ? String(item.qty)              : '';
    $w('#editAmtWithVat').value     = item.amtWithVat != null ? String(item.amtWithVat)       : '';
    $w('#editAmtWithoutVat').value  = item.amtWithoutVat != null ? String(item.amtWithoutVat) : '';

    // ── Multiline TextBoxes ──────────────────────────────────────────────────
    $w('#editRemarks').value         = item.remarks         || '';
    $w('#editLostSaleRemarks').value = item.lostSaleRemarks || '';
    $w('#editNotes').value           = item.notes           || '';

    // ── Dropdowns — via setDropdown() for case-insensitive matching ──────────
    setDropdown('#editSource',           item.source);
    setDropdown('#editSalesExec',        item.salesExec);
    setDropdown('#editStrength',         item.strength);
    setDropdown('#editStatus',           item.status);
    setDropdown('#editBranch',           item.branch);
    setDropdown('#editModel',            item.model);
    setDropdown('#editPreferredChannel', item.preferredChannel);
    setDropdown('#editPreferredTime',    item.preferredTime);
    setDropdown('#editQuotationIssued',  item.quotationIssued);

    overlayClickEnabled = false;
    $w('#editPopupOverlay').show();
    $w('#editPopupBox').show("slide", { direction: "right", duration: 600});
    setTimeout(() => { overlayClickEnabled = true; }, 400);
}

// ─────────────────────────────────────────────────────────────────────────────
//  EDIT POPUP — CLOSE
// ─────────────────────────────────────────────────────────────────────────────
function closeEditPopup() {
    console.log('[closeEditPopup] called. editingItem was:', editingItem ? editingItem._id : 'NULL');
    try { throw new Error('closeEditPopup stack trace'); } catch(e) { console.log(e.stack); }
    $w('#editPopupBox').hide("slide", { direction: "right", duration: 600});
    $w('#editPopupOverlay').hide();
    editingItem = null;
    $w('#editSaveBtn').enable();
}

// ─────────────────────────────────────────────────────────────────────────────
//  EDIT POPUP — SAVE
// ─────────────────────────────────────────────────────────────────────────────
async function saveEdit() {
    console.log('[saveEdit] called. editingItem:', editingItem ? editingItem._id : 'NULL');
    if (!editingItem) return;

    $w('#editSaveBtn').disable();
    $w('#editSaveTxt').text = 'Saving…';
    $w('#editSaveTxt').show();

    const updatedItem = {
        ...editingItem,  // preserves _id, _rev, leadgenId, _owner, _createdDate etc.
        fullName:         $w('#editFullName').value,
        phone:            $w('#editPhone').value,
        email:            $w('#editEmail').value,
        source:           $w('#editSource').value,
        campaign:         $w('#editCampaign').value,
        salesExec:        $w('#editSalesExec').value,
        branch:           $w('#editBranch').value,
        model:            $w('#editModel').value,
        modelDetails:     $w('#editModelDetails').value,
        preferredChannel: $w('#editPreferredChannel').value,
        preferredTime:    $w('#editPreferredTime').value,
        strength:         $w('#editStrength').value,
        status:           $w('#editStatus').value,
        quotationIssued:  $w('#editQuotationIssued').value,
        remarks:          $w('#editRemarks').value,
        followUp1:        $w('#editFollowUp1').value,
        reply1:           $w('#editReply1').value,
        followUp2:        $w('#editFollowUp2').value,
        reply2:           $w('#editReply2').value,
        followUp3:        $w('#editFollowUp3').value,
        reply3:           $w('#editReply3').value,
        lostSaleReason:   $w('#editLostSaleReason').value,
        lostSaleRemarks:  $w('#editLostSaleRemarks').value,
        notes:            $w('#editNotes').value,
        month:            $w('#editMonth').value,
        qty:              parseFloat($w('#editQty').value)          || 0,
        amtWithVat:       parseFloat($w('#editAmtWithVat').value)   || 0,
        amtWithoutVat:    parseFloat($w('#editAmtWithoutVat').value) || 0,
    };

    console.log('[saveEdit] updatedItem built. _id:', updatedItem._id);
    console.log('[saveEdit] calling backend updateLead');

    const username    = storage.getItem('crams_username');
    const sessionHash = storage.getItem('crams_session_hash');

    try {
        const result = await updateLead(username, sessionHash, updatedItem);
        console.log('[saveEdit] updateLead result:', result);

        if (!result.success) {
            throw new Error(result.error || 'Unknown error from backend');
        }

        // Patch in-memory so re-renders are instant — no extra CMS query needed
        const idx = allItems.findIndex(i => i._id === result.item._id);
        console.log('[saveEdit] patching allItems at index:', idx);
        if (idx !== -1) allItems[idx] = result.item;

        suppressRowSelect = true;
        applyFilters(); // re-render table + charts with updated data
        setTimeout(() => { suppressRowSelect = false; }, 100);

        $w('#editSaveTxt').text = '✓ Saved';
        setTimeout(() => closeEditPopup(), 700);

    } catch (err) {
        console.error('[saveEdit] updateLead FAILED:', err);
        console.error('[saveEdit] error message:', err.message);
        $w('#editSaveTxt').text = '✗ Save failed — try again';
        $w('#editSaveBtn').enable();
    }
}


// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ────           ─────  ────────────  ─────                ────                ───────                ───────           ──────
// ──  ────────────────  ────────────  ─────  ────────────  ────  ─────────────  ─────────────  ────────────  ─────────────────
// ──  ────────────────  ────────────  ─────  ────────────  ────  ─────────────  ─────────────  ────────────  ─────────────────
// ──  ────────────────  ────────────  ─────  ────────────  ────  ─────────────  ─────────────  ────────────  ─────────────────
// ──  ────────────────  ────────────  ─────  ────────────  ────  ─────────────  ─────────────  ────────────  ─────────────────
// ──  ────────────────  ────────────  ─────  ────────────  ────  ─────────────  ─────────────  ────────────  ─────────────────
// ──  ────────────────  ────────────  ─────  ────────────  ────  ─────────────  ─────────────  ────────────  ─────────────────
// ──  ────────────────                ─────                ────                ──────────────  ────────────  ─────────────────
// ──  ────────────────  ────────────  ─────  ────────────  ────  ───────  ───────────────────  ─────────────             ─────
// ──  ────────────────  ────────────  ─────  ────────────  ────  ────────  ──────────────────  ─────────────────────────  ────
// ──  ────────────────  ────────────  ─────  ────────────  ────  ─────────  ─────────────────  ─────────────────────────  ────
// ──  ────────────────  ────────────  ─────  ────────────  ────  ──────────  ────────────────  ─────────────────────────  ────
// ──  ────────────────  ────────────  ─────  ────────────  ────  ───────────  ───────────────  ─────────────────────────  ────
// ──  ────────────────  ────────────  ─────  ────────────  ────  ────────────  ──────────────  ─────────────────────────  ────
// ──  ────────────────  ────────────  ─────  ────────────  ────  ─────────────  ─────────────  ─────────────────────────  ────
// ────           ─────  ────────────  ─────  ────────────  ────  ──────────────  ────────────  ──────────────           ──────
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const SOURCE_COLOURS = {
    'instagram':             'rgba(219, 44, 143, 0.8)',
    'facebook':              'rgba(24, 119, 242, 0.8)',
    'meta lead ad':          'rgba(0, 0, 0, 0.3)',
};
function sourceColour(src) {
    return SOURCE_COLOURS[(src || '').toLowerCase()] || 'rgba(150, 150, 150, 0.80)';
}

const CHANNEL_COLOURS = {
    'Whatsapp':  'rgba(37, 211, 102, 0.85)',
    'Call':      'rgba(0, 120, 215, 0.85)',
    'Email':     'rgba(230, 120, 20, 0.85)',
    'In Person': 'rgba(130, 60, 180, 0.85)',
};

const TIME_COLOURS = {
    'Morning':   'rgba(255, 190, 30, 0.85)',
    'Afternoon': 'rgba(230, 120, 20, 0.85)',
    'Evening':   'rgba(80, 60, 160, 0.85)',
    'Anytime':   'rgba(0, 180, 160, 0.85)',
};

const STATUS_COLOURS = {
    'Waiting to be contacted': 'rgba(159, 66, 122, 0.8)',
    'Attempted to contact':    'rgba(200, 100, 180, 0.8)',
    'Contacted & In progress': 'rgba(0, 200, 210, 0.8)',
    'Qualified & In progress': 'rgba(112, 241, 177, 0.8)',
    'Not Qualified':           'rgba(180, 180, 60, 0.8)',
    'Booked':                  'rgba(0, 180, 100, 0.8)',
    'Invoiced':                'rgba(0, 120, 60, 0.8)',
    'Lost Sale':               'rgba(40, 41, 137, 0.8)',
};

function statusColour(s) {
    return STATUS_COLOURS[s] || 'rgba(150, 150, 150, 0.80)';
}

const MODEL_PALETTE = [
    'rgba(100,  80, 180, 0.80)',
    'rgba(  0, 180, 180, 0.80)',
    'rgba(0, 147, 246, 0.8)',
];
 
const BRANCH_PALETTE = [
    'rgb(209, 52, 54)',
    'rgba(72, 152, 222, 0.8)',
    'rgb(150, 58, 168)',
    'rgb(0, 23, 117)',
    'rgb(117, 0, 27)',
];

function buildColorMap(names, palette) {
    const map = {};
    names.forEach((name, i) => {
        map[name] = palette[i % palette.length];
    });
    return map;
}

// ------------------- COLORS DONE ------------------- 

function setupCharts(items) {
    // Build shared color maps so paired charts use identical colors
    const allModels   = [...new Set(items.map(i => i.model).filter(Boolean))];
    const allBranches = [...new Set(items.map(i => i.branch).filter(Boolean))];
    const modelColorMap  = buildColorMap(allModels,   MODEL_PALETTE);
    const branchColorMap = buildColorMap(allBranches, BRANCH_PALETTE);
 
    setupDailySourceChart(items);
    setupDailyModelChart(items, modelColorMap);
    setupDailyBranchChart(items, branchColorMap);
    setupTotalSourceChart(items);
    setupTotalModelChart(items);
    setupTotalStatusChart(items);
    setupPrefChannelChart(items);
    setupPrefTimeChart(items);
}

// Shared helper
function groupByDateAndField(items, fieldKey) {
    const dateMap = {};

    items.forEach(item => {
        if (!item.created) return;
        const value = item[fieldKey];
        if (!value || value.trim() === '') return;

        const parsed = new Date(item.created);
        if (isNaN(parsed.getTime())) return;

        const dateKey = parsed.toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short'
        });

        if (!dateMap[dateKey]) dateMap[dateKey] = {};
        dateMap[dateKey][value] = (dateMap[dateKey][value] || 0) + 1;
    });

    const labels     = Object.keys(dateMap).reverse();
    const categories = [...new Set(
        Object.values(dateMap).flatMap(d => Object.keys(d))
    )];

    return { labels, categories, dateMap };
}


// ─── CHART 1: Daily Leads by Source ─────────────────────────────────────────
function setupDailySourceChart(items) {
    const { labels, categories, dateMap } = groupByDateAndField(items, 'source');

    const datasets = categories.map(cat => ({
        label:           cat,
        data:            labels.map(d => dateMap[d]?.[cat] || 0),
        backgroundColor: sourceColour(cat),
        borderColor:     sourceColour(cat),
        borderWidth:     0,
    }));

    // @ts-ignore
    $w('#dailySourceChart').setAttribute('data-chart', JSON.stringify({ labels, datasets }));
}


// ─── CHART 2: Daily Leads by Model ────────────────────────────────────────────────
function setupDailyModelChart(items, colorMap) {
    const { labels, categories, dateMap } = groupByDateAndField(items, 'model');

    const datasets = categories.map(cat => ({
        label:           cat,
        data:            labels.map(d => dateMap[d]?.[cat] || 0),
        backgroundColor: colorMap[cat] || MODEL_PALETTE[0],
        borderColor:     colorMap[cat] || MODEL_PALETTE[0],
        borderWidth:     0,
    }));

    // @ts-ignore
    $w('#dailyModelChart').setAttribute('data-chart', JSON.stringify({ labels, datasets }));
}

// ─── CHART 3: Daily Leads by Branch ────────────────────────────────────────────────
function setupDailyBranchChart(items, colorMap) {
    const { labels, categories, dateMap } = groupByDateAndField(items, 'branch');

    const datasets = categories.map(cat => ({
        label:           cat,
        data:            labels.map(d => dateMap[d]?.[cat] || 0),
        backgroundColor: colorMap[cat] || BRANCH_PALETTE[0],
        borderColor:     colorMap[cat] || BRANCH_PALETTE[0],
        borderWidth:     0,
    }));

    // @ts-ignore
    $w('#dailyBranchChart').setAttribute('data-chart', JSON.stringify({ labels, datasets }));
}

// ─── CHART 4: Total Leads by Source ────────────────────────────────────────────────
function setupTotalSourceChart(items) {
    const sourceMap = {};
    items.forEach(item => {
        const src = item.source;
        if (!src || src.trim() === '') return;  // skip empty
        sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
 
    const sorted = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(e => e[0]);
    const data   = sorted.map(e => e[1]);
    const colors = labels.map(src => sourceColour(src));
 
    const chartData = {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
    };
 
    // @ts-ignore
    $w('#totalSourceChart').setAttribute('data-chart', JSON.stringify(chartData));
}
 
// ─── CHART 5: Lead Strength Ratio ────────────────────────────────────────────────
function setupTotalModelChart(items) {
    const ORDER   = ['Hot', 'Mild', 'Low'];
    const COLORS  = { Hot: '#E53935', Mild: '#FFB300', Low: '#42A5F5' };

    const counts = { Hot: 0, Mild: 0, Low: 0 };
    items.forEach(item => {
        const s = (item.strength || '').trim();
        if (counts[s] !== undefined) counts[s]++;
    });

    const labels = ORDER.filter(s => counts[s] > 0);
    const data   = labels.map(s => counts[s]);

    const chartData = {
        labels,
        datasets: [{ data, backgroundColor: labels.map(s => COLORS[s]), borderWidth: 0 }]
    };

    // @ts-ignore
    $w('#totalModelChart').setAttribute('data-chart', JSON.stringify(chartData));
}
 
 
// ─── CHART 6: Total Leads by Status ────────────────────────────────────────────────
function setupTotalStatusChart(items) {
    const ORDER = [
        'Waiting to be contacted',
        'Attempted to contact',
        'Contacted & In progress',
        'Qualified & In progress',
        'Not Qualified',
        'Booked',
        'Invoiced',
        'Lost Sale',
    ];
 
    const statusMap = {};
    items.forEach(item => {
        const s = item.status;
        if (!s || s.trim() === '') return;  // skip empty
        statusMap[s] = (statusMap[s] || 0) + 1;
    });
 
    // Known statuses in order first, then any extras
    const labels = [
        ...ORDER.filter(s => statusMap[s]),
        ...Object.keys(statusMap).filter(s => !ORDER.includes(s))
    ];
    const data   = labels.map(s => statusMap[s]);
    const colors = labels.map(s => statusColour(s));
 
    const chartData = {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
    };
 
    // @ts-ignore
    $w('#totalStatusChart').setAttribute('data-chart', JSON.stringify(chartData));
}


// ─── CHART 7: Preferred Channel Ratio ────────────────────────────────────────
function setupPrefChannelChart(items) {
    const ORDER = ['Whatsapp', 'Call', 'Email', 'In Person'];

    const channelMap = {};
    items.forEach(item => {
        const c = item.preferredChannel;
        if (!c || c.trim() === '') return;
        channelMap[c] = (channelMap[c] || 0) + 1;
    });

    const labels = [
        ...ORDER.filter(c => channelMap[c]),
        ...Object.keys(channelMap).filter(c => !ORDER.includes(c))
    ];
    const data   = labels.map(c => channelMap[c]);
    const colors = labels.map(c => CHANNEL_COLOURS[c] || 'rgba(150, 150, 150, 0.8)');

    // @ts-ignore
    $w('#prefChannelChart').setAttribute('data-chart', JSON.stringify({
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
    }));
}


// ─── CHART 8: Preferred Time Ratio ───────────────────────────────────────────
function setupPrefTimeChart(items) {
    const ORDER = ['Morning', 'Afternoon', 'Evening', 'Anytime'];

    const timeMap = {};
    items.forEach(item => {
        const t = item.preferredTime;
        if (!t || t.trim() === '') return;
        timeMap[t] = (timeMap[t] || 0) + 1;
    });

    const labels = [
        ...ORDER.filter(t => timeMap[t]),
        ...Object.keys(timeMap).filter(t => !ORDER.includes(t))
    ];
    const data   = labels.map(t => timeMap[t]);
    const colors = labels.map(t => TIME_COLOURS[t] || 'rgba(150, 150, 150, 0.8)');

    // @ts-ignore
    $w('#prefTimeChart').setAttribute('data-chart', JSON.stringify({
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
    }));
}