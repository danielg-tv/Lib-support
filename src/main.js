import { createAdvancedChartOptions } from "./widget-options.js";
import { installThemeToolbar } from "./toolbar.js";

// Boots the minimal tutorial chart: shared widget options plus the theme toggle.
function initChart() {
  const widget = new TradingView.widget(createAdvancedChartOptions());

  installThemeToolbar(widget);
}

window.addEventListener("DOMContentLoaded", initChart, { once: true });
