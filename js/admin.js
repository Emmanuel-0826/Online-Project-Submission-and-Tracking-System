/* ============================================================
   js/admin.js — Admin Portal Logic
   Handles: dashboard, users, projects, assign,
            reports, notifications, profile
============================================================ */

"use strict";

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
function avatarColor(initials) {
  var palette = [
    "#1a73e8", "#34a853", "#ea4335", "#fbbc04",
    "#0d47a1", "#00897b", "#e65100", "#6a1b9a"
  ];
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
    "Upcoming":       { cls: "badge-primary",   icon: "📅" },
    "Active":         { cls: "badge-success",   icon: "✅" },
    "Suspended":      { cls: "badge-danger",    icon: "🚫" },
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
   DASHBOARD
══════════════════════════════════════ */
function initDashboard(user) {
  var students    = DB_USERS.filter(function (u) { return u.role === "student"; });
  var supervisors = DB_USERS.filter(function (u) { return u.role === "supervisor"; });
  var projects    = DB_PROJECTS;
  var completed   = projects.filter(function (p) { return p.status === "Completed"; });

  /* Stat cards */
  function el(id) { return document.getElementById(id); }
  el("statStudents").textContent   = students.length;
  el("statSupervisors").textContent = supervisors.length;
  el("statProjects").textContent   = projects.filter(function (p) { return p.status === "In Progress"; }).length;
  el("statCompleted").textContent  = completed.length;

  /* Topbar subtitle */
  var sub = el("topbarSub");
  if (sub) sub.textContent = "Welcome back, " + user.name.split(" ")[0] + "!";

  /* Project status overview */
  var statusEl = el("projectStatusOverview");
  if (statusEl) {
    var statusGroups = {};
    projects.forEach(function (p) {
      statusGroups[p.status] = (statusGroups[p.status] || 0) + 1;
    });

    statusEl.innerHTML = Object.keys(statusGroups).map(function (s) {
      var count = statusGroups[s];
      var pct   = Math.round((count / projects.length) * 100);
      return '<div class="report-stat-row">' +
        '<span class="rs-label">' + badge(s) + "</span>" +
        '<div style="display:flex;align-items:center;gap:12px;flex:1;margin:0 var(--space-lg);">' +
        '<div class="progress-track" style="flex:1"><div class="progress-fill blue" style="width:' + pct + '%;"></div></div>' +
        '<span style="font-size:var(--font-size-xs);color:var(--gray-600);min-width:30px;">' + pct + "%</span>" +
        "</div>" +
        '<span class="rs-value">' + count + " project" + (count !== 1 ? "s" : "") + "</span>" +
        "</div>";
    }).join("");
  }

  /* Supervisor workload */
  var workEl = el("supervisorWorkload");
  if (workEl) {
    workEl.innerHTML = supervisors.map(function (sup) {
      var count = DB.getStudentsBySupervisor(sup.id).length;
      var init  = Utils.initials(sup.name);
      return '<div class="workload-item">' +
        makeAvatar(sup.name, "32px", "0.75rem") +
        '<span class="wi-name">' + sup.name + "</span>" +
        '<span class="wi-count">' + count + " student" + (count !== 1 ? "s" : "") + "</span>" +
        "</div>";
    }).join("");
  }

  /* Recent activity — built from submissions + feedback */
  var actEl = el("recentActivity");
  if (actEl) {
    var activities = [];

    DB_SUBMISSIONS.forEach(function (sub) {
      var stu = DB.getUserById(sub.studentId);
      var ch  = DB.getChapterById(sub.chapterId);
      if (stu && ch) {
        activities.push({
          icon: "📤",
          bg:   "var(--primary-light)",
          msg:  "<strong>" + stu.name + "</strong> submitted " + ch.label + " – " + ch.title,
          time: sub.submittedAt,
        });
      }
    });

    DB_FEEDBACK.forEach(function (fb) {
      var sup = DB.getUserById(fb.supervisorId);
      var stu = DB.getUserById(fb.studentId);
      if (sup && stu) {
        activities.push({
          icon: "💬",
          bg:   "var(--secondary-light)",
          msg:  "<strong>" + sup.name + "</strong> gave feedback to <strong>" + stu.name + "</strong> on " + fb.chapterLabel,
          time: fb.date + " 00:00",
        });
      }
    });

    /* Sort by time descending */
    activities.sort(function (a, b) {
      return new Date(b.time.replace(" ", "T")) - new Date(a.time.replace(" ", "T"));
    });

    if (activities.length === 0) {
      actEl.innerHTML =
        '<div class="empty-state"><div class="es-icon">🕐</div><p>No recent activity.</p></div>';
    } else {
      actEl.innerHTML = activities.slice(0, 8).map(function (a) {
        return '<div class="activity-item">' +
          '<div class="activity-icon" style="background:' + a.bg + ';">' + a.icon + "</div>" +
          '<div class="activity-info">' +
          '<div class="act-msg">' + a.msg + "</div>" +
          '<div class="act-time">' + Utils.formatDateTime(a.time) + "</div>" +
          "</div></div>";
      }).join("");
    }
  }
}

/* ══════════════════════════════════════
   USERS PAGE
══════════════════════════════════════ */
function initUsers(user) {
  var allUsers = DB_USERS.filter(function (u) { return u.role !== "admin"; });
  var roleFilter = "all";
  var searchTerm = "";

  /* Role filter tabs */
  var tabs = document.querySelectorAll(".role-filter-tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      roleFilter = tab.dataset.role;
      renderUsers();
    });
  });

  /* Search */
  var searchEl = document.getElementById("userSearch");
  if (searchEl) {
    searchEl.addEventListener("input", function () {
      searchTerm = searchEl.value.trim().toLowerCase();
      renderUsers();
    });
  }

  /* Add user button */
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

      if (!first || !last || !email || !role || !uid || !dept) {
        showToast("Please fill in all required fields.", "warning");
        return;
      }
      if (!Utils.isValidEmail(email)) {
        showToast("Please enter a valid email address.", "warning");
        return;
      }
      if (DB.getUserByEmail(email)) {
        showToast("A user with this email already exists.", "error");
        return;
      }

      /* Add to mock DB */
      var newUser = {
        id:         Utils.uid("USR"),
        role:       role,
        name:       first + " " + last,
        email:      email.toLowerCase(),
        password:   "changeme",
        avatar:     Utils.initials(first + " " + last),
        department: dept,
      };
      if (role === "student") {
        newUser.indexNumber  = uid;
        newUser.supervisorId = null;
        newUser.projectId    = null;
        newUser.level        = 400;
      } else {
        newUser.staffId         = uid;
        newUser.assignedStudents = [];
        newUser.specialization   = "";
      }

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
      var matchRole   = roleFilter === "all" || u.role === roleFilter;
      var matchSearch = !searchTerm ||
        u.name.toLowerCase().includes(searchTerm) ||
        u.email.toLowerCase().includes(searchTerm);
      return matchRole && matchSearch;
    });

    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted" style="padding:32px;">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (u) {
      var idStr = u.indexNumber || u.staffId || "–";
      return "<tr>" +
        "<td>" +
        '<div style="display:flex;align-items:center;gap:10px;">' +
        makeAvatar(u.name, "32px", "0.75rem") +
        '<span style="font-weight:600;">' + u.name + "</span>" +
        "</div></td>" +
        "<td>" + badge(Utils.titleCase(u.role)) + "</td>" +
        "<td>" + idStr + "</td>" +
        "<td>" + (u.department || "–") + "</td>" +
        "<td>" + u.email + "</td>" +
        "<td>" + badge("Active") + "</td>" +
        '<td><div class="user-actions">' +
        '<button class="btn btn-outline btn-sm" data-edit-id="' + u.id + '">✏️ Edit</button>' +
        '<button class="btn btn-danger  btn-sm" data-del-id="'  + u.id + '">🗑 Remove</button>' +
        "</div></td>" +
        "</tr>";
    }).join("");

    /* Edit buttons */
    tbody.querySelectorAll("button[data-edit-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var u = DB.getUserById(btn.dataset.editId);
        if (!u) return;
        var parts = u.name.split(" ");
        document.getElementById("uFirstName").value = parts[0]  || "";
        document.getElementById("uLastName").value  = parts.slice(1).join(" ") || "";
        document.getElementById("uEmail").value     = u.email;
        document.getElementById("uRole").value      = u.role;
        document.getElementById("uId").value        = u.indexNumber || u.staffId || "";
        document.getElementById("uDept").value      = u.department || "";
        document.getElementById("userModalTitle").textContent = "✏️ Edit User";
        openModal("userModal");
      });
    });

    /* Delete buttons */
    tbody.querySelectorAll("button[data-del-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var u = DB.getUserById(btn.dataset.delId);
        if (!u) return;
        if (!window.confirm("Remove " + u.name + " from the system?")) return;
        var idx = DB_USERS.indexOf(u);
        if (idx > -1) DB_USERS.splice(idx, 1);
        allUsers = DB_USERS.filter(function (x) { return x.role !== "admin"; });
        showToast(u.name + " has been removed.", "info");
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

  /* Status filter tabs */
  var tabs = document.querySelectorAll(".role-filter-tab[data-status]");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      statusFilter = tab.dataset.status;
      renderProjects();
    });
  });

  /* Search */
  var searchEl = document.getElementById("projectSearch");
  if (searchEl) {
    searchEl.addEventListener("input", function () {
      searchTerm = searchEl.value.trim().toLowerCase();
      renderProjects();
    });
  }

  function renderProjects() {
    var tbody = document.getElementById("projectsTable");
    if (!tbody) return;

    var filtered = DB_PROJECTS.filter(function (p) {
      var matchStatus = statusFilter === "all" || p.status === statusFilter;
      var stu = DB.getUserById(p.studentId);
      var matchSearch = !searchTerm ||
        p.title.toLowerCase().includes(searchTerm) ||
        (stu && stu.name.toLowerCase().includes(searchTerm));
      return matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted" style="padding:32px;">No projects found.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (p) {
      var stu = DB.getUserById(p.studentId);
      var sup = DB.getUserById(p.supervisorId);
      var stuName = stu ? stu.name : "–";
      var supName = sup ? sup.name : "–";

      return "<tr>" +
        "<td>" +
        '<div class="project-row-title">' + Utils.truncate(p.title, 55) + "</div>" +
        '<div class="project-row-meta">' + Utils.truncate(p.topic, 70) + "</div>" +
        "</td>" +
        "<td>" +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        makeAvatar(stuName, "28px", "0.65rem") +
        stuName +
        "</div></td>" +
        "<td>" + supName + "</td>" +
        "<td>" +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<div class="progress-track" style="flex:1;min-width:80px;">' +
        '<div class="progress-fill blue" style="width:' + p.completionPercent + '%;"></div>' +
        "</div>" +
        '<span style="font-size:var(--font-size-xs);font-weight:700;">' + p.completionPercent + "%</span>" +
        "</div></td>" +
        "<td>" + Utils.shortDate(p.deadline) + "</td>" +
        "<td>" + badge(p.status) + "</td>" +
        '<td><div class="user-actions">' +
        '<button class="btn btn-outline btn-sm" data-prj-id="' + p.id + '">👁 View</button>' +
        "</div></td>" +
        "</tr>";
    }).join("");

    /* View buttons */
    tbody.querySelectorAll("button[data-prj-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var p   = DB.getProjectById(btn.dataset.prjId);
        var stu = p ? DB.getUserById(p.studentId)   : null;
        var sup = p ? DB.getUserById(p.supervisorId) : null;
        if (!p) return;
        showToast(
          "Project: " + p.title +
          " | Student: " + (stu ? stu.name : "–") +
          " | Progress: " + p.completionPercent + "%",
          "info",
          5000
        );
      });
    });
  }

  renderProjects();
}

