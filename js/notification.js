/* ============================================================
   js/notifications.js — Shared Real-Time Notification System
   OPSTS – Online Project Supervision & Tracking System

   Provides:
   - NotificationSystem singleton
   - Polling-based new notification detection
   - In-page notification bell dropdown
   - Toast alerts for new notifications
   - Badge count sync across all portals
   - Notification creation helpers (for student/supervisor/admin actions)
============================================================ */

"use strict";

var NotificationSystem = (function () {

  /* ── Private state ── */
  var _userId       = null;
  var _pollInterval = null;
  var _lastCount    = 0;
  var _dropdownOpen = false;
  var _POLL_MS      = 15000;   /* Poll every 15 seconds (simulated) */

  /* ── Notification type config ── */
  var TYPE_CONFIG = {
    submission: { icon: "📤", color: "var(--primary-light)",   label: "Submission" },
    feedback:   { icon: "💬", color: "var(--secondary-light)", label: "Feedback"   },
    meeting:    { icon: "📅", color: "var(--warning-light)",   label: "Meeting"    },
    deadline:   { icon: "⏰", color: "var(--danger-light)",    label: "Deadline"   },
    approval:   { icon: "✅", color: "var(--secondary-light)", label: "Approval"   },
    system:     { icon: "🔔", color: "var(--gray-100)",        label: "System"     },
  };

  /* ══════════════════════════════════════
     PUBLIC: init
     Call once per page after session load.
  ══════════════════════════════════════ */
  function init(userId) {
    if (!userId) return;
    _userId    = userId;
    _lastCount = DB.getUnreadCount(userId);

    _buildDropdown();
    _updateAllBadges();
    _startPolling();

    /* Close dropdown on outside click */
    document.addEventListener("click", function (e) {
      var dropdown = document.getElementById("ntf-dropdown");
      var bell     = document.getElementById("ntf-bell-btn");
      if (dropdown && bell &&
          !dropdown.contains(e.target) &&
          !bell.contains(e.target)) {
        _closeDropdown();
      }
    });
  }

  /* ══════════════════════════════════════
     PUBLIC: create
     Add a new notification for a user.
     Called by student/supervisor/admin actions.
  ══════════════════════════════════════ */
  function create(targetUserId, type, message) {
    var notif = {
      id:      Utils.uid("NTF"),
      userId:  targetUserId,
      type:    type || "system",
      message: message,
      date:    _nowString(),
      read:    false,
    };

    DB_NOTIFICATIONS.unshift(notif);   /* Add to front of array */

    /* If notification is for the current user, update UI immediately */
    if (targetUserId === _userId) {
      _updateAllBadges();
      _refreshDropdownList();
      showToast(
        _typeIcon(type) + " " + message,
        _toastType(type),
        4500
      );
    }

    return notif;
  }

  /* ══════════════════════════════════════
     PUBLIC: markRead
  ══════════════════════════════════════ */
  function markRead(notifId) {
    var n = DB_NOTIFICATIONS.find(function (x) { return x.id === notifId; });
    if (n) {
      n.read = true;
      _updateAllBadges();
      _refreshDropdownList();
    }
  }

  /* ══════════════════════════════════════
     PUBLIC: markAllRead
  ══════════════════════════════════════ */
  function markAllRead() {
    DB_NOTIFICATIONS.forEach(function (n) {
      if (n.userId === _userId) n.read = true;
    });
    _updateAllBadges();
    _refreshDropdownList();
    showToast("All notifications marked as read.", "success");
  }

  /* ══════════════════════════════════════
     PUBLIC: destroy
     Stop polling (call on page unload if needed).
  ══════════════════════════════════════ */
  function destroy() {
    if (_pollInterval) {
      clearInterval(_pollInterval);
      _pollInterval = null;
    }
  }

  /* ══════════════════════════════════════
     PRIVATE: _startPolling
     Simulates checking for new notifications
     every _POLL_MS milliseconds.
  ══════════════════════════════════════ */
  function _startPolling() {
    if (_pollInterval) clearInterval(_pollInterval);

    _pollInterval = setInterval(function () {
      var current = DB.getUnreadCount(_userId);

      if (current > _lastCount) {
        var diff = current - _lastCount;
        showToast(
          "🔔 You have " + diff + " new notification" + (diff > 1 ? "s" : "") + ".",
          "info",
          4000
        );
        _updateAllBadges();
        _refreshDropdownList();
      }

      _lastCount = current;
    }, _POLL_MS);
  }

  /* ══════════════════════════════════════
     PRIVATE: _buildDropdown
     Builds and injects the notification
     dropdown panel into the DOM.
  ══════════════════════════════════════ */
  function _buildDropdown() {
    /* Inject styles if not already present */
    if (!document.getElementById("ntf-styles")) {
      var style = document.createElement("style");
      style.id  = "ntf-styles";
      style.textContent = [
        "#ntf-dropdown {",
        "  position: fixed;",
        "  top: 66px;",
        "  right: 20px;",
        "  width: 360px;",
        "  max-height: 480px;",
        "  background: #fff;",
        "  border: 1px solid var(--gray-200);",
        "  border-radius: var(--radius-lg);",
        "  box-shadow: var(--shadow-lg);",
        "  z-index: 500;",
        "  display: none;",
        "  flex-direction: column;",
        "  overflow: hidden;",
        "  animation: ntfSlideIn .2s ease;",
        "}",
        "#ntf-dropdown.open { display: flex; }",
        "@keyframes ntfSlideIn {",
        "  from { opacity:0; transform: translateY(-8px); }",
        "  to   { opacity:1; transform: translateY(0); }",
        "}",
        ".ntf-drop-header {",
        "  display: flex;",
        "  align-items: center;",
        "  justify-content: space-between;",
        "  padding: 14px 16px;",
        "  border-bottom: 1px solid var(--gray-200);",
        "  flex-shrink: 0;",
        "}",
        ".ntf-drop-header h4 {",
        "  font-size: var(--font-size-sm);",
        "  font-weight: 700;",
        "  color: var(--gray-900);",
        "}",
        ".ntf-drop-header button {",
        "  font-size: var(--font-size-xs);",
        "  color: var(--primary);",
        "  background: none;",
        "  border: none;",
        "  cursor: pointer;",
        "  font-weight: 600;",
        "}",
        ".ntf-drop-header button:hover { text-decoration: underline; }",
        ".ntf-drop-list {",
        "  overflow-y: auto;",
        "  flex: 1;",
        "}",
        ".ntf-drop-list::-webkit-scrollbar { width: 4px; }",
        ".ntf-drop-list::-webkit-scrollbar-thumb { background: var(--gray-300); border-radius: 4px; }",
        ".ntf-drop-item {",
        "  display: flex;",
        "  align-items: flex-start;",
        "  gap: 12px;",
        "  padding: 12px 16px;",
        "  border-bottom: 1px solid var(--gray-200);",
        "  cursor: pointer;",
        "  transition: background var(--transition);",
        "}",
        ".ntf-drop-item:last-child { border-bottom: none; }",
        ".ntf-drop-item:hover { background: var(--gray-50); }",
        ".ntf-drop-item.unread { background: var(--primary-light); }",
        ".ntf-drop-item.unread:hover { background: #d2e3fc; }",
        ".ntf-drop-icon {",
        "  width: 34px;",
        "  height: 34px;",
        "  border-radius: 50%;",
        "  display: flex;",
        "  align-items: center;",
        "  justify-content: center;",
        "  font-size: 1rem;",
        "  flex-shrink: 0;",
        "}",
        ".ntf-drop-msg {",
        "  font-size: var(--font-size-xs);",
        "  color: var(--gray-800);",
        "  line-height: 1.5;",
        "  flex: 1;",
        "}",
        ".ntf-drop-time {",
        "  font-size: 0.68rem;",
        "  color: var(--gray-500);",
        "  margin-top: 3px;",
        "}",
        ".ntf-unread-dot {",
        "  width: 8px;",
        "  height: 8px;",
        "  border-radius: 50%;",
        "  background: var(--primary);",
        "  flex-shrink: 0;",
        "  margin-top: 5px;",
        "}",
        ".ntf-drop-empty {",
        "  text-align: center;",
        "  padding: 32px 20px;",
        "  color: var(--gray-500);",
        "  font-size: var(--font-size-sm);",
        "}",
        ".ntf-drop-footer {",
        "  padding: 10px 16px;",
        "  border-top: 1px solid var(--gray-200);",
        "  text-align: center;",
        "  flex-shrink: 0;",
        "}",
        ".ntf-drop-footer a {",
        "  font-size: var(--font-size-xs);",
        "  color: var(--primary);",
        "  font-weight: 600;",
        "}",
      ].join("\n");
      document.head.appendChild(style);
    }

    /* Build dropdown element */
    var dropdown = document.createElement("div");
    dropdown.id  = "ntf-dropdown";
    dropdown.innerHTML =
      '<div class="ntf-drop-header">' +
      "<h4>🔔 Notifications</h4>" +
      '<button id="ntf-mark-all">Mark all as read</button>' +
      "</div>" +
      '<div class="ntf-drop-list" id="ntf-drop-list"></div>' +
      '<div class="ntf-drop-footer">' +
      '<a href="notifications.html">View all notifications →</a>' +
      "</div>";
    document.body.appendChild(dropdown);

    /* Wire mark-all button */
    var markAllBtn = document.getElementById("ntf-mark-all");
    if (markAllBtn) {
      markAllBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        markAllRead();
      });
    }

    /* Wire the topbar bell button to toggle dropdown */
    var bellBtn = document.getElementById("notifBtn");
    if (bellBtn) {
      bellBtn.id = "ntf-bell-btn";
      bellBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        _toggleDropdown();
      });
    }

    _refreshDropdownList();
  }

  /* ══════════════════════════════════════
     PRIVATE: _refreshDropdownList
  ══════════════════════════════════════ */
  function _refreshDropdownList() {
    var listEl = document.getElementById("ntf-drop-list");
    if (!listEl || !_userId) return;

    var notifs = DB.getNotificationsByUser(_userId);

    if (notifs.length === 0) {
      listEl.innerHTML =
        '<div class="ntf-drop-empty">🔔<br/>No notifications yet.</div>';
      return;
    }

    /* Show latest 10 */
    listEl.innerHTML = notifs.slice(0, 10).map(function (n) {
      var cfg   = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
      return '<div class="ntf-drop-item ' + (n.read ? "" : "unread") + '" data-ntf-id="' + n.id + '">' +
        '<div class="ntf-drop-icon" style="background:' + cfg.color + ';">' + cfg.icon + "</div>" +
        '<div style="flex:1;">' +
        '<div class="ntf-drop-msg">' + n.message + "</div>" +
        '<div class="ntf-drop-time">' + Utils.timeAgo(n.date) + "</div>" +
        "</div>" +
        (!n.read ? '<div class="ntf-unread-dot"></div>' : "") +
        "</div>";
    }).join("");

    /* Click to mark read */
    listEl.querySelectorAll(".ntf-drop-item").forEach(function (item) {
      item.addEventListener("click", function () {
        markRead(item.dataset.ntfId);
      });
    });
  }

  /* ══════════════════════════════════════
     PRIVATE: _toggleDropdown
  ══════════════════════════════════════ */
  function _toggleDropdown() {
    if (_dropdownOpen) {
      _closeDropdown();
    } else {
      _openDropdown();
    }
  }

  function _openDropdown() {
    var dropdown = document.getElementById("ntf-dropdown");
    if (dropdown) {
      dropdown.classList.add("open");
      _dropdownOpen = true;
      _refreshDropdownList();
    }
  }

  function _closeDropdown() {
    var dropdown = document.getElementById("ntf-dropdown");
    if (dropdown) {
      dropdown.classList.remove("open");
      _dropdownOpen = false;
    }
  }

  /* ══════════════════════════════════════
     PRIVATE: _updateAllBadges
     Syncs all badge elements on the page.
  ══════════════════════════════════════ */
  function _updateAllBadges() {
    if (!_userId) return;
    var count = DB.getUnreadCount(_userId);

    /* Sidebar badge */
    var ntfBadge = document.getElementById("ntfBadge");
    if (ntfBadge) {
      if (count > 0) {
        ntfBadge.textContent = count;
        ntfBadge.classList.remove("hidden");
      } else {
        ntfBadge.classList.add("hidden");
      }
    }

    /* Topbar dot */
    var ntfDot = document.getElementById("ntfDot");
    if (ntfDot) {
      if (count > 0) ntfDot.classList.remove("hidden");
      else           ntfDot.classList.add("hidden");
    }
  }

  /* ══════════════════════════════════════
     PRIVATE: helpers
  ══════════════════════════════════════ */
  function _typeIcon(type) {
    return (TYPE_CONFIG[type] || TYPE_CONFIG.system).icon;
  }

  function _toastType(type) {
    var map = {
      submission: "info",
      feedback:   "success",
      meeting:    "info",
      deadline:   "warning",
      approval:   "success",
      system:     "info",
    };
    return map[type] || "info";
  }

  function _nowString() {
    var now  = new Date();
    var date = now.toISOString().slice(0, 10);
    var time = now.toTimeString().slice(0, 5);
    return date + " " + time;
  }

  /* ══════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════ */
  return {
    init:       init,
    create:     create,
    markRead:   markRead,
    markAllRead:markAllRead,
    destroy:    destroy,
  };

})();