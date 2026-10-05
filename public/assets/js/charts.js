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
                data: {
                    labels,
                    datasets: [{
                        data: values,
                        backgroundColor: colors,
                        borderWidth: 0,
                        hoverOffset: 4,
                    }]
                },
                options: {
                    ...common,
                    responsive: true,
                    maintainAspectRatio: false,
                    // Освобождаем место справа под легенду
                    layout: {
                        padding: {
                            right: 160,   // <-- ключевой параметр
                            left: 0,
                            top: 0,
                            bottom: 0,
                        }
                    },
                    cutout: '65%',
                    plugins: {
                        ...common.plugins,
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => ` ${ctx.label}: ${fmtRub(ctx.parsed)}`
                            }
                        }
                    }
                },
                plugins: [{
                    id: 'doughnutRightLegend',
                    afterDraw(chart) {
                        const { ctx, chartArea } = chart;
                        const ds = chart.data.datasets[0];
                        const items = chart.data.labels.map((label, i) => ({
                            label,
                            value: ds.data[i],
                            color: ds.backgroundColor[i],
                        }));

                        const dotSize = 8;
                        const gapDotText = 10;
                        const gapBetweenItems = 16;
                        const labelLineHeight = 20;   // 14px * 1.43
                        const valueLineHeight = 16;   // 12px * 1.33

                        // Стартовая точка — сразу справа от области диаграммы
                        const startX = chartArea.right + 16;
                        const centerY = (chartArea.top + chartArea.bottom) / 2;

                        const itemHeight = labelLineHeight + valueLineHeight;
                        const totalHeight =
                            items.length * itemHeight +
                            (items.length - 1) * gapBetweenItems;

                        let y = centerY - totalHeight / 2;

                        ctx.save();
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'top';

                        items.forEach((item) => {
                            // Точка
                            ctx.beginPath();
                            ctx.fillStyle = item.color;
                            ctx.arc(
                                startX + dotSize / 2,
                                y + labelLineHeight / 2,
                                dotSize / 2,
                                0,
                                Math.PI * 2
                            );
                            ctx.fill();

                            const textX = startX + dotSize + gapDotText;

                            // Название категории — 600 / 14px / #fff
                            ctx.font = "600 14px 'Montserrat', sans-serif";
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillText(item.label, textX, y);

                            // Значение — 400 / 12px / rgba(255,255,255,0.7)
                            ctx.font = "400 12px 'Montserrat', sans-serif";
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                            ctx.fillText(fmtRub(item.value), textX, y + labelLineHeight);

                            y += itemHeight + gapBetweenItems;
                        });

                        ctx.restore();
                    }
                }]
            };
        }

        new Chart(canvas, config);
    });
});