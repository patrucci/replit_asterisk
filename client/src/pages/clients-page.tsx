import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Client } from "@shared/schema";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/clients/client-form";
import { ClientTable } from "@/components/dashboard/client-table";
import { Plus } from "lucide-react";

export default function ClientsPage() {
  const [showForm, setShowForm] = useState(false);

  // Fetch clients
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  return (
    <MainLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800">Clientes</h2>
          <p className="text-sm text-neutral-500">Gerencie todos os seus clientes em um só lugar.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {showForm && (
        <div className="mb-8">
          <ClientForm onCancel={() => setShowForm(false)} />
        </div>
      )}

      <ClientTable clients={clients} />

      {/* Client Form Modal would go here */}
      {/* Client Details would go here if a client is selected */}
    </MainLayout>
  );
}
