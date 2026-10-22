// Builds assets/products-template.xlsx — the bulk-import template with real
// Excel dropdowns for Category and Unit. exceljs crashes on Hermes, so the
// workbook is generated here in Node and bundled as a static asset.
// Regenerate with: npm run generate:template
const ExcelJS = require('exceljs');
const path = require('path');

const PRODUCT_CATEGORIES = ['Grocery', 'Snacks', 'Beverages', 'Dairy', 'Produce', 'Apparel', 'Electronics', 'Other'];
const PRODUCT_UNITS = ['pcs', 'kg', 'g', 'pack', 'box', 'l', 'ml'];
const TEMPLATE_ROW_COUNT = 500;

(async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Products');
  sheet.columns = [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'SKU', key: 'sku', width: 14 },
    { header: 'Price', key: 'price', width: 10 },
    { header: 'Cost Price', key: 'costPrice', width: 12 },
    { header: 'Stock', key: 'stock', width: 10 },
    { header: 'Category', key: 'category', width: 14 },
    { header: 'Unit', key: 'unit', width: 8 },
    { header: 'Tax Rate', key: 'taxRate', width: 10 },
    { header: 'Low Stock Alert', key: 'lowStockAlert', width: 16 },
    { header: 'Image URL', key: 'imageUrl', width: 32 },
  ];
  sheet.addRow({
    name: 'Example Product',
    sku: 'SKU123',
    price: 100,
    costPrice: 80,
    stock: 50,
    category: 'Snacks',
    unit: 'pcs',
    taxRate: 8,
    lowStockAlert: 10,
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
  });

  // Dropdown validation for the Category (F) and Unit (G) columns.
  for (let row = 2; row <= TEMPLATE_ROW_COUNT + 1; row++) {
    sheet.getCell(`F${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      showErrorMessage: true,
      formulae: [`"${PRODUCT_CATEGORIES.join(',')}"`],
    };
    sheet.getCell(`G${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      showErrorMessage: true,
      formulae: [`"${PRODUCT_UNITS.join(',')}"`],
    };
  }

  const out = path.join(__dirname, '..', 'assets', 'products-template.xlsx');
  await workbook.xlsx.writeFile(out);
  console.log('Wrote', out);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});