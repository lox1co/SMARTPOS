import { translatePhrase } from "@/i18n";
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

/**
 * Escape one value for a CSV cell (RFC-4180 style): wrap in quotes when it
 * contains a comma, quote, or newline, and double any embedded quotes.
 */
export function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Join a matrix of rows into a CSV document (CRLF line endings). */
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

// Strip characters that aren't safe in a file name across platforms.
function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_");
}

/**
 * Write a text file to the document directory and open the OS share sheet.
 * Returns the file uri, or null on web / when no share sheet is available
 * (the caller can surface an appropriate message).
 */
export async function shareTextFile(filename: string, contents: string, mimeType: string): Promise<string | null> {
  if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
    return null;
  }
  const file = new File(Paths.document, safeName(filename));
  file.create({ overwrite: true });
  file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: translatePhrase(filename) });
  return file.uri;
}

/**
 * Render HTML to a PDF (expo-print) and open the OS share sheet. Returns the
 * generated file uri, or null on web / when no share sheet is available.
 */
export async function shareHtmlAsPdf(html: string, dialogTitle: string): Promise<string | null> {
  if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
    return null;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: translatePhrase(dialogTitle),
  });
  return uri;
}
