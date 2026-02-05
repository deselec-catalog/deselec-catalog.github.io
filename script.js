// ===== CONFIGURACIÓN =====
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzhiMDlk87XPoQ5WYJ2ZQV-KBXDgzjlW1xeUSAHheTqyB7GesGjOsWzxIuaMdmkr344PA/exec';
const PASSWORD = 'inventario123';

// ===== FUNCIONES BÁSICAS =====
async function testConnection() {
    console.log('🔍 Probando conexión...');
    
    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=test`);
        
        console.log('Status:', response.status);
        console.log('OK:', response.ok);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Respuesta:', data);
            
            if (data.status === 'ok' || data.status === 'success') {
                alert('✅ CONECTADO a Google Sheets!\n' + JSON.stringify(data, null, 2));
                return true;
            }
        }
        
        alert('❌ No se pudo conectar. Status: ' + response.status);
        return false;
        
    } catch (error) {
        console.error('Error:', error);
        alert('❌ ERROR de conexión:\n' + error.message);
        return false;
    }
}

async function loadFromGoogleSheets() {
    console.log('📦 Intentando cargar desde Google Sheets...');
    
    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getProducts`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Datos recibidos:', data);
            
            if (data.status === 'success' && data.products) {
                alert(`✅ ${data.products.length} productos cargados de Google Sheets!`);
                console.log('Productos:', data.products);
                return data.products;
            }
        }
        
        console.log('Error en respuesta:', response.status);
        return null;
        
    } catch (error) {
        console.error('Error cargando:', error);
        return null;
    }
}

// ===== INICIALIZACIÓN =====
async function init() {
    console.log('🚀 Iniciando aplicación...');
    
    // Agregar botón de prueba
    const controls = document.querySelector('.controls');
    if (controls) {
        const testBtn = document.createElement('button');
        testBtn.className = 'btn btn-outline';
        testBtn.innerHTML = '<i class="fas fa-plug"></i> Probar Conexión';
        testBtn.onclick = testConnection;
        
        const loadBtn = document.createElement('button');
        loadBtn.className = 'btn btn-primary';
        loadBtn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Cargar de Sheets';
        loadBtn.onclick = async () => {
            const products = await loadFromGoogleSheets();
            if (products) {
                // Guardar en localStorage
                localStorage.setItem('products_cache', JSON.stringify({
                    products: products,
                    timestamp: Date.now()
                }));
                
                // Actualizar interfaz
                alert('✅ Productos guardados en caché local');
            }
        };
        
        controls.appendChild(testBtn);
        controls.appendChild(loadBtn);
    }
    
    // Probar conexión automáticamente
    setTimeout(testConnection, 1000);
}

// Iniciar cuando se cargue la página
document.addEventListener('DOMContentLoaded', init);