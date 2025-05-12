import { useState, useEffect } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import moment from 'moment';
import 'moment/locale/pt-br';
import { useQuery } from '@tanstack/react-query';
import { Appointment, Client } from '@shared/schema';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppointmentForm } from './appointment-form';
import { PlusCircle } from 'lucide-react';

moment.locale('pt-br');
const localizer = momentLocalizer(moment);

interface CalendarViewProps {
  onSelectAppointment?: (appointment: Appointment) => void;
}

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: Appointment;
}

const getEventTypeColor = (type: string) => {
  switch (type) {
    case 'consult':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'meeting':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'hearing':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'consultation':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-neutral-100 text-neutral-600 border-neutral-200';
  }
};

export function CalendarView({ onSelectAppointment }: CalendarViewProps) {
  const [currentView, setCurrentView] = useState(Views.WEEK);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  // Fetch appointments
  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ['/api/appointments'],
  });

  // Fetch clients for appointment titles
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  // Convert appointments to calendar events
  useEffect(() => {
    if (appointments.length > 0) {
      const events = appointments.map((appointment) => {
        const client = clients.find((c) => c.id === appointment.clientId);
        const title = `${appointment.title}${client ? ` - ${client.name}` : ''}`;
        
        return {
          id: appointment.id,
          title,
          start: new Date(appointment.startTime),
          end: new Date(appointment.endTime),
          resource: appointment,
        };
      });
      
      setCalendarEvents(events);
    }
  }, [appointments, clients]);

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedAppointment(event.resource);
    if (onSelectAppointment) {
      onSelectAppointment(event.resource);
    }
  };

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    // Create a new appointment with the selected time slot
    const newAppointment: Partial<Appointment> = {
      title: '',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      type: 'meeting',
      status: 'scheduled',
    };
    setSelectedAppointment(newAppointment as Appointment);
    setShowForm(true);
  };

  // Custom event component
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const typeColor = getEventTypeColor(event.resource.type);
    
    return (
      <div className={`rounded px-2 py-1 ${typeColor} border overflow-hidden text-xs`}>
        <div className="font-medium">{event.title}</div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            variant={currentView === Views.MONTH ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentView(Views.MONTH)}
          >
            Mês
          </Button>
          <Button
            variant={currentView === Views.WEEK ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentView(Views.WEEK)}
          >
            Semana
          </Button>
          <Button
            variant={currentView === Views.DAY ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentView(Views.DAY)}
          >
            Dia
          </Button>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Novo Evento
        </Button>
      </div>

      <Card className="p-4">
        <div className="h-[700px]">
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            view={currentView}
            onView={setCurrentView}
            date={currentDate}
            onNavigate={setCurrentDate}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            selectable
            popup
            components={{
              event: EventComponent,
            }}
            formats={{
              dayHeaderFormat: (date: Date) => 
                moment(date).format('dddd, D [de] MMMM'),
              dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) => 
                `${moment(start).format('D [de] MMMM')} - ${moment(end).format('D [de] MMMM')}`,
            }}
            messages={{
              today: 'Hoje',
              previous: 'Anterior',
              next: 'Próximo',
              month: 'Mês',
              week: 'Semana',
              day: 'Dia',
              agenda: 'Agenda',
              date: 'Data',
              time: 'Hora',
              event: 'Evento',
              noEventsInRange: 'Não há eventos neste período.',
            }}
          />
        </div>
      </Card>

      {showForm && (
        <AppointmentForm 
          appointment={selectedAppointment}
          onCancel={() => {
            setShowForm(false);
            setSelectedAppointment(null);
          }}
          onSave={() => {
            setShowForm(false);
            setSelectedAppointment(null);
          }}
        />
      )}
    </div>
  );
}
