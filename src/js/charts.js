// assets/js/charts.js
document.addEventListener('DOMContentLoaded', () => {
    const BRAND = {
        blue: '#00aeef',
        light: '#80D6F7',
        pale: '#CCEFFC',
        navy: '#0b4e1f',
        grid: 'rgba(11, 45, 78, 0.1)',
        text: '#0B2D4E',
    };

    // Шрифт для всех текстовых элементов графика
    Chart.defaults.font.family = "'Montserrat', sans-serif";
    Chart.defaults.font.weight = '400';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = 'rgba(255, 255, 255, 0.4)';

    // Формат чисел: 1 870, 70.3 → 70,3
    const fmt = (v) => new Intl.NumberFormat('ru-RU').format(v);

    // Формат в рубли: 70268872.71 → 70 268 872,71 ₽
    const fmtRub = (v) =>
        new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(v) + ' ₽';

    document.querySelectorAll('[data-chart]').forEach((canvas) => {
        const type = canvas.dataset.chart;
        const labels = canvas.dataset.labels?.split(',') ?? [];
        const values = canvas.dataset.values?.split(',').map(Number) ?? [];
        const colors = canvas.dataset.colors?.split(',') ?? [BRAND.blue, BRAND.light, BRAND.navy, BRAND.pale];

        const common = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: type === 'doughnut' || type === 'pie' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.label}: ${fmt(ctx.parsed.y ?? ctx.parsed)}`
                    }
                }
            }
        };

        let config;

        if (type === 'bar') {
            config = {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        data: values,
                        backgroundColor: BRAND.blue,
                        borderRadius: 0,
                        barThickness: 'flex',
                        maxBarThickness: 48,
                    }]
                },
                options: {
                    ...common,
                    layout: {
                        padding: {
                            top: 50
                        }
                    },
                    plugins: {
                        ...common.plugins,
                        legend: { display: false },
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: { display: false },
                            border: { display: false },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.4)',
                                font: {
                                    family: "'Montserrat', sans-serif",
                                    size: 12,
                                    weight: '400',
                                }
                            }
                        },
                        y: {
                            display: false,
                            beginAtZero: true,
                            grid: { display: false },
                            border: { display: false },
                        }
                    }
                },
                plugins: [{
                    id: 'barValueLabels',
                    afterDatasetsDraw(chart) {
                        const { ctx } = chart;
                        const meta = chart.getDatasetMeta(0);

                        ctx.save();
                        ctx.font = "400 12px 'Montserrat', sans-serif";
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';

                        meta.data.forEach((bar, i) => {
                            const value = chart.data.datasets[0].data[i];
                            ctx.fillText(fmt(value), bar.x, bar.y - 6);
                        });

                        ctx.restore();
                    }
                }]
            };
        }

        if (type === 'doughnut') {
            config = {
                type: 'doughnut',
                data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
                options: {
                    ...common, responsive: true, maintainAspectRatio: false, cutout: '65%',
                    plugins: { ...common.plugins, legend: { display: false },
                        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmtRub(ctx.parsed)}` } } }
                }
            };
        }

        new Chart(canvas, config);
    });
});