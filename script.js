// ===== VARIABLES GLOBALES =====
let products = [];
let filteredProducts = [];

// Lista de categorías
const CATEGORIAS = [
    'Cintas', 
    'Varillas', 
    'Soportes', 
    'Abrazaderas', 
    'Cables', 
    'Coquillas', 
    'Cobre', 
    'Tuberia chapa', 
    'Mantenimiento',
    'Otros',
    'Electricidad', 
    'Tornilleria',
    'PVC'
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
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK no cargado');
        }

        if (firebase.apps.length === 0) {
            throw new Error('Firebase no inicializado');
        }

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

// ===== MOSTRAR PRODUCTOS CON BOTÓN EDITAR Y ELIMINAR =====
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
                <div style="display: flex; gap: 5px; margin-top: 15px; justify-content: space-between;">
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-outline" onclick="ajustarStock('${product.id}', -1)">-1</button>
                        <button class="btn btn-primary" onclick="ajustarStock('${product.id}', 1)">+1</button>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-edit" onclick="mostrarModalEditar('${product.id}')" style="background: #3498db; color: white; border: none; padding: 8px 12px; border-radius: 5px;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-delete" onclick="eliminarProducto('${product.id}')" style="background: #e74c3c; color: white; border: none; padding: 8px 12px; border-radius: 5px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
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

// ===== AJUSTAR STOCK RÁPIDO =====
window.ajustarStock = async function(id, cambio) {
    const producto = products.find(p => p.id == id);
    if (!producto) return;
    
    const nuevoStock = Math.max(0, producto.stock + cambio);
    
    try {
        const db = firebase.firestore();
        await db.collection('productos').doc(id.toString()).update({
            stock: nuevoStock
        });
        
        producto.stock = nuevoStock;
        filtrarProductos();
        mostrarNotificacion(`✅ Stock ${cambio > 0 ? 'aumentado' : 'reducido'}`);
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error', 'error');
    }
}

// ===== ELIMINAR PRODUCTO =====
window.eliminarProducto = async function(id) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    
    try {
        const db = firebase.firestore();
        await db.collection('productos').doc(id.toString()).delete();
        
        products = products.filter(p => p.id != id);
        filtrarProductos();
        llenarFiltros();
        mostrarNotificacion('✅ Producto eliminado');
        
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error al eliminar', 'error');
    }
}

// ===== MODAL EDITAR PRODUCTO =====
window.mostrarModalEditar = function(id) {
    const producto = products.find(p => p.id == id);
    if (!producto) return;
    
    const modal = document.createElement('div');
    modal.id = 'modal-editar';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center;
        z-index: 2000;
    `;
    
    const categoriasOptions = CATEGORIAS.map(c => {
        const selected = c === producto.category ? 'selected' : '';
        return `<option value="${c}" ${selected}>${c}</option>`;
    }).join('');
    
    const ubicacionesOptions = UBICACIONES.map(u => {
        const selected = u.id === producto.ubicacion ? 'selected' : '';
        return `<option value="${u.id}" ${selected}>${u.nombre}</option>`;
    }).join('');
    
    modal.innerHTML = `
        <div style="background:white; padding:30px; border-radius:10px; width:90%; max-width:500px; max-height:90vh; overflow-y:auto;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3 style="margin:0;"><i class="fas fa-edit"></i> Editar Producto</h3>
                <button onclick="cerrarModalEditar()" style="background:none; border:none; font-size:24px; cursor:pointer;">&times;</button>
            </div>
            
            <form id="form-editar">
                <div style="margin-bottom:15px;">
                    <label style="font-weight:bold;">ID:</label>
                    <input type="number" id="editar-id" value="${producto.id}" readonly style="width:100%; padding:8px; background:#f5f5f5; border:1px solid #ddd; border-radius:4px;">
                </div>
                
                <div style="margin-bottom:15px;">
                    <label style="font-weight:bold;">Nombre:</label>
                    <input type="text" id="editar-nombre" value="${producto.name.replace(/"/g, '&quot;')}" required style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                </div>
                
                <div style="margin-bottom:15px;">
                    <label style="font-weight:bold;">Categoría:</label>
                    <select id="editar-categoria" required style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                        ${categoriasOptions}
                    </select>
                </div>
                
                <div style="margin-bottom:15px;">
                    <label style="font-weight:bold;">Ubicación:</label>
                    <select id="editar-ubicacion" required style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                        ${ubicacionesOptions}
                    </select>
                </div>
                
                <div style="margin-bottom:15px;">
                    <label style="font-weight:bold;">Descripción:</label>
                    <textarea id="editar-descripcion" rows="3" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">${producto.description || ''}</textarea>
                </div>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:20px;">
                    <div>
                        <label style="font-weight:bold;">Precio (€):</label>
                        <input type="number" id="editar-precio" value="${producto.price}" step="0.01" required style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                    </div>
                    <div>
                        <label style="font-weight:bold;">Stock:</label>
                        <input type="number" id="editar-stock" value="${producto.stock}" required style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                    </div>
                </div>
                
                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button type="button" onclick="cerrarModalEditar()" style="padding:10px 20px; background:#e74c3c; color:white; border:none; border-radius:5px; cursor:pointer;">
                        Cancelar
                    </button>
                    <button type="submit" style="padding:10px 20px; background:#2ecc71; color:white; border:none; border-radius:5px; cursor:pointer;">
                        <i class="fas fa-save"></i> Guardar Cambios
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('form-editar').addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarEdicion(id);
    });
}

window.cerrarModalEditar = function() {
    const modal = document.getElementById('modal-editar');
    if (modal) modal.remove();
}

async function guardarEdicion(id) {
    try {
        const productoActualizado = {
            id: parseInt(id),
            name: document.getElementById('editar-nombre').value,
            category: document.getElementById('editar-categoria').value,
            ubicacion: document.getElementById('editar-ubicacion').value,
            description: document.getElementById('editar-descripcion').value,
            price: parseFloat(document.getElementById('editar-precio').value),
            stock: parseInt(document.getElementById('editar-stock').value)
        };
        
        const db = firebase.firestore();
        await db.collection('productos').doc(id.toString()).update(productoActualizado);
        
        const index = products.findIndex(p => p.id == id);
        if (index !== -1) {
            products[index] = productoActualizado;
        }
        
        cerrarModalEditar();
        filtrarProductos();
        llenarFiltros();
        mostrarNotificacion('✅ Producto actualizado');
        
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error al actualizar', 'error');
    }
}

// ===== MODAL AGREGAR PRODUCTO =====
function mostrarModalAgregar() {
    const modal = document.createElement('div');
    modal.id = 'modal-agregar';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center;
        z-index: 2000;
    `;
    
    modal.innerHTML = `
        <div style="background:white; padding:30px; border-radius:10px; width:90%; max-width:500px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3 style="margin:0;"><i class="fas fa-plus-circle"></i> Agregar Producto</h3>
                <button onclick="cerrarModalAgregar()" style="background:none; border:none; font-size:24px; cursor:pointer;">&times;</button>
            </div>
            
            <form id="form-agregar">
                <div style="margin-bottom:15px;">
                    <label style="font-weight:bold;">ID:</label>
                    <input type="number" id="nuevo-id" required style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                </div>
                
                <div style="margin-bottom:15px;">
                    <label style="font-weight:bold;">Nombre:</label>
                    <input type="text" id="nuevo-nombre" required style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                </div>
                
                <div style="margin-bottom:15px;">
                    <label style="font-weight:bold;">Categoría:</label>
                    <select id="nuevo-categoria" required style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                        <option value="">Seleccionar...</option>
                        ${CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                
                <div style="margin-bottom:15px;">
                    <label style="font-weight:bold;">Ubicación:</label>
                    <select id="nuevo-ubicacion" required style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                        <option value="">Seleccionar...</option>
                        ${UBICACIONES.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('')}
                    </select>
                </div>
                
                <div style="margin-bottom:15px;">
                    <label style="font-weight:bold;">Descripción:</label>
                    <textarea id="nuevo-descripcion" rows="2" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;"></textarea>
                </div>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:20px;">
                    <div>
                        <label style="font-weight:bold;">Precio (€):</label>
                        <input type="number" id="nuevo-precio" step="0.01" required style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                    </div>
                    <div>
                        <label style="font-weight:bold;">Stock:</label>
                        <input type="number" id="nuevo-stock" required style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                    </div>
                </div>
                
                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button type="button" onclick="cerrarModalAgregar()" style="padding:10px 20px; background:#e74c3c; color:white; border:none; border-radius:5px;">Cancelar</button>
                    <button type="submit" style="padding:10px 20px; background:#2ecc71; color:white; border:none; border-radius:5px;">Guardar</button>
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

window.cerrarModalAgregar = () => document.getElementById('modal-agregar')?.remove();

async function guardarProducto() {
    const id = parseInt(document.getElementById('nuevo-id').value);
    
    if (products.some(p => p.id == id)) {
        mostrarNotificacion('❌ ID ya existe', 'error');
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
        cerrarModalAgregar();
        llenarFiltros();
        filtrarProductos();
        mostrarNotificacion('✅ Producto guardado');
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error al guardar', 'error');
    }
}

// ===== NOTIFICACIONES =====
function mostrarNotificacion(texto, tipo = 'success') {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; 
        background: ${tipo === 'success' ? '#2ecc71' : '#e74c3c'}; 
        color: white; padding: 15px 20px; border-radius: 8px;
        z-index: 3000; animation: slideIn 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notif.innerHTML = `<i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i> ${texto}`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
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
}

// ===== FILTRAR PRODUCTOS =====
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

// ===== REORGANIZAR CONTROLES =====
function reorganizarControles() {
    const controls = document.querySelector('.controls');
    if (!controls) return;
    
    controls.style.display = 'flex';
    controls.style.justifyContent = 'space-between';
    controls.style.alignItems = 'center';
    controls.style.flexWrap = 'wrap';
    controls.style.gap = '10px';
    
    const rightGroup = document.createElement('div');
    rightGroup.className = 'button-group-right';
    rightGroup.style.display = 'flex';
    rightGroup.style.gap = '10px';
    rightGroup.style.flexWrap = 'wrap';
    
    const buttons = [
        document.getElementById('reset-filters'),
        document.getElementById('sync-button'),
        document.getElementById('export-button')
    ].filter(btn => btn);
    
    buttons.forEach(btn => {
        if (btn && btn.parentNode === controls) {
            controls.removeChild(btn);
            rightGroup.appendChild(btn);
        }
    });
    
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-success';
    addBtn.id = 'add-product-button';
    addBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Agregar Producto';
    addBtn.onclick = () => mostrarModalAgregar();
    rightGroup.appendChild(addBtn);
    
    controls.appendChild(rightGroup);
    
    if (!document.getElementById('ubicacion-filter')) {
        const filterGroup = document.querySelector('.filter-group');
        if (filterGroup) {
            const select = document.createElement('select');
            select.id = 'ubicacion-filter';
            select.className = 'filter-select';
            select.innerHTML = '<option value="todas">📍 Todas las ubicaciones</option>';
            
            UBICACIONES.forEach(ubic => {
                const option = document.createElement('option');
                option.value = ubic.id;
                option.textContent = ubic.nombre;
                select.appendChild(option);
            });
            
            select.addEventListener('change', filtrarProductos);
            
            const stockFilter = document.getElementById('stock-filter');
            if (stockFilter && stockFilter.parentNode) {
                stockFilter.parentNode.insertBefore(select, stockFilter.nextSibling);
            }
        }
    }
}

// ===== CONFIGURAR EVENTOS =====
function configurarEventos() {
    const searchInput = document.getElementById('search-input');
    const catFilter = document.getElementById('category-filter');
    const stockFilter = document.getElementById('stock-filter');
    const resetBtn = document.getElementById('reset-filters');
    const syncBtn = document.getElementById('sync-button');
    
    if (searchInput) searchInput.addEventListener('input', filtrarProductos);
    if (catFilter) catFilter.addEventListener('change', filtrarProductos);
    if (stockFilter) stockFilter.addEventListener('change', filtrarProductos);
    
    const ubicFilter = document.getElementById('ubicacion-filter');
    if (ubicFilter) ubicFilter.addEventListener('change', filtrarProductos);
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (catFilter) catFilter.value = 'todas';
            const ubicFilter = document.getElementById('ubicacion-filter');
            if (ubicFilter) ubicFilter.value = 'todas';
            if (stockFilter) stockFilter.value = 'all';
            filtrarProductos();
            mostrarNotificacion('Filtros restablecidos');
        });
    }
    
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            await cargarProductos();
            mostrarNotificacion('✅ Datos sincronizados');
        });
    }
}

// ===== ESTILOS ADICIONALES =====
const style = document.createElement('style');
style.textContent = `
    .btn-edit {
        background: #3498db;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    }
    .btn-edit:hover {
        background: #2980b9;
    }
    .btn-delete {
        background: #e74c3c;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    }
    .btn-delete:hover {
        background: #c0392b;
    }
    .btn-success {
        background: #2ecc71;
        color: white;
        border: none;
        padding: 8px 15px;
        border-radius: 5px;
        cursor: pointer;
    }
    .btn-success:hover {
        background: #27ae60;
    }
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

// ===== INICIAR =====
async function iniciar() {
    console.log('🚀 Iniciando...');
    
    reorganizarControles();
    
    const conectado = await conectarFirebase();
    
    if (conectado) {
        await cargarProductos();
        configurarEventos();
    } else {
        document.getElementById('sync-status').innerHTML = '❌ Error de conexión';
    }
}

document.addEventListener('DOMContentLoaded', iniciar);