import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, AlertCircle, ArrowUpRight, BriefcaseBusiness, CheckCircle2, Copy, Download, Link2, Loader2, MessageSquareText, Plus, QrCode, Radio, ShieldCheck, Target, Users } from "lucide-react";
import { toast } from "sonner";
import { LocalQr } from "@/components/LocalQr";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const stages = ["lead", "contacted", "demo", "proposal", "won", "lost"] as const;
const stageLabels: Record<string, string> = { lead: "Leads", contacted: "Contatadas", demo: "Demonstração", proposal: "Proposta", won: "Ganhos", lost: "Perdidos" };

type NfcStatus = "idle" | "writing" | "reading" | "success" | "error";

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }
}

type NdefRecordLike = { recordType?: string; data?: unknown };
type NdefReaderLike = {
  write: (message: unknown, options?: { overwrite?: boolean }) => Promise<void>;
  scan: () => Promise<void>;
  addEventListener: (name: string, handler: (event: { message?: { records?: NdefRecordLike[] } }) => void, options?: { once?: boolean }) => void;
};

function getNdefReader(): (new () => NdefReaderLike) | null {
  return (window as unknown as { NDEFReader?: new () => NdefReaderLike }).NDEFReader ?? null;
}

function ndefRecordContainsUrl(record: NdefRecordLike, expectedUrl: string) {
  if (record.recordType !== "url" && record.recordType !== "absolute-url" && record.recordType !== "text") return false;
  if (typeof record.data === "string") return record.data.includes(expectedUrl);
  if (record.data instanceof DataView) return new TextDecoder().decode(record.data.buffer).includes(expectedUrl);
  if (record.data instanceof ArrayBuffer) return new TextDecoder().decode(record.data).includes(expectedUrl);
  return String(record.data ?? "").includes(expectedUrl);
}

async function writeNfcUrl(url: string, onStatus?: (status: NfcStatus, message?: string) => void) {
  const Reader = getNdefReader();
  if (!Reader) {
    await copyText(url);
    const message = "Web NFC não está disponível neste dispositivo. A URL foi copiada; abra NFC Tools no Android e use Gravar → URL.";
    onStatus?.("error", message);
    toast.error(message);
    return;
  }
  onStatus?.("writing", "Aproxime um cartão NFC NDEF não protegido...");
  try {
    const reader = new Reader();
    await reader.write({ records: [{ recordType: "url", data: url }] }, { overwrite: false });
    onStatus?.("success", "URL gravada sem sobrescrever uma tag já preenchida.");
    toast.success("URL gravada no cartão NFC");
  } catch (error) {
    const detail = error instanceof Error && error.name === "NotAllowedError" ? "Permissão NFC negada ou cartão protegido." : "A gravação foi cancelada, o cartão não é NDEF ou não foi aproximado.";
    onStatus?.("error", detail);
    toast.error(detail);
  }
}

async function clearNfcTag(onStatus?: (status: NfcStatus, message?: string) => void): Promise<boolean> {
  const Reader = getNdefReader();
  if (!Reader) {
    const message = "Web NFC não está disponível. No NFC Tools, use Outros → Limpar tag e depois confirme abaixo somente após concluir.";
    onStatus?.("error", message);
    toast.error(message);
    return false;
  }
  onStatus?.("writing", "Aproxime a tag NFC para apagar o conteúdo NDEF...");
  try {
    const reader = new Reader();
    await reader.write({ records: [] }, { overwrite: true });
    onStatus?.("success", "Conteúdo NDEF apagado. A tag física está pronta para uma nova gravação.");
    toast.success("Tag NFC limpa");
    return true;
  } catch (error) {
    const detail = error instanceof Error && error.name === "NotAllowedError" ? "Permissão NFC negada ou tag protegida." : "Não foi possível limpar a tag. Verifique se ela é NDEF e está desbloqueada.";
    onStatus?.("error", detail);
    toast.error(detail);
    return false;
  }
}

async function readNfcTag(expectedUrl: string, onStatus?: (status: NfcStatus, message?: string) => void) {
  const Reader = getNdefReader();
  if (!Reader) {
    const message = "Web NFC não está disponível neste dispositivo. Use NFC Tools para ler e conferir a URL.";
    onStatus?.("error", message);
    toast.error(message);
    return;
  }
  onStatus?.("reading", "Aproxime o cartão NFC e mantenha a tela desbloqueada...");
  try {
    const reader = new Reader();
    reader.addEventListener("readingerror", () => {
      const message = "Não foi possível ler a tag. Confirme que ela é NDEF, está próxima e não está danificada.";
      onStatus?.("error", message);
      toast.error(message);
    }, { once: true });
    reader.addEventListener("reading", event => {
      const records = event.message?.records ?? [];
      const found = records.some(record => ndefRecordContainsUrl(record, expectedUrl));
      const message = found ? "NFC lido: URL dinâmica confirmada." : "NFC lido, mas a URL dinâmica esperada não foi encontrada.";
      onStatus?.(found ? "success" : "error", message);
      toast[found ? "success" : "error"](message);
    }, { once: true });
    await reader.scan();
    onStatus?.("reading", "Leitura ativa. Aproxime o cartão NFC...");
  } catch (error) {
    const message = error instanceof Error && error.name === "NotAllowedError" ? "Permissão NFC negada. Autorize o acesso e tente novamente." : "Não foi possível iniciar a leitura NFC neste dispositivo.";
    onStatus?.("error", message);
    toast.error(message);
  }
}

function Metric({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: typeof Users; accent: string }) {
  return <Card className="border-0 bg-white shadow-sm"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p></div><div className={`rounded-2xl p-3 ${accent}`}><Icon className="h-5 w-5" /></div></CardContent></Card>;
}

