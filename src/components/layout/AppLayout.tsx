import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  
  Bell,
  Target,
  Settings,
  LogOut,
  Menu,
  X,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import ProfileSwitcher from '@/components/ProfileSwitcher';
import AlertBadge from '@/components/notifications/AlertBadge';
import NotificationBell from '@/components/notifications/NotificationBell';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transacoes', label: 'Gastos', icon: ArrowDownCircle },
  { to: '/renda-extra', label: 'Renda Extra', icon: ArrowUpCircle },
  
  { to: '/alertas', label: 'Alertas', icon: Bell, hasBadge: true },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/ranking', label: 'Ranking', icon: Trophy },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-header border-b border-border h-14 flex items-center px-4">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden mr-3 text-foreground"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <h1 className="text-xl font-semibold gradient-brand">MM Fluxo</h1>
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <ProfileSwitcher />
        </div>
      </header>

      <div className="flex flex-1 pt-14">
        {/* Sidebar desktop */}
        <aside className="hidden lg:flex flex-col w-56 fixed top-14 bottom-0 border-r border-border bg-card/50 backdrop-blur-sm">
          <nav className="flex-1 py-4 px-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )
                }
              >
                <span className="relative">
                  <item.icon size={18} />
                  {item.hasBadge && <AlertBadge />}
                </span>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="p-3 border-t border-border">
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-secondary w-full transition-colors"
            >
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <aside
              className="absolute top-14 left-0 bottom-0 w-64 bg-card border-r border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <nav className="py-4 px-3 space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      )
                    }
                  >
                    <span className="relative">
                      <item.icon size={18} />
                      {item.hasBadge && <AlertBadge />}
                    </span>
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="p-3 border-t border-border">
                <button
                  onClick={signOut}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-secondary w-full transition-colors"
                >
                  <LogOut size={18} />
                  Sair
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 lg:ml-56 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
