/* ============================================================
   js/admin.js — Admin Portal Logic
   Handles: dashboard (import, groups, dept tabs, auto-assign),
            users, projects, assign, reports, notifications, profile
============================================================ */

"use strict";

/* ══════════════════════════════════════
   SHARED HELPERS
══════════════════════════════════════ */
function avatarColor(initials) {
  var palette = ["#1a73e8","#34a853","#ea4335","#fbbc04","#0d47a1","#00897b","#e65100","#6a1b9a"];
  return palette[initials.charCodeAt(0) % palette.length];
}

function badge(status) {
  var map = {
    "Approved":       { cls: "badge-success",   icon: "✅" },
    "Completed":      { cls: "badge-success",   icon: "✅" },
    "In Progress":    { cls: "badge-primary",   icon: "🔄" },
    "Under Review":   { cls: "badge-warning",   icon: "👁️" },
    "Needs Revision": { cls: "badge-danger",    icon: "✏️" },
    "Pending":        { cls: "badge-secondary", icon: "⏳" },
    "Rejected":       { cls: "badge-danger",    icon: "❌" },
    "Active":         { cls: "badge-success",   icon: "✅" },
    "Assigned":       { cls: "badge-success",   icon: "🔗" },
    "Unassigned":     { cls: "badge-warning",   icon: "⚠️" },
  };
  var b = map[status] || { cls: "badge-secondary", icon: "•" };
  return '<span class="badge ' + b.cls + '">' + b.icon + " " + status + "</span>";
}

function currentPage() {
  var parts = window.location.pathname.split("/");
  return parts[parts.length - 1];
}

function makeAvatar(name, w, fs) {
  var init  = Utils.initials(name);
  var color = avatarColor(init);
  return '<div class="avatar" style="width:' + w + ';height:' + w +
    ';font-size:' + fs + ';background:' + color + ';">' + init + "</div>";
}

/* ══════════════════════════════════════
   DASHBOARD STATE
══════════════════════════════════════ */
var ImportedSupervisors = [];   /* parsed rows from supervisor file */
var ImportedStudents    = [];   /* parsed rows from student file    */
var Groups              = {};   /* { "Topic Name": [student, ...] } */
var GroupAssignments    = {};   /* { "Topic Name": supervisorEmail  } */
var ConfirmedSups       = false;
var ConfirmedStus       = false;

var DEPARTMENTS = [
  "Computer Science",
  "Information Technology",
  "Computer Engineering",
  "Software Engineering",
  "Cybersecurity",
];

/* ══════════════════════════════════════
   DASHBOARD INIT
══════════════════════════════════════ */
function initDashboard(user) {
  /* Topbar */
  var sub = document.getElementById("topbarSub");
  if (sub) sub.textContent = "Welcome back, " + user.name.split(" ")[0] + "!";

  updateStatCards();
  initImportZones();
  initAutoAssign();
  renderDeptTabs();
}

/* ── Stat cards ── */
function updateStatCards() {
  var students    = ImportedStudents.filter(function (s) { return s._confirmed; });
  var supervisors = ImportedSupervisors.filter(function (s) { return s._confirmed; });
  var groupKeys   = Object.keys(Groups);
  var unassigned  = groupKeys.filter(function (k) { return !GroupAssignments[k]; });

  function el(id) { return document.getElementById(id); }
  el("statStudents").textContent   = students.length;
  el("statSupervisors").textContent = supervisors.length;
  el("statGroups").textContent     = groupKeys.length;
  el("statUnassigned").textContent = unassigned.length;
}

/* ══════════════════════════════════════
   FILE PARSING (CSV + Excel)
══════════════════════════════════════ */

/* Parse a File object → array of row objects */
function parseFile(file, callback) {
  var ext = file.name.split(".").pop().toLowerCase();

  if (ext === "csv") {
    var reader = new FileReader();
    reader.onload = function (e) {
      var rows = parseCSV(e.target.result);
      callback(rows);
    };
    reader.readAsText(file);
  } else if (ext === "xlsx" || ext === "xls") {
    var reader2 = new FileReader();
    reader2.onload = function (e) {
      var data     = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: "array" });
      var sheet    = workbook.Sheets[workbook.SheetNames[0]];
      var rows     = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      /* Normalise keys to lowercase with underscores */
      var normalised = rows.map(function (r) {
        var obj = {};
        Object.keys(r).forEach(function (k) {
          obj[k.trim().toLowerCase().replace(/\s+/g, "_")] = String(r[k]).trim();
        });
        return obj;
      });
      callback(normalised);
    };
    reader2.readAsArrayBuffer(file);
  } else {
    showToast("Unsupported file type. Please use CSV or Excel (.xlsx).", "error");
  }
}

