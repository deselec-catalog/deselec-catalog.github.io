// ===== VARIABLES GLOBALES =====
let products = [];
let filteredProducts = [];
let currentState = {
    search: '',
    category: 'todas',
    stock: 'all'
};

// ===== FUNCIONES DE ESTADO Y PERSISTENCIA =====
function saveCurrentState() {
    localStorage.setItem('stockmaster_state', JSON.stringify({
        search: document.getElementById('search-input')?.value || '',
        category: document.getElementById('category-filter')?.value || 'todas',
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

            // Restaurar valores en los inputs
            const searchInput = document.getElementById('search-input');
            const categoryFilter = document.getElementById('category-filter');
            const stockFilter = document.getElementById('stock-filter');

            if (searchInput) searchInput.value = state.search || '';
            if (categoryFilter) categoryFilter.value = state.category || 'todas';
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
            console.warn('Firebase no está disponible');
            updateSyncStatus('warning', 'Firebase no disponible');
            return false;
        }

        await new Promise((resolve, reject) => {
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    console.log('✅ Usuario autenticado:', user.uid);
                    resolve();
                } else {
                    firebase.auth().signInAnonymously()
                        .then(() => resolve())
                        .catch(error => reject(error));
                }
            });
        });

        updateSyncStatus('success', 'Conectado ✅');
        return true;
    } catch (error) {
        console.error('Error Firebase:', error);
        updateSyncStatus('warning', 'Modo local');
        return false;
    }
}

async function fetchProductsFromFirebase() {
    try {
        showLoading('Cargando desde Firebase...');

        if (typeof db === 'undefined' || !db) {
            throw new Error('Firestore no inicializado');
        }

        // 🔥 SOLUCIÓN: Obtener TODOS los documentos sin ordenar
        const snapshot = await db.collection('productos').get();
        const productos = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            productos.push({
                id: data.id || doc.id,
                name: data.name || '',
                category: data.category || '',
                description: data.description || '',
                price: data.price || 0,
                stock: data.stock || 0,
                sku: data.sku || ''
            });
        });

        // 🔥 Ordenar por ID numérico en JavaScript (NO en Firebase)
        productos.sort((a, b) => {
            const idA = parseInt(a.id) || 0;
            const idB = parseInt(b.id) || 0;
            return idA - idB;
        });

        console.log(`✅ ${productos.length} productos cargados de Firebase`);
        console.log('IDs cargados:', productos.map(p => p.id).slice(0, 10)); // Verificar IDs

        localStorage.setItem('products_cache', JSON.stringify({
            products: productos,
            timestamp: Date.now(),
            fromFirebase: true
        }));

        updateSyncStatus('success', `Conectado (${productos.length} productos)`);
        return productos;
    } catch (error) {
        console.error('Error cargando Firebase:', error);
        updateSyncStatus('error', 'Error cargando datos');

        const cache = localStorage.getItem('products_cache');
        if (cache) {
            try {
                const data = JSON.parse(cache);
                console.log(`📂 Cargando ${data.products.length} productos desde caché`);
                updateSyncStatus('warning', `Caché (${data.products.length} productos)`);
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

        await db.collection('productos').doc(product.id.toString()).set({
            ...product,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`✅ Producto guardado en Firebase: ${product.name}`);
        return true;
    } catch (error) {
        console.error('Error guardando en Firebase:', error);
        return false;
    }
}

async function updateStockInFirebase(productId, newStock) {
    try {
        if (!db) throw new Error('Firestore no inicializado');

        await db.collection('productos').doc(productId.toString()).update({
            stock: newStock,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Stock actualizado en Firebase: ${productId} → ${newStock}`);
        return true;
    } catch (error) {
        console.error('Error actualizando stock en Firebase:', error);
        return false;
    }
}

async function deleteProductFromFirebase(productId) {
    try {
        if (!db) throw new Error('Firestore no inicializado');

        await db.collection('productos').doc(productId.toString()).delete();
        console.log(`✅ Producto eliminado de Firebase: ${productId}`);
        return true;
    } catch (error) {
        console.error('Error eliminando de Firebase:', error);
        return false;
    }
}

// ===== FUNCIONES DE INTERFAZ MEJORADAS =====
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
    syncStatusElement.className = `sync-status sync-${status}`;
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
                <p>${currentState.search || currentState.category !== 'todas' ? 'Intenta con otros filtros' : 'Agrega tu primer producto usando el botón "Agregar Producto"'}</p>
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
    const totalProductsElement = document.getElementById('total-products');
    const totalItemsElement = document.getElementById('total-items');
    const availableProductsElement = document.getElementById('available-products');
    const lowStockCountElement = document.getElementById('low-stock-count');
    const totalCategoriesElement = document.getElementById('total-categories');

    if (!totalProductsElement || !totalItemsElement) return;

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
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const stockFilter = document.getElementById('stock-filter');

    if (!searchInput || !categoryFilter || !stockFilter) return;

    // Guardar estado actual
    currentState = {
        search: searchInput.value,
        category: categoryFilter.value,
        stock: stockFilter.value
    };

    saveCurrentState();

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

// ===== FUNCIÓN PARA AJUSTAR CANTIDAD ESPECÍFICA =====
let currentProductForAdjustment = null;
let adjustmentType = 0; // 1 = aumentar, -1 = reducir

function mostrarModalAjustarCantidad(productId, type) {
    currentProductForAdjustment = productId;
    adjustmentType = type;

    const product = products.find(p => p.id.toString() === productId.toString());
    if (!product) return;

    const modal = document.createElement('div');
    modal.id = 'adjust-quantity-modal';
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
        z-index: 10000;
    `;

    const actionText = type === 1 ? 'Aumentar' : 'Reducir';
    const actionIcon = type === 1 ? 'fa-plus' : 'fa-minus';
    const actionColor = type === 1 ? '#2ecc71' : '#e74c3c';

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; width: 90%; max-width: 400px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: ${actionColor};">
                    <i class="fas ${actionIcon}"></i> ${actionText} Stock
                </h3>
                <button onclick="cerrarModalAjustarCantidad()" 
                        style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">
                    &times;
                </button>
            </div>
            
            <div style="margin-bottom: 20px; text-align: center;">
                <div style="font-size: 16px; margin-bottom: 10px;">
                    <strong>${product.name}</strong>
                </div>
                <div style="color: #666; margin-bottom: 15px;">
                    Stock actual: <span style="font-weight: bold; color: ${product.stock <= 5 ? '#e74c3c' : '#27ae60'}">${product.stock} unidades</span>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 8px; font-weight: bold;">
                    Cantidad a ${actionText.toLowerCase()}:
                </label>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button onclick="cambiarCantidad(-1)" 
                            style="padding: 10px 15px; background: #f1f1f1; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 18px;">
                        -
                    </button>
                    <input type="number" 
                           id="adjust-quantity" 
                           value="1" 
                           min="1" 
                           max="${type === -1 ? product.stock : 999}"
                           style="
                                width: 100%;
                                padding: 10px;
                                border: 2px solid #ddd;
                                border-radius: 4px;
                                font-size: 16px;
                                text-align: center;
                           ">
                    <button onclick="cambiarCantidad(1)" 
                            style="padding: 10px 15px; background: #f1f1f1; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 18px;">
                        +
                    </button>
                </div>
                <div style="margin-top: 5px; font-size: 12px; color: #666;">
                    ${type === -1 ? `Máximo: ${product.stock} unidades (stock actual)` : ''}
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" onclick="cerrarModalAjustarCantidad()" 
                        style="padding: 10px 20px; background: #95a5a6; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Cancelar
                </button>
                <button onclick="aplicarAjusteDeCantidad()" 
                        style="padding: 10px 20px; background: ${actionColor}; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    <i class="fas fa-check"></i> ${actionText}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Configurar botones de cantidad
    const quantityInput = document.getElementById('adjust-quantity');
    quantityInput.focus();
    quantityInput.select();
}

function cerrarModalAjustarCantidad() {
    const modal = document.getElementById('adjust-quantity-modal');
    if (modal) {
        modal.remove();
    }
    currentProductForAdjustment = null;
    adjustmentType = 0;
}

function cambiarCantidad(change) {
    const input = document.getElementById('adjust-quantity');
    if (!input) return;

    let value = parseInt(input.value) || 1;
    value += change;

    if (value < 1) value = 1;

    // Si estamos reduciendo, no permitir más que el stock actual
    if (adjustmentType === -1) {
        const product = products.find(p => p.id.toString() === currentProductForAdjustment.toString());
        if (product && value > product.stock) {
            value = product.stock;
        }
    }

    input.value = value;
}

async function aplicarAjusteDeCantidad() {
    if (!currentProductForAdjustment) return;

    const input = document.getElementById('adjust-quantity');
    if (!input) return;

    const cantidad = parseInt(input.value) || 1;
    const cambioTotal = adjustmentType * cantidad;

    await adjustStock(currentProductForAdjustment, cambioTotal);
    cerrarModalAjustarCantidad();
}

async function adjustStock(productId, change) {
    const productIndex = products.findIndex(p => p.id.toString() === productId.toString());

    if (productIndex !== -1) {
        const newStock = products[productIndex].stock + change;

        if (newStock < 0) {
            alert("El stock no puede ser negativo");
            return;
        }

        const productName = products[productIndex].name;

        try {
            // Actualizar localmente inmediatamente
            products[productIndex].stock = newStock;

            // IMPORTANTE: Actualizar filtros AUTOMÁTICAMENTE
            filterProducts();

            // Intentar sincronizar con Firebase
            showNotification(`🔄 Actualizando "${productName}"...`, 'warning');
            const synced = await updateStockInFirebase(productId, newStock);

            if (synced) {
                showNotification(`✅ "${productName}" actualizado a ${newStock} unidades`, 'success');

                // Actualizar caché local
                const cache = localStorage.getItem('products_cache');
                if (cache) {
                    const data = JSON.parse(cache);
                    const cacheIndex = data.products.findIndex(p => p.id.toString() === productId.toString());
                    if (cacheIndex !== -1) {
                        data.products[cacheIndex].stock = newStock;
                        data.timestamp = Date.now();
                        localStorage.setItem('products_cache', JSON.stringify(data));
                    }
                }
            } else {
                showNotification(`⚠️ "${productName}" - Error al guardar`, 'error');
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
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
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
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                               placeholder="Ej: 1001">
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
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                           placeholder="Ej: Cinta Aislante Negra">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Descripción</label>
                    <textarea id="product-description" rows="3"
                              style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                              placeholder="Descripción del producto..."></textarea>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Precio (€)</label>
                        <input type="number" id="product-price" step="0.01" required 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                               placeholder="1.50">
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Stock Inicial</label>
                        <input type="number" id="product-stock" required 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                               placeholder="25">
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">SKU (opcional)</label>
                        <input type="text" id="product-sku" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                               placeholder="CTA001">
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

    poblarCategoriasEnModal();

    document.getElementById('product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarNuevoProducto();
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
    if (!select) return;

    const categorias = obtenerListaCategorias();

    categorias.forEach(categoriaKey => {
        const config = obtenerConfigCategoria(categoriaKey);
        const option = document.createElement('option');
        option.value = categoriaKey;
        option.textContent = config.nombre;
        select.appendChild(option);
    });
}

async function guardarNuevoProducto() {
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

        if (products.some(p => p.id === nuevoProducto.id)) {
            alert(`❌ Ya existe un producto con el ID ${nuevoProducto.id}`);
            return;
        }

        showNotification(`🔄 Guardando "${nuevoProducto.name}"...`, 'warning');

        const success = await saveProductToFirebase(nuevoProducto);

        if (success) {
            // Agregar a array local
            products.push(nuevoProducto);

            // IMPORTANTE: Actualizar filtros automáticamente
            filterProducts();

            localStorage.setItem('products_cache', JSON.stringify({
                products: products,
                timestamp: Date.now(),
                fromFirebase: true
            }));

            cerrarModalAgregarProducto();
            showNotification(`✅ Producto "${nuevoProducto.name}" agregado correctamente`, 'success');
        } else {
            showNotification(`❌ Error al guardar producto en Firebase`, 'error');
        }

    } catch (error) {
        console.error('Error guardando producto:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

// ===== FUNCIONES DE EDICIÓN Y ELIMINACIÓN =====
async function editarProducto(productId) {
    const producto = products.find(p => p.id.toString() === productId.toString());
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

    poblarCategoriasEnModalEdicion(producto.category);

    document.getElementById('edit-product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarCambiosProducto();
    });
}

function poblarCategoriasEnModalEdicion(categoriaActual) {
    const select = document.getElementById('edit-product-category');
    if (!select) return;

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

async function guardarCambiosProducto() {
    try {
        const productoId = document.getElementById('edit-product-id').value;
        const productIndex = products.findIndex(p => p.id.toString() === productoId.toString());

        if (productIndex === -1) return;

        const productoActualizado = {
            ...products[productIndex],
            name: document.getElementById('edit-product-name').value,
            category: document.getElementById('edit-product-category').value,
            description: document.getElementById('edit-product-description').value,
            price: parseFloat(document.getElementById('edit-product-price').value),
            stock: parseInt(document.getElementById('edit-product-stock').value)
        };

        showNotification(`🔄 Actualizando "${productoActualizado.name}"...`, 'warning');

        const success = await saveProductToFirebase(productoActualizado);

        if (success) {
            products[productIndex] = productoActualizado;

            // IMPORTANTE: Actualizar filtros automáticamente
            filterProducts();

            localStorage.setItem('products_cache', JSON.stringify({
                products: products,
                timestamp: Date.now(),
                fromFirebase: true
            }));

            cerrarModalEditarProducto();
            showNotification(`✅ Producto actualizado correctamente`, 'success');
        } else {
            showNotification(`❌ Error al actualizar producto`, 'error');
        }

    } catch (error) {
        console.error('Error actualizando producto:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

async function eliminarProducto(productId) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    const productIndex = products.findIndex(p => p.id.toString() === productId.toString());
    if (productIndex === -1) return;

    const productName = products[productIndex].name;

    showNotification(`🔄 Eliminando "${productName}"...`, 'warning');

    const success = await deleteProductFromFirebase(productId);

    if (success) {
        products.splice(productIndex, 1);

        // IMPORTANTE: Actualizar filtros automáticamente
        filterProducts();

        localStorage.setItem('products_cache', JSON.stringify({
            products: products,
            timestamp: Date.now(),
            fromFirebase: true
        }));

        showNotification(`✅ Producto "${productName}" eliminado`, 'success');
    } else {
        showNotification(`❌ Error al eliminar producto`, 'error');
    }
}

// ===== FUNCIONES DE FILTRO Y CATEGORÍAS =====
function poblarFiltroCategorias() {
    const categoryFilter = document.getElementById('category-filter');
    if (!categoryFilter) {
        console.warn('No se encontró el elemento category-filter');
        return;
    }

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

    reader.onload = async function (e) {
        try {
            const data = JSON.parse(e.target.result);

            if (!data.products || !Array.isArray(data.products)) {
                throw new Error('Formato de archivo inválido');
            }

            if (confirm(`¿Importar ${data.products.length} productos a Firebase? Esto sobrescribirá todos los productos existentes.`)) {
                showLoading('Importando productos a Firebase...');

                const success = await importProductsToFirebase(data.products);

                if (success) {
                    products = data.products;
                    filteredProducts = [...products];

                    localStorage.setItem('products_cache', JSON.stringify({
                        products: products,
                        timestamp: Date.now(),
                        fromFirebase: true
                    }));

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

// ===== FUNCIONES DE SINCRONIZACIÓN =====
async function manualSync() {
    updateSyncStatus('syncing', 'Sincronizando...');

    try {
        showNotification('🔄 Actualizando datos desde Firebase...', 'warning');

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

    // Cargar estado guardado (filtros)
    loadSavedState();

    // Poblar filtro de categorías
    poblarFiltroCategorias();

    // Configurar event listeners
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const stockFilter = document.getElementById('stock-filter');
    const resetFiltersBtn = document.getElementById('reset-filters');
    const syncButton = document.getElementById('sync-button');
    const exportButton = document.getElementById('export-button');

    if (searchInput) {
        searchInput.addEventListener('input', filterProducts);
        // Guardar estado mientras se escribe (con debounce)
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(saveCurrentState, 500);
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterProducts);
        categoryFilter.addEventListener('change', saveCurrentState);
    }

    if (stockFilter) {
        stockFilter.addEventListener('change', filterProducts);
        stockFilter.addEventListener('change', saveCurrentState);
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (categoryFilter) categoryFilter.value = 'todas';
            if (stockFilter) stockFilter.value = 'all';
            filterProducts();
            saveCurrentState();
            showNotification('Filtros restablecidos');
        });
    }

    if (syncButton) syncButton.addEventListener('click', manualSync);

    if (exportButton) {
        exportButton.addEventListener('click', () => {
            const modal = document.getElementById('backup-modal');
            if (modal) modal.style.display = 'block';
        });
    }

    // Configurar modal de backup
    const modal = document.getElementById('backup-modal');
    if (modal) {
        const closeBtn = modal.querySelector('.close-modal');
        const exportBtn = document.getElementById('export-json');
        const importBtn = document.getElementById('import-json');
        const importFile = document.getElementById('import-file');

        if (closeBtn) closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        if (exportBtn) exportBtn.addEventListener('click', exportToJSON);

        if (importBtn) {
            importBtn.addEventListener('click', () => {
                if (importFile) importFile.click();
            });
        }

        if (importFile) {
            importFile.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    importFromJSON(e.target.files[0]);
                    modal.style.display = 'none';
                }
            });
        }
    }

    // Agregar botón para nuevo producto
    crearInterfazAgregarProducto();

    // Inicializar Firebase y cargar productos
    updateSyncStatus('syncing', 'Conectando a Firebase...');
    const firebaseConnected = await initFirebase();

    if (firebaseConnected) {
        products = await fetchProductsFromFirebase();
    } else {
        products = [];
        updateSyncStatus('error', 'Sin conexión a Firebase');
    }

    filteredProducts = [...products];
    renderProducts(filteredProducts);
    updateStats();

    // Escuchar cambios en tiempo real de Firebase
    if (firebaseConnected && db) {
        db.collection('productos').onSnapshot((snapshot) => {
            console.log('📡 Cambio detectado en Firebase');
            fetchProductsFromFirebase().then(freshProducts => {
                if (freshProducts) {
                    products = freshProducts;
                    filteredProducts = [...products];
                    renderProducts(filteredProducts);
                    updateStats();
                }
            });
        });
    }
}

// ===== ESTILOS =====
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
window.mostrarModalAjustarCantidad = mostrarModalAjustarCantidad;
window.cerrarModalAjustarCantidad = cerrarModalAjustarCantidad;
window.cambiarCantidad = cambiarCantidad;
window.aplicarAjusteDeCantidad = aplicarAjusteDeCantidad;