// Código para Google Apps Script
// Guarda esto como "StockMaster.gs" en script.google.com

const SHEET_ID = '1Qf3VrvK8lBIFeeapNcTnru8aKYSah1NQwBuJI9wzhww'; // Reemplaza con el ID de tu Google Sheet
const SHEET_NAME = 'Productos';

function doGet(e) {
    return handleRequest(e);
}

function doPost(e) {
    return handleRequest(e);
}

function handleRequest(e) {
    try {
        const action = e.parameter.action || e.postData.contents ? JSON.parse(e.postData.contents).action : null;

        if (!action) {
            return createResponse('error', 'No action specified');
        }

        switch (action) {
            case 'test':
                return createResponse('ok', 'Google Sheets connected');

            case 'getProducts':
                const products = getAllProducts();
                return createResponse('success', 'Products retrieved', { products });

            case 'updateStock':
                const id = e.parameter.id || JSON.parse(e.postData.contents).id;
                const stock = e.parameter.stock || JSON.parse(e.postData.contents).stock;

                if (!id || stock === undefined) {
                    return createResponse('error', 'Missing id or stock');
                }

                const success = updateProductStock(id, stock);
                if (success) {
                    return createResponse('success', 'Stock updated');
                } else {
                    return createResponse('error', 'Product not found');
                }

            default:
                return createResponse('error', 'Unknown action');
        }
    } catch (error) {
        console.error('Error:', error);
        return createResponse('error', error.toString());
    }
}

function getAllProducts() {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
        throw new Error('Sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Convertir filas a objetos
    const products = [];
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[0]) { // Si hay ID
            const product = {
                id: row[headers.indexOf('ID')],
                name: row[headers.indexOf('Nombre')],
                category: row[headers.indexOf('Categoría')],
                description: row[headers.indexOf('Descripción')],
                price: parseFloat(row[headers.indexOf('Precio')]) || 0,
                stock: parseInt(row[headers.indexOf('Stock')]) || 0,
                sku: row[headers.indexOf('SKU')] || ''
            };
            products.push(product);
        }
    }

    return products;
}

function updateProductStock(productId, newStock) {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('ID');
    const stockIndex = headers.indexOf('Stock');

    if (idIndex === -1 || stockIndex === -1) {
        return false;
    }

    for (let i = 1; i < data.length; i++) {
        if (data[i][idIndex] == productId) {
            sheet.getRange(i + 1, stockIndex + 1).setValue(newStock);

            // Registrar cambio
            logChange(productId, newStock);
            return true;
        }
    }

    return false;
}

function logChange(productId, newStock) {
    const logSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Logs');
    if (!logSheet) return;

    logSheet.appendRow([
        new Date(),
        productId,
        newStock,
        Session.getActiveUser().getEmail() || 'WebApp'
    ]);
}

function createResponse(status, message, data = {}) {
    const output = {
        status: status,
        message: message,
        ...data
    };

    return ContentService
        .createTextOutput(JSON.stringify(output))
        .setMimeType(ContentService.MimeType.JSON);
}

// Función para importar datos iniciales (ejecutar una vez)
function importInitialData() {
    const products = [
        // Tus productos iniciales aquí
        { id: 1000, name: "Cinta Aislante Negra", category: "Cintas", description: "Cinta Aislante Negra.", price: 1.50, stock: 149, sku: "" },
        { id: 1001, name: "Cinta Aislante Blanca", category: "Cintas", description: "Cinta Aislante Blanca.", price: 1.50, stock: 15, sku: "" }
        // Agrega todos tus productos
    ];

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

    // Escribir headers
    const headers = ['ID', 'Nombre', 'Categoría', 'Descripción', 'Precio', 'Stock', 'SKU'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Escribir datos
    const data = products.map(p => [p.id, p.name, p.category, p.description, p.price, p.stock, p.sku]);
    sheet.getRange(2, 1, data.length, headers.length).setValues(data);

    Logger.log(`Importados ${products.length} productos`);
}