/* Parse CSV text → array of row objects */
function parseCSV(text) {
  var lines   = text.trim().split("\n");
  if (lines.length < 2) return [];
  var headers = lines[0].split(",").map(function (h) {
    return h.trim().toLowerCase().replace(/\s+/g, "_").replace(/"/g, "");
  });

  return lines.slice(1).filter(function (l) { return l.trim(); }).map(function (line) {
    var values = line.split(",").map(function (v) { return v.trim().replace(/"/g, ""); });
    var obj    = {};
    headers.forEach(function (h, i) { obj[h] = values[i] || ""; });
    return obj;
  });
}

/* ══════════════════════════════════════
   TEMPLATE DOWNLOADS
══════════════════════════════════════ */
function downloadCSV(filename, headers, sampleRow) {
  var content = headers.join(",") + "\n" + sampleRow.join(",");
  var blob    = new Blob([content], { type: "text/csv" });
  var url     = URL.createObjectURL(blob);
  var a       = document.createElement("a");
  a.href      = url;
  a.download  = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════
   IMPORT ZONES INIT
══════════════════════════════════════ */
function initImportZones() {
  /* ── Supervisor template ── */
  var dlSup = document.getElementById("downloadSupTemplate");
  if (dlSup) {
    dlSup.addEventListener("click", function (e) {
      e.preventDefault();
      downloadCSV(
        "supervisor_template.csv",
        ["first_name","last_name","email","staff_id","department","specialization"],
        ["Ama","Boateng","a.boateng@uni.edu.gh","STAFF/CS/001","Computer Science","AI & Machine Learning"]
      );
    });
  }

  /* ── Student template ── */
  var dlStu = document.getElementById("downloadStuTemplate");
  if (dlStu) {
    dlStu.addEventListener("click", function (e) {
      e.preventDefault();
      downloadCSV(
        "student_template.csv",
        ["first_name","last_name","email","index_number","department","group_topic"],
        ["Kwame","Mensah","k.mensah@uni.edu.gh","UG/CS/21/001","Computer Science","AI Crop Disease Detection"]
      );
    });
  }

  /* ── Supervisor import zone ── */
  initZone({
    zoneId:     "supImportZone",
    inputId:    "supFileInput",
    fileNameId: "supFileName",
    previewId:  "supPreview",
    tbodyId:    "supPreviewTable",
    summaryId:  "supSummary",
    countId:    "supImportCount",
    clearId:    "clearSupBtn",
    confirmId:  "confirmSupBtn",
    type:       "supervisor",
    requiredCols: ["first_name","last_name","email","staff_id","department"],
    renderRow:  renderSupRow,
    onConfirm:  onConfirmSupervisors,
  });

  /* ── Student import zone ── */
  initZone({
    zoneId:     "stuImportZone",
    inputId:    "stuFileInput",
    fileNameId: "stuFileName",
    previewId:  "stuPreview",
    tbodyId:    "stuPreviewTable",
    summaryId:  "stuSummary",
    countId:    "stuImportCount",
    clearId:    "clearStuBtn",
    confirmId:  "confirmStuBtn",
    type:       "student",
    requiredCols: ["first_name","last_name","email","index_number","department","group_topic"],
    renderRow:  renderStuRow,
    onConfirm:  onConfirmStudents,
  });
}

/* Generic zone wiring */
function initZone(cfg) {
  var zone     = document.getElementById(cfg.zoneId);
  var input    = document.getElementById(cfg.inputId);
  var clearBtn = document.getElementById(cfg.clearId);
  var confBtn  = document.getElementById(cfg.confirmId);
  var parsed   = [];

  if (!zone || !input) return;

  /* Hide native file input */
  input.style.display = "none";

  /* Click zone → open file picker */
  zone.addEventListener("click", function () { input.click(); });

  /* Drag over */
  zone.addEventListener("dragover", function (e) {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", function () { zone.classList.remove("drag-over"); });

  /* Drop */
  zone.addEventListener("drop", function (e) {
    e.preventDefault();
    zone.classList.remove("drag-over");
    var file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  /* File input change */
  input.addEventListener("change", function () {
    if (input.files[0]) handleFile(input.files[0]);
  });

  /* Clear */
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      parsed = [];
      document.getElementById(cfg.fileNameId).textContent = "";
      document.getElementById(cfg.tbodyId).innerHTML      = "";
      document.getElementById(cfg.summaryId).innerHTML    = "";
      document.getElementById(cfg.previewId).classList.remove("show");
      var countEl = document.getElementById(cfg.countId);
      if (countEl) countEl.textContent = "";
      input.value = "";
    });
  }

  /* Confirm */
  if (confBtn) {
    confBtn.addEventListener("click", function () {
      var valid = parsed.filter(function (r) { return !r._error; });
      cfg.onConfirm(valid);
    });
  }

  function handleFile(file) {
    document.getElementById(cfg.fileNameId).textContent = "📎 " + file.name;
    parseFile(file, function (rows) {
      parsed = validateRows(rows, cfg.requiredCols, cfg.type);
      renderPreview(parsed, cfg);
    });
  }
}

/* ── Row validation ── */
function validateRows(rows, required, type) {
  return rows.map(function (r) {
    var missing = required.filter(function (col) { return !r[col] || !r[col].trim(); });
    var emailOk = r.email ? Utils.isValidEmail(r.email.trim()) : false;

    if (missing.length > 0) {
      r._error = "Missing: " + missing.join(", ");
    } else if (!emailOk) {
      r._error = "Invalid email address";
    } else {
      r._error = null;
    }
    return r;
  });
}

/* ── Render preview tables ── */
function renderPreview(rows, cfg) {
  var tbody   = document.getElementById(cfg.tbodyId);
  var summary = document.getElementById(cfg.summaryId);
  var preview = document.getElementById(cfg.previewId);
  var countEl = document.getElementById(cfg.countId);

  if (!tbody) return;

  tbody.innerHTML = rows.map(function (r, i) {
    return cfg.renderRow(r, i + 1);
  }).join("");

  var ok  = rows.filter(function (r) { return !r._error; }).length;
  var err = rows.length - ok;

  if (summary) {
    summary.innerHTML =
      '<span class="is-ok">✅ ' + ok  + " valid row" + (ok  !== 1 ? "s" : "") + "</span>" +
      (err > 0 ? '<span class="is-err">❌ ' + err + " error" + (err !== 1 ? "s" : "") + "</span>" : "");
  }

  if (countEl) countEl.textContent = rows.length + " rows";
  preview.classList.add("show");
}

function renderSupRow(r, i) {
  var cls = r._error ? "row-error" : "";
  return "<tr class='" + cls + "'>" +
    "<td>" + i + "</td>" +
    "<td>" + (r.first_name || "") + " " + (r.last_name || "") + "</td>" +
    "<td>" + (r.email || "") + "</td>" +
    "<td>" + (r.staff_id || "") + "</td>" +
    "<td>" + (r.department || "") + "</td>" +
    "<td>" + (r.specialization || "–") + "</td>" +
    "<td>" + (r._error
      ? '<span class="row-error-msg">❌ ' + r._error + "</span>"
      : '<span class="badge badge-success" style="font-size:.65rem;">✅ OK</span>') +
    "</td></tr>";
}

function renderStuRow(r, i) {
  var cls = r._error ? "row-error" : "";
  return "<tr class='" + cls + "'>" +
    "<td>" + i + "</td>" +
    "<td>" + (r.first_name || "") + " " + (r.last_name || "") + "</td>" +
    "<td>" + (r.email || "") + "</td>" +
    "<td>" + (r.index_number || "") + "</td>" +
    "<td>" + (r.department || "") + "</td>" +
    "<td>" + (r.group_topic || "") + "</td>" +
    "<td>" + (r._error
      ? '<span class="row-error-msg">❌ ' + r._error + "</span>"
      : '<span class="badge badge-success" style="font-size:.65rem;">✅ OK</span>') +
    "</td></tr>";
}

/* ══════════════════════════════════════
   CONFIRM HANDLERS
══════════════════════════════════════ */
function onConfirmSupervisors(rows) {
  rows.forEach(function (r) {
    r._confirmed = true;
    /* Add to DB_USERS if not already exists */
    if (!DB.getUserByEmail(r.email.trim())) {
      DB_USERS.push({
        id:             Utils.uid("SUP"),
        role:           "supervisor",
        name:           r.first_name.trim() + " " + r.last_name.trim(),
        email:          r.email.trim().toLowerCase(),
        password:       "changeme",
        staffId:        r.staff_id.trim(),
        department:     r.department.trim(),
        specialization: r.specialization ? r.specialization.trim() : "",
        assignedStudents: [],
        status:         "active",
      });
    }
  });
  ImportedSupervisors = rows;
  ConfirmedSups = true;
  showToast(rows.length + " supervisor" + (rows.length !== 1 ? "s" : "") + " imported successfully!", "success");
  updateStatCards();
  renderDeptTabs();
}

function onConfirmStudents(rows) {
  rows.forEach(function (r) {
    r._confirmed = true;
    if (!DB.getUserByEmail(r.email.trim())) {
      DB_USERS.push({
        id:           Utils.uid("STU"),
        role:         "student",
        name:         r.first_name.trim() + " " + r.last_name.trim(),
        email:        r.email.trim().toLowerCase(),
        password:     "changeme",
        indexNumber:  r.index_number.trim(),
        department:   r.department.trim(),
        groupTopic:   r.group_topic.trim(),
        supervisorId: null,
        projectId:    null,
        level:        400,
        status:       "active",
      });
    }
  });
  ImportedStudents = rows;
  ConfirmedStus = true;

  /* Build Groups from group_topic */
  buildGroups();
  showToast(rows.length + " student" + (rows.length !== 1 ? "s" : "") + " imported and grouped successfully!", "success");
  updateStatCards();
  renderDeptTabs();
}

/* ══════════════════════════════════════
   GROUP BUILDING
   Groups students by group_topic
══════════════════════════════════════ */
function buildGroups() {
  Groups = {};
  var confirmed = ImportedStudents.filter(function (s) { return s._confirmed; });
  confirmed.forEach(function (s) {
    var topic = (s.group_topic || "Ungrouped").trim();
    if (!Groups[topic]) Groups[topic] = [];
    Groups[topic].push(s);
  });
}

/* ══════════════════════════════════════
   AUTO-ASSIGN SUPERVISORS TO GROUPS
══════════════════════════════════════ */
function initAutoAssign() {
  var autoBtn = document.getElementById("autoAssignBtn");
  var saveBtn = document.getElementById("saveAssignBtn");

  if (autoBtn) {
    autoBtn.addEventListener("click", function () {
      var groupKeys = Object.keys(Groups);
      if (groupKeys.length === 0) {
        showToast("Please import and confirm students first.", "warning");
        return;
      }

      var sups = DB_USERS.filter(function (u) { return u.role === "supervisor" && u.status === "active"; });
      if (sups.length === 0) {
        showToast("Please import and confirm supervisors first.", "warning");
        return;
      }

      /* Assign randomly per department, balancing workload */
      groupKeys.forEach(function (topic) {
        var members    = Groups[topic];
        var dept       = members[0] ? members[0].department : null;

        /* Filter supervisors by same department first */
        var deptSups   = sups.filter(function (s) { return s.department === dept; });
        var pool       = deptSups.length > 0 ? deptSups : sups;  /* fallback to all sups */

        /* Sort by current workload (least groups first) */
        pool = pool.slice().sort(function (a, b) {
          return countGroupsForSup(a.id) - countGroupsForSup(b.id);
        });

        /* Pick supervisor with least load, with random tiebreak */
        var minLoad    = countGroupsForSup(pool[0].id);
        var tied       = pool.filter(function (s) { return countGroupsForSup(s.id) === minLoad; });
        var chosen     = tied[Math.floor(Math.random() * tied.length)];

        GroupAssignments[topic] = chosen.id;
      });

      showToast("Supervisors auto-assigned to " + groupKeys.length + " group" +
        (groupKeys.length !== 1 ? "s" : "") + ". Review and override below.", "success", 4000);
      renderDeptTabs();
      updateStatCards();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      var groupKeys   = Object.keys(Groups);
      var unassigned  = groupKeys.filter(function (k) { return !GroupAssignments[k]; });

      if (unassigned.length > 0) {
        showToast(unassigned.length + " group" + (unassigned.length !== 1 ? "s are" : " is") +
          " still unassigned. Please assign all groups before saving.", "warning", 5000);
        return;
      }

      /* Commit assignments to DB_USERS */
      groupKeys.forEach(function (topic) {
        var supId   = GroupAssignments[topic];
        var members = Groups[topic];
        members.forEach(function (m) {
          var user = DB.getUserByEmail(m.email);
          if (user) user.supervisorId = supId;
        });
      });

      showToast("All assignments saved successfully! " + groupKeys.length +
        " group" + (groupKeys.length !== 1 ? "s" : "") + " assigned.", "success", 4000);
      updateStatCards();
    });
  }
}

function countGroupsForSup(supId) {
  return Object.values(GroupAssignments).filter(function (id) { return id === supId; }).length;
}

/* ══════════════════════════════════════
   DEPARTMENT TABS RENDER
══════════════════════════════════════ */
function renderDeptTabs() {
  var tabBar  = document.getElementById("deptTabBar");
  var panels  = document.getElementById("deptPanels");
  if (!tabBar || !panels) return;

  /* Collect departments that have students */
  var activeDepts = DEPARTMENTS.filter(function (dept) {
    return Object.keys(Groups).some(function (topic) {
      var members = Groups[topic];
      return members.some(function (m) { return m.department === dept; });
    });
  });

  /* Add "All" tab */
  var allDepts = activeDepts.length > 0 ? ["All"].concat(activeDepts) : ["All"];

  /* Render tabs */
  tabBar.innerHTML = allDepts.map(function (dept, i) {
    var count = dept === "All"
      ? Object.keys(Groups).length
      : Object.keys(Groups).filter(function (topic) {
          return Groups[topic].some(function (m) { return m.department === dept; });
        }).length;

    return '<div class="dept-tab' + (i === 0 ? " active" : "") + '" data-dept="' + dept + '">' +
      dept +
      (count > 0 ? '<span class="dept-tab-badge">' + count + "</span>" : "") +
      "</div>";
  }).join("");

  /* Render panels */
  panels.innerHTML = allDepts.map(function (dept, i) {
    return '<div class="dept-panel' + (i === 0 ? " active" : "") + '" data-dept-panel="' + dept + '">' +
      renderDeptPanel(dept) +
      "</div>";
  }).join("");

  /* Tab click */
  tabBar.querySelectorAll(".dept-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabBar.querySelectorAll(".dept-tab").forEach(function (t) { t.classList.remove("active"); });
      panels.querySelectorAll(".dept-panel").forEach(function (p) { p.classList.remove("active"); });
      tab.classList.add("active");
      var panel = panels.querySelector('[data-dept-panel="' + tab.dataset.dept + '"]');
      if (panel) panel.classList.add("active");
    });
  });

  /* Wire override dropdowns */
  panels.querySelectorAll("select[data-group-topic]").forEach(function (sel) {
    sel.addEventListener("change", function () {
      var topic = sel.dataset.groupTopic;
      GroupAssignments[topic] = sel.value;
      updateStatCards();

      /* Update workload tags */
      panels.querySelectorAll(".workload-tag[data-sup-id]").forEach(function (tag) {
        var sid   = tag.dataset.supId;
        var count = countGroupsForSup(sid);
        tag.textContent = count + " group" + (count !== 1 ? "s" : "");
      });
    });
  });
}

function renderDeptPanel(dept) {
  var sups     = DB_USERS.filter(function (u) { return u.role === "supervisor" && u.status === "active"; });

  /* Get groups for this dept */
  var deptGroups = Object.keys(Groups).filter(function (topic) {
    if (dept === "All") return true;
    return Groups[topic].some(function (m) { return m.department === dept; });
  });

  if (deptGroups.length === 0) {
    return '<div class="empty-state"><div class="es-icon">👥</div>' +
      "<p>No groups in this department yet. Import students to see groups here.</p></div>";
  }

  /* Department summary stats */
  var totalStudents = deptGroups.reduce(function (sum, t) { return sum + Groups[t].length; }, 0);
  var deptSups      = dept === "All"
    ? sups
    : sups.filter(function (s) { return s.department === dept; });
  var assigned      = deptGroups.filter(function (t) { return GroupAssignments[t]; }).length;

  var summaryHtml =
    '<div class="dept-summary">' +
    '<div class="dept-stat"><span class="dept-stat-icon">👥</span><div><div class="dept-stat-val">' + deptGroups.length + '</div><div class="dept-stat-label">Groups</div></div></div>' +
    '<div class="dept-stat"><span class="dept-stat-icon">🧑‍🎓</span><div><div class="dept-stat-val">' + totalStudents + '</div><div class="dept-stat-label">Students</div></div></div>' +
    '<div class="dept-stat"><span class="dept-stat-icon">👨‍🏫</span><div><div class="dept-stat-val">' + deptSups.length + '</div><div class="dept-stat-label">Supervisors</div></div></div>' +
    '<div class="dept-stat"><span class="dept-stat-icon">🔗</span><div><div class="dept-stat-val">' + assigned + "/" + deptGroups.length + '</div><div class="dept-stat-label">Assigned</div></div></div>' +
    "</div>";

  /* Group cards */
  var groupsHtml = '<div class="groups-grid">' +
    deptGroups.map(function (topic) {
      return renderGroupCard(topic, sups);
    }).join("") +
    "</div>";

  return summaryHtml + groupsHtml;
}

function renderGroupCard(topic, sups) {
  var members     = Groups[topic] || [];
  var assignedId  = GroupAssignments[topic] || "";
  var assignedSup = sups.find(function (s) { return s.id === assignedId; });
  var dept        = members[0] ? members[0].department : "–";

  /* Supervisor options */
  var supOpts = '<option value="">— Select supervisor —</option>' +
    sups.map(function (s) {
      var groupCount = countGroupsForSup(s.id);
      var selected   = s.id === assignedId ? "selected" : "";
      return '<option value="' + s.id + '" ' + selected + ">" +
        s.name + " (" + groupCount + " group" + (groupCount !== 1 ? "s" : "") + ")" +
        "</option>";
    }).join("");

  /* Member list */
  var memberHtml = members.map(function (m) {
    var init  = Utils.initials(m.first_name + " " + m.last_name);
    var color = avatarColor(init);
    return '<div class="member-item">' +
      '<div class="avatar" style="width:26px;height:26px;font-size:.6rem;background:' + color + ';">' + init + "</div>" +
      '<span class="member-name">' + m.first_name + " " + m.last_name + "</span>" +
      '<span class="member-index">' + (m.index_number || "–") + "</span>" +
      "</div>";
  }).join("");

  return '<div class="group-card">' +
    '<div class="group-card-header">' +
    '<div class="gc-topic">📂 ' + topic + "</div>" +
    '<div class="gc-meta">' +
    "<span>🏛 " + dept + "</span>" +
    "<span>👥 " + members.length + " member" + (members.length !== 1 ? "s" : "") + "</span>" +
    (assignedSup ? "<span>👨‍🏫 " + assignedSup.name + "</span>" : "<span>⚠️ Unassigned</span>") +
    "</div></div>" +
    '<div class="group-card-body">' +
    '<div class="member-list">' + memberHtml + "</div>" +
    '<div class="group-assign-row">' +
    "<label>Supervisor:</label>" +
    '<select data-group-topic="' + topic + '">' + supOpts + "</select>" +
    (assignedSup
      ? '<span class="workload-tag" data-sup-id="' + assignedSup.id + '">' +
        countGroupsForSup(assignedSup.id) + " group" +
        (countGroupsForSup(assignedSup.id) !== 1 ? "s" : "") + "</span>"
      : "") +
    "</div></div></div>";
}

/* ══════════════════════════════════════
   USERS PAGE
══════════════════════════════════════ */
function initUsers(user) {
  var allUsers   = DB_USERS.filter(function (u) { return u.role !== "admin"; });
  var roleFilter = "all";
  var searchTerm = "";

  var tabs = document.querySelectorAll(".role-filter-tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      roleFilter = tab.dataset.role;
      renderUsers();
    });
  });

  var searchEl = document.getElementById("userSearch");
  if (searchEl) {
    searchEl.addEventListener("input", function () {
      searchTerm = searchEl.value.trim().toLowerCase();
      renderUsers();
    });
  }

  var addBtn    = document.getElementById("addUserBtn");
  var closeBtn  = document.getElementById("closeUserModal");
  var cancelBtn = document.getElementById("cancelUserBtn");
  var submitBtn = document.getElementById("submitUserBtn");

  if (addBtn)    addBtn.addEventListener("click",    function () { openModal("userModal"); });
  if (closeBtn)  closeBtn.addEventListener("click",  function () { closeModal("userModal"); });
  if (cancelBtn) cancelBtn.addEventListener("click", function () { closeModal("userModal"); });

  if (submitBtn) {
    submitBtn.addEventListener("click", function () {
      var first = document.getElementById("uFirstName").value.trim();
      var last  = document.getElementById("uLastName").value.trim();
      var email = document.getElementById("uEmail").value.trim();
      var role  = document.getElementById("uRole").value;
      var uid   = document.getElementById("uId").value.trim();
      var dept  = document.getElementById("uDept").value;

      if (!first || !last || !email || !role || !uid || !dept) { showToast("Please fill in all required fields.", "warning"); return; }
      if (!Utils.isValidEmail(email)) { showToast("Please enter a valid email address.", "warning"); return; }
      if (DB.getUserByEmail(email))   { showToast("A user with this email already exists.", "error"); return; }

      var newUser = { id: Utils.uid("USR"), role: role, name: first + " " + last, email: email.toLowerCase(), password: "changeme", department: dept, status: "active" };
      if (role === "student") { newUser.indexNumber = uid; newUser.supervisorId = null; newUser.level = 400; }
      else { newUser.staffId = uid; newUser.assignedStudents = []; newUser.specialization = ""; }
      DB_USERS.push(newUser);
      allUsers = DB_USERS.filter(function (u) { return u.role !== "admin"; });

      closeModal("userModal");
      document.getElementById("userForm").reset();
      showToast(first + " " + last + " added successfully!", "success");
      renderUsers();
    });
  }

  function renderUsers() {
    var tbody = document.getElementById("usersTable");
    if (!tbody) return;
    var filtered = allUsers.filter(function (u) {
      return (roleFilter === "all" || u.role === roleFilter) &&
        (!searchTerm || u.name.toLowerCase().includes(searchTerm) || u.email.toLowerCase().includes(searchTerm));
    });

    if (filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:32px;">No users found.</td></tr>'; return; }

    tbody.innerHTML = filtered.map(function (u) {
      return "<tr>" +
        "<td><div style='display:flex;align-items:center;gap:10px;'>" + makeAvatar(u.name,"32px","0.75rem") + "<span style='font-weight:600;'>" + u.name + "</span></div></td>" +
        "<td>" + badge(Utils.titleCase(u.role)) + "</td>" +
        "<td>" + (u.indexNumber || u.staffId || "–") + "</td>" +
        "<td>" + (u.department || "–") + "</td>" +
        "<td>" + u.email + "</td>" +
        "<td>" + badge("Active") + "</td>" +
        '<td><div class="user-actions">' +
        '<button class="btn btn-danger btn-sm" data-del-id="' + u.id + '">🗑 Remove</button>' +
        "</div></td></tr>";
    }).join("");

    tbody.querySelectorAll("button[data-del-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var u = DB.getUserById(btn.dataset.delId);
        if (!u || !window.confirm("Remove " + u.name + "?")) return;
        DB_USERS.splice(DB_USERS.indexOf(u), 1);
        allUsers = DB_USERS.filter(function (x) { return x.role !== "admin"; });
        showToast(u.name + " removed.", "info");
        renderUsers();
      });
    });
  }

  renderUsers();
}

