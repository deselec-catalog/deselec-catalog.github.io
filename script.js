// ===== CONFIGURACIÓN =====
let products = [];
let filteredProducts = [];

// ===== VARIABLES GLOBALES =====
const productsContainer = document.getElementById('products-container');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const stockFilter = document.getElementById('stock-filter');
const resetFiltersBtn = document.getElementById('reset-filters');
const syncButton = document.getElementById('sync-button');
const exportButton = document.getElementById('export-button');
const totalProductsElement = document.getElementById('total-products');
const totalItemsElement = document.getElementById('total-items');
const availableProductsElement = document.getElementById('available-products');
const lowStockCountElement = document.getElementById('low-stock-count');
const totalCategoriesElement = document.getElementById('total-categories');
const syncStatusElement = document.getElementById('sync-status');

// ===== FUNCIONES FIREBASE =====
async function initFirebase() {
    try {
        updateSyncStatus('syncing', 'Conectando a Firebase...');
        
        // Esperar autenticación
        await new Promise((resolve, reject) => {
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    console.log('✅ Usuario autenticado:', user.uid);
                    resolve();
                } else {
                    reject('No se pudo autenticar');
                }
            });
        });
        
        updateSyncStatus('success', 'Conectado ✅');
        return true;
    } catch (error) {
        console.error('Error Firebase:', error);
        updateSyncStatus('error', 'Modo offline');
        return false;
    }
}