/* ══════════════════════════════════════
   ASSIGN PAGE
══════════════════════════════════════ */
function initAssign() {
  var students    = DB_USERS.filter(function (u) { return u.role === "student"; });
  var supervisors = DB_USERS.filter(function (u) { return u.role === "supervisor"; });

  /* Student assignment cards */
  var listEl = document.getElementById("assignList");
  if (listEl) {
    listEl.innerHTML = students.map(function (s) {
      var init = Utils.initials(s.name);

      /* Build supervisor options */
      var opts = supervisors.map(function (sup) {
        var selected = sup.id === s.supervisorId ? "selected" : "";
        return '<option value="' + sup.id + '" ' + selected + ">" + sup.name + "</option>";
      }).join("");

      return '<div class="assign-card">' +
        '<div class="assign-card-header">' +
        '<div class="avatar" style="width:38px;height:38px;font-size:.85rem;background:' + avatarColor(init) + ';">' + init + "</div>" +
        '<div class="ac-info">' +
        '<div class="ac-name">' + s.name + "</div>" +
        '<div class="ac-meta">' + (s.indexNumber || "–") + " &nbsp;·&nbsp; " + s.department + "</div>" +
        "</div>" +
        badge(s.supervisorId ? "Assigned" : "Unassigned") +
        "</div>" +
        '<div class="assign-card-body">' +
        "<label>Assign Supervisor:</label>" +
        '<select data-student-id="' + s.id + '">' +
        '<option value="">— Select supervisor —</option>' +
        opts +
        "</select>" +
        '<button class="btn btn-primary btn-sm" data-assign-id="' + s.id + '">💾 Save</button>' +
        "</div></div>";
    }).join("");

    /* Save assignment */
    listEl.querySelectorAll("button[data-assign-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var stuId  = btn.dataset.assignId;
        var select = listEl.querySelector('select[data-student-id="' + stuId + '"]');
        var supId  = select ? select.value : "";
        if (!supId) {
          showToast("Please select a supervisor first.", "warning");
          return;
        }
        /* Update mock DB */
        var stu = DB.getUserById(stuId);
        if (stu) stu.supervisorId = supId;

        var sup = DB.getUserById(supId);
        var supName = sup ? sup.name : supId;
        var stuName = stu ? stu.name : stuId;

        showToast(stuName + " has been assigned to " + supName + ".", "success");
        renderWorkload();
      });
    });
  }

  function renderWorkload() {
    var wlEl = document.getElementById("workloadList");
    if (!wlEl) return;
    wlEl.innerHTML = supervisors.map(function (sup) {
      var count = DB.getStudentsBySupervisor(sup.id).length;
      var init  = Utils.initials(sup.name);
      var color = count >= 4 ? "var(--danger)"
                : count >= 2 ? "var(--primary)"
                : "var(--secondary)";
      return '<div class="workload-item">' +
        '<div class="avatar" style="width:34px;height:34px;font-size:.78rem;background:' + avatarColor(init) + ';">' + init + "</div>" +
        '<span class="wi-name">' + sup.name + "</span>" +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<div class="progress-track" style="width:80px;">' +
        '<div class="progress-fill" style="width:' + Math.min(count * 25, 100) + '%;background:' + color + ';"></div>' +
        "</div>" +
        '<span class="wi-count">' + count + " student" + (count !== 1 ? "s" : "") + "</span>" +
        "</div></div>";
    }).join("");
  }

  renderWorkload();
}

