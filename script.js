// ===== CONFIGURACIÓN =====
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz0Z8um8ItluuGL166574BIVHIeqQT1b60uflscRV1pji6nlo812SGnUR_Pbw-C2Zhd_g/exec';
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

// ===== FUNCIONES DE GOOGLE SHEETS =====
async function testConnection() {
    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=test`);
        const data = await response.json();
        return data.status === 'ok';
    } catch (error) {
        console.warn('No hay conexión a Google Sheets, usando modo offline');
        return false;
    }
}

async function fetchProductsFromSheets() {
    try {
        showLoading('Sincronizando con base de datos...');
        
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getProducts`);
        
        if (!response.ok) {
            throw new Error('Error de conexión');
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
            localStorage.setItem('products_cache', JSON.stringify({
                products: data.products,
                timestamp: Date.now()
            }));
            
            updateSyncStatus('success', 'Sincronizado');
            return data.products;
        } else {
            throw new Error(data.message || 'Error desconocido');
        }
    } catch (error) {
        console.warn('Error conectando a Google Sheets:', error);
        updateSyncStatus('error', 'Modo offline');
        return loadFromCache();
    }
}

async function updateStockInSheets(productId, newStock) {
    try {
        const formData = new FormData();
        formData.append('action', 'updateStock');
        formData.append('id', productId);
        formData.append('stock', newStock);
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            updateLocalCache(productId, newStock);
            return true;
        }
    } catch (error) {
        console.warn('Error actualizando Google Sheets, guardando localmente:', error);
        savePendingChange(productId, newStock);
        return false;
    }
    return false;
}

// ===== FUNCIONES DE CACHÉ =====
function loadFromCache() {
    try {
        const cache = localStorage.getItem('products_cache');
        if (cache) {
            const data = JSON.parse(cache);
            const oneHour = 60 * 60 * 1000;
            
            if (Date.now() - data.timestamp < oneHour) {
                updateSyncStatus('warning', 'Usando caché (1h)');
                return data.products;
            }
        }
    } catch (error) {
        console.error('Error cargando caché:', error);
    }
    
    return loadFromLocalJSON();
}

async function loadFromLocalJSON() {
    try {
        showLoading('Cargando desde archivos locales...');
        const productos = await cargarTodosLosProductos();
        updateSyncStatus('warning', 'Modo local (offline)');
        return productos;
    } catch (error) {
        console.error('Error cargando archivos locales:', error);
        return [];
    }
}

function updateLocalCache(productId, newStock) {
    try {
        const cache = localStorage.getItem('products_cache');
        if (cache) {
            const data = JSON.parse(cache);
            const productIndex = data.products.findIndex(p => p.id == productId);
            if (productIndex !== -1) {
                data.products[productIndex].stock = newStock;
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
        const pending = JSON.parse(localStorage.getItem('pending_changes') || '[]');
        pending.push({
            id: productId,
            stock: newStock,
            timestamp: Date.now()
        });
        localStorage.setItem('pending_changes', JSON.stringify(pending));
    } catch (error) {
        console.error('Error guardando cambio pendiente:', error);
    }
}

async function syncPendingChanges() {
    try {
        const pending = JSON.parse(localStorage.getItem('pending_changes') || '[]');
        if (pending.length === 0) return;
        
        showNotification(`Sincronizando ${pending.length} cambios pendientes...`);
        
        for (const change of pending) {
            await updateStockInSheets(change.id, change.stock);
        }
        
        localStorage.removeItem('pending_changes');
        showNotification('Cambios sincronizados correctamente');
    } catch (error) {
        console.error('Error sincronizando cambios:', error);
    }
}

// ===== FUNCIONES DE INTERFAZ BÁSICAS =====
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
                <div class="product-actions">
                    <button class="btn-edit" onclick="editarProducto(${product.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-delete" onclick="eliminarProducto(${product.id})">
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
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex !== -1) {
        const newStock = products[productIndex].stock + change;
        
        if (newStock < 0) {
            alert("El stock no puede ser negativo");
            return;
        }
        
        products[productIndex].stock = newStock;
        filterProducts();
        
        const synced = await updateStockInSheets(productId, newStock);
        const productName = products[productIndex].name;
        
        if (synced) {
            showNotification(`✅ Stock de "${productName}" actualizado a ${newStock} unidades (sincronizado)`);
        } else {
            showNotification(`⚠️ Stock de "${productName}" actualizado a ${newStock} unidades (guardado localmente)`);
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

// ===== FUNCIONES PARA AGREGAR PRODUCTOS =====
function crearInterfazAgregarProducto() {
    const controls = document.querySelector('.controls');
    if (!controls) return;
    
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-success';
    addBtn.id = 'add-product-btn';
    addBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Agregar Producto';
    addBtn.style.marginLeft = '10px';
    
    addBtn.addEventListener('click', () => {
        mostrarModalAgregarProducto();
    });
    
    controls.appendChild(addBtn);
}

function mostrarModalAgregarProducto() {
    // Crear modal
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
        <div style="background: white; padding: 30px; border-radius: 10px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0;"><i class="fas fa-plus-circle"></i> Agregar Nuevo Producto</h3>
                <button onclick="cerrarModalAgregarProducto()" 
                        style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">
                    &times;
                </button>
            </div>
            
            <form id="product-form">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">ID</label>
                        <input type="number" id="product-id" required 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Categoría</label>
                        <select id="product-category" required 
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="">Seleccionar categoría</option>
                        </select>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nombre del Producto</label>
                    <input type="text" id="product-name" required 
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Descripción</label>
                    <textarea id="product-description" rows="3"
                              style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Precio (€)</label>
                        <input type="number" id="product-price" step="0.01" required 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Stock Inicial</label>
                        <input type="number" id="product-stock" required 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">SKU (opcional)</label>
                        <input type="text" id="product-sku" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" onclick="cerrarModalAgregarProducto()" 
                            style="padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Cancelar
                    </button>
                    <button type="submit" 
                            style="padding: 10px 20px; background: #2ecc71; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        <i class="fas fa-save"></i> Guardar Producto
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Poblar categorías
    poblarCategoriasEnModal();
    
    // Manejar envío
    document.getElementById('product-form').addEventListener('submit', (e) => {
        e.preventDefault();
        guardarNuevoProducto();
    });
}

function cerrarModalAgregarProducto() {
    const modal = document.getElementById('add-product-modal');
    if (modal) {
        modal.remove();
    }
}

function poblarCategoriasEnModal() {
    const select = document.getElementById('product-category');
    const categorias = obtenerListaCategorias();
    
    categorias.forEach(categoriaKey => {
        const config = obtenerConfigCategoria(categoriaKey);
        const option = document.createElement('option');
        option.value = categoriaKey;
        option.textContent = config.nombre;
        select.appendChild(option);
    });
}

function guardarNuevoProducto() {
    try {
        const nuevoProducto = {
            id: parseInt(document.getElementById('product-id').value),
            name: document.getElementById('product-name').value,
            category: document.getElementById('product-category').value,
            description: document.getElementById('product-description').value,
            price: parseFloat(document.getElementById('product-price').value),
            stock: parseInt(document.getElementById('product-stock').value),
            sku: document.getElementById('product-sku').value || ''
        };
        
        // Verificar ID único
        if (products.some(p => p.id === nuevoProducto.id)) {
            alert(`❌ Ya existe un producto con el ID ${nuevoProducto.id}`);
            return;
        }
        
        // Agregar producto
        products.push(nuevoProducto);
        
        // Actualizar caché
        const cache = localStorage.getItem('products_cache');
        if (cache) {
            const data = JSON.parse(cache);
            data.products.push(nuevoProducto);
            data.timestamp = Date.now();
            localStorage.setItem('products_cache', JSON.stringify(data));
        }
        
        // Actualizar interfaz
        filteredProducts = [...products];
        renderProducts(filteredProducts);
        updateStats();
        
        // Cerrar modal y mostrar notificación
        cerrarModalAgregarProducto();
        showNotification(`✅ Producto "${nuevoProducto.name}" agregado correctamente`, 'success');
        
    } catch (error) {
        console.error('Error guardando producto:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

// ===== FUNCIONES DE EDICIÓN Y ELIMINACIÓN =====
function editarProducto(productId) {
    const producto = products.find(p => p.id === productId);
    if (!producto) return;
    
    mostrarModalEditarProducto(producto);
}

function mostrarModalEditarProducto(producto) {
    const modal = document.createElement('div');
    modal.id = 'edit-product-modal';
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
                <h3 style="margin: 0;"><i class="fas fa-edit"></i> Editar Producto</h3>
                <button onclick="cerrarModalEditarProducto()" 
                        style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">
                    &times;
                </button>
            </div>
            
            <form id="edit-product-form">
                <input type="hidden" id="edit-product-id" value="${producto.id}">
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nombre del Producto</label>
                    <input type="text" id="edit-product-name" value="${producto.name}" required 
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Categoría</label>
                    <select id="edit-product-category" required 
                            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Descripción</label>
                    <textarea id="edit-product-description" rows="3"
                              style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">${producto.description}</textarea>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Precio (€)</label>
                        <input type="number" id="edit-product-price" value="${producto.price}" step="0.01" required 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Stock</label>
                        <input type="number" id="edit-product-stock" value="${producto.stock}" required 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" onclick="cerrarModalEditarProducto()" 
                            style="padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Cancelar
                    </button>
                    <button type="submit" 
                            style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        <i class="fas fa-save"></i> Guardar Cambios
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Poblar categorías
    poblarCategoriasEnModalEdicion(producto.category);
    
    // Manejar envío
    document.getElementById('edit-product-form').addEventListener('submit', (e) => {
        e.preventDefault();
        guardarCambiosProducto();
    });
}

function poblarCategoriasEnModalEdicion(categoriaActual) {
    const select = document.getElementById('edit-product-category');
    const categorias = obtenerListaCategorias();
    
    categorias.forEach(categoriaKey => {
        const config = obtenerConfigCategoria(categoriaKey);
        const option = document.createElement('option');
        option.value = categoriaKey;
        option.textContent = config.nombre;
        if (categoriaKey === categoriaActual) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

function cerrarModalEditarProducto() {
    const modal = document.getElementById('edit-product-modal');
    if (modal) {
        modal.remove();
    }
}

function guardarCambiosProducto() {
    try {
        const productoId = parseInt(document.getElementById('edit-product-id').value);
        const productIndex = products.findIndex(p => p.id === productoId);
        
        if (productIndex === -1) return;
        
        // Actualizar producto
        products[productIndex] = {
            ...products[productIndex],
            name: document.getElementById('edit-product-name').value,
            category: document.getElementById('edit-product-category').value,
            description: document.getElementById('edit-product-description').value,
            price: parseFloat(document.getElementById('edit-product-price').value),
            stock: parseInt(document.getElementById('edit-product-stock').value)
        };
        
        // Actualizar caché
        const cache = localStorage.getItem('products_cache');
        if (cache) {
            const data = JSON.parse(cache);
            const cacheIndex = data.products.findIndex(p => p.id === productoId);
            if (cacheIndex !== -1) {
                data.products[cacheIndex] = products[productIndex];
                data.timestamp = Date.now();
                localStorage.setItem('products_cache', JSON.stringify(data));
            }
        }
        
        // Actualizar interfaz
        filteredProducts = [...products];
        renderProducts(filteredProducts);
        updateStats();
        
        // Cerrar modal
        cerrarModalEditarProducto();
        showNotification(`✅ Producto actualizado correctamente`, 'success');
        
    } catch (error) {
        console.error('Error actualizando producto:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

function eliminarProducto(productId) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    
    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex === -1) return;
    
    const productName = products[productIndex].name;
    
    // Eliminar de array
    products.splice(productIndex, 1);
    
    // Actualizar caché
    const cache = localStorage.getItem('products_cache');
    if (cache) {
        const data = JSON.parse(cache);
        const cacheIndex = data.products.findIndex(p => p.id === productId);
        if (cacheIndex !== -1) {
            data.products.splice(cacheIndex, 1);
            data.timestamp = Date.now();
            localStorage.setItem('products_cache', JSON.stringify(data));
        }
    }
    
    // Actualizar interfaz
    filteredProducts = [...products];
    renderProducts(filteredProducts);
    updateStats();
    
    showNotification(`✅ Producto "${productName}" eliminado`, 'success');
}

// ===== FUNCIONES DE FILTRO Y CATEGORÍAS =====
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

// ===== FUNCIONES DE EXPORTACIÓN/IMPORTACIÓN =====
function exportToJSON() {
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

function importFromJSON(file) {
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!data.products || !Array.isArray(data.products)) {
                throw new Error('Formato de archivo inválido');
            }
            
            if (confirm(`¿Importar ${data.products.length} productos? Esto sobrescribirá los datos actuales.`)) {
                showLoading('Importando productos...');
                
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
            showNotification(`❌ Error importando: ${error.message}`, 'error');
        }
    };
    
    reader.readAsText(file);
}

// ===== FUNCIONES DE SINCRONIZACIÓN =====
async function manualSync() {
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
        showNotification('❌ Error en sincronización', 'error');
        updateSyncStatus('error', 'Error sincronizando');
    }
}

// ===== INICIALIZACIÓN =====
async function init() {
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
    
    // Configurar modal de backup
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
    
    // Agregar botón para nuevo producto
    crearInterfazAgregarProducto();
    
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
    
    // Sincronizar cambios pendientes en segundo plano
    if (connected) {
        setTimeout(syncPendingChanges, 2000);
    }
    
    // Auto-sincronizar cada 5 minutos
    setInterval(async () => {
        if (navigator.onLine) {
            await manualSync();
        }
    }, 5 * 60 * 1000);
}

// ===== ESTILOS PARA LOS BOTONES DE EDICIÓN =====
const style = document.createElement('style');
style.textContent = `
    .product-actions {
        margin-top: 10px;
        display: flex;
        gap: 8px;
    }
    
    .btn-edit {
        background: #3498db;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: background 0.2s;
    }
    
    .btn-edit:hover {
        background: #2980b9;
    }
    
    .btn-delete {
        background: #e74c3c;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: background 0.2s;
    }
    
    .btn-delete:hover {
        background: #c0392b;
    }
`;
document.head.appendChild(style);

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', init);

// Hacer funciones globales
window.adjustStock = adjustStock;
window.showNotification = showNotification;
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
window.cerrarModalAgregarProducto = cerrarModalAgregarProducto;
window.cerrarModalEditarProducto = cerrarModalEditarProducto;