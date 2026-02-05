// ===== CONFIGURACIÓN GOOGLE SHEETS =====
// REEMPLAZA ESTA URL CON LA TUYA DESPUÉS DE CREAR EL SCRIPT
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxS-t_RFoX8ZnBrfKPnEUzDiEunvkA8tWN6dWSCbz-FMZSK7fEAfAyPcYDH7CY1pfvICg/exec';
const PASSWORD = 'inventario123';

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

let products = [];
let filteredProducts = [];

// ===== FUNCIONES DE CONEXIÓN MEJORADAS =====
async function testConnection() {
    try {
        console.log('🔍 Probando conexión a Google Sheets...');
        
        // Agregar parámetro origin para CORS
        const url = `${GOOGLE_SCRIPT_URL}?action=test&origin=${encodeURIComponent(window.location.origin)}`;
        
        console.log('URL de prueba:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors', // Especificar modo CORS
            cache: 'no-cache'
        });
        
        console.log('Estado respuesta:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Respuesta test:', data);
        
        return data.status === 'ok' || data.status === 'success';
        
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        return false;
    }
}

async function fetchProductsFromSheets() {
    try {
        showLoading('Conectando con Google Sheets...');
        console.log('🔄 Obteniendo productos...');
        
        // Agregar origen y timestamp único
        const url = `${GOOGLE_SCRIPT_URL}?action=getProducts&password=${encodeURIComponent(PASSWORD)}&origin=${encodeURIComponent(window.location.origin)}&_=${Date.now()}`;
        
        console.log('URL GET productos:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
        });
        
        console.log('Estado respuesta:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Datos recibidos:', {
            status: data.status,
            count: data.count || 0,
            hasProducts: !!data.products,
            productsLength: data.products ? data.products.length : 0
        });
        
        if (data.status === 'success' && data.products && Array.isArray(data.products)) {
            console.log(`✅ ${data.products.length} productos recibidos`);
            
            // Guardar en localStorage como caché
            localStorage.setItem('products_cache', JSON.stringify({
                products: data.products,
                timestamp: Date.now(),
                fromSheets: true,
                syncDate: new Date().toISOString()
            }));
            
            updateSyncStatus('success', `Sincronizado (${data.products.length} productos)`);
            return data.products;
        } else {
            throw new Error(data.message || 'Respuesta inválida');
        }
        
    } catch (error) {
        console.error('⚠️ Error obteniendo productos:', error);
        updateSyncStatus('error', 'Modo offline');
        
        // Cargar desde caché
        return loadFromCache();
    }
}

async function updateStockInSheets(productId, newStock) {
    try {
        console.log(`📝 Actualizando stock: ${productId} → ${newStock}`);
        
        // Usar FormData
        const formData = new URLSearchParams();
        formData.append('action', 'updateStock');
        formData.append('id', productId.toString());
        formData.append('stock', newStock.toString());
        formData.append('password', PASSWORD);
        formData.append('origin', window.location.origin);
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: formData,
            mode: 'cors'
        });
        
        const data = await response.json();
        console.log('Respuesta update:', data);
        
        if (data.status === 'success') {
            updateLocalCache(productId, newStock);
            return true;
        } else {
            console.warn('Respuesta de error:', data);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error actualizando:', error);
        savePendingChange(productId, newStock);
        return false;
    }
}

// ===== FUNCIONES DE CACHÉ =====
function loadFromCache() {
    try {
        const cache = localStorage.getItem('products_cache');
        if (cache) {
            const data = JSON.parse(cache);
            const oneDay = 24 * 60 * 60 * 1000;
            
            if (Date.now() - data.timestamp < oneDay) {
                console.log(`📂 Cargando ${data.products.length} productos desde caché`);
                updateSyncStatus('warning', `Caché (${data.products.length} productos)`);
                return data.products;
            }
        }
    } catch (error) {
        console.error('Error cargando caché:', error);
    }
    
    // Si no hay caché, cargar desde archivos JSON locales
    return loadFromLocalJSON();
}

async function loadFromLocalJSON() {
    try {
        showLoading('Cargando datos locales...');
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
        return [];
    }
}

function updateLocalCache(productId, newStock) {
    try {
        const cache = localStorage.getItem('products_cache');
        if (cache) {
            const data = JSON.parse(cache);
            if (data.products) {
                data.products = data.products.map(p => 
                    p.id == productId ? { ...p, stock: newStock } : p
                );
                data.timestamp = Date.now();
                localStorage.setItem('products_cache', JSON.stringify(data));
            }
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
            pending[existingIndex] = { id: productId, stock: newStock, timestamp: Date.now() };
        } else {
            pending.push({ id: productId, stock: newStock, timestamp: Date.now() });
        }
        
        localStorage.setItem('pending_changes', JSON.stringify(pending));
    } catch (error) {
        console.error('Error guardando cambio:', error);
    }
}