/* ══════════════════════════════════════
   REPORTS PAGE
══════════════════════════════════════ */
function initReports() {
  var students    = DB_USERS.filter(function (u) { return u.role === "student"; });
  var supervisors = DB_USERS.filter(function (u) { return u.role === "supervisor"; });
  var projects    = DB_PROJECTS;

  /* Report card click handlers */
  var progressCard    = document.getElementById("reportProgress");
  var workloadCard    = document.getElementById("reportWorkload");
  var completionCard  = document.getElementById("reportCompletion");

  if (progressCard) {
    progressCard.addEventListener("click", function () {
      showToast("Project Progress Report generated! (PDF export coming in production build.)", "success", 4000);
    });
  }
  if (workloadCard) {
    workloadCard.addEventListener("click", function () {
      showToast("Supervisor Workload Report generated! (PDF export coming in production build.)", "success", 4000);
    });
  }
  if (completionCard) {
    completionCard.addEventListener("click", function () {
      showToast("Completion Report generated! (PDF export coming in production build.)", "success", 4000);
    });
  }

  /* System Summary */
  var summaryEl = document.getElementById("systemSummary");
  if (summaryEl) {
    var totalSubs     = DB_SUBMISSIONS.length;
    var approvedSubs  = DB_SUBMISSIONS.filter(function (s) { return s.status === "Approved"; }).length;
    var pendingSubs   = DB_SUBMISSIONS.filter(function (s) { return s.status === "Under Review"; }).length;
    var totalFeedback = DB_FEEDBACK.length;
    var avgProgress   = Math.round(
      projects.reduce(function (sum, p) { return sum + p.completionPercent; }, 0) / projects.length
    );

    var rows = [
      { label: "Total Students",          value: students.length },
      { label: "Total Supervisors",        value: supervisors.length },
      { label: "Total Projects",           value: projects.length },
      { label: "Projects In Progress",     value: projects.filter(function (p) { return p.status === "In Progress"; }).length },
      { label: "Projects Completed",       value: projects.filter(function (p) { return p.status === "Completed"; }).length },
      { label: "Total Chapter Submissions",value: totalSubs },
      { label: "Approved Submissions",     value: approvedSubs },
      { label: "Pending Reviews",          value: pendingSubs },
      { label: "Total Feedback Given",     value: totalFeedback },
      { label: "Average Project Progress", value: avgProgress + "%" },
    ];

    summaryEl.innerHTML = rows.map(function (r) {
      return '<div class="report-stat-row">' +
        '<span class="rs-label">' + r.label + "</span>" +
        '<span class="rs-value">' + r.value + "</span>" +
        "</div>";
    }).join("");
  }

  /* Project progress table */
  var projTbody = document.getElementById("reportProjectTable");
  if (projTbody) {
    projTbody.innerHTML = projects.map(function (p) {
      var stu = DB.getUserById(p.studentId);
      var sup = DB.getUserById(p.supervisorId);
      return "<tr>" +
        "<td>" + (stu ? stu.name : "–") + "</td>" +
        "<td>" + Utils.truncate(p.title, 50) + "</td>" +
        "<td>" + (sup ? sup.name : "–") + "</td>" +
        "<td>" +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<div class="progress-track" style="width:100px;">' +
        '<div class="progress-fill blue" style="width:' + p.completionPercent + '%;"></div>' +
        "</div>" +
        '<span style="font-size:var(--font-size-xs);font-weight:700;">' + p.completionPercent + "%</span>" +
        "</div></td>" +
        "<td>" + badge(p.status) + "</td>" +
        "<td>" + Utils.shortDate(p.deadline) + "</td>" +
        "</tr>";
    }).join("");
  }

  /* Supervisor workload table */
  var wlTbody = document.getElementById("reportWorkloadTable");
  if (wlTbody) {
    wlTbody.innerHTML = supervisors.map(function (sup) {
      var assigned = DB.getStudentsBySupervisor(sup.id);
      var pending  = 0;
      var totalPct = 0;

      assigned.forEach(function (s) {
        var subs = DB.getSubmissionsByStudent(s.id);
        subs.forEach(function (sub) {
          if (sub.status === "Under Review") pending++;
        });
        var prj = DB.getProjectByStudent(s.id);
        if (prj) totalPct += prj.completionPercent;
      });

      var avgPct = assigned.length > 0
        ? Math.round(totalPct / assigned.length) + "%"
        : "–";

      return "<tr>" +
        "<td>" +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        makeAvatar(sup.name, "28px", "0.65rem") +
        sup.name +
        "</div></td>" +
        "<td>" + sup.department + "</td>" +
        "<td>" + assigned.length + "</td>" +
        "<td>" + (pending > 0 ? badge("Under Review").replace("Under Review", pending + " pending") : "–") + "</td>" +
        "<td>" + avgPct + "</td>" +
        "</tr>";
    }).join("");
  }
}

