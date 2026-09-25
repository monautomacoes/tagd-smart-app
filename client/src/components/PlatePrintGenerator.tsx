import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Printer,
  Download,
  Sparkles,
  Layers,
  Radio,
  QrCode,
  Smartphone,
  Eye,
  Check,
  Zap,
  Plus,
  RefreshCw,
  Sliders,
  FileCode,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export type PrintFormat = "10x10" | "5.4x8.5" | "10x15";
export type PlateTheme = "dark-gold" | "acrylic-blue";
export type PrintQuality = "4k-ultra" | "600dpi";

// Standard CRC32 table for embedding physical PNG metadata (pHYs chunk)
function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Injects standard pHYs chunk to declare 600 DPI in PNG header for print software
function createPhysChunk(dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254); // Pixels per meter (e.g. 600 DPI = 23622 ppm)
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9); // Length
  chunk[4] = 0x70; // 'p'
  chunk[5] = 0x48; // 'H'
  chunk[6] = 0x79; // 'y'
  chunk[7] = 0x73; // 's'
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  chunk[16] = 1; // Unit: Meter
  const crc = crc32(chunk.subarray(4, 17));
  view.setUint32(17, crc);
  return chunk;
}

async function addDpiToPng(blob: Blob, dpi: number): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return blob;
  const phys = createPhysChunk(dpi);
  const combined = new Uint8Array(bytes.length + phys.length);
  combined.set(bytes.subarray(0, 33), 0);
  combined.set(phys, 33);
  combined.set(bytes.subarray(33), 33 + phys.length);
  return new Blob([combined], { type: "image/png" });
}

// Builds the master senior-level vector SVG representation of the physical plate
export function buildPlateSvg({
  format,
  theme,
  customBusinessName,
  customTitle,
  customSubtitle,
  customFooterTagline,
  plateNumberLabel,
  qrDataUrl,
}: {
  format: PrintFormat;
  theme: PlateTheme;
  customBusinessName: string;
  customTitle: string;
  customSubtitle: string;
  customFooterTagline: string;
  plateNumberLabel: string;
  qrDataUrl: string;
}): string {
  const is10x10 = format === "10x10";
  const isCard = format === "5.4x8.5";

  // Physical Millimeters
  const widthMm = isCard ? 54 : 100;
  const heightMm = isCard ? 85 : is10x10 ? 100 : 150;

  // ViewBox Grid (1000 width baseline)
  const viewBoxWidth = 1000;
  const viewBoxHeight = Math.round((heightMm / widthMm) * 1000); // 1000, 1574, or 1500

  const isDark = theme === "dark-gold";
  const displayName = customBusinessName || "DANI PONTELLO";

  // Coordinate scales for taller formats (cards and vertical displays)
  const isTall = !is10x10;
  const dividerY = isTall ? Math.round(viewBoxHeight * 0.44) : 435;
  const topCenterY = isTall ? Math.round(viewBoxHeight * 0.22) : 215;
  const bottomCenterY = isTall ? Math.round(viewBoxHeight * 0.70) : 690;
  const footerY = viewBoxHeight - Math.round(viewBoxHeight * 0.035);

  const starCenters = [340, 420, 500, 580, 660];
  const starY = isTall ? Math.round(dividerY * 0.16) : 65;
  const titleY = starY + (isTall ? 75 : 65);
  const subTitleY = titleY + 45;
  const nameY = subTitleY + (isTall ? 80 : 70);
  const underLineY = nameY + 16;
  const taglineY = underLineY + (isTall ? 55 : 45);

  const bottomContentTop = dividerY + (isTall ? 110 : 90);
  const phoneCenterY = bottomContentTop + (isTall ? 170 : 145);
  const qrCenterY = phoneCenterY;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">
  <defs>
    <!-- Gradiente Dourado Luxo para Tipografia -->
    <linearGradient id="goldTextGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#fffbeb" />
      <stop offset="20%" stop-color="#fef08a" />
      <stop offset="50%" stop-color="#f59e0b" />
      <stop offset="85%" stop-color="#d97706" />
      <stop offset="100%" stop-color="#b45309" />
    </linearGradient>

    <!-- Gradiente Dourado para Estrelas -->
    <linearGradient id="starGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="50%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>

    <!-- Fita Colorida Oficial Google -->
    <linearGradient id="googleRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#EA4335" />
      <stop offset="25%" stop-color="#EA4335" />
      <stop offset="35%" stop-color="#FBBC05" />
      <stop offset="60%" stop-color="#34A853" />
      <stop offset="75%" stop-color="#4285F4" />
      <stop offset="100%" stop-color="#4285F4" />
    </linearGradient>

    <!-- Sombras Realistas -->
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.25"/>
    </filter>
    <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#f59e0b" flood-opacity="0.45"/>
    </filter>
    <filter id="badgeShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-opacity="0.28"/>
    </filter>

    <!-- Símbolo Estrela Vetorial Perfeita -->
    <g id="starVector">
      <polygon points="0,-20 6,-6 20,-6 9,3 13,17 0,8 -13,17 -9,3 -20,-6 -6,-6" fill="url(#starGrad)" stroke="#d97706" stroke-width="1.2" filter="url(#goldGlow)" />
    </g>

    <!-- Símbolo Google G Oficial -->
    <g id="googleLogoG">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </g>
  </defs>

  <!-- Fundo Total com Cantos Arredondados Físicos -->
  <rect x="0" y="0" width="${viewBoxWidth}" height="${viewBoxHeight}" rx="${isCard ? 36 : 46}" fill="${isDark ? "#060709" : "#0284c7"}" />

  <!-- Metade Inferior em Branco Puro -->
  <rect x="0" y="${dividerY}" width="${viewBoxWidth}" height="${viewBoxHeight - dividerY}" fill="#ffffff" />

  <!-- SEÇÃO SUPERIOR: TÍTULOS E ESTRELAS -->
  <!-- 5 Estrelas Douradas -->
  <g>
    ${starCenters.map((x) => `<use href="#starVector" x="${x}" y="${starY}" />`).join("\n    ")}
  </g>

  <!-- Linha 1: "NÓS ADORARÍAMOS A SUA" -->
  <text x="500" y="${titleY}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="22" fill="#ffffff" letter-spacing="3">${customTitle}</text>

  <!-- Linha 2: "AVALIAÇÃO NO GOOGLE" -->
  <text x="500" y="${subTitleY}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="30" fill="#ffffff" letter-spacing="1.5">${customSubtitle}</text>

  <!-- Nome da Empresa em Ouro com Sombra Reluzente -->
  <text x="500" y="${nameY}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="52" fill="url(#goldTextGrad)" letter-spacing="2" filter="url(#goldGlow)">${displayName}</text>

  <!-- Linha Sublinhada Dourada -->
  <line x1="200" y1="${underLineY}" x2="800" y2="${underLineY}" stroke="url(#goldTextGrad)" stroke-width="3" stroke-linecap="round" />

  <!-- Frase de Apoio -->
  <text x="500" y="${taglineY}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="500" font-size="16" fill="#e2e8f0">${customFooterTagline}</text>

  <!-- FITA COLORIDA GOOGLE COM TRANSIÇÃO CURVADA -->
  <path d="M 0,${dividerY - 8} Q 500,${dividerY + 8} 1000,${dividerY - 8} L 1000,${dividerY + 12} Q 500,${dividerY + 28} 0,${dividerY + 12} Z" fill="url(#googleRibbon)" />

  <!-- EMBLEMA CENTRAL CIRCULAR GOOGLE "G" -->
  <circle cx="500" cy="${dividerY + 4}" r="64" fill="#ffffff" filter="url(#badgeShadow)" />
  <circle cx="500" cy="${dividerY + 4}" r="63" fill="none" stroke="#f1f5f9" stroke-width="2" />
  <use href="#googleLogoG" x="456" y="${dividerY - 40}" width="88" height="88" transform="scale(1)" />

  <!-- SEÇÃO INFERIOR: CELULAR NFC + DIVISOR OU + QR CODE -->
  <!-- COLUNA ESQUERDA: SMARTPHONE NFC ILUSTRADO -->
  <!-- Título Esquerda -->
  <text x="260" y="${bottomContentTop - 15}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="800" font-size="22" fill="#0f172a">Aproxime seu celular</text>

  <!-- Corpo do Smartphone com Cantos Arredondados e Detalhes de Design -->
  <rect x="195" y="${phoneCenterY - 120}" width="130" height="240" rx="26" fill="#ffffff" stroke="#0f172a" stroke-width="5" />
  <!-- Entalhe / Speaker Superior -->
  <line x1="240" y1="${phoneCenterY - 105}" x2="280" y2="${phoneCenterY - 105}" stroke="#0f172a" stroke-width="3" stroke-linecap="round" />
  <!-- Barra Home Inferior -->
  <line x1="240" y1="${phoneCenterY + 105}" x2="280" y2="${phoneCenterY + 105}" stroke="#0f172a" stroke-width="3" stroke-linecap="round" />

  <!-- Cartãozinho NFC Central dentro da tela -->
  <rect x="220" y="${phoneCenterY - 26}" width="80" height="52" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.8" />
  <text x="260" y="${phoneCenterY + 8}" text-anchor="middle" font-family="monospace, -apple-system, sans-serif" font-weight="900" font-size="22" fill="#0f172a">NFC</text>

  <!-- Ondas de Rádio Azuis Irradiando do Smartphone -->
  <path d="M 235,${phoneCenterY - 20} A 35 35 0 0 1 285,${phoneCenterY - 20}" fill="none" stroke="#2563eb" stroke-width="4.5" stroke-linecap="round" />
  <path d="M 218,${phoneCenterY - 38} A 60 60 0 0 1 302,${phoneCenterY - 38}" fill="none" stroke="#2563eb" stroke-width="4.5" stroke-linecap="round" />
  <path d="M 200,${phoneCenterY - 56} A 85 85 0 0 1 320,${phoneCenterY - 56}" fill="none" stroke="#2563eb" stroke-width="4.5" stroke-linecap="round" />

  <!-- Subtítulo Celular -->
  <text x="260" y="${phoneCenterY + 155}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="12" fill="#64748b">Sem aplicativo • Direto no celular</text>

  <!-- DIVISOR CENTRAL: "OU" -->
  <circle cx="500" cy="${phoneCenterY}" r="28" fill="#f8fafc" />
  <text x="500" y="${phoneCenterY + 10}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="28" fill="#0f172a">OU</text>

  <!-- COLUNA DIREITA: QR CODE COM MOLDURA DE CANTOS -->
  <!-- 4 Cantoneiras de Design ao redor do QR Code -->
  <g stroke="#0f172a" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <!-- Canto Superior Esquerdo -->
    <path d="M 610,${qrCenterY - 70} L 610,${qrCenterY - 110} A 10 10 0 0 1 620,${qrCenterY - 120} L 660,${qrCenterY - 120}" />
    <!-- Canto Superior Direito -->
    <path d="M 810,${qrCenterY - 120} L 850,${qrCenterY - 120} A 10 10 0 0 1 860,${qrCenterY - 110} L 860,${qrCenterY - 70}" />
    <!-- Canto Inferior Esquerdo -->
    <path d="M 610,${qrCenterY + 70} L 610,${qrCenterY + 110} A 10 10 0 0 0 620,${qrCenterY + 120} L 660,${qrCenterY + 120}" />
    <!-- Canto Inferior Direito -->
    <path d="M 810,${qrCenterY + 120} L 850,${qrCenterY + 120} A 10 10 0 0 0 860,${qrCenterY + 110} L 860,${qrCenterY + 70}" />
  </g>

  <!-- Imagem do QR Code Dinâmico em Ultra Resolução -->
  ${qrDataUrl ? `<image href="${qrDataUrl}" x="625" y="${qrCenterY - 105}" width="220" height="220" />` : ""}

  <!-- Badge Google G no Centro do QR Code -->
  <circle cx="735" cy="${qrCenterY + 5}" r="25" fill="#ffffff" filter="url(#softShadow)" />
  <circle cx="735" cy="${qrCenterY + 5}" r="24" fill="none" stroke="#f1f5f9" stroke-width="1.5" />
  <use href="#googleLogoG" x="718" y="${qrCenterY - 12}" width="34" height="34" />

  <!-- Textos QR Code -->
  <text x="735" y="${qrCenterY + 150}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="800" font-size="22" fill="#0f172a">Aponte a câmera</text>
  <text x="735" y="${qrCenterY + 176}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="13" fill="#0284c7">⚡ Avalie em 3 segundos</text>

  <!-- RODAPÉ TÉCNICO OFICIAL COM ESPAÇAMENTO RESPIRADO -->
  <text x="500" y="${footerY}" text-anchor="middle" font-family="monospace, -apple-system, sans-serif" font-weight="600" font-size="10" fill="#94a3b8" letter-spacing="2.5">CHIP NFC NTAG215 • ID: ${plateNumberLabel} • ALF AUTOMAÇÃO</text>
</svg>`;
}

interface PlatePrintGeneratorProps {
  businesses: Array<{
    id: number;
    name: string;
    segment?: string | null;
    phone?: string | null;
  }>;
  tags: Array<{
    id: number;
    businessId: number;
    code: string;
    plateNumber?: string | null;
    label: string;
    destinationType: string;
    destinationUrl: string;
  }>;
  onRefreshData?: () => void;
  defaultBusinessId?: number;
  defaultTagId?: number;
}

export function PlatePrintGenerator({
  businesses,
  tags,
  onRefreshData,
  defaultBusinessId,
  defaultTagId,
}: PlatePrintGeneratorProps) {
  // State
  const [selectedBusinessId, setSelectedBusinessId] = useState<number>(
    defaultBusinessId || (businesses[0]?.id ?? 0)
  );
  const [selectedTagId, setSelectedTagId] = useState<number>(defaultTagId || 0);
  const [format, setFormat] = useState<PrintFormat>("10x10");
  const [theme, setTheme] = useState<PlateTheme>("dark-gold");
  const [quality, setQuality] = useState<PrintQuality>("4k-ultra");

  // Custom texts
  const currentBusiness = useMemo(
    () => businesses.find((b) => b.id === selectedBusinessId),
    [businesses, selectedBusinessId]
  );

  const businessTags = useMemo(
    () => tags.filter((t) => t.businessId === selectedBusinessId),
    [tags, selectedBusinessId]
  );

  const currentTag = useMemo(
    () => businessTags.find((t) => t.id === selectedTagId) || businessTags[0],
    [businessTags, selectedTagId]
  );

  const [customTitle, setCustomTitle] = useState("NÓS ADORARÍAMOS A SUA");
  const [customSubtitle, setCustomSubtitle] = useState("AVALIAÇÃO NO GOOGLE");
  const [customBusinessName, setCustomBusinessName] = useState("");
  const [customFooterTagline, setCustomFooterTagline] = useState(
    "Sua opinião de 5 estrelas é muito importante para nós!"
  );

  // Sync custom business name with selected business
  useEffect(() => {
    if (currentBusiness) {
      setCustomBusinessName(currentBusiness.name.toUpperCase());
    }
  }, [currentBusiness]);

  // Bulk creation dialog state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchCount, setBatchCount] = useState("10");
  const [batchPrefix, setBatchPrefix] = useState("PLACA-");
  const [batchStartNum, setBatchStartNum] = useState("1");
  const [batchUrl, setBatchUrl] = useState("");

  // Ultra HD QR Code data URL
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);
  const [isGeneratingSvg, setIsGeneratingSvg] = useState(false);

  // Compute tag redirect URL
  const targetUrl = useMemo(() => {
    if (currentTag) {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://tagd-smart-app.vercel.app";
      return `${origin}/t/${currentTag.code}`;
    }
    return currentBusiness?.phone
      ? `https://wa.me/55${currentBusiness.phone.replace(/\D/g, "")}`
      : "https://g.page/review";
  }, [currentTag, currentBusiness]);

  // Generate QR Code with 3000px resolution and maximum error correction (Level H)
  useEffect(() => {
    if (!targetUrl) return;
    QRCode.toDataURL(targetUrl, {
      width: 3000,
      margin: 1,
      errorCorrectionLevel: "H",
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((data) => setQrDataUrl(data))
      .catch((err) => console.error("Error generating QR:", err));
  }, [targetUrl]);

  // TRPC Batch creation
  const createBatch = trpc.tag.createBatch.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} placas criadas com numeração sequencial!`);
      setBatchModalOpen(false);
      onRefreshData?.();
    },
    onError: (err) => {
      toast.error(`Falha ao gerar lote de placas: ${err.message}`);
    },
  });

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusinessId) {
      toast.error("Selecione uma empresa primeiro");
      return;
    }
    const count = parseInt(batchCount, 10);
    const startNumber = parseInt(batchStartNum, 10);
    if (isNaN(count) || count < 1 || count > 200) {
      toast.error("A quantidade deve ser entre 1 e 200");
      return;
    }
    createBatch.mutate({
      businessId: selectedBusinessId,
      count,
      platePrefix: batchPrefix.trim() || "PLACA-",
      startNumber: isNaN(startNumber) ? 1 : startNumber,
      destinationType: "google",
      destinationUrl: batchUrl.trim() || undefined,
    });
  };

  // Dimensions based on selected format
  const formatDimensions = useMemo(() => {
    switch (format) {
      case "10x10":
        return {
          label: "10cm x 10cm (Quadrada)",
          aspectRatio: "aspect-square",
          widthMm: 100,
          heightMm: 100,
          printClass: "print-10x10",
          res4k: "4000 x 4000 px (~1016 DPI)",
          res600: "2362 x 2362 px (600 DPI)",
        };
      case "5.4x8.5":
        return {
          label: "5.4cm x 8.5cm (Cartão NFC)",
          aspectRatio: "aspect-[54/85]",
          widthMm: 54,
          heightMm: 85,
          printClass: "print-card",
          res4k: "2550 x 4016 px (~1200 DPI)",
          res600: "1276 x 2008 px (600 DPI)",
        };
      case "10x15":
        return {
          label: "10cm x 15cm (Display Vertical)",
          aspectRatio: "aspect-[10/15]",
          widthMm: 100,
          heightMm: 150,
          printClass: "print-10x15",
          res4k: "3600 x 5400 px (~914 DPI)",
          res600: "2362 x 3543 px (600 DPI)",
        };
    }
  }, [format]);

  const plateNumberLabel =
    currentTag?.plateNumber || currentTag?.code || customBusinessName || "DANIPONTELLO";

  // Master SVG markup
  const masterSvgString = useMemo(() => {
    return buildPlateSvg({
      format,
      theme,
      customBusinessName,
      customTitle,
      customSubtitle,
      customFooterTagline,
      plateNumberLabel,
      qrDataUrl,
    });
  }, [
    format,
    theme,
    customBusinessName,
    customTitle,
    customSubtitle,
    customFooterTagline,
    plateNumberLabel,
    qrDataUrl,
  ]);

  // Print function using the master vector SVG
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Por favor, permita pop-ups para abrir a folha de impressão.");
      return;
    }

    const is10x10 = format === "10x10";
    const isCard = format === "5.4x8.5";

    const widthCm = is10x10 ? "10cm" : isCard ? "5.4cm" : "10cm";
    const heightCm = is10x10 ? "10cm" : isCard ? "8.5cm" : "15cm";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Impressão Placa - ${plateNumberLabel}</title>
          <style>
            @page {
              size: auto;
              margin: 10mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              background-color: #f1f5f9;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 20px;
            }
            .no-print {
              margin-bottom: 20px;
              background: #0f172a;
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              font-size: 14px;
              display: flex;
              gap: 12px;
              align-items: center;
            }
            .no-print button {
              background: #0284c7;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              font-weight: bold;
              cursor: pointer;
            }
            .plate-container {
              width: ${widthCm};
              height: ${heightCm};
              box-shadow: 0 10px 25px rgba(0,0,0,0.15);
              page-break-inside: avoid;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .plate-container svg {
              width: 100%;
              height: 100%;
              display: block;
            }
            @media print {
              body {
                background: transparent;
                padding: 0;
                min-height: auto;
              }
              .no-print {
                display: none !important;
              }
              .plate-container {
                box-shadow: none;
                margin: 0 auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <span>Dimensões Exatas: <b>${widthCm} x ${heightCm}</b> • Formato: ${formatDimensions.label}</span>
            <button onclick="window.print()">Imprimir Agora / Salvar PDF</button>
          </div>

          <div class="plate-container">
            ${masterSvgString}
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Ultra HD 4K & 600+ DPI PNG Download from Master Vector SVG
  const handleDownloadPng = async () => {
    try {
      setIsGeneratingPng(true);
      const is10x10 = format === "10x10";
      const isCard = format === "5.4x8.5";

      // 4K Ultra HD Dimensions (up to 4000px, >1000 DPI)
      let targetWidth = 4000;
      let targetHeight = 4000;

      if (isCard) {
        targetWidth = quality === "4k-ultra" ? 2550 : 1276;
        targetHeight = quality === "4k-ultra" ? 4016 : 2008;
      } else if (is10x10) {
        targetWidth = quality === "4k-ultra" ? 4000 : 2362;
        targetHeight = quality === "4k-ultra" ? 4000 : 2362;
      } else {
        // 10x15
        targetWidth = quality === "4k-ultra" ? 3600 : 2362;
        targetHeight = quality === "4k-ultra" ? 5400 : 3543;
      }

      // Convert SVG to Image and draw to 4K Canvas
      const svgBlob = new Blob([masterSvgString], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
        img.src = svgUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("Não foi possível inicializar o Canvas.");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      URL.revokeObjectURL(svgUrl);

      // Convert Canvas to Blob and inject 600 DPI / 1000 DPI pHYs Chunk
      canvas.toBlob(
        async (rawBlob) => {
          if (!rawBlob) throw new Error("Falha ao exportar imagem.");
          const targetDpi = quality === "4k-ultra" ? 1000 : 600;
          const finalBlob = await addDpiToPng(rawBlob, targetDpi);
          const link = document.createElement("a");
          link.download = `PLACA-${customBusinessName || "ARTE"}-${plateNumberLabel}-${format}-${quality}.png`;
          link.href = URL.createObjectURL(finalBlob);
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(link.href);
          toast.success(
            `Imagem Ultra HD 4K (${targetDpi} DPI com metadados físicos) baixada com proporções perfeitas!`
          );
        },
        "image/png"
      );
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao gerar PNG: ${err?.message || "falha na renderização"}`);
    } finally {
      setIsGeneratingPng(false);
    }
  };

  // Download Vector SVG (Infinite DPI)
  const handleDownloadSvg = () => {
    try {
      setIsGeneratingSvg(true);
      const blob = new Blob([masterSvgString], { type: "image/svg+xml;charset=utf-8" });
      const link = document.createElement("a");
      link.download = `PLACA-${customBusinessName || "ARTE"}-${plateNumberLabel}-${format}-VETOR.svg`;
      link.href = URL.createObjectURL(blob);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      toast.success("Vetor SVG (DPI Infinito para Laser e Gráfica) baixado!");
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao gerar SVG: ${err?.message || "falha na geração"}`);
    } finally {
      setIsGeneratingSvg(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 text-white shadow-xl md:flex-row md:items-center md:justify-between border border-amber-500/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-500/30">
              PADRÃO OFICIAL ALF AUTOMAÇÃO
            </span>
            <Badge variant="outline" className="text-white/80 border-white/20">
              NFC NTAG215 + QR Code Dinâmico
            </Badge>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              💎 4K Ultra HD & 600+ DPI
            </Badge>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
            Gerador de Placas & Cartões para Impressão
          </h2>
          <p className="mt-1 text-sm text-slate-300 max-w-2xl">
            Exporte arquivos em <b>4K Ultra HD (600 a 1200 DPI)</b> e <b>Vetor SVG infinito</b> com layout
            balanceado, proporções exatas e acabamento profissional para gráficas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setBatchModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-lg"
          >
            <Layers className="mr-2 h-4 w-4" />
            Gerar Lote (1 a 100)
          </Button>

          <Button
            onClick={handlePrint}
            variant="outline"
            className="border-white/30 bg-white/10 text-white hover:bg-white/20 font-semibold"
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </Button>

          <Button
            onClick={handleDownloadSvg}
            disabled={isGeneratingSvg}
            variant="outline"
            className="border-cyan-400/40 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-900/60 font-bold"
          >
            {isGeneratingSvg ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileCode className="mr-2 h-4 w-4 text-cyan-300" />
            )}
            Vetor SVG (Infinito)
          </Button>

          <Button
            onClick={handleDownloadPng}
            disabled={isGeneratingPng}
            className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-slate-950 font-extrabold shadow-lg"
          >
            {isGeneratingPng ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Baixar PNG 4K (600+ DPI)
          </Button>
        </div>
      </div>

      {/* Main Workspace: Controls + Live Preview */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.3fr]">
        {/* Controls Column */}
        <div className="space-y-6">
          {/* Format & Dimensions Selector */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sliders className="h-4 w-4 text-cyan-600" />
                Formato & Dimensões Físicas
              </CardTitle>
              <CardDescription>
                Selecione o tamanho físico para a sua placa ou cartão de visita.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat("10x10")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition ${
                    format === "10x10"
                      ? "border-amber-500 bg-amber-50/50 text-slate-900 font-bold shadow-sm"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <div className="h-8 w-8 rounded-lg bg-slate-900 text-amber-400 grid place-items-center mb-1 font-bold text-xs">
                    10x10
                  </div>
                  <span className="text-xs">Placa Quadrada</span>
                  <span className="text-[10px] text-slate-500 font-normal">10cm x 10cm</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat("5.4x8.5")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition ${
                    format === "5.4x8.5"
                      ? "border-amber-500 bg-amber-50/50 text-slate-900 font-bold shadow-sm"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <div className="h-8 w-6 rounded bg-slate-900 text-cyan-400 grid place-items-center mb-1 font-bold text-xs">
                    NFC
                  </div>
                  <span className="text-xs">Cartão de Visita</span>
                  <span className="text-[10px] text-slate-500 font-normal">5.4cm x 8.5cm</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat("10x15")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition ${
                    format === "10x15"
                      ? "border-amber-500 bg-amber-50/50 text-slate-900 font-bold shadow-sm"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <div className="h-9 w-6 rounded-lg bg-slate-900 text-emerald-400 grid place-items-center mb-1 font-bold text-xs">
                    10x15
                  </div>
                  <span className="text-xs">Display Mesa</span>
                  <span className="text-[10px] text-slate-500 font-normal">10cm x 15cm</span>
                </button>
              </div>

              {/* Theme & Quality Selector */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Tema Visual</Label>
                  <div className="grid grid-cols-1 gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setTheme("dark-gold")}
                      className={`flex items-center gap-2 p-2 rounded-xl border-2 text-left transition ${
                        theme === "dark-gold"
                          ? "border-amber-500 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 hover:border-slate-300 bg-white text-slate-800"
                      }`}
                    >
                      <div className="h-4 w-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-600" />
                      <span className="text-xs font-bold">Preto Luxo Dourado</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme("acrylic-blue")}
                      className={`flex items-center gap-2 p-2 rounded-xl border-2 text-left transition ${
                        theme === "acrylic-blue"
                          ? "border-cyan-600 bg-cyan-700 text-white shadow-sm"
                          : "border-slate-200 hover:border-slate-300 bg-white text-slate-800"
                      }`}
                    >
                      <div className="h-4 w-4 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600" />
                      <span className="text-xs font-bold">Azul & Branco Clean</span>
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Qualidade de Impressão</Label>
                  <div className="grid grid-cols-1 gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setQuality("4k-ultra")}
                      className={`flex items-center gap-2 p-2 rounded-xl border-2 text-left transition ${
                        quality === "4k-ultra"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-950 font-bold shadow-sm"
                          : "border-slate-200 hover:border-slate-300 bg-white text-slate-800"
                      }`}
                    >
                      <Zap className="h-4 w-4 text-emerald-600" />
                      <div>
                        <p className="text-xs font-bold">4K Ultra HD</p>
                        <p className="text-[10px] text-slate-500">600 a 1200 DPI</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQuality("600dpi")}
                      className={`flex items-center gap-2 p-2 rounded-xl border-2 text-left transition ${
                        quality === "600dpi"
                          ? "border-cyan-500 bg-cyan-50 text-cyan-950 font-bold shadow-sm"
                          : "border-slate-200 hover:border-slate-300 bg-white text-slate-800"
                      }`}
                    >
                      <ShieldCheck className="h-4 w-4 text-cyan-600" />
                      <div>
                        <p className="text-xs font-bold">600 DPI Real</p>
                        <p className="text-[10px] text-slate-500">Padrão Gráfica</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                <span>Resolução do arquivo gerado:</span>
                <span className="font-mono font-bold text-slate-900">
                  {quality === "4k-ultra" ? formatDimensions.res4k : formatDimensions.res600}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Business & Plate Selection */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Radio className="h-4 w-4 text-cyan-600" />
                Vínculo com Empresa & Placa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs font-semibold">Empresa / Estabelecimento</Label>
                <select
                  value={selectedBusinessId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedBusinessId(id);
                    const match = tags.find((t) => t.businessId === id);
                    if (match) setSelectedTagId(match.id);
                  }}
                  className="mt-1 flex h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.segment ? `(${b.segment})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Placa / Tag Específica</Label>
                  <span className="text-[11px] text-cyan-700 font-medium">
                    {businessTags.length} placas desta empresa
                  </span>
                </div>
                <select
                  value={selectedTagId}
                  onChange={(e) => setSelectedTagId(Number(e.target.value))}
                  className="mt-1 flex h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {businessTags.length === 0 ? (
                    <option value={0}>Nenhuma placa criada para esta empresa ainda</option>
                  ) : (
                    businessTags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.plateNumber ? `[${t.plateNumber}] ` : ""}
                        {t.label} ({t.code}) - Destino: {t.destinationType}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Target URL Info */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs">
                <p className="text-slate-500 font-medium">URL Dinâmica Gravada no QR / NFC:</p>
                <p className="font-mono text-cyan-700 font-semibold break-all mt-0.5">
                  {targetUrl}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Text Customization Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Textos da Arte Gráfica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Nome da Empresa em Destaque (Dourado)</Label>
                <Input
                  value={customBusinessName}
                  onChange={(e) => setCustomBusinessName(e.target.value.toUpperCase())}
                  placeholder="EX: DANI PONTELLO"
                  className="font-bold uppercase tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Linha Superior 1</Label>
                  <Input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Linha Superior 2</Label>
                  <Input
                    value={customSubtitle}
                    onChange={(e) => setCustomSubtitle(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Frase de Apoio</Label>
                <Input
                  value={customFooterTagline}
                  onChange={(e) => setCustomFooterTagline(e.target.value)}
                  className="text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Visual Preview Column (Renders the Master Vector SVG directly!) */}
        <div className="flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pré-Visualização Vetorial Idêntica ao Download ({formatDimensions.label})
            </span>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-white">
                {theme === "dark-gold" ? "🌙 Preto Luxo" : "☀️ Acrílico Clean"}
              </Badge>
              <Badge className="bg-emerald-600 text-white">
                {quality === "4k-ultra" ? "4K Ultra" : "600 DPI"}
              </Badge>
            </div>
          </div>

          {/* Master Vector SVG Preview Box */}
          <div
            className="w-full max-w-[420px] rounded-[26px] overflow-hidden shadow-2xl border border-slate-200 transition-all select-none"
            style={{
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.4)",
            }}
            dangerouslySetInnerHTML={{ __html: masterSvgString }}
          />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> 100% Fiel à Arte Original
            </span>
            <span>•</span>
            <span>Vetor SVG e PNG 4K gerados da mesma matriz</span>
            <span>•</span>
            <span>Cantoneiras de design no QR e Smartphone detalhado</span>
          </div>
        </div>
      </div>

      {/* Modal: Gerar Lote de Placas Sequenciais */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-amber-500" />
              Gerar Lote de Placas Sequenciais
            </DialogTitle>
            <DialogDescription>
              Crie de 1 a 200 placas físicas com identificadores sequenciais (ex: PLACA-001 a PLACA-100)
              já preparadas com links dinâmicos e prontas para impressão em massa.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBatch} className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-semibold">Empresa Destino</Label>
              <select
                value={selectedBusinessId}
                onChange={(e) => setSelectedBusinessId(Number(e.target.value))}
                className="mt-1 flex h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Prefixo da Placa</Label>
                <Input
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value)}
                  placeholder="PLACA-"
                  className="mt-1 font-mono uppercase"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Número Inicial</Label>
                <Input
                  type="number"
                  min="1"
                  value={batchStartNum}
                  onChange={(e) => setBatchStartNum(e.target.value)}
                  className="mt-1 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Quantidade de Placas</Label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {["10", "25", "50", "100"].map((qty) => (
                  <Button
                    key={qty}
                    type="button"
                    variant={batchCount === qty ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBatchCount(qty)}
                    className="font-mono"
                  >
                    {qty}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                min="1"
                max="200"
                value={batchCount}
                onChange={(e) => setBatchCount(e.target.value)}
                placeholder="Ou digite outra quantidade (máx 200)"
                className="mt-2 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">URL de Destino Inicial (Opcional)</Label>
              <Input
                type="url"
                value={batchUrl}
                onChange={(e) => setBatchUrl(e.target.value)}
                placeholder="https://g.page/r/.../review (pode alterar depois no painel)"
                className="mt-1 text-xs"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Todas as placas terão links individuais de redirecionamento dinâmico. Você pode alterar o destino de cada placa a qualquer momento no painel.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBatchModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createBatch.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
              >
                {createBatch.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Criar {batchCount} Placas no Sistema
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
