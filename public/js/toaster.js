// Toast notification management

let toastId = 0;

export function show(type = "info", text, duration = 4000) {
  const container = document.getElementById("toastContainer");
  const id = `toast-${++toastId}`;

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.id = id;
  el.textContent = text;
  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = "toast-in 0.2s ease-in reverse";
    setTimeout(() => el.remove(), 200);
  }, duration);
}
