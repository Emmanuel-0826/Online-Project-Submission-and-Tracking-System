/* ============================================================
   js/supervisor.js — Supervisor Portal Logic
   Handles: dashboard, students, review, progress,
            schedule, notifications, profile
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
  };
  var b = map[status] || { cls: "badge-secondary", icon: "•" };
  return '<span class="badge ' + b.cls + '">' + b.icon + " " + status + "</span>";
}

function currentPage() {
  var parts = window.location.pathname.split("/");
  return parts[parts.length - 1];
}

function makeAvatar(name, size, fontSize) {
  var init  = Utils.initials(name);
  var color = avatarColor(init);
  return '<div class="avatar" style="width:' + size + ';height:' + size +
    ';font-size:' + fontSize + ';background:' + color + ';">' + init + "</div>";
}

/* ══════════════════════════════════════
   REVIEW BADGE (pending submissions)
══════════════════════════════════════ */
function updateReviewBadge(supervisorId) {
  var students  = DB.getStudentsBySupervisor(supervisorId);
  var pending   = 0;
  students.forEach(function (s) {
    var subs = DB.getSubmissionsByStudent(s.id);
    subs.forEach(function (sub) {
      if (sub.status === "Under Review") pending++;
    });
  });

  var badge = document.getElementById("reviewBadge");
  if (badge) {
    if (pending > 0) {
      badge.textContent = pending;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }
}

/* ══════════════════════════════════════
   DASHBOARD PAGE
══════════════════════════════════════ */
function initDashboard(user) {
  var students  = DB.getStudentsBySupervisor(user.id);
  var meetings  = DB.getMeetingsByUser(user.id);
  var upcoming  = meetings.filter(function (m) { return m.status === "Upcoming"; });

  /* Count pending & approved across all students */
  var pendingSubs  = [];
  var approvedCount = 0;

  students.forEach(function (s) {
    var subs = DB.getSubmissionsByStudent(s.id);
    subs.forEach(function (sub) {
      if (sub.status === "Under Review") pendingSubs.push({ sub: sub, student: s });
      if (sub.status === "Approved")     approvedCount++;
    });
  });

  /* Stat cards */
  function el(id) { return document.getElementById(id); }
  el("statStudents").textContent = students.length;
  el("statPending").textContent  = pendingSubs.length;
  el("statApproved").textContent = approvedCount;
  el("statMeetings").textContent = upcoming.length;

  /* Topbar */
  var sub = el("topbarSub");
  if (sub) sub.textContent = "Welcome back, " + user.name.split(" ")[0] + "!";

  /* Pending reviews list */
  var pendingEl = el("pendingReviewsList");
  if (pendingEl) {
    if (pendingSubs.length === 0) {
      pendingEl.innerHTML =
        '<div class="empty-state"><div class="es-icon">✅</div><p>No pending reviews. All caught up!</p></div>';
    } else {
      pendingEl.innerHTML = pendingSubs.map(function (item) {
        var ch = DB.getChapterById(item.sub.chapterId);
        return '<div class="pending-strip">' +
          "<div><strong>" + item.student.name + "</strong> submitted " +
          (ch ? ch.label + " – " + ch.title : item.sub.chapterId) +
          "<br><small>" + Utils.formatDateTime(item.sub.submittedAt) + "</small></div>" +
          '<a href="review.html" class="btn btn-outline btn-sm">Review →</a>' +
          "</div>";
      }).join("");
    }
  }

  /* Upcoming meetings */
  var meetEl = el("upcomingMeetingsList");
  if (meetEl) {
    if (upcoming.length === 0) {
      meetEl.innerHTML =
        '<div class="empty-state"><div class="es-icon">📅</div><p>No upcoming meetings.</p></div>';
    } else {
      meetEl.innerHTML = upcoming.slice(0, 2).map(function (m) {
        var d   = new Date(m.date);
        var day = d.getDate();
        var mon = d.toLocaleString("en-GB", { month: "short" }).toUpperCase();
        return '<div class="meeting-card">' +
          '<div class="meeting-date-box"><div class="mday">' + day + '</div><div class="mmon">' + mon + "</div></div>" +
          '<div class="meeting-info"><h4>' + m.title + "</h4>" +
          '<div class="meeting-meta"><span>🕐 ' + m.time + '</span><span>⏱ ' + m.duration + '</span><span>' + m.type + "</span></div>" +
          '<div class="meeting-meta"><span>📹 ' + m.platform + "</span></div>" +
          (m.link ? '<a href="' + m.link + '" target="_blank" class="btn btn-primary btn-sm">🔗 Join</a>' : "") +
          "</div></div>";
      }).join("");
    }
  }

  /* Quick student list */
  var stuEl = el("studentQuickList");
  if (stuEl) {
    stuEl.innerHTML = students.map(function (s) {
      var project = DB.getProjectByStudent(s.id);
      var pct     = project ? project.completionPercent : 0;
      var init    = Utils.initials(s.name);
      var color   = avatarColor(init);
      return '<div class="student-summary-card">' +
        '<div class="avatar" style="width:38px;height:38px;font-size:.85rem;background:' + color + ';">' + init + "</div>" +
        '<div class="stu-info">' +
        '<div class="stu-name">' + s.name + "</div>" +
        '<div class="stu-project">' + (project ? Utils.truncate(project.title, 60) : "No project") + "</div>" +
        '<div class="stu-progress">' +
        '<div class="progress-track" style="flex:1"><div class="progress-fill blue" style="width:' + pct + '%"></div></div>' +
        '<span class="stu-pct">' + pct + "%</span>" +
        "</div></div>" +
        (project ? badge(project.status) : "") +
        "</div>";
    }).join("");
  }
}

/* ══════════════════════════════════════
   STUDENTS PAGE
══════════════════════════════════════ */
function initStudents(user) {
  var students = DB.getStudentsBySupervisor(user.id);
  var grid     = document.getElementById("studentsGrid");
  if (!grid) return;

  if (students.length === 0) {
    grid.innerHTML =
      '<div class="empty-state"><div class="es-icon">🧑‍🎓</div><p>No students assigned yet.</p></div>';
    return;
  }

  grid.innerHTML = students.map(function (s) {
    var project  = DB.getProjectByStudent(s.id);
    var subs     = DB.getSubmissionsByStudent(s.id);
    var feedback = DB.getFeedbackByStudent(s.id);
    var pct      = project ? project.completionPercent : 0;
    var init     = Utils.initials(s.name);
    var color    = avatarColor(init);

    return '<div class="student-card">' +
      '<div class="student-card-header">' +
      '<div class="avatar" style="width:46px;height:46px;font-size:1rem;background:' + color + ';">' + init + "</div>" +
      '<div class="stu-details">' +
      '<div class="stu-name">' + s.name + "</div>" +
      '<div class="stu-meta">' + s.indexNumber + " &nbsp;·&nbsp; " + s.department + "</div>" +
      "</div>" +
      (project ? badge(project.status) : badge("Pending")) +
      "</div>" +
      '<div class="student-card-body">' +
      '<div class="project-title">' + (project ? project.title : "No project assigned") + "</div>" +
      '<div class="student-card-progress">' +
      '<div class="progress-header"><span>Progress</span><strong>' + pct + "%</strong></div>" +
      '<div class="progress-track"><div class="progress-fill blue" style="width:' + pct + '%"></div></div>' +
      "</div>" +
      '<div style="display:flex;gap:16px;font-size:var(--font-size-xs);color:var(--gray-600);">' +
      "<span>📤 " + subs.length + " submission" + (subs.length !== 1 ? "s" : "") + "</span>" +
      "<span>💬 " + feedback.length + " feedback</span>" +
      "</div></div>" +
      '<div class="student-card-actions">' +
      '<a href="review.html"   class="btn btn-outline btn-sm">📝 Review</a>' +
      '<a href="schedule.html" class="btn btn-outline btn-sm">📅 Meeting</a>' +
      '<a href="progress.html" class="btn btn-ghost   btn-sm">📊 Progress</a>' +
      "</div></div>";
  }).join("");
}

/* ══════════════════════════════════════
   REVIEW PAGE
══════════════════════════════════════ */
var activeSubmissionId = null;

function initReview(user) {
  var students = DB.getStudentsBySupervisor(user.id);

  /* Populate student filter */
  var filterStu = document.getElementById("filterStudent");
  if (filterStu) {
    students.forEach(function (s) {
      var opt = document.createElement("option");
      opt.value       = s.id;
      opt.textContent = s.name;
      filterStu.appendChild(opt);
    });
    filterStu.addEventListener("change", function () { renderReviewList(user, students); });
  }

  var filterStatus = document.getElementById("filterStatus");
  if (filterStatus) {
    filterStatus.addEventListener("change", function () { renderReviewList(user, students); });
  }

  renderReviewList(user, students);
  initFeedbackModal(user);
}

function renderReviewList(user, students) {
  var filterStu    = document.getElementById("filterStudent");
  var filterStatus = document.getElementById("filterStatus");
  var listEl       = document.getElementById("reviewList");
  if (!listEl) return;

  var stuFilter    = filterStu    ? filterStu.value    : "all";
  var statusFilter = filterStatus ? filterStatus.value : "all";

  /* Gather all submissions */
  var allItems = [];
  students.forEach(function (s) {
    if (stuFilter !== "all" && s.id !== stuFilter) return;
    var subs = DB.getSubmissionsByStudent(s.id);
    subs.forEach(function (sub) {
      if (statusFilter !== "all" && sub.status !== statusFilter) return;
      allItems.push({ sub: sub, student: s });
    });
  });

  if (allItems.length === 0) {
    listEl.innerHTML =
      '<div class="empty-state"><div class="es-icon">📝</div><p>No submissions match the selected filters.</p></div>';
    return;
  }

  listEl.innerHTML = allItems.map(function (item) {
    var sub  = item.sub;
    var s    = item.student;
    var ch   = DB.getChapterById(sub.chapterId);
    var init = Utils.initials(s.name);

    return '<div class="review-card">' +
      '<div class="review-card-header">' +
      '<div class="avatar" style="width:38px;height:38px;font-size:.85rem;background:' + avatarColor(init) + ';">' + init + "</div>" +
      '<div class="rc-info">' +
      '<div class="rc-title">' + s.name + " — " + (ch ? ch.label + ": " + ch.title : sub.chapterId) + "</div>" +
      '<div class="rc-meta">Submitted: ' + Utils.formatDateTime(sub.submittedAt) +
      " &nbsp;·&nbsp; Version: v" + sub.version + " &nbsp;·&nbsp; " + sub.fileSize + "</div>" +
      "</div>" +
      badge(sub.status) +
      "</div>" +
      '<div class="review-card-body">' +
      '<div class="file-row">' +
      '<div class="file-info">📄 ' + sub.fileName + "</div>" +
      '<button class="btn btn-outline btn-sm">⬇ Download</button>' +
      "</div>" +
      '<div class="feedback-actions">' +
      '<button class="btn btn-primary btn-sm" data-sub-id="' + sub.id + '" data-action="feedback">💬 Give Feedback</button>' +
      '<button class="btn btn-success btn-sm" data-sub-id="' + sub.id + '" data-action="approve">✅ Approve</button>' +
      '<button class="btn btn-danger  btn-sm" data-sub-id="' + sub.id + '" data-action="revision">✏️ Request Revision</button>' +
      "</div></div></div>";
  }).join("");

  /* Wire action buttons */
  listEl.querySelectorAll("button[data-action]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var action = btn.dataset.action;
      var subId  = btn.dataset.subId;
      activeSubmissionId = subId;

      if (action === "feedback") {
        var sub  = DB_SUBMISSIONS.find(function (s) { return s.id === subId; });
        var ch   = sub ? DB.getChapterById(sub.chapterId) : null;
        var stuId = sub ? sub.studentId : "";
        var stu  = DB.getUserById(stuId);
        var info = document.getElementById("feedbackModalInfo");
        if (info) {
          info.innerHTML =
            '<p style="font-size:var(--font-size-sm);color:var(--gray-700);margin-bottom:var(--space-md);' +
            'padding:10px 14px;background:var(--gray-50);border-radius:var(--radius);">' +
            "Student: <strong>" + (stu ? stu.name : "–") + "</strong> &nbsp;·&nbsp; " +
            (ch ? ch.label + " – " + ch.title : subId) + "</p>";
        }
        openModal("feedbackModal");
      } else if (action === "approve") {
        handleQuickDecision(subId, "Approved", user);
      } else if (action === "revision") {
        handleQuickDecision(subId, "Needs Revision", user);
      }
    });
  });
}

