import { useState } from "react";
import { Edit2, Pause, Play, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, FilterTabs, IconButton, SearchInput, SortableTH, TableCard } from "../components/ui";
import { SubForm } from "../components/SubForm";
import { STATUS_CFG, fmtBytes } from "../types";
import { getQuotaBytes, getQuotaPercent, getSubscriptionUsage } from "../utils/mikrotikQuota";
import type { Status, Subscription } from "../types";

interface SubscriptionsViewProps {
  subs: Subscription[];
  onSave: (data: Partial<Subscription>, id?: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

type SortKey = keyof Subscription;

export default function SubscriptionsView({ subs, onSave, onDelete, onToggle }: SubscriptionsViewProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilter] = useState<Status | "all">("all");
  const [sortCol, setSortCol] = useState<SortKey>("clientName");
  const [sortAsc, setSortAsc] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Subscription | null>(null);

  const handleSort = (col: SortKey) => {
    if (sortCol === col) setSortAsc((value) => !value);
    else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const filtered = subs
    .filter((sub) => {
      const q = search.toLowerCase();
      return (
        (filterStatus === "all" || sub.status === filterStatus) &&
        (sub.clientName.toLowerCase().includes(q) ||
          sub.mac.toLowerCase().includes(q) ||
          sub.ip.includes(q) ||
          sub.comment.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      const av = String(a[sortCol]);
      const bv = String(b[sortCol]);
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const openAdd = () => {
    setEditTarget(null);
    setShowForm(true);
  };

  const openEdit = (sub: Subscription) => {
    setEditTarget(sub);
    setShowForm(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nom, MAC, IP, commentaire…"
          className="w-full xl:max-w-md"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:ml-auto">
          <FilterTabs
            value={filterStatus}
            onChange={setFilter}
            options={[
              { value: "all", label: "Tous" },
              { value: "active", label: STATUS_CFG.active.label },
              { value: "suspended", label: STATUS_CFG.suspended.label },
              { value: "expired", label: STATUS_CFG.expired.label },
              { value: "pending", label: STATUS_CFG.pending.label },
            ]}
          />
          <Button variant="primary" onClick={openAdd} className="w-full sm:w-auto">
            <Plus size={14} /> Nouvel abonnement
          </Button>
        </div>
      </div>

      <TableCard
        footer={
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{filtered.length} / {subs.length} entrée(s)</span>
            <span className="font-mono text-[10px] text-muted-foreground">Appliqué via Django → MikroTik REST API</span>
          </div>
        }
      >
        <table className="w-full min-w-[1120px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <SortableTH col="clientName" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}>Client</SortableTH>
              <SortableTH col="mac" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}>MAC</SortableTH>
              <SortableTH col="ip" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}>IP</SortableTH>
              <SortableTH col="rateLimit" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}>Plan</SortableTH>
              <SortableTH col="status" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}>Statut</SortableTH>
              <SortableTH col="expiresAt" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}>Expiration</SortableTH>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Trafic ↓/↑</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Quota data</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Dernière vue</th>
              <th className="px-4 py-3 w-32" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <EmptyState message="Aucun abonnement trouvé" />}
            {filtered.map((sub, index) => {
              const statusConfig = STATUS_CFG[sub.status];
              const expiringSoon = sub.status === "active" && new Date(sub.expiresAt) <= new Date(Date.now() + 7 * 86_400_000);
              const usage = getSubscriptionUsage(sub);
              const quotaBytes = getQuotaBytes(sub);
              const quotaPercent = getQuotaPercent(sub);
              const quotaWarning = sub.dataLimitEnabled && quotaPercent >= 85;

              return (
                <tr
                  key={sub.id}
                  className="group animate-soft-in border-b border-border transition-colors last:border-0 hover:bg-muted/35"
                  style={{ animationDelay: `${index * 24}ms` }}
                >
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-foreground">{sub.clientName}</div>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">{sub.comment}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{sub.mac}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{sub.ip}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-primary">{sub.rateLimit}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${statusConfig.dot}`} />
                      <span className={`font-mono text-[10px] font-semibold ${statusConfig.color}`}>{statusConfig.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-[10px] ${expiringSoon ? "text-amber-400" : "text-muted-foreground"}`}>
                      {expiringSoon && "⚠ "}{sub.expiresAt}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {sub.bytesIn > 0 || sub.bytesOut > 0 ? (
                      <div className="font-mono text-[10px]">
                        <span className="text-emerald-400">↓{fmtBytes(sub.bytesIn)}</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-blue-400">↑{fmtBytes(sub.bytesOut)}</span>
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {sub.dataLimitEnabled && quotaBytes > 0 ? (
                      <div className="min-w-32">
                        <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px]">
                          <span className={quotaWarning ? "text-amber-400" : "text-muted-foreground"}>{fmtBytes(usage)}</span>
                          <span className={sub.dataLimitReached || quotaPercent >= 100 ? "text-red-400" : "text-primary"}>{quotaPercent}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all ${sub.dataLimitReached || quotaPercent >= 100 ? "bg-red-400" : quotaWarning ? "bg-amber-400" : "bg-primary"}`}
                            style={{ width: `${quotaPercent}%` }}
                          />
                        </div>
                        <div className="mt-1 font-mono text-[9px] text-muted-foreground">Limite {sub.dataLimitGb} Go · {sub.dataLimitCheckInterval}</div>
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground/40">Illimité</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{sub.lastSeen}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                      <IconButton onClick={() => openEdit(sub)} title="Modifier">
                        <Edit2 size={13} />
                      </IconButton>
                      <IconButton
                        onClick={() => onToggle(sub.id)}
                        className={sub.status === "active" ? "hover:text-amber-400" : "hover:text-emerald-400"}
                        title={sub.status === "active" ? "Suspendre" : "Activer"}
                      >
                        {sub.status === "active" ? <Pause size={13} /> : <Play size={13} />}
                      </IconButton>
                      <IconButton onClick={() => onDelete(sub.id)} className="hover:text-red-400" title="Supprimer">
                        <Trash2 size={13} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>

      {showForm && (
        <SubForm
          initial={editTarget}
          onSave={(data) => onSave(data, editTarget?.id)}
          onClose={() => {
            setShowForm(false);
            setEditTarget(null);
          }}
        />
      )}
    </div>
  );
}
