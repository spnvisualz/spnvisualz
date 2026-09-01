import { ScrollTrigger } from "../motion/scrollTimeline.js";

// The Work chapter's caption stays in a fixed on-screen position — content
// updates as the camera passes each plane, but the caption itself doesn't
// chase the 3D object's projected position. Chasing it read as jittery in
// testing; a steady caption with changing content reads as intentional.
export function bindWorkOverlay(director) {
  if (!director) return;
  const numberEl = document.getElementById("workNumber");
  const totalEl = document.getElementById("workTotal");
  const currentEl = document.getElementById("workCurrentDisplay");
  const titleEl = document.getElementById("workTitle");
  const tagEl = document.getElementById("workTag");
  const descEl = document.getElementById("workDescription");
  const workSection = document.querySelector('[data-chapter="work"]');
  if (!titleEl) return;

  if (totalEl) totalEl.textContent = String(director.workField.items.length).padStart(2, "0");

  let lastIndex = -1;
  director.onTick(() => {
    const idx = director.workField.activeIndex;
    if (idx === lastIndex || idx < 0) return;
    lastIndex = idx;
    const project = director.workField.getActiveProject();
    if (!project) return;
    if (numberEl) numberEl.textContent = project.number;
    if (currentEl) currentEl.textContent = project.number;
    if (tagEl) tagEl.textContent = project.tag;
    if (titleEl) titleEl.textContent = project.title;
    if (descEl) descEl.textContent = project.description;
  });

  if (workSection) {
    ScrollTrigger.create({
      trigger: workSection,
      start: "top 70%",
      end: "bottom 30%",
      onToggle: (self) => document.documentElement.classList.toggle("in-work", self.isActive)
    });
  }
}