function handleQuickDecision(subId, decision, user) {
  var sub = DB_SUBMISSIONS.find(function (s) { return s.id === subId; });
  if (sub) sub.status = decision;
  showToast(
    "Submission marked as \"" + decision + "\". Student has been notified.",
    decision === "Approved" ? "success" : "warning",
    4000
  );
  var students = DB.getStudentsBySupervisor(user.id);
  renderReviewList(user, students);
  updateReviewBadge(user.id);
}

function initFeedbackModal(user) {
  var closeBtn  = document.getElementById("closeFeedbackModal");
  var cancelBtn = document.getElementById("cancelFeedbackBtn");
  var submitBtn = document.getElementById("submitFeedbackBtn");

  if (closeBtn)  closeBtn.addEventListener("click",  function () { closeModal("feedbackModal"); });
  if (cancelBtn) cancelBtn.addEventListener("click", function () { closeModal("feedbackModal"); });

  if (submitBtn) {
    submitBtn.addEventListener("click", function () {
      var comment  = document.getElementById("feedbackComment").value.trim();
      var decision = document.getElementById("feedbackDecision").value;

      if (!comment) {
        showToast("Please enter your feedback comments.", "warning");
        return;
      }

      /* Update submission status in mock DB */
      if (activeSubmissionId) {
        var sub = DB_SUBMISSIONS.find(function (s) { return s.id === activeSubmissionId; });
        if (sub) sub.status = decision;
      }

      closeModal("feedbackModal");
      showToast("Feedback submitted successfully! Student has been notified.", "success", 4000);
      document.getElementById("feedbackComment").value = "";
      document.getElementById("feedbackDecision").value = "Approved";
      activeSubmissionId = null;

      var students = DB.getStudentsBySupervisor(user.id);
      renderReviewList(user, students);
      updateReviewBadge(user.id);
    });
  }
}

