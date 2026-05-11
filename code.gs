/**
 * Google Apps Script for MDM Tracker
 * 
 * Instructions:
 * 1. Open your Google Sheet named "दैनिक".
 * 2. Go to Extensions > Apps Script.
 * 3. Delete any existing code and paste this code.
 * 4. Create a second sheet named "मीनू" if it doesn't exist.
 * 5. Click "Deploy" > "New Deployment".
 * 6. Select "Web App".
 * 7. Set "Execute as" to "Me".
 * 8. Set "Who has access" to "Anyone".
 * 9. Copy the Web App URL and paste it into the App's settings.
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const DAILY_SHEET_NAME = "दैनिक";
const MENU_SHEET_NAME = "मीनू";

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'get_data') {
    return handleGetData();
  }
  
  return createResponse({ error: 'Invalid action' });
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  
  if (action === 'save_entry') {
    return handleSaveEntry(data.entry);
  } else if (action === 'delete_entry') {
    return handleDeleteEntry(data.id);
  }
  
  return createResponse({ error: 'Invalid action' });
}

function handleGetData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Get Daily Entries
  const dailySheet = ss.getSheetByName(DAILY_SHEET_NAME);
  const dailyData = dailySheet.getDataRange().getValues();
  const dailyHeaders = dailyData[0];
  const entries = dailyData.slice(1).map((row, index) => {
    return {
      id: "row_" + (index + 2), // Reference to sheet row
      date: row[0] instanceof Date ? Utilities.formatDate(row[0], ss.getSpreadsheetTimeZone(), "yyyy-MM-dd") : row[0],
      presentStudents: row[1],
      eatingStudents: row[2],
      cumulativeTotal: row[3],
      wheatQty: row[4],
      riceQty: row[5],
      milkQty: row[6],
      fruitType: row[7],
      foodCost: row[8],
      fruitCost: row[9],
      totalFoodFruitCost: row[10],
      milkCost: row[11],
      mealType: row[12]
    };
  });

  // Get Menu Items
  let menuItems = [];
  const menuSheet = ss.getSheetByName(MENU_SHEET_NAME);
  if (menuSheet) {
    const menuData = menuSheet.getDataRange().getValues();
    menuItems = menuData.slice(1).map((row, index) => ({
      id: "menu_" + index,
      name: row[0],
      primaryGrain: row[1] || 'wheat',
      hasMilk: row[2] === true || row[2] === "true",
      hasFruit: row[3] === true || row[3] === "true"
    }));
  }

  return createResponse({ entries, menuItems });
}

function handleSaveEntry(entry) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(DAILY_SHEET_NAME);
  
  const rowData = [
    entry.date,
    entry.presentStudents,
    entry.eatingStudents,
    entry.cumulativeTotal,
    entry.wheatQty,
    entry.riceQty,
    entry.milkQty,
    entry.fruitType,
    entry.foodCost,
    entry.fruitCost,
    entry.totalFoodFruitCost,
    entry.milkCost,
    entry.mealType
  ];

  if (entry.id && entry.id.startsWith("row_")) {
    const rowNum = parseInt(entry.id.split("_")[1]);
    sheet.getRange(rowNum, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return createResponse({ success: true });
}

function handleDeleteEntry(id) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(DAILY_SHEET_NAME);
  
  // Try direct row number if ID is in row_N format
  if (id && id.startsWith("row_")) {
    const rowNum = parseInt(id.split("_")[1]);
    if (rowNum > 1 && rowNum <= sheet.getLastRow()) {
      sheet.deleteRow(rowNum);
      return createResponse({ success: true, method: "row_index" });
    }
  }
  
  // If id is just a number or row_ failed, it might be a date-based delete or fallback
  // Advanced: If entries have a unique timestamp or UID in a column, we should use that.
  // For now, if row_ fails (like if sheet was sorted), we just return error as 
  // we don't have a better unique identifier in the current schema.
  
  return createResponse({ error: "Invalid ID or row not found" });
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
