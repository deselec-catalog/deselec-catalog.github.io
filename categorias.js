// Configuración de categorías
const categoriasConfig = {
    'Cintas': {
        nombre: 'Cintas',
        icono: 'fas fa-tools',
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
        icono: 'fas fa-tools',
        color: '#797d81'
    },

    'Abrazaderas': {
        nombre: 'Abrazaderas',
        icono: 'fas fa-tools',
        color: '#797d81'
    },

    'Soportes': {
        nombre: 'Soportes',
        icono: 'fas fa-tools',
        color: '#797d81'
    },

    'Coquillas': {
        nombre: 'Soportes',
        icono: 'fas fa-tools',
        color: '#797d81'
    },

    'Tubería Chapa': {
        nombre: 'Tubería Chapa',
        icono: 'fas fa-tools',
        color: '#797d81'
    },

    'Cobre': {
        nombre: 'Cobre',
        icono: 'fas fa-tools',
        color: '#797d81'
    },

    'Electricidad': {
        nombre: 'Electricidad',
        icono: 'fas fa-tools',
        color: '#797d81'
    },

    'Tornilleria': {
        nombre: 'Tornilleria',
        icono: 'fas fa-tools',
        color: '#797d81'
    },

    'Otros': {
        nombre: 'Otros',
        icono: 'fas fa-tools',
        color: '#797d81'
    },

    'Mantenimiento': {
        nombre: 'Mantenimiento',
        icono: 'fas fa-tools',
        color: '#797d81'
    },
    
};

// Función para cargar productos de una categoría
async function cargarProductosPorCategoria(categoriaKey) {
    try {
        const config = categoriasConfig[categoriaKey];
        const response = await fetch(config.archivo);
        if (!response.ok) throw new Error(`Error al cargar ${config.nombre}`);
        
        const productos = await response.json();
        // Agregar la categoría a cada producto
        return productos.map(producto => ({
            ...producto,
            category: categoriaKey
        }));
    } catch (error) {
        console.error('Error cargando productos:', error);
        return [];
    }
}

// Función para cargar TODOS los productos
async function cargarTodosLosProductos() {
    let todosProductos = [];
    
    for (const categoriaKey in categoriasConfig) {
        const productosCategoria = await cargarProductosPorCategoria(categoriaKey);
        todosProductos = todosProductos.concat(productosCategoria);
    }
    
    return todosProductos;
}

// Función para obtener configuración de categoría
function obtenerConfigCategoria(categoriaKey) {
    return categoriasConfig[categoriaKey] || {
        nombre: categoriaKey,
        icono: 'fas fa-archive',
        color: '#7f8c8d'
    };
}

// Función para obtener lista de categorías para el filtro
function obtenerListaCategorias() {
    return Object.keys(categoriasConfig);
}