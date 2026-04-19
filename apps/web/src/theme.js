/**
 * Catppuccin Mocha palette — mirrors apps/cli/src/theme.js so the web UI
 * feels identical to the terminal.
 */

export const BRAND_GRADIENT = ['#89dceb', '#89b4fa', '#cba6f7'];
export const TAGLINE_GRADIENT = ['#6c7086', '#9399b2', '#bac2de'];
export const QUERY_ARROW_GRADIENT = ['#94e2d5', '#89dceb'];
export const AGENT_GRADIENT = ['#fab387', '#f9e2af'];
export const AGENT_H3_GRADIENT = ['#cba6f7', '#74c7ec'];
export const AGENT_ACCENT_GRADIENT = ['#a6e3a1', '#94e2d5'];
export const STEPS_GRADIENT = ['#fab387', '#f38ba8'];
export const CONSOLE_GRADIENT = ['#89b4fa', '#94e2d5'];

export const COLOR = {
  text: '#cdd6f4',
  up: '#a6e3a1',
  down: '#f38ba8',
  activeBorder: '#94e2d5',
  busyBorder: '#fab387',
  sectionHead: '#89dceb',
  meta: '#6c7086',
  body: '#a6adc8',
  userLabel: '#94e2d5',
  agentLabel: '#fab387',
  divider: '#89b4fa',
  axis: '#585b70',
  mauve: '#cba6f7',
  pink: '#f5c2e7',
  lavender: '#b4befe',
  rosewater: '#f5e0dc',
  yellow: '#f9e2af',
  maroon: '#eba0ac',
  flamingo: '#f2cdcd',
  sapphire: '#74c7ec',
  surface0: '#313244',
  surface1: '#45475a',
  overlay1: '#7f849c',
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b'
};

/** Convert a gradient array into a css `linear-gradient(...)` (horizontal). */
export function cssGradient(colors, angle = '90deg') {
  return `linear-gradient(${angle}, ${colors.join(', ')})`;
}
