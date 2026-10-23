// Resume Builder: form state <-> live preview, autosave, JSON import/export, print to PDF.
(() => {
  "use strict";

  const STORAGE_KEY = "resume-builder:v1";
  const SECTIONS = ["experience", "projects", "education"];

  const form = document.getElementById("editor");
  const resumeEl = document.getElementById("resume");
  const templateSelect = document.getElementById("template");

  const SAMPLE = {
    template: "classic",
    name: "Jane Doe",
    title: "Machine Learning Engineer",
    email: "jane.doe@example.com",
    phone: "+1 555 010 0000",
    location: "Austin, TX",
    links: "github.com/janedoe, linkedin.com/in/janedoe",
    summary: "ML engineer who ships models end to end, from data cleaning and evaluation to a working app. Looking for roles building applied ML and LLM systems.",
    experience: [
      {
        role: "Software Engineer Intern", org: "Example Labs", location: "Remote",
        start: "Jun 2025", end: "Aug 2025",
        bullets: "Built an LLM agent that turns requirement documents into data pipelines, with validation before deploy\nWrote 180 unit tests and a mock mode so the full flow runs offline in CI",
      },
    ],
    projects: [
      {
        name: "Fake News Detector", link: "github.com/janedoe/fake-news", tech: "Python, TensorFlow, Streamlit",
        bullets: "1D-CNN classifier reaching 99.3% test accuracy after removing source-label leakage\nShipped as a Streamlit app with a saved end-to-end model",
      },
    ],
    education: [
      {
        degree: "B.E. Computer Science", school: "Example University", location: "Hyderabad, India",
        start: "2021", end: "2025", bullets: "",
      },
    ],
    skills: "Languages: Python, SQL, JavaScript\nML: TensorFlow, scikit-learn, PyTorch\nTools: FastAPI, Flask, Git, Azure",
  };

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lines = (s) => String(s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const hasAny = (obj) => Object.values(obj).some((v) => String(v ?? "").trim());

  const storage = {
    load() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
    },
    save(data) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* private mode etc. */ }
    },
  };

  // ---------- repeatable items ----------
  function addItem(section, values = {}) {
    const tpl = document.getElementById(`tpl-${section}`);
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelectorAll("[data-field]").forEach((el) => { el.value = values[el.dataset.field] ?? ""; });
    form.querySelector(`[data-section="${section}"] .items`).appendChild(node);
    return node;
  }

  function readItems(section) {
    return [...form.querySelectorAll(`[data-section="${section}"] .item`)].map((item) => {
      const obj = {};
      item.querySelectorAll("[data-field]").forEach((el) => { obj[el.dataset.field] = el.value; });
      return obj;
    });
  }

  // ---------- state ----------
  function readState() {
    const state = { template: templateSelect.value };
    ["name", "title", "email", "phone", "location", "links", "summary", "skills"]
      .forEach((k) => { state[k] = form.elements[k].value; });
    SECTIONS.forEach((s) => { state[s] = readItems(s); });
    return state;
  }

  function writeState(state) {
    const s = state || {};
    templateSelect.value = s.template === "modern" ? "modern" : "classic";
    ["name", "title", "email", "phone", "location", "links", "summary", "skills"]
      .forEach((k) => { form.elements[k].value = s[k] ?? ""; });
    SECTIONS.forEach((sec) => {
      form.querySelector(`[data-section="${sec}"] .items`).replaceChildren();
      const items = Array.isArray(s[sec]) && s[sec].length ? s[sec] : [{}];
      items.forEach((v) => addItem(sec, v));
    });
  }

  // ---------- rendering ----------
  const bulletList = (text) => {
    const items = lines(text);
    return items.length ? `<ul>${items.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : "";
  };
  const dateRange = (a, b) => [a, b].map((x) => String(x ?? "").trim()).filter(Boolean).map(esc).join(" – ");

  function renderEntries(items, fn) {
    return items.filter(hasAny).map(fn).join("");
  }

  function render(state) {
    resumeEl.className = `resume ${state.template}`;

    const contact = [state.email, state.phone, state.location, ...String(state.links).split(",")]
      .map((x) => String(x ?? "").trim()).filter(Boolean)
      .map((x) => `<span>${esc(x)}</span>`).join("");

    const experience = renderEntries(state.experience, (e) => `
      <div class="r-entry">
        <div class="r-row"><strong>${esc(e.role)}</strong><span class="r-date">${dateRange(e.start, e.end)}</span></div>
        <div class="r-row r-sub"><span>${esc(e.org)}</span><span>${esc(e.location)}</span></div>
        ${bulletList(e.bullets)}
      </div>`);

    const projects = renderEntries(state.projects, (p) => `
      <div class="r-entry">
        <div class="r-row"><strong>${esc(p.name)}${p.tech ? ` <span class="r-sub">| ${esc(p.tech)}</span>` : ""}</strong><span>${esc(p.link)}</span></div>
        ${bulletList(p.bullets)}
      </div>`);

    const education = renderEntries(state.education, (e) => `
      <div class="r-entry">
        <div class="r-row"><strong>${esc(e.degree)}</strong><span class="r-date">${dateRange(e.start, e.end)}</span></div>
        <div class="r-row r-sub"><span>${esc(e.school)}</span><span>${esc(e.location)}</span></div>
        ${bulletList(e.bullets)}
      </div>`);

    const skills = lines(state.skills).map((line) => {
      const i = line.indexOf(":");
      return i > 0
        ? `<p><strong>${esc(line.slice(0, i))}:</strong> ${esc(line.slice(i + 1).trim())}</p>`
        : `<p>${esc(line)}</p>`;
    }).join("");

    const section = (title, body) => (body ? `<section><h2>${title}</h2>${body}</section>` : "");
    const header = state.name || state.title || contact
      ? `<header>
           ${state.name ? `<h1>${esc(state.name)}</h1>` : ""}
           ${state.title ? `<p class="r-title">${esc(state.title)}</p>` : ""}
           ${contact ? `<p class="r-contact">${contact}</p>` : ""}
         </header>`
      : "";

    const body = header
      + section("Summary", state.summary.trim() ? `<p>${esc(state.summary.trim())}</p>` : "")
      + section("Experience", experience)
      + section("Projects", projects)
      + section("Education", education)
      + section("Skills", skills ? `<div class="r-skills">${skills}</div>` : "");

    resumeEl.innerHTML = body || `<p class="r-empty">Start typing on the left, or click <b>Load sample</b>.</p>`;
    document.title = state.name ? `${state.name} – Resume` : "Resume Builder";
  }

  function update() {
    const state = readState();
    render(state);
    storage.save(state);
  }

  // ---------- events ----------
  form.addEventListener("input", update);
  templateSelect.addEventListener("change", update);

  form.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.add) {
      addItem(btn.dataset.add).querySelector("[data-field]").focus();
    } else if (btn.hasAttribute("data-remove")) {
      btn.closest(".item").remove();
    } else if (btn.dataset.move) {
      const item = btn.closest(".item");
      const sibling = btn.dataset.move === "-1" ? item.previousElementSibling : item.nextElementSibling;
      if (sibling) btn.dataset.move === "-1" ? sibling.before(item) : sibling.after(item);
    } else {
      return;
    }
    update();
  });

  document.getElementById("btn-sample").addEventListener("click", () => {
    if (hasContent() && !confirm("Replace what you've typed with the sample resume?")) return;
    writeState(SAMPLE);
    update();
  });

  document.getElementById("btn-clear").addEventListener("click", () => {
    if (!confirm("Clear the whole resume? This can't be undone (export JSON first to keep a copy).")) return;
    writeState({});
    update();
  });

  document.getElementById("btn-export").addEventListener("click", () => {
    const state = readState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(state.name || "resume").trim().replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const importInput = document.getElementById("import-file");
  document.getElementById("btn-import").addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", async () => {
    const file = importInput.files[0];
    importInput.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (typeof data !== "object" || data === null) throw new Error("not an object");
      writeState(data);
      update();
    } catch {
      alert("That file isn't a valid resume JSON export.");
    }
  });

  document.getElementById("btn-pdf").addEventListener("click", () => window.print());

  function hasContent() {
    const s = readState();
    return ["name", "title", "summary", "skills"].some((k) => s[k].trim())
      || SECTIONS.some((sec) => s[sec].some(hasAny));
  }

  // ---------- boot ----------
  writeState(storage.load() || {});
  update();
})();
