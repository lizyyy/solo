import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Box, CssBaseline, Drawer, AppBar, Toolbar, Typography, List, ListItem, ListItemIcon, ListItemText, IconButton } from '@mui/material';
import { Menu as MenuIcon, Dashboard, Science, Storage, Description, AutoFixHigh } from '@mui/icons-material';
import DashboardPage from './pages/Dashboard';
import ChaosExperiments from './pages/ChaosExperiments';
import Migrations from './pages/Migrations';
import Reports from './pages/Reports';
import RealTimeMonitor from './pages/RealTimeMonitor';

const drawerWidth = 240;

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { path: '/', label: '仪表盘', icon: Dashboard },
    { path: '/chaos', label: '混沌实验', icon: Science },
    { path: '/migrations', label: '数据迁移', icon: Storage },
    { path: '/monitor', label: '实时监控', icon: AutoFixHigh },
    { path: '/reports', label: '报告导出', icon: Description },
  ];

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap>
          Chaos Simulator
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <ListItem
            button
            key={item.path}
            component="a"
            href={item.path}
            selected={location.pathname === item.path}
            sx={{
              '&.Mui-selected': { backgroundColor: 'primary.main' },
            }}
          >
            <ListItemIcon sx={{ color: location.pathname === item.path ? 'white' : 'inherit' }}>
              <item.icon />
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            数据迁移混沌实验平台
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/chaos" element={<ChaosExperiments />} />
          <Route path="/migrations" element={<Migrations />} />
          <Route path="/monitor" element={<RealTimeMonitor />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Box>
    </Box>
  );
}

export default App;
