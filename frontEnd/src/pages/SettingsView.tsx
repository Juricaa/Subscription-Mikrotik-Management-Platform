import { Bell, Database, Shield } from "lucide-react";
import { Button, Card, FormField, Input, SectionHeader, Select } from "../components/ui";

export default function SettingsView() {
  return (
    <div className="grid max-w-6xl grid-cols-1 gap-5 xl:grid-cols-2">
      <Card className="overflow-hidden">
        <SectionHeader title="Base de données MySQL" action={<Database size={17} className="text-primary" />} />
        <div className="space-y-4 p-4 sm:p-5">
          <FormField label="DSN de connexion">
            <Input defaultValue="mysql://admin:***@localhost:3306/netadmin" />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Hôte">
              <Input defaultValue="localhost" />
            </FormField>
            <FormField label="Port">
              <Input type="number" defaultValue="3306" />
            </FormField>
          </div>
          <div className="flex justify-end border-t border-border pt-4">
            <Button variant="primary">Sauvegarder</Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <SectionHeader title="Automatisation & notifications" action={<Bell size={17} className="text-primary" />} />
        <div className="space-y-4 p-4 sm:p-5">
          <FormField label="Intervalle vérification expirations (cron)">
            <Select defaultValue="daily">
              <option value="hourly">Toutes les heures</option>
              <option value="daily">Une fois par jour (recommandé)</option>
              <option value="weekly">Une fois par semaine</option>
            </Select>
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Notification email avant expiration (jours)">
              <Input type="number" defaultValue="7" />
            </FormField>
            <FormField label="Email administrateur">
              <Input type="email" defaultValue="admin@monreseau.bf" />
            </FormField>
          </div>
          <FormField label="Suspension automatique après expiration">
            <Select defaultValue="yes">
              <option value="yes">Oui — suspendre automatiquement</option>
              <option value="no">Non — laisser actif jusqu&apos;à action manuelle</option>
            </Select>
          </FormField>
          <div className="flex justify-end border-t border-border pt-4">
            <Button variant="primary">Sauvegarder</Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden xl:col-span-2">
        <SectionHeader title="Sécurité API Django" action={<Shield size={17} className="text-primary" />} />
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <FormField label="Clé secrète Django (SECRET_KEY)">
              <Input type="password" defaultValue="django-insecure-placeholder" />
            </FormField>
            <FormField label="Origines autorisées (CORS)">
              <Input defaultValue="https://admin.monreseau.bf" />
            </FormField>
            <FormField label="Durée session JWT (heures)">
              <Input type="number" defaultValue="24" />
            </FormField>
          </div>
          <div className="flex justify-end border-t border-border pt-4">
            <Button variant="primary">Sauvegarder</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