/* ══════════════════════════════════════
   PROJECTS PAGE
══════════════════════════════════════ */
function initProjects() {
  var statusFilter = "all";
  var searchTerm   = "";

  document.querySelectorAll(".role-filter-tab[data-status]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".role-filter-tab[data-status]").forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      statusFilter = tab.dataset.status;
      renderProjects();
    });
  });

  var searchEl = document.getElementById("projectSearch");
  if (searchEl) searchEl.addEventListener("input", function () { searchTerm = searchEl.value.trim().toLowerCase(); renderProjects(); });

  function renderProjects() {
    var tbody = document.getElementById("projectsTable");
    if (!tbody) return;
    var filtered = DB_PROJECTS.filter(function (p) {
      var stu = DB.getUserById(p.studentId);
      return (statusFilter === "all" || p.status === statusFilter) &&
        (!searchTerm || p.title.toLowerCase().includes(searchTerm) || (stu && stu.name.toLowerCase().includes(searchTerm)));
    });

    if (filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:32px;">No projects found.</td></tr>'; return; }

    tbody.innerHTML = filtered.map(function (p) {
      var stu = DB.getUserById(p.studentId);
      var sup = DB.getUserById(p.supervisorId);
      return "<tr>" +
        "<td><div class='project-row-title'>" + Utils.truncate(p.title,55) + "</div></td>" +
        "<td>" + (stu ? stu.name : "–") + "</td>" +
        "<td>" + (sup ? sup.name : "–") + "</td>" +
        "<td><div style='display:flex;align-items:center;gap:8px;'><div class='progress-track' style='flex:1;min-width:80px;'><div class='progress-fill blue' style='width:" + p.completionPercent + "%;'></div></div><span style='font-size:var(--font-size-xs);font-weight:700;'>" + p.completionPercent + "%</span></div></td>" +
        "<td>" + Utils.shortDate(p.deadline) + "</td>" +
        "<td>" + badge(p.status) + "</td>" +
        "<td><button class='btn btn-outline btn-sm'>👁 View</button></td></tr>";
    }).join("");
  }

  renderProjects();
}

