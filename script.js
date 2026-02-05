// ===== CONFIGURACIÓN =====
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby9ogLpbeO7bnFCdiyfnhyP-8o4zy5yVA76bDFdpw_StXnXbo6ZVIJWYuOWBAN4E8VqTA/exec';
const PASSWORD = 'inventario123';

// ===== FUNCIONES DE PRUEBA =====
async function testConnection() {
    console.log('🔍 Probando conexión a Google Sheets...');
    
    try {
        // URL directa de prueba
        const testUrl = `${GOOGLE_SCRIPT_URL}?action=test`;
        console.log('URL de prueba:', testUrl);
        
        const response = await fetch(testUrl, {
            method: 'GET',
            mode: 'no-cors' // Esto puede ayudar con problemas CORS
        });
        
        console.log('Estado de respuesta:', response.status);
        console.log('Tipo:', response.type);
        
        // Si estamos en modo 'no-cors', no podemos leer la respuesta
        if (response.type === 'opaque') {
            console.log('✅ Conexión exitosa (pero no podemos leer la respuesta debido a CORS)');
            alert('✅ CONEXIÓN EXITOSA!\n\nEl servidor responde, pero hay restricciones CORS.\nEsto es normal con Google Apps Script.');
            return true;
        }
        
        if (response.ok) {
            const data = await response.json();
            console.log('Respuesta:', data);
            
            if (data.status === 'ok') {
                alert(`✅ CONEXIÓN EXITOSA!\n\nMensaje: ${data.message}\nStatus: ${data.status}`);
                return true;
            }
        }
        
        alert(`❌ Error HTTP: ${response.status} ${response.statusText}`);
        return false;
        
    } catch (error) {
        console.error('Error completo:', error);
        
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            alert('❌ ERROR: No se puede conectar al servidor.\n\nPosibles causas:\n1. La URL es incorrecta\n2. El script no está publicado\n3. Problemas de red\n\nURL usada: ' + GOOGLE_SCRIPT_URL);
        } else {
            alert(`❌ ERROR:\n${error.name}: ${error.message}`);
        }
        
        return false;
    }
}

async function testWithJSONP() {
    console.log('🔄 Probando con JSONP (alternativa a CORS)...');
    
    // JSONP es una técnica antigua para evitar CORS
    return new Promise((resolve) => {
        const callbackName = 'jsonp_callback_' + Date.now();
        
        // Crear script element
        const script = document.createElement('script');
        script.src = `${GOOGLE_SCRIPT_URL}?action=test&callback=${callbackName}`;
        
        // Definir función callback global
        window[callbackName] = function(data) {
            console.log('Respuesta JSONP:', data);
            delete window[callbackName];
            document.body.removeChild(script);
            
            if (data && data.status === 'ok') {
                alert('✅ CONEXIÓN JSONP EXITOSA!');
                resolve(true);
            } else {
                alert('❌ JSONP falló');
                resolve(false);
            }
        };
        
        // Manejar errores
        script.onerror = function() {
            console.error('Error cargando script JSONP');
            delete window[callbackName];
            document.body.removeChild(script);
            alert('❌ JSONP: Error cargando script');
            resolve(false);
        };
        
        // Agregar script al DOM
        document.body.appendChild(script);
        
        // Timeout después de 10 segundos
        setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                document.body.removeChild(script);
                alert('⏰ JSONP: Timeout después de 10 segundos');
                resolve(false);
            }
        }, 10000);
    });
}

async function loadProducts() {
    console.log('📦 Intentando cargar productos...');
    
    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getProducts`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('Estado carga:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Datos recibidos:', data);
            
            if (data.status === 'success' && data.products) {
                alert(`✅ ${data.products.length} productos cargados exitosamente!`);
                
                // Guardar en localStorage
                localStorage.setItem('products_cache', JSON.stringify({
                    products: data.products,
                    timestamp: Date.now(),
                    fromGoogleSheets: true
                }));
                
                return data.products;
            } else {
                alert(`❌ Error en datos: ${data.message}`);
            }
        } else {
            alert(`❌ Error HTTP: ${response.status}`);
        }
    } catch (error) {
        console.error('Error cargando:', error);
        alert(`❌ Error: ${error.message}`);
    }
    
    return null;
}

// ===== FUNCIONES DE INTERFAZ =====
function addTestButtons() {
    const controls = document.querySelector('.controls');
    if (!controls) {
        console.error('No se encontró el elemento .controls');
        return;
    }
    
    console.log('Agregando botones de prueba...');
    
    // Crear contenedor para botones
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '10px';
    buttonContainer.style.padding = '10px';
    buttonContainer.style.backgroundColor = '#f5f5f5';
    buttonContainer.style.borderRadius = '8px';
    buttonContainer.style.border = '1px solid #ddd';
    
    // Título
    const title = document.createElement('h4');
    title.textContent = 'Pruebas de Conexión';
    title.style.marginTop = '0';
    title.style.marginBottom = '10px';
    buttonContainer.appendChild(title);
    
    // Botón de prueba normal
    const testBtn = document.createElement('button');
    testBtn.className = 'btn btn-primary';
    testBtn.innerHTML = '<i class="fas fa-plug"></i> Probar Conexión';
    testBtn.onclick = testConnection;
    testBtn.style.marginRight = '10px';
    testBtn.style.marginBottom = '5px';
    
    // Botón de prueba JSONP
    const jsonpBtn = document.createElement('button');
    jsonpBtn.className = 'btn btn-outline';
    jsonpBtn.innerHTML = '<i class="fas fa-code"></i> Probar JSONP';
    jsonpBtn.onclick = testWithJSONP;
    jsonpBtn.style.marginRight = '10px';
    jsonpBtn.style.marginBottom = '5px';
    
    // Botón para cargar datos
    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn btn-success';
    loadBtn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Cargar Productos';
    loadBtn.onclick = loadProducts;
    loadBtn.style.marginBottom = '5px';
    
    // URL actual
    const urlInfo = document.createElement('div');
    urlInfo.style.marginTop = '10px';
    urlInfo.style.fontSize = '12px';
    urlInfo.style.fontFamily = 'monospace';
    urlInfo.style.padding = '5px';
    urlInfo.style.backgroundColor = '#eee';
    urlInfo.style.borderRadius = '4px';
    urlInfo.textContent = `URL: ${GOOGLE_SCRIPT_URL}`;
    
    // Agregar elementos al contenedor
    buttonContainer.appendChild(testBtn);
    buttonContainer.appendChild(jsonpBtn);
    buttonContainer.appendChild(loadBtn);
    buttonContainer.appendChild(urlInfo);
    
    // Agregar contenedor después de los controles existentes
    controls.parentNode.insertBefore(buttonContainer, controls.nextSibling);
    
    console.log('Botones agregados exitosamente');
}

// ===== INICIALIZACIÓN =====
function init() {
    console.log('🚀 Inicializando página...');
    
    // Agregar botones de prueba
    addTestButtons();
    
    // Probar conexión automáticamente después de 2 segundos
    setTimeout(() => {
        console.log('Probando conexión automáticamente...');
        testConnection();
    }, 2000);
}

// Iniciar cuando se cargue la página
document.addEventListener('DOMContentLoaded', init);

// Hacer funciones disponibles globalmente
window.testConnection = testConnection;
window.testWithJSONP = testWithJSONP;
window.loadProducts = loadProducts;