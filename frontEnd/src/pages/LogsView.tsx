import { Download, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge, Button, EmptyState, FilterTabs, SearchInput, TableCard } from "../components/ui";
import { MOCK_LOGS } from "../data/mockData";

export default function LogsView() {
  const [filter, setFilter] = useState<"all" | "success" | "error">("all");
  const [search, setSearch] = useState("");

  const filtered = MOCK_LOGS.filter((log) => {
    const matchFilter = filter === "all" || log.result === filter;
    const q = search.toLowerCase();
    const matchSearch =
      log.action.toLowerCase().includes(q) ||
      log.target.includes(q) ||
      log.detail.toLowerCase().includes(q) ||
      log.operator.includes(q);

    return matchFilter && matchSearch;
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filtrer action, IP, opérateur…"
          className="w-full xl:max-w-md"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:ml-auto">
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Tous" },
              { value: "success", label: "Succès" },
              { value: "error", label: "Erreurs" },
            ]}
          />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="secondary"><RefreshCw size={14} /> Actualiser</Button>
            <Button variant="secondary"><Download size={14} /> Exporter CSV</Button>
          </div>
        </div>
      </div>

      <TableCard
        footer={<span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{filtered.length} entrée(s)</span>}
      >
        <table className="w-full min-w-[860px] font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Horodatage</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Action</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Cible</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Opérateur</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Résultat</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Détail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <EmptyState message="Aucun journal trouvé" />}
            {filtered.map((log, index) => (
              <tr
                key={log.id}
                className="animate-soft-in border-b border-border transition-colors last:border-0 hover:bg-muted/35"
                style={{ animationDelay: `${index * 24}ms` }}
              >
                <td className="px-4 py-3 text-[10px] text-muted-foreground whitespace-nowrap">{log.timestamp}</td>
                <td className="px-4 py-3 text-[10px] font-semibold text-primary">{log.action}</td>
                <td className="px-4 py-3 text-[10px] text-foreground">{log.target}</td>
                <td className="px-4 py-3 text-[10px] text-muted-foreground">{log.operator}</td>
                <td className="px-4 py-3">
                  <Badge variant={log.result === "success" ? "success" : "error"}>
                    {log.result === "success" ? "OK" : "ERREUR"}
                  </Badge>
                </td>
                <td className="max-w-sm truncate px-4 py-3 text-[10px] text-muted-foreground">{log.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
