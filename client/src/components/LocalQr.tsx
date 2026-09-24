import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, QrCode, Printer } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function LocalQr({
  value,
  label,
  plateNumber,
  businessName,
}: {
  value: string;
  label: string;
  plateNumber?: string | null;
  businessName?: string;
}) {
  const [svg, setSvg] = useState("");
  const [png, setPng] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      QRCode.toString(value, { type: "svg", margin: 2, width: 300 }),
      QRCode.toDataURL(value, { margin: 2, width: 1024, errorCorrectionLevel: "H" }),
    ])
      .then(([svgValue, pngValue]) => {
        if (active) {
          setSvg(svgValue);
          setPng(pngValue);
        }
      })
      .catch(() => toast.error("Não foi possível gerar o QR Code"));
    return () => {
      active = false;
    };
  }, [value]);

  const download = (content: string, filename: string, type: string) => {
    if (!content) return;
    const blob = content.startsWith("data:") ? undefined : new Blob([content], { type });
    const href = blob ? URL.createObjectURL(blob) : content;
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (blob) URL.revokeObjectURL(href);
    toast.success(`QR ${filename.endsWith(".svg") ? "SVG" : "PNG"} baixado em alta resolução`);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Placa ${plateNumber || label}</title>
          <style>
            body { font-family: 'Segoe UI', Roboto, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #fff; }
            .card { border: 2px solid #08111f; border-radius: 24px; padding: 32px; text-align: center; width: 320px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
            .header { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #0891b2; margin-bottom: 8px; }
            .title { font-size: 20px; font-weight: 700; color: #08111f; margin: 0 0 16px 0; }
            .qr-wrap { background: #f8fafc; padding: 16px; border-radius: 16px; display: inline-block; }
            .qr-img { width: 220px; height: 220px; }
            .plate-badge { display: inline-block; margin-top: 16px; background: #08111f; color: #fff; padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 13px; letter-spacing: 1px; }
            .nfc-text { font-size: 12px; color: #64748b; margin-top: 12px; }
            .url-text { font-size: 10px; color: #94a3b8; margin-top: 6px; word-break: break-all; font-family: monospace; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">Aproxime ou Escaneie</div>
            <div class="title">${businessName || label}</div>
            <div class="qr-wrap">
              <img src="${png}" class="qr-img" alt="QR Code" />
            </div>
            ${plateNumber ? `<div class="plate-badge">PLACA #${plateNumber}</div>` : `<div class="plate-badge">${label}</div>`}
            <div class="nfc-text">⚡ Compatível com NFC & QR Code Dinâmico</div>
            <div class="url-text">${value}</div>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <div
          className="group relative cursor-pointer rounded-xl border bg-white p-2 shadow-sm transition hover:border-cyan-400"
          onClick={() => setModalOpen(true)}
          title="Clique para expandir o molde da placa"
        >
          <img src={png} alt={`QR Code de ${label}`} className="h-28 w-28" />
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/60 opacity-0 transition group-hover:opacity-100">
            <span className="text-xs font-semibold text-white">Ver Placa</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={!png}
            onClick={() => download(png, `QR-${plateNumber || label}.png`, "image/png")}
          >
            <Download className="mr-1 h-3 w-3" />
            PNG HD
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={!svg}
            onClick={() => download(svg, `QR-${plateNumber || label}.svg`, "image/svg+xml")}
          >
            <QrCode className="mr-1 h-3 w-3" />
            SVG
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={handlePrint}
            title="Imprimir modelo de placa física"
          >
            <Printer className="mr-1 h-3 w-3" />
            Placa
          </Button>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md p-6 text-center">
          <DialogHeader>
            <DialogTitle>Molde da Placa Física</DialogTitle>
            <DialogDescription>
              Modelo de impressão pronto para envio à gráfica ou recorte de acrílico/adesivo.
            </DialogDescription>
          </DialogHeader>

          <div className="mx-auto my-4 w-full max-w-[280px] rounded-3xl border-2 border-slate-900 bg-white p-6 shadow-xl">
            <p className="text-xs font-black uppercase tracking-widest text-cyan-600">Aproxime ou Escaneie</p>
            <h4 className="mt-1 text-lg font-bold text-slate-900">{businessName || label}</h4>
            <div className="my-4 rounded-2xl bg-slate-50 p-3 shadow-inner">
              <img src={png} alt="QR Code" className="mx-auto h-48 w-48" />
            </div>
            {plateNumber && (
              <span className="inline-block rounded-full bg-slate-900 px-4 py-1 text-xs font-bold text-white tracking-wider">
                PLACA #{plateNumber}
              </span>
            )}
            <p className="mt-3 text-[11px] font-medium text-slate-500">⚡ NFC + QR Code Dinâmico</p>
            <p className="mt-1 break-all font-mono text-[9px] text-slate-400">{value}</p>
          </div>

          <div className="flex gap-2 justify-center">
            <Button onClick={handlePrint} className="bg-cyan-700 hover:bg-cyan-800">
              <Printer className="mr-2 h-4 w-4" />
              Imprimir Placa
            </Button>
            <Button
              variant="outline"
              onClick={() => download(png, `PLACA-${plateNumber || label}.png`, "image/png")}
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar Imagem HD
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

