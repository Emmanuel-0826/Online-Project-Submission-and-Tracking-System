/* ============================================================
   js/app.js — Shared App Bootstrap
   Handles: session guard, sidebar population, logout,
            notification badges, nav link wiring, toast
============================================================ */

"use strict";

/* ══════════════════════════════════════
   SESSION GUARD
   Call on every protected page to ensure
   the user is logged in with the right role.
══════════════════════════════════════ */
function requireAuth(expectedRole) {
  var user = Utils.getSession();

  if (!user) {
    window.location.href = "../../index.html";
    return null;
  }

  if (expectedRole && user.role !== expectedRole) {
    window.location.href = "../../index.html";
    return null;
  }

  return user;
}

/* ══════════════════════════════════════
   AVATAR COLOUR HELPER
══════════════════════════════════════ */
function avatarColor(initials) {
  var palette = [
    "#1a73e8", "#34a853", "#ea4335", "#fbbc04",
    "#0d47a1", "#00897b", "#e65100", "#6a1b9a"
  ];
  return palette[initials.charCodeAt(0) % palette.length];
}

/* ══════════════════════════════════════
   POPULATE SIDEBAR USER STRIP
══════════════════════════════════════ */
function populateSidebar(user) {
  var avatarEl   = document.getElementById("sideAvatar");
  var nameEl     = document.getElementById("sideUserName");
  var metaEl     = document.getElementById("sideUserMeta");

  if (!avatarEl || !nameEl || !metaEl) return;

  var initials = Utils.initials(user.name);
  avatarEl.textContent      = initials;
  avatarEl.style.background = avatarColor(initials);
  avatarEl.style.width      = "36px";
  avatarEl.style.height     = "36px";
  avatarEl.style.fontSize   = "0.85rem";

  nameEl.textContent = user.name;
  metaEl.textContent = Utils.titleCase(user.role) +
    (user.department ? " · " + user.department.split(" ")[0] : "");
}

/* ══════════════════════════════════════
   NOTIFICATION BADGES
══════════════════════════════════════ */
function updateNotifBadges(userId) {
  var count   = DB.getUnreadCount(userId);
  var badge   = document.getElementById("ntfBadge");
  var dot     = document.getElementById("ntfDot");

  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  if (dot) {
    if (count > 0) {
      dot.classList.remove("hidden");
    } else {
      dot.classList.add("hidden");
    }
  }
}

/* ══════════════════════════════════════
   SIDEBAR NAV LINKS
   Navigates to sibling page files.
══════════════════════════════════════ */
function initNavLinks() {
  var items = document.querySelectorAll(".nav-item[data-page]");

  items.forEach(function (item) {
    item.addEventListener("click", function () {
      var page = item.dataset.page;
      if (page) {
        window.location.href = page;
      }
    });
  });
}

/* ══════════════════════════════════════
   TOPBAR QUICK BUTTONS
══════════════════════════════════════ */
function initTopbarButtons() {
  var notifBtn   = document.getElementById("notifBtn");
  var profileBtn = document.getElementById("profileBtn");

  if (notifBtn) {
    notifBtn.addEventListener("click", function () {
      window.location.href = "notifications.html";
    });
  }

  if (profileBtn) {
    profileBtn.addEventListener("click", function () {
      window.location.href = "profile.html";
    });
  }
}

/* ══════════════════════════════════════
   LOGOUT
══════════════════════════════════════ */
function initLogout() {
  var btn = document.getElementById("logoutBtn");
  if (!btn) return;

  btn.addEventListener("click", function () {
    if (window.confirm("Are you sure you want to sign out?")) {
      Utils.logout();
    }
  });
}

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
function showToast(message, type, duration) {
  type     = type     || "info";
  duration = duration || 3500;

  var container = document.getElementById("toast-container");
  if (!container) return;

  var toast = document.createElement("div");
  toast.className = "toast toast-" + type;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(function () {
    toast.style.opacity = "0";
  }, duration);

  setTimeout(function () {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, duration + 350);
}

/* ══════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════ */
function openModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add("open");
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove("open");
}

function initModalBackdrops() {
  var overlays = document.querySelectorAll(".modal-overlay");
  overlays.forEach(function (overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        overlay.classList.remove("open");
      }
    });
  });
}

/* ══════════════════════════════════════
   SHARED APP INIT
   Called by every portal page's own JS
   after role-specific setup.
══════════════════════════════════════ */
function initApp(expectedRole) {
  var user = requireAuth(expectedRole);
  if (!user) return null;

  populateSidebar(user);
  updateNotifBadges(user.id);
  initNavLinks();
  initTopbarButtons();
  initLogout();
  initModalBackdrops();
  NotificationSystem.init(user.id);   // ADD THIS LINE

  return user;
}