/* ══════════════════════════════════════
   NOTIFICATIONS PAGE
══════════════════════════════════════ */
function initNotifications(user) {
  /* Admin sees all notifications across system */
  var notifs  = DB_NOTIFICATIONS.slice();
  var listEl  = document.getElementById("notifList");
  var markBtn = document.getElementById("markAllReadBtn");

  if (!listEl) return;

  function render() {
    if (notifs.length === 0) {
      listEl.innerHTML =
        '<div class="empty-state"><div class="es-icon">🔔</div><p>No notifications.</p></div>';
      return;
    }
    listEl.innerHTML = notifs.map(function (n, idx) {
      var owner = DB.getUserById(n.userId);
      return '<div class="notif-item ' + (n.read ? "" : "unread") + '" data-idx="' + idx + '">' +
        '<span class="notif-icon">' + Utils.notifIcon(n.type) + "</span>" +
        "<div>" +
        '<div class="notif-msg">' +
        (owner ? '<span style="font-size:var(--font-size-xs);color:var(--gray-500);">[' + owner.name + "]</span> " : "") +
        n.message + "</div>" +
        '<div class="notif-time">' + Utils.formatDateTime(n.date) + "</div>" +
        "</div></div>";
    }).join("");

    listEl.querySelectorAll(".notif-item").forEach(function (item) {
      item.addEventListener("click", function () {
        var idx = parseInt(item.dataset.idx, 10);
        notifs[idx].read = true;
        item.classList.remove("unread");
        updateNotifBadges(user.id);
      });
    });
  }

  render();

  if (markBtn) {
    markBtn.addEventListener("click", function () {
      notifs.forEach(function (n) { n.read = true; });
      render();
      updateNotifBadges(user.id);
      showToast("All notifications marked as read.", "success");
    });
  }
}

