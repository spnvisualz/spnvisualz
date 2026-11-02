// Turns src/testimonials/testimonials.js into static homepage markup at
// build time (see the testimonials plugin in vite.config.js), so quotes
// ship as plain HTML that needs no JavaScript and that search engines read.

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const MARKER = "<!-- testimonials -->";

export function publishable(list) {
  return (list || []).filter(
    (t) => t && t.approved === true && typeof t.quote === "string" && t.quote.trim() && typeof t.name === "string" && t.name.trim()
  );
}

export function renderTestimonials(list, projects = []) {
  const items = publishable(list);
  if (!items.length) return "";
  const titles = new Map(projects.map((p) => [p.slug, p.title]));
  const cards = items
    .map((t) => {
      const meta = [t.role, titles.get(t.project)].filter(Boolean).map(esc).join(" · ");
      return `<figure class="testimonial reveal"><blockquote><p>${esc(t.quote.trim())}</p></blockquote><figcaption><strong>${esc(t.name.trim())}</strong>${meta ? `<span>${meta}</span>` : ""}</figcaption></figure>`;
    })
    .join("\n        ");
  return `<section class="chapter chapter--testimonials section-pad" id="testimonials" aria-labelledby="testimonialsTitle">
      <header class="section-head reveal"><p class="section-label">Clients</p><h2 id="testimonialsTitle">In their words</h2></header>
      <div class="testimonial-grid">
        ${cards}
      </div>
    </section>`;
}
