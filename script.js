// ===== VARIABLES GLOBALES =====
let products = [];
let filteredProducts = [];
let currentState = {
    search: '',
    category: 'todas',
    ubicacion: 'todas',
    stock: 'all'
};

// Lista de ubicaciones disponibles
const UBICACIONES = [
    { id: 'almacen1', nombre: '🏭 Almacén 1' },
    { id: 'almacen2', nombre: '🏢 Almacén 2' },
    { id: 'almacen3', nombre: '🏬 Almacén 3' }
];

// Lista de categorías válidas (sincronizada con categorias.js)
const CATEGORIAS_VALIDAS = [
    'Cintas', 'PVC', 'Varillas', 'Cables', 'Abrazaderas', 
    'Soportes', 'Herramientas', 'Tuberías', 'Cobre',
    'Cables Especiales', 'Componentes', 'Accesorios', 'Otros'
];

// ===== FUNCIONES DE ESTADO Y PERSISTENCIA =====
function saveCurrentState() {
    localStorage.setItem('stockmaster_state', JSON.stringify({
        search: document.getElementById('search-input')?.value || '',
        category: document.getElementById('category-filter')?.value || 'todas',
        ubicacion: document.getElementById('ubicacion-filter')?.value || 'todas',
        stock: document.getElementById('stock-filter')?.value || 'all',
        timestamp: Date.now()
    }));
}

function loadSavedState() {
    try {
        const saved = localStorage.getItem('stockmaster_state');
        if (saved) {
            const state = JSON.parse(saved);
            currentState = state;

            const searchInput = document.getElementById('search-input');
            const categoryFilter = document.getElementById('category-filter');
            const ubicacionFilter = document.getElementById('ubicacion-filter');
            const stockFilter = document.getElementById('stock-filter');

            if (searchInput) searchInput.value = state.search || '';
            if (categoryFilter) categoryFilter.value = state.category || 'todas';
            if (ubicacionFilter) ubicacionFilter.value = state.ubicacion || 'todas';
            if (stockFilter) stockFilter.value = state.stock || 'all';

            return true;
        }
    } catch (error) {
        console.error('Error cargando estado:', error);
    }
    return false;
}

// ===== FUNCIONES DE FIREBASE =====
async function initFirebase() {
    try {
        updateSyncStatus('syncing', 'Conectando a Firebase...');

        if (typeof firebase === 'undefined' || !firebase.auth) {
            console.error('❌ Firebase no está disponible');
            updateSyncStatus('error', 'Firebase no disponible');
            return false;
        }

        await firebase.auth().signInAnonymously();
        console.log('✅ Usuario autenticado');
        updateSyncStatus('success', 'Conectado ✅');
        return true;
    } catch (error) {
        console.error('❌ Error Firebase:', error);
        updateSyncStatus('error', 'Error de conexión');
        return false;
    }
}

async function fetchProductsFromFirebase() {
    try {
        showLoading('Cargando desde Firebase...');

        if (typeof db === 'undefined' || !db) {
            throw new Error('Firestore no inicializado');
        }

        const snapshot = await db.collection('productos').get();
        const productos = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // Asegurar que todos los campos existan
            productos.push({
                id: data.id?.toString() || doc.id,
                name: data.name || 'Sin nombre',
                category: data.category || 'Otros',
                ubicacion: data.ubicacion || 'almacen1',
                description: data.description || '',
                price: Number(data.price) || 0,
                stock: Number(data.stock) || 0,
                sku: data.sku || ''
            });
        });

        // Ordenar por ID numérico
        productos.sort((a, b) => {
            const idA = parseInt(a.id) || 0;
            const idB = parseInt(b.id) || 0;
            return idA - idB;
        });

        console.log(`✅ ${productos.length} productos cargados de Firebase`);

        // Guardar en caché
        localStorage.setItem('products_cache', JSON.stringify({
            products: productos,
            timestamp: Date.now()
        }));

        updateSyncStatus('success', `${productos.length} productos`);
        return productos;
    } catch (error) {
        console.error('❌ Error cargando Firebase:', error);
        updateSyncStatus('error', 'Error cargando datos');

        // Intentar cargar desde caché
        const cache = localStorage.getItem('products_cache');
        if (cache) {
            try {
                const data = JSON.parse(cache);
                console.log(`📂 Cargando ${data.products.length} productos desde caché`);
                updateSyncStatus('warning', `Caché (${data.products.length})`);
                return data.products;
            } catch (cacheError) {
                console.error('Error cargando caché:', cacheError);
            }
        }

        return [];
    }
}