// ===== FUNCIONES DE INTERFAZ (SIN CAMBIOS) =====
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
        if (product.stock <= 5) stockClass = 'low-stock';
        else if (product.stock <= 15) stockClass = 'medium-stock';
        
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
                    <button class="btn btn-outline" onclick="adjustStock(${product.id}, -1)">
                        <i class="fas fa-minus"></i> Reducir
                    </button>
                    <button class="btn btn-primary" onclick="adjustStock(${product.id}, 1)">
                        <i class="fas fa-plus"></i> Aumentar
                    </button>
                </div>
            </div>
        `;
        productsContainer.appendChild(productCard);
    });
}

function updateStats() {
    const totalItems = filteredProducts.reduce((sum, p) => sum + p.stock, 0);
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
            product.name.toLowerCase().includes(searchTerm) ||
            product.description.toLowerCase().includes(searchTerm);
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
        const productName = products[productIndex].name;
        
        // Actualizar inmediatamente
        products[productIndex].stock = newStock;
        filterProducts();
        
        // Intentar sincronizar
        showNotification(`🔄 Actualizando "${productName}"...`, 'warning');
        const synced = await updateStockInSheets(productId, newStock);
        
        if (synced) {
            showNotification(`✅ "${productName}" actualizado a ${newStock}`, 'success');
        } else {
            showNotification(`⚠️ "${productName}" guardado localmente`, 'warning');
        }
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#2ecc71'};
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
        setTimeout(() => document.body.removeChild(notification), 300);
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

// ===== INICIALIZACIÓN =====
async function init() {
    console.log('🚀 Iniciando StockMaster...');
    
    poblarFiltroCategorias();
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
    
    syncButton.addEventListener('click', async () => {
        updateSyncStatus('syncing', 'Sincronizando...');
        try {
            await syncPendingChanges();
            const freshProducts = await fetchProductsFromSheets();
            if (freshProducts && freshProducts.length > 0) {
                products = freshProducts;
                filteredProducts = [...products];
                renderProducts(filteredProducts);
                updateStats();
                showNotification('✅ Sincronización completada');
            }
        } catch (error) {
            showNotification('❌ Error sincronizando', 'error');
            updateSyncStatus('error', 'Error sincronizando');
        }
    });
    
    // Configurar modal
    const modal = document.getElementById('backup-modal');
    if (modal) {
        modal.querySelector('.close-modal').addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
        document.getElementById('export-json').addEventListener('click', exportToJSON);
        document.getElementById('import-json').addEventListener('click', () => document.getElementById('import-file').click());
        document.getElementById('import-file').addEventListener('change', (e) => {
            if (e.target.files[0]) importFromJSON(e.target.files[0]);
        });
    }
    
    exportButton.addEventListener('click', () => {
        if (modal) modal.style.display = 'block';
    });
    
    // Cargar productos
    updateSyncStatus('syncing', 'Conectando...');
    const connected = await testConnection();
    
    if (connected) {
        products = await fetchProductsFromSheets();
    } else {
        products = await loadFromLocalJSON();
    }
    
    filteredProducts = [...products];
    renderProducts(filteredProducts);
    updateStats();
    
    // Auto-sincronizar cada 5 minutos si hay conexión
    if (connected) {
        setInterval(async () => {
            if (navigator.onLine) await syncPendingChanges();
        }, 5 * 60 * 1000);
    }
}

async function syncPendingChanges() {
    const pending = JSON.parse(localStorage.getItem('pending_changes') || '[]');
    if (pending.length === 0) return;
    
    console.log(`🔄 Sincronizando ${pending.length} cambios pendientes`);
    for (const change of pending) {
        await updateStockInSheets(change.id, change.stock);
    }
    localStorage.removeItem('pending_changes');
}

function exportToJSON() {
    const data = {
        products: products,
        exportDate: new Date().toISOString(),
        totalProducts: products.length,
        version: '2.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockmaster_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('✅ Backup exportado');
}

function importFromJSON(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.products) throw new Error('Formato inválido');
            
            if (confirm(`¿Importar ${data.products.length} productos?`)) {
                showLoading('Importando...');
                products = data.products;
                filteredProducts = [...products];
                localStorage.setItem('products_cache', JSON.stringify({
                    products: products,
                    timestamp: Date.now()
                }));
                renderProducts(filteredProducts);
                updateStats();
                showNotification(`✅ Importados ${products.length} productos`);
            }
        } catch (error) {
            showNotification(`❌ Error: ${error.message}`, 'error');
        }
    };
    reader.readAsText(file);
}

// Inicializar
document.addEventListener('DOMContentLoaded', init);
window.adjustStock = adjustStock;
window.showNotification = showNotification;