// Theme management

export function initTheme() {
  // Check system preference
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
  const saved = localStorage.getItem("cc-tuner-theme");
  const theme = saved || (prefersDark.matches ? "dark" : "light");

  applyTheme(theme);

  // Listen for system changes
  prefersDark.addEventListener("change", (e) => {
    if (!localStorage.getItem("cc-tuner-theme")) {
      applyTheme(e.matches ? "dark" : "light");
    }
  });

  return theme;
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem("cc-tuner-theme", next);
  return next;
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
