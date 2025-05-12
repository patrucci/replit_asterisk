import { Badge } from "@/components/ui/badge";
import { isPast } from "date-fns";

interface PaymentStatusBadgeProps {
  status: string;
  dueDate: string;
}

export function PaymentStatusBadge({ status, dueDate }: PaymentStatusBadgeProps) {
  // Check if payment is overdue
  const isOverdue = status === "pending" && isPast(new Date(dueDate));
  
  // Select badge styling based on status
  if (status === "paid") {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        Pago
      </Badge>
    );
  } else if (status === "overdue" || isOverdue) {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
        Atrasado
      </Badge>
    );
  } else if (status === "pending") {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
        Pendente
      </Badge>
    );
  } else if (status === "cancelled") {
    return (
      <Badge className="bg-neutral-100 text-neutral-800 hover:bg-neutral-100">
        Cancelado
      </Badge>
    );
  } else {
    return (
      <Badge className="bg-neutral-100 text-neutral-800 hover:bg-neutral-100">
        {status}
      </Badge>
    );
  }
}
