// ===== VARIABLES GLOBALES (SOLO UNA VEZ) =====
let products = [];
let filteredProducts = [];

// Lista de categorías
const CATEGORIAS = [
    'Cintas', 'PVC', 'Varillas', 'Cables', 'Abrazaderas', 
    'Soportes', 'Herramientas', 'Tubería chapa', 'Cobre',
    'Mantenimiento', 'Otros'
];

// Ubicaciones
const UBICACIONES = [
    { id: 'almacen', nombre: '🏭 Almacén' },
    { id: 'cisterna', nombre: '🏢 Cisterna' },
    { id: 'contenedor', nombre: '🏬 Contenedor' }
];

// ===== FUNCIÓN DE CONEXIÓN =====
async function conectarFirebase() {
    const statusEl = document.getElementById('sync-status');
    if (!statusEl) return false;
    
    statusEl.innerHTML = '🔄 Conectando...';
    
    try {
        // Verificar que Firebase está disponible
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK no cargado');
        }

        // Verificar que hay una app inicializada
        if (firebase.apps.length === 0) {
            throw new Error('Firebase no inicializado - revisa firebase-config.js');
        }

        // Verificar Firestore
        const testDb = firebase.firestore();
        
        // Autenticación anónima
        await firebase.auth().signInAnonymously();
        
        console.log('✅ Conectado a Firebase');
        statusEl.innerHTML = '✅ Conectado';
        return true;
        
    } catch (error) {
        console.error('❌ Error:', error);
        statusEl.innerHTML = '❌ Error';
        return false;
    }
}

// ===== CARGAR PRODUCTOS =====
async function cargarProductos() {
    const container = document.getElementById('products-container');
    if (!container) return;
    
    container.innerHTML = '<div class="no-results"><i class="fas fa-spinner fa-spin"></i><h3>Cargando...</h3></div>';
    
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('productos').get();
        
        products = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            products.push({
                id: data.id || doc.id,
                name: data.name || 'Sin nombre',
                category: data.category || 'Otros',
                ubicacion: data.ubicacion || 'almacen1',
                description: data.description || '',
                price: Number(data.price) || 0,
                stock: Number(data.stock) || 0
            });
        });
        
        console.log(`📦 ${products.length} productos cargados`);
        
        // Ordenar por ID
        products.sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));
        
        filteredProducts = [...products];
        mostrarProductos(filteredProducts);
        actualizarStats(filteredProducts);
        llenarFiltros();
        
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div class="no-results"><i class="fas fa-exclamation-triangle"></i><h3>Error al cargar</h3></div>';
    }
}

// ===== MOSTRAR PRODUCTOS =====
function mostrarProductos(productosAMostrar) {
    const container = document.getElementById('products-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (productosAMostrar.length === 0) {
        container.innerHTML = '<div class="no-results"><i class="fas fa-box-open"></i><h3>No hay productos</h3><p>Agrega tu primer producto</p></div>';
        return;
    }
    
    productosAMostrar.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        let stockClass = 'high-stock';
        let stockText = 'Stock alto';
        if (product.stock <= 5) {
            stockClass = 'low-stock';
            stockText = '¡STOCK BAJO!';
        } else if (product.stock <= 15) {
            stockClass = 'medium-stock';
            stockText = 'Stock medio';
        }
        
        const ubicacion = UBICACIONES.find(u => u.id === product.ubicacion)?.nombre || 'Almacén 1';
        
        card.innerHTML = `
            <div class="product-info">
                <div class="product-category">${product.category}</div>
                <div style="font-size: 12px; color: #666; margin: 5px 0;">
                    <i class="fas fa-map-marker-alt"></i> ${ubicacion}
                </div>
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description || 'Sin descripción'}</p>
                <div class="price-stock-row">
                    <div class="product-price">€${product.price.toFixed(2)}</div>
                    <div class="product-stock">
                        <span class="stock-amount ${stockClass}">${product.stock} uds</span>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button class="btn btn-outline" onclick="ajustarStock('${product.id}', -1)">- Reducir</button>
                    <button class="btn btn-primary" onclick="ajustarStock('${product.id}', 1)">+ Aumentar</button>
                    <button class="btn btn-outline" onclick="eliminarProducto('${product.id}')" style="background: #e74c3c; color: white;">🗑️</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ===== AJUSTAR STOCK =====
window.ajustarStock = async function(id, cambio) {
    const producto = products.find(p => p.id == id);
    if (!producto) return;
    
    producto.stock = Math.max(0, producto.stock + cambio);
    
    try {
        const db = firebase.firestore();
        await db.collection('productos').doc(id.toString()).update({
            stock: producto.stock
        });
        filtrarProductos();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al actualizar');
    }
}

// ===== ELIMINAR PRODUCTO =====
window.eliminarProducto = async function(id) {
    if (!confirm('¿Eliminar producto?')) return;
    
    try {
        const db = firebase.firestore();
        await db.collection('productos').doc(id.toString()).delete();
        products = products.filter(p => p.id != id);
        filtrarProductos();
        llenarFiltros();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar');
    }
}

// ===== ACTUALIZAR ESTADÍSTICAS =====
function actualizarStats(productosArray) {
    const el = (id) => document.getElementById(id);
    if (!el('total-products')) return;
    
    el('total-products').textContent = productosArray.length;
    el('total-items').textContent = productosArray.reduce((s, p) => s + p.stock, 0);
    el('available-products').textContent = productosArray.filter(p => p.stock > 0).length;
    el('low-stock-count').textContent = productosArray.filter(p => p.stock <= 5).length;
    el('total-categories').textContent = [...new Set(productosArray.map(p => p.category))].length;
}

// ===== LLENAR FILTROS =====
function llenarFiltros() {
    const catFilter = document.getElementById('category-filter');
    if (catFilter) {
        catFilter.innerHTML = '<option value="todas">Todas las categorías</option>';
        const categorias = [...new Set(products.map(p => p.category))].sort();
        categorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            catFilter.appendChild(option);
        });
    }
    
    // Crear filtro de ubicaciones si no existe
    if (!document.getElementById('ubicacion-filter')) {
        const filterGroup = document.querySelector('.filter-group');
        if (filterGroup) {
            const select = document.createElement('select');
            select.id = 'ubicacion-filter';
            select.className = 'filter-select';
            select.style.marginLeft = '10px';
            select.innerHTML = '<option value="todas">📍 Todas las ubicaciones</option>';
            
            UBICACIONES.forEach(ubic => {
                const option = document.createElement('option');
                option.value = ubic.id;
                option.textContent = ubic.nombre;
                select.appendChild(option);
            });
            
            const stockFilter = document.getElementById('stock-filter');
            if (stockFilter && stockFilter.parentNode) {
                stockFilter.parentNode.insertBefore(select, stockFilter.nextSibling);
            }
        }
    }
}

// ===== FILTRAR =====
function filtrarProductos() {
    const searchInput = document.getElementById('search-input');
    const catFilter = document.getElementById('category-filter');
    const ubicFilter = document.getElementById('ubicacion-filter');
    const stockFilter = document.getElementById('stock-filter');
    
    if (!searchInput || !catFilter || !stockFilter) return;
    
    const search = searchInput.value.toLowerCase();
    const cat = catFilter.value;
    const ubic = ubicFilter ? ubicFilter.value : 'todas';
    const stock = stockFilter.value;
    
    filteredProducts = products.filter(p => {
        const matchSearch = !search || p.name.toLowerCase().includes(search) || (p.description && p.description.toLowerCase().includes(search));
        const matchCat = cat === 'todas' || p.category === cat;
        const matchUbic = ubic === 'todas' || p.ubicacion === ubic;
        
        let matchStock = true;
        if (stock === 'low') matchStock = p.stock <= 5;
        if (stock === 'medium') matchStock = p.stock > 5 && p.stock <= 15;
        if (stock === 'high') matchStock = p.stock > 15;
        
        return matchSearch && matchCat && matchUbic && matchStock;
    });
    
    mostrarProductos(filteredProducts);
    actualizarStats(filteredProducts);
}

// ===== MODAL AGREGAR =====
function mostrarModalAgregar() {
    const modal = document.createElement('div');
    modal.id = 'modal-agregar';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:1000;';
    
    modal.innerHTML = `
        <div style="background:white;padding:30px;border-radius:10px;width:90%;max-width:500px;">
            <h3 style="margin-top:0;">➕ Agregar Producto</h3>
            <form id="form-agregar">
                <div style="margin-bottom:15px;">
                    <label>ID:</label>
                    <input type="number" id="nuevo-id" required style="width:100%;padding:8px;">
                </div>
                <div style="margin-bottom:15px;">
                    <label>Nombre:</label>
                    <input type="text" id="nuevo-nombre" required style="width:100%;padding:8px;">
                </div>
                <div style="margin-bottom:15px;">
                    <label>Categoría:</label>
                    <select id="nuevo-categoria" required style="width:100%;padding:8px;">
                        ${CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <div style="margin-bottom:15px;">
                    <label>Ubicación:</label>
                    <select id="nuevo-ubicacion" required style="width:100%;padding:8px;">
                        ${UBICACIONES.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('')}
                    </select>
                </div>
                <div style="margin-bottom:15px;">
                    <label>Descripción:</label>
                    <textarea id="nuevo-descripcion" rows="2" style="width:100%;padding:8px;"></textarea>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;">
                    <div><label>Precio €:</label><input type="number" id="nuevo-precio" step="0.01" required style="width:100%;padding:8px;"></div>
                    <div><label>Stock:</label><input type="number" id="nuevo-stock" required style="width:100%;padding:8px;"></div>
                </div>
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button type="button" onclick="cerrarModal()" style="padding:10px20px;background:#e74c3c;color:white;border:none;border-radius:5px;">Cancelar</button>
                    <button type="submit" style="padding:10px20px;background:#2ecc71;color:white;border:none;border-radius:5px;">Guardar</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('form-agregar').addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarProducto();
    });
}

window.cerrarModal = () => document.getElementById('modal-agregar')?.remove();

async function guardarProducto() {
    const id = parseInt(document.getElementById('nuevo-id').value);
    
    if (products.some(p => p.id == id)) {
        alert('❌ ID ya existe');
        return;
    }
    
    const nuevo = {
        id: id,
        name: document.getElementById('nuevo-nombre').value,
        category: document.getElementById('nuevo-categoria').value,
        ubicacion: document.getElementById('nuevo-ubicacion').value,
        description: document.getElementById('nuevo-descripcion').value,
        price: parseFloat(document.getElementById('nuevo-precio').value),
        stock: parseInt(document.getElementById('nuevo-stock').value)
    };
    
    try {
        const db = firebase.firestore();
        await db.collection('productos').doc(id.toString()).set(nuevo);
        products.push(nuevo);
        cerrarModal();
        llenarFiltros();
        filtrarProductos();
        alert('✅ Producto guardado');
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al guardar');
    }
}

// ===== CONFIGURAR EVENTOS =====
function configurarEventos() {
    const searchInput = document.getElementById('search-input');
    const catFilter = document.getElementById('category-filter');
    const stockFilter = document.getElementById('stock-filter');
    const resetBtn = document.getElementById('reset-filters');
    const syncBtn = document.getElementById('sync-button');
    const exportBtn = document.getElementById('export-button');
    
    if (searchInput) searchInput.addEventListener('input', filtrarProductos);
    if (catFilter) catFilter.addEventListener('change', filtrarProductos);
    if (stockFilter) stockFilter.addEventListener('change', filtrarProductos);
    
    // Evento para filtro de ubicación (se agregará después)
    setTimeout(() => {
        const ubicFilter = document.getElementById('ubicacion-filter');
        if (ubicFilter) ubicFilter.addEventListener('change', filtrarProductos);
    }, 500);
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (catFilter) catFilter.value = 'todas';
            const ubicFilter = document.getElementById('ubicacion-filter');
            if (ubicFilter) ubicFilter.value = 'todas';
            if (stockFilter) stockFilter.value = 'all';
            filtrarProductos();
        });
    }
    
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            await cargarProductos();
        });
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            try {
                firebase.firestore(); // Verificar que Firebase está listo
                mostrarModalAgregar();
            } catch (e) {
                alert('❌ Firebase no está listo');
            }
        });
    }
}

// ===== INICIAR =====
async function iniciar() {
    console.log('🚀 Iniciando...');
    
    const conectado = await conectarFirebase();
    
    if (conectado) {
        await cargarProductos();
        configurarEventos();
    } else {
        document.getElementById('sync-status').innerHTML = '❌ Error de conexión';
    }
}

// Iniciar cuando cargue la página
document.addEventListener('DOMContentLoaded', iniciar);