/* ══════════════════════════════════════
   REPORTS PAGE
══════════════════════════════════════ */
function initReports() {
  var students    = DB_USERS.filter(function (u) { return u.role === "student"; });
  var supervisors = DB_USERS.filter(function (u) { return u.role === "supervisor"; });
  var projects    = DB_PROJECTS;

  ["reportProgress","reportWorkload","reportCompletion"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", function () { showToast("Report generated! (PDF export available in production build.)", "success", 4000); });
  });

  var summaryEl = document.getElementById("systemSummary");
  if (summaryEl) {
    var rows = [
      { label: "Total Students",           value: students.length },
      { label: "Total Supervisors",         value: supervisors.length },
      { label: "Total Projects",            value: projects.length },
      { label: "Total Groups",              value: Object.keys(Groups).length },
      { label: "Assigned Groups",           value: Object.keys(GroupAssignments).length },
      { label: "Unassigned Groups",         value: Object.keys(Groups).filter(function(k){return !GroupAssignments[k];}).length },
      { label: "Total Submissions",         value: DB_SUBMISSIONS.length },
      { label: "Approved Submissions",      value: DB_SUBMISSIONS.filter(function(s){return s.status==="Approved";}).length },
      { label: "Total Feedback Given",      value: DB_FEEDBACK.length },
    ];
    summaryEl.innerHTML = rows.map(function (r) {
      return '<div class="report-stat-row"><span class="rs-label">' + r.label + '</span><span class="rs-value">' + r.value + "</span></div>";
    }).join("");
  }

  var projTbody = document.getElementById("reportProjectTable");
  if (projTbody) {
    projTbody.innerHTML = projects.length === 0
      ? '<tr><td colspan="6" class="text-center text-muted" style="padding:24px;">No projects yet.</td></tr>'
      : projects.map(function (p) {
          var stu = DB.getUserById(p.studentId);
          var sup = DB.getUserById(p.supervisorId);
          return "<tr><td>" + (stu ? stu.name : "–") + "</td><td>" + Utils.truncate(p.title,50) + "</td><td>" + (sup ? sup.name : "–") + "</td>" +
            "<td><div style='display:flex;align-items:center;gap:8px;'><div class='progress-track' style='width:100px;'><div class='progress-fill blue' style='width:" + p.completionPercent + "%;'></div></div><span style='font-size:var(--font-size-xs);font-weight:700;'>" + p.completionPercent + "%</span></div></td>" +
            "<td>" + badge(p.status) + "</td><td>" + Utils.shortDate(p.deadline) + "</td></tr>";
        }).join("");
  }

  var wlTbody = document.getElementById("reportWorkloadTable");
  if (wlTbody) {
    wlTbody.innerHTML = supervisors.length === 0
      ? '<tr><td colspan="5" class="text-center text-muted" style="padding:24px;">No supervisors yet.</td></tr>'
      : supervisors.map(function (sup) {
          var groupCount = countGroupsForSup(sup.id);
          var pending    = 0;
          DB.getStudentsBySupervisor(sup.id).forEach(function (s) {
            DB.getSubmissionsByStudent(s.id).forEach(function (sub) { if (sub.status === "Under Review") pending++; });
          });
          return "<tr><td><div style='display:flex;align-items:center;gap:8px;'>" + makeAvatar(sup.name,"28px","0.65rem") + sup.name + "</div></td>" +
            "<td>" + sup.department + "</td><td>" + groupCount + " group" + (groupCount!==1?"s":"") + "</td>" +
            "<td>" + (pending > 0 ? pending + " pending" : "–") + "</td><td>–</td></tr>";
        }).join("");
  }
}

