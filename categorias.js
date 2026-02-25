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

// ===== FUNCIÓN PARA CARGAR PRODUCTOS DE UNA CATEGORÍA =====
async function cargarProductosPorCategoria(categoriaKey) {
    try {
        const config = categoriasConfig[categoriaKey];
        const response = await fetch(config.archivo);
        if (!response.ok) throw new Error(`Error al cargar ${config.nombre}`);
        
        const productos = await response.json();
        return productos.map(producto => ({
            ...producto,
            category: categoriaKey,
            ubicacion: producto.ubicacion || 'almacen1'
        }));
    } catch (error) {
        console.error('Error cargando productos:', error);
        return [];
    }
}

// ===== FUNCIÓN PARA CARGAR TODOS LOS PRODUCTOS =====
async function cargarTodosLosProductos() {
    let todosProductos = [];
    
    for (const categoriaKey in categoriasConfig) {
        if (categoriasConfig[categoriaKey].archivo) {
            const productosCategoria = await cargarProductosPorCategoria(categoriaKey);
            todosProductos = todosProductos.concat(productosCategoria);
        }
    }
    
    return todosProductos;
}

// ===== FUNCIÓN PARA OBTENER CONFIGURACIÓN DE CATEGORÍA =====
function obtenerConfigCategoria(categoriaKey) {
    return categoriasConfig[categoriaKey] || {
        nombre: categoriaKey,
        icono: 'fas fa-archive',
        color: '#7f8c8d'
    };
}

// ===== FUNCIÓN PARA OBTENER LISTA DE CATEGORÍAS =====
function obtenerListaCategorias() {
    return Object.keys(categoriasConfig);
}