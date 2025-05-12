import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ChartData {
  name: string;
  value: number;
  color: string;
}

interface PaymentPieChartProps {
  data: ChartData[];
}

export function PaymentPieChart({ data }: PaymentPieChartProps) {
  // If no data or all values are 0, show placeholder data
  const hasData = data.some(item => item.value > 0);
  
  const chartData = hasData ? data : [
    { name: "Sem dados", value: 1, color: "#E5E7EB" }
  ];
  
  // Format for tooltip and labels
  const formatValue = (value: number) => {
    return (value / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length && hasData) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2 shadow rounded border text-sm">
          <p className="font-medium">{data.name}</p>
          <p className="text-primary">{formatValue(data.value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          innerRadius={40}
          fill="#8884d8"
          dataKey="value"
          nameKey="name"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={(value) => <span className="text-sm">{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}