/* ══════════════════════════════════════
   NOTIFICATIONS PAGE
══════════════════════════════════════ */
function initNotifications(user) {
  var notifs  = DB_NOTIFICATIONS.slice();
  var listEl  = document.getElementById("notifList");
  var markBtn = document.getElementById("markAllReadBtn");
  if (!listEl) return;

  function render() {
    if (notifs.length === 0) { listEl.innerHTML = '<div class="empty-state"><div class="es-icon">🔔</div><p>No notifications.</p></div>'; return; }
    listEl.innerHTML = notifs.map(function (n, idx) {
      var owner = DB.getUserById(n.userId);
      return '<div class="notif-item ' + (n.read ? "" : "unread") + '" data-idx="' + idx + '">' +
        '<span class="notif-icon">' + Utils.notifIcon(n.type) + "</span><div>" +
        '<div class="notif-msg">' + (owner ? '<span style="font-size:var(--font-size-xs);color:var(--gray-500);">[' + owner.name + "] </span>" : "") + n.message + "</div>" +
        '<div class="notif-time">' + Utils.formatDateTime(n.date) + "</div></div></div>";
    }).join("");
    listEl.querySelectorAll(".notif-item").forEach(function (item) {
      item.addEventListener("click", function () { var idx=parseInt(item.dataset.idx,10); notifs[idx].read=true; item.classList.remove("unread"); updateNotifBadges(user.id); });
    });
  }

  render();
  if (markBtn) markBtn.addEventListener("click", function () { notifs.forEach(function(n){n.read=true;}); render(); updateNotifBadges(user.id); showToast("All notifications marked as read.","success"); });
}