/* ══════════════════════════════════════
   PROFILE PAGE
══════════════════════════════════════ */
function initProfile(user) {
  var avEl = document.getElementById("profileAvatar");
  if (avEl) {
    var init = Utils.initials(user.name);
    avEl.textContent      = init;
    avEl.style.background = avatarColor(init);
  }

  var nameEl = document.getElementById("profileName");
  var idEl   = document.getElementById("profileId");
  if (nameEl) nameEl.textContent = user.name;
  if (idEl)   idEl.textContent   = user.staffId || "Administrator";

  var fields = {
    profileFullName: user.name,
    profileEmail:    user.email,
    profileStaffId:  user.staffId    || "",
    profileDept:     user.department || "",
  };
  Object.keys(fields).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = fields[id];
  });

  var saveBtn = document.getElementById("saveProfileBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      showToast("Profile updated successfully!", "success");
    });
  }

  var pwBtn = document.getElementById("changePasswordBtn");
  if (pwBtn) {
    pwBtn.addEventListener("click", function () {
      var curr = document.getElementById("currentPassword").value;
      var newP = document.getElementById("newPassword").value;
      var conf = document.getElementById("confirmPassword").value;
      if (!curr || !newP || !conf) { showToast("Please fill in all password fields.", "warning"); return; }
      if (newP.length < 6)        { showToast("New password must be at least 6 characters.", "warning"); return; }
      if (newP !== conf)          { showToast("Passwords do not match.", "warning"); return; }
      showToast("Password changed successfully!", "success");
      document.getElementById("currentPassword").value = "";
      document.getElementById("newPassword").value     = "";
      document.getElementById("confirmPassword").value = "";
    });
  }
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
  else if (page === "assign.html")        initAssign();
  else if (page === "reports.html")       initReports();
  else if (page === "notifications.html") initNotifications(user);
  else if (page === "profile.html")       initProfile(user);
});