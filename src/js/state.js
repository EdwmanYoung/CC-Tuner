// Pub/Sub state management (replaces Pinia)

const listeners = new Map();
const state = {
  profiles: [],
  activeProfileId: null,
  currentPage: "profiles",
  editingProfile: null,
  detailProfileId: null,
  configDir: null,
  theme: "light",
  isSwitching: false,
  navigateToPage: null,
  refreshProfiles: false,
  searchQuery: "",
};

export function get(key) {
  return state[key];
}

export function set(key, value) {
  state[key] = value;
  const ls = listeners.get(key);
  if (ls) {
    for (const fn of ls) fn(value);
  }
  // Also notify wildcard
  const wild = listeners.get("*");
  if (wild) {
    for (const fn of wild) fn(key, value);
  }
}

export function on(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key).delete(fn);
}

export function batch(updates) {
  for (const [key, value] of Object.entries(updates)) {
    state[key] = value;
  }
  for (const [key] of Object.entries(updates)) {
    const ls = listeners.get(key);
    if (ls) for (const fn of ls) fn(state[key]);
  }
}
