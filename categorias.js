// ===== CONFIGURACIÓN DE CATEGORÍAS =====
const categoriasConfig = {
    'Cintas': {
        nombre: 'Cintas',
        icono: 'fas fa-tape',
        color: '#797d81'
    },
    'PVC': {
        nombre: 'PVC',
        icono: 'fas fa-tools',
        color: '#797d81'
    },
    'Varillas': {
        nombre: 'Varillas',
        icono: 'fas fa-tools',
        color: '#797d81'
    },
    'Cables': {
        nombre: 'Cables',
        icono: 'fas fa-bolt',
        color: '#f39c12'
    },
    'Abrazaderas': {
        nombre: 'Abrazaderas',
        icono: 'fas fa-link',
        color: '#e67e22'
    },
    'Soportes': {
        nombre: 'Soportes',
        icono: 'fas fa-bracket',
        color: '#3498db'
    },
    'Herramientas': {
        nombre: 'Herramientas',
        icono: 'fas fa-wrench',
        color: '#9b59b6'
    },
    'Tuberías': {
        nombre: 'Tuberías',
        icono: 'fas fa-grip-lines',
        color: '#1abc9c'
    },
    'Cobre': {
        nombre: 'Cobre',
        icono: 'fas fa-copper',
        color: '#b87333'
    },
    'Cables Especiales': {
        nombre: 'Cables Especiales',
        icono: 'fas fa-bolt',
        color: '#f1c40f'
    },
    'Componentes': {
        nombre: 'Componentes',
        icono: 'fas fa-microchip',
        color: '#2ecc71'
    },
    'Accesorios': {
        nombre: 'Accesorios',
        icono: 'fas fa-plug',
        color: '#e74c3c'
    },
    'Otros': {
        nombre: 'Otros',
        icono: 'fas fa-archive',
        color: '#95a5a6'
    }
};

// ===== FUNCIÓN PARA OBTENER CONFIGURACIÓN DE CATEGORÍA =====
function obtenerConfigCategoria(categoriaKey) {
    return categoriasConfig[categoriaKey] || {
        nombre: categoriaKey || 'Sin categoría',
        icono: 'fas fa-archive',
        color: '#7f8c8d'
    };
}

// ===== FUNCIÓN PARA OBTENER LISTA DE CATEGORÍAS =====
function obtenerListaCategorias() {
    return Object.keys(categoriasConfig);
}

// ===== FUNCIÓN PARA CARGAR TODOS LOS PRODUCTOS (AHORA VACÍA) =====
// Esta función ya no es necesaria con Firebase, pero la mantenemos por compatibilidad
async function cargarTodosLosProductos() {
    console.log('📁 Cargando productos locales (obsoleto - usando Firebase)');
    return [];
}