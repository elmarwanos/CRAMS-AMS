/* global Chart */
// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
//  CRAMS - AMS - Best Model Chart
//
//  Displays a horizontal bar chart showing total leads per Polaris model.
//  Receives data via the "data-chart" attribute as a JSON string.
// ─────────────────────────────────────────────────────────────────────────────

class ModelChart extends HTMLElement {
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
            console.error('model-chart: invalid data', e);
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
                indexAxis: 'y',   // horizontal bars
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Leads by Model',
                        color: 'black',
                        font: { weight: 'bold', size: 15 },
                        padding: 10
                    },
                    legend: { display: false },
                    datalabels: {
                        color: 'black',
                        anchor: 'end',
                        align: 'right',
                        font: { weight: 'bold', size: 11 }
                    }
                },
                scales: {
                    x: { beginAtZero: true },
                    y: { ticks: { color: 'black' } }
                }
            },
            plugins: [window.ChartDataLabels]
        });
    }
}

customElements.define('model-chart', ModelChart);