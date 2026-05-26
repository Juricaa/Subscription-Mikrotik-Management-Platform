import { useState } from "react";
import { Button, FormField, Input, Modal, Select } from "./ui";
import { PLANS } from "../types";
import type { Plan, Status, Subscription } from "../types";

interface SubFormProps {
  initial?: Subscription | null;
  prefill?: { mac?: string; ip?: string };
  onSave: (data: Partial<Subscription>) => void;
  onClose: () => void;
}

export function SubForm({ initial, prefill, onSave, onClose }: SubFormProps) {
  const [form, setForm] = useState({
    clientName: initial?.clientName ?? "",
    mac: initial?.mac ?? prefill?.mac ?? "",
    ip: initial?.ip ?? prefill?.ip ?? "",
    rateLimit: (initial?.rateLimit ?? "10M/5M") as Plan,
    expiresAt: initial?.expiresAt ?? "",
    comment: initial?.comment ?? "",
    status: (initial?.status ?? "active") as Status,
  });

  const set = (field: string, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const isEdit = Boolean(initial);

  return (
    <Modal title={isEdit ? "Modifier abonnement" : "Nouvel abonnement"} onClose={onClose} wide>
      {prefill && !isEdit && (
        <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3">
          <p className="font-mono text-[11px] leading-relaxed text-primary">
            Appareil pré-rempli depuis la liste des clients connectés. Vérifiez les informations avant de soumettre.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Nom client">
          <Input placeholder="Hassan Ouédraogo" value={form.clientName} onChange={(event) => set("clientName", event.target.value)} />
        </FormField>
        <FormField label="Adresse MAC">
          <Input placeholder="DC:A6:32:7F:2E:01" value={form.mac} onChange={(event) => set("mac", event.target.value)} />
        </FormField>
        <FormField label="Adresse IP">
          <Input placeholder="192.168.1.xxx" value={form.ip} onChange={(event) => set("ip", event.target.value)} />
        </FormField>
        <FormField label="Rate Limit (↓/↑)">
          <Select value={form.rateLimit} onChange={(event) => set("rateLimit", event.target.value)}>
            {PLANS.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
          </Select>
        </FormField>
        <FormField label="Date expiration">
          <Input type="date" value={form.expiresAt} onChange={(event) => set("expiresAt", event.target.value)} />
        </FormField>
        <FormField label="Statut">
          <Select value={form.status} onChange={(event) => set("status", event.target.value)}>
            <option value="active">Actif</option>
            <option value="suspended">Suspendu</option>
            <option value="expired">Expiré</option>
            <option value="pending">En attente</option>
          </Select>
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Commentaire">
            <Input placeholder="Remarque libre…" value={form.comment} onChange={(event) => set("comment", event.target.value)} />
          </FormField>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button onClick={onClose} variant="secondary" className="w-full sm:w-auto">
          Annuler
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            onSave(form);
            onClose();
          }}
          className="w-full sm:w-auto"
        >
          {isEdit ? "Enregistrer" : "Créer + Appliquer MikroTik"}
        </Button>
      </div>
    </Modal>
  );
}