export default function Home() {
  const { user, loading, error, login, logout } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { data, isLoading, refetch } = trpc.dashboard.useQuery(undefined, { enabled: Boolean(user) });
  
  const createBusiness = trpc.business.create.useMutation({
    onSuccess: () => {
      toast.success("Empresa cadastrada! Agora crie a primeira placa ou tag.");
      refetch();
      setBusinessName("");
      setSegment("");
      setPhone("");
      setActiveTab("tags");
    },
    onError: e => toast.error(`Não foi possível cadastrar a empresa: ${e.message}`)
  });

  const createOffer = trpc.offer.create.useMutation({
    onSuccess: () => {
      toast.success("Oferta salva com sucesso!");
      refetch();
      setOfferTitle("");
      setOfferDescription("");
    },
    onError: e => toast.error(e.message)
  });

  const createTag = trpc.tag.create.useMutation({
    onSuccess: result => {
      toast.success(`Placa/Tag criada: ${result.code}! Próximo passo: grave a URL no cartão NFC.`);
      refetch();
      setTagLabel("");
      setTagPlateNumber("");
      setTagDestination("");
      setWhatsappPhone("");
      setWhatsappMsg("");
      setInstagramHandle("");
      setGoogleReviewUrl("");
      setWebhookUrl("");
      setNfcTagId(String(result.id));
      setActiveTab("nfc");
    },
    onError: e => toast.error(`Não foi possível criar a tag: ${e.message}`)
  });

  const updatePhysicalStatus = trpc.tag.updatePhysicalStatus.useMutation({
    onSuccess: () => {
      toast.success("Status físico atualizado");
      refetch();
    },
    onError: e => toast.error(e.message)
  });

  const resetPhysicalStatus = trpc.tag.resetPhysicalStatus.useMutation({
    onSuccess: () => {
      toast.success("Status físico resetado; o cadastro da tag foi preservado");
      refetch();
    },
    onError: e => toast.error(e.message)
  });

  const updateDestination = trpc.tag.updateDestination.useMutation({
    onSuccess: () => {
      toast.success("Destino atualizado com sucesso sem precisar regravar o chip!");
      refetch();
    },
    onError: e => toast.error(e.message)
  });

  const updateMultilink = trpc.tag.updateMultilink.useMutation({
    onSuccess: () => {
      toast.success("Página MultiLink salva com sucesso!");
      refetch();
    },
    onError: e => toast.error(e.message)
  });

  const [businessName, setBusinessName] = useState("");
  const [segment, setSegment] = useState("");
  const [phone, setPhone] = useState("");
  const [offerTitle, setOfferTitle] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [offerDays, setOfferDays] = useState("14");

  // Tag Form States
  const [tagBusinessId, setTagBusinessId] = useState("");
  const [tagPlateNumber, setTagPlateNumber] = useState("");
  const [tagLabel, setTagLabel] = useState("");
  const [tagDestination, setTagDestination] = useState("");
  const [tagType, setTagType] = useState<string>("multilink");
  
  // Specific helper fields
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // MultiLink Builder States
  const [multiTagId, setMultiTagId] = useState("");
  const [multiTitle, setMultiTitle] = useState("Nome da Loja");
  const [multiSubtitle, setMultiSubtitle] = useState("Acesse nossos canais");
  const [multiAccent, setMultiAccent] = useState("#06b6d4");
  const [multiBackground, setMultiBackground] = useState("#08111f");
  const [multiButtonColor, setMultiButtonColor] = useState("#ffffff");
  const [multiButtonTextColor, setMultiButtonTextColor] = useState("#08111f");
  const [multiLogoUrl, setMultiLogoUrl] = useState("");
  const [multiLinks, setMultiLinks] = useState({ instagram: "", google: "", whatsapp: "", site: "" });
  const [multiEnabled, setMultiEnabled] = useState({ instagram: true, google: true, whatsapp: true, site: true });

  // NFC State
  const [nfcTagId, setNfcTagId] = useState("");
  const [nfcStatus, setNfcStatus] = useState<NfcStatus>("idle");
  const [nfcMessage, setNfcMessage] = useState("");
  const [nfcCapability, setNfcCapability] = useState<"checking" | "available" | "fallback">("checking");
  const [activeTab, setActiveTab] = useState("overview");
  const [previewOpen, setPreviewOpen] = useState(false);

  const reportNfc = (status: NfcStatus, message = "") => {
    setNfcStatus(status);
    setNfcMessage(message);
  };

  useEffect(() => {
    setNfcCapability(typeof window !== "undefined" && "NDEFReader" in window ? "available" : "fallback");
  }, []);

  // Compute calculated destination based on selected type
  const computedDestinationUrl = useMemo(() => {
    if (tagType === "whatsapp") {
      const clean = whatsappPhone.replace(/\D/g, "");
      const full = clean.length <= 11 && !clean.startsWith("55") ? `55${clean}` : clean;
      return full ? `https://wa.me/${full}${whatsappMsg ? `?text=${encodeURIComponent(whatsappMsg)}` : ""}` : "";
    }
    if (tagType === "instagram") {
      const handle = instagramHandle.trim().replace(/^@/, "");
      return handle ? (handle.startsWith("http") ? handle : `https://www.instagram.com/${handle}/`) : "";
    }
    if (tagType === "google") {
      return googleReviewUrl.trim();
    }
    if (tagType === "webhook") {
      return webhookUrl.trim();
    }
    if (tagType === "multilink") {
      return "";
    }
    return tagDestination.trim();
  }, [tagType, whatsappPhone, whatsappMsg, instagramHandle, googleReviewUrl, webhookUrl, tagDestination]);

  const businesses = data?.businesses ?? [];
  const tags = data?.tags ?? [];
  const offers = data?.offers ?? [];
  const activeTags = tags.filter(tag => tag.status === "active").length;
  const totalScans = tags.reduce((sum, tag) => sum + (tag.scans ?? 0), 0);
  const pipeline = useMemo(() => stages.map(stage => ({ stage, rows: businesses.filter(row => row.stage === stage) })), [businesses]);

  // Filtered tags for instant search by plate number, label or code
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const q = searchQuery.toLowerCase().trim();
    return tags.filter(t => 
      (t.plateNumber && t.plateNumber.toLowerCase().includes(q)) ||
      t.code.toLowerCase().includes(q) ||
      t.label.toLowerCase().includes(q) ||
      (businesses.find(b => b.id === t.businessId)?.name || "").toLowerCase().includes(q)
    );
  }, [tags, searchQuery, businesses]);

  if (loading) return <div className="min-h-screen bg-[#f5f7fb] grid place-items-center text-slate-500">Carregando TagD Smart...</div>;
  
  if (!user) {
    return (
      <main className="min-h-screen bg-[#08111f] px-6 py-12 text-white flex flex-col justify-center">
        <div className="mx-auto max-w-6xl w-full">
          <div className="max-w-3xl py-12">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-200">
              <Radio className="h-4 w-4" /> Plataforma TagD Smart · NFC & QR Code Dinâmico
            </div>
            <h1 className="text-5xl font-semibold tracking-tight md:text-7xl">TagD Smart</h1>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-300">
              Gerencie placas NFC, gere QR Codes dinâmicos com alteração de link em tempo real, construa páginas MultiLink e acompanhe métricas de cliques.
            </p>
            {error && (
              <p className="mt-6 rounded-xl border border-red-300/30 bg-red-300/10 p-4 text-sm text-red-100">
                Sessão expirada ou não iniciada. Clique no botão abaixo para acessar o painel.
              </p>
            )}
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button
                onClick={async () => {
                  try {
                    setIsLoggingIn(true);
                    await login();
                    toast.success("Acesso ao painel liberado com sucesso!");
                  } catch (e: any) {
                    toast.error(`Erro ao entrar: ${e?.message ?? "Falha de autenticação"}`);
                  } finally {
                    setIsLoggingIn(false);
                  }
                }}
                disabled={isLoggingIn}
                size="lg"
                className="bg-cyan-300 text-slate-950 hover:bg-cyan-200 text-base font-semibold px-8 py-6 rounded-xl shadow-lg cursor-pointer"
              >
                {isLoggingIn ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Entrar no painel <ArrowUpRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <p className="mt-6 text-sm text-slate-400">Ambiente seguro para administração de tags NFC, placas físicas e links dinâmicos.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#08111f] text-cyan-300 shadow-sm">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold tracking-tight text-slate-900">TagD Smart</p>
              <p className="text-xs text-slate-500 font-medium">Gestão de Tags NFC & QR Codes</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="font-medium">{user.name ?? user.email ?? "Administrador"}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Atualizar</Button>
            <Button variant="ghost" size="sm" onClick={() => logout()} className="text-red-500 hover:text-red-600 hover:bg-red-50">Sair</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Central de Operação e Placas</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Conecte clientes a ações instantâneas</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Cadastre placas físicas com identificadores únicos, altere destinos sem trocar placas ou reimprimir QR Codes e grave diretamente via Web NFC.
            </p>
          </div>
          <div className="rounded-2xl bg-[#08111f] px-5 py-3 text-white shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-300">Sistema Operacional</p>
            <p className="mt-0.5 text-sm font-semibold">NFC Tools + QR Dinâmico + MultiLink</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Empresas / Clientes" value={businesses.length} icon={BriefcaseBusiness} accent="bg-cyan-100 text-cyan-700" />
          <Metric label="Placas / Tags Ativas" value={activeTags} icon={QrCode} accent="bg-lime-100 text-lime-700" />
          <Metric label="Acessos Registrados" value={totalScans} icon={Link2} accent="bg-violet-100 text-violet-700" />
          <Metric label="Ofertas Ativas" value={offers.length} icon={Target} accent="bg-amber-100 text-amber-700" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <TabsList className="bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <TabsTrigger value="overview" className="rounded-lg">Visão Geral</TabsTrigger>
            <TabsTrigger value="tags" className="rounded-lg font-semibold text-cyan-800">Placas & Tags</TabsTrigger>
            <TabsTrigger value="nfc" className="rounded-lg">Programador NFC</TabsTrigger>
            <TabsTrigger value="multilink" className="rounded-lg">Página MultiLink</TabsTrigger>
            <TabsTrigger value="prospecting" className="rounded-lg">Empresas</TabsTrigger>
            <TabsTrigger value="offers" className="rounded-lg">Ofertas</TabsTrigger>
          </TabsList>

          {/* TAB: PLACAS E TAGS */}
          <TabsContent value="tags" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              {/* Formulário de Criação de Placa/Tag */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Cadastrar Nova Placa / Tag</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={e => {
                      e.preventDefault();
                      createTag.mutate({
                        businessId: Number(tagBusinessId),
                        plateNumber: tagPlateNumber || undefined,
                        label: tagLabel,
                        destinationType: tagType as "google" | "whatsapp" | "instagram" | "tiktok" | "multilink" | "webhook" | "custom",
                        destinationUrl: computedDestinationUrl || undefined,
                        whatsappMessage: tagType === "whatsapp" ? whatsappMsg : undefined,
                      });
                    }}
                  >
                    <div>
                      <Label>Empresa / Cliente</Label>
                      <select
                        className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-cyan-500"
                        value={tagBusinessId}
                        onChange={e => setTagBusinessId(e.target.value)}
                        required
                      >
                        <option value="">Selecione a empresa</option>
                        {businesses.map(row => (
                          <option key={row.id} value={row.id}>
                            {row.name} ({row.segment || "Geral"})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Número da Placa (Físico)</Label>
                        <Input
                          value={tagPlateNumber}
                          onChange={e => setTagPlateNumber(e.target.value)}
                          placeholder="Ex.: PLACA-001"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Identificador impresso na placa</p>
                      </div>
                      <div>
                        <Label>Nome / Local da Tag</Label>
                        <Input
                          value={tagLabel}
                          onChange={e => setTagLabel(e.target.value)}
                          placeholder="Ex.: Balcão Caixa"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Tipo de Ação / Destino</Label>
                      <select
                        className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium focus:ring-2 focus:ring-cyan-500"
                        value={tagType}
                        onChange={e => setTagType(e.target.value)}
                      >
                        <option value="multilink">🌐 Mini Site / Página MultiLink (Bento)</option>
                        <option value="google">⭐ Avaliação no Google (Google Reviews 5 Estrelas)</option>
                        <option value="whatsapp">💬 WhatsApp Direto (Com Mensagem Automática)</option>
                        <option value="instagram">📸 Instagram Profile</option>
                        <option value="webhook">⚡ Automação / Webhook (n8n, Typebot, Make)</option>
                        <option value="custom">🔗 Link Personalizado (Site, Cardápio, PDF)</option>
                      </select>
                    </div>

                    {/* Campos Dinâmicos por Tipo */}
                    {tagType === "whatsapp" && (
                      <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                        <p className="text-xs font-bold text-emerald-900">Configuração do WhatsApp</p>
                        <div>
                          <Label className="text-xs">Número com DDD (apenas números)</Label>
                          <Input
                            placeholder="Ex: 11999998888"
                            value={whatsappPhone}
                            onChange={e => setWhatsappPhone(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Mensagem inicial pré-digitada</Label>
                          <Input
                            placeholder="Ex: Olá! Vim através da placa NFC e gostaria de atendimento."
                            value={whatsappMsg}
                            onChange={e => setWhatsappMsg(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {tagType === "google" && (
                      <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3.5">
                        <p className="text-xs font-bold text-blue-900">Link Oficial do Perfil Google</p>
                        <Input
                          type="url"
                          placeholder="https://g.page/r/.../review ou https://search.google.com/local/writereview..."
                          value={googleReviewUrl}
                          onChange={e => setGoogleReviewUrl(e.target.value)}
                          required
                        />
                        <p className="text-[11px] text-blue-800">
                          Cole o link obtido no painel do Google Meu Negócio em "Solicitar avaliações".
                        </p>
                      </div>
                    )}

                    {tagType === "instagram" && (
                      <div className="space-y-3 rounded-xl border border-pink-200 bg-pink-50/60 p-3.5">
                        <p className="text-xs font-bold text-pink-900">Perfil do Instagram</p>
                        <Input
                          placeholder="@nomedaloja ou https://instagram.com/nomedaloja"
                          value={instagramHandle}
                          onChange={e => setInstagramHandle(e.target.value)}
                          required
                        />
                      </div>
                    )}

                    {tagType === "webhook" && (
                      <div className="space-y-3 rounded-xl border border-purple-200 bg-purple-50/60 p-3.5">
                        <p className="text-xs font-bold text-purple-900">URL do Webhook / Automação</p>
                        <Input
                          type="url"
                          placeholder="https://webhook.site/... ou endpoint n8n/Make"
                          value={webhookUrl}
                          onChange={e => setWebhookUrl(e.target.value)}
                          required
                        />
                      </div>
                    )}

                    {tagType === "custom" && (
                      <div className="space-y-3">
                        <Label>URL Destino Completa (HTTPS)</Label>
                        <Input
                          type="url"
                          placeholder="https://meusite.com.br/cardapio"
                          value={tagDestination}
                          onChange={e => setTagDestination(e.target.value)}
                          required
                        />
                      </div>
                    )}

                    {tagType === "multilink" && (
                      <p className="rounded-lg bg-cyan-50 p-3 text-xs text-cyan-900">
                        A página MultiLink será montada na aba <strong>Página MultiLink</strong>. A placa receberá a URL dinâmica da TagD.
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-[#08111f] hover:bg-slate-900 h-11 text-sm font-semibold"
                      disabled={createTag.isPending || !tagBusinessId}
                    >
                      {createTag.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Criar Placa & Gerar QR Dinâmico
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Lista e Busca de Tags */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-lg">Placas Cadastradas ({filteredTags.length})</CardTitle>
                    <div className="w-full sm:w-64">
                      <Input
                        placeholder="Buscar por placa, código ou empresa..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <p className="text-sm text-slate-500">Carregando placas...</p>
                  ) : filteredTags.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-8 text-center">
                      <QrCode className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 font-medium text-sm">Nenhuma placa encontrada</p>
                      <p className="mt-1 text-xs text-slate-500">Cadastre a primeira placa ou limpe o filtro de busca.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[750px] overflow-y-auto pr-1">
                      {filteredTags.map(tag => {
                        const url = `${window.location.origin}/t/${tag.code}`;
                        const bName = businesses.find(b => b.id === tag.businessId)?.name || "Empresa";
                        return (
                          <div key={tag.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {tag.plateNumber && (
                                    <span className="rounded-md bg-[#08111f] px-2 py-0.5 text-xs font-bold text-white tracking-wide">
                                      PLACA #{tag.plateNumber}
                                    </span>
                                  )}
                                  <span className="font-semibold text-slate-900">{tag.label}</span>
                                  <Badge variant="outline" className="text-[11px] font-normal">
                                    {bName}
                                  </Badge>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-800">
                                    <Activity className="h-3 w-3" /> {tag.scans} leituras
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <span className="font-mono text-cyan-700 font-medium">/t/{tag.code}</span>
                                  <span>·</span>
                                  <span className="capitalize font-medium text-slate-700">{tag.destinationType}</span>
                                </div>

                                <p className="text-xs break-all text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                                  {tag.destinationType === "multilink" ? "🌐 Página MultiLink Personalizada" : tag.destinationUrl}
                                </p>
                              </div>

                              <div className="shrink-0 flex justify-center">
                                <LocalQr value={url} label={tag.code} plateNumber={tag.plateNumber} businessName={bName} />
                              </div>
                            </div>

                            {/* Ações Rápidas */}
                            <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t pt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => copyText(url).then(() => toast.success("URL dinâmica copiada"))}
                              >
                                <Copy className="mr-1 h-3 w-3" /> Copiar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs text-cyan-800 border-cyan-300 bg-cyan-50/50 hover:bg-cyan-100"
                                onClick={() => {
                                  setNfcTagId(String(tag.id));
                                  setActiveTab("nfc");
                                }}
                              >
                                <Radio className="mr-1 h-3 w-3" /> Gravar NFC
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => window.open(url, "_blank")}
                              >
                                <Link2 className="mr-1 h-3 w-3" /> Testar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                onClick={async () => {
                                  if (!window.confirm("Isso apaga o conteúdo físico do cartão NFC. O cadastro na plataforma será mantido. Deseja continuar?")) return;
                                  const ok = await clearNfcTag(reportNfc);
                                  if (ok) resetPhysicalStatus.mutate({ id: tag.id });
                                }}
                              >
                                Limpar Chip
                              </Button>
                            </div>

                            {/* Alteração Rápida de Destino */}
                            <div className="mt-3 flex gap-2">
                              <Input
                                defaultValue={tag.destinationUrl}
                                id={`quick-dest-${tag.id}`}
                                className="h-8 text-xs"
                                placeholder="Novo link de destino HTTPS..."
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 text-xs shrink-0 font-medium"
                                onClick={() => {
                                  const val = (document.getElementById(`quick-dest-${tag.id}`) as HTMLInputElement)?.value;
                                  if (!val) return toast.error("Informe a URL");
                                  updateDestination.mutate({
                                    id: tag.id,
                                    destinationType: tag.destinationType,
                                    destinationUrl: val,
                                  });
                                }}
                              >
                                Trocar Destino
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB: PROGRAMADOR NFC */}
          <TabsContent value="nfc" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Radio className="h-5 w-5 text-cyan-700" />
                    Estúdio de Gravação NFC
                  </CardTitle>
                  <div className={`mt-2 rounded-xl px-3.5 py-2.5 text-xs font-medium ${
                    nfcCapability === "available"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-amber-50 text-amber-900 border border-amber-200"
                  }`}>
                    {nfcCapability === "available"
                      ? "⚡ Web NFC Disponível: A gravação por aproximação direta está pronta neste navegador (Chrome Android)."
                      : "📱 Web NFC não detectado no navegador atual: Use o botão de cópia rápida e o app NFC Tools no celular."}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Selecione a Placa / Tag para Gravar</Label>
                    <select
                      className="mt-1.5 flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-medium focus:ring-2 focus:ring-cyan-500"
                      value={nfcTagId}
                      onChange={e => {
                        setNfcTagId(e.target.value);
                        reportNfc("idle");
                      }}
                    >
                      <option value="">Selecione uma placa cadastrada</option>
                      {tags.map(tag => (
                        <option key={tag.id} value={tag.id}>
                          {tag.plateNumber ? `[PLACA #${tag.plateNumber}] ` : ""}{tag.label} · {tag.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {nfcTagId && (() => {
                    const selected = tags.find(tag => String(tag.id) === nfcTagId);
                    if (!selected) return null;
                    const url = `${window.location.origin}/t/${selected.code}`;
                    return (
                      <div className="space-y-4 pt-2">
                        <div className="rounded-xl bg-slate-900 p-4 text-white">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">URL Dinâmica da Placa</p>
                          <p className="mt-1 break-all font-mono text-sm text-cyan-100">{url}</p>
                          <p className="mt-2 text-[11px] text-slate-400">
                            A placa física deve receber <strong>somente</strong> esta URL dinâmica. O destino final pode ser alterado no painel a qualquer momento.
                          </p>
                        </div>

                        <Button
                          variant="default"
                          onClick={() => copyText(url).then(ok => ok ? toast.success("URL dinâmica copiada! Cole no NFC Tools.") : toast.error("Erro ao copiar"))}
                          className="h-12 w-full bg-cyan-700 text-sm font-semibold hover:bg-cyan-800"
                        >
                          <Copy className="mr-2 h-4 w-4" /> Copiar URL para NFC Tools
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            disabled={nfcStatus === "writing" || nfcStatus === "reading"}
                            onClick={() => writeNfcUrl(url, reportNfc)}
                            className="h-12 text-sm font-semibold bg-[#08111f] hover:bg-slate-900"
                          >
                            {nfcStatus === "writing" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radio className="mr-2 h-4 w-4" />}
                            Gravar Chip NFC
                          </Button>
                          <Button
                            disabled={nfcStatus === "writing" || nfcStatus === "reading"}
                            onClick={() => readNfcTag(url, reportNfc)}
                            variant="outline"
                            className="h-12 text-sm font-semibold"
                          >
                            {nfcStatus === "reading" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radio className="mr-2 h-4 w-4" />}
                            Ler / Validar
                          </Button>
                        </div>

                        {nfcStatus !== "idle" && (
                          <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${
                            nfcStatus === "success"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : nfcStatus === "error"
                              ? "border-red-200 bg-red-50 text-red-900"
                              : "border-cyan-200 bg-cyan-50 text-cyan-900"
                          }`}>
                            {nfcStatus === "success" ? (
                              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                            ) : nfcStatus === "error" ? (
                              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                            ) : (
                              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-cyan-600" />
                            )}
                            <div>
                              <p className="font-semibold">
                                {nfcStatus === "writing"
                                  ? "Aproxime o chip NFC do celular..."
                                  : nfcStatus === "reading"
                                  ? "Aguardando aproximação da tag..."
                                  : nfcStatus === "success"
                                  ? "Operação Concluída com Sucesso!"
                                  : "Falha na Operação"}
                              </p>
                              <p className="mt-1 text-xs leading-5">{nfcMessage}</p>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2 border-t pt-3">
                          <Button
                            onClick={() => updatePhysicalStatus.mutate({ id: selected.id, programmingStatus: "programmed", nfcModel: "NTAG213" })}
                            variant="outline"
                            className="h-10 w-full text-xs"
                          >
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-lime-600" />
                            Marcar como Gravada / Programada
                          </Button>
                          <Button
                            onClick={() => {
                              if (!window.confirm("Confirme somente depois de colocar uma senha de escrita no app NFC Tools. A senha física não é enviada para a nuvem por segurança. Deseja marcar como protegida?")) return;
                              updatePhysicalStatus.mutate({
                                id: selected.id,
                                programmingStatus: "protected",
                                nfcModel: "NTAG213",
                                protectionNote: "Protegida contra sobre-escrita no chip físico",
                              });
                            }}
                            className="h-10 w-full bg-[#08111f] text-xs"
                          >
                            <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
                            Confirmar Proteção Física por Senha
                          </Button>
                          <Button
                            variant="outline"
                            disabled={nfcStatus === "writing" || resetPhysicalStatus.isPending}
                            onClick={async () => {
                              if (!window.confirm("Isso apagará o conteúdo NDEF do chip físico para reutilização. O cadastro na plataforma permanece intacto. Deseja continuar?")) return;
                              const cleared = await clearNfcTag(reportNfc);
                              if (cleared) resetPhysicalStatus.mutate({ id: selected.id });
                            }}
                            className="h-10 w-full border-red-300 text-red-700 hover:bg-red-50 text-xs"
                          >
                            Limpar / Formatar Chip Físico
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Guia Estilo NFC Tools */}
              <Card className="border-0 bg-[#08111f] text-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Fluxo de Gravação Padrão NFC Tools</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-300 leading-relaxed">
                  <div className="rounded-xl bg-slate-800/80 p-3.5 border border-slate-700">
                    <p className="font-bold text-cyan-300 text-xs uppercase tracking-wider">Passo 1: Cadastro da Placa</p>
                    <p className="mt-1 text-xs">Cadastre a empresa e a placa física na aba <strong>Placas & Tags</strong>.</p>
                  </div>
                  <div className="rounded-xl bg-slate-800/80 p-3.5 border border-slate-700">
                    <p className="font-bold text-cyan-300 text-xs uppercase tracking-wider">Passo 2: Gravação da URL Dinâmica</p>
                    <p className="mt-1 text-xs">Grave sempre a URL dinâmica gerada (`/t/CODIGO`). <strong>Nunca</strong> grave links finais (como o do WhatsApp ou Instagram diretamente no chip), para permitir alterações futuras.</p>
                  </div>
                  <div className="rounded-xl bg-slate-800/80 p-3.5 border border-slate-700">
                    <p className="font-bold text-cyan-300 text-xs uppercase tracking-wider">Passo 3: Teste de Leitura Real</p>
                    <p className="mt-1 text-xs">Aproxime o cartão do celular sem o app aberto. O navegador abrirá o link, registrará a métrica no painel e redirecionará para a ação configurada.</p>
                  </div>
                  <div className="rounded-xl bg-slate-800/80 p-3.5 border border-slate-700">
                    <p className="font-bold text-cyan-300 text-xs uppercase tracking-wider">Passo 4: Proteção Contra Sobrescrita</p>
                    <p className="mt-1 text-xs">No app <em>NFC Tools</em> ou <em>NXP TagWriter</em>, bloqueie a gravação com senha para que terceiros não alterem o chip na loja.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB: MULTILINK BUILDER */}
          <TabsContent value="multilink" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Personalizar Página MultiLink / Mini Site</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={e => {
                      e.preventDefault();
                      updateMultilink.mutate({
                        id: Number(multiTagId),
                        title: multiTitle,
                        subtitle: multiSubtitle,
                        accent: multiAccent,
                        background: multiBackground,
                        buttonColor: multiButtonColor,
                        buttonTextColor: multiButtonTextColor,
                        logoUrl: multiLogoUrl || undefined,
                        items: (["instagram", "google", "whatsapp", "site"] as const)
                          .map(key => ({
                            key,
                            label:
                              key === "instagram"
                                ? "Instagram"
                                : key === "google"
                                ? "Avalie no Google"
                                : key === "whatsapp"
                                ? "Fale no WhatsApp"
                                : "Visite nosso Site",
                            url: multiLinks[key] || "https://example.com",
                            enabled: multiEnabled[key],
                          }))
                          .filter(item => multiEnabled[item.key as keyof typeof multiEnabled] && multiLinks[item.key as keyof typeof multiLinks]),
                      });
                    }}
                  >
                    <div>
                      <Label>Placa / Tag que abrirá esta página</Label>
                      <select
                        className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-cyan-500"
                        value={multiTagId}
                        onChange={e => setMultiTagId(e.target.value)}
                        required
                      >
                        <option value="">Selecione uma placa</option>
                        {tags.map(tag => (
                          <option key={tag.id} value={tag.id}>
                            {tag.plateNumber ? `[PLACA #${tag.plateNumber}] ` : ""}{tag.label} · {tag.code}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Título / Nome da Empresa</Label>
                        <Input value={multiTitle} onChange={e => setMultiTitle(e.target.value)} placeholder="Café Central" required />
                      </div>
                      <div>
                        <Label>Subtítulo / Descrição</Label>
                        <Input value={multiSubtitle} onChange={e => setMultiSubtitle(e.target.value)} placeholder="Acesse nossos canais oficiais" />
                      </div>
                    </div>

                    <div>
                      <Label>URL da Logomarca (HTTPS)</Label>
                      <Input value={multiLogoUrl} onChange={e => setMultiLogoUrl(e.target.value)} type="url" placeholder="https://seusite.com/logo.png" />
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-1">
                      <div>
                        <Label className="text-[11px]">Fundo</Label>
                        <Input type="color" value={multiBackground} onChange={e => setMultiBackground(e.target.value)} className="h-9 p-1" />
                      </div>
                      <div>
                        <Label className="text-[11px]">Destaque/Logo</Label>
                        <Input type="color" value={multiAccent} onChange={e => setMultiAccent(e.target.value)} className="h-9 p-1" />
                      </div>
                      <div>
                        <Label className="text-[11px]">Botões</Label>
                        <Input type="color" value={multiButtonColor} onChange={e => setMultiButtonColor(e.target.value)} className="h-9 p-1" />
                      </div>
                      <div>
                        <Label className="text-[11px]">Texto Botão</Label>
                        <Input type="color" value={multiButtonTextColor} onChange={e => setMultiButtonTextColor(e.target.value)} className="h-9 p-1" />
                      </div>
                    </div>

                    <div className="space-y-2 border-t pt-3">
                      <p className="text-xs font-bold text-slate-700">Links Ativos na Página</p>
                      {(["instagram", "google", "whatsapp", "site"] as const).map(key => (
                        <div key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={multiEnabled[key]}
                            onChange={e => setMultiEnabled(prev => ({ ...prev, [key]: e.target.checked }))}
                            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          />
                          <Input
                            value={multiLinks[key]}
                            onChange={e => setMultiLinks(prev => ({ ...prev, [key]: e.target.value }))}
                            type="url"
                            placeholder={
                              key === "instagram"
                                ? "https://instagram.com/empresa"
                                : key === "google"
                                ? "https://g.page/r/.../review"
                                : key === "whatsapp"
                                ? "https://wa.me/5511999998888"
                                : "https://siteoficial.com.br"
                            }
                            className="h-9 text-xs"
                          />
                          <span className="w-20 text-xs font-medium text-slate-600 capitalize">{key}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPreviewOpen(true)}
                        className="h-11 flex-1 border-cyan-300 bg-cyan-50 font-semibold text-cyan-900 hover:bg-cyan-100"
                      >
                        <ArrowUpRight className="mr-2 h-4 w-4" /> Prévia no Celular
                      </Button>
                      <Button
                        type="submit"
                        className="h-11 flex-1 bg-cyan-700 hover:bg-cyan-800 text-white font-semibold"
                        disabled={updateMultilink.isPending || !multiTagId}
                      >
                        {updateMultilink.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar MultiLink"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Prévia ao vivo */}
              <div className="flex justify-center items-center">
                <div className="w-full max-w-[320px] rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900 p-1.5 shadow-2xl">
                  <div className="min-h-[520px] overflow-hidden rounded-[2rem] p-6 text-center flex flex-col justify-between" style={{ background: multiBackground }}>
                    <div className="space-y-3 mt-4">
                      {multiLogoUrl ? (
                        <img src={multiLogoUrl} alt="Logo" className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-md" />
                      ) : (
                        <div
                          className="mx-auto grid h-20 w-20 place-items-center rounded-2xl text-2xl font-black shadow-md"
                          style={{ background: multiAccent, color: multiButtonTextColor }}
                        >
                          {multiTitle.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-bold text-white">{multiTitle || "Nome da Loja"}</h3>
                        <p className="text-xs text-slate-300 mt-1">{multiSubtitle || "Acesse nossos canais oficiais"}</p>
                      </div>
                    </div>

                    <div className="space-y-2.5 my-6">
                      {(["instagram", "google", "whatsapp", "site"] as const)
                        .filter(key => multiEnabled[key] && multiLinks[key])
                        .map(key => (
                          <div
                            key={key}
                            className="rounded-xl px-4 py-3 text-xs font-bold shadow-md transition transform active:scale-95"
                            style={{ background: multiButtonColor, color: multiButtonTextColor }}
                          >
                            {key === "instagram" ? "📸 Instagram Oficial" : key === "google" ? "⭐ Avalie no Google" : key === "whatsapp" ? "💬 Fale no WhatsApp" : "🌐 Visite Nosso Site"}
                          </div>
                        ))}
                      {!["instagram", "google", "whatsapp", "site"].some(key => multiEnabled[key as keyof typeof multiEnabled] && multiLinks[key as keyof typeof multiLinks]) && (
                        <p className="rounded-xl border border-white/20 px-4 py-3 text-xs text-white/70">
                          Preencha e ative os links ao lado para ver os botões.
                        </p>
                      )}
                    </div>

                    <p className="text-[10px] text-white/50">⚡ Powered by TagD Smart</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB: VISÃO GERAL */}
          <TabsContent value="overview" className="mt-6">
            <Card className="mb-6 border-0 bg-cyan-50 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-bold text-cyan-950 text-base">Fluxo de Inicialização Rápida</p>
                  <p className="mt-1 text-sm text-cyan-900">
                    1. Cadastre a empresa cliente → 2. Crie a placa ou tag com número identificador → 3. Grave a URL no chip NFC.
                  </p>
                </div>
                <div className="grid w-full gap-2 sm:grid-cols-2 md:w-auto">
                  <Button onClick={() => setActiveTab("prospecting")} className="h-11 bg-cyan-700 px-5 hover:bg-cyan-800">
                    <BriefcaseBusiness className="mr-2 h-4 w-4" /> Cadastrar Empresa
                  </Button>
                  <Button onClick={() => setActiveTab("tags")} variant="outline" className="h-11 border-cyan-300 bg-white px-5">
                    <QrCode className="mr-2 h-4 w-4" /> Criar Placa / Tag
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    Funil Comercial <Badge variant="secondary">{businesses.length} Empresas</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-3">
                    {pipeline.slice(0, 3).map(({ stage, rows }) => (
                      <div key={stage} className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">{stageLabels[stage]}</span>
                          <span className="text-xl font-bold text-slate-900">{rows.length}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {rows.slice(0, 3).map(row => (
                            <div key={row.id} className="rounded-xl bg-white px-3 py-2 text-xs shadow-sm border border-slate-100">
                              <p className="font-semibold text-slate-900">{row.name}</p>
                              <p className="text-[11px] text-slate-500">{row.segment || "Sem segmento"}</p>
                            </div>
                          ))}
                          {rows.length === 0 && <p className="text-xs text-slate-400">Nenhuma empresa</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-[#08111f] text-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Script de Venda e Demonstração</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs leading-6 text-slate-300">
                    “Olá! Nós fornecemos placas inteligentes com NFC e QR Code dinâmico para balcões e mesas. Seu cliente aproxima o celular e acessa imediatamente suas Avaliações do Google, WhatsApp ou Cardápio. E se seu número ou cardápio mudar, você não precisa reimprimir a placa!”
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-cyan-300 font-medium">
                    <MessageSquareText className="h-4 w-4" /> Ideal para abordagem presencial em comércios locais
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB: EMPRESAS */}
          <TabsContent value="prospecting" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Adicionar Empresa / Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={e => {
                      e.preventDefault();
                      createBusiness.mutate({ name: businessName, segment, phone });
                    }}
                  >
                    <div>
                      <Label>Nome da Empresa / Estabelecimento</Label>
                      <Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Ex.: Padaria Bella Vista" required />
                    </div>
                    <div>
                      <Label>Segmento</Label>
                      <Input value={segment} onChange={e => setSegment(e.target.value)} placeholder="Restaurante, Loja, Salão, Clínica..." />
                    </div>
                    <div>
                      <Label>WhatsApp / Contato</Label>
                      <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-8888" />
                    </div>
                    <Button className="w-full bg-[#08111f] hover:bg-slate-900 h-10" disabled={createBusiness.isPending}>
                      <Plus className="mr-2 h-4 w-4" /> Cadastrar Empresa
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Empresas Cadastradas ({businesses.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {businesses.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhuma empresa cadastrada ainda.</p>
                    ) : (
                      businesses.map(row => (
                        <div key={row.id} className="flex items-center justify-between rounded-xl border bg-white p-3.5 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-cyan-50 p-2 text-cyan-700">
                              <BriefcaseBusiness className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-slate-900">{row.name}</p>
                              <p className="text-xs text-slate-500">{row.segment || "Sem segmento"} {row.phone ? `· ${row.phone}` : ""}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">{stageLabels[row.stage]}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB: OFERTAS */}
          <TabsContent value="offers" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Criar Pacote / Oferta</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={e => {
                      e.preventDefault();
                      const validUntil = new Date(Date.now() + Number(offerDays || 14) * 86400000);
                      createOffer.mutate({ title: offerTitle, description: offerDescription, validUntil });
                    }}
                  >
                    <div>
                      <Label>Título da Oferta</Label>
                      <Input value={offerTitle} onChange={e => setOfferTitle(e.target.value)} placeholder="Kit Placa Inteligente NFC + QR Dinâmico" required />
                    </div>
                    <div>
                      <Label>Descrição / Benefícios</Label>
                      <Input value={offerDescription} onChange={e => setOfferDescription(e.target.value)} placeholder="1 Placa acrílica + QR dinâmico + 1 ano de gestão" required />
                    </div>
                    <div>
                      <Label>Validade (em dias)</Label>
                      <Input type="number" min="1" value={offerDays} onChange={e => setOfferDays(e.target.value)} />
                    </div>
                    <Button className="w-full bg-cyan-700 hover:bg-cyan-800 text-white h-10" disabled={createOffer.isPending}>
                      <Plus className="mr-2 h-4 w-4" /> Salvar Oferta
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Ofertas Ativas ({offers.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {offers.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhuma oferta criada ainda.</p>
                    ) : (
                      offers.map(offer => (
                        <div key={offer.id} className="rounded-xl border bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-semibold text-sm text-slate-900">{offer.title}</p>
                              <p className="mt-1 text-xs text-slate-500">{offer.description}</p>
                            </div>
                            <Badge className="bg-lime-100 text-lime-800 hover:bg-lime-100 text-xs">Ativa</Badge>
                          </div>
                          <p className="mt-2 text-[11px] text-slate-400">
                            CTA: {offer.cta}{offer.validUntil ? ` · válida até ${new Date(offer.validUntil).toLocaleDateString("pt-BR")}` : ""}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal Prévia Celular */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md border-0 bg-slate-100 p-4">
          <DialogHeader className="px-2 pt-1">
            <DialogTitle>Prévia no Celular</DialogTitle>
            <DialogDescription>Visualização da página MultiLink antes da gravação no chip NFC.</DialogDescription>
          </DialogHeader>
          <div className="mx-auto w-full max-w-[300px] rounded-[2.2rem] border-[8px] border-slate-900 bg-slate-900 p-1 shadow-2xl">
            <div className="min-h-[480px] overflow-hidden rounded-[1.7rem] p-5 text-center flex flex-col justify-between" style={{ background: multiBackground }}>
              <div className="space-y-3 mt-3">
                {multiLogoUrl ? (
                  <img src={multiLogoUrl} alt="Logo" className="mx-auto h-16 w-16 rounded-2xl object-cover shadow-lg" />
                ) : (
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-xl font-bold shadow-lg" style={{ background: multiAccent, color: multiButtonTextColor }}>
                    {multiTitle.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-white">{multiTitle || "Nome da Loja"}</h3>
                  <p className="text-xs text-slate-300 mt-0.5">{multiSubtitle || "Acesse nossos canais"}</p>
                </div>
              </div>

              <div className="w-full space-y-2.5 my-4">
                {(["instagram", "google", "whatsapp", "site"] as const).filter(key => multiEnabled[key] && multiLinks[key]).map(key => (
                  <div key={key} className="rounded-xl px-4 py-2.5 text-xs font-semibold shadow-md" style={{ background: multiButtonColor, color: multiButtonTextColor }}>
                    {key === "instagram" ? "Instagram" : key === "google" ? "Avalie no Google" : key === "whatsapp" ? "Fale no WhatsApp" : "Visite nosso site"}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/50">⚡ TagD Smart</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
