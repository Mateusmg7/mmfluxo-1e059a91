import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, RefreshCcw, Database } from "lucide-react";

const BuildStatus = () => {
  const [cacheInfo, setCacheInfo] = useState<{
    swActive: boolean;
    cacheNames: string[];
    currentTime: string;
    buildId: string;
  }>({
    swActive: false,
    cacheNames: [],
    currentTime: new Date().toLocaleString(),
    buildId: "loading...",
  });

  const checkStatus = async () => {
    const swActive = !!navigator.serviceWorker?.controller;
    const cacheNames = await window.caches?.keys() || [];
    
    // Use the build ID from environment variables defined in vite.config.ts
    const buildId = (import.meta as any).env.VITE_BUILD_ID || "development";

    setCacheInfo({
      swActive,
      cacheNames,
      currentTime: new Date().toLocaleString(),
      buildId
    });
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const clearAndReload = async () => {
    if (window.caches) {
      const names = await window.caches.keys();
      await Promise.all(names.map(name => window.caches.delete(name)));
    }
    if (navigator.serviceWorker) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
    }
    window.location.reload();
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl pt-20">
      <Card className="bg-background/60 backdrop-blur-md border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-6 h-6 text-accent" />
            Build & Cache Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-black/20 border border-white/5">
              <p className="text-sm text-muted-foreground mb-1">Service Worker</p>
              <div className="flex items-center gap-2">
                {cacheInfo.swActive ? (
                  <><CheckCircle2 className="w-4 h-4 text-green-500" /> <span className="font-medium">Ativo</span></>
                ) : (
                  <><AlertCircle className="w-4 h-4 text-yellow-500" /> <span className="font-medium">Inativo</span></>
                )}
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-black/20 border border-white/5">
              <p className="text-sm text-muted-foreground mb-1">Caches Detectados</p>
              <p className="font-medium">{cacheInfo.cacheNames.length} buckets</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-black/20 border border-white/5 break-all">
            <p className="text-sm text-muted-foreground mb-1">Build Hash Atual</p>
            <code className="text-xs text-accent font-mono">{cacheInfo.buildId}</code>
          </div>

          <div className="p-4 rounded-lg bg-black/20 border border-white/5">
            <p className="text-sm text-muted-foreground mb-1">Última Verificação</p>
            <p className="font-medium">{cacheInfo.currentTime}</p>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Button onClick={checkStatus} variant="outline" className="w-full">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Atualizar Status
            </Button>
            <Button onClick={clearAndReload} variant="destructive" className="w-full">
              Forçar Limpeza de Cache & Reload
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Se o build hash mudar após um deploy e o Service Worker estiver ativo, 
            o cache-busting está funcionando corretamente.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BuildStatus;