/* ══════════════════════════════════════
   PROFILE PAGE
══════════════════════════════════════ */
function initProfile(user) {
  var avEl = document.getElementById("profileAvatar");
  if (avEl) { var init=Utils.initials(user.name); avEl.textContent=init; avEl.style.background=avatarColor(init); }
  var nameEl=document.getElementById("profileName"); var idEl=document.getElementById("profileId");
  if (nameEl) nameEl.textContent=user.name;
  if (idEl)   idEl.textContent=user.staffId||"Administrator";
  var fields={profileFullName:user.name,profileEmail:user.email,profileStaffId:user.staffId||"",profileDept:user.department||""};
  Object.keys(fields).forEach(function(id){var el=document.getElementById(id);if(el)el.value=fields[id];});
  var saveBtn=document.getElementById("saveProfileBtn");
  if (saveBtn) saveBtn.addEventListener("click",function(){showToast("Profile updated successfully!","success");});
  var pwBtn=document.getElementById("changePasswordBtn");
  if (pwBtn) pwBtn.addEventListener("click",function(){
    var curr=document.getElementById("currentPassword").value;
    var newP=document.getElementById("newPassword").value;
    var conf=document.getElementById("confirmPassword").value;
    if(!curr||!newP||!conf){showToast("Please fill in all password fields.","warning");return;}
    if(newP.length<6){showToast("New password must be at least 6 characters.","warning");return;}
    if(newP!==conf){showToast("Passwords do not match.","warning");return;}
    showToast("Password changed successfully!","success");
    document.getElementById("currentPassword").value="";
    document.getElementById("newPassword").value="";
    document.getElementById("confirmPassword").value="";
  });
}

/* ══════════════════════════════════════
   ROUTE
══════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", function () {
  var user = initApp("admin");
  if (!user) return;

  var page = currentPage();
  if      (page === "dashboard.html")     initDashboard(user);
  else if (page === "users.html")         initUsers(user);
  else if (page === "projects.html")      initProjects();
  else if (page === "reports.html")       initReports();
  else if (page === "notifications.html") initNotifications(user);
  else if (page === "profile.html")       initProfile(user);
});