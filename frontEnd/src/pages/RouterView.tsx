import { RefreshCw, Router } from "lucide-react";
import { Button, Card, FormField, Input, PageIntro, SectionHeader } from "../components/ui";

export default function RouterView() {
  const connected = true;

  const metrics = [
    { label: "Hôte MikroTik", value: "192.168.1.1" },
    { label: "Port API REST", value: "8728" },
    { label: "Version RouterOS", value: "7.12.1" },
    { label: "Uptime", value: "14d 06:42:11" },
    { label: "CPU Load", value: "12%" },
    { label: "RAM utilisée", value: "38 / 256 MB" },
    { label: "Bails DHCP actifs", value: "8" },
    { label: "Simple Queues", value: "6" },
  ];

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <PageIntro
        icon={Router}
        tone="success"
        title={connected ? "Connecté au routeur MikroTik" : "Routeur déconnecté"}
        description="Surveillance rapide de l’API, du CPU, de la RAM et des règles réseau utilisées par la plateforme."
        action={
          <Button variant="secondary" className="w-full sm:w-auto">
            <RefreshCw size={14} /> Tester connexion
          </Button>
        }
      />

      <Card className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className="animate-soft-in rounded-2xl border border-border bg-muted/45 px-4 py-3"
              style={{ animationDelay: `${index * 25}ms` }}
            >
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{metric.label}</span>
              <div className="mt-1 text-sm font-semibold text-foreground">{metric.value}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <SectionHeader title="Configuration API Backend" subtitle="Gardez ces valeurs dans votre backend en production, jamais dans le frontend public." />
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <FormField label="URL MikroTik REST API">
                <Input defaultValue="http://192.168.1.1:8728/rest" />
              </FormField>
            </div>
            <FormField label="Utilisateur API">
              <Input defaultValue="api_user" />
            </FormField>
            <FormField label="Mot de passe API">
              <Input type="password" defaultValue="supersecret" />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="URL Django Backend">
                <Input defaultValue="https://api.monreseau.bf/v1" />
              </FormField>
            </div>
            <FormField label="Timeout requête (secondes)">
              <Input type="number" defaultValue="10" />
            </FormField>
          </div>
          <div className="mt-5 flex justify-end border-t border-border pt-4">
            <Button variant="primary">Sauvegarder</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
