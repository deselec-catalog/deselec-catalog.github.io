// ===== CONFIGURACIÓN =====
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxjS2V01X_JwsoFaauYZm8GI5LpIsRw_BlcoZR4eJDK9tLRocC4qk0Ay-jg1LHpoegNuA/exec';

// ===== FUNCIÓN DE PRUEBA =====
async function testGoogleScript() {
    console.log('🔍 Probando Google Apps Script...');
    
    // Mostrar mensaje de carga
    const statusElement = document.getElementById('sync-status');
    if (statusElement) {
        statusElement.innerHTML = '🔄 Probando conexión...';
    }
    
    try {
        // URL de prueba
        const testUrl = `${GOOGLE_SCRIPT_URL}?action=test&_=${Date.now()}`;
        console.log('URL de prueba:', testUrl);
        
        // Hacer la petición
        const response = await fetch(testUrl);
        console.log('Estado:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Respuesta:', data);
            
            // Mostrar resultado
            if (data.status === 'ok') {
                const message = `✅ CONECTADO!\n\nGoogle Apps Script funcionando\nAcción: ${data.action || 'test'}\nHora: ${new Date(data.timestamp).toLocaleTimeString()}`;
                alert(message);
                
                if (statusElement) {
                    statusElement.innerHTML = '✅ Conectado a Google Sheets';
                }
                
                return true;
            } else {
                alert(`❌ Error en respuesta: ${JSON.stringify(data, null, 2)}`);
                return false;
            }
        } else {
            const errorText = await response.text();
            console.error('Error texto:', errorText);
            
            if (response.status === 401 || response.status === 403) {
                alert(`❌ ERROR ${response.status}: ACCESO DENEGADO\n\nEl script no está configurado para acceso público.\n\nVe a Google Apps Script y:\n1. Haz clic en "Implementar"\n2. Selecciona "Nueva implementación"\n3. Configura "Quién tiene acceso" como "Cualquier persona"`);
            } else if (response.status === 404) {
                alert(`❌ ERROR 404: NO ENCONTRADO\n\nLa URL del script es incorrecta o no existe.\n\nURL actual: ${GOOGLE_SCRIPT_URL}`);
            } else {
                alert(`❌ ERROR ${response.status}: ${response.statusText}\n\n${errorText}`);
            }
            
            return false;
        }
        
    } catch (error) {
        console.error('Error completo:', error);
        
        let errorMessage = `❌ ERROR DE CONEXIÓN\n\n${error.name}: ${error.message}`;
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage += '\n\nPosibles causas:\n';
            errorMessage += '1. La URL es incorrecta\n';
            errorMessage += '2. El script no está publicado\n';
            errorMessage += '3. Problemas de red/CORS\n';
            errorMessage += '4. El script necesita permisos';
        }
        
        errorMessage += `\n\nURL usada: ${GOOGLE_SCRIPT_URL}`;
        
        alert(errorMessage);
        
        if (statusElement) {
            statusElement.innerHTML = '❌ Error de conexión';
        }
        
        return false;
    }
}

// ===== AGREGAR BOTÓN DE PRUEBA =====
function addTestButton() {
    // Buscar donde agregar el botón
    const header = document.querySelector('header');
    const controls = document.querySelector('.controls');
    
    if (!controls && !header) {
        console.error('No se encontró donde agregar el botón');
        return;
    }
    
    // Crear botón
    const testButton = document.createElement('button');
    testButton.id = 'test-connection-btn';
    testButton.className = 'btn btn-primary';
    testButton.innerHTML = '<i class="fas fa-bug"></i> DEBUG Conexión';
    testButton.style.margin = '10px';
    testButton.style.backgroundColor = '#e74c3c';
    testButton.style.borderColor = '#e74c3c';
    
    testButton.onclick = testGoogleScript;
    
    // Agregar botón
    if (controls) {
        controls.appendChild(testButton);
    } else if (header) {
        header.appendChild(testButton);
    }
    
    console.log('✅ Botón de debug agregado');
}

// ===== PRUEBA AUTOMÁTICA =====
async function autoTest() {
    console.log('🔄 Prueba automática iniciada...');
    
    // Esperar 2 segundos para que la página cargue
    setTimeout(async () => {
        const connected = await testGoogleScript();
        
        if (!connected) {
            // Si falla, mostrar instrucciones
            console.log('Mostrando instrucciones de ayuda...');
            showHelpInstructions();
        }
    }, 2000);
}

function showHelpInstructions() {
    // Crear panel de ayuda
    const helpPanel = document.createElement('div');
    helpPanel.id = 'help-panel';
    helpPanel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 10px;
        box-shadow: 0 0 30px rgba(0,0,0,0.3);
        z-index: 9999;
        max-width: 600px;
        width: 90%;
        border: 3px solid #e74c3c;
    `;
    
    helpPanel.innerHTML = `
        <h2 style="color: #e74c3c; margin-top: 0;">⚠️ CONFIGURACIÓN REQUERIDA</h2>
        
        <p><strong>Problema:</strong> No se puede conectar a Google Sheets</p>
        
        <h3>📋 Pasos para solucionar:</h3>
        
        <ol style="text-align: left;">
            <li><strong>Verifica la URL del script:</strong><br>
            <code style="background: #f0f0f0; padding: 5px;">${GOOGLE_SCRIPT_URL}</code></li>
            
            <li><strong>Abre Google Apps Script:</strong><br>
            <a href="https://script.google.com" target="_blank">https://script.google.com</a></li>
            
            <li><strong>Configura los permisos:</strong>
                <ul>
                    <li>Haz clic en "Implementar"</li>
                    <li>Selecciona "Nueva implementación"</li>
                    <li>Tipo: "Aplicación web"</li>
                    <li>Ejecutar como: "Yo" (tu cuenta)</li>
                    <li><strong style="color: #e74c3c;">Quién tiene acceso: "Cualquier persona"</strong></li>
                    <li>Haz clic en "Implementar"</li>
                </ul>
            </li>
            
            <li><strong>Copia la nueva URL</strong> y actualízala en script.js</li>
        </ol>
        
        <div style="margin-top: 20px;">
            <button onclick="document.getElementById('help-panel').remove();" 
                    style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                Cerrar
            </button>
            
            <button onclick="window.open('https://script.google.com', '_blank');" 
                    style="padding: 10px 20px; background: #2ecc71; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
                Abrir Google Apps Script
            </button>
        </div>
    `;
    
    document.body.appendChild(helpPanel);
}

// ===== INICIALIZACIÓN =====
function init() {
    console.log('🚀 Inicializando aplicación...');
    
    // Agregar botón de prueba
    addTestButton();
    
    // Ejecutar prueba automática
    autoTest();
}

// Iniciar cuando cargue la página
document.addEventListener('DOMContentLoaded', init);

// Hacer función disponible globalmente
window.testGoogleScript = testGoogleScript;
window.showHelpInstructions = showHelpInstructions;