/* ══════════════════════════════════════
   PROGRESS MONITOR PAGE
══════════════════════════════════════ */
function initProgress(user) {
  var students = DB.getStudentsBySupervisor(user.id);
  var listEl   = document.getElementById("progressMonitorList");
  if (!listEl) return;

  if (students.length === 0) {
    listEl.innerHTML =
      '<div class="empty-state"><div class="es-icon">📊</div><p>No students assigned.</p></div>';
    return;
  }

  listEl.innerHTML = students.map(function (s) {
    var project = DB.getProjectByStudent(s.id);
    var subs    = DB.getSubmissionsByStudent(s.id);
    var pct     = project ? project.completionPercent : 0;
    var init    = Utils.initials(s.name);

    /* Chapter status map */
    var chapterMap = {};
    subs.forEach(function (sub) { chapterMap[sub.chapterId] = sub.status; });

    var chapterDots = DB_CHAPTERS.map(function (ch) {
      var status = chapterMap[ch.id] || "Pending";
      var cls    = status === "Approved"       ? "approved"
                 : status === "Under Review"   ? "review"
                 : status === "Needs Revision" ? "revision"
                 : "pending";
      var icon   = status === "Approved"       ? "✅"
                 : status === "Under Review"   ? "👁️"
                 : status === "Needs Revision" ? "✏️"
                 : "⏳";
      return '<div class="monitor-chapter ' + cls + '">' +
        '<div class="mc-label">' + ch.label.replace("Chapter ", "Ch.") + "</div>" +
        "<div>" + icon + "</div>" +
        "</div>";
    }).join("");

    return '<div class="monitor-card">' +
      '<div class="monitor-card-header">' +
      '<div class="avatar" style="width:42px;height:42px;font-size:.9rem;background:' + avatarColor(init) + ';">' + init + "</div>" +
      '<div class="mc-info">' +
      '<div class="mc-name">' + s.name + " &nbsp; " + badge(project ? project.status : "Pending") + "</div>" +
      '<div class="mc-project">' + (project ? Utils.truncate(project.title, 70) : "No project") + "</div>" +
      "</div></div>" +
      '<div class="progress-track" style="margin-bottom:var(--space-sm);">' +
      '<div class="progress-fill blue" style="width:' + pct + '%;"></div></div>' +
      '<div style="font-size:var(--font-size-xs);color:var(--gray-600);margin-bottom:var(--space-sm);">' +
      pct + "% complete &nbsp;·&nbsp; " +
      (project ? "Deadline: " + Utils.shortDate(project.deadline) : "") +
      "</div>" +
      '<div class="monitor-chapters">' + chapterDots + "</div>" +
      "</div>";
  }).join("");
}

/* ══════════════════════════════════════
   SCHEDULE PAGE
══════════════════════════════════════ */
function initSchedule(user) {
  var meetings = DB.getMeetingsByUser(user.id);
  var upcoming = meetings.filter(function (m) { return m.status === "Upcoming"; });
  var past     = meetings.filter(function (m) { return m.status === "Completed"; });

  renderSupMeetings("supUpcomingMeetings", upcoming, false);
  renderSupMeetings("supPastMeetings",     past,     true);

  /* Populate student dropdown */
  var stuSelect = document.getElementById("mtgStudents");
  if (stuSelect) {
    var students = DB.getStudentsBySupervisor(user.id);
    students.forEach(function (s) {
      var opt = document.createElement("option");
      opt.value       = s.id;
      opt.textContent = s.name;
      stuSelect.appendChild(opt);
    });
  }

  /* Modal controls */
  var newBtn     = document.getElementById("newMeetingBtn");
  var closeBtn   = document.getElementById("closeScheduleModal");
  var cancelBtn  = document.getElementById("cancelScheduleBtn");
  var submitBtn  = document.getElementById("submitScheduleBtn");

  if (newBtn)    newBtn.addEventListener("click",    function () { openModal("scheduleMeetingModal"); });
  if (closeBtn)  closeBtn.addEventListener("click",  function () { closeModal("scheduleMeetingModal"); });
  if (cancelBtn) cancelBtn.addEventListener("click", function () { closeModal("scheduleMeetingModal"); });

  if (submitBtn) {
    submitBtn.addEventListener("click", function () {
      var title    = document.getElementById("mtgTitle").value.trim();
      var student  = document.getElementById("mtgStudents").value;
      var date     = document.getElementById("mtgDate").value;
      var time     = document.getElementById("mtgTime").value;
      var platform = document.getElementById("mtgPlatform").value;

      if (!title || !student || !date || !time) {
        showToast("Please fill in all required fields.", "warning");
        return;
      }

      closeModal("scheduleMeetingModal");
      showToast(
        "Meeting \"" + title + "\" scheduled for " + Utils.shortDate(date) +
        " at " + time + " via " + platform + ". Student notified.",
        "success",
        4500
      );
      document.getElementById("scheduleMeetingForm").reset();
    });
  }
}

function renderSupMeetings(containerId, meetings, isPast) {
  var el = document.getElementById(containerId);
  if (!el) return;

  if (meetings.length === 0) {
    el.innerHTML =
      '<div class="empty-state"><div class="es-icon">' + (isPast ? "🕘" : "📅") + '</div>' +
      "<p>" + (isPast ? "No past meetings." : "No upcoming meetings.") + "</p></div>";
    return;
  }

  el.innerHTML = meetings.map(function (m) {
    var d   = new Date(m.date);
    var day = d.getDate();
    var mon = d.toLocaleString("en-GB", { month: "short" }).toUpperCase();

    /* Participant names */
    var participantNames = m.participants.map(function (pid) {
      var u = DB.getUserById(pid);
      return u ? u.name : pid;
    }).join(", ");

    var actionBtn = (!isPast && m.link)
      ? '<a href="' + m.link + '" target="_blank" class="btn btn-primary btn-sm">🔗 Join ' + m.platform + "</a>"
      : isPast
        ? badge("Completed")
        : '<span class="badge badge-secondary">📍 In-Person</span>';

    return '<div class="meeting-card' + (isPast ? " past-meeting-card" : "") + '">' +
      '<div class="meeting-date-box"><div class="mday">' + day + '</div><div class="mmon">' + mon + "</div></div>" +
      '<div class="meeting-info">' +
      "<h4>" + m.title + "</h4>" +
      '<div class="meeting-meta"><span>🕐 ' + m.time + '</span><span>⏱ ' + m.duration + "</span></div>" +
      '<div class="meeting-meta"><span>🧑‍🎓 ' + participantNames + "</span></div>" +
      '<div class="meeting-meta"><span>📹 ' + m.platform + "</span></div>" +
      actionBtn +
      "</div></div>";
  }).join("");
}

/* ══════════════════════════════════════
   NOTIFICATIONS PAGE
══════════════════════════════════════ */
function initNotifications(user) {
  var notifs  = DB.getNotificationsByUser(user.id);
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
      return '<div class="notif-item ' + (n.read ? "" : "unread") + '" data-idx="' + idx + '">' +
        '<span class="notif-icon">' + Utils.notifIcon(n.type) + "</span>" +
        "<div>" +
        '<div class="notif-msg">' + n.message + "</div>" +
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
  if (idEl)   idEl.textContent   = user.staffId || "–";

  var fields = {
    profileFullName: user.name,
    profileEmail:    user.email,
    profileStaffId:  user.staffId   || "",
    profileDept:     user.department || "",
    profileSpec:     user.specialization || "",
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
  var user = initApp("supervisor");
  if (!user) return;

  updateReviewBadge(user.id);

  var page = currentPage();
  if      (page === "dashboard.html")     initDashboard(user);
  else if (page === "students.html")      initStudents(user);
  else if (page === "review.html")        initReview(user);
  else if (page === "progress.html")      initProgress(user);
  else if (page === "schedule.html")      initSchedule(user);
  else if (page === "notifications.html") initNotifications(user);
  else if (page === "profile.html")       initProfile(user);
});