async function fetchProductsFromFirebase() {
    try {
        showLoading('Cargando desde Firebase...');
        
        const snapshot = await db.collection('productos').get();
        const products = [];
        
        snapshot.forEach(doc => {
            products.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log(`✅ ${products.length} productos cargados de Firebase`);
        
        // Guardar en localStorage como caché
        localStorage.setItem('products_cache', JSON.stringify({
            products: products,
            timestamp: Date.now(),
            fromFirebase: true
        }));
        
        return products;
    } catch (error) {
        console.error('Error cargando Firebase:', error);
        return loadFromCache();
    }
}

async function saveProductToFirebase(product) {
    try {
        if (product.id) {
            // Actualizar producto existente
            await db.collection('productos').doc(product.id.toString()).update({
                name: product.name,
                category: product.category,
                description: product.description,
                price: product.price,
                stock: product.stock,
                sku: product.sku,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // Crear nuevo producto
            const docRef = await db.collection('productos').add({
                ...product,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            product.id = docRef.id;
        }
        
        return true;
    } catch (error) {
        console.error('Error guardando en Firebase:', error);
        return false;
    }
}

async function updateStockInFirebase(productId, newStock) {
    try {
        await db.collection('productos').doc(productId.toString()).update({
            stock: newStock,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        updateLocalCache(productId, newStock);
        return true;
    } catch (error) {
        console.error('Error actualizando stock:', error);
        savePendingChange(productId, newStock);
        return false;
    }
}

async function importProductsToFirebase(productsArray) {
    try {
        showLoading('Importando a Firebase...');
        
        const batch = db.batch();
        const productosRef = db.collection('productos');
        
        // Limpiar colección primero
        const snapshot = await productosRef.get();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Agregar nuevos productos
        productsArray.forEach(product => {
            const docRef = productosRef.doc(product.id.toString());
            batch.set(docRef, {
                ...product,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        await batch.commit();
        console.log(`✅ ${productsArray.length} productos importados a Firebase`);
        return true;
    } catch (error) {
        console.error('Error importando a Firebase:', error);
        return false;
    }
}

// ===== FUNCIONES DE CACHÉ =====
function loadFromCache() {
    try {
        const cache = localStorage.getItem('products_cache');
        if (cache) {
            const data = JSON.parse(cache);
            const oneHour = 60 * 60 * 1000;
            
            if (Date.now() - data.timestamp < oneHour) {
                console.log(`📂 Cargando ${data.products.length} productos desde caché`);
                updateSyncStatus('warning', `Caché (${data.products.length} productos)`);
                return data.products;
            }
        }
    } catch (error) {
        console.error('Error cargando caché:', error);
    }
    
    console.log('Cargando desde archivos locales...');
    return loadFromLocalJSON();
}

async function loadFromLocalJSON() {
    try {
        showLoading('Cargando datos locales...');
        
        if (typeof cargarTodosLosProductos !== 'function') {
            throw new Error('Función cargarTodosLosProductos no encontrada');
        }
        
        const productos = await cargarTodosLosProductos();
        console.log(`📦 ${productos.length} productos cargados localmente`);
        
        localStorage.setItem('products_cache', JSON.stringify({
            products: productos,
            timestamp: Date.now(),
            fromLocal: true
        }));
        
        updateSyncStatus('warning', `Modo local (${productos.length} productos)`);
        return productos;
    } catch (error) {
        console.error('Error cargando locales:', error);
        showNotification('Error cargando datos locales', 'error');
        return [];
    }
}

function updateLocalCache(productId, newStock) {
    try {
        const cache = localStorage.getItem('products_cache');
        if (cache) {
            const data = JSON.parse(cache);
            
            data.products = data.products.map(product => {
                if (product.id == productId) {
                    return { ...product, stock: newStock };
                }
                return product;
            });
            
            data.timestamp = Date.now();
            localStorage.setItem('products_cache', JSON.stringify(data));
        }
    } catch (error) {
        console.error('Error actualizando caché:', error);
    }
}

function savePendingChange(productId, newStock) {
    try {
        let pending = JSON.parse(localStorage.getItem('pending_changes') || '[]');
        
        const existingIndex = pending.findIndex(p => p.id == productId);
        if (existingIndex !== -1) {
            pending[existingIndex] = {
                id: productId,
                stock: newStock,
                timestamp: Date.now()
            };
        } else {
            pending.push({
                id: productId,
                stock: newStock,
                timestamp: Date.now()
            });
        }
        
        localStorage.setItem('pending_changes', JSON.stringify(pending));
    } catch (error) {
        console.error('Error guardando cambio pendiente:', error);
    }
}

// ===== FUNCIONES DE INTERFAZ =====
function updateSyncStatus(status, message) {
    if (!syncStatusElement) return;
    
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'syncing': '🔄'
    };
    
    syncStatusElement.innerHTML = `${icons[status] || '🔄'} ${message}`;
    syncStatusElement.className = `sync-status sync-${status}`;
}

function showLoading(message = 'Cargando...') {
    productsContainer.innerHTML = `
        <div class="no-results">
            <i class="fas fa-spinner fa-spin"></i>
            <h3>${message}</h3>
        </div>
    `;
}

function renderProducts(productsArray) {
    productsContainer.innerHTML = '';

    if (productsArray.length === 0) {
        productsContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>No se encontraron productos</h3>
                <p>Intenta con otros términos de búsqueda o ajusta los filtros</p>
            </div>
        `;
        return;
    }

    productsArray.forEach(product => {
        const categoriaConfig = obtenerConfigCategoria(product.category);
        
        let stockClass = 'high-stock';
        if (product.stock <= 5) {
            stockClass = 'low-stock';
        } else if (product.stock <= 15) {
            stockClass = 'medium-stock';
        }

        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-image">
                <i class="${categoriaConfig.icono}"></i>
                <div class="${product.stock <= 5 ? 'stock-low' : 'stock-ok'}">
                    ${product.stock <= 5 ? 'STOCK BAJO' : 'EN STOCK'}
                </div>
            </div>
            <div class="product-info">
                <div class="product-category">${categoriaConfig.nombre}</div>
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description}</p>
            </div>
            
            <div class="product-bottom-bar">
                <div class="price-stock-row">
                    <div class="product-price">€${product.price.toFixed(2)}</div>
                    <div class="product-stock">
                        <span class="stock-amount ${stockClass}">${product.stock} unidades</span>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-outline" onclick="adjustStock('${product.id}', -1)">
                        <i class="fas fa-minus"></i> Reducir
                    </button>
                    <button class="btn btn-primary" onclick="adjustStock('${product.id}', 1)">
                        <i class="fas fa-plus"></i> Aumentar
                    </button>
                </div>
            </div>
        `;
        productsContainer.appendChild(productCard);
    });
}

function updateStats() {
    const totalItems = filteredProducts.reduce((sum, product) => sum + product.stock, 0);
    const availableProducts = filteredProducts.filter(p => p.stock > 0).length;
    const lowStockCount = filteredProducts.filter(p => p.stock <= 5).length;
    const uniqueCategories = [...new Set(filteredProducts.map(p => p.category))].length;
    
    totalProductsElement.textContent = filteredProducts.length;
    totalItemsElement.textContent = totalItems;
    availableProductsElement.textContent = availableProducts;
    lowStockCountElement.textContent = lowStockCount;
    totalCategoriesElement.textContent = uniqueCategories;
}

function filterProducts() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    const selectedStock = stockFilter.value;

    filteredProducts = products.filter(product => {
        if (!product) return false;
        
        const searchMatch = searchTerm === '' || 
            (product.name && product.name.toLowerCase().includes(searchTerm)) ||
            (product.description && product.description.toLowerCase().includes(searchTerm));
        
        const categoryMatch = selectedCategory === 'todas' || product.category === selectedCategory;
        
        let stockMatch = true;
        if (selectedStock !== 'all') {
            switch (selectedStock) {
                case 'low': stockMatch = product.stock <= 5; break;
                case 'medium': stockMatch = product.stock > 5 && product.stock <= 15; break;
                case 'high': stockMatch = product.stock > 15; break;
            }
        }
        
        return searchMatch && categoryMatch && stockMatch;
    });

    renderProducts(filteredProducts);
    updateStats();
}

async function adjustStock(productId, change) {
    const productIndex = products.findIndex(p => p.id == productId);
    
    if (productIndex !== -1) {
        const newStock = Math.max(0, products[productIndex].stock + change);
        
        if (newStock < 0) {
            alert("El stock no puede ser negativo");
            return;
        }
        
        const productName = products[productIndex].name;
        
        try {
            // Actualizar localmente inmediatamente
            products[productIndex].stock = newStock;
            filterProducts();
            
            // Intentar sincronizar con Firebase
            showNotification(`🔄 Actualizando "${productName}"...`, 'warning');
            const synced = await updateStockInFirebase(productId, newStock);
            
            if (synced) {
                showNotification(`✅ "${productName}" actualizado a ${newStock} unidades`, 'success');
            } else {
                showNotification(`⚠️ "${productName}" guardado localmente`, 'warning');
            }
        } catch (error) {
            console.error('Error ajustando stock:', error);
            showNotification(`❌ Error actualizando stock`, 'error');
        }
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: ${type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#2ecc71'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'warning' ? 'exclamation-circle' : 'check-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function poblarFiltroCategorias() {
    const categorias = obtenerListaCategorias();
    
    categorias.forEach(categoriaKey => {
        const config = obtenerConfigCategoria(categoriaKey);
        const option = document.createElement('option');
        option.value = categoriaKey;
        option.textContent = config.nombre;
        categoryFilter.appendChild(option);
    });
}

async function exportToJSON() {
    const data = {
        products: products,
        exportDate: new Date().toISOString(),
        totalProducts: products.length,
        version: '2.0'
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockmaster_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('✅ Backup exportado correctamente');
}

async function importFromJSON(file) {
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!data.products || !Array.isArray(data.products)) {
                throw new Error('Formato de archivo inválido');
            }
            
            if (confirm(`¿Importar ${data.products.length} productos a Firebase? Esto sobrescribirá los datos actuales.`)) {
                showLoading('Importando productos a Firebase...');
                
                const success = await importProductsToFirebase(data.products);
                
                if (success) {
                    // Recargar productos
                    products = await fetchProductsFromFirebase();
                    filteredProducts = [...products];
                    renderProducts(filteredProducts);
                    updateStats();
                    showNotification(`✅ ${data.products.length} productos importados`, 'success');
                } else {
                    showNotification('❌ Error importando a Firebase', 'error');
                }
            }
        } catch (error) {
            showNotification(`❌ Error importando: ${error.message}`, 'error');
        }
    };
    
    reader.readAsText(file);
}

async function manualSync() {
    updateSyncStatus('syncing', 'Sincronizando...');
    
    try {
        // Sincronizar cambios pendientes
        const pending = JSON.parse(localStorage.getItem('pending_changes') || '[]');
        if (pending.length > 0) {
            showNotification(`Sincronizando ${pending.length} cambios pendientes...`, 'warning');
            
            for (const change of pending) {
                await updateStockInFirebase(change.id, change.stock);
            }
            
            localStorage.removeItem('pending_changes');
            showNotification('✅ Cambios sincronizados', 'success');
        }
        
        // Obtener datos actualizados
        const freshProducts = await fetchProductsFromFirebase();
        
        if (freshProducts && freshProducts.length > 0) {
            products = freshProducts;
            filteredProducts = [...products];
            renderProducts(filteredProducts);
            updateStats();
            showNotification('✅ Sincronización completada', 'success');
        }
    } catch (error) {
        showNotification('❌ Error en sincronización', 'error');
        updateSyncStatus('error', 'Error sincronizando');
    }
}

// ===== INICIALIZACIÓN =====
async function init() {
    console.log('🚀 Inicializando StockMaster con Firebase...');
    
    // Poblar filtro de categorías
    poblarFiltroCategorias();
    
    // Configurar event listeners
    searchInput.addEventListener('input', filterProducts);
    categoryFilter.addEventListener('change', filterProducts);
    stockFilter.addEventListener('change', filterProducts);
    
    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        categoryFilter.value = 'todas';
        stockFilter.value = 'all';
        filterProducts();
        showNotification('Filtros restablecidos');
    });
    
    syncButton.addEventListener('click', manualSync);
    
    exportButton.addEventListener('click', () => {
        const modal = document.getElementById('backup-modal');
        if (modal) modal.style.display = 'block';
    });
    
    // Configurar modal
    const modal = document.getElementById('backup-modal');
    if (modal) {
        const closeBtn = modal.querySelector('.close-modal');
        const exportBtn = document.getElementById('export-json');
        const importBtn = document.getElementById('import-json');
        const importFile = document.getElementById('import-file');
        
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        exportBtn.addEventListener('click', exportToJSON);
        
        importBtn.addEventListener('click', () => {
            importFile.click();
        });
        
        importFile.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                importFromJSON(e.target.files[0]);
                modal.style.display = 'none';
            }
        });
    }
    
    // Inicializar Firebase
    updateSyncStatus('syncing', 'Conectando...');
    const connected = await initFirebase();
    
    if (connected) {
        // Cargar desde Firebase
        products = await fetchProductsFromFirebase();
    } else {
        // Modo offline
        products = await loadFromLocalJSON();
    }
    
    filteredProducts = [...products];
    renderProducts(filteredProducts);
    updateStats();
    
    // Auto-sincronizar cada 5 minutos si hay conexión
    setInterval(async () => {
        if (navigator.onLine && connected) {
            await manualSync();
        }
    }, 5 * 60 * 1000);
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', init);

// Hacer funciones globales
window.adjustStock = adjustStock;
window.showNotification = showNotification;