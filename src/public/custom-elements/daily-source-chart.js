/* global Chart */
// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
//  CRAMS - AMS - Custom Daily Source Chart
//
//  Displays a stacked bar chart of daily leads broken down by source
//  (Instagram, Facebook, Instagram & Facebook, Other).
//  Receives data via the "data-chart" attribute as a JSON string.
// ─────────────────────────────────────────────────────────────────────────────

class DailySourceChart extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.canvas = document.createElement('canvas');
        this.shadowRoot.appendChild(this.canvas);
        this.chartInstance = null;
    }

    static get observedAttributes() {
        return ['data-chart'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'data-chart' && newValue) {
        try {
            this.renderChart(JSON.parse(newValue));
        } catch (e) {
            console.error('daily-source-chart: invalid data', e);
        }
    }
}

    connectedCallback() {
        const loadScript = (src, cb) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = cb;
            document.head.appendChild(s);
        };

        if (!window.Chart) {
            loadScript('https://cdn.jsdelivr.net/npm/chart.js', () => {
                loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels', () => {
                    loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom', () => {
                        if (this.hasAttribute('data-chart'))
                            this.renderChart(JSON.parse(this.getAttribute('data-chart')));
                    });
                });
            });
        } else if (!window.ChartDataLabels) {
            loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels', () => {
                loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom', () => {
                    if (this.hasAttribute('data-chart'))
                        this.renderChart(JSON.parse(this.getAttribute('data-chart')));
                });
            });
        } else {
            if (this.hasAttribute('data-chart'))
                this.renderChart(JSON.parse(this.getAttribute('data-chart')));
        }
    }

    renderChart(chartData) {
        if (!this.canvas) return;
        if (this.chartInstance) this.chartInstance.destroy();

        this.chartInstance = new Chart(this.canvas.getContext('2d'), {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Daily Leads by Source',
                        color: 'black',
                        font: { weight: 'bold', size: 15 },
                        padding: 10
                    },
                    legend: {
                        position: 'bottom',
                        labels: { color: 'black', font: { size: 10 } }
                    },
                    datalabels: { display: false },
                    zoom: {
                        zoom: {
                            wheel: { enabled: true, speed: 0.01 },
                            drag: { enabled: true, backgroundColor: 'rgba(225,225,225,0.5)' },
                            pinch: { enabled: true },
                            mode: 'x'
                        }
                    }
                }
            },
            plugins: [window.ChartDataLabels, window.ChartZoom]
        });
    }
}

customElements.define('daily-source-chart', DailySourceChart);