async function saveProductToFirebase(product) {
    try {
        if (!db) throw new Error('Firestore no inicializado');

        // Asegurar que todos los campos existan
        const productToSave = {
            id: product.id.toString(),
            name: product.name || 'Sin nombre',
            category: product.category || 'Otros',
            ubicacion: product.ubicacion || 'almacen1',
            description: product.description || '',
            price: Number(product.price) || 0,
            stock: Number(product.stock) || 0,
            sku: product.sku || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('productos').doc(product.id.toString()).set(productToSave, { merge: true });
        console.log(`✅ Producto guardado: ${product.name}`);
        return true;
    } catch (error) {
        console.error('❌ Error guardando:', error);
        return false;
    }
}

async function updateStockInFirebase(productId, newStock) {
    try {
        if (!db) throw new Error('Firestore no inicializado');

        await db.collection('productos').doc(productId.toString()).update({
            stock: Number(newStock),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Stock actualizado: ${productId} → ${newStock}`);
        return true;
    } catch (error) {
        console.error('❌ Error actualizando stock:', error);
        return false;
    }
}

async function deleteProductFromFirebase(productId) {
    try {
        if (!db) throw new Error('Firestore no inicializado');

        await db.collection('productos').doc(productId.toString()).delete();
        console.log(`✅ Producto eliminado: ${productId}`);
        return true;
    } catch (error) {
        console.error('❌ Error eliminando:', error);
        return false;
    }
}

// ===== FUNCIÓN PARA ASIGNAR CATEGORÍA AUTOMÁTICA =====
function asignarCategoriaAutomatica(id) {
    const idNum = parseInt(id);
    
    // Categorías por rango de ID
    if (idNum >= 1001 && idNum <= 1999) return 'Cintas';
    if (idNum >= 2001 && idNum <= 2999) return 'PVC';
    if (idNum >= 3001 && idNum <= 3999) return 'Varillas';
    if (idNum >= 4001 && idNum <= 4999) return 'Cables';
    if (idNum >= 5001 && idNum <= 5999) return 'Abrazaderas';
    if (idNum >= 6001 && idNum <= 6999) return 'Soportes';
    if (idNum >= 7001 && idNum <= 7999) return 'Herramientas';
    if (idNum >= 8001 && idNum <= 8999) return 'Tuberías';
    if (idNum >= 9001 && idNum <= 9999) return 'Cobre';
    
    // Categorías para IDs mayores
    if (idNum >= 10001 && idNum <= 10999) return 'Cables Especiales';
    if (idNum >= 11001 && idNum <= 11999) return 'Componentes';
    if (idNum >= 12001 && idNum <= 12999) return 'Accesorios';
    
    return 'Otros';
}

// ===== FUNCIONES DE INTERFAZ =====
function updateSyncStatus(status, message) {
    const syncStatusElement = document.getElementById('sync-status');
    if (!syncStatusElement) return;

    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'syncing': '🔄'
    };

    syncStatusElement.innerHTML = `${icons[status] || '🔄'} ${message}`;
}

function showLoading(message = 'Cargando...') {
    const productsContainer = document.getElementById('products-container');
    if (!productsContainer) return;

    productsContainer.innerHTML = `
        <div class="no-results">
            <i class="fas fa-spinner fa-spin"></i>
            <h3>${message}</h3>
        </div>
    `;
}

function renderProducts(productsArray) {
    const productsContainer = document.getElementById('products-container');
    if (!productsContainer) return;

    productsContainer.innerHTML = '';

    if (productsArray.length === 0) {
        productsContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>No se encontraron productos</h3>
                <p>${currentState.search || currentState.category !== 'todas' || currentState.ubicacion !== 'todas' ? 'Intenta con otros filtros' : 'Agrega tu primer producto'}</p>
            </div>
        `;
        return;
    }

    productsArray.forEach(product => {
        const categoriaConfig = obtenerConfigCategoria(product.category) || {
            nombre: product.category,
            icono: 'fas fa-box',
            color: '#7f8c8d'
        };
        
        const ubicacionObj = UBICACIONES.find(u => u.id === product.ubicacion) || UBICACIONES[0];

        let stockClass = 'high-stock';
        let stockText = 'Stock alto';
        if (product.stock <= 5) {
            stockClass = 'low-stock';
            stockText = 'Stock bajo';
        } else if (product.stock <= 15) {
            stockClass = 'medium-stock';
            stockText = 'Stock medio';
        }

        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-image">
                <i class="${categoriaConfig.icono}"></i>
                <div class="${product.stock <= 5 ? 'stock-low' : 'stock-ok'}">
                    ${stockText}
                </div>
            </div>
            <div class="product-info">
                <div class="product-category">${categoriaConfig.nombre}</div>
                <div style="display: flex; gap: 5px; align-items: center; margin: 5px 0; font-size: 12px; color: #666;">
                    <i class="fas fa-map-marker-alt" style="color: #3498db;"></i>
                    <span>${ubicacionObj.nombre}</span>
                </div>
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description || 'Sin descripción'}</p>
                <div class="product-actions">
                    <button class="btn-edit" onclick="editarProducto('${product.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-delete" onclick="eliminarProducto('${product.id}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
            <div class="product-bottom-bar">
                <div class="price-stock-row">
                    <div class="product-price">€${product.price.toFixed(2)}</div>
                    <div class="product-stock">
                        <span class="stock-amount ${stockClass}">${product.stock} unidades</span>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-outline" onclick="mostrarModalAjustarCantidad('${product.id}', -1)">
                        <i class="fas fa-minus"></i> Reducir
                    </button>
                    <button class="btn btn-primary" onclick="mostrarModalAjustarCantidad('${product.id}', 1)">
                        <i class="fas fa-plus"></i> Aumentar
                    </button>
                </div>
            </div>
        `;
        productsContainer.appendChild(productCard);
    });
}

function updateStats() {
    const totalProducts = document.getElementById('total-products');
    const totalItems = document.getElementById('total-items');
    const availableProducts = document.getElementById('available-products');
    const lowStockCount = document.getElementById('low-stock-count');
    const totalCategories = document.getElementById('total-categories');

    if (!totalProducts) return;

    const itemsSum = filteredProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
    const available = filteredProducts.filter(p => (p.stock || 0) > 0).length;
    const lowStock = filteredProducts.filter(p => (p.stock || 0) <= 5).length;
    const uniqueCats = [...new Set(filteredProducts.map(p => p.category))].length;

    totalProducts.textContent = filteredProducts.length;
    if (totalItems) totalItems.textContent = itemsSum;
    if (availableProducts) availableProducts.textContent = available;
    if (lowStockCount) lowStockCount.textContent = lowStock;
    if (totalCategories) totalCategories.textContent = uniqueCats;
}

function filterProducts() {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const stockFilter = document.getElementById('stock-filter');
    const ubicacionFilter = document.getElementById('ubicacion-filter');

    if (!searchInput || !categoryFilter || !stockFilter) return;

    currentState = {
        search: searchInput.value,
        category: categoryFilter.value,
        ubicacion: ubicacionFilter?.value || 'todas',
        stock: stockFilter.value
    };

    saveCurrentState();

    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedCategory = categoryFilter.value;
    const selectedUbicacion = ubicacionFilter?.value || 'todas';
    const selectedStock = stockFilter.value;

    filteredProducts = products.filter(product => {
        if (!product) return false;

        const searchMatch = !searchTerm || 
            (product.name && product.name.toLowerCase().includes(searchTerm)) ||
            (product.description && product.description.toLowerCase().includes(searchTerm));

        const categoryMatch = selectedCategory === 'todas' || product.category === selectedCategory;
        const ubicacionMatch = selectedUbicacion === 'todas' || product.ubicacion === selectedUbicacion;

        let stockMatch = true;
        if (selectedStock !== 'all') {
            const stock = product.stock || 0;
            if (selectedStock === 'low') stockMatch = stock <= 5;
            else if (selectedStock === 'medium') stockMatch = stock > 5 && stock <= 15;
            else if (selectedStock === 'high') stockMatch = stock > 15;
        }

        return searchMatch && categoryMatch && ubicacionMatch && stockMatch;
    });

    renderProducts(filteredProducts);
    updateStats();
}

// ===== FUNCIÓN PARA CREAR FILTRO DE UBICACIONES =====
function crearFiltroUbicaciones() {
    const filterGroup = document.querySelector('.filter-group');
    if (!filterGroup) return;
    
    // Verificar si ya existe
    if (document.getElementById('ubicacion-filter')) return;
    
    const ubicacionSelect = document.createElement('select');
    ubicacionSelect.className = 'filter-select';
    ubicacionSelect.id = 'ubicacion-filter';
    ubicacionSelect.style.marginLeft = '10px';
    
    const todasOption = document.createElement('option');
    todasOption.value = 'todas';
    todasOption.textContent = '📍 Todas las ubicaciones';
    ubicacionSelect.appendChild(todasOption);
    
    UBICACIONES.forEach(ubic => {
        const option = document.createElement('option');
        option.value = ubic.id;
        option.textContent = ubic.nombre;
        ubicacionSelect.appendChild(option);
    });
    
    const stockFilter = document.getElementById('stock-filter');
    if (stockFilter && stockFilter.parentNode) {
        stockFilter.parentNode.insertBefore(ubicacionSelect, stockFilter.nextSibling);
    } else {
        filterGroup.appendChild(ubicacionSelect);
    }
    
    ubicacionSelect.addEventListener('change', filterProducts);
    
    return ubicacionSelect;
}

// ===== FUNCIÓN PARA CREAR FILTRO DE CATEGORÍAS =====
function crearFiltroCategorias() {
    const categoryFilter = document.getElementById('category-filter');
    if (!categoryFilter) return;
    
    // Limpiar opciones existentes (excepto la primera)
    while (categoryFilter.options.length > 1) {
        categoryFilter.remove(1);
    }
    
    // Obtener categorías únicas de los productos
    const categoriasUnicas = [...new Set(products.map(p => p.category).filter(Boolean))];
    
    // Ordenar alfabéticamente
    categoriasUnicas.sort();
    
    // Si no hay categorías en productos, usar la lista predefinida
    const categoriasAMostrar = categoriasUnicas.length > 0 ? categoriasUnicas : CATEGORIAS_VALIDAS;
    
    categoriasAMostrar.forEach(cat => {
        if (cat && cat !== 'undefined' && cat !== 'null') {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categoryFilter.appendChild(option);
        }
    });
}

// ===== FUNCIONES DE MODALES =====
function mostrarModalAgregarProducto() {
    const modal = document.createElement('div');
    modal.id = 'add-product-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; width: 90%; max-width: 500px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0;"><i class="fas fa-plus-circle"></i> Agregar Producto</h3>
                <button onclick="cerrarModalAgregarProducto()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            
            <form id="product-form">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">ID</label>
                    <input type="number" id="product-id" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nombre</label>
                    <input type="text" id="product-name" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Descripción</label>
                    <textarea id="product-description" rows="2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Precio (€)</label>
                        <input type="number" id="product-price" step="0.01" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Stock</label>
                        <input type="number" id="product-stock" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Ubicación</label>
                    <select id="product-ubicacion" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        ${UBICACIONES.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('')}
                    </select>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" onclick="cerrarModalAgregarProducto()" style="padding: 8px 16px; background: #e74c3c; color: white; border: none; border-radius: 4px;">Cancelar</button>
                    <button type="submit" style="padding: 8px 16px; background: #2ecc71; color: white; border: none; border-radius: 4px;">Guardar</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarNuevoProducto();
    });
}

function cerrarModalAgregarProducto() {
    const modal = document.getElementById('add-product-modal');
    if (modal) modal.remove();
}

async function guardarNuevoProducto() {
    try {
        const productId = parseInt(document.getElementById('product-id').value);
        
        // Asignar categoría automáticamente
        const categoria = asignarCategoriaAutomatica(productId);
        
        const nuevoProducto = {
            id: productId,
            name: document.getElementById('product-name').value,
            category: categoria,
            description: document.getElementById('product-description').value,
            price: parseFloat(document.getElementById('product-price').value),
            stock: parseInt(document.getElementById('product-stock').value),
            ubicacion: document.getElementById('product-ubicacion').value,
            sku: ''
        };

        if (products.some(p => p.id == productId)) {
            alert('❌ Ya existe un producto con ese ID');
            return;
        }

        const success = await saveProductToFirebase(nuevoProducto);

        if (success) {
            products.push(nuevoProducto);
            crearFiltroCategorias(); // Actualizar filtro de categorías
            filterProducts();
            cerrarModalAgregarProducto();
            showNotification('✅ Producto agregado');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al guardar');
    }
}

// ===== FUNCIONES DE EDICIÓN Y ELIMINACIÓN =====
function editarProducto(productId) {
    const producto = products.find(p => p.id == productId);
    if (!producto) return;
    
    alert('Función de edición en desarrollo');
}

function eliminarProducto(productId) {
    if (!confirm('¿Eliminar producto?')) return;
    
    const index = products.findIndex(p => p.id == productId);
    if (index === -1) return;
    
    const productName = products[index].name;
    products.splice(index, 1);
    
    crearFiltroCategorias(); // Actualizar filtro
    filterProducts();
    showNotification(`✅ "${productName}" eliminado`);
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#2ecc71' : '#e74c3c'};
        color: white;
        padding: 12px 20px;
        border-radius: 5px;
        z-index: 10000;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// ===== FUNCIONES DE AJUSTE DE CANTIDAD =====
function mostrarModalAjustarCantidad(productId, type) {
    const product = products.find(p => p.id == productId);
    if (!product) return;
    
    const cantidad = prompt(`¿Cuántas unidades ${type === 1 ? 'aumentar' : 'reducir'}?`, '1');
    if (cantidad === null) return;
    
    const num = parseInt(cantidad);
    if (isNaN(num) || num < 1) {
        alert('Cantidad inválida');
        return;
    }
    
    const cambio = type === 1 ? num : -num;
    adjustStock(productId, cambio);
}

async function adjustStock(productId, change) {
    const index = products.findIndex(p => p.id == productId);
    if (index === -1) return;
    
    const newStock = Math.max(0, products[index].stock + change);
    products[index].stock = newStock;
    
    filterProducts();
    await updateStockInFirebase(productId, newStock);
    showNotification(`✅ Stock actualizado a ${newStock}`);
}

// ===== INICIALIZACIÓN =====
async function init() {
    console.log('🚀 Iniciando...');

    // Configurar listeners básicos
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const stockFilter = document.getElementById('stock-filter');
    const resetBtn = document.getElementById('reset-filters');
    const syncBtn = document.getElementById('sync-button');
    const addBtn = document.getElementById('add-product-btn');

    if (searchInput) searchInput.addEventListener('input', filterProducts);
    if (categoryFilter) categoryFilter.addEventListener('change', filterProducts);
    if (stockFilter) stockFilter.addEventListener('change', filterProducts);
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (categoryFilter) categoryFilter.value = 'todas';
            const ubicacionFilter = document.getElementById('ubicacion-filter');
            if (ubicacionFilter) ubicacionFilter.value = 'todas';
            if (stockFilter) stockFilter.value = 'all';
            filterProducts();
        });
    }

    // Crear filtro de ubicaciones
    crearFiltroUbicaciones();

    // Botón agregar producto (si no existe)
    if (!addBtn) {
        const controls = document.querySelector('.controls');
        if (controls) {
            const newBtn = document.createElement('button');
            newBtn.className = 'btn btn-success';
            newBtn.id = 'add-product-btn';
            newBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Agregar Producto';
            newBtn.onclick = () => mostrarModalAgregarProducto();
            controls.appendChild(newBtn);
        }
    }

    // Conectar a Firebase y cargar productos
    const connected = await initFirebase();
    
    if (connected) {
        products = await fetchProductsFromFirebase();
    } else {
        products = [];
    }

    // Crear filtro de categorías basado en productos
    crearFiltroCategorias();
    
    // Cargar estado guardado
    loadSavedState();
    
    // Mostrar productos
    filteredProducts = [...products];
    renderProducts(filteredProducts);
    updateStats();
}

// Iniciar
document.addEventListener('DOMContentLoaded', init);

// Hacer funciones globales
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
window.mostrarModalAjustarCantidad = mostrarModalAjustarCantidad;
window.cerrarModalAgregarProducto = cerrarModalAgregarProducto;