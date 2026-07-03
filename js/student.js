/* ============================================================
   js/student.js — Student Portal Logic
   Handles: dashboard, submissions, feedback,
            progress, meetings, notifications, profile
============================================================ */

"use strict";

/* ══════════════════════════════════════
   AVATAR COLOUR (local helper)
══════════════════════════════════════ */
function getAvatarColor(initials) {
  var palette = [
    "#1a73e8", "#34a853", "#ea4335", "#fbbc04",
    "#0d47a1", "#00897b", "#e65100", "#6a1b9a"
  ];
  return palette[initials.charCodeAt(0) % palette.length];
}

/* ══════════════════════════════════════
   BADGE HTML HELPER
══════════════════════════════════════ */
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

/* ══════════════════════════════════════
   DETECT CURRENT PAGE
══════════════════════════════════════ */
function currentPage() {
  var parts = window.location.pathname.split("/");
  return parts[parts.length - 1];
}

/* ══════════════════════════════════════
   DASHBOARD PAGE
══════════════════════════════════════ */
function initDashboard(user) {
  var project    = DB.getProjectByStudent(user.id);
  var supervisor = DB.getUserById(user.supervisorId);
  var subs       = DB.getSubmissionsByStudent(user.id);
  var feedback   = DB.getFeedbackByStudent(user.id);
  var meetings   = DB.getMeetingsByUser(user.id);

  /* Stat cards */
  var el = function (id) { return document.getElementById(id); };

  el("statCompletion").textContent  = project ? project.completionPercent + "%" : "–";
  el("statSubmissions").textContent = subs.length;
  el("statFeedback").textContent    = feedback.length;

  if (project) {
    var days = Utils.daysUntil(project.deadline);
    el("statDays").textContent = days >= 0 ? days : "Overdue";
  }

  /* Project card */
  if (project) {
    el("projectTitle").textContent = project.title;
    el("projectDesc").textContent  = project.topic;
    el("projectStatusBadge").innerHTML = badge(project.status);
    el("topicStatusBadge").innerHTML   = badge(project.topicStatus);
    el("progressPct").textContent      = project.completionPercent + "%";
    el("progressBar").style.width      = project.completionPercent + "%";
    el("projectMeta").innerHTML =
      "<span>📅 Started: " + Utils.shortDate(project.startDate) + "</span>" +
      "<span>⏰ Due: "     + Utils.shortDate(project.deadline)   + "</span>";
  }

  /* Supervisor card */
  if (supervisor) {
    var supInit = Utils.initials(supervisor.name);
    var supAv   = el("supAvatar");
    supAv.textContent      = supInit;
    supAv.style.background = getAvatarColor(supInit);

    el("supName").textContent  = supervisor.name;
    el("supSpec").textContent  = "📚 " + (supervisor.specialization || "–");
    el("supDept").textContent  = "🏛 " + supervisor.department;
    el("supEmail").textContent = "✉️ " + supervisor.email;
  }

  /* Recent submissions table */
  var tbody = el("recentSubmissionsTable");
  if (tbody) {
    var recent = subs.slice(-3).reverse();
    if (recent.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No submissions yet.</td></tr>';
    } else {
      tbody.innerHTML = recent.map(function (s) {
        var ch = DB.getChapterById(s.chapterId);
        return "<tr>" +
          "<td>" + (ch ? ch.label + " – " + ch.title : s.chapterId) + "</td>" +
          "<td>v" + s.version + "</td>" +
          "<td>" + badge(s.status) + "</td>" +
          "</tr>";
      }).join("");
    }
  }

  /* Upcoming meetings */
  var meetList = el("upcomingMeetingsList");
  if (meetList) {
    var upcoming = meetings.filter(function (m) { return m.status === "Upcoming"; });
    if (upcoming.length === 0) {
      meetList.innerHTML = '<div class="empty-state"><div class="es-icon">📅</div><p>No upcoming meetings.</p></div>';
    } else {
      meetList.innerHTML = upcoming.slice(0, 2).map(function (m) {
        var d   = new Date(m.date);
        var day = d.getDate();
        var mon = d.toLocaleString("en-GB", { month: "short" }).toUpperCase();
        var joinBtn = m.link
          ? '<a href="' + m.link + '" target="_blank" class="btn btn-primary btn-sm">🔗 Join</a>'
          : '<span class="badge badge-secondary">📍 In-Person</span>';
        return '<div class="meeting-card">' +
          '<div class="meeting-date-box"><div class="mday">' + day + '</div><div class="mmon">' + mon + '</div></div>' +
          '<div class="meeting-info">' +
          '<h4>' + m.title + '</h4>' +
          '<div class="meeting-meta"><span>🕐 ' + m.time + '</span><span>⏱ ' + m.duration + '</span><span>' + m.type + '</span></div>' +
          '<div class="meeting-meta"><span>📹 ' + m.platform + '</span></div>' +
          joinBtn +
          '</div></div>';
      }).join("");
    }
  }

  /* Topbar subtitle */
  var sub = document.getElementById("topbarSub");
  if (sub) sub.textContent = "Welcome back, " + user.name.split(" ")[0] + "!";
}

/* ══════════════════════════════════════
   SUBMISSIONS PAGE
══════════════════════════════════════ */
function initSubmissions(user) {
  var project = DB.getProjectByStudent(user.id);
  var subs    = DB.getSubmissionsByStudent(user.id);

  /* Chapter status list */
  var statusList = document.getElementById("chapterStatusList");
  if (statusList) {
    statusList.innerHTML = DB_CHAPTERS.map(function (ch) {
      var chSubs   = subs.filter(function (s) { return s.chapterId === ch.id; });
      var latest   = chSubs.length > 0 ? chSubs[chSubs.length - 1] : null;
      var statusHtml = latest ? badge(latest.status) : badge("Pending");
      var versions   = chSubs.length > 0
        ? chSubs.length + " version" + (chSubs.length > 1 ? "s" : "")
        : "Not submitted";
      return '<div class="chapter-status-item">' +
        '<span class="ch-name">' + ch.label + " – " + ch.title + "</span>" +
        '<span class="ch-versions">' + versions + "</span>" +
        statusHtml +
        "</div>";
    }).join("");
  }

  /* Submission history table */
  var tbody = document.getElementById("submissionHistoryTable");
  if (tbody) {
    if (subs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No submissions yet.</td></tr>';
    } else {
      tbody.innerHTML = subs.map(function (s) {
        var ch = DB.getChapterById(s.chapterId);
        return "<tr>" +
          "<td>" + (ch ? ch.label : s.chapterId) + "</td>" +
          '<td><div class="file-name"><span class="file-icon">📄</span>' + s.fileName + "</div></td>" +
          "<td>v" + s.version + "</td>" +
          "<td>" + Utils.formatDateTime(s.submittedAt) + "</td>" +
          "<td>" + s.fileSize + "</td>" +
          "<td>" + badge(s.status) + "</td>" +
          '<td><button class="btn btn-outline btn-sm">⬇ Download</button></td>' +
          "</tr>";
      }).join("");
    }
  }

  /* Upload zone */
  initUploadZone(user, project);
}

