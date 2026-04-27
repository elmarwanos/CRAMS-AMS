/* global Chart */
// ─────────────────────────────────────────────────────────────────────────────
//  CRAMS-AMS · daily-branch-chart.js
//  Place in: src/public/custom-elements/daily-branch-chart.js
//  Custom element tag: <daily-branch-chart>
//  Row 1, Col 3: Daily Leads by Branch (stacked bar per day)
// ─────────────────────────────────────────────────────────────────────────────

class DailyBranchChart extends HTMLElement {
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
            catch (e) { console.error('daily-branch-chart: invalid data', e); }
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
                loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels', () =>
                    loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom', () => {
                        if (this.hasAttribute('data-chart'))
                            this.renderChart(JSON.parse(this.getAttribute('data-chart')));
                    })
                )
            );
        } else if (!window.ChartDataLabels) {
            loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels', () =>
                loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom', () => {
                    if (this.hasAttribute('data-chart'))
                        this.renderChart(JSON.parse(this.getAttribute('data-chart')));
                })
            );
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
                scales: { x: { stacked: true }, y: { stacked: true } },
                plugins: {
                    title: {
                        display: true, text: 'Daily Leads by Branch',
                        color: 'black', font: { weight: 'bold', size: 15 }, padding: 10
                    },
                    legend: { position: 'bottom', labels: { color: 'black', font: { size: 10 } } },
                    datalabels: { display: false },
                    zoom: {
                        zoom: {
                            wheel: { enabled: true, speed: 0.01 },
                            drag: { enabled: true, backgroundColor: 'rgba(225,225,225,0.5)' },
                            pinch: { enabled: true }, mode: 'x'
                        }
                    }
                }
            },
            plugins: [window.ChartDataLabels, window.ChartZoom]
        });
    }
}

customElements.define('daily-branch-chart', DailyBranchChart);