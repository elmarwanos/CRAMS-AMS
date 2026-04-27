/* global Chart */
// ─────────────────────────────────────────────────────────────────────────────
//  CRAMS-AMS · source-ratio-chart.js
//  Place in: src/public/custom-elements/source-ratio-chart.js
//  Custom element tag: <source-ratio-chart>
//  Row 2, Col 1: Sources Ratio (doughnut)
// ─────────────────────────────────────────────────────────────────────────────

class SourceRatioChart extends HTMLElement {
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
            catch (e) { console.error('source-ratio-chart: invalid data', e); }
        }
    }

    connectedCallback() {
        const loadScript = (src, cb) => {
            const s = document.createElement('script');
            s.src = src; s.onload = cb;
            document.head.appendChild(s);
        };
        if (!window.Chart) {
            loadScript('https://cdn.jsdelivr.net/npm/chart.js', () =>
                loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels', () => {
                    if (this.hasAttribute('data-chart'))
                        this.renderChart(JSON.parse(this.getAttribute('data-chart')));
                })
            );
        } else if (!window.ChartDataLabels) {
            loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels', () => {
                if (this.hasAttribute('data-chart'))
                    this.renderChart(JSON.parse(this.getAttribute('data-chart')));
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
            type: 'doughnut',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true, text: 'Sources Ratio',
                        color: 'black', font: { weight: 'bold', size: 15 }, padding: 10
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

customElements.define('source-ratio-chart', SourceRatioChart);