// ===== CONFIGURACIÓN DE CATEGORÍAS =====
const categoriasConfig = {
    'Cintas': { nombre: 'Cintas', icono: 'fas fa-tape', color: '#797d81' },
    'Varillas': { nombre: 'Varillas', icono: 'fas fa-tools', color: '#797d81' },
    'Soportes': { nombre: 'Soportes', icono: 'fas fa-tools', color: '#797d81' },
    'Abrazaderas': { nombre: 'Abrazaderas', icono: 'fas fa-bolt', color: '#f39c12' },
    'Cables': { nombre: 'Cables', icono: 'fas fa-link', color: '#e67e22' },
    'Coquillas': { nombre: 'Coquillas', icono: 'fas fa-bracket', color: '#3498db' },
    'Cobre': { nombre: 'Cobre', icono: 'fas fa-wrench', color: '#9b59b6' },
    'Tuberia chapa': { nombre: 'Tuberia chapa', icono: 'fas fa-grip-lines', color: '#1abc9c' },
    'Mantenimiento': { nombre: 'Mantenimiento', icono: 'fas fa-copper', color: '#b87333' },
    'Otros': { nombre: 'Otros', icono: 'fas fa-bolt', color: '#f1c40f' },
    'Electricidad': { nombre: 'Electricidad', icono: 'fas fa-archive', color: '#95a5a6' },
    'Tornilleria': { nombre: 'Tornilleria', icono: 'fas fa-archive', color: '#95a5a6' },
    'PVC': { nombre: 'PVC', icono: 'fas fa-archive', color: '#95a5a6' }
};

function obtenerConfigCategoria(categoriaKey) {
    return categoriasConfig[categoriaKey] || {
        nombre: categoriaKey || 'Sin categoría',
        icono: 'fas fa-archive',
        color: '#7f8c8d'
    };
}

function obtenerListaCategorias() {
    return Object.keys(categoriasConfig);
}