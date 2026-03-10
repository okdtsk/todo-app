export type ThemeConfig = {
  name: string;
  colors: Record<string, string>;
};

export const THEMES: ThemeConfig[] = [
  {
    name: "Light",
    colors: {
      "--color-bg": "#FFFFFF",
      "--color-bg-secondary": "#F8F8FA",
      "--color-bg-hover": "#F0F0F2",
      "--color-border": "#F0F0F2",
      "--color-text": "#1C1C1E",
      "--color-text-secondary": "#8E8E93",
      "--color-text-tertiary": "#C7C7CC",
      "--color-accent": "#007AFF",
      "--color-accent-hover": "#0056CC",
      "--color-danger": "#FF3B30",
      "--color-warning": "#FF9500",
      "--color-done": "#D1D1D6",
    },
  },
  {
    name: "Dark",
    colors: {
      "--color-bg": "#1C1C1E",
      "--color-bg-secondary": "#2C2C2E",
      "--color-bg-hover": "#3A3A3C",
      "--color-border": "#3A3A3C",
      "--color-text": "#F2F2F7",
      "--color-text-secondary": "#8E8E93",
      "--color-text-tertiary": "#636366",
      "--color-accent": "#0A84FF",
      "--color-accent-hover": "#409CFF",
      "--color-danger": "#FF453A",
      "--color-warning": "#FF9F0A",
      "--color-done": "#48484A",
    },
  },
  {
    name: "Sepia",
    colors: {
      "--color-bg": "#F5F0E8",
      "--color-bg-secondary": "#EDE7DC",
      "--color-bg-hover": "#E5DDD0",
      "--color-border": "#DDD5C5",
      "--color-text": "#3B3228",
      "--color-text-secondary": "#7A6E5E",
      "--color-text-tertiary": "#B0A692",
      "--color-accent": "#C67A3C",
      "--color-accent-hover": "#A86230",
      "--color-danger": "#CC4B37",
      "--color-warning": "#D4882A",
      "--color-done": "#C5BAA8",
    },
  },
  {
    name: "Nord",
    colors: {
      "--color-bg": "#2E3440",
      "--color-bg-secondary": "#3B4252",
      "--color-bg-hover": "#434C5E",
      "--color-border": "#434C5E",
      "--color-text": "#ECEFF4",
      "--color-text-secondary": "#D8DEE9",
      "--color-text-tertiary": "#616E88",
      "--color-accent": "#88C0D0",
      "--color-accent-hover": "#81A1C1",
      "--color-danger": "#BF616A",
      "--color-warning": "#EBCB8B",
      "--color-done": "#4C566A",
    },
  },
  {
    name: "Rose",
    colors: {
      "--color-bg": "#FFF5F5",
      "--color-bg-secondary": "#FEE2E2",
      "--color-bg-hover": "#FECACA",
      "--color-border": "#FECACA",
      "--color-text": "#1C1917",
      "--color-text-secondary": "#78716C",
      "--color-text-tertiary": "#D6D3D1",
      "--color-accent": "#E11D48",
      "--color-accent-hover": "#BE123C",
      "--color-danger": "#DC2626",
      "--color-warning": "#EA580C",
      "--color-done": "#E7E5E4",
    },
  },
  {
    name: "Midnight",
    colors: {
      "--color-bg": "#0F172A",
      "--color-bg-secondary": "#1E293B",
      "--color-bg-hover": "#334155",
      "--color-border": "#334155",
      "--color-text": "#F1F5F9",
      "--color-text-secondary": "#94A3B8",
      "--color-text-tertiary": "#475569",
      "--color-accent": "#38BDF8",
      "--color-accent-hover": "#7DD3FC",
      "--color-danger": "#F87171",
      "--color-warning": "#FBBF24",
      "--color-done": "#334155",
    },
  },
  {
    name: "Forest",
    colors: {
      "--color-bg": "#F0F4F0",
      "--color-bg-secondary": "#E2EAE2",
      "--color-bg-hover": "#D4DED4",
      "--color-border": "#C6D2C6",
      "--color-text": "#1A2E1A",
      "--color-text-secondary": "#4A6B4A",
      "--color-text-tertiary": "#8AAD8A",
      "--color-accent": "#2D8A4E",
      "--color-accent-hover": "#1E6B3A",
      "--color-danger": "#C53030",
      "--color-warning": "#B7791F",
      "--color-done": "#B8CCB8",
    },
  },
  {
    name: "Ocean",
    colors: {
      "--color-bg": "#0B1926",
      "--color-bg-secondary": "#122438",
      "--color-bg-hover": "#1A3350",
      "--color-border": "#1E3A5F",
      "--color-text": "#E0F0FF",
      "--color-text-secondary": "#7EB8E0",
      "--color-text-tertiary": "#3D6A8A",
      "--color-accent": "#00B4D8",
      "--color-accent-hover": "#48CAE4",
      "--color-danger": "#FF6B6B",
      "--color-warning": "#FFD166",
      "--color-done": "#1A3350",
    },
  },
  {
    name: "Lavender",
    colors: {
      "--color-bg": "#F8F5FF",
      "--color-bg-secondary": "#EDE8FC",
      "--color-bg-hover": "#E0D8F8",
      "--color-border": "#D8CEF5",
      "--color-text": "#2D2040",
      "--color-text-secondary": "#6B5B8A",
      "--color-text-tertiary": "#B0A3C8",
      "--color-accent": "#7C3AED",
      "--color-accent-hover": "#6D28D9",
      "--color-danger": "#DC2626",
      "--color-warning": "#D97706",
      "--color-done": "#D5CDE5",
    },
  },
  {
    name: "Solarized",
    colors: {
      "--color-bg": "#FDF6E3",
      "--color-bg-secondary": "#EEE8D5",
      "--color-bg-hover": "#E8E1C8",
      "--color-border": "#DDD6C1",
      "--color-text": "#073642",
      "--color-text-secondary": "#586E75",
      "--color-text-tertiary": "#93A1A1",
      "--color-accent": "#268BD2",
      "--color-accent-hover": "#1A6BA0",
      "--color-danger": "#DC322F",
      "--color-warning": "#CB4B16",
      "--color-done": "#C8C1AE",
    },
  },
  {
    name: "Dracula",
    colors: {
      "--color-bg": "#282A36",
      "--color-bg-secondary": "#343746",
      "--color-bg-hover": "#44475A",
      "--color-border": "#44475A",
      "--color-text": "#F8F8F2",
      "--color-text-secondary": "#BDB8D4",
      "--color-text-tertiary": "#6272A4",
      "--color-accent": "#BD93F9",
      "--color-accent-hover": "#CDA4FF",
      "--color-danger": "#FF5555",
      "--color-warning": "#FFB86C",
      "--color-done": "#44475A",
    },
  },
  {
    name: "Monokai",
    colors: {
      "--color-bg": "#272822",
      "--color-bg-secondary": "#2E2F28",
      "--color-bg-hover": "#3E3D32",
      "--color-border": "#3E3D32",
      "--color-text": "#F8F8F2",
      "--color-text-secondary": "#A6A68A",
      "--color-text-tertiary": "#75715E",
      "--color-accent": "#A6E22E",
      "--color-accent-hover": "#B8F340",
      "--color-danger": "#F92672",
      "--color-warning": "#FD971F",
      "--color-done": "#3E3D32",
    },
  },
];

export function applyTheme(theme: ThemeConfig) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(key, value);
  }
  localStorage.setItem("tdtd-theme", theme.name);
}

export function getActiveThemeName(): string {
  return localStorage.getItem("tdtd-theme") || "Light";
}

export function restoreTheme() {
  const name = localStorage.getItem("tdtd-theme");
  const theme = THEMES.find((t) => t.name === name);
  if (!theme) return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(key, value);
  }
}
