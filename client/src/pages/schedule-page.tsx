import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { CalendarView } from "@/components/schedule/calendar-view";
import { AppointmentForm } from "@/components/schedule/appointment-form";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";
import { Appointment } from "@shared/schema";

export default function SchedulePage() {
  const [showForm, setShowForm] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const handleAppointmentSelect = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowForm(true);
  };

  return (
    <MainLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800">Agenda</h2>
          <p className="text-sm text-neutral-500">Gerencie seus compromissos e eventos.</p>
        </div>
        <Button onClick={() => {
          setSelectedAppointment(null);
          setShowForm(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Evento
        </Button>
      </div>

      {showForm ? (
        <AppointmentForm 
          appointment={selectedAppointment || undefined}
          onCancel={() => {
            setShowForm(false);
            setSelectedAppointment(null);
          }}
          onSave={() => {
            setShowForm(false);
            setSelectedAppointment(null);
          }}
        />
      ) : (
        <CalendarView onSelectAppointment={handleAppointmentSelect} />
      )}
    </MainLayout>
  );
}
