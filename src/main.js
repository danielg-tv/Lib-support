import Datafeed from './datafeed.js';
import { theme, cssBlobUrl } from './theme.js';
import { COINDESK_RSS_NEWS_FEED, COINDESK_RSS_TITLE } from './news.js';



  const storageKeys = {
    charts: "LocalStorageSaveLoadAdapter_charts",
    studyTemplates: "LocalStorageSaveLoadAdapter_studyTemplates",
    drawingTemplates: "LocalStorageSaveLoadAdapter_drawingTemplates",
    chartTemplates: "LocalStorageSaveLoadAdapter_chartTemplates",
    drawings: "LocalStorageSaveLoadAdapter_drawings",
  };
  class LocalStorageSaveLoadAdapter {
    constructor() {
      var _a, _b, _c, _d, _e;
      this._charts = [];
      this._studyTemplates = [];
      this._drawingTemplates = [];
      this._chartTemplates = [];
      this._drawings = {};
      this._isDirty = false;
      this._charts =
        (_a = this._getFromLocalStorage(storageKeys.charts)) !== null &&
        _a !== void 0
          ? _a
          : [];
      this._studyTemplates =
        (_b = this._getFromLocalStorage(storageKeys.studyTemplates)) !==
          null && _b !== void 0
          ? _b
          : [];
      this._drawingTemplates =
        (_c = this._getFromLocalStorage(storageKeys.drawingTemplates)) !==
          null && _c !== void 0
          ? _c
          : [];
      this._chartTemplates =
        (_d = this._getFromLocalStorage(storageKeys.chartTemplates)) !==
          null && _d !== void 0
          ? _d
          : [];
      this._drawings =
        (_e = this._getFromLocalStorage(storageKeys.drawings)) !== null &&
        _e !== void 0
          ? _e
          : {};
      setInterval(() => {
        if (this._isDirty) {
          this._saveAllToLocalStorage();
          this._isDirty = false;
        }
      }, 1000);

    }
    getAllCharts() {
      return Promise.resolve(this._charts);
    }
    removeChart(id) {
      for (var i = 0; i < this._charts.length; ++i) {
        if (this._charts[i].id === id) {
          this._charts.splice(i, 1);
          this._isDirty = true;
          return Promise.resolve();
        }
      }
      return Promise.reject(new Error("The chart does not exist"));
    }
    saveChart(chartData) {
      if (!chartData.id) {
        chartData.id = this._generateUniqueChartId();
      } else {
        this.removeChart(chartData.id);
      }
      const savedChartData = Object.assign(Object.assign({}, chartData), {
        id: chartData.id,
        timestamp: Math.round(Date.now() / 1000),
      });
      this._charts.push(savedChartData);
      this._isDirty = true;
      return Promise.resolve(savedChartData.id);
    }
    getChartContent(id) {
      for (var i = 0; i < this._charts.length; ++i) {
        if (this._charts[i].id === id) {
          return Promise.resolve(this._charts[i].content);
        }
      }
      return Promise.reject(new Error("The chart does not exist"));
    }
    removeStudyTemplate(studyTemplateData) {
      for (var i = 0; i < this._studyTemplates.length; ++i) {
        if (this._studyTemplates[i].name === studyTemplateData.name) {
          this._studyTemplates.splice(i, 1);
          this._isDirty = true;
          return Promise.resolve();
        }
      }
      return Promise.reject(new Error("The study template does not exist"));
    }
    getStudyTemplateContent(studyTemplateData) {
      for (var i = 0; i < this._studyTemplates.length; ++i) {
        if (this._studyTemplates[i].name === studyTemplateData.name) {
          return Promise.resolve(this._studyTemplates[i].content);
        }
      }
      return Promise.reject(new Error("The study template does not exist"));
    }
    saveStudyTemplate(studyTemplateData) {
      for (var i = 0; i < this._studyTemplates.length; ++i) {
        if (this._studyTemplates[i].name === studyTemplateData.name) {
          this._studyTemplates.splice(i, 1);
          break;
        }
      }
      this._studyTemplates.push(studyTemplateData);
      this._isDirty = true;
      return Promise.resolve();
    }
    getAllStudyTemplates() {
      return Promise.resolve(this._studyTemplates);
    }
    removeDrawingTemplate(toolName, templateName) {
      for (var i = 0; i < this._drawingTemplates.length; ++i) {
        if (
          this._drawingTemplates[i].name === templateName &&
          this._drawingTemplates[i].toolName === toolName
        ) {
          this._drawingTemplates.splice(i, 1);
          this._isDirty = true;
          return Promise.resolve();
        }
      }
      return Promise.reject(
        new Error("The drawing template does not exist")
      );
    }
    loadDrawingTemplate(toolName, templateName) {
      for (var i = 0; i < this._drawingTemplates.length; ++i) {
        if (
          this._drawingTemplates[i].name === templateName &&
          this._drawingTemplates[i].toolName === toolName
        ) {
          return Promise.resolve(this._drawingTemplates[i].content);
        }
      }
      return Promise.reject(
        new Error("The drawing template does not exist")
      );
    }
    saveDrawingTemplate(toolName, templateName, content) {
      for (var i = 0; i < this._drawingTemplates.length; ++i) {
        if (
          this._drawingTemplates[i].name === templateName &&
          this._drawingTemplates[i].toolName === toolName
        ) {
          this._drawingTemplates.splice(i, 1);
          break;
        }
      }
      this._drawingTemplates.push({
        name: templateName,
        content: content,
        toolName: toolName,
      });
      this._isDirty = true;
      return Promise.resolve();
    }
    getDrawingTemplates() {
      return Promise.resolve(
        this._drawingTemplates.map(function (template) {
          return template.name;
        })
      );
    }
    async getAllChartTemplates() {
      return this._chartTemplates.map((x) => x.name);
    }
    async saveChartTemplate(templateName, content) {
      const theme = this._chartTemplates.find(
        (x) => x.name === templateName
      );
      if (theme) {
        theme.content = content;
      } else {
        this._chartTemplates.push({ name: templateName, content });
      }
      this._isDirty = true;
    }
    async removeChartTemplate(templateName) {
      this._chartTemplates = this._chartTemplates.filter(
        (x) => x.name !== templateName
      );
      this._isDirty = true;
    }
    async getChartTemplateContent(templateName) {
      var _a;
      const content =
        (_a = this._chartTemplates.find((x) => x.name === templateName)) ===
          null || _a === void 0
          ? void 0
          : _a.content;
      return {
        content: structuredClone(content),
      };
    }
    async saveLineToolsAndGroups(layoutId, chartId, state) {
      console.log('Layout ID:', layoutId);
      console.log('State object received:', state);
      const drawings = state.sources;
      if (!drawings) return;
      if (!this._drawings[this._getDrawingKey(layoutId, chartId)]) {
        this._drawings[this._getDrawingKey(layoutId, chartId)] = {};
      }
      for (let [key, state] of drawings) {
        if (state === null) {
          delete this._drawings[this._getDrawingKey(layoutId, chartId)][
            key
          ];
        } else {
          this._drawings[this._getDrawingKey(layoutId, chartId)][key] =
            state;
        }
      }
      this._isDirty = true;
      console.log("Saved: saveLineToolsAndGroups triggered for", layoutId, chartId);
    }
    async loadLineToolsAndGroups(
      layoutId,
      chartId,
      _requestType,
      _requestContext
    ) {
      console.log('loadLineToolsAndGroups request', { layoutId, chartId, _requestType, _requestContext });
      
      if (!layoutId) {
        return null;
      }
      const rawSources =
        this._drawings[this._getDrawingKey(layoutId, chartId)];
      if (!rawSources) return null;
      const sources = new Map();
      for (let [key, state] of Object.entries(rawSources)) {
        sources.set(key, state);
      }
      return {
        sources,
      };
    }
    _generateUniqueChartId() {
      const existingIds = this._charts.map((i) => i.id);
      while (true) {
        const uid = Math.random().toString(16).slice(2);
        if (!existingIds.includes(uid)) {
          return uid;
        }
      }
    }
    _getFromLocalStorage(key) {
      const dataFromStorage = window.localStorage.getItem(key);
      return JSON.parse(dataFromStorage || "null");
    }
    _saveToLocalStorage(key, data) {
      const dataString = JSON.stringify(data);
      window.localStorage.setItem(key, dataString);
    }
    _saveAllToLocalStorage() {
      this._saveToLocalStorage(storageKeys.charts, this._charts);
      this._saveToLocalStorage(
        storageKeys.studyTemplates,
        this._studyTemplates
      );
      this._saveToLocalStorage(
        storageKeys.drawingTemplates,
        this._drawingTemplates
      );
      this._saveToLocalStorage(
        storageKeys.chartTemplates,
        this._chartTemplates
      );
      this._saveToLocalStorage(storageKeys.drawings, this._drawings);
    }
    _getDrawingKey(layoutId, chartId) {
      return `${layoutId}/${chartId}`;
    }
  }

  // Alerts
  // Global state to track active alerts and the previous price
  window.activeAlerts =[];
  window.previousPrice = null;
  window.lastCrosshairPrice = null;
  


  async function initOnReady() {
  window.myDatafeed = Datafeed;

	// window.localStorage.clear();

	class CustomBroker extends Brokers.BrokerDemo {
        isTradable() {
        /* If this property returns false, then when trying to view the DOM widget
           nothing will be displayed, and after a minute (or a quite a few seconds)
           console errors will start to appear.
        */
        return Promise.resolve(true);}
	};
	const localStorageSaveLoadAdapter = new LocalStorageSaveLoadAdapter();

	window.localStorageSaveLoadAdapter = localStorageSaveLoadAdapter;

	const savedCharts = await localStorageSaveLoadAdapter.getAllCharts();
	const savedChart =
		Array.isArray(savedCharts) &&
		savedCharts.find((x) => x.name === "Default");
	const savedData = savedChart
		? JSON.parse(JSON.parse(savedChart.content).content)
		: undefined;
	const savedDataMetaInfo = savedChart
		? { ...savedChart, content: undefined }
		: undefined;

	// const now = new Date();
	// const startOfYear = new Date(now.getFullYear(), 0, 1);
	// const diffInDays = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
	// const ytdLabel = `${diffInDays}d`;
const dateFormatFunctions = TradingView.dateFormatFunctions;


var widget = (window.tvWidget =  new TradingView.widget({
	  symbol: 'Binance:ETH/USDT',                     // Default symbol pair // you can comment this out once you have load_last_chart true
    interval: '1D',                        // Default interval
    fullscreen: true,                      // Displays the chart in the fullscreen mode
    container: 'tv_chart_container',       // Reference to the attribute of the DOM element
    datafeed: Datafeed,
    library_path: '../vendor/tradingview/charting_library/', 
    user_id: 'public_user_id',
    client_id: 'your_client_id',
    locale: "en",
    symbol_search_request_delay: 1000,
    theme: theme,
    custom_css_url: cssBlobUrl,
    custom_font_family: "'NanumBarunGothic', sans-serif", 
    rss_news_feed: COINDESK_RSS_NEWS_FEED,
    rss_news_title: COINDESK_RSS_TITLE,


	broker_factory: function (host) {
			window.host = host;
			window.customBroker = new CustomBroker(host, Datafeed);
			return customBroker;
	},

	broker_config: {
      configFlags: {
        supportPositions: true,
        supportMultiposition: true,
        supportReversePosition: true,
        supportNativeReversePosition: true,
        supportPartialClosePosition: true,
        supportClosePosition: true,
        supportPLUpdate: true,
        showQuantityInsteadOfAmount: true,
        supportEditAmount: true,
        supportOrdersHistory: false,
        supportModifyOrderPrice: true,
        supportModifyBrackets: true,
        supportOrderBrackets: true,
        supportPositionBrackets: true,
        supportModifyDuration: true,
        supportAddBracketsToExistingOrder: true,
        supportTrailingStop: true,
        supportModifyTrailingStop: true,
        supportStopLimitOrders: false,
        supportCancelOrderForNonTradableSymbol: true,
        supportLevel2Data: true,

        // V31.0.0 TP Crypto specific flags
        show_symbol_logos: true,
        supportMultipleExitLevels: true,
      },
      tradedGroupConfig: {
        supportAdaptiveLayout: true,
      },
	    durations: [
            { name: 'DAY', value: 'DAY' },  // Day orders
			      { name: 'IOC', value: 'IOC' },  // Immediate-Or-Cancel orders
        ],
	},

    enabled_features: [
      "pre_post_market_sessions",
      'items_favoriting',
      'secondary_series_extend_time_scale',
      'custom_resolutions',
      "saveload_separate_drawings_storage",
      'allow_arbitrary_symbol_search_input',
      "display_data_mode",
      "pre_post_market_price_line",
      "legend_last_day_change",
      'use_symbol_name_for_header_toolbar',
      'chart_drag_export',
      "dom_widget",
    ],

    disabled_features: [
      "use_localstorage_for_settings",
      'prefer_symbol_name_over_fullname',
      "save_chart_properties_to_local_storage",
      "open_account_manager",
      "show_right_widgets_panel_by_default",
      'volume_force_overlay'
    ],
    
    overrides: {
      "paneProperties.backgroundType": "gradient",
      "scalesProperties.textColor": "#ffffff",
      "scalesProperties.fontSize": 14,
      "paneProperties.backgroundGradientStartColor": "#36364a",
      "paneProperties.backgroundGradientEndColor": "#353924",
      'scalesProperties.textColor': '#ffffff',
      "time_scale.show_bar_countdown": true,
      "mainSeriesProperties.showPrevClosePriceLine": true,
      "backgrounds.outOfSession.color": "rgba(16, 20, 32, 0.2)",
      "mainSeriesProperties.baselineStyle.topLineColor": "rgba(205, 17, 33, 0.2)",
      "mainSeriesProperties.baselineStyle.bottomLineColor": "rgba(10, 32, 6, 0.2)",

    },
    

	widgetbar: {
		details: true,
    watchlist: true,
		datawindow: true,
		news: true,
        watchlist_settings: {
        default_symbols: [
          '###Binance',
          "Binance:BTC/USDT",
          "Binance:ETH/USDT",
          "Binance:BNB/USDT",
          "Binance:SOL/USDT",
          "Binance:ADA/USDT",
          "Binance:ETH/BTC",
          "Binance:LTC/USDT",
          "Binance:XRP/USDT",
          "Binance:XRP/BTC"
			],
      readonly: false,
        },
    },

	save_load_adapter: localStorageSaveLoadAdapter,

	load_last_chart: false,
	auto_save_delay: 5,

  // alert button
  // 1. Use context_menu.items_processor to add the Alert button
    context_menu: {
      items_processor: async (items, actionsFactory, params) => {
        console.log(`Items processor for menu: ${params.menuName}`);
        
        // Target the Plus button menu specificall`y
        if (params.menuName === 'CrosshairMenuView') {
          // Retrieve the price captured by the onPlusClick event
          const price = window.lastPlusClickPrice;
          
          if (price !== null && price !== undefined) {
            const alertAction = actionsFactory.createAction({
              actionId: 'create_custom_alert',
              label: `Add Alert at ${price.toFixed(2)}`,
              onExecute: async () => {
                // Draw the horizontal line
                const lineId = await widget.activeChart().createShape(
                  { price: price },
                  {
                    shape: 'horizontal_line',
                    // text: `Alert: ${price.toFixed(2)}`,
                    overrides: { linecolor: '#FF9800', linewidth: 2, linestyle: 1 }
                  }
                );
                
                // Store the alert for the onTick checker
                window.activeAlerts.push({ id: lineId, price: price });
              }
            });
            
            // Add a separator and our new action to the bottom of the menu
            items.push(actionsFactory.createSeparator());
            items.push(alertAction);
          }
        }
        return items;
      }
    },
}));

  widget.onChartReady(() => {  
    console.log("Chart is ready");

    widget.activeChart().getAllStudies().forEach(study => {
      console.log("Study 2 name:", study.name);
    });
    widget.subscribe("panes_height_changed", () => {
      console.log("new width "); 
    });
    widget.subscribe("panes_height_changed", () => {
      console.log("Symbol search triggered: "); 
    });
    widget.subscribe('study_event', (id, value) => {
    console.log('study_event triggered: ', { id, value } )
    });
    widget.subscribe("onAutoSaveNeeded", () => {
      console.log("Should save");
      widget.saveChartToServer(
        null,
        null,
        { defaultChartName: 'Def Chart' }
      );
    });
    widget.subscribe('onSelectedLineToolChanged', () => {
        // Get the currently selected line tool
        const selectedTool = widget.selectedLineTool();
        console.log('Selected drawing tool:', selectedTool);
    });
    widget.subscribe('drawing_event', (id, type) => {
      // Log the specific event type that occurred for debugging.
      console.log(`Drawing event: '${type}' for drawing with ID: ${id}`);

      // We are only interested in 'click' events for this logic.
      if (type === 'click') {
          console.log(`Drawing with ID ${id} was clicked.`);

          // Get the drawing object by its ID.
          const drawing = widget.activeChart().getShapeById(id);

          if (drawing) {
              // The getProperties() method returns all properties of the drawing.
              const properties = drawing.getProperties();

              // Log the entire properties object to help you see its structure
              // and find the correct property names for what you need.
              console.log('Drawing properties:', properties);

              // The property name for the drawing type is typically 'linetool'.
              // It's best to inspect the logged 'properties' object to be certain.
              const drawingType = properties.linetool || 'Unknown';
              console.log(`Drawing type: ${drawingType}`);
          } else {
              console.warn(`No drawing found for ID ${id}`);
          }
      }
    });
    widget.subscribe("indicators_dialog", () => {
      console.log("Indicators Dialog Opened",);
    });
    widget.subscribe('study_event', (entityId, studyEventType) => {
      console.log('study_event:', entityId, studyEventType);
    });
    widget.subscribe("series_event", (seriesEventType) => {
      console.log("Something changed: ", seriesEventType);
    });
    widget.subscribe("study", (params) => {
      console.log("Study has been added:", params.value);
      setTimeout(() => {
          widget.activeChart().getAllStudies().forEach(study => {
              console.log("Study name:", study.name);
          });1000});
    });
    const chart = widget.activeChart();
    chart.onIntervalChanged().subscribe(null, (interval, timeframeObj) => {
        // Wrap the asynchronous operations in a setTimeout to ensure they execute
        // after the current synchronous event handling is complete.
        setTimeout(() => {
            widget.resetCache();}, 10)
            chart.resetData();
        ; // A delay of 0 schedules the function for the next available cycle
    });
    widget.subscribe("chart_loaded", () => {
      console.log("Chart loaded");
      widget.activeChart().getAllStudies().forEach(study => {
        console.log("Study name:", study.name);
      });
    });

  // alert subscriptions
  // 2. Capture the exact price when the Plus button is clicked
    widget.subscribe('onPlusClick', (params) => {
      if (params.price !== undefined) {
        window.lastPlusClickPrice = params.price;
      }
    });
      // 3. Monitor real-time price updates to trigger the alert
    widget.subscribe('onTick', (tick) => {
      const currentPrice = tick.close;

      if (window.previousPrice !== null) {
        window.activeAlerts = window.activeAlerts.filter(alert => {
          const crossedUp = window.previousPrice < alert.price && currentPrice >= alert.price;
          const crossedDown = window.previousPrice > alert.price && currentPrice <= alert.price;

          if (crossedUp || crossedDown) {
            // Trigger toast notification
            if (window.host) {
              window.host.showNotification(
                "Alert Triggered", 
                `Price crossed your alert at ${alert.price.toFixed(2)}`, 
                1 // NotificationType.Success
              );
            }

            // Remove the line from the chart
            chart.removeEntity(alert.id);
            
            return false; // Remove from active alerts array
          }
          return true;
        });
      }
      window.previousPrice = currentPrice;
    });

    // 4. Update the alert price if the user drags the line on the chart
    widget.subscribe('drawing_event', (id, type) => {
      if (type === 'points_changed') {
        const alertIndex = window.activeAlerts.findIndex(a => a.id === id);
        if (alertIndex !== -1) {
          setTimeout(() => {
            const shape = chart.getShapeById(id);
            if (!shape) return;

            const newPrice = shape.getPoints()[0]?.price;
            if (newPrice !== undefined) {
              window.activeAlerts[alertIndex].price = newPrice;
              shape.setProperties({ text: `Alert: ${newPrice.toFixed(2)}` });
            }
          }, 50);
        }
      }
    });


  });

  widget.headerReady().then(function () {
    const act_chart = widget.activeChart();
      console.log("Header is ready");
      const button = widget.createButton({align: 'right'});
      button.textContent = "Reset";
      button.addEventListener("click", function () {
          act_chart.removeAllStudies();
          const symbol_set = widget.activeChart().symbol();
          act_chart.removeAllShapes(),
          widget.setLayout("s"),
          act_chart.setSymbol(symbol_set),
          widget.resetCache(),
          act_chart.resetData()
      });
      let drawingsHidden = false; // Store the current state
        
      var dropdown = widget.createDropdown({
        title: "Select symbol",
        align: "right",
        tooltip: "Select one of the symbols to load the chart with",
        icon: '<img src="/src/assets/arrow-down-angle-svgrepo-com.svg" alt="arrow" style="height:22px; display:block; margin-left: auto;">',
        items: [
            {
                title: "BTC/USDT (1D)",
                onSelect: () => {
                    widget.activeChart().setSymbol("Binance:BTC/USDT", "1D");
                }
            },
            {
                title: "ETH/USDT (1D)",
                onSelect: () => {
                    widget.activeChart().setSymbol("Binance:ETH/USDT", "1D");
                }
            }
        ]
      });

      const hide_button = widget.createButton({ align: 'right' });
      hide_button.textContent = "Hide Indicators/Drawings";
      hide_button.addEventListener("click", function () {
        drawingsHidden = !drawingsHidden; // Toggle state

        // Hide or show all drawings
        widget.hideAllDrawingTools().setValue(drawingsHidden);

        // Hide or show all indicators
        widget.activeChart().getAllStudies().forEach(study => {
          widget.activeChart().getStudyById(study.id).setVisible(!drawingsHidden);
        });

        // Update button text
        hide_button.textContent = drawingsHidden ? "Show" : "Hide";
      });
    const themeToggleEl = widget.createButton({
					useTradingViewStyle: false,
					align: 'right',
				});
				themeToggleEl.dataset.internalAllowKeyboardNavigation = 'true';
				themeToggleEl.id = 'theme-toggle';
				themeToggleEl.innerHTML = `<label for="theme-switch" id="theme-switch-label">Dark Mode</label>
					<div class="switcher">
						<input type="checkbox" id="theme-switch" tabindex="-1">
						<span class="thumb-wrapper">
							<span class="track"></span>
							<span class="thumb"></span>
						</span>
					</div>`;
				themeToggleEl.title = 'Toggle theme';
				const checkboxEl = themeToggleEl.querySelector('#theme-switch');
				checkboxEl.checked = theme === 'dark';
				checkboxEl.addEventListener('change', function () {
					const themeToSet = this.checked ? 'dark' : 'light'
					widget.changeTheme(themeToSet, { disableUndo: true });
				});

				const element = widget.createButton({
					useTradingViewStyle: false,
					align: 'right',
				});
				element.dataset.internalAllowKeyboardNavigation = 'true';
				element.innerHTML = `<button id="documentation-toolbar-button" tabindex="-1">Documentation</button>`;
				element.title = 'View the documentation site';
				element.addEventListener('click', () => {
					window.open(
						'https://www.tradingview.com/charting-library-docs/',
						'_blank'
					);
				});

				const themeSwitchCheckbox = themeToggleEl.querySelector('#theme-switch');
				const documentationButton = element.querySelector('#documentation-toolbar-button');

				const handleRovingTabindexMainElement = (e) => {
					e.target.tabIndex = 0;
				};
				const handleRovingTabindexSecondaryElement = (e) => {
					e.target.tabIndex = -1;
				};

				themeSwitchCheckbox.addEventListener('roving-tabindex:main-element', handleRovingTabindexMainElement);
				themeSwitchCheckbox.addEventListener('roving-tabindex:secondary-element', handleRovingTabindexSecondaryElement);
				documentationButton.addEventListener('roving-tabindex:main-element', handleRovingTabindexMainElement);
				documentationButton.addEventListener('roving-tabindex:secondary-element', handleRovingTabindexSecondaryElement);  
  });
  window.frames[0].focus();
}
window.addEventListener("DOMContentLoaded", initOnReady, false);
