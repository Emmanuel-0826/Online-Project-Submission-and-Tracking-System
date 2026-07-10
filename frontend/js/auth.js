/* ============================================================
   js/auth.js — Authentication Logic for OPSTS
   Handles: login, register, role selection,
            forgot password, tab switching, session management
============================================================ */

"use strict";

/* ── Role redirect map ── */
const ROLE_REDIRECT = {
  student:    "pages/student/dashboard.html",
  supervisor: "pages/supervisor/dashboard.html",
  admin:      "pages/admin/dashboard.html",
};

/* ── Active role selections ── */
let loginRole    = "student";
let registerRole = "student";

/* ═══════════════════════════════════════
   TAB SWITCHING
═══════════════════════════════════════ */
function initTabs() {
  const tabLogin    = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const formLogin   = document.getElementById("loginForm");
  const formReg     = document.getElementById("registerForm");

  tabLogin.addEventListener("click", function () {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    formLogin.classList.add("active");
    formReg.classList.remove("active");
    clearAlert();
  });

  tabRegister.addEventListener("click", function () {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    formReg.classList.add("active");
    formLogin.classList.remove("active");
    clearAlert();
  });
}

/* ═══════════════════════════════════════
   ROLE SELECTORS
═══════════════════════════════════════ */
function initRoleSelectors() {
  /* Login role selector */
  const loginOptions = document.querySelectorAll(
    "#loginRoleSelector .role-option"
  );
  loginOptions.forEach(function (opt) {
    opt.addEventListener("click", function () {
      loginOptions.forEach(function (o) { o.classList.remove("selected"); });
      opt.classList.add("selected");
      loginRole = opt.dataset.role;
    });
  });

  /* Register role selector */
  const regOptions = document.querySelectorAll(
    "#registerRoleSelector .role-option"
  );
  regOptions.forEach(function (opt) {
    opt.addEventListener("click", function () {
      regOptions.forEach(function (o) { o.classList.remove("selected"); });
      opt.classList.add("selected");
      registerRole = opt.dataset.role;
    });
  });
}

/* ═══════════════════════════════════════
   ALERT HELPERS
═══════════════════════════════════════ */
function showAlert(message, type) {
  const box     = document.getElementById("authAlert");
  box.textContent = message;
  box.className   = "auth-alert show " + type;
}

function clearAlert() {
  const box   = document.getElementById("authAlert");
  box.className   = "auth-alert";
  box.textContent = "";
}

/* ═══════════════════════════════════════
   LOGIN FORM
═══════════════════════════════════════ */
function initLoginForm() {
  const form = document.getElementById("loginForm");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearAlert();

    const email    = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
      showAlert("Please enter your email and password.", "error");
      return;
    }

    if (!Utils.isValidEmail(email)) {
      showAlert("Please enter a valid email address.", "error");
      return;
    }

    /* Look up user in DB */
    const user = DB.getUserByEmail(email);

    if (!user || user.password !== password || user.role !== loginRole) {
      showAlert(
        "Invalid email, password or role. Please check and try again.",
        "error"
      );
      return;
    }

    /* Save session */
    Utils.saveSession(user);

    showAlert("Login successful! Redirecting…", "success");

    /* Redirect after short delay */
    setTimeout(function () {
      window.location.href = ROLE_REDIRECT[user.role];
    }, 1000);
  });
}

/* ═══════════════════════════════════════
   FORGOT PASSWORD
═══════════════════════════════════════ */
function initForgotPassword() {
  const link = document.getElementById("forgotLink");

  link.addEventListener("click", function (e) {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();

    if (!email) {
      showAlert(
        "Please enter your email address above, then click Forgot password.",
        "error"
      );
      return;
    }

    if (!Utils.isValidEmail(email)) {
      showAlert("Please enter a valid email address.", "error");
      return;
    }

    /* In production: POST to backend password reset endpoint */
    showAlert(
      "If an account exists for " + email + ", a password reset link has been sent.",
      "success"
    );
  });
}

/* ═══════════════════════════════════════
   REGISTER FORM
═══════════════════════════════════════ */
function initRegisterForm() {
  const form = document.getElementById("registerForm");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearAlert();

    const firstName = document.getElementById("regFirstName").value.trim();
    const lastName  = document.getElementById("regLastName").value.trim();
    const email     = document.getElementById("regEmail").value.trim();
    const staffId   = document.getElementById("regId").value.trim();
    const dept      = document.getElementById("regDept").value;
    const password  = document.getElementById("regPassword").value;
    const confirm   = document.getElementById("regConfirm").value;

    /* Validation */
    if (!firstName || !lastName || !email || !staffId || !dept || !password || !confirm) {
      showAlert("Please fill in all fields.", "error");
      return;
    }

    if (!Utils.isValidEmail(email)) {
      showAlert("Please enter a valid email address.", "error");
      return;
    }

    if (password.length < 6) {
      showAlert("Password must be at least 6 characters.", "error");
      return;
    }

    if (password !== confirm) {
      showAlert("Passwords do not match. Please try again.", "error");
      return;
    }

    /* Check duplicate email */
    if (DB.getUserByEmail(email)) {
      showAlert("An account with this email already exists.", "error");
      return;
    }

    /* In production: POST to backend registration endpoint */
    /* For now, add to in-memory DB pending admin approval */
    const newUser = {
      id:           Utils.uid("USR"),
      role:         registerRole,
      name:         firstName + " " + lastName,
      email:        email.toLowerCase(),
      password:     password,
      avatar:       Utils.initials(firstName + " " + lastName),
      department:   dept,
      status:       "pending",   /* Awaiting admin approval */
    };

    if (registerRole === "student") {
      newUser.indexNumber   = staffId;
      newUser.supervisorId  = null;
      newUser.projectId     = null;
      newUser.level         = 400;
    } else {
      newUser.staffId            = staffId;
      newUser.assignedStudents   = [];
      newUser.specialization     = "";
    }

    DB_USERS.push(newUser);

    showAlert(
      "Account created for " + firstName + " " + lastName +
      ". Awaiting admin approval. You will be notified by email.",
      "success"
    );

    /* Reset form and switch to login after delay */
    form.reset();
    const regOptions = document.querySelectorAll("#registerRoleSelector .role-option");
    regOptions.forEach(function (o) { o.classList.remove("selected"); });
    regOptions[0].classList.add("selected");
    registerRole = "student";

    setTimeout(function () {
      document.getElementById("tab-login").click();
    }, 2800);
  });
}

/* ═══════════════════════════════════════
   GUARD: Redirect if already logged in
═══════════════════════════════════════ */
function checkExistingSession() {
  const user = Utils.getSession();
  if (user && ROLE_REDIRECT[user.role]) {
    window.location.href = ROLE_REDIRECT[user.role];
  }
}

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", function () {
  checkExistingSession();
  initTabs();
  initRoleSelectors();
  initLoginForm();
  initForgotPassword();
  initRegisterForm();
});