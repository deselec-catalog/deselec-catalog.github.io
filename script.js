// ===== VARIABLES GLOBALES =====
let products = [];
let db = null;

// Lista de categorías (las que tú quieras)
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

// ===== FUNCIÓN DE CONEXIÓN FIREBASE =====
async function conectarFirebase() {
    try {
        console.log('🔌 Conectando a Firebase...');
        
        // Verificar que Firebase está cargado
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase no está cargado');
        }

        // Inicializar Firestore
        db = firebase.firestore();
        
        // Autenticación anónima
        await firebase.auth().signInAnonymously();
        console.log('✅ Conectado a Firebase');
        
        document.getElementById('sync-status').innerHTML = '✅ Conectado';
        return true;
    } catch (error) {
        console.error('❌ Error:', error);
        document.getElementById('sync-status').innerHTML = '❌ Error';
        return false;
    }
}

// ===== CARGAR PRODUCTOS =====
async function cargarProductos() {
    try {
        document.getElementById('products-container').innerHTML = '<div class="no-results"><i class="fas fa-spinner fa-spin"></i><h3>Cargando...</h3></div>';
        
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
        mostrarProductos(products);
        actualizarStats(products);
        llenarFiltros();
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('products-container').innerHTML = '<div class="no-results"><i class="fas fa-exclamation-triangle"></i><h3>Error al cargar</h3></div>';
    }
}

// ===== MOSTRAR PRODUCTOS =====
function mostrarProductos(productosAMostrar) {
    const container = document.getElementById('products-container');
    container.innerHTML = '';
    
    if (productosAMostrar.length === 0) {
        container.innerHTML = '<div class="no-results"><i class="fas fa-box-open"></i><h3>No hay productos</h3></div>';
        return;
    }
    
    productosAMostrar.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        let stockClass = 'high-stock';
        let stockTexto = 'Stock alto';
        if (product.stock <= 5) {
            stockClass = 'low-stock';
            stockTexto = '¡STOCK BAJO!';
        } else if (product.stock <= 15) {
            stockClass = 'medium-stock';
            stockTexto = 'Stock medio';
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
                        <span class="stock-amount ${stockClass}">${product.stock} unidades</span>
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

// ===== ACTUALIZAR ESTADÍSTICAS =====
function actualizarStats(productosArray) {
    document.getElementById('total-products').textContent = productosArray.length;
    const totalStock = productosArray.reduce((sum, p) => sum + p.stock, 0);
    document.getElementById('total-items').textContent = totalStock;
    document.getElementById('available-products').textContent = productosArray.filter(p => p.stock > 0).length;
    document.getElementById('low-stock-count').textContent = productosArray.filter(p => p.stock <= 5).length;
    document.getElementById('total-categories').textContent = [...new Set(productosArray.map(p => p.category))].length;
}

// ===== LLENAR FILTROS =====
function llenarFiltros() {
    const catFilter = document.getElementById('category-filter');
    const ubicFilter = document.getElementById('ubicacion-filter');
    
    if (!catFilter || !ubicFilter) return;
    
    // Limpiar filtros
    catFilter.innerHTML = '<option value="todas">Todas las categorías</option>';
    ubicFilter.innerHTML = '<option value="todas">📍 Todas las ubicaciones</option>';
    
    // Agregar categorías desde los productos
    const categoriasUnicas = [...new Set(products.map(p => p.category))].sort();
    categoriasUnicas.forEach(cat => {
        if (cat) {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            catFilter.appendChild(option);
        }
    });
    
    // Agregar ubicaciones
    UBICACIONES.forEach(ubic => {
        const option = document.createElement('option');
        option.value = ubic.id;
        option.textContent = ubic.nombre;
        ubicFilter.appendChild(option);
    });
}

// ===== FILTRAR PRODUCTOS =====
function filtrarProductos() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const categoria = document.getElementById('category-filter').value;
    const ubicacion = document.getElementById('ubicacion-filter').value;
    const stockFilter = document.getElementById('stock-filter').value;
    
    const filtrados = products.filter(p => {
        // Búsqueda
        const matchesSearch = searchTerm === '' || 
            p.name.toLowerCase().includes(searchTerm) || 
            (p.description && p.description.toLowerCase().includes(searchTerm));
        
        // Categoría
        const matchesCategoria = categoria === 'todas' || p.category === categoria;
        
        // Ubicación
        const matchesUbicacion = ubicacion === 'todas' || p.ubicacion === ubicacion;
        
        // Stock
        let matchesStock = true;
        if (stockFilter === 'low') matchesStock = p.stock <= 5;
        if (stockFilter === 'medium') matchesStock = p.stock > 5 && p.stock <= 15;
        if (stockFilter === 'high') matchesStock = p.stock > 15;
        
        return matchesSearch && matchesCategoria && matchesUbicacion && matchesStock;
    });
    
    mostrarProductos(filtrados);
    actualizarStats(filtrados);
}

// ===== AJUSTAR STOCK =====
window.ajustarStock = async function(id, cambio) {
    const producto = products.find(p => p.id == id);
    if (!producto) return;
    
    const nuevoStock = Math.max(0, producto.stock + cambio);
    producto.stock = nuevoStock;
    
    try {
        await db.collection('productos').doc(id.toString()).update({
            stock: nuevoStock
        });
        mostrarProductos(products);
        actualizarStats(products);
        mostrarNotificacion('✅ Stock actualizado');
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error al actualizar', 'error');
    }
}

// ===== ELIMINAR PRODUCTO =====
window.eliminarProducto = async function(id) {
    if (!confirm('¿Eliminar producto?')) return;
    
    try {
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

// ===== MODAL AGREGAR PRODUCTO =====
function mostrarModalAgregar() {
    const modal = document.createElement('div');
    modal.id = 'modal-agregar';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
        z-index: 1000;
    `;
    
    const categoriasOptions = CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('');
    const ubicacionesOptions = UBICACIONES.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('');
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; width: 90%; max-width: 500px;">
            <h3 style="margin-top: 0;">➕ Agregar Producto</h3>
            <form id="form-agregar">
                <div style="margin-bottom: 15px;">
                    <label>ID:</label>
                    <input type="number" id="nuevo-id" required style="width: 100%; padding: 8px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label>Nombre:</label>
                    <input type="text" id="nuevo-nombre" required style="width: 100%; padding: 8px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label>Categoría:</label>
                    <select id="nuevo-categoria" required style="width: 100%; padding: 8px;">
                        ${categoriasOptions}
                    </select>
                </div>
                <div style="margin-bottom: 15px;">
                    <label>Ubicación:</label>
                    <select id="nuevo-ubicacion" required style="width: 100%; padding: 8px;">
                        ${ubicacionesOptions}
                    </select>
                </div>
                <div style="margin-bottom: 15px;">
                    <label>Descripción:</label>
                    <textarea id="nuevo-descripcion" rows="2" style="width: 100%; padding: 8px;"></textarea>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div>
                        <label>Precio (€):</label>
                        <input type="number" id="nuevo-precio" step="0.01" required style="width: 100%; padding: 8px;">
                    </div>
                    <div>
                        <label>Stock:</label>
                        <input type="number" id="nuevo-stock" required style="width: 100%; padding: 8px;">
                    </div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" onclick="cerrarModal()" style="padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 5px;">Cancelar</button>
                    <button type="submit" style="padding: 10px 20px; background: #2ecc71; color: white; border: none; border-radius: 5px;">Guardar</button>
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

// ===== CERRAR MODAL =====
window.cerrarModal = function() {
    const modal = document.getElementById('modal-agregar');
    if (modal) modal.remove();
}

// ===== GUARDAR PRODUCTO =====
async function guardarProducto() {
    const id = parseInt(document.getElementById('nuevo-id').value);
    
    // Verificar si ya existe
    if (products.some(p => p.id == id)) {
        alert('❌ Ya existe un producto con ese ID');
        return;
    }
    
    const nuevoProducto = {
        id: id,
        name: document.getElementById('nuevo-nombre').value,
        category: document.getElementById('nuevo-categoria').value,
        ubicacion: document.getElementById('nuevo-ubicacion').value,
        description: document.getElementById('nuevo-descripcion').value,
        price: parseFloat(document.getElementById('nuevo-precio').value),
        stock: parseInt(document.getElementById('nuevo-stock').value)
    };
    
    try {
        await db.collection('productos').doc(id.toString()).set(nuevoProducto);
        products.push(nuevoProducto);
        cerrarModal();
        filtrarProductos();
        llenarFiltros();
        mostrarNotificacion('✅ Producto guardado');
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error al guardar', 'error');
    }
}

// ===== NOTIFICACIÓN =====
function mostrarNotificacion(texto, tipo = 'success') {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; 
        background: ${tipo === 'success' ? '#2ecc71' : '#e74c3c'}; 
        color: white; padding: 15px 20px; border-radius: 5px;
        z-index: 1001; animation: slideIn 0.3s;
    `;
    notif.textContent = texto;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

// ===== CONFIGURAR BOTONES =====
function configurarBotones() {
    // Botón sincronizar
    document.getElementById('sync-button').addEventListener('click', async () => {
        await cargarProductos();
    });
    
    // Botón agregar
    document.getElementById('export-button').addEventListener('click', () => {
        mostrarModalAgregar();
    });
    
    // Botón reset filtros
    document.getElementById('reset-filters').addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        document.getElementById('category-filter').value = 'todas';
        document.getElementById('ubicacion-filter').value = 'todas';
        document.getElementById('stock-filter').value = 'all';
        filtrarProductos();
    });
    
    // Inputs de filtro
    document.getElementById('search-input').addEventListener('input', filtrarProductos);
    document.getElementById('category-filter').addEventListener('change', filtrarProductos);
    document.getElementById('ubicacion-filter').addEventListener('change', filtrarProductos);
    document.getElementById('stock-filter').addEventListener('change', filtrarProductos);
}

// ===== INICIAR =====
async function iniciar() {
    console.log('🚀 Iniciando...');
    
    const conectado = await conectarFirebase();
    
    if (conectado) {
        await cargarProductos();
        configurarBotones();
    }
}

// Crear filtro de ubicaciones si no existe
function crearFiltroUbicaciones() {
    if (document.getElementById('ubicacion-filter')) return;
    
    const filterGroup = document.querySelector('.filter-group');
    if (!filterGroup) return;
    
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

// Crear filtro al inicio
crearFiltroUbicaciones();

// Iniciar cuando cargue la página
document.addEventListener('DOMContentLoaded', iniciar);