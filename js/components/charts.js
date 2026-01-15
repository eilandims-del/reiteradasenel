/**
 * Componente Charts - Gráficos com Chart.js
 */

import { generateRankingCausa, generateRankingAlimentador } from '../services/data-service.js';

let chartCausa = null;
let chartAlimentador = null;

/**
 * Renderizar gráfico de pizza - Ranking por CAUSA
 */
export function renderChartCausa(data) {
    const ranking = generateRankingCausa(data);
    const ctx = document.getElementById('chartCausa');
    
    if (!ctx) return;

    // Destruir gráfico anterior se existir
    if (chartCausa) {
        chartCausa.destroy();
    }

    const labels = ranking.map(item => item.causa);
    const values = ranking.map(item => item.count);
    
    // Cores ENEL
    const colors = [
        '#003876', '#0066CC', '#0099FF', '#4DB8FF',
        '#80CCFF', '#B3E0FF', '#E6F2FF', '#FFD700',
        '#FFA500', '#FF6B6B'
    ];

    chartCausa = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#FFFFFF',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Top 10 Causas',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    color: '#003876'
                }
            }
        }
    });
}

/**
 * Renderizar gráfico radar - Ranking por ALIMENTADOR
 */
export function renderChartAlimentador(data) {
    const ranking = generateRankingAlimentador(data);
    const ctx = document.getElementById('chartAlimentador');
    
    if (!ctx) return;

    // Destruir gráfico anterior se existir
    if (chartAlimentador) {
        chartAlimentador.destroy();
    }

    const labels = ranking.map(item => item.alimentador);
    const values = ranking.map(item => item.count);

    chartAlimentador = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ocorrências',
                data: values,
                backgroundColor: 'rgba(0, 102, 204, 0.2)',
                borderColor: '#0066CC',
                borderWidth: 2,
                pointBackgroundColor: '#003876',
                pointBorderColor: '#FFFFFF',
                pointHoverBackgroundColor: '#0066CC',
                pointHoverBorderColor: '#FFFFFF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Top 10 Alimentadores',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    color: '#003876'
                }
            }
        }
    });
}

/**
 * Atualizar todos os gráficos
 */
export function updateCharts(data) {
    renderChartCausa(data);
    renderChartAlimentador(data);
}

