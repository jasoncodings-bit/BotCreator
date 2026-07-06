"use strict";
/* ============================================================
   Shared fade-in helper for view switches (home <-> chat).
   Modal fades are handled purely in CSS (see css/transitions.css)
   since they only toggle the existing .open class.
   ============================================================ */

function fadeInView(elem) {
  elem.hidden = false;
  elem.classList.remove("view-fade-in");
  // force reflow so the animation restarts even if the class was just removed
  void elem.offsetWidth;
  elem.classList.add("view-fade-in");
}
