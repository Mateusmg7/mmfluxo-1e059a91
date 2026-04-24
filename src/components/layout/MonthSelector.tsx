import { format, addMonths, subMonths, isSameMonth, startOfYear, addMonths as addMonthsDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/contexts/ProfileContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MonthSelector() {
  const { currentMonth, setCurrentMonth } = useProfile();
  const now = new Date();
  
  const isCurrentMonth = isSameMonth(currentMonth, now);

  const goToPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  // Generate last 12 months and next 3 months for the selector
  const months = Array.from({ length: 18 }, (_, i) => {
    return addMonthsDate(startOfYear(subMonths(now, 12)), i);
  });

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={goToPrevMonth} 
          className="h-8 w-8"
        >
          <ChevronLeft size={18} />
        </Button>

        <Select 
          value={format(currentMonth, 'yyyy-MM')} 
          onValueChange={(val) => {
            const [year, month] = val.split('-').map(Number);
            setCurrentMonth(new Date(year, month - 1, 1));
          }}
        >
          <SelectTrigger className="h-8 min-w-[140px] border-none bg-transparent hover:bg-accent hover:text-accent-foreground focus:ring-0 capitalize font-medium">
            <SelectValue placeholder="Selecione o mês" />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem 
                key={format(month, 'yyyy-MM')} 
                value={format(month, 'yyyy-MM')}
                className="capitalize"
              >
                {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={goToNextMonth} 
          className="h-8 w-8"
        >
          <ChevronRight size={18} />
        </Button>
      </div>

      {!isCurrentMonth && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={goToToday} 
          className="h-8 px-2 text-xs hidden sm:flex"
        >
          Hoje
        </Button>
      )}
    </div>
  );
}
