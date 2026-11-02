// Client testimonials shown on the homepage, between "How it works" and the
// Visual Lab portal. While this list is empty the section is not rendered
// at all — no heading, no placeholder, nothing for a visitor to notice.
//
// Rules for adding an entry:
// - Real words from a real client, quoted as they wrote them (trim, never
//   reword the meaning).
// - Only with the client's written OK to publish their name and quote.
//   Set `approved: true` only once you have that; unapproved entries are
//   skipped by the build.
// - `project` is optional and should match a Selected Work slug in
//   src/work/projects.js when the quote is about that project.
//
// Example shape (do not uncomment with made-up text):
// {
//   quote: "…",
//   name: "Client name",
//   role: "Artist / Brand / Company",   // optional
//   project: "icekiid",                 // optional, Selected Work slug
//   approved: true
// }
export const TESTIMONIALS = [];
