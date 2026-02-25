// ===== CONFIGURACIÓN DE CATEGORÍAS =====
const categoriasConfig = {
    'Cintas': { nombre: 'Cintas', icono: 'fas fa-tape', color: '#797d81' },
    'PVC': { nombre: 'PVC', icono: 'fas fa-tools', color: '#797d81' },
    'Varillas': { nombre: 'Varillas', icono: 'fas fa-tools', color: '#797d81' },
    'Cables': { nombre: 'Cables', icono: 'fas fa-bolt', color: '#f39c12' },
    'Abrazaderas': { nombre: 'Abrazaderas', icono: 'fas fa-link', color: '#e67e22' },
    'Soportes': { nombre: 'Soportes', icono: 'fas fa-bracket', color: '#3498db' },
    'Herramientas': { nombre: 'Herramientas', icono: 'fas fa-wrench', color: '#9b59b6' },
    'Tubería chapa': { nombre: 'Tuberías', icono: 'fas fa-grip-lines', color: '#1abc9c' },
    'Cobre': { nombre: 'Cobre', icono: 'fas fa-copper', color: '#b87333' },
    'Mantenimiento': { nombre: 'Cables Especiales', icono: 'fas fa-bolt', color: '#f1c40f' },
    'Otros': { nombre: 'Otros', icono: 'fas fa-archive', color: '#95a5a6' }
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