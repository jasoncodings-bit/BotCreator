"use strict";
/* ============================================================
   Collapsible settings sections.
   Wires every .collapse-head button to toggle its parent
   .collapse-group open/closed. Groups start collapsed if they
   carry the .collapsed class in the markup.
   ============================================================ */

function toggleCollapseGroup(group) {
  const collapsed = group.classList.toggle("collapsed");
  const head = group.querySelector(".collapse-head");
  if (head) head.setAttribute("aria-expanded", String(!collapsed));
}

function wireCollapsibleSections() {
  document.querySelectorAll(".collapse-head").forEach(head => {
    head.addEventListener("click", () => {
      const group = head.closest(".collapse-group");
      if (group) toggleCollapseGroup(group);
    });
  });
}

document.addEventListener("DOMContentLoaded", wireCollapsibleSections);
