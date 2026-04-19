/** ─────────────────────────────────────────────────────────────────────────────
 *  CATPPUCCIN MOCHA THEME  –  soothing pastel palette for the terminal
 *
 *  Palette reference (all 26 Mocha colors):
 *    Rosewater #f5e0dc   Flamingo  #f2cdcd   Pink      #f5c2e7
 *    Mauve     #cba6f7   Red       #f38ba8   Maroon    #eba0ac
 *    Peach     #fab387   Yellow    #f9e2af   Green     #a6e3a1
 *    Teal      #94e2d5   Sky       #89dceb   Sapphire  #74c7ec
 *    Blue      #89b4fa   Lavender  #b4befe
 *    Text      #cdd6f4   Subtext1  #bac2de   Subtext0  #a6adc8
 *    Overlay2  #9399b2   Overlay1  #7f849c   Overlay0  #6c7086
 *    Surface2  #585b70   Surface1  #45475a   Surface0  #313244
 *    Base      #1e1e2e   Mantle    #181825   Crust     #11111b
 * ─────────────────────────────────────────────────────────────────────────────*/

/** Brand / hero gradient: Sky → Blue → Mauve */
export const BRAND_GRADIENT = ['#89dceb', '#89b4fa', '#cba6f7'];

/** Tagline gradient: Overlay0 → Overlay2 → Subtext1 */
export const TAGLINE_GRADIENT = ['#6c7086', '#9399b2', '#bac2de'];

/** Query prompt arrow: Teal → Sky */
export const QUERY_ARROW_GRADIENT = ['#94e2d5', '#89dceb'];

/** Agent AI chat header: Peach → Yellow */
export const AGENT_GRADIENT = ['#fab387', '#f9e2af'];

/** H3 sub-headers: Mauve → Sapphire */
export const AGENT_H3_GRADIENT = ['#cba6f7', '#74c7ec'];

/** Blotter panel title: Green → Teal */
export const AGENT_ACCENT_GRADIENT = ['#a6e3a1', '#94e2d5'];

/** Intermediate steps title: Peach → Red */
export const STEPS_GRADIENT = ['#fab387', '#f38ba8'];

/** SSE console title: Blue → Teal */
export const CONSOLE_GRADIENT = ['#89b4fa', '#94e2d5'];

/** Accent colors (named, for Ink's color= prop) */
export const COLOR = {
  /** Primary text — Mocha Text */
  text: '#cdd6f4',
  /** Up (profit / gain) — Mocha Green */
  up: '#a6e3a1',
  /** Down (loss / decline) — Mocha Red */
  down: '#f38ba8',
  /** Active border — Mocha Teal */
  activeBorder: '#94e2d5',
  /** Busy / waiting border — Mocha Peach */
  busyBorder: '#fab387',
  /** Section header labels — Mocha Sky */
  sectionHead: '#89dceb',
  /** Dim metadata text — Mocha Overlay0 */
  meta: '#6c7086',
  /** Normal body text — Mocha Subtext0 */
  body: '#a6adc8',
  /** "you" label in chat — Mocha Teal */
  userLabel: '#94e2d5',
  /** "agent" label in chat — Mocha Peach */
  agentLabel: '#fab387',
  /** Divider / axis lines — Mocha Blue */
  divider: '#89b4fa',
  /** Axis ticks — Mocha Surface2 */
  axis: '#585b70',
  /** Mauve accent (OL numbers, metrics title, etc.) */
  mauve: '#cba6f7',
  /** Pink accent */
  pink: '#f5c2e7',
  /** Lavender accent */
  lavender: '#b4befe',
  /** Rosewater accent */
  rosewater: '#f5e0dc',
  /** Yellow accent */
  yellow: '#f9e2af',
  /** Maroon accent */
  maroon: '#eba0ac',
  /** Flamingo accent */
  flamingo: '#f2cdcd',
  /** Sapphire accent */
  sapphire: '#74c7ec',
  /** Surface0 (card backgrounds / subtle borders) */
  surface0: '#313244',
  /** Surface1 */
  surface1: '#45475a',
  /** Overlay1 */
  overlay1: '#7f849c',
};