function initUploadZone(user, project) {
  var zone      = document.getElementById("uploadZone");
  var fileInput = document.getElementById("fileInput");
  var display   = document.getElementById("fileNameDisplay");
  var form      = document.getElementById("uploadForm");
  var selectedFile = null;

  if (!zone || !fileInput || !form) return;

  zone.addEventListener("click", function () { fileInput.click(); });

  zone.addEventListener("dragover", function (e) {
    e.preventDefault();
    zone.classList.add("drag-over");
  });

  zone.addEventListener("dragleave", function () {
    zone.classList.remove("drag-over");
  });

  zone.addEventListener("drop", function (e) {
    e.preventDefault();
    zone.classList.remove("drag-over");
    var file = e.dataTransfer.files[0];
    if (file) {
      selectedFile = file;
      display.textContent = "📎 " + file.name;
    }
  });

  fileInput.addEventListener("change", function () {
    if (fileInput.files[0]) {
      selectedFile = fileInput.files[0];
      display.textContent = "📎 " + selectedFile.name;
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var chapter = document.getElementById("chapterSelect").value;

    if (!chapter) {
      showToast("Please select a chapter first.", "warning");
      return;
    }
    if (!selectedFile) {
      showToast("Please attach a file before submitting.", "warning");
      return;
    }

    showToast(
      "\"" + selectedFile.name + "\" submitted successfully! Your supervisor will be notified.",
      "success",
      4000
    );

    form.reset();
    display.textContent = "";
    selectedFile = null;
  });
}

/* ══════════════════════════════════════
   FEEDBACK PAGE
══════════════════════════════════════ */
function initFeedback(user) {
  var feedbackList = document.getElementById("feedbackList");
  if (!feedbackList) return;

  var items = DB.getFeedbackByStudent(user.id);

  if (items.length === 0) {
    feedbackList.innerHTML =
      '<div class="feedback-empty"><div class="fe-icon">💬</div>' +
      "<p>No feedback received yet. Submit a chapter to get started.</p></div>";
    return;
  }

  feedbackList.innerHTML = items.map(function (fb) {
    var sup    = DB.getUserById(fb.supervisorId);
    var supName = sup ? sup.name : "Supervisor";
    var init   = Utils.initials(supName);
    var color  = getAvatarColor(init);

    return '<div class="feedback-card">' +
      '<div class="feedback-card-head">' +
      '<div class="avatar" style="width:38px;height:38px;font-size:.85rem;background:' + color + '">' + init + '</div>' +
      '<div class="fh-info">' +
      '<div class="fh-name">' + supName + "</div>" +
      '<div class="fh-meta">' + fb.chapterLabel + " &nbsp;·&nbsp; " + Utils.formatDate(fb.date) + "</div>" +
      "</div>" +
      badge(fb.rating) +
      "</div>" +
      '<div class="feedback-card-body">' + fb.comment + "</div>" +
      "</div>";
  }).join("");
}

/* ══════════════════════════════════════
   PROGRESS PAGE
══════════════════════════════════════ */
function initProgress(user) {
  var project    = DB.getProjectByStudent(user.id);
  var milestones = project ? DB.getMilestonesByProject(project.id) : [];

  /* Completion percentage */
  var pctEl = document.getElementById("completionPercent");
  if (pctEl) pctEl.textContent = project ? project.completionPercent + "%" : "–";

  /* Chapter progress bars */
  var listEl = document.getElementById("chapterProgressList");
  if (listEl && project) {
    var chapterPcts = [100, 100, 60, 0, 0]; /* mock per-chapter progress */
    listEl.innerHTML = DB_CHAPTERS.map(function (ch, i) {
      var pct   = chapterPcts[i] || 0;
      var color = pct === 100 ? "green" : pct > 0 ? "blue" : "gray";
      return '<div class="chapter-progress-item">' +
        '<div class="chapter-progress-header">' +
        '<span class="ch-title">' + ch.label + " – " + ch.title + "</span>" +
        '<span class="ch-pct" style="color:' + (pct === 100 ? "var(--secondary)" : pct > 0 ? "var(--primary)" : "var(--gray-400)") + '">' + pct + "%</span>" +
        "</div>" +
        '<div class="progress-track">' +
        '<div class="progress-fill ' + color + '" style="width:' + pct + '%"></div>' +
        "</div></div>";
    }).join("");
  }

  /* Deadline info */
  var dlEl = document.getElementById("deadlineInfo");
  if (dlEl && project) {
    var days = Utils.daysUntil(project.deadline);
    dlEl.innerHTML =
      '<div class="deadline-row"><span>⏰ Deadline</span><strong>' + Utils.formatDate(project.deadline) + "</strong></div>" +
      '<div class="deadline-row"><span>📅 Days Remaining</span><strong>' +
      (days >= 0 ? days + " days" : "Overdue") + "</strong></div>";
  }

  /* Milestone timeline */
  var tlEl = document.getElementById("milestoneTimeline");
  if (tlEl) {
    if (milestones.length === 0) {
      tlEl.innerHTML = '<p class="text-muted text-sm">No milestones found.</p>';
    } else {
      tlEl.innerHTML = milestones.map(function (ms) {
        var dotClass = ms.status === "Completed" ? "done"
          : ms.status === "In Progress" ? "active" : "pending";
        return '<div class="tl-item">' +
          '<div class="tl-dot ' + dotClass + '"></div>' +
          '<div class="tl-label">' + ms.label + "</div>" +
          '<div class="tl-date">📅 ' + Utils.shortDate(ms.dueDate) +
          " &nbsp;·&nbsp; " + badge(ms.status) + "</div>" +
          "</div>";
      }).join("");
    }
  }
}

/* ══════════════════════════════════════
   MEETINGS PAGE
══════════════════════════════════════ */
function initMeetings(user) {
  var meetings = DB.getMeetingsByUser(user.id);
  var upcoming = meetings.filter(function (m) { return m.status === "Upcoming"; });
  var past     = meetings.filter(function (m) { return m.status === "Completed"; });

  renderMeetingList("upcomingMeetingsList", upcoming, false);
  renderMeetingList("pastMeetingsList",     past,     true);

  /* Request meeting button */
  var reqBtn    = document.getElementById("requestMeetingBtn");
  var closeBtn  = document.getElementById("closeMeetingModal");
  var cancelBtn = document.getElementById("cancelMeetingBtn");
  var submitBtn = document.getElementById("submitMeetingBtn");

  if (reqBtn)    reqBtn.addEventListener("click",    function () { openModal("meetingModal"); });
  if (closeBtn)  closeBtn.addEventListener("click",  function () { closeModal("meetingModal"); });
  if (cancelBtn) cancelBtn.addEventListener("click", function () { closeModal("meetingModal"); });

  if (submitBtn) {
    submitBtn.addEventListener("click", function () {
      var topic    = document.getElementById("mtgTopic").value.trim();
      var date     = document.getElementById("mtgDate").value;
      var time     = document.getElementById("mtgTime").value;
      var platform = document.getElementById("mtgPlatform").value;

      if (!topic || !date || !time) {
        showToast("Please fill in all required fields.", "warning");
        return;
      }

      closeModal("meetingModal");
      showToast(
        "Meeting request sent to your supervisor for " + Utils.shortDate(date) + " at " + time + " via " + platform + ".",
        "success",
        4500
      );

      document.getElementById("meetingRequestForm").reset();
    });
  }
}

function renderMeetingList(containerId, meetings, isPast) {
  var el = document.getElementById(containerId);
  if (!el) return;

  if (meetings.length === 0) {
    el.innerHTML =
      '<div class="empty-state"><div class="es-icon">' + (isPast ? "🕘" : "📅") + '</div>' +
      "<p>" + (isPast ? "No past meetings." : "No upcoming meetings.") + "</p></div>";
    return;
  }

  el.innerHTML = meetings.map(function (m) {
    var d      = new Date(m.date);
    var day    = d.getDate();
    var mon    = d.toLocaleString("en-GB", { month: "short" }).toUpperCase();
    var joinBtn = (!isPast && m.link)
      ? '<a href="' + m.link + '" target="_blank" class="btn btn-primary btn-sm">🔗 Join ' + m.platform + "</a>"
      : isPast
        ? badge("Completed")
        : '<span class="badge badge-secondary">📍 In-Person</span>';

    return '<div class="meeting-card' + (isPast ? " past-meeting-card" : "") + '">' +
      '<div class="meeting-date-box"><div class="mday">' + day + '</div><div class="mmon">' + mon + '</div></div>' +
      '<div class="meeting-info">' +
      '<h4>' + m.title + "</h4>" +
      '<div class="meeting-meta"><span>🕐 ' + m.time + '</span><span>⏱ ' + m.duration + '</span><span>' + m.type + '</span></div>' +
      '<div class="meeting-meta"><span>📹 ' + m.platform + '</span></div>' +
      (m.notes ? '<div class="meeting-meta"><span>📝 ' + m.notes + "</span></div>" : "") +
      joinBtn +
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

  function renderNotifs() {
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

    /* Click to mark read */
    listEl.querySelectorAll(".notif-item").forEach(function (item) {
      item.addEventListener("click", function () {
        var idx = parseInt(item.dataset.idx, 10);
        notifs[idx].read = true;
        item.classList.remove("unread");
        updateNotifBadges(user.id);
      });
    });
  }

  renderNotifs();

  if (markBtn) {
    markBtn.addEventListener("click", function () {
      notifs.forEach(function (n) { n.read = true; });
      renderNotifs();
      updateNotifBadges(user.id);
      showToast("All notifications marked as read.", "success");
    });
  }
}

/* ══════════════════════════════════════
   PROFILE PAGE
══════════════════════════════════════ */
function initProfile(user) {
  /* Avatar */
  var avEl = document.getElementById("profileAvatar");
  if (avEl) {
    var init = Utils.initials(user.name);
    avEl.textContent      = init;
    avEl.style.background = getAvatarColor(init);
  }

  var nameEl = document.getElementById("profileName");
  var idEl   = document.getElementById("profileId");
  if (nameEl) nameEl.textContent = user.name;
  if (idEl)   idEl.textContent   = user.indexNumber || user.staffId || "–";

  /* Pre-fill form */
  var fields = {
    profileFullName:  user.name,
    profileEmail:     user.email,
    profileIndex:     user.indexNumber || user.staffId || "",
    profileDept:      user.department  || "",
    profileLevel:     user.level       || "",
  };

  Object.keys(fields).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = fields[id];
  });

  /* Save profile */
  var saveBtn = document.getElementById("saveProfileBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      showToast("Profile updated successfully!", "success");
    });
  }

  /* Change password */
  var pwBtn = document.getElementById("changePasswordBtn");
  if (pwBtn) {
    pwBtn.addEventListener("click", function () {
      var curr = document.getElementById("currentPassword").value;
      var newP = document.getElementById("newPassword").value;
      var conf = document.getElementById("confirmPassword").value;

      if (!curr || !newP || !conf) {
        showToast("Please fill in all password fields.", "warning");
        return;
      }
      if (newP.length < 6) {
        showToast("New password must be at least 6 characters.", "warning");
        return;
      }
      if (newP !== conf) {
        showToast("New passwords do not match.", "warning");
        return;
      }
      showToast("Password changed successfully!", "success");
      document.getElementById("currentPassword").value = "";
      document.getElementById("newPassword").value     = "";
      document.getElementById("confirmPassword").value = "";
    });
  }
}

/* ══════════════════════════════════════
   ROUTE TO CORRECT PAGE INIT
══════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", function () {
  var user = initApp("student");
  if (!user) return;

  var page = currentPage();

  if (page === "dashboard.html")     initDashboard(user);
  else if (page === "submissions.html") initSubmissions(user);
  else if (page === "feedback.html")    initFeedback(user);
  else if (page === "progress.html")    initProgress(user);
  else if (page === "meetings.html")    initMeetings(user);
  else if (page === "notifications.html") initNotifications(user);
  else if (page === "profile.html")     initProfile(user);
});