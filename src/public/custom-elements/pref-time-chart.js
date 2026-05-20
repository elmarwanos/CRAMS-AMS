/* global Chart */
// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
//  CRAMS-AMS · pref-time-chart.js
//  Custom element tag: <pref-time-chart>
//  Wix element ID:     #prefTimeChart
//  Doughnut — Preferred Contact Time breakdown
// ─────────────────────────────────────────────────────────────────────────────

class PrefTimeChart extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.canvas = document.createElement('canvas');
        this.shadowRoot.appendChild(this.canvas);
        this.chartInstance = null;
    }

    static get observedAttributes() { return ['data-chart']; }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'data-chart' && newValue) {
            try { this.renderChart(JSON.parse(newValue)); }
            catch (e) { console.error('pref-time-chart: invalid data', e); }
        }
    }

    connectedCallback() {
        const loadScript = (src, cb) => {
            const s = document.createElement('script');
            s.src = src; s.onload = cb;
            document.head.appendChild(s);
        };
        const tryRender = () => {
            if (this.hasAttribute('data-chart'))
                this.renderChart(JSON.parse(this.getAttribute('data-chart')));
        };

        if (!window.Chart) {
            loadScript('https://cdn.jsdelivr.net/npm/chart.js', () =>
                loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels', tryRender)
            );
        } else if (!window.ChartDataLabels) {
            loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels', tryRender);
        } else {
            tryRender();
        }
    }

    renderChart(chartData) {
        if (!this.canvas) return;
        if (this.chartInstance) this.chartInstance.destroy();
        this.chartInstance = new Chart(this.canvas.getContext('2d'), {
            type: 'doughnut',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Preferred Time',
                        color: 'black',
                        font: { weight: 'bold', size: 15 },
                        padding: 10
                    },
                    legend: { position: 'bottom', labels: { color: 'black', font: { size: 10 } } },
                    datalabels: {
                        color: 'white',
                        font: { weight: 'bold', size: 12 },
                        formatter: (value, ctx) => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct   = total ? Math.round((value / total) * 100) : 0;
                            return pct > 0 ? pct + '%' : '';
                        }
                    }
                }
            },
            plugins: [window.ChartDataLabels]
        });
    }
}

customElements.define('pref-time-chart', PrefTimeChart);
