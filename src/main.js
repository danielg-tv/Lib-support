import Datafeed from './datafeed.js';
import { theme, cssBlobUrl } from './theme.js';
import {fetchNews} from './news.js';

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
      console.log('loadLineToolsAndGroups request', { layoutId, chartId });
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


  async function initOnReady() {

	// window.localStorage.clear();


	class CustomBroker extends Brokers.BrokerSample {
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


var widget = (window.tvWidget =  new TradingView.widget({
	symbol: 'Binance:ETH/USDT',                     // Default symbol pair // you can comment this out once you have load_last_chart true
    interval: '1D',                        // Default interval
    fullscreen: true,                      // Displays the chart in the fullscreen mode
    container: 'tv_chart_container',       // Reference to the attribute of the DOM element
    datafeed: Datafeed,
    library_path: '../charting_library-master/charting_library/', 
    // debug: true,
    // debug_broker: "all",
    // theme: 'dark',
    user_id: 'public_user_id',
    client_id: 'your_client_id',
    locale: "en",
    // toolbar_bg: "#262330",
    symbol_search_request_delay: 1000,
    theme: theme,
    custom_css_url: cssBlobUrl,


  news_provider: async function getNews(symbol, callback) {
    let newsItems = [];
    try {
      newsItems = await fetchNews();
    } catch (e) {
      console.error(e);
    }
    callback({
      title: 'Top News Stories',
      newsItems
    });
  },  

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
        // supportOrdersHistory: true,
        supportModifyOrderPrice: true,
        supportModifyBrackets: true,
        supportOrderBrackets: true,
        supportPositionBrackets: true,
        supportModifyDuration: true,
        supportAddBracketsToExistingOrder: true,
        supportTrailingStop: true,
        supportModifyTrailingStop: true,
        // calculatePLUsingLast: true,
        supportStopLimitOrders: false,
        supportCancelOrderForNonTradableSymbol: true,
        // supportCryptoBrackets: true,
        // supportCryptoExchangeOrderTicket: true,
        // supportCancellingBothBracketsOnly: true,
        // supportMarketBrackets: true,
        // supportIndividualPositionBrackets: false,
        // supportPositionNetting: false,
        // supportMarketOrders: false,
        // supportStopLoss: false,
        // supportStopOrders: false,

        // showNotificationsLog: true,

        // # enable Dom Data#
        supportDOM: true,
        supportLevel2Data: true,
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
      
    ],


    disabled_features: [
      'prefer_symbol_name_over_fullname',
      "save_chart_properties_to_local_storage",
      "open_account_manager",
      "show_right_widgets_panel_by_default"
    ],
    


    overrides: {
      "scalesProperties.textColor": "#ffffff",
      "scalesProperties.fontSize": 14,
      "paneProperties.backgroundGradientStartColor": "#3d3d41",
      "paneProperties.backgroundGradientEndColor": "#0a070e",
      'scalesProperties.textColor': '#ffffff',
      "time_scale.show_bar_countdown": true,
      "mainSeriesProperties.showPrevClosePriceLine": true,
      "backgrounds.outOfSession.color": "rgba(16, 20, 32, 0.2)",
      "mainSeriesProperties.baselineStyle.topLineColor": "rgba(205, 17, 33, 0.2)",
      "mainSeriesProperties.baselineStyle.bottomLineColor": "rgba(10, 32, 6, 0.2)",
      // "tradingProperties.positionPL.display" : 2,
    },

	widgetbar: {
		details: true,
    watchlist: true,
		datawindow: true,
		news: true,
        watchlist_settings: {
        default_symbols: [
          '###Bitfinex',
          "Bitfinex:BTC/USD",
          "Bitfinex:ETH/USD",
          "Bitfinex:ETH/BTC",
          "Bitfinex:LTC/USD",
          "Bitfinex:XRP/USD",
          "Bitfinex:XRP/BTC",
          "Bitfinex:EOS/USD",
          "Bitfinex:EOS/BTC",
          "Bitfinex:ZRX/USD",
          '###Binance',
          "Binance:BTC/USDT",
          "Binance:ETH/USDT",
          "Binance:ETH/BTC",
          "Binance:LTC/USDT",
          "Binance:XRP/USDT",
          "Binance:XRP/BTC",
			],
      readonly: false,
        },
    },

	save_load_adapter: localStorageSaveLoadAdapter,

	saved_data: savedData,

	saved_data_meta_info: savedDataMetaInfo,

	load_last_chart: true,
	auto_save_delay: 20,
}));

  widget.onChartReady(() => {  
    console.log("Chart is ready");

    widget.subscribe("chart_loaded", () => {
      console.log("Chart loaded");
      widget.activeChart().getAllStudies().forEach(study => {
        console.log("Study name:", study.name);
      });
    });

    // widget.activeChart().createStudy("MACD", false, false);

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
      widget.saveChartToServer();
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
			widget.resetCache();
			chart.resetData();
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
          act_chart.resetData()
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
// window.addEventListener("unhandledrejection", (event) => {
//   console.warn(`UNHANDLED REJECTION: ${event.reason}`);
// });
// window.addEventListener('unhandled promise rejection', (event) => {
//   console.warn(`UNHANDLED PROMISE REJECTION: ${event.reason}`);
// });