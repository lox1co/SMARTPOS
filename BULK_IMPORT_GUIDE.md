# Bulk Product Import & Barcode Scanning Guide 📊

This guide provides practical solutions for preparing and importing large catalogs (100+ products) into SmartPOS without tedious manual typing.

---

## 📱 Solution 4: Use Your Phone as a Wireless Scanner for Your Laptop

If you do not have a dedicated physical handheld barcode scanner, you can turn your smartphone into a wireless barcode reader that types scanned codes straight into Excel on your laptop.

### Step-by-Step Setup:

1. **Install the App**:
   - **On your laptop** (Windows/Mac): Download and install the free server from [Barcode to PC](https://barcodetopc.com/) (or *WiFi Barcode Scanner* / *DroidCam*).
   - **On your smartphone** (Android/iOS): Install **"Barcode to PC"** from Google Play Store or Apple App Store.

2. **Connect Phone and Laptop**:
   - Connect both your phone and laptop to the same Wi-Fi network (or connect via USB cable).
   - Open the app on your phone; it will automatically discover and pair with your laptop server.

3. **Open the Excel Template**:
   - Download the SmartPOS product template (`products-template.xlsx`).
   - Open the file in Microsoft Excel or Google Sheets on your laptop.
   - Click to select the first cell in the **`SKU`** column.

4. **Scan Products Continuously**:
   - Point your phone camera at each product barcode one after another.
   - Each scan immediately transmits the barcode numbers into the active Excel cell and automatically presses **Enter** to move to the next row below.
   - You can scan 100+ products in under **2 to 3 minutes**.

5. **Fill In Other Columns & Upload**:
   - Fill in product **Name**, **Price**, **Stock**, and select the **Category** from the dropdown.
   - Save the file and import it directly into SmartPOS via the **Products ➔ Import** button.

---

## 💡 Additional Solutions for Barcodes & Bulk Import

### 1. Auto-Generated SKUs (Leave SKU Column Empty)
- You **do not need to scan barcodes** if your products do not have printed manufacturer barcodes.
- Leave the `SKU` column completely **blank** in the Excel sheet.
- SmartPOS automatically generates a unique SKU for every product upon upload.

### 2. Auto-Numbering in Excel (Takes 5 seconds)
- In the first row of `SKU`, type `1001` or `PROD-001`.
- In the second row, type `1002` or `PROD-002`.
- Highlight both cells and drag down the bottom-right corner handle to autofill all 100+ rows instantly.
- You can print barcode labels from SmartPOS anytime for these generated codes.

### 3. Dedicated USB / 2.4GHz Wireless Scanner
- Plug any standard USB or wireless handheld barcode scanner into your laptop.
- No drivers or software needed—scanners function as a keyboard (HID).
- Select the `SKU` column cell in Excel and scan products consecutively.

### 4. Scan & Link Directly in the Mobile App
- Upload your products with auto-generated SKUs first.
- Whenever you handle an item at your store, open the product in SmartPOS, tap the **Barcode** icon, and scan the physical packaging to update the barcode in 2 seconds.

---

## 📋 Required Template Columns Reference

| Column Header | Required | Example | Notes |
|---|---|---|---|
| **Name** | **Yes** | Fresh Organic Milk 1L | Product display name |
| **SKU** | Optional | 8901030865412 | Barcode or unique code (Leave blank for auto-generate) |
| **Price** | **Yes** | 65.00 | Selling price per unit |
| **Cost Price** | Optional | 52.00 | Purchase cost for profit calculations |
| **Stock** | **Yes** | 50 | Current inventory quantity |
| **Category** | **Yes** | Dairy & Bakery | Pre-validated category dropdown |
| **Unit** | Optional | pcs, kg, l, g, ml | Default is `pcs` |
| **Tax Rate** | Optional | 5 | Tax percentage (e.g. 0, 5, 12, 18, 28) |
| **Low Stock Alert** | Optional | 10 | Threshold for low-stock notification |
| **Image URL** | Optional | https://... | Direct public image link |
