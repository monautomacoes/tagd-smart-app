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
  // Verify PNG signature
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return blob;
  const phys = createPhysChunk(dpi);
  const combined = new Uint8Array(bytes.length + phys.length);
  combined.set(bytes.subarray(0, 33), 0);
  combined.set(phys, 33);
  combined.set(bytes.subarray(33), 33 + phys.length);
  return new Blob([combined], { type: "image/png" });
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

  // Print function
  const handlePrint = () => {
    const plateId = currentTag?.plateNumber || currentTag?.code || "001";
    const name = customBusinessName || currentBusiness?.name || "PLACA";
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
          <title>Impressão Placa - ${name} - ${plateId}</title>
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
              position: relative;
              background: ${theme === "dark-gold" ? "#000000" : "#0284c7"};
              border-radius: ${isCard ? "3.5mm" : "6mm"};
              overflow: hidden;
              box-shadow: 0 10px 25px rgba(0,0,0,0.15);
              display: flex;
              flex-direction: column;
              page-break-inside: avoid;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
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
            ${document.getElementById("plate-print-target")?.innerHTML || ""}
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

  // Ultra HD 4K & 600+ DPI PNG Download
  const handleDownloadPng = async () => {
    try {
      setIsGeneratingPng(true);
      const is10x10 = format === "10x10";
      const isCard = format === "5.4x8.5";

      // 4K Ultra HD Dimensions (up to 4000px, >1000 DPI)
      let canvasWidth = 4000;
      let canvasHeight = 4000;

      if (isCard) {
        canvasWidth = quality === "4k-ultra" ? 2550 : 1276;
        canvasHeight = quality === "4k-ultra" ? 4016 : 2008;
      } else if (is10x10) {
        canvasWidth = quality === "4k-ultra" ? 4000 : 2362;
        canvasHeight = quality === "4k-ultra" ? 4000 : 2362;
      } else {
        // 10x15
        canvasWidth = quality === "4k-ultra" ? 3600 : 2362;
        canvasHeight = quality === "4k-ultra" ? 5400 : 3543;
      }

      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("Não foi possível inicializar o Canvas.");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Background Top
      const isDark = theme === "dark-gold";
      ctx.fillStyle = isDark ? "#060709" : "#0284c7";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Bottom Half (White)
      const dividerY = canvasHeight * (isCard ? 0.46 : 0.44);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, dividerY, canvasWidth, canvasHeight - dividerY);

      // Google Color Gradient Ribbon
      const ribbonHeight = canvasHeight * 0.016;
      const ribbonY = dividerY - ribbonHeight / 2;
      const ribbonGrad = ctx.createLinearGradient(0, 0, canvasWidth, 0);
      ribbonGrad.addColorStop(0.0, "#EA4335");
      ribbonGrad.addColorStop(0.3, "#FBBC05");
      ribbonGrad.addColorStop(0.65, "#34A853");
      ribbonGrad.addColorStop(1.0, "#4285F4");
      ctx.fillStyle = ribbonGrad;
      ctx.fillRect(0, ribbonY, canvasWidth, ribbonHeight);

      // Draw Top Stars (5 Stars)
      const starCount = 5;
      const starSize = canvasWidth * 0.055;
      const starsTotalWidth = starCount * starSize * 1.5;
      const starStartX = (canvasWidth - starsTotalWidth) / 2 + starSize * 0.75;
      const starY = canvasHeight * 0.08;

      ctx.fillStyle = "#fbbf24";
      ctx.shadowColor = "rgba(251, 191, 36, 0.6)";
      ctx.shadowBlur = Math.round(canvasWidth * 0.01);
      for (let i = 0; i < starCount; i++) {
        drawStar(ctx, starStartX + i * (starSize * 1.45), starY, 5, starSize, starSize / 2);
      }
      ctx.shadowBlur = 0;

      // Draw Header Text
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(canvasWidth * 0.038)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(customTitle, canvasWidth / 2, starY + canvasHeight * 0.075);

      ctx.font = `900 ${Math.round(canvasWidth * 0.05)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(customSubtitle, canvasWidth / 2, starY + canvasHeight * 0.135);

      // Draw Business Name in Gold
      const goldY = starY + canvasHeight * 0.21;
      const goldGrad = ctx.createLinearGradient(0, goldY - 30, canvasWidth, goldY + 10);
      goldGrad.addColorStop(0.0, "#fef08a");
      goldGrad.addColorStop(0.5, "#f59e0b");
      goldGrad.addColorStop(1.0, "#d97706");

      ctx.fillStyle = goldGrad;
      ctx.shadowColor = "rgba(245, 158, 11, 0.4)";
      ctx.shadowBlur = Math.round(canvasWidth * 0.015);
      ctx.font = `900 ${Math.round(canvasWidth * 0.068)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const displayName = customBusinessName || currentBusiness?.name?.toUpperCase() || "DANI PONTELLO";
      ctx.fillText(displayName, canvasWidth / 2, goldY);
      ctx.shadowBlur = 0;

      // Golden underline
      const nameWidth = Math.min(ctx.measureText(displayName).width + canvasWidth * 0.05, canvasWidth * 0.85);
      ctx.strokeStyle = goldGrad;
      ctx.lineWidth = Math.max(4, Math.round(canvasWidth * 0.003));
      ctx.beginPath();
      ctx.moveTo((canvasWidth - nameWidth) / 2, goldY + canvasHeight * 0.015);
      ctx.lineTo((canvasWidth + nameWidth) / 2, goldY + canvasHeight * 0.015);
      ctx.stroke();

      // Top Tagline
      ctx.fillStyle = isDark ? "#e2e8f0" : "#f8fafc";
      ctx.font = `500 ${Math.round(canvasWidth * 0.026)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(customFooterTagline, canvasWidth / 2, goldY + canvasHeight * 0.065);

      // Draw Center Google "G" Badge
      const badgeRadius = canvasWidth * 0.085;
      const badgeY = dividerY;
      ctx.save();
      ctx.beginPath();
      ctx.arc(canvasWidth / 2, badgeY, badgeRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = Math.round(canvasWidth * 0.015);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Load and draw Google G SVG into the badge
      const googleSvgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="%23EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="%234285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="%23FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="%2334A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
      const googleImg = new Image();
      await new Promise<void>((resolve) => {
        googleImg.onload = () => {
          const gSize = badgeRadius * 1.25;
          ctx.drawImage(googleImg, canvasWidth / 2 - gSize / 2, badgeY - gSize / 2, gSize, gSize);
          resolve();
        };
        googleImg.src = googleSvgUrl;
      });

      // Bottom Section:
      // Left: NFC Phone Illustration + Text
      const leftColCenterX = canvasWidth * 0.28;
      const rightColCenterX = canvasWidth * 0.72;
      const bottomContentTop = dividerY + canvasHeight * 0.09;

      // Left Column Text
      ctx.fillStyle = "#0f172a";
      ctx.font = `bold ${Math.round(canvasWidth * 0.038)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText("Aproxime seu celular", leftColCenterX, bottomContentTop);

      // Draw Smartphone vector
      const phoneW = canvasWidth * 0.2;
      const phoneH = phoneW * 1.8;
      const phoneX = leftColCenterX - phoneW / 2;
      const phoneY = bottomContentTop + canvasHeight * 0.03;

      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = Math.max(6, Math.round(canvasWidth * 0.012));
      ctx.lineJoin = "round";
      ctx.strokeRect(phoneX, phoneY, phoneW, phoneH);

      // NFC icon inside phone
      ctx.fillStyle = "#0f172a";
      ctx.font = `bold ${Math.round(phoneW * 0.26)}px monospace`;
      ctx.fillText("NFC", leftColCenterX, phoneY + phoneH * 0.52);

      // Radio waves radiating from phone
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = Math.max(4, Math.round(canvasWidth * 0.008));
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(phoneX + phoneW * 0.85, phoneY + phoneH * 0.35, phoneW * (0.25 * r), -Math.PI * 0.8, -Math.PI * 0.1);
        ctx.stroke();
      }

      // Left Subtext
      ctx.fillStyle = "#64748b";
      ctx.font = `600 ${Math.round(canvasWidth * 0.024)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText("Sem aplicativo • Direto no celular", leftColCenterX, phoneY + phoneH + canvasHeight * 0.045);

      // Center Divider: "OU"
      ctx.fillStyle = "#0f172a";
      ctx.font = `900 ${Math.round(canvasWidth * 0.045)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText("OU", canvasWidth / 2, phoneY + phoneH * 0.5);

      // Right Column: QR Code + Text
      const qrSize = canvasWidth * 0.32;
      const qrX = rightColCenterX - qrSize / 2;
      const qrY = phoneY + (phoneH - qrSize) / 2 - canvasHeight * 0.02;

      // Draw QR image
      if (qrDataUrl) {
        const qrImg = new Image();
        await new Promise<void>((resolve) => {
          qrImg.onload = () => {
            // Crisp rendering
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

            // Center Google G badge over QR Code
            const miniGSize = qrSize * 0.22;
            const miniGX = rightColCenterX - miniGSize / 2;
            const miniGY = qrY + qrSize / 2 - miniGSize / 2;
            ctx.beginPath();
            ctx.arc(rightColCenterX, qrY + qrSize / 2, miniGSize * 0.65, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.drawImage(googleImg, miniGX, miniGY, miniGSize, miniGSize);

            resolve();
          };
          qrImg.src = qrDataUrl;
        });
      }

      // Right Subtexts
      ctx.fillStyle = "#0f172a";
      ctx.font = `bold ${Math.round(canvasWidth * 0.038)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText("Aponte a câmera", rightColCenterX, phoneY + phoneH + canvasHeight * 0.015);

      ctx.fillStyle = "#0284c7";
      ctx.font = `600 ${Math.round(canvasWidth * 0.024)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText("⚡ Avalie em 3 segundos", rightColCenterX, phoneY + phoneH + canvasHeight * 0.045);

      // Absolute Footer Credit
      const plateNumberLabel = currentTag?.plateNumber || currentTag?.code || displayName;
      ctx.fillStyle = "#94a3b8";
      ctx.font = `500 ${Math.round(canvasWidth * 0.019)}px monospace`;
      ctx.fillText(
        `CHIP NFC NTAG215 • ID: ${plateNumberLabel} • ALF AUTOMAÇÃO`,
        canvasWidth / 2,
        canvasHeight - canvasHeight * 0.025
      );

      // Convert Canvas to Blob and inject 600 DPI / 1000 DPI pHYs Chunk
      canvas.toBlob(
        async (rawBlob) => {
          if (!rawBlob) throw new Error("Falha ao exportar imagem.");
          const targetDpi = quality === "4k-ultra" ? 1000 : 600;
          const finalBlob = await addDpiToPng(rawBlob, targetDpi);
          const link = document.createElement("a");
          link.download = `PLACA-${displayName}-${plateNumberLabel}-${format}-${quality}.png`;
          link.href = URL.createObjectURL(finalBlob);
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(link.href);
          toast.success(
            `Imagem Ultra HD 4K (${targetDpi} DPI com metadados físicos) baixada com sucesso!`
          );
        },
        "image/png"
      );
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao gerar PNG: ${err?.message || "falha no canvas"}`);
    } finally {
      setIsGeneratingPng(false);
    }
  };

  // Download Vector SVG (Infinite DPI)
  const handleDownloadSvg = () => {
    try {
      setIsGeneratingSvg(true);
      const isCard = format === "5.4x8.5";
      const is10x10 = format === "10x10";
      const widthMm = isCard ? 54 : 100;
      const heightMm = isCard ? 85 : is10x10 ? 100 : 150;
      const viewBoxWidth = 1000;
      const viewBoxHeight = Math.round((heightMm / widthMm) * 1000);
      const displayName = customBusinessName || currentBusiness?.name?.toUpperCase() || "DANI PONTELLO";
      const plateNumberLabel = currentTag?.plateNumber || currentTag?.code || displayName;

      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="50%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <linearGradient id="googleRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#EA4335" />
      <stop offset="30%" stop-color="#FBBC05" />
      <stop offset="65%" stop-color="#34A853" />
      <stop offset="100%" stop-color="#4285F4" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Fundo Superior -->
  <rect x="0" y="0" width="${viewBoxWidth}" height="${viewBoxHeight}" fill="${theme === "dark-gold" ? "#060709" : "#0284c7"}" />

  <!-- Fundo Inferior Branco -->
  <rect x="0" y="${Math.round(viewBoxHeight * 0.44)}" width="${viewBoxWidth}" height="${Math.round(viewBoxHeight * 0.56)}" fill="#ffffff" />

  <!-- Fita Colorida Google -->
  <rect x="0" y="${Math.round(viewBoxHeight * 0.435)}" width="${viewBoxWidth}" height="${Math.round(viewBoxHeight * 0.016)}" fill="url(#googleRibbon)" />

  <!-- 5 Estrelas Douradas -->
  <g fill="#fbbf24" stroke="#d97706" stroke-width="2">
    ${[...Array(5)]
      .map(
        (_, i) =>
          `<polygon points="10,1 4,19.8 19,7.8 1,7.8 16,19.8" transform="translate(${350 + i * 65}, ${Math.round(viewBoxHeight * 0.065)}) scale(2.8)" />`
      )
      .join("")}
  </g>

  <!-- Textos do Topo -->
  <text x="500" y="${Math.round(viewBoxHeight * 0.16)}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="34" fill="#ffffff" letter-spacing="3">${customTitle}</text>
  <text x="500" y="${Math.round(viewBoxHeight * 0.22)}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="46" fill="#ffffff" letter-spacing="2">${customSubtitle}</text>

  <!-- Nome da Empresa em Ouro -->
  <text x="500" y="${Math.round(viewBoxHeight * 0.31)}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="62" fill="url(#goldGrad)" letter-spacing="2" filter="url(#shadow)">${displayName}</text>
  <line x1="200" y1="${Math.round(viewBoxHeight * 0.33)}" x2="800" y2="${Math.round(viewBoxHeight * 0.33)}" stroke="url(#goldGrad)" stroke-width="4" />

  <!-- Subtítulo -->
  <text x="500" y="${Math.round(viewBoxHeight * 0.38)}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="500" font-size="24" fill="#e2e8f0">${customFooterTagline}</text>

  <!-- Badge Google Central -->
  <circle cx="500" cy="${Math.round(viewBoxHeight * 0.443)}" r="75" fill="#ffffff" filter="url(#shadow)" />
  <g transform="translate(450, ${Math.round(viewBoxHeight * 0.443 - 50)}) scale(2.1)">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </g>

  <!-- Coluna Esquerda: NFC -->
  <text x="270" y="${Math.round(viewBoxHeight * 0.55)}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="34" fill="#0f172a">Aproxime seu celular</text>
  <rect x="200" y="${Math.round(viewBoxHeight * 0.58)}" width="140" height="240" rx="20" fill="#f8fafc" stroke="#1e293b" stroke-width="8"/>
  <rect x="235" y="${Math.round(viewBoxHeight * 0.68)}" width="70" height="40" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <text x="270" y="${Math.round(viewBoxHeight * 0.71)}" text-anchor="middle" font-family="monospace" font-weight="900" font-size="22" fill="#0f172a">NFC</text>
  <text x="270" y="${Math.round(viewBoxHeight * 0.88)}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="600" font-size="20" fill="#64748b">Sem aplicativo • Direto no celular</text>

  <!-- Centro: OU -->
  <circle cx="500" cy="${Math.round(viewBoxHeight * 0.70)}" r="32" fill="#f1f5f9" />
  <text x="500" y="${Math.round(viewBoxHeight * 0.71)}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="30" fill="#0f172a">OU</text>

  <!-- Coluna Direita: QR Code -->
  ${qrDataUrl ? `<image href="${qrDataUrl}" x="575" y="${Math.round(viewBoxHeight * 0.57)}" width="270" height="270" />` : ""}
  <text x="710" y="${Math.round(viewBoxHeight * 0.88)}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="34" fill="#0f172a">Aponte a câmera</text>
  <text x="710" y="${Math.round(viewBoxHeight * 0.92)}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="22" fill="#0284c7">⚡ Avalie em 3 segundos</text>

  <!-- Rodapé Técnico -->
  <text x="500" y="${Math.round(viewBoxHeight * 0.975)}" text-anchor="middle" font-family="monospace" font-size="16" fill="#94a3b8" letter-spacing="3">CHIP NFC NTAG215 • ID: ${plateNumberLabel} • ALF AUTOMAÇÃO</text>
</svg>`;

      const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
      const link = document.createElement("a");
      link.download = `PLACA-${displayName}-${plateNumberLabel}-${format}-VETOR.svg`;
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
            Exporte arquivos em <b>4K Ultra HD (600 a 1200 DPI)</b> e <b>Vetor SVG infinito</b> prontos
            para envio à gráfica rápida, fabricantes de acrílico ou corte a laser.
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

        {/* Live Visual Preview Column */}
        <div className="flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pré-Visualização em Tempo Real ({formatDimensions.label})
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

          {/* Interactive Plate Card Canvas Mockup */}
          <div
            id="plate-print-target"
            className={`relative w-full max-w-[420px] ${formatDimensions.aspectRatio} overflow-hidden rounded-[26px] shadow-2xl transition-all duration-300 flex flex-col justify-between select-none ${
              theme === "dark-gold" ? "bg-[#060709] text-white" : "bg-sky-600 text-white"
            }`}
            style={{
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.4)",
            }}
          >
            {/* Top Half: Dark / Brand Colors */}
            <div className="relative pt-6 px-6 pb-8 text-center flex flex-col items-center justify-center flex-1">
              {/* 5 Stars */}
              <div className="flex items-center justify-center gap-1.5 mb-2.5">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-5 h-5 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.6)]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              {/* Title & Subtitle */}
              <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-white/90">
                {customTitle}
              </p>
              <h3 className="text-sm md:text-base font-extrabold tracking-wider uppercase text-white mt-0.5">
                {customSubtitle}
              </h3>

              {/* Business Name in Golden Glow */}
              <div className="my-2 text-center w-full px-2">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(245,158,11,0.5)]">
                  {customBusinessName || currentBusiness?.name || "DANI PONTELLO"}
                </h2>
                <div className="mx-auto mt-1 h-[2px] w-3/4 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
              </div>

              {/* Sub-tagline */}
              <p className="text-[10px] md:text-[11px] text-slate-200 font-medium max-w-[280px] leading-tight">
                {customFooterTagline}
              </p>
            </div>

            {/* Google Colors Ribbon & Central "G" Badge */}
            <div className="relative w-full z-10">
              <div className="h-1.5 w-full bg-gradient-to-r from-[#EA4335] via-[#FBBC05] via-[#34A853] to-[#4285F4]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-lg border border-slate-100 flex items-center justify-center">
                <svg className="w-8 h-8" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
              </div>
            </div>

            {/* Bottom Half: White Background with NFC & QR Dual Columns */}
            <div className="bg-white text-slate-900 pt-7 px-4 pb-4 flex flex-col justify-between flex-1">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 my-auto">
                {/* Left Column: NFC Smartphone */}
                <div className="flex flex-col items-center text-center">
                  <p className="text-[11px] font-bold text-slate-900 tracking-tight">
                    Aproxime seu celular
                  </p>

                  <div className="relative my-2 w-16 h-24 border-2 border-slate-800 rounded-xl flex flex-col items-center justify-center bg-slate-50 shadow-inner">
                    {/* NFC wave overlay */}
                    <div className="absolute -top-1 -right-2 text-blue-600">
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2a10 10 0 0 1 10 10" />
                        <path d="M12 6a6 6 0 0 1 6 6" />
                      </svg>
                    </div>
                    <span className="font-mono text-xs font-black text-slate-800 border border-slate-300 rounded px-1 py-0.5 bg-white shadow-xs">
                      NFC
                    </span>
                  </div>

                  <p className="text-[8px] font-semibold text-slate-500 leading-tight">
                    Sem aplicativo • Direto no celular
                  </p>
                </div>

                {/* Center "OU" */}
                <div className="flex flex-col items-center justify-center px-1">
                  <span className="text-xs font-black text-slate-900 bg-slate-100 rounded-full px-2 py-1">
                    OU
                  </span>
                </div>

                {/* Right Column: QR Code */}
                <div className="flex flex-col items-center text-center">
                  <div className="relative p-1 rounded-xl bg-white shadow-sm border border-slate-200">
                    {qrDataUrl ? (
                      <div className="relative">
                        <img
                          src={qrDataUrl}
                          alt="QR Code Dinâmico"
                          className="w-24 h-24 object-contain"
                        />
                        {/* Mini Google G logo badge over center of QR */}
                        <div className="absolute inset-0 m-auto w-6 h-6 rounded-full bg-white p-0.5 shadow-sm border border-slate-100 flex items-center justify-center">
                          <svg className="w-4 h-4" viewBox="0 0 48 48">
                            <path
                              fill="#EA4335"
                              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                            />
                            <path
                              fill="#4285F4"
                              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                            />
                            <path
                              fill="#34A853"
                              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                            />
                          </svg>
                        </div>
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-slate-100 flex items-center justify-center">
                        <QrCode className="w-8 h-8 text-slate-400 animate-pulse" />
                      </div>
                    )}
                  </div>

                  <p className="mt-1 text-[11px] font-bold text-slate-900 leading-tight">
                    Aponte a câmera
                  </p>
                  <p className="text-[8px] font-semibold text-cyan-700 leading-tight">
                    ⚡ Avalie em 3 segundos
                  </p>
                </div>
              </div>

              {/* Absolute Technical Micro Footer */}
              <div className="pt-2 border-t border-slate-100 text-center">
                <p className="font-mono text-[7px] text-slate-400 uppercase tracking-widest">
                  CHIP NFC NTAG215 • ID:{" "}
                  {currentTag?.plateNumber || currentTag?.code || customBusinessName} • ALF AUTOMAÇÃO
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Qualidade Máxima para Gráfica
            </span>
            <span>•</span>
            <span>Metadados Físicos de 600 DPI embutidos no PNG</span>
            <span>•</span>
            <span>Vetor SVG com medidas exatas em milímetros</span>
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

// Helper function to draw star polygons on canvas
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}
