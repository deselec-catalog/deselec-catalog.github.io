// ===== VARIABLES GLOBALES =====
let products = [];
let db = null;

// Lista de categorías
const CATEGORIAS = [
    'Cintas', 'PVC', 'Varillas', 'Cables', 'Abrazaderas', 
    'Soportes', 'Herramientas', 'Tuberías', 'Cobre',
    'Cables Especiales', 'Componentes', 'Accesorios', 'Otros'
];

// Ubicaciones
const UBICACIONES = [
    { id: 'almacen1', nombre: '🏭 Almacén 1' },
    { id: 'almacen2', nombre: '🏢 Almacén 2' },
    { id: 'almacen3', nombre: '🏬 Almacén 3' }
];

// ===== FUNCIÓN DE CONEXIÓN =====
async function conectarFirebase() {
    const statusEl = document.getElementById('sync-status');
    statusEl.innerHTML = '🔄 Conectando...';
    
    try {
        // Verificar Firebase
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase no está cargado');
        }

        // Inicializar Firestore
        db = firebase.firestore();
        
        // Configurar persistencia (opcional)
        db.settings({ 
            cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED 
        });
        
        // Autenticación anónima
        await firebase.auth().signInAnonymously();
        
        console.log('✅ Conectado a Firebase');
        statusEl.innerHTML = '✅ Conectado';
        return true;
        
    } catch (error) {
        console.error('❌ Error:', error);
        
        // Mostrar error específico
        if (error.code === 'auth/invalid-api-key') {
            statusEl.innerHTML = '❌ API Key inválida';
            alert('❌ ERROR: La API Key de Firebase es incorrecta\n\nRevisa firebase-config.js');
        } else if (error.code === 'auth/network-request-failed') {
            statusEl.innerHTML = '❌ Sin internet';
        } else {
            statusEl.innerHTML = '❌ Error';
        }
        
        return false;
    }
}

// ===== CARGAR PRODUCTOS =====
async function cargarProductos() {
    const container = document.getElementById('products-container');
    container.innerHTML = '<div class="no-results"><i class="fas fa-spinner fa-spin"></i><h3>Cargando...</h3></div>';
    
    try {
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
        
        console.log(`📦 ${products.length} productos`);
        mostrarProductos(products);
        actualizarStats(products);
        llenarFiltros();
        
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div class="no-results"><i class="fas fa-exclamation-triangle"></i><h3>Error al cargar</h3></div>';
    }
}

// ===== MOSTRAR PRODUCTOS =====
function mostrarProductos(productosAMostrar) {
    const container = document.getElementById('products-container');
    container.innerHTML = '';
    
    if (productosAMostrar.length === 0) {
        container.innerHTML = '<div class="no-results"><i class="fas fa-box-open"></i><h3>No hay productos</h3><p>Agrega tu primer producto</p></div>';
        return;
    }
    
    productosAMostrar.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        let stockClass = 'high-stock';
        if (product.stock <= 5) stockClass = 'low-stock';
        else if (product.stock <= 15) stockClass = 'medium-stock';
        
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
        await db.collection('productos').doc(id.toString()).update({
            stock: producto.stock
        });
        mostrarProductos(products);
        actualizarStats(products);
    } catch (error) {
        console.error('Error:', error);
        alert('Error al actualizar');
    }
}

// ===== ACTUALIZAR ESTADÍSTICAS =====
function actualizarStats(productosArray) {
    document.getElementById('total-products').textContent = productosArray.length;
    document.getElementById('total-items').textContent = productosArray.reduce((s, p) => s + p.stock, 0);
    document.getElementById('available-products').textContent = productosArray.filter(p => p.stock > 0).length;
    document.getElementById('low-stock-count').textContent = productosArray.filter(p => p.stock <= 5).length;
    document.getElementById('total-categories').textContent = [...new Set(productosArray.map(p => p.category))].length;
}

// ===== LLENAR FILTROS =====
function llenarFiltros() {
    const catFilter = document.getElementById('category-filter');
    const ubicFilter = document.getElementById('ubicacion-filter');
    
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
    
    if (ubicFilter) {
        ubicFilter.innerHTML = '<option value="todas">📍 Todas las ubicaciones</option>';
        UBICACIONES.forEach(ubic => {
            const option = document.createElement('option');
            option.value = ubic.id;
            option.textContent = ubic.nombre;
            ubicFilter.appendChild(option);
        });
    }
}

// ===== FILTRAR =====
function filtrar() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const cat = document.getElementById('category-filter').value;
    const ubic = document.getElementById('ubicacion-filter').value;
    const stock = document.getElementById('stock-filter').value;
    
    const filtrados = products.filter(p => {
        const matchSearch = !search || p.name.toLowerCase().includes(search) || p.description?.toLowerCase().includes(search);
        const matchCat = cat === 'todas' || p.category === cat;
        const matchUbic = ubic === 'todas' || p.ubicacion === ubic;
        
        let matchStock = true;
        if (stock === 'low') matchStock = p.stock <= 5;
        if (stock === 'medium') matchStock = p.stock > 5 && p.stock <= 15;
        if (stock === 'high') matchStock = p.stock > 15;
        
        return matchSearch && matchCat && matchUbic && matchStock;
    });
    
    mostrarProductos(filtrados);
    actualizarStats(filtrados);
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
                    <div><label>Precio:</label><input type="number" id="nuevo-precio" step="0.01" required style="width:100%;padding:8px;"></div>
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
        await db.collection('productos').doc(id.toString()).set(nuevo);
        products.push(nuevo);
        cerrarModal();
        llenarFiltros();
        filtrar();
        alert('✅ Producto guardado');
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al guardar');
    }
}

// ===== INICIAR =====
async function iniciar() {
    // Crear filtro ubicaciones si no existe
    if (!document.getElementById('ubicacion-filter')) {
        const filterGroup = document.querySelector('.filter-group');
        if (filterGroup) {
            const select = document.createElement('select');
            select.id = 'ubicacion-filter';
            select.className = 'filter-select';
            select.style.marginLeft = '10px';
            select.innerHTML = '<option value="todas">📍 Todas las ubicaciones</option>';
            
            const stockFilter = document.getElementById('stock-filter');
            if (stockFilter && stockFilter.parentNode) {
                stockFilter.parentNode.insertBefore(select, stockFilter.nextSibling);
            }
        }
    }
    
    // Configurar eventos
    document.getElementById('search-input').addEventListener('input', filtrar);
    document.getElementById('category-filter').addEventListener('change', filtrar);
    document.getElementById('stock-filter').addEventListener('change', filtrar);
    if (document.getElementById('ubicacion-filter')) {
        document.getElementById('ubicacion-filter').addEventListener('change', filtrar);
    }
    
    document.getElementById('reset-filters').addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        document.getElementById('category-filter').value = 'todas';
        if (document.getElementById('ubicacion-filter')) {
            document.getElementById('ubicacion-filter').value = 'todas';
        }
        document.getElementById('stock-filter').value = 'all';
        filtrar();
    });
    
    document.getElementById('sync-button').addEventListener('click', async () => {
        await cargarProductos();
    });
    
    document.getElementById('export-button').addEventListener('click', () => {
        if (db) {
            mostrarModalAgregar();
        } else {
            alert('❌ Espera a que se conecte Firebase');
        }
    });
    
    // Conectar y cargar
    const conectado = await conectarFirebase();
    if (conectado) {
        await cargarProductos();
    }
}

// Iniciar
document.addEventListener('DOMContentLoaded